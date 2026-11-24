"use client";

import { CalendarDays } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  isValidStockRmNumber,
  type StockRmRow,
  type StockRmSummaryField,
} from "./stock_rm_ff_domain";

/**
 * Stock RM FF: UI MOCK ONLY.
 *
 * Show the original Excel snapshot columns without recalculating weights,
 * average prices, values, or balances. The parent Workspace owns the draft,
 * save/discard actions, and the daily-detail Modal.
 */

type NumericColumn = {
  field: StockRmSummaryField;
  label: string;
};

type NumericGroup = {
  label: string;
  columns: readonly NumericColumn[];
};

/** Excel columns C:Q: five groups of weight / average / value. */
const MAIN_GROUPS = [
  {
    label: "ยกมา",
    columns: [
      { field: "opening_weight", label: "น้ำหนัก" },
      { field: "opening_average_price", label: "เฉลี่ย" },
      { field: "opening_value", label: "ราคา" },
    ],
  },
  {
    label: "รับเข้า",
    columns: [
      { field: "received_weight", label: "น้ำหนัก" },
      { field: "received_average_price", label: "เฉลี่ย" },
      { field: "received_value", label: "ราคา" },
    ],
  },
  {
    label: "รวม",
    columns: [
      { field: "combined_weight", label: "น้ำหนัก" },
      { field: "combined_average_price", label: "เฉลี่ย" },
      { field: "combined_value", label: "ราคา" },
    ],
  },
  {
    label: "จ่าย",
    columns: [
      { field: "issued_weight", label: "น้ำหนัก" },
      { field: "issued_average_price", label: "เฉลี่ย" },
      { field: "issued_value", label: "ราคา" },
    ],
  },
  {
    label: "คงเหลือ",
    columns: [
      { field: "closing_weight", label: "น้ำหนัก" },
      { field: "closing_average_price", label: "เฉลี่ย" },
      { field: "closing_value", label: "ราคา" },
    ],
  },
] as const satisfies readonly NumericGroup[];

/** Excel columns U:V. Kept separate from the main receipt columns. */
const SUM_RECEIVED_COLUMNS = [
  { field: "total_received_weight", label: "น้ำหนัก" },
  { field: "total_received_value", label: "ราคา" },
] as const satisfies readonly NumericColumn[];

/** Excel columns W:Z. These values are not added into main issue totals. */
const SUM_ISSUED_COLUMNS = [
  { field: "total_issued_for_production", label: "ผลิต" },
  { field: "total_issued_adjustment", label: "ปรับค่า" },
  { field: "total_issued_discarded", label: "ทิ้ง" },
  { field: "total_issued_weight", label: "รวม" },
] as const satisfies readonly NumericColumn[];

const MAIN_COLUMN_COUNT = MAIN_GROUPS.reduce(
  (total, group) => total + group.columns.length,
  0,
);

interface NumericInputProps {
  row: StockRmRow;
  column: NumericColumn;
  groupLabel: string;
  onChange: (
    codeNew: string,
    field: StockRmSummaryField,
    value: string,
  ) => void;
  disabled: boolean;
}

