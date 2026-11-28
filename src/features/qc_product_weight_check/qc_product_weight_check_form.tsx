// NAN_QC_WEIGHT_ITECH_V1
"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import ThaiTime15Picker from "@/src/components/ui/thai-time-15-picker";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

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
  blankQcWeightRow,
  QC_WEIGHT_GROUP_KEYS,
  QC_WEIGHT_HEADER_LABELS,
  QC_WEIGHT_READING_INDEXES,
  QC_WEIGHT_RESULT_OPTIONS,
  updateQcWeightReading,
  updateQcWeightGroupTime,
  type QcProductWeightCheckDocument,
  type QcProductWeightCheckRow,
  type QcWeightErrors,
  type QcWeightGroupKey,
  type QcWeightHeaderField,
  type QcWeightReadingIndex,
  type QcWeightResult,
} from "./qc_product_weight_check_domain";

/* ---------------- types ---------------- */

type Props = {
  document: QcProductWeightCheckDocument;
  errors: QcWeightErrors;
  onChange: (document: QcProductWeightCheckDocument) => void;
  onSave: () => void;
};

/* ---------------- styles ---------------- */

const headerClass =
  "border border-border bg-muted/40 px-2 py-3 " +
  "text-center text-xs font-semibold text-foreground " +
  "whitespace-normal";

const cellClass =
  "border border-border p-2 align-top whitespace-normal";

const inputClass =
  "w-full min-w-0 bg-surface text-sm";

/* ---------------- component ---------------- */

