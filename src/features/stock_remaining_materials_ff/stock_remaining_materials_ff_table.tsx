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
  isValidStockMaterialNumber,
  stockMaterialRowRef,
  type StockMaterialRow,
  type StockMaterialSummaryField,
} from "./stock_remaining_materials_ff_domain";

/**
 * Remaining Materials FF: Excel-based UI mock.
 *
 * This table renders the original F:W summary columns without changing
 * their numbers or recalculating the balances and prices. The Workspace
 * owns the React State draft, save/discard actions, and daily-detail modal.
 *
 * Never use a product code or the No. column as a row key: both can repeat.
 * Excel rows retain source_row; new mock rows have source_row=0 and client_id.
 * Separate callbacks keep Excel row numbers and new mock client IDs distinct.
 */

type SummaryColumn = {
  field: StockMaterialSummaryField;
  label: string;
};

type SummaryGroup = {
  label: string;
  columns: readonly SummaryColumn[];
};

/** Excel F:U: sixteen original summary fields, in their original order. */
const SUMMARY_GROUPS: readonly SummaryGroup[] = [
  {
    label: "ยอดยกมา",
    columns: [{ field: "opening_quantity", label: "จำนวน" }],
  },
  {
    label: "รับซื้อ (+)",
    columns: [
      { field: "purchased_quantity", label: "จำนวน" },
      { field: "purchased_unit_price", label: "ราคาต่อชิ้น" },
      { field: "purchased_value", label: "รวมราคา" },
    ],
  },
  {
    label: "รับโอน (+)",
    columns: [
      { field: "transfer_received_quantity", label: "จำนวน" },
      { field: "transfer_received_unit_price", label: "ราคาต่อชิ้น" },
      { field: "transfer_received_value", label: "รวมราคา" },
    ],
  },
  {
    label: "ยอดรวม",
    columns: [
      { field: "combined_quantity", label: "จำนวน" },
      { field: "combined_unit_price", label: "ราคาต่อชิ้น" },
      { field: "combined_value", label: "รวมราคา" },
    ],
  },
  {
    label: "จ่าย (-)",
    columns: [
      { field: "issued_for_production", label: "ผลิต" },
      { field: "issued_damaged", label: "ชำรุด" },
      { field: "issued_to_bio", label: "โอน BIO" },
      { field: "issued_other", label: "อื่น ๆ" },
    ],
  },
  {
    label: "รวมจ่าย",
    columns: [{ field: "total_issued_quantity", label: "จำนวน" }],
  },
  {
    label: "คงเหลือ",
    columns: [{ field: "closing_quantity", label: "จำนวน" }],
  },
];

const SUMMARY_COLUMN_COUNT = SUMMARY_GROUPS.reduce(
  (total, group) => total + group.columns.length,
  0,
);

const NUMBER_HELP_ID = "stock-remaining-materials-ff-table-number-help";

const EDITABLE_CELL_CLASS =
  "h-8 rounded-none border-0 bg-transparent px-2 text-sm shadow-none " +
  "hover:bg-muted/40 focus-visible:border-0 focus-visible:bg-accent/60 " +
  "focus-visible:ring-1 focus-visible:ring-ring/50 " +
  "dark:bg-transparent dark:hover:bg-muted/30 " +
  "dark:focus-visible:bg-accent/40";

/** Human-readable row label that never mistakes a mock row for Excel row 0. */
function stockMaterialTableRowLabel(row: StockMaterialRow): string {
  return row.item.client_id === undefined
    ? `แถว Excel ${row.item.source_row} ${row.item.name}`
    : `วัสดุเพิ่มใหม่ ${row.item.name} รหัสรายการ ${row.item.client_id}`;
}

interface SummaryInputProps {
  row: StockMaterialRow;
  column: SummaryColumn;
  groupLabel: string;
  disabled: boolean;
  onChange: (field: StockMaterialSummaryField, value: string) => void;
}

function StockRemainingMaterialsFfNumberInput({
  row,
  column,
  groupLabel,
  disabled,
  onChange,
}: SummaryInputProps) {
  const value = row.summary[column.field];
  const invalid = !isValidStockMaterialNumber(value);
  const itemLabel = stockMaterialTableRowLabel(row);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      disabled={disabled}
      aria-label={`${itemLabel} ${groupLabel} ${column.label}`}
      aria-describedby={NUMBER_HELP_ID}
      aria-invalid={invalid}
      title={
        invalid
          ? "กรุณากรอกตัวเลขโดยไม่ใส่จุลภาค หรือปล่อยว่าง"
          : value || undefined
      }
      onChange={(event) => onChange(column.field, event.currentTarget.value)}
      className={
        `${EDITABLE_CELL_CLASS} min-w-28 text-right tabular-nums ` +
        (invalid ? "bg-danger/10 text-danger dark:bg-danger/15" : "")
      }
    />
  );
}

interface TextInputProps {
  row: StockMaterialRow;
  value: string;
  label: string;
  onChange: (value: string) => void;
  disabled: boolean;
  wide?: boolean;
}

function StockRemainingMaterialsFfTextInput({
  row,
  value,
  label,
  onChange,
  disabled,
  wide = false,
}: TextInputProps) {
  return (
    <Input
      type="text"
      autoComplete="off"
      value={value}
      disabled={disabled}
      aria-label={`${stockMaterialTableRowLabel(row)} ${label}`}
      title={value || undefined}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={`${EDITABLE_CELL_CLASS} ${wide ? "min-w-52" : "min-w-36"}`}
    />
  );
}

export interface StockRemainingMaterialsFfTableProps {
  /** Rows already filtered for the selected real Excel monthly sheet. */
  rows: readonly StockMaterialRow[];
  /** Edit F:U numeric snapshot cells in the parent's React State draft. */
  onChange: (
    sourceRow: number,
    field: StockMaterialSummaryField,
    value: string,
  ) => void;
  /** Edit Excel V; free text may include notes. */
  onRemarkChange: (sourceRow: number, value: string) => void;
  /** Edit Excel W; Safety-Stock is free text, not a forced number. */
  onSafetyStockChange: (sourceRow: number, value: string) => void;
  /** Only mock-created rows use these optional client_id callbacks. */
  onNewSummaryChange?: (
    clientId: string,
    field: StockMaterialSummaryField,
    value: string,
  ) => void;
  onNewRemarkChange?: (clientId: string, value: string) => void;
  onNewSafetyStockChange?: (clientId: string, value: string) => void;
  /** Existing daily-detail handler for a real Excel row. */
  onViewDaily?: (row: StockMaterialRow) => void;
  /** Handler for daily details of newly created mock rows. */
  onViewDailyNew?: (row: StockMaterialRow) => void;
  /** Read-only mode for the numeric, remark, and Safety-Stock inputs. */
  disabled?: boolean;
}