function StockRmNumericInput({
  row,
  column,
  groupLabel,
  onChange,
  disabled,
}: NumericInputProps) {
  const rawValue = row.summary[column.field];
  const isInvalid = !isValidStockRmNumber(rawValue);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={rawValue}
      disabled={disabled}
      aria-label={`รหัส ${row.item.code_new} ${groupLabel} ${column.label}`}
      aria-describedby="stock-rm-table-number-help"
      aria-invalid={isInvalid}
      title={
        isInvalid
          ? "กรุณากรอกตัวเลขที่ถูกต้องโดยไม่ใส่จุลภาค หรือปล่อยว่าง"
          : rawValue || undefined
      }
      onChange={(event) =>
        onChange(row.item.code_new, column.field, event.currentTarget.value)
      }
      className={
        "h-8 min-w-28 rounded-none border-0 bg-transparent px-2 " +
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

export interface StockRmTableProps {
  /** Already-filtered rows from the currently selected Excel year or month. */
  rows: readonly StockRmRow[];
  /** Update the React State draft only; do not save or recalculate Excel values. */
  onChange: (
    codeNew: string,
    field: StockRmSummaryField,
    value: string,
  ) => void;
  /** Excel's remark column R is a separately stored string. */
  onRemarkChange: (codeNew: string, value: string) => void;
  /** Provide for monthly sheets to open the daily-details Modal. */
  onViewDaily?: (row: StockRmRow) => void;
  disabled?: boolean;
}

export function StockRmTable({
  rows,
  onChange,
  onRemarkChange,
  onViewDaily,
  disabled = false,
}: StockRmTableProps) {
  const totalColumns =
    2 +
    MAIN_COLUMN_COUNT +
    SUM_RECEIVED_COLUMNS.length +
    SUM_ISSUED_COLUMNS.length +
    1 +
    (onViewDaily ? 1 : 0);

  return (
    <section aria-label="ตาราง Stock RM FF" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            ตาราง Stock RM FF
          </h2>
          <p className="text-sm text-muted-foreground">
            วัตถุดิบ {rows.length.toLocaleString("th-TH")} รายการ · แก้ไขน้ำหนัก
            ราคาเฉลี่ย และมูลค่าได้ในข้อมูลจำลอง
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          เลื่อนตารางในแนวนอนเพื่อดูคอลัมน์ทั้งหมด
        </p>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table className="min-w-[3220px]">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} scope="col" className="w-14 text-center">
                No.
              </TableHead>
              <TableHead
                rowSpan={2}
                scope="col"
                className="min-w-28 text-center"
              >
                Code New
              </TableHead>
              {MAIN_GROUPS.map((group) => (
                <TableHead
                  key={group.label}
                  colSpan={group.columns.length}
                  scope="colgroup"
                  className="border-l text-center font-semibold"
                >
                  {group.label}
                </TableHead>
              ))}
              <TableHead rowSpan={2} scope="col" className="min-w-48 border-l">
                หมายเหตุ
              </TableHead>
              <TableHead
                colSpan={SUM_RECEIVED_COLUMNS.length}
                scope="colgroup"
                className="border-l text-center font-semibold"
              >
                รับเข้า (Sum)
              </TableHead>
              <TableHead
                colSpan={SUM_ISSUED_COLUMNS.length}
                scope="colgroup"
                className="border-l text-center font-semibold"
              >
                จ่าย (Sum)
              </TableHead>
              {onViewDaily && (
                <TableHead
                  rowSpan={2}
                  scope="col"
                  className="w-28 border-l text-center"
                >
                  รายวัน
                </TableHead>
              )}
            </TableRow>
            <TableRow className="hover:bg-transparent">
              {MAIN_GROUPS.flatMap((group) =>
                group.columns.map((column, index) => (
                  <TableHead
                    key={column.field}
                    scope="col"
                    className={`min-w-28 text-right ${index === 0 ? "border-l" : ""}`}
                  >
                    {column.label}
                  </TableHead>
                )),
              )}
              {SUM_RECEIVED_COLUMNS.map((column, index) => (
                <TableHead
                  key={column.field}
                  scope="col"
                  className={`min-w-28 text-right ${index === 0 ? "border-l" : ""}`}
                >
                  {column.label}
                </TableHead>
              ))}
              {SUM_ISSUED_COLUMNS.map((column, index) => (
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  className="px-4 py-12 text-center"
                >
                  <p className="font-medium text-foreground">
                    ไม่พบรายการวัตถุดิบ
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ลองเปลี่ยนปี เดือน หรือรหัสที่ค้นหา
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.item.code_new}>
                  <TableCell className="text-center text-muted-foreground tabular-nums">
                    {row.item.no}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground tabular-nums">
                    {row.item.code_new}
                  </TableCell>

                  {MAIN_GROUPS.map((group) =>
                    group.columns.map((column, index) => (
                      <TableCell
                        key={column.field}
                        className={`p-1 ${index === 0 ? "border-l" : ""}`}
                      >
                        <StockRmNumericInput
                          row={row}
                          column={column}
                          groupLabel={group.label}
                          onChange={onChange}
                          disabled={disabled}
                        />
                      </TableCell>
                    )),
                  )}

                  <TableCell className="border-l p-1">
                    <Input
                      type="text"
                      autoComplete="off"
                      value={row.remark}
                      disabled={disabled}
                      aria-label={`หมายเหตุรหัส ${row.item.code_new}`}
                      title={row.remark || undefined}
                      onChange={(event) =>
                        onRemarkChange(
                          row.item.code_new,
                          event.currentTarget.value,
                        )
                      }
                      className={
                        "h-8 min-w-48 rounded-none border-0 bg-transparent px-2 " +
                        "text-sm shadow-none hover:bg-muted/40 " +
                        "focus-visible:border-0 focus-visible:bg-accent/60 " +
                        "focus-visible:ring-1 focus-visible:ring-ring/50 " +
                        "dark:bg-transparent dark:hover:bg-muted/30 " +
                        "dark:focus-visible:bg-accent/40"
                      }
                    />
                  </TableCell>

                  {SUM_RECEIVED_COLUMNS.map((column, index) => (
                    <TableCell
                      key={column.field}
                      className={`p-1 ${index === 0 ? "border-l" : ""}`}
                    >
                      <StockRmNumericInput
                        row={row}
                        column={column}
                        groupLabel="รับเข้า Sum"
                        onChange={onChange}
                        disabled={disabled}
                      />
                    </TableCell>
                  ))}
                  {SUM_ISSUED_COLUMNS.map((column, index) => (
                    <TableCell
                      key={column.field}
                      className={`p-1 ${index === 0 ? "border-l" : ""}`}
                    >
                      <StockRmNumericInput
                        row={row}
                        column={column}
                        groupLabel="จ่าย Sum"
                        onChange={onChange}
                        disabled={disabled}
                      />
                    </TableCell>
                  ))}

                  {onViewDaily && (
                    <TableCell className="border-l text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewDaily(row)}
                        aria-label={`ดูข้อมูลรายวันของรหัส ${row.item.code_new}`}
                      >
                        <CalendarDays className="size-4" aria-hidden="true" />
                        ดูรายวัน
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>

          <TableCaption className="px-3 pb-3 text-left text-xs leading-relaxed">
            ข้อมูล Mock ตาม Excel · คอลัมน์ “ราคา” คือมูลค่า ไม่ใช่ราคาเฉลี่ย ·
            ไม่คำนวณยอดคงเหลือหรือราคาเฉลี่ยอัตโนมัติ · ส่วน Sum
            ไม่ถูกรวมซ้ำกับยอดหลัก · ช่องว่างไม่เท่ากับ 0
          </TableCaption>
        </Table>
      </div>

      <p
        id="stock-rm-table-number-help"
        className="text-xs leading-relaxed text-muted-foreground"
      >
        ช่องตัวเลขไม่มีกรอบและยังแก้ไขได้ กรอกจำนวนโดยไม่ใช้จุลภาค
        หรือปล่อยว่างได้ ค่า 0 จะไม่ถูกแปลงเป็นช่องว่าง
        ช่องที่ผิดรูปแบบจะแสดงสีเตือน และต้องแก้ก่อนบันทึก
        ข้อมูลที่แก้ไขยังไม่ถูกบันทึกจนกว่าจะกดบันทึกใน Workspace
      </p>
    </section>
  );
}
