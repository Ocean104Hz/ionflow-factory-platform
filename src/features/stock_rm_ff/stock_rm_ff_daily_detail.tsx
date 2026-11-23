"use client";

import { CalendarDays, X } from "lucide-react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  isStockRmDateInMonth,
  isValidStockRmNumber,
  type StockRmMovementField,
  type StockRmPeriod,
  type StockRmRow,
  type StockRmSheet,
} from "./stock_rm_ff_domain";

/**
 * Stock RM FF: UI MOCK ONLY.
 *
 * This component is the content of the daily-detail Dialog. The parent
 * Workspace opens/closes that Dialog and owns all edits, save and discard.
 * No automatic calculation or database writes happen here.
 */

type MonthlyPeriod = Extract<StockRmPeriod, { view: "MONTH" }>;

type DailyColumn = {
  field: StockRmMovementField;
  label: string;
};

const RECEIVED_COLUMNS = [
  { field: "received_weight", label: "น้ำหนัก" },
  { field: "received_value", label: "ราคา / มูลค่า" },
] as const satisfies readonly DailyColumn[];

const ISSUED_COLUMNS = [
  { field: "issued_for_production", label: "ผลิต" },
  { field: "issued_adjustment", label: "ปรับค่า" },
  { field: "issued_discarded", label: "ทิ้ง" },
] as const satisfies readonly DailyColumn[];

const ALL_COLUMNS: readonly DailyColumn[] = [
  ...RECEIVED_COLUMNS,
  ...ISSUED_COLUMNS,
];

const MONTH_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Generate valid dates only (28, 29, 30 or 31 days, as appropriate). */
function datesInStockRmMonth(period: MonthlyPeriod): string[] {
  const year = period.year_be - 543;
  const month = String(period.month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, period.month, 0)).getUTCDate();

  return Array.from({ length: lastDay }, (_, index) =>
    `${year}-${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

interface DailyNumberInputProps {
  row: StockRmRow;
  date: string;
  column: DailyColumn;
  onChange: (
    codeNew: string,
    date: string,
    field: StockRmMovementField,
    value: string,
  ) => void;
  disabled: boolean;
}

function DailyNumberInput({
  row,
  date,
  column,
  onChange,
  disabled,
}: DailyNumberInputProps) {
  const entry = row.daily.find((candidate) => candidate.date === date);
  const rawValue = entry?.values[column.field] ?? "";
  const isInvalid = !isValidStockRmNumber(rawValue);
  const dayLabel = DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`));

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={rawValue}
      disabled={disabled}
      aria-label={`${dayLabel} รหัส ${row.item.code_new} ${column.label}`}
      aria-describedby="stock-rm-daily-number-help"
      aria-invalid={isInvalid}
      title={
        isInvalid
          ? "กรุณากรอกตัวเลขโดยไม่ใส่จุลภาค หรือปล่อยว่าง"
          : rawValue || undefined
      }
      onChange={(event) =>
        onChange(
          row.item.code_new,
          date,
          column.field,
          event.currentTarget.value,
        )
      }
      className={
        "h-8 min-w-32 rounded-none border-0 bg-transparent px-2 " +
        "text-right text-sm tabular-nums shadow-none " +
        "hover:bg-muted/40 focus-visible:border-0 " +
        "focus-visible:bg-accent/60 focus-visible:ring-1 " +
        "focus-visible:ring-ring/50 dark:bg-transparent " +
        "dark:hover:bg-muted/30 dark:focus-visible:bg-accent/40 " +
        (isInvalid ? "bg-danger/10 text-danger dark:bg-danger/15" : "")
      }
    />
  );
}

