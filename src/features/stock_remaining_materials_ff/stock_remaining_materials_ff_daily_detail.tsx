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
  isStockMaterialDateInPeriod,
  isValidStockMaterialNumber,
  stockMaterialRowRef,
  type StockMaterialDailyField,
  type StockMaterialDailyValues,
  type StockMaterialPeriod,
  type StockMaterialRow,
  type StockMaterialSheet,
} from "./stock_remaining_materials_ff_domain";

/**
 * Remaining Materials FF: daily Excel snapshot in the Workspace Dialog.
 *
 * The Workspace owns the active draft, modal visibility and save/discard flow.
 * The eight daily columns are displayed exactly as they appear in Excel:
 * four receiving/value columns followed by four issue columns.
 *
 * This component does not write to storage or recalculate the monthly totals.
 * Imported items use their Excel source_row; newly created mock items use a
 * separate client_id. Never route a mock row's source_row=0 into the Excel handler.
 */

type DailyColumn = {
  field: StockMaterialDailyField;
  label: string;
};

const RECEIVED_COLUMNS = [
  { field: "purchased_quantity", label: "รับซื้อ" },
  { field: "transfer_received_quantity", label: "รับโอน" },
  { field: "unit_price", label: "ราคาต่อชิ้น" },
  { field: "received_value", label: "รวมราคา" },
] as const satisfies readonly DailyColumn[];

const ISSUED_COLUMNS = [
  { field: "issued_for_production", label: "ผลิต" },
  { field: "issued_damaged", label: "ชำรุด" },
  { field: "issued_transfer", label: "โอน" },
  { field: "issued_other", label: "อื่น ๆ" },
] as const satisfies readonly DailyColumn[];

const DAILY_COLUMNS: readonly DailyColumn[] = [
  ...RECEIVED_COLUMNS,
  ...ISSUED_COLUMNS,
];

const DAY_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const MONTH_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAILY_HELP_ID = "stock-remaining-materials-ff-daily-number-help";

const DAILY_INPUT_CLASS =
  "h-8 min-w-28 rounded-none border-0 bg-transparent px-2 " +
  "text-right text-sm tabular-nums shadow-none " +
  "hover:bg-muted/40 focus-visible:border-0 " +
  "focus-visible:bg-accent/60 focus-visible:ring-1 " +
  "focus-visible:ring-ring/50 dark:bg-transparent " +
  "dark:hover:bg-muted/30 dark:focus-visible:bg-accent/40";

/** Return only dates that really exist in the selected Gregorian month. */
function datesInStockMaterialPeriod(period: StockMaterialPeriod): string[] {
  const year = period.year_be - 543;
  const month = String(period.month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, period.month, 0)).getUTCDate();

  return Array.from({ length: lastDay }, (_, index) =>
    `${year}-${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

export interface StockRemainingMaterialsFfDailyDetailProps {
  /** Use the currently selected Excel month from the Workspace draft. */
  sheet: StockMaterialSheet;
  /** Use the matching row from the current draft, not a saved snapshot. */
  row: StockMaterialRow;
  /** Existing Excel rows keep the numeric callback used by Workspace. */
  onChange: (
    sourceRow: number,
    date: string,
    field: StockMaterialDailyField,
    value: string,
  ) => void;
  /** Mock-created materials use client_id, never Excel source_row=0. */
  onNewChange?: (
    clientId: string,
    date: string,
    field: StockMaterialDailyField,
    value: string,
  ) => void;
  onClose: () => void;
  disabled?: boolean;
}

interface DailyNumberInputProps {
  row: StockMaterialRow;
  date: string;
  column: DailyColumn;
  value: string;
  onChange: (date: string, field: StockMaterialDailyField, value: string) => void;
  disabled: boolean;
}

/** Give new rows meaningful labels instead of calling them Excel row 0. */
function stockMaterialDailyItemLabel(row: StockMaterialRow): string {
  return row.item.client_id === undefined
    ? `แถว Excel ${row.item.source_row} ${row.item.name}`
    : `วัสดุเพิ่มใหม่ ${row.item.name} รหัสรายการ ${row.item.client_id}`;
}

function StockRemainingMaterialsFfDailyNumberInput({
  row,
  date,
  column,
  value,
  onChange,
  disabled,
}: DailyNumberInputProps) {
  const invalid = !isValidStockMaterialNumber(value);
  const dayLabel = DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`));

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      disabled={disabled}
      aria-label={`${dayLabel} ${stockMaterialDailyItemLabel(row)} ${column.label}`}
      aria-describedby={DAILY_HELP_ID}
      aria-invalid={invalid}
      title={
        invalid
          ? "กรุณากรอกตัวเลขโดยไม่ใส่จุลภาค หรือปล่อยว่าง"
          : value || undefined
      }
      onChange={(event) =>
        onChange(date, column.field, event.currentTarget.value)
      }
      className={
        `${DAILY_INPUT_CLASS} ` +
        (invalid ? "bg-danger/10 text-danger dark:bg-danger/15" : "")
      }
    />
  );
}

