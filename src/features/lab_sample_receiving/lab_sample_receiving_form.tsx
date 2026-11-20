
"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/src/components/ui/table";

import { SectionCard } from "@/src/components/factory/patterns";

import {
  blankLabSampleRow,
  type LabSampleField,
  type LabSampleReceivingRow,
  type LabSampleReceivingSheet,
  type LabSampleErrors,
} from "./lab_sample_receiving_domain";

/* ---------------- types ---------------- */

type Props = {
  sheet: LabSampleReceivingSheet;
  errors: LabSampleErrors;
  onChange: (sheet: LabSampleReceivingSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type CellFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "time";
  placeholder?: string;
  error?: string;
  required?: boolean;
  multiline?: boolean;
};

/* ---------------- styles ---------------- */

const tableClass =
  "w-full min-w-[2420px] table-fixed border-collapse text-sm";

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold " +
  "text-foreground whitespace-normal";

const cellClass =
  "border border-border p-2 align-top whitespace-normal";

const fieldClass =
  "w-full min-w-0 border-border bg-surface text-sm";

/* ---------------- reusable field ---------------- */

function CellField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  required = false,
  multiline = false,
}: CellFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 space-y-1.5">
      {multiline ? (
        <Textarea
          id={id}
          aria-label={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) =>
            onChange(event.currentTarget.value)
          }
          placeholder={placeholder}
          rows={2}
          className={`${fieldClass} min-h-10 resize-y`}
        />
      ) : (
        <Input
          id={id}
          type={type}
          aria-label={label}
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          value={value}
          onChange={(event) =>
            onChange(event.currentTarget.value)
          }
          placeholder={placeholder}
          className={fieldClass}
        />
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------- main component ---------------- */

export function LabSampleReceivingForm({
  sheet,
  errors,
  onChange,
  onSave,
  onReset,
}: Props) {
  /* ---------------- update row ---------------- */

  function updateRow(
    rowId: string,
    field: LabSampleField,
    value: string,
  ) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.id === rowId
          ? { ...row, [field]: value }
          : row,
      ),
    });
  }

  /* ---------------- add row ---------------- */

  function addRow() {
    const newRow = blankLabSampleRow(
      crypto.randomUUID(),
    );

    onChange({
      ...sheet,
      rows: [...sheet.rows, newRow],
    });
  }

  /* ---------------- delete row ---------------- */

  function removeRow(rowId: string) {
    const remainingRows = sheet.rows.filter(
      (row) => row.id !== rowId,
    );

    onChange({
      ...sheet,
      rows: remainingRows.length
        ? remainingRows
        : [blankLabSampleRow(crypto.randomUUID())],
    });
  }

  /* ---------------- validation helper ---------------- */

  function getFieldError(
    rowIndex: number,
    field: LabSampleField,
  ) {
    return errors[`rows.${rowIndex}.${field}`];
  }

  /* ---------------- field helper ---------------- */

  function renderField(
    row: LabSampleReceivingRow,
    rowIndex: number,
    field: LabSampleField,
    label: string,
    options?: {
      type?: "text" | "date" | "time";
      placeholder?: string;
      required?: boolean;
      multiline?: boolean;
    },
  ) {
    return (
      <CellField
        id={`lab-${row.id}-${field}`}
        label={label}
        value={row[field]}
        onChange={(value) =>
          updateRow(row.id, field, value)
        }
        error={getFieldError(rowIndex, field)}
        type={options?.type}
        placeholder={options?.placeholder}
        required={options?.required}
        multiline={options?.multiline}
      />
    );
  }

  /* ---------------- render ---------------- */

  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SectionCard
        title="i-Lab แบบบันทึกรับตัวอย่าง"
        subtitle="กรอกข้อมูลการส่งและรับตัวอย่างสำหรับงานวิเคราะห์"
      >
        <div className="space-y-4">
          {/* Information */}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              จำนวนรายการตัวอย่าง{" "}
              <span className="font-semibold text-foreground">
                {sheet.rows.length}
              </span>{" "}
              รายการ
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addRow}
            >
              <Plus className="size-4" />
              เพิ่มแถว
            </Button>
          </div>

          {errors.rows && (
            <p
              role="alert"
              className="text-sm text-danger"
            >
              {errors.rows}
            </p>
          )}

          {/* Table */}

          <div className="min-w-0 rounded-lg border border-border">
            <Table className={tableClass}>
              <colgroup>
                <col className="w-37" />
                <col className="w-30" />
                <col className="w-57.5" />
                <col className="w-77.5" />
                <col className="w-50" />
                <col className="w-57.5" />
                <col className="w-47.5" />
                <col className="w-45" />
                <col className="w-41.25" />
                <col className="w-40" />
                <col className="w-40" />
                <col className="w-60" />
                <col className="w-20" />
              </colgroup>

              {/* Table Header */}

              <TableHeader>
                <TableRow>
                  <TableHead className={headerClass}>
                    วันที่
                  </TableHead>

                  <TableHead className={headerClass}>
                    เวลา
                  </TableHead>

                  <TableHead
                    colSpan={3}
                    className={headerClass}
                  >
                    รายละเอียดตัวอย่าง
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    รายการวิเคราะห์
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    ผู้ส่งตัวอย่าง
                  </TableHead>

                  <TableHead
                    colSpan={4}
                    className={headerClass}
                  >
                    สำหรับเจ้าหน้าที่
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    หมายเหตุ
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    ลบ
                  </TableHead>
                </TableRow>

                <TableRow>
                  <TableHead className={headerClass}>
                    ส่งตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ส่งตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ชื่อตัวอย่าง
                    <span className="text-danger"> *</span>
                  </TableHead>

                  <TableHead className={headerClass}>
                    Lot./วันที่
                    <span className="text-danger"> *</span>
                  </TableHead>

                  <TableHead className={headerClass}>
                    ลักษณะตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ผู้รับตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    วันที่รับตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    รหัสตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    เลขที่คำขอ
                  </TableHead>
                </TableRow>
              </TableHeader>

              {/* Table Body */}

              <TableBody>
                {sheet.rows.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    className="align-top"
                  >
                    {/* วันที่ส่งตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sent_date",
                        "วันที่ส่งตัวอย่าง",
                        { type: "date" },
                      )}
                    </TableCell>

                    {/* เวลาส่งตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sent_time",
                        "เวลาส่งตัวอย่าง",
                        { type: "time" },
                      )}
                    </TableCell>

                    {/* ชื่อตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sample_name",
                        "ชื่อตัวอย่าง",
                        {
                          placeholder: "ระบุชื่อตัวอย่าง",
                          required: true,
                        },
                      )}
                    </TableCell>

                    {/* Lot. / วันที่ */}

                    <TableCell className={cellClass}>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="min-w-0 space-y-1">
                      

                          {renderField(
                            row,
                            rowIndex,
                            "lot_no",
                            "Lot.",
                            {
                              placeholder: "ระบุ Lot.",
                              required: true,
                            },
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                      

                          {renderField(
                            row,
                            rowIndex,
                            "lot_date",
                            "วันที่ Lot.",
                            { type: "date" },
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* ลักษณะตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sample_characteristics",
                        "ลักษณะตัวอย่าง",
                        {
                          multiline: true,
                          placeholder: "ระบุลักษณะตัวอย่าง",
                        },
                      )}
                    </TableCell>

                    {/* รายการวิเคราะห์ */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "analysis_request",
                        "รายการวิเคราะห์",
                        {
                          multiline: true,
                          placeholder: "ระบุรายการวิเคราะห์",
                        },
                      )}
                    </TableCell>

                    {/* ผู้ส่งตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sender_name",
                        "ผู้ส่งตัวอย่าง",
                        {
                          placeholder: "ชื่อผู้ส่ง",
                        },
                      )}
                    </TableCell>

                    {/* ผู้รับตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "received_by",
                        "ผู้รับตัวอย่าง",
                        {
                          placeholder: "ชื่อผู้รับ",
                        },
                      )}
                    </TableCell>

                    {/* วันที่รับตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "received_date",
                        "วันที่รับตัวอย่าง",
                        { type: "date" },
                      )}
                    </TableCell>

                    {/* รหัสตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "sample_code",
                        "รหัสตัวอย่าง",
                        {
                          placeholder: "รหัสตัวอย่าง",
                        },
                      )}
                    </TableCell>

                    {/* เลขที่คำขอ */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "request_no",
                        "เลขที่คำขอ",
                        {
                          placeholder: "เลขที่คำขอ",
                        },
                      )}
                    </TableCell>

                    {/* หมายเหตุ */}

                    <TableCell className={cellClass}>
                      {renderField(
                        row,
                        rowIndex,
                        "remark",
                        "หมายเหตุ",
                        {
                          multiline: true,
                          placeholder: "ระบุหมายเหตุ",
                        },
                      )}
                    </TableCell>

                    {/* Delete Row */}

                    <TableCell
                      className={`${cellClass} text-center align-middle`}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        aria-label={`ลบรายการตัวอย่างแถวที่ ${rowIndex + 1}`}
                        title="ลบแถว"
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Table Footer */}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addRow}
            >
              <Plus className="size-4" />
              เพิ่มแถว
            </Button>

            <p className="text-xs text-muted-foreground">
              * กรุณากรอกชื่อตัวอย่างและ Lot.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Form Actions */}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
        >
          {sheet.id
            ? "ยกเลิกการแก้ไข / เริ่มใหม่"
            : "ล้างข้อมูล"}
        </Button>

        <Button type="submit">
          {sheet.id
            ? "บันทึกการแก้ไข"
            : "บันทึกข้อมูล"}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        UI MOCK เท่านั้น ข้อมูลนี้ยังไม่ถูกบันทึกลงฐานข้อมูลจริง
      </p>
    </form>
  );
}