export interface StockRmDailyDetailProps {
  /** Always pass a row from the current Workspace draft. */
  sheet: StockRmSheet;
  row: StockRmRow;
  onChange: (
    codeNew: string,
    date: string,
    field: StockRmMovementField,
    value: string,
  ) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function StockRmDailyDetail({
  sheet,
  row,
  onChange,
  onClose,
  disabled = false,
}: StockRmDailyDetailProps) {
  const period = sheet.period;
  const isMonthly = period.view === "MONTH";
  const dates = isMonthly ? datesInStockRmMonth(period) : [];

  const filledDays = row.daily.filter(
    (entry) =>
      isStockRmDateInMonth(entry.date, period) &&
      ALL_COLUMNS.some((column) => {
        const value = entry.values[column.field];
        return typeof value === "string" && value.trim() !== "";
      }),
  ).length;

  return (
    <Card className="min-w-0 gap-4 rounded-lg py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <Badge variant="outline">UI MOCK</Badge>
            </div>
            <CardTitle className="text-lg leading-relaxed">
              รายละเอียดรายวัน รหัส {row.item.code_new}
            </CardTitle>
            {row.item.name && (
              <p className="text-sm text-foreground">{row.item.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {sheet.source_sheet_name}
              {isMonthly
                ? ` · ${MONTH_FORMATTER.format(
                    new Date(Date.UTC(period.year_be - 543, period.month - 1, 1)),
                  )}`
                : ` · สรุปรายปี พ.ศ. ${period.year_be}`}
              {isMonthly ? ` · มีรายการ ${filledDays}/${dates.length} วัน` : ""}
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onClose}
            aria-label="ปิดรายละเอียดรายวัน"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 px-4 sm:px-5">
        {isMonthly ? (
          <>
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              ข้อมูลจำลองจาก Excel แสดงทุกวันของเดือนรวมวันที่ว่าง
              การแก้ไขจะอยู่ใน Draft จนกว่าจะกดบันทึกในหน้า Stock RM FF
              และไม่ปรับยอดสรุปหรือราคาเฉลี่ยให้อัตโนมัติ
            </p>

            <Table className="min-w-240">
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    rowSpan={2}
                    scope="col"
                    className="sticky left-0 z-10 w-36 bg-muted text-center"
                  >
                    วันที่บันทึก
                  </TableHead>
                  <TableHead
                    colSpan={RECEIVED_COLUMNS.length}
                    scope="colgroup"
                    className="min-w-64 border-l text-center font-semibold"
                  >
                    รับเข้า (+)
                  </TableHead>
                  <TableHead
                    colSpan={ISSUED_COLUMNS.length}
                    scope="colgroup"
                    className="border-l text-center font-semibold"
                  >
                    จ่าย (-)
                  </TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  {ALL_COLUMNS.map((column, index) => (
                    <TableHead
                      key={column.field}
                      scope="col"
                      className={
                        "min-w-32 text-right " +
                        (index === 0 || index === RECEIVED_COLUMNS.length
                          ? "border-l"
                          : "")
                      }
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dates.map((date) => (
                  <TableRow key={date}>
                    <TableCell className="sticky left-0 z-10 bg-card px-3 font-medium tabular-nums">
                      <time dateTime={date}>
                        {DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`))}
                      </time>
                    </TableCell>
                    {ALL_COLUMNS.map((column, index) => (
                      <TableCell
                        key={column.field}
                        className={
                          "p-1 " +
                          (index === 0 || index === RECEIVED_COLUMNS.length
                            ? "border-l"
                            : "")
                        }
                      >
                        <DailyNumberInput
                          row={row}
                          date={date}
                          column={column}
                          onChange={onChange}
                          disabled={disabled}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <p
              id="stock-rm-daily-number-help"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              กรอกตัวเลขโดยไม่ใส่จุลภาค หรือปล่อยว่างได้
              เลข 0 จะยังคงเป็น 0 และช่องที่กรอกผิดรูปแบบจะแสดงสีเตือน
              รายการที่แก้ไขต้องกดบันทึกจากหน้า Stock RM FF หลัก
            </p>
          </>
        ) : (
          <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            ข้อมูลรายวันมีเฉพาะในชีตรายเดือนของปี พ.ศ. 2569
            ส่วนสรุปรายปีแสดงเป็นข้อมูลรายเดือนแยกต่างหาก
          </p>
        )}
      </CardContent>
    </Card>
  );
}