export function QcProductWeightCheckForm({
  document,
  errors,
  onChange,
  onSave,
}: Props) {
  /* ---------------- update header ---------------- */

  function updateHeader(
    field: QcWeightHeaderField,
    value: string,
  ) {
    onChange({
      ...document,
      doc_no:
        document.doc_no.trim() ||
        `QC-W-${crypto.randomUUID()}`,
      [field]: value,
    });
  }

  /* ---------------- update row ---------------- */

  function updateRow(
    rowId: string,
    changes: Partial<QcProductWeightCheckRow>,
  ) {
    onChange({
      ...document,
      rows: document.rows.map((row) =>
        row.id === rowId
          ? { ...row, ...changes }
          : row,
      ),
    });
  }

  /* ---------------- update reading ---------------- */

  function updateReading(
    rowId: string,
    group: QcWeightGroupKey,
    index: QcWeightReadingIndex,
    value: string,
  ) {
    onChange({
      ...document,
      rows: document.rows.map((row) =>
        row.id === rowId
          ? updateQcWeightReading(
            row,
            group,
            index,
            value,
          )
          : row,
      ),
    });
  }

  /* ---------------- add row ---------------- */

  function addRow() {
    onChange({
      ...document,
      rows: [
        ...document.rows,
        blankQcWeightRow(crypto.randomUUID()),
      ],
    });
  }

  /* ---------------- remove row ---------------- */

  function removeRow(rowId: string) {
    const remaining = document.rows.filter(
      (row) => row.id !== rowId,
    );

    onChange({
      ...document,
      rows:
        remaining.length > 0
          ? remaining
          : [
            blankQcWeightRow(
              crypto.randomUUID(),
            ),
          ],
    });
  }

  /* ---------------- field errors ---------------- */

  function fieldError(key: string) {
    if (!errors[key]) {
      return null;
    }

    return (
      <p
        id={`qc-weight-error-${key}`}
        role="alert"
        className="text-xs text-danger"
      >
        {errors[key]}
      </p>
    );
  }

  /* ---------------- header field ---------------- */

  function headerField(
    field: QcWeightHeaderField,
    options?: {
      type?: "text" | "date";
      placeholder?: string;
      required?: boolean;
      multiline?: boolean;
      label?: string;
    },
  ) {
    const id = `qc-weight-${field}`;
    const error = errors[field];

    if (options?.type === "date") {
      return (
        <div
          key={field}
          className="factory-itech-date-filter min-w-0"
        >
          <ThaiBuddhistDatePicker
            label={
              options.label ??
              QC_WEIGHT_HEADER_LABELS[field]
            }
            value={document[field]}
            onChange={(value) =>
              updateHeader(field, value)
            }
            error={error}
            placeholder={options.placeholder}
          />
        </div>
      );
    }

    return (
      <div
        key={field}
        className="grid min-w-0 content-start gap-2"
      >
        <Label htmlFor={id}>
          {options?.label ??
            QC_WEIGHT_HEADER_LABELS[field]}

          {options?.required && (
            <span className="text-danger">*</span>
          )}
        </Label>

        {options?.multiline ? (
          <Textarea
            id={id}
            value={document[field]}
            rows={3}
            placeholder={options.placeholder}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `qc-weight-error-${field}`
                : undefined
            }
            onChange={(event) =>
              updateHeader(
                field,
                event.currentTarget.value,
              )
            }
            className={inputClass}
          />
        ) : (
          <Input
            id={id}
            type={options?.type ?? "text"}
            value={document[field]}
            placeholder={options?.placeholder}
            aria-required={options?.required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error
                ? `qc-weight-error-${field}`
                : undefined
            }
            onChange={(event) =>
              updateHeader(
                field,
                event.currentTarget.value,
              )
            }
            className={inputClass}
          />
        )}

        {fieldError(field)}
      </div>
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
      {/* Document And Product Information */}

      <SectionCard
        title="ข้อมูลเอกสารและผลิตภัณฑ์"
        subtitle=""
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* วันที่ */}
          {headerField("doc_date", {
            type: "date",
          })}

          <div className="grid min-w-0 content-start gap-2">
            <Label htmlFor="qc-weight-doc-no">
              เลขที่เอกสาร
              <span className="text-danger">*</span>
            </Label>

            <Input
              id="qc-weight-doc-no"
              value={document.doc_no}
              placeholder="ระบบสร้างเลขที่เอกสารอัตโนมัติ"
              readOnly
              className={`${inputClass} bg-muted/40`}
            />

            {fieldError("doc_no")}
          </div>

          {/* ผลิตภัณฑ์ */}
          {headerField("product_name", {
            placeholder: "ระบุชื่อผลิตภัณฑ์",
            required: true,
          })}

          {/* หมายเลขล็อต */}

          {headerField("lot_no", {
            placeholder: "ระบุหมายเลขล็อต",
          })}

          {/* ขนาดบรรจุ */}

          {headerField("pack_size", {
            placeholder: "เช่น 500 มล. หรือ 25 กก.",
          })}

          {/* จำนวนบรรจุ */}

          {headerField("pack_count", {
            placeholder: "เช่น 884 ขวด",
          })}

          {/* เกณฑ์น้ำหนัก */}

          {headerField("weight_spec", {
            placeholder: "ระบุเกณฑ์น้ำหนัก",
          })}
        </div>
      </SectionCard>

      {/* Weight Check Table */}

      <SectionCard
        title="ตารางบันทึกผลการตรวจสอบน้ำหนัก"
        subtitle=""
        className="min-w-0 max-w-full"
        contentClassName="min-w-0"
      >
        <div className="min-w-0 space-y-4">
          {fieldError("rows")}

          {/* Table */}

          <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border">
            <Table
              containerProps={{
                className:
                  "w-full min-w-0 max-w-full overflow-x-auto",
              }}
              className="factory-itech-form-table w-[2290px] min-w-[2290px] table-fixed border-collapse text-sm"
            >
              {/* Column Width */}

              <colgroup>
                {/* เวลา */}
                <col className="w-45" />

                {/* กลุ่มที่ 1 - 4 */}
                {QC_WEIGHT_GROUP_KEYS.flatMap(
                  (group) =>
                    QC_WEIGHT_READING_INDEXES.map(
                      (index) => (
                        <col
                          key={`${group}-${index}`}
                          className="w-27.5"
                        />
                      ),
                    ),
                )}

                {/* ค่าเฉลี่ย */}
                <col className="w-30" />

                {/* ผลการตรวจสอบ */}
                <col className="w-37.5" />

                {/* จัดการ */}
                <col className="w-20" />
              </colgroup>

              {/* Table Header */}

              <TableHeader>
                <TableRow>
                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    เวลา
                  </TableHead>

                  {QC_WEIGHT_GROUP_KEYS.map(
                    (group, groupIndex) => (
                      <TableHead
                        key={group}
                        colSpan={4}
                        className={headerClass}
                      >
                        <div className="mx-auto flex min-h-20 w-full items-center justify-center rounded-md bg-surface p-2 text-foreground">
                          {group === "group_1" ? (
                            <span className="text-sm font-semibold">ตั้งค่าเครื่อง</span>
                          ) : (
                            <div className="grid w-full max-w-sm grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                              <div className="min-w-0 space-y-1 text-left">
                                <span className="text-xs font-medium">เริ่มต้น</span>
                                <ThaiTime15Picker
                                  label={`กลุ่มที่ ${groupIndex + 1} เวลาเริ่มต้น`}
                                  value={document.group_times[group].start}
                                  onChange={(value) => onChange(updateQcWeightGroupTime(document, group, "start", value))}
                                  error={errors[`group_times.${group}.start`]}
                                  allowEmpty
                                />
                              </div>
                              <span className="self-center" aria-hidden="true">-</span>
                              <div className="min-w-0 space-y-1 text-left">
                                <span className="text-xs font-medium">สิ้นสุด</span>
                                <ThaiTime15Picker
                                  label={`กลุ่มที่ ${groupIndex + 1} เวลาสิ้นสุด`}
                                  value={document.group_times[group].end}
                                  onChange={(value) => onChange(updateQcWeightGroupTime(document, group, "end", value))}
                                  error={errors[`group_times.${group}.end`]}
                                  allowEmpty
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ),
                  )}

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    ค่าเฉลี่ย
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    ผลการตรวจสอบ
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    จัดการ
                  </TableHead>
                </TableRow>

                <TableRow>
                  {QC_WEIGHT_GROUP_KEYS.flatMap(
                    (group) =>
                      QC_WEIGHT_READING_INDEXES.map(
                        (index) => (
                          <TableHead
                            key={`${group}-${index}`}
                            className={headerClass}
                          >
                            {index + 1}
                          </TableHead>
                        ),
                      ),
                  )}
                </TableRow>
              </TableHeader>

              {/* Table Body */}

              <TableBody>
                {document.rows.map(
                  (row, rowIndex) => {
                    const timeError =
                      errors[
                      `rows.${rowIndex}.time`
                      ];

                    const averageError =
                      errors[
                      `rows.${rowIndex}.average`
                      ];

                    const resultError =
                      errors[
                      `rows.${rowIndex}.result`
                      ];

                    return (
                      <TableRow key={row.id}>
                        {/* Time */}

                        <TableCell
                          className={cellClass}
                        >
                          <ThaiTime15Picker
                            label={`เวลารอบตรวจที่ ${rowIndex + 1}`}
                            value={row.time}
                            onChange={(value) =>
                              updateRow(row.id, {
                                time: value,
                              })
                            }
                            error={timeError}
                            allowEmpty
                          />
                        </TableCell>

                        {/* Measurement Groups */}

                        {QC_WEIGHT_GROUP_KEYS.flatMap(
                          (group, groupIndex) =>
                            QC_WEIGHT_READING_INDEXES.map(
                              (index) => {
                                const key = `rows.${rowIndex}.${group}.${index}`;

                                return (
                                  <TableCell
                                    key={`${row.id}-${group}-${index}`}
                                    className={
                                      cellClass
                                    }
                                  >
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        row
                                          .measurements[
                                        group
                                        ][index]
                                      }
                                      placeholder="0.005"
                                      aria-label={`รอบที่ ${rowIndex + 1} กลุ่มที่ ${groupIndex + 1} ค่า ${index + 1}`}
                                      aria-invalid={Boolean(
                                        errors[key],
                                      )}
                                      onChange={(
                                        event,
                                      ) =>
                                        updateReading(
                                          row.id,
                                          group,
                                          index,
                                          event
                                            .currentTarget
                                            .value,
                                        )
                                      }
                                      className={`${inputClass} text-center tabular-nums`}
                                    />

                                    {fieldError(key)}
                                  </TableCell>
                                );
                              },
                            ),
                        )}

                        {/* Average */}

                        <TableCell className={cellClass}>
                          <Input
                            type="text"
                            value={row.average}
                            placeholder="คำนวณอัตโนมัติ"
                            aria-label={`ค่าเฉลี่ยรอบที่ ${rowIndex + 1}`}
                            aria-invalid={Boolean(averageError)}
                            readOnly
                            className={`${inputClass} bg-muted/40 text-center tabular-nums`}
                          />

                          {fieldError(`rows.${rowIndex}.average`)}
                        </TableCell>

                        {/* Result */}

                        <TableCell
                          className={cellClass}
                        >
                          <Select
                            value={
                              row.result || "UNSET"
                            }
                            onValueChange={(value) => {
                              const result: QcWeightResult =
                                value === "PASS" ||
                                  value === "FAIL"
                                  ? value
                                  : "";

                              updateRow(row.id, {
                                result,
                              });
                            }}
                          >
                            <SelectTrigger
                              aria-label={`ผลตรวจรอบที่ ${rowIndex + 1}`}
                              aria-invalid={Boolean(
                                resultError,
                              )}
                              className="w-full min-w-0 bg-surface"
                            >
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                              <SelectItem value="UNSET">
                                ยังไม่ระบุ
                              </SelectItem>

                              {QC_WEIGHT_RESULT_OPTIONS.map(
                                (option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={
                                      option.value
                                    }
                                  >
                                    {option.label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>

                          {fieldError(
                            `rows.${rowIndex}.result`,
                          )}
                        </TableCell>

                        {/* Delete Row */}

                        <TableCell
                          className={`${cellClass} text-center`}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              removeRow(row.id)
                            }
                            aria-label={`ลบรอบตรวจที่ ${rowIndex + 1}`}
                            title="ลบรอบตรวจ"
                            className="text-danger hover:text-danger"
                          >
                            <Trash2
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  },
                )}
              </TableBody>
            </Table>
          </div>

          {/* Add Row */}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={addRow}
            >
              <Plus
                className="size-4"
                aria-hidden="true"
              />
              เพิ่มรอบตรวจ
            </Button>

            <p className="text-xs text-muted-foreground">
              ค่าเฉลี่ยคำนวณอัตโนมัติ ผลการตรวจสอบให้ระบุเอง
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Remark */}

      <SectionCard title="หมายเหตุ">
        <Textarea
          value={document.remark}
          rows={3}
          placeholder="ระบุหมายเหตุเพิ่มเติม"
          aria-label="หมายเหตุเพิ่มเติม"
          onChange={(event) =>
            updateHeader(
              "remark",
              event.currentTarget.value,
            )
          }
          className={inputClass}
        />
      </SectionCard>

      {/* Prepared / Checked */}
      <SectionCard title="ผู้จัดทำและผู้ตรวจสอบ">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">
              ผู้จัดทำ
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {headerField("prepared_by", {
                label: "ผู้จัดทำ",
                placeholder: "ชื่อผู้จัดทำ",
              })}

              {headerField("prepared_date", {
                type: "date",
                label: "วันที่",
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="mb-4 text-base font-semibold text-slate-900">
              ผู้ตรวจสอบ
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {headerField("checked_by", {
                label: "ผู้ตรวจสอบ",
                placeholder: "ชื่อผู้ตรวจสอบ",
              })}

              {headerField("checked_date", {
                type: "date",
                label: "วันที่",
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Form Actions */}

      <div className="flex flex-wrap items-center justify-end gap-3">

        <Button type="submit">
          {document.id
            ? "บันทึกการแก้ไข"
            : "บันทึกข้อมูล"}
        </Button>
      </div>
    </form>
  );
}