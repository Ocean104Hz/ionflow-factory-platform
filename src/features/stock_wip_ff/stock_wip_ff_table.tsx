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
  isValidStockWipQuantity,
  type StockWipRow,
  type StockWipSummaryField,
} from "./stock_wip_ff_domain";

/**
 * Stock WIP FF: UI MOCK ONLY.
 * This is a controlled table. The Workspace owns drafts and decides when to save.
 * Neither this component nor its inputs recalculate stock balances.
 */

type QuantityColumn = {
  field: StockWipSummaryField;
  label: string;
};

const OPENING_COLUMN = {
  field: "opening_balance",
  label: "ยอดยกมา",
} as const satisfies QuantityColumn;

const RECEIVED_COLUMN = {
  field: "received",
  label: "รับเข้า (+)",
} as const satisfies QuantityColumn;

const ISSUE_COLUMNS = [
  { field: "used_for_production", label: "ใช้ผลิต" },
  { field: "used_for_packaging", label: "บรรจุสินค้า" },
  { field: "other_issues", label: "อื่น ๆ" },
] as const satisfies readonly QuantityColumn[];

const TRANSFER_COLUMNS = [
  { field: "transfer_kan_1", label: "กาญ 1" },
  { field: "transfer_kan_3", label: "กาญ 3" },
  { field: "transfer_ico", label: "ICO" },
] as const satisfies readonly QuantityColumn[];

const BIO_COLUMN = {
  field: "transfer_bio",
  label: "BIO",
} as const satisfies QuantityColumn;

const CLOSING_COLUMN = {
  field: "closing_balance",
  label: "ยอดคงเหลือ",
} as const satisfies QuantityColumn;

interface QuantityInputProps {
  row: StockWipRow;
  column: QuantityColumn;
  onChange: (
    codeNew: string,
    field: StockWipSummaryField,
    value: string,
  ) => void;
  disabled: boolean;
}

function StockWipQuantityInput({
  row,
  column,
  onChange,
  disabled,
}: QuantityInputProps) {
  const rawValue = row.summary[column.field];

  // null means that a source column does not exist. Never turn it into "0".
  if (rawValue === null) {
    return (
      <span
        className="block text-center text-xs text-danger"
        title="ช่องนี้ไม่มีอยู่ในแบบฟอร์มต้นฉบับ"
      >
        ไม่มีช่อง
      </span>
    );
  }

  const isInvalid = !isValidStockWipQuantity(rawValue);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={rawValue}
      disabled={disabled}
      aria-label={`${row.item.code_new} ${row.item.name} ${column.label}`}
      aria-describedby="stock-wip-table-quantity-help"
      aria-invalid={isInvalid}
      title={isInvalid ? "กรอกจำนวนตั้งแต่ 0 ขึ้นไป หรือปล่อยว่าง" : undefined}
      onChange={(event) =>
        onChange(row.item.code_new, column.field, event.currentTarget.value)
      }
      className={
        "h-8 min-w-24 rounded-none border-0 bg-transparent text-right " +
        "text-sm tabular-nums shadow-none hover:bg-muted/40 " +
        "focus-visible:border-0 focus-visible:bg-accent/60 focus-visible:ring-0 " +
        "dark:bg-transparent dark:hover:bg-muted/30 dark:focus-visible:bg-accent/40 " +
        (isInvalid ? "bg-danger/5 text-danger dark:bg-danger/10" : "")
      }
    />
  );
}

export interface StockWipTableProps {
  /** Rows from the selected year or month after filtering in the Workspace. */
  rows: readonly StockWipRow[];
  /** False for January and February 2569, following the Excel layout. */
  supportsBioTransfer: boolean;
  /** Changes the draft only. The Save button belongs to the Workspace. */
  onChange: (
    codeNew: string,
    field: StockWipSummaryField,
    value: string,
  ) => void;
  /** Optional detail action, intended for monthly worksheets only. */
  onViewDaily?: (row: StockWipRow) => void;
  disabled?: boolean;
}