export function StockRemainingMaterialsFfTable({
  rows,
  onChange,
  onRemarkChange,
  onSafetyStockChange,
  onNewSummaryChange,
  onNewRemarkChange,
  onNewSafetyStockChange,
  onViewDaily,
  onViewDailyNew,
  disabled = false,
}: StockRemainingMaterialsFfTableProps) {
  const totalColumns = 5 + SUMMARY_COLUMN_COUNT + 2 + (onViewDaily ? 1 : 0);

  return (
    <section aria-label="ตารางวัสดุคงเหลือ FF" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            ตารางวัสดุคงเหลือ FF
          </h2>
          <p className="text-sm text-muted-foreground">
            รายการวัสดุ {rows.length.toLocaleString("th-TH")} แถว
            {disabled ? " · โหมดดูข้อมูล" : " · แก้ไขข้อมูลจำลองได้"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          เลื่อนตารางในแนวนอนเพื่อดูทุกคอลัมน์
        </p>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table className="min-w-[3000px]">
          <TableHeader className="bg-muted/60">
            <TableRow className="hover:bg-transparent">
              <TableHead rowSpan={2} scope="col" className="w-14 text-center">
                No.
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-32">
                ประเภท
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-32">
                รหัสสินค้า
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-72">
                รายการบรรจุภัณฑ์
              </TableHead>
              <TableHead
                rowSpan={2}
                scope="col"
                className="min-w-20 text-center"
              >
                หน่วยนับ
              </TableHead>

              {SUMMARY_GROUPS.map((group) => (
                <TableHead
                  key={group.label}
                  colSpan={group.columns.length}
                  scope="colgroup"
                  className="border-l text-center font-semibold"
                >
                  {group.label}
                </TableHead>
              ))}

              <TableHead rowSpan={2} scope="col" className="min-w-52 border-l">
                หมายเหตุ
              </TableHead>
              <TableHead rowSpan={2} scope="col" className="min-w-36 border-l">
                Safety-Stock
              </TableHead>
              {onViewDaily && (
                <TableHead
                  rowSpan={2}
                  scope="col"
                  className="min-w-28 border-l text-center"
                >
                  รายวัน
                </TableHead>
              )}
            </TableRow>

            <TableRow className="hover:bg-transparent">
              {SUMMARY_GROUPS.map((group) =>
                group.columns.map((column, index) => (
                  <TableHead
                    key={column.field}
                    scope="col"
                    className={
                      `min-w-28 text-right ` + (index === 0 ? "border-l" : "")
                    }
                  >
                    {column.label}
                  </TableHead>
                )),
              )}
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
                    ไม่พบรายการวัสดุ
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ลองเลือกเดือนอื่น หรือเปลี่ยนคำค้นหา
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const rowRef = stockMaterialRowRef(row);
                const isNewRow = typeof rowRef === "string";
                const rowKey = isNewRow ? `mock:${rowRef}` : `excel:${rowRef}`;

                return (
                  <TableRow key={rowKey}>
                    <TableCell
                      title={
                        isNewRow
                          ? "รายการเพิ่มใหม่ใน UI Mock (ไม่มีเลขแถว Excel)"
                          : `แถวที่ ${row.item.source_row} ใน Excel`
                      }
                      className="text-center text-muted-foreground tabular-nums"
                    >
                      {isNewRow ? (
                        <span className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          ใหม่
                        </span>
                      ) : (
                        (row.item.no ?? "–")
                      )}
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal text-sm text-muted-foreground">
                      {row.item.category ?? "–"}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground tabular-nums">
                      {row.item.code ?? "–"}
                    </TableCell>
                    <TableCell
                      title={row.item.name}
                      className="max-w-80 whitespace-normal font-medium text-foreground"
                    >
                      {row.item.name}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {row.item.unit ?? "–"}
                    </TableCell>

                    {SUMMARY_GROUPS.map((group) =>
                      group.columns.map((column, index) => (
                        <TableCell
                          key={column.field}
                          className={`p-1 ` + (index === 0 ? "border-l" : "")}
                        >
                          <StockRemainingMaterialsFfNumberInput
                            row={row}
                            column={column}
                            groupLabel={group.label}
                            onChange={(field, value) => {
                              if (isNewRow) {
                                onNewSummaryChange?.(rowRef, field, value);
                              } else {
                                onChange(rowRef, field, value);
                              }
                            }}
                            disabled={
                              disabled || (isNewRow && !onNewSummaryChange)
                            }
                          />
                        </TableCell>
                      )),
                    )}

                    <TableCell className="border-l p-1">
                      <StockRemainingMaterialsFfTextInput
                        row={row}
                        value={row.remark}
                        label="หมายเหตุ"
                        onChange={(value) => {
                          if (isNewRow) {
                            onNewRemarkChange?.(rowRef, value);
                          } else {
                            onRemarkChange(rowRef, value);
                          }
                        }}
                        disabled={disabled || (isNewRow && !onNewRemarkChange)}
                        wide
                      />
                    </TableCell>
                    <TableCell className="border-l p-1">
                      <StockRemainingMaterialsFfTextInput
                        row={row}
                        value={row.safety_stock}
                        label="Safety-Stock"
                        onChange={(value) => {
                          if (isNewRow) {
                            onNewSafetyStockChange?.(rowRef, value);
                          } else {
                            onSafetyStockChange(rowRef, value);
                          }
                        }}
                        disabled={
                          disabled || (isNewRow && !onNewSafetyStockChange)
                        }
                      />
                    </TableCell>

                    {onViewDaily && (
                      <TableCell className="border-l text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isNewRow && !onViewDailyNew}
                          onClick={() => {
                            if (isNewRow) {
                              onViewDailyNew?.(row);
                            } else {
                              onViewDaily(row);
                            }
                          }}
                          aria-label={`ดูข้อมูลรายวันของ ${stockMaterialTableRowLabel(row)}`}
                        >
                          <CalendarDays className="size-4" aria-hidden="true" />
                          {isNewRow && !onViewDailyNew
                            ? "รอเชื่อมรายวัน"
                            : "ดูรายวัน"}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>

          <TableCaption className="px-3 pb-3 text-left text-xs leading-relaxed">
            ข้อมูล Mock ตาม Excel · หมายเหตุและ Safety-Stock เป็นข้อความอิสระ ·
            ไม่คำนวณยอดรวม คงเหลือ หรือราคาอัตโนมัติ · ช่องว่างแตกต่างจากเลข 0 ·
            รหัสสินค้าซ้ำได้ · รายการเดิมอ้างอิงเลขแถว Excel
            ส่วนรายการที่เพิ่มใหม่ใช้รหัส client_id
          </TableCaption>
        </Table>
      </div>

      <p
        id={NUMBER_HELP_ID}
        className="text-xs leading-relaxed text-muted-foreground"
      >
        ช่องตัวเลขแก้ไขได้เมื่ออยู่ในโหมดแก้ไข
        กรอกโดยไม่ใช้จุลภาคหรือปล่อยว่างได้ ค่า 0 จะไม่ถูกเปลี่ยนเป็นช่องว่าง
        หากกรอกตัวเลขผิดรูปแบบจะแสดงสีเตือน และต้องแก้ก่อนบันทึก
        การเปลี่ยนแปลงจะยังไม่ถูกบันทึกจนกว่าจะกดบันทึกใน Workspace
        รายการเพิ่มใหม่จะเปิดแก้ไขและดูรายวันได้หลัง Workspace เชื่อม Callback
        ของ client_id
      </p>
    </section>
  );
}
