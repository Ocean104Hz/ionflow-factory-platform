"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { SectionCard } from "@/src/components/factory/patterns";

import {
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE,
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE,
  ORGANIC_EXTRACTION_MATERIAL_CODES,
  ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT,
  calculateOrganicExtractionMaterialClosingBalance,
  hasOrganicExtractionMaterialQuantityEntry,
  type OrganicExtractionMaterialLedgerErrors,
  type OrganicExtractionMaterialLedgerRow,
  type OrganicExtractionMaterialLedgerSheet,
  type OrganicExtractionMaterialQuantityField,
} from "./organic_extraction_material_ledger_domain";

type Props = {
  sheet: OrganicExtractionMaterialLedgerSheet;
  errors: OrganicExtractionMaterialLedgerErrors;
  onChange: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type RowEditableField = Exclude<
  keyof OrganicExtractionMaterialLedgerRow,
  "row_number" | "material_code"
>;

type QuantityInputProps = {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const labels = {
  date: "วันที่เอกสาร",
  code: "รหัสแบบฟอร์ม",
  rowNum: "ลำดับ",
  materialCode: "รหัสวัตถุดิบ",
  materialName: "รายชื่อวัตถุดิบ",
  unit: "หน่วย",
  opening: "ยอดยกมา",
  received: "รับเข้า (+)",
  issued: "จ่าย (-)",
  production: "ใช้ผลิต",
  adjustment: "ปรับค่า",
  waste: "ทิ้ง (เสีย)",
  closing: "ยอดคงเหลือ",
  remark: "หมายเหตุ",
  prepared: "ผู้จัดทำ",
  inspected: "ผู้ตรวจสอบ",
  save: "บันทึกข้อมูล",
  saveEdit: "บันทึกการแก้ไข",
  reset: "ล้างข้อมูล",
  cancel: "ยกเลิกการแก้ไข / เริ่มใหม่",
  mock: "UI MOCK เท่านั้น ข้อมูลยังไม่ถูกบันทึกลงฐานข้อมูลจริง",
  note: "ยอดยกมาต้องกรอกเองในทุกเอกสาร ระบบไม่ดึงข้อมูลจากวันก่อนหน้า",
  materialNote: "สามารถแก้ไขชื่อวัตถุดิบและหน่วยได้ ส่วนรหัสวัตถุดิบยึดตามเอกสารต้นฉบับ",
  qtyNote: "เว้นช่องจำนวนที่ยังไม่มีรายการได้ ยอดคงเหลือจะคำนวณเมื่อมีการกรอกจำนวน",
  invalid: "กรุณาตรวจสอบจำนวนที่กรอก",
  rowMissing: "ไม่พบข้อมูลรายการวัตถุดิบลำดับที่",
  remarkPlaceholder: "ระบุหมายเหตุ",
  materialPlaceholder: "ระบุชื่อวัตถุดิบ",
  preparedPlaceholder: "ระบุชื่อผู้จัดทำ",
  inspectedPlaceholder: "ระบุชื่อผู้ตรวจสอบ",
  horizontal: "เลื่อนตารางในแนวนอนเพื่อดูคอลัมน์ทั้งหมดเมื่อหน้าจอแคบ",
  negNote: "ยอดคงเหลือติดลบ แสดงค่าตามข้อมูลที่กรอกและยังไม่บล็อกการบันทึก",
  tableTitle: "รายการรับ-จ่ายวัตถุดิบ",
} as const;

const headClass =
  "border border-border bg-muted/40 px-2 py-3 text-center " +
  "align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle";
const numberClass =
  "h-9 w-full min-w-0 border-border bg-surface text-right " +
  "text-sm tabular-nums";
const textClass = "h-9 w-full min-w-0 border-border bg-surface text-sm";
const remarkClass =
  "min-h-9 w-full min-w-0 resize-y border-border bg-surface text-sm";

const quantityColumns: readonly {
  field: OrganicExtractionMaterialQuantityField;
  label: string;
}[] = [
  { field: "opening_balance", label: labels.opening },
  { field: "received", label: labels.received },
  { field: "issued_for_production", label: labels.production },
  { field: "issued_adjustment", label: labels.adjustment },
  { field: "issued_waste", label: labels.waste },
];

function formatClosingBalance(value: string): string {
  const dotIndex = value.indexOf(".");
  const whole = dotIndex === -1 ? value : value.slice(0, dotIndex);
  const fraction = dotIndex === -1 ? "" : value.slice(dotIndex);
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction}`;
}

function QuantityInput({
  id,
  label,
  value,
  error,
  onChange,
}: QuantityInputProps) {
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 space-y-1">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="-"
        className={numberClass}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrganicExtractionMaterialLedgerForm({
  sheet,
  errors,
  onChange,
  onSave,
  onReset,
}: Props) {
  function updateRow(
    rowNumber: number,
    field: RowEditableField,
    value: string,
  ) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.row_number === rowNumber ? { ...row, [field]: value } : row,
      ),
    });
  }

  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SectionCard title={ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="extraction-ledger-document-date"
                className="block text-sm font-medium leading-5"
              >
                {labels.date} <span className="text-danger">*</span>
              </label>
              <Input
                id="extraction-ledger-document-date"
                type="date"
                value={sheet.document_date}
                aria-invalid={Boolean(errors.document_date)}
                aria-describedby={
                  errors.document_date
                    ? "extraction-ledger-document-date-error"
                    : undefined
                }
                onChange={(event) =>
                  onChange({
                    ...sheet,
                    document_date: event.currentTarget.value,
                  })
                }
                className="h-9 w-full border-border bg-surface"
              />
              {errors.document_date && (
                <p
                  id="extraction-ledger-document-date-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.document_date}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="block text-sm font-medium leading-5">
                {labels.code}
              </p>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium">
                {ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{labels.note}</p>
        </div>
      </SectionCard>

      <SectionCard title={labels.tableTitle}>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-muted-foreground">
            <p>
              {ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT} {labels.rowNum} / {labels.materialNote}
            </p>
            <p>{labels.horizontal}</p>
          </div>
          {errors.rows && (
            <p role="alert" className="text-sm text-danger">
              {errors.rows}
            </p>
          )}
          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
            <Table className="w-full min-w-[1600px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-30" />
                <col className="w-60" />
                <col className="w-20" />
                {quantityColumns.map((column) => (
                  <col key={column.field} className="w-36" />
                ))}
                <col className="w-40" />
                <col className="w-52" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.rowNum}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.materialCode}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.materialName}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.unit}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.opening}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.received}
                  </TableHead>
                  <TableHead colSpan={3} className={headClass}>
                    {labels.issued}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.closing}
                  </TableHead>
                  <TableHead rowSpan={2} className={headClass}>
                    {labels.remark}
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className={headClass}>{labels.production}</TableHead>
                  <TableHead className={headClass}>{labels.adjustment}</TableHead>
                  <TableHead className={headClass}>{labels.waste}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ORGANIC_EXTRACTION_MATERIAL_CODES.map((materialCode, index) => {
                  const rowNumber = index + 1;
                  const row = sheet.rows[index];

                  if (!row || row.row_number !== rowNumber) {
                    return (
                      <TableRow key={materialCode}>
                        <TableCell colSpan={11} className={cellClass}>
                          <p role="alert" className="text-sm text-danger">
                            {labels.rowMissing} {rowNumber}
                          </p>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const closingBalance =
                    calculateOrganicExtractionMaterialClosingBalance(row);
                  const hasEntry = hasOrganicExtractionMaterialQuantityEntry(row);
                  const isNegative = closingBalance?.startsWith("-") ?? false;
                  const codeError = errors[`rows.${index}.material_code`];

                  return (
                    <TableRow key={materialCode}>
                      <TableCell className={`${cellClass} text-center tabular-nums`}>
                        {rowNumber}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <p className="text-center text-xs font-semibold text-foreground">
                          {row.material_code}
                        </p>
                        {codeError && (
                          <p role="alert" className="mt-1 text-xs text-danger">
                            {codeError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <Input
                          id={`extraction-ledger-material-${rowNumber}-name`}
                          type="text"
                          autoComplete="off"
                          aria-label={`${labels.rowNum} ${rowNumber}: ${labels.materialName}`}
                          value={row.material_name}
                          onChange={(event) =>
                            updateRow(rowNumber, "material_name", event.currentTarget.value)
                          }
                          placeholder={labels.materialPlaceholder}
                          className={textClass}
                        />
                      </TableCell>
                      <TableCell className={cellClass}>
                        <Input
                          id={`extraction-ledger-material-${rowNumber}-unit`}
                          type="text"
                          autoComplete="off"
                          aria-label={`${materialCode}: ${labels.unit}`}
                          value={row.unit}
                          onChange={(event) =>
                            updateRow(rowNumber, "unit", event.currentTarget.value)
                          }
                          className={textClass}
                        />
                      </TableCell>
                      {quantityColumns.map(({ field, label }) => (
                        <TableCell key={field} className={cellClass}>
                          <QuantityInput
                            id={`extraction-ledger-${rowNumber}-${field}`}
                            label={`${materialCode}: ${label}`}
                            value={row[field]}
                            error={errors[`rows.${index}.${field}`]}
                            onChange={(value) => updateRow(rowNumber, field, value)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className={`${cellClass} bg-muted/10`}>
                        <output
                          aria-label={`${materialCode}: ${labels.closing}`}
                          className={
                            `block text-right text-sm font-semibold tabular-nums ` +
                            (isNegative ? "text-danger" : "text-foreground")
                          }
                        >
                          {closingBalance === null
                            ? hasEntry
                              ? labels.invalid
                              : "-"
                            : formatClosingBalance(closingBalance)}
                        </output>
                      </TableCell>
                      <TableCell className={cellClass}>
                        <Textarea
                          id={`extraction-ledger-${rowNumber}-remark`}
                          aria-label={`${materialCode}: ${labels.remark}`}
                          rows={2}
                          value={row.remark}
                          onChange={(event) =>
                            updateRow(rowNumber, "remark", event.currentTarget.value)
                          }
                          placeholder={labels.remarkPlaceholder}
                          className={remarkClass}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">{labels.qtyNote}</p>
          <p className="text-xs text-muted-foreground">{labels.negNote}</p>
        </div>
      </SectionCard>

      <SectionCard title={`${labels.prepared} / ${labels.inspected}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="extraction-ledger-prepared-by"
              className="block text-sm font-medium"
            >
              {labels.prepared}
            </label>
            <Input
              id="extraction-ledger-prepared-by"
              type="text"
              value={sheet.prepared_by}
              onChange={(event) =>
                onChange({ ...sheet, prepared_by: event.currentTarget.value })
              }
              placeholder={labels.preparedPlaceholder}
              className={textClass}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="extraction-ledger-inspected-by"
              className="block text-sm font-medium"
            >
              {labels.inspected}
            </label>
            <Input
              id="extraction-ledger-inspected-by"
              type="text"
              value={sheet.inspected_by}
              onChange={(event) =>
                onChange({ ...sheet, inspected_by: event.currentTarget.value })
              }
              placeholder={labels.inspectedPlaceholder}
              className={textClass}
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {sheet.id ? labels.cancel : labels.reset}
        </Button>
        <Button type="submit">{sheet.id ? labels.saveEdit : labels.save}</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {labels.mock}
      </p>
    </form>
  );
}