export function StockWipTable({
  rows,
  supportsBioTransfer,
  onChange,
  onViewDaily,
  disabled = false,
}: StockWipTableProps) {
  const transferColumns: readonly QuantityColumn[] = supportsBioTransfer
    ? [...TRANSFER_COLUMNS, BIO_COLUMN]
    : TRANSFER_COLUMNS;

  const quantityColumns: readonly QuantityColumn[] = [
    OPENING_COLUMN,
    RECEIVED_COLUMN,
    ...ISSUE_COLUMNS,
    ...transferColumns,
    CLOSING_COLUMN,
  ];

  const totalColumns = 5 + quantityColumns.length + (onViewDaily ? 1 : 0);

  return (
    <section aria-label="ตาราง Stock WIP" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            ตาราง Stock WIP
          </h2>
          <p className="text-sm text-muted-foreground">
            ข้อมูลสินค้า {rows.length.toLocaleString("th-TH")} รายการ ·
            แก้ตัวเลขได้และบันทึกผ่านหน้าหลัก
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          เลื่อนตารางในแนวนอนเพื่อดูคอลัมน์ทั้งหมด
        </p>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table
          className={supportsBioTransfer ? "min-w-[1700px]" : "min-w-[1580px]"}
        >
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} scope="col" className="w-14 text-center">
                No.
              </TableHead>
              <TableHead colSpan={2} scope="colgroup" className="text-center">
                Code
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-52">
                รายการ
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="w-20 text-center">
                หน่วย
              </TableHead>
              <TableHead
                rowSpan={2}
                scope="col"
                className="min-w-28 text-right"
              >
                ยอดยกมา
              </TableHead>
              <TableHead
                rowSpan={2}
                scope="col"
                className="min-w-28 text-right"
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
              <TableHead
                rowSpan={2}
                scope="col"
                className="min-w-32 border-l text-right"
              >
                ยอดคงเหลือ
              </TableHead>
              {onViewDaily && (
                <TableHead rowSpan={2} scope="col" className="w-28 text-center">
                  รายวัน
                </TableHead>
              )}
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="min-w-32 text-center">
                New
              </TableHead>
              <TableHead scope="col" className="min-w-28 text-center">
                Old
              </TableHead>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={totalColumns}
                  className="px-4 py-12 text-center"
                >
                  <p className="font-medium text-foreground">
                    ไม่พบรายการสินค้า
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ลองเปลี่ยนหมวดสินค้าหรือคำค้นหาในตัวกรอง
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.item.code_new}>
                  <TableCell className="text-center text-muted-foreground tabular-nums">
                    {row.item.no}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {row.item.code_new}
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {row.item.code_old ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-60 whitespace-normal font-medium leading-relaxed text-foreground">
                    {row.item.name}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {row.item.unit}
                  </TableCell>
                  {quantityColumns.map((column) => (
                    <TableCell
                      key={column.field}
                      className={`p-1.5 ${
                        column.field === "closing_balance" ||
                        column.field === "used_for_production" ||
                        column.field === "transfer_kan_1"
                          ? "border-l"
                          : ""
                      }`}
                    >
                      <StockWipQuantityInput
                        row={row}
                        column={column}
                        onChange={onChange}
                        disabled={disabled}
                      />
                    </TableCell>
                  ))}
                  {onViewDaily && (
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onViewDaily(row)}
                        aria-label={`ดูข้อมูลรายวันของ ${row.item.name}`}
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
            ค่าที่แสดงมาจาก Mock Data ตาม Excel · ไม่คำนวณยอดคงเหลืออัตโนมัติ ·
            ช่องว่างไม่เท่ากับ 0 · ช่อง BIO จะแสดงเฉพาะชีตที่มีคอลัมน์นี้
          </TableCaption>
        </Table>
      </div>

      <p
        id="stock-wip-table-quantity-help"
        className="text-xs leading-relaxed text-muted-foreground"
      >
        กรอกจำนวนตั้งแต่ 0 ขึ้นไป หรือปล่อยว่างได้ (ไม่ต้องใส่จุลภาค)
        ช่องที่กรอกผิดรูปแบบจะแสดงสีเตือน และต้องแก้ให้ถูกก่อนบันทึก
        การแก้ไขในตารางยังไม่ถือเป็นการบันทึกจนกว่าจะกดบันทึกใน Workspace
      </p>
    </section>
  );
}
