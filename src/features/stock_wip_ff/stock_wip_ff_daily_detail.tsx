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
  isStockWipDateInMonth,
  isValidStockWipQuantity,
  type StockWipMovementField,
  type StockWipPeriod,
  type StockWipRow,
  type StockWipSheet,
} from "./stock_wip_ff_domain";

/**
 * Stock WIP FF: daily snapshot detail.
 * All dates are rendered from the selected month, including empty dates.
 * Edits update the Workspace draft; only the Workspace saves to the database.
 * Daily movements do not recalculate monthly or annual summaries.
 */

interface MovementColumn {
  field: StockWipMovementField;
  label: string;
}

const RECEIVED_COLUMN = {
  field: "received",
  label: "รับเข้า (+)",
} as const satisfies MovementColumn;

const ISSUE_COLUMNS = [
  { field: "used_for_production", label: "ใช้ผลิต" },
  { field: "used_for_packaging", label: "บรรจุสินค้า" },
  { field: "other_issues", label: "อื่น ๆ" },
] as const satisfies readonly MovementColumn[];

const TRANSFER_COLUMNS = [
  { field: "transfer_kan_1", label: "กาญ 1" },
  { field: "transfer_kan_3", label: "กาญ 3" },
  { field: "transfer_ico", label: "ICO" },
] as const satisfies readonly MovementColumn[];

const BIO_COLUMN = {
  field: "transfer_bio",
  label: "BIO",
} as const satisfies MovementColumn;

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

function monthDates(
  period: Extract<StockWipPeriod, { view: "MONTH" }>,
): string[] {
  const year = period.year_be - 543;
  const month = String(period.month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, period.month, 0)).getUTCDate();

  return Array.from(
    { length: lastDay },
    (_, index) => `${year}-${month}-${String(index + 1).padStart(2, "0")}`,
  );
}

interface DailyQuantityInputProps {
  row: StockWipRow;
  date: string;
  column: MovementColumn;
  supportsBioTransfer: boolean;
  onChange: (
    codeNew: string,
    date: string,
    field: StockWipMovementField,
    value: string,
  ) => void;
  disabled: boolean;
}

function DailyQuantityInput({
  row,
  date,
  column,
  supportsBioTransfer,
  onChange,
  disabled,
}: DailyQuantityInputProps) {
  const entry = row.daily.find((candidate) => candidate.date === date);
  if (column.field === "transfer_bio" && !supportsBioTransfer) {
    return (
      <span className="block text-center text-xs text-muted-foreground">
        ไม่มีช่อง
      </span>
    );
  }

  // A corrupt null on an available column can still be corrected by typing.
  const value = entry?.values[column.field] ?? "";
  const invalid = !isValidStockWipQuantity(value);
  const dayLabel = DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`));

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      disabled={disabled}
      aria-label={`${dayLabel} ${row.item.code_new} ${column.label}`}
      aria-describedby="stock-wip-daily-quantity-help"
      aria-invalid={invalid}
      title={invalid ? "กรอกจำนวนตั้งแต่ 0 ขึ้นไป หรือปล่อยว่าง" : undefined}
      onChange={(event) =>
        onChange(
          row.item.code_new,
          date,
          column.field,
          event.currentTarget.value,
        )
      }
      className={
        "h-8 min-w-24 bg-surface text-right text-sm tabular-nums " +
        (invalid ? "border-danger bg-danger/5 text-danger" : "")
      }
    />
  );
}

export interface StockWipDailyDetailProps {
  /** Always pass the row from the current draft, not an older saved snapshot. */
  sheet: StockWipSheet;
  row: StockWipRow;
  onChange: (
    codeNew: string,
    date: string,
    field: StockWipMovementField,
    value: string,
  ) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function StockWipDailyDetail({
  sheet,
  row,
  onChange,
  onClose,
  disabled = false,
}: StockWipDailyDetailProps) {
  const period = sheet.period;
  const isMonthly = period.view === "MONTH";
  const dates = isMonthly ? monthDates(period) : [];
  const transferColumns: readonly MovementColumn[] = sheet.supports_bio_transfer
    ? [...TRANSFER_COLUMNS, BIO_COLUMN]
    : TRANSFER_COLUMNS;
  const movementColumns: readonly MovementColumn[] = [
    RECEIVED_COLUMN,
    ...ISSUE_COLUMNS,
    ...transferColumns,
  ];

  const filledDays = row.daily.filter(
    (entry) =>
      isStockWipDateInMonth(entry.date, period) &&
      Object.values(entry.values).some(
        (value) => value !== null && value.trim() !== "",
      ),
  ).length;

  return (
    <Card className="min-w-0 gap-4 rounded-lg py-4 shadow-none">
      <CardHeader className="px-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CalendarDays
                className="size-4 text-primary"
                aria-hidden="true"
              />
              <Badge variant="outline">
                {disabled ? "ดูข้อมูลเท่านั้น" : "ข้อมูลรายวัน"}
              </Badge>
            </div>
            <CardTitle className="text-lg leading-relaxed">
              ข้อมูลรายวันของ {row.item.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {row.item.code_new} · {row.item.code_old ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {sheet.source_sheet_name}
              {isMonthly
                ? ` · ${MONTH_FORMATTER.format(
                    new Date(
                      Date.UTC(period.year_be - 543, period.month - 1, 1),
                    ),
                  )}`
                : ""}
              {isMonthly ? ` · ${filledDays}/${dates.length} วัน` : ""}
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onClose}
            aria-label="ปิด"
            title="ปิด"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 px-4 sm:px-5">
        {isMonthly ? (
          <>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {disabled
                ? "ขณะนี้ไม่สามารถแก้ไขข้อมูลรายวันได้ กรุณาตรวจสอบสถานะจากหน้าหลัก"
                : "การแก้ไขจะอยู่ในฉบับร่าง กรุณากดบันทึกข้อมูลจากหน้า Stock WIP FF หลักเพื่อจัดเก็บลงฐานข้อมูล"}
              <p className="mt-1">
                การแก้ไขยอดรายวันไม่คำนวณยอดสรุปรายเดือนหรือรายปีอัตโนมัติ
              </p>
            </div>

            <Table
              className={
                sheet.supports_bio_transfer ? "min-w-312.5" : "min-w-282.5"
              }
            >
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
                    rowSpan={2}
                    scope="col"
                    className="min-w-32 text-center"
                  >
                    รับเข้า (+)
                  </TableHead>
                  <TableHead
                    colSpan={ISSUE_COLUMNS.length}
                    scope="colgroup"
                    className="border-l text-center"
                  >
                    จ่าย (-)
                  </TableHead>
                  <TableHead
                    colSpan={transferColumns.length}
                    scope="colgroup"
                    className="border-l text-center"
                  >
                    โอน (-)
                  </TableHead>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  {ISSUE_COLUMNS.map((column, index) => (
                    <TableHead
                      key={column.field}
                      scope="col"
                      className={`min-w-28 text-right ${index === 0 ? "border-l" : ""}`}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  {transferColumns.map((column, index) => (
                    <TableHead
                      key={column.field}
                      scope="col"
                      className={`min-w-28 text-right ${index === 0 ? "border-l" : ""}`}
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
                    {movementColumns.map((column) => (
                      <TableCell
                        key={column.field}
                        className={`p-1.5 ${
                          column.field === "used_for_production" ||
                          column.field === "transfer_kan_1"
                            ? "border-l"
                            : ""
                        }`}
                      >
                        <DailyQuantityInput
                          row={row}
                          date={date}
                          column={column}
                          supportsBioTransfer={sheet.supports_bio_transfer}
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
              id="stock-wip-daily-quantity-help"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              กรอกจำนวนตั้งแต่ 0 ขึ้นไป หรือปล่อยว่างได้ (ไม่ต้องใส่จุลภาค)
            </p>
          </>
        ) : (
          <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            {period.year_be === 2568
              ? "ปี 2568 มีเฉพาะข้อมูลรายปี ส่วนข้อมูลรายเดือนมีเฉพาะปี 2569"
              : "ข้อมูลรายเดือนมีเฉพาะปี 2569"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
