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
  ORGANIC_QC_RESULTS,
  ORGANIC_RAW_MATERIAL_FORM_CODE,
  ORGANIC_RAW_MATERIAL_FORM_TITLE,
  ORGANIC_RAW_MATERIAL_ROW_COUNT,
  isOrganicQcResult,
  type OrganicQcField,
  type OrganicQcResult,
  type OrganicRawMaterialErrors,
  type OrganicRawMaterialReceivingSheet,
} from "./organic_raw_material_receiving_domain";

type Props = {
  sheet: OrganicRawMaterialReceivingSheet;
  errors: OrganicRawMaterialErrors;
  onChange: (sheet: OrganicRawMaterialReceivingSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type TextRowField =
  | "material_code"
  | "supplier_code"
  | "quantity"
  | "unit"
  | "remark";

type TextCellFieldProps = {
  rowNumber: number;
  field: TextRowField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "text";
  placeholder?: string;
};

type QcCellFieldProps = {
  rowNumber: number;
  field: OrganicQcField;
  label: string;
  value: OrganicQcResult;
  error?: string;
  onChange: (value: OrganicQcResult) => void;
};

const labels = {
  date: "วันที่เอกสาร",
  code: "รหัสแบบฟอร์ม",
  number: "ลำดับ",
  material: "รหัสวัตถุดิบ",
  supplier: "รหัส Supplier",
  quantity: "จำนวน",
  unit: "หน่วย",
  qc: "การตรวจสอบคุณภาพ",
  weight: "น้ำหนัก",
  contamination: "สิ่งปนเปื้อน",
  physical: "กายภาพ",
  color: "สี",
  remark: "หมายเหตุ",
  receivedBy: "ผู้รับ",
  inspectedBy: "ผู้ตรวจสอบ",
  save: "บันทึกข้อมูล",
  saveEdit: "บันทึกการแก้ไข",
  reset: "ล้างข้อมูล",
  cancel: "ยกเลิกการแก้ไข / เริ่มใหม่",
  blankRows: "",
  mock: "UI MOCK เท่านั้น ข้อมูลนี้ยังไม่ถูกบันทึกลงฐานข้อมูลจริง",
} as const;

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle";
const inputClass = "h-9 w-full min-w-0 border-border bg-surface text-sm";

const qcColumns: readonly { field: OrganicQcField; label: string }[] = [
  { field: "qc_weight", label: labels.weight },
  { field: "qc_contamination", label: labels.contamination },
  { field: "qc_physical", label: labels.physical },
  { field: "qc_color", label: labels.color },
];

function TextCellField({
  rowNumber,
  field,
  label,
  value,
  error,
  onChange,
  inputMode = "text",
  placeholder,
}: TextCellFieldProps) {
  const id = `organic-material-${rowNumber}-${field}`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 space-y-1">
      <Input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        aria-label={`${labels.number} ${rowNumber}: ${label}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className={[
          inputClass,
          field === "quantity" ? "text-right tabular-nums" : "",
        ].join(" ")}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function QcCellField({
  rowNumber,
  field,
  label,
  value,
  error,
  onChange,
}: QcCellFieldProps) {
  const id = `organic-material-${rowNumber}-${field}`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 space-y-1">
      <select
        id={id}
        aria-label={`${labels.number} ${rowNumber}: ${label}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => {
          const next = event.currentTarget.value;
          if (isOrganicQcResult(next)) {
            onChange(next);
          }
        }}
        className={
          "h-9 w-full min-w-0 rounded-md border border-border " +
          "bg-surface px-2 text-center text-sm text-foreground " +
          "outline-none focus-visible:border-ring focus-visible:ring-2 " +
          "focus-visible:ring-ring/50 aria-invalid:border-destructive"
        }
      >
        <option value="">-</option>
        {ORGANIC_QC_RESULTS.map((result) => (
          <option key={result.value} value={result.value}>
            {`${result.value} = ${result.label}`}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrganicRawMaterialReceivingForm({
  sheet,
  errors,
  onChange,
  onSave,
  onReset,
}: Props) {
  function updateTextRow(
    rowNumber: number,
    field: TextRowField,
    value: string,
  ) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.row_number === rowNumber ? { ...row, [field]: value } : row,
      ),
    });
  }

  function updateQcRow(
    rowNumber: number,
    field: OrganicQcField,
    value: OrganicQcResult,
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
      <SectionCard title={ORGANIC_RAW_MATERIAL_FORM_TITLE}>
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="organic-material-document-date"
                className="block text-sm font-medium leading-5"
              >
                {labels.date} <span className="text-danger">*</span>
              </label>
              <Input
                id="organic-material-document-date"
                type="date"
                value={sheet.document_date}
                aria-invalid={Boolean(errors.document_date)}
                aria-describedby={
                  errors.document_date
                    ? "organic-material-document-date-error"
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
                  id="organic-material-document-date-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.document_date}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium leading-5">{labels.code}</p>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium">
                {ORGANIC_RAW_MATERIAL_FORM_CODE}
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{labels.blankRows}</p>

          {errors.rows && (
            <p role="alert" className="text-sm text-danger">
              {errors.rows}
            </p>
          )}

          <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
            <Table className="w-full min-w-370 table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-48" />
                <col className="w-48" />
                <col className="w-36" />
                <col className="w-28" />
                <col className="w-32" />
                <col className="w-36" />
                <col className="w-32" />
                <col className="w-32" />
                <col className="w-56" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.number}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.material}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.supplier}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.quantity}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.unit}
                  </TableHead>
                  <TableHead colSpan={4} className={headerClass}>
                    {labels.qc}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {labels.remark}
                  </TableHead>
                </TableRow>
                <TableRow>
                  {qcColumns.map((column) => (
                    <TableHead key={column.field} className={headerClass}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(
                  { length: ORGANIC_RAW_MATERIAL_ROW_COUNT },
                  (_, index) => {
                    const rowNumber = index + 1;
                    const row = sheet.rows[index];
                    const rowError = errors[`rows.${index}.row_number`];

                    if (!row || row.row_number !== rowNumber) {
                      return (
                        <TableRow key={rowNumber}>
                          <TableCell colSpan={10} className={cellClass}>
                            <p role="alert" className="text-sm text-danger">
                              {rowError || `ไม่พบข้อมูลแถวที่ ${rowNumber}`}
                            </p>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow key={rowNumber} className="align-middle">
                        <TableCell
                          className={`${cellClass} text-center tabular-nums`}
                        >
                          {rowNumber}
                        </TableCell>
                        <TableCell className={cellClass}>
                          <TextCellField
                            rowNumber={rowNumber}
                            field="material_code"
                            label={labels.material}
                            value={row.material_code}
                            error={errors[`rows.${index}.material_code`]}
                            onChange={(value) =>
                              updateTextRow(rowNumber, "material_code", value)
                            }
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          <TextCellField
                            rowNumber={rowNumber}
                            field="supplier_code"
                            label={labels.supplier}
                            value={row.supplier_code}
                            onChange={(value) =>
                              updateTextRow(rowNumber, "supplier_code", value)
                            }
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          <TextCellField
                            rowNumber={rowNumber}
                            field="quantity"
                            label={labels.quantity}
                            value={row.quantity}
                            error={errors[`rows.${index}.quantity`]}
                            onChange={(value) =>
                              updateTextRow(rowNumber, "quantity", value)
                            }
                            inputMode="decimal"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableCell className={cellClass}>
                          <TextCellField
                            rowNumber={rowNumber}
                            field="unit"
                            label={labels.unit}
                            value={row.unit}
                            error={errors[`rows.${index}.unit`]}
                            onChange={(value) =>
                              updateTextRow(rowNumber, "unit", value)
                            }
                          />
                        </TableCell>
                        {qcColumns.map((column) => (
                          <TableCell key={column.field} className={cellClass}>
                            <QcCellField
                              rowNumber={rowNumber}
                              field={column.field}
                              label={column.label}
                              value={row[column.field]}
                              error={errors[`rows.${index}.${column.field}`]}
                              onChange={(value) =>
                                updateQcRow(rowNumber, column.field, value)
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell className={cellClass}>
                          <div className="min-w-0 space-y-1">
                            <Textarea
                              id={`organic-material-${rowNumber}-remark`}
                              aria-label={`${labels.number} ${rowNumber}: ${labels.remark}`}
                              value={row.remark}
                              onChange={(event) =>
                                updateTextRow(
                                  rowNumber,
                                  "remark",
                                  event.currentTarget.value,
                                )
                              }
                              rows={2}
                              className="min-h-10 w-full min-w-0 resize-y border-border bg-surface text-sm"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {ORGANIC_QC_RESULTS.map((result) => (
              <span key={result.value}>
                <span className="font-semibold text-foreground">
                  {result.value}
                </span>{" "}
                = {result.label}
              </span>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`${labels.receivedBy} / ${labels.inspectedBy}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="organic-material-received-by"
              className="block text-sm font-medium leading-5"
            >
              {labels.receivedBy}
            </label>
            <Input
              id="organic-material-received-by"
              value={sheet.received_by}
              onChange={(event) =>
                onChange({ ...sheet, received_by: event.currentTarget.value })
              }
              className="h-9 w-full border-border bg-surface"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="organic-material-inspected-by"
              className="block text-sm font-medium leading-5"
            >
              {labels.inspectedBy}
            </label>
            <Input
              id="organic-material-inspected-by"
              value={sheet.inspected_by}
              onChange={(event) =>
                onChange({ ...sheet, inspected_by: event.currentTarget.value })
              }
              className="h-9 w-full border-border bg-surface"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {sheet.id ? labels.cancel : labels.reset}
        </Button>
        <Button type="submit">
          {sheet.id ? labels.saveEdit : labels.save}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{labels.mock}</p>
    </form>
  );
}