export function StockRemainingMaterialsFfDailyDetail({
  sheet,
  row,
  onChange,
  onNewChange,
  onClose,
  disabled = false,
}: StockRemainingMaterialsFfDailyDetailProps) {
  const rowRef = stockMaterialRowRef(row);
  const isNewRow = typeof rowRef === "string";
  // Keep the existing Workspace compatible until its own update step.
  const inputsDisabled = disabled || (isNewRow && !onNewChange);

  function handleDailyFieldChange(
    date: string,
    field: StockMaterialDailyField,
    value: string,
  ) {
    if (typeof rowRef === "string") {
      onNewChange?.(rowRef, date, field, value);
    } else {
      onChange(rowRef, date, field, value);
    }
  }

  const { period } = sheet;
  const dates = datesInStockMaterialPeriod(period);
  const dailyByDate = new Map<string, StockMaterialDailyValues>(
    row.daily
      .filter((entry) => isStockMaterialDateInPeriod(entry.date, period))
      .map((entry) => [entry.date, entry.values] as const),
  );

  const daysWithValues = dates.filter((date) => {
    const values = dailyByDate.get(date);
    return (
      values !== undefined &&
      DAILY_COLUMNS.some((column) => (values[column.field] ?? "").trim() !== "")
    );
  }).length;

  const monthLabel = MONTH_FORMATTER.format(
    new Date(Date.UTC(period.year_be - 543, period.month - 1, 1)),
  );

  return (
    <Card className="min-w-0 gap-4 rounded-lg py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <Badge variant="outline">UI MOCK</Badge>
              <Badge variant="secondary">รายวัน</Badge>
              {isNewRow && <Badge variant="outline">วัสดุเพิ่มใหม่</Badge>}
            </div>
            <CardTitle className="text-lg leading-relaxed">
              รายละเอียดรับ-จ่ายรายวัน
            </CardTitle>
            <p className="wrap-break-word text-sm font-medium text-foreground">
              {row.item.name}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              รหัส {row.item.code ?? "ไม่มีรหัส"}
              {` · หน่วย ${row.item.unit ?? "ไม่ระบุ"}`}
              {isNewRow
                ? " · รายการเพิ่มใหม่ในเดือนนี้"
                : ` · แถว Excel ${row.item.source_row}`}
              {row.item.category ? ` · ${row.item.category}` : ""}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {sheet.source_sheet_name} · {monthLabel} · มีค่าบันทึก {daysWithValues}
              /{dates.length} วัน (นับค่า 0 ด้วย)
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onClose}
            aria-label="ปิดรายละเอียดรับ-จ่ายรายวัน"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 px-4 sm:px-5">
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          แสดงทุกวันของเดือนตามปฏิทิน แม้วันที่ไม่มีรายการ · {isNewRow
            ? "รายการนี้เพิ่มใหม่ใน React State"
            : "ค่าจาก Excel เป็นข้อมูลจำลอง"}
          {" "}ไม่เชื่อมต่อฐานข้อมูล · การแก้ไขยังอยู่ใน Draft
          จนกว่าจะกดบันทึกจากหน้า วัสดุคงเหลือ FF · ไม่คำนวณยอดสรุป
          คงเหลือ หรือราคาใหม่อัตโนมัติ
        </p>

        <div className="min-w-0 rounded-md border">
          <Table className="min-w-290">
            <TableHeader className="bg-muted/60">
              <TableRow className="hover:bg-transparent">
                <TableHead
                  rowSpan={2}
                  scope="col"
                  className="sticky left-0 z-10 w-32 bg-muted text-center"
                >
                  วันที่บันทึก
                </TableHead>
                <TableHead
                  colSpan={RECEIVED_COLUMNS.length}
                  scope="colgroup"
                  className="border-l text-center font-semibold"
                >
                  รับเข้า (+) / มูลค่า
                </TableHead>
                <TableHead
                  colSpan={ISSUED_COLUMNS.length}
                  scope="colgroup"
                  className="border-l text-center font-semibold"
                >
                  จ่ายออก (-)
                </TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {DAILY_COLUMNS.map((column, index) => (
                  <TableHead
                    key={column.field}
                    scope="col"
                    className={
                      "min-w-28 text-right " +
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
                  {DAILY_COLUMNS.map((column, index) => (
                    <TableCell
                      key={column.field}
                      className={
                        "p-1 " +
                        (index === 0 || index === RECEIVED_COLUMNS.length
                          ? "border-l"
                          : "")
                      }
                    >
                      <StockRemainingMaterialsFfDailyNumberInput
                        row={row}
                        date={date}
                        column={column}
                        value={dailyByDate.get(date)?.[column.field] ?? ""}
                        onChange={handleDailyFieldChange}
                        disabled={inputsDisabled}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p
          id={DAILY_HELP_ID}
          className="text-xs leading-relaxed text-muted-foreground"
        >
          กรอกตัวเลขโดยไม่ใส่จุลภาค หรือปล่อยว่างได้ · เลข 0 แตกต่างจากช่องว่าง
          · ช่องที่กรอกผิดรูปแบบจะแสดงสีเตือนและต้องแก้ก่อนบันทึก
          · ช่อง “โอน” รายวันไม่ถูกตีความว่าเป็น “โอน BIO” ของยอดสรุปรายเดือน
        </p>
        {disabled && (
          <p className="text-xs text-muted-foreground">
            ขณะนี้อยู่ในโหมดดูข้อมูล หากต้องการแก้ไขให้เลือกโหมดแก้ไขจาก Workspace
          </p>
        )}
        {isNewRow && !onNewChange && !disabled && (
          <p className="text-xs text-muted-foreground">
            รายการเพิ่มใหม่ยังไม่เปิดให้แก้ไขรายวัน จนกว่า Workspace จะเชื่อม
            Callback ของ client_id ในขั้นตอนถัดไป
          </p>
        )}
      </CardContent>
    </Card>
  );
}

