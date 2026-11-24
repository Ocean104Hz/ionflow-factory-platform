"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { PackagePlus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";

import {
  STOCK_MATERIAL_FF_DAILY_FIELDS,
  blankStockMaterialCreateInput,
  blankStockMaterialDaily,
  isValidStockMaterialNumber,
  isStockMaterialDateInPeriod,
  type StockMaterialCreateInput,
  type StockMaterialDailyField,
  type StockMaterialDailyValues,
  type StockMaterialPeriod,
} from "./stock_remaining_materials_ff_domain";

/**
 * UI mock: create one material and optionally several daily movements.
 * Each date has one set of eight Excel daily cells; duplicate dates are not
 * supported by the existing material model. Monthly summary fields are not
 * entered here and remain blank in the new row, never auto-calculated.
 * Workspace continues to own the draft, Save and Discard behavior.
 */
export interface StockRemainingMaterialsFfCreateFormProps {
  open: boolean;
  period: StockMaterialPeriod;
  onOpenChange: (open: boolean) => void;
  /** Returning false (or throwing) keeps the form open for correction. */
  onCreate: (input: StockMaterialCreateInput) => void | boolean;
  disabled?: boolean;
}

const MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

type CreateTextField = Exclude<
  keyof StockMaterialCreateInput,
  "summary" | "daily"
>;

type DailyColumn = {
  field: StockMaterialDailyField;
  label: string;
};

type DailyGroup = {
  label: string;
  columns: readonly DailyColumn[];
};

const DAILY_GROUPS: readonly DailyGroup[] = [
  {
    label: "รับเข้า (+) / มูลค่า",
    columns: [
      { field: "purchased_quantity", label: "รับซื้อ" },
      { field: "transfer_received_quantity", label: "รับโอน" },
      { field: "unit_price", label: "ราคาต่อชิ้น" },
      { field: "received_value", label: "รวมราคา" },
    ],
  },
  {
    label: "จ่ายออก (-)",
    columns: [
      { field: "issued_for_production", label: "ผลิต" },
      { field: "issued_damaged", label: "ชำรุด" },
      { field: "issued_transfer", label: "โอน" },
      { field: "issued_other", label: "อื่น ๆ" },
    ],
  },
];

interface DailyDraftRow {
  id: number;
  date: string;
  values: StockMaterialDailyValues;
}

function blankDailyDraftRow(id: number): DailyDraftRow {
  return { id, date: "", values: blankStockMaterialDaily() };
}

function hasDailyMovementValues(values: StockMaterialDailyValues): boolean {
  return STOCK_MATERIAL_FF_DAILY_FIELDS.some(
    (field) => values[field].trim() !== "",
  );
}

export function StockRemainingMaterialsFfCreateForm({
  open,
  period,
  onOpenChange,
  onCreate,
  disabled = false,
}: StockRemainingMaterialsFfCreateFormProps) {
  const formId = useId();
  const nextDailyRowId = useRef(1);
  const [values, setValues] = useState<StockMaterialCreateInput>(
    blankStockMaterialCreateInput,
  );
  const [dailyRows, setDailyRows] = useState<DailyDraftRow[]>([
    blankDailyDraftRow(0),
  ]);
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const periodLabel = `${MONTH_NAMES[period.month - 1]} พ.ศ. ${period.year_be}`;
  const fieldId = (field: CreateTextField): string => `${formId}-${field}`;
  const nameErrorId = `${formId}-name-error`;
  const dailyNumberHelpId = `${formId}-daily-number-help`;
  const dailyFieldId = (
    rowId: number,
    field: StockMaterialDailyField,
  ): string => `${formId}-daily-${rowId}-${field}`;
  const dailyDateId = (rowId: number): string =>
    `${formId}-daily-${rowId}-date`;
  const dailyDateErrorId = (rowId: number): string =>
    `${formId}-daily-${rowId}-date-error`;
  const dailyFieldErrorId = (
    rowId: number,
    field: StockMaterialDailyField,
  ): string => `${dailyFieldId(rowId, field)}-error`;

  const calendarYear = period.year_be - 543;
  const monthPrefix = `${calendarYear}-${String(period.month).padStart(2, "0")}`;
  const firstDate = `${monthPrefix}-01`;
  const daysInMonth = new Date(
    Date.UTC(calendarYear, period.month, 0),
  ).getUTCDate();
  const lastDate = `${monthPrefix}-${String(daysInMonth).padStart(2, "0")}`;
  const duplicateDates = new Set<string>();
  const seenDates = new Set<string>();
  for (const row of dailyRows) {
    if (row.date !== "") {
      if (seenDates.has(row.date)) {
        duplicateDates.add(row.date);
      }
      seenDates.add(row.date);
    }
  }

  const invalidDailyFields = dailyRows.flatMap((row) =>
    STOCK_MATERIAL_FF_DAILY_FIELDS.filter(
      (field) => !isValidStockMaterialNumber(row.values[field]),
    ).map((field) => ({ rowId: row.id, field })),
  );
  const invalidDailyDates = dailyRows.filter(
    (row) =>
      (row.date !== "" && !isStockMaterialDateInPeriod(row.date, period)) ||
      (row.date === "" && hasDailyMovementValues(row.values)) ||
      (row.date !== "" && duplicateDates.has(row.date)),
  );

  function updateField(field: CreateTextField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field === "name") {
      setNameError("");
    }
    setSubmitError("");
  }

  function updateDailyDate(rowId: number, date: string) {
    setDailyRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, date } : row)),
    );
    setSubmitError("");
  }

  function updateDailyField(
    rowId: number,
    field: StockMaterialDailyField,
    value: string,
  ) {
    setDailyRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? { ...row, values: { ...row.values, [field]: value } }
          : row,
      ),
    );
    setSubmitError("");
  }

  function addDailyRow() {
    if (disabled || dailyRows.length >= daysInMonth) {
      return;
    }
    const id = nextDailyRowId.current;
    nextDailyRowId.current += 1;
    setDailyRows((current) => [...current, blankDailyDraftRow(id)]);
    setSubmitError("");
  }

  function removeDailyRow(rowId: number) {
    setDailyRows((current) =>
      current.length === 1
        ? [blankDailyDraftRow(current[0].id)]
        : current.filter((row) => row.id !== rowId),
    );
    setSubmitError("");
  }

  function closeForm() {
    setValues(blankStockMaterialCreateInput());
    setDailyRows([blankDailyDraftRow(0)]);
    nextDailyRowId.current = 1;
    setNameError("");
    setSubmitError("");
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const name = values.name.trim();
    setNameError(name ? "" : "กรุณาระบุชื่อวัสดุ");
    if (
      !name ||
      invalidDailyFields.length > 0 ||
      invalidDailyDates.length > 0
    ) {
      const problems: string[] = [];
      if (!name) {
        problems.push("กรุณาระบุชื่อวัสดุ");
      }
      if (invalidDailyFields.length > 0) {
        problems.push(
          `พบตัวเลขรายวันผิดรูปแบบ ${invalidDailyFields.length} ช่อง`,
        );
      }
      if (
        invalidDailyDates.some(
          (row) => row.date !== "" && duplicateDates.has(row.date),
        )
      ) {
        problems.push("กรุณาเลือกวันที่ไม่ซ้ำกันในแต่ละรายการรับ-จ่าย");
      }
      if (invalidDailyDates.some((row) => row.date === "")) {
        problems.push("กรุณาเลือกวันที่สำหรับรายการรับ-จ่ายที่กรอกยอดแล้ว");
      }
      if (
        invalidDailyDates.some(
          (row) =>
            row.date !== "" && !isStockMaterialDateInPeriod(row.date, period),
        )
      ) {
        problems.push("กรุณาเลือกวันที่ภายในเดือนที่เลือก");
      }
      setSubmitError(problems.join(" · "));
      return;
    }

    const daily = dailyRows
      .filter((row) => row.date !== "")
      .map((row) => ({ date: row.date, values: { ...row.values } }));

    setSubmitError("");
    try {
      const accepted = onCreate({
        ...values,
        name,
        daily,
      });
      if (accepted === false) {
        setSubmitError("ไม่สามารถเพิ่มรายการได้ กรุณาตรวจสอบข้อมูลอีกครั้ง");
        return;
      }
      // Save of the month's draft is still handled by Workspace.
      closeForm();
    } catch {
      setSubmitError("ไม่สามารถเพิ่มรายการได้ กรุณาตรวจสอบข้อมูลอีกครั้ง");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) {
          closeForm();
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-4xl">
        <div className="min-w-0 shrink-0 space-y-1 border-b border-border bg-background px-4 py-4 pr-12 sm:px-6">
          <div className="flex items-center gap-2">
            <PackagePlus
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <DialogTitle className="text-lg font-semibold">
              เพิ่มรายการวัสดุ
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            เพิ่มวัสดุใหม่เฉพาะเดือน {periodLabel} โดยไม่กระทบข้อมูลเดือนอื่น
          </DialogDescription>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <section
              aria-labelledby={`${formId}-material-heading`}
              className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  1
                </span>
                <h3
                  id={`${formId}-material-heading`}
                  className="text-sm font-semibold text-foreground"
                >
                  ข้อมูลวัสดุ
                </h3>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={fieldId("category")}>ประเภทวัสดุ</Label>
                  <Input
                    id={fieldId("category")}
                    type="text"
                    autoComplete="off"
                    value={values.category}
                    onChange={(event) =>
                      updateField("category", event.currentTarget.value)
                    }
                    placeholder="ระบุประเภทวัสดุ (ถ้ามี)"
                    disabled={disabled}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor={fieldId("code")}>รหัสสินค้า</Label>
                  <Input
                    id={fieldId("code")}
                    type="text"
                    autoComplete="off"
                    value={values.code}
                    onChange={(event) =>
                      updateField("code", event.currentTarget.value)
                    }
                    placeholder="เว้นว่างได้"
                    disabled={disabled}
                  />
                </div>

                <div className="min-w-0 space-y-2 sm:col-span-2">
                  <Label htmlFor={fieldId("name")}>
                    ชื่อบรรจุภัณฑ์ / รายการวัสดุ
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id={fieldId("name")}
                    type="text"
                    autoComplete="off"
                    value={values.name}
                    onChange={(event) =>
                      updateField("name", event.currentTarget.value)
                    }
                    placeholder="ระบุชื่อวัสดุ"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? nameErrorId : undefined}
                    disabled={disabled}
                  />
                  {nameError && (
                    <p
                      id={nameErrorId}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {nameError}
                    </p>
                  )}
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor={fieldId("unit")}>หน่วยนับ</Label>
                  <Input
                    id={fieldId("unit")}
                    type="text"
                    autoComplete="off"
                    value={values.unit}
                    onChange={(event) =>
                      updateField("unit", event.currentTarget.value)
                    }
                    placeholder="เช่น ขวด / ใบ / แผ่น"
                    disabled={disabled}
                  />
                </div>

                <div className="min-w-0 space-y-2">
                  <Label htmlFor={fieldId("safety_stock")}>Safety-Stock</Label>
                  <Input
                    id={fieldId("safety_stock")}
                    type="text"
                    autoComplete="off"
                    value={values.safety_stock}
                    onChange={(event) =>
                      updateField("safety_stock", event.currentTarget.value)
                    }
                    placeholder="ตัวเลขหรือข้อความ (ถ้ามี)"
                    disabled={disabled}
                  />
                </div>

                <div className="min-w-0 space-y-2 sm:col-span-2">
                  <Label htmlFor={fieldId("remark")}>หมายเหตุ</Label>
                  <Textarea
                    id={fieldId("remark")}
                    value={values.remark}
                    onChange={(event) =>
                      updateField("remark", event.currentTarget.value)
                    }
                    placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                    rows={3}
                    disabled={disabled}
                    className="min-h-20 resize-y"
                  />
                </div>
              </div>
            </section>

            <section
              aria-labelledby={`${formId}-daily-heading`}
              className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                    >
                      2
                    </span>
                    <h3
                      id={`${formId}-daily-heading`}
                      className="text-sm font-semibold text-foreground"
                    >
                      รายละเอียดรับ-จ่ายรายวัน
                    </h3>
                  </div>
                  <p
                    id={dailyNumberHelpId}
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    เพิ่มได้หลายวันที่ในเดือนที่เลือก วันละหนึ่งรายการ
                    ยอดรายวันจะไม่คำนวณเปลี่ยนยอดสรุปรายเดือน
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDailyRow}
                  disabled={disabled || dailyRows.length >= daysInMonth}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มรายการรับ-จ่าย
                </Button>
              </div>

              <div className="space-y-4">
                {dailyRows.map((row, index) => {
                  const hasValues = hasDailyMovementValues(row.values);
                  const duplicate =
                    row.date !== "" && duplicateDates.has(row.date);
                  const badDate =
                    (row.date === "" && hasValues) ||
                    (row.date !== "" &&
                      !isStockMaterialDateInPeriod(row.date, period)) ||
                    duplicate;

                  return (
                    <div
                      key={row.id}
                      className="min-w-0 space-y-4 rounded-lg border border-border bg-muted/15 p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          รายการรับ-จ่ายที่ {index + 1}
                        </h4>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeDailyRow(row.id)}
                          disabled={disabled}
                          aria-label={`ล้างหรือลบรายการรับ-จ่ายที่ ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                          {dailyRows.length === 1 ? "ล้างข้อมูล" : "ลบรายการ"}
                        </Button>
                      </div>

                      <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[minmax(0,19rem)_1fr] sm:items-center">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor={dailyDateId(row.id)}>
                            วันที่ทำรายการ
                          </Label>
                          <Input
                            id={dailyDateId(row.id)}
                            type="date"
                            min={firstDate}
                            max={lastDate}
                            value={row.date}
                            onChange={(event) =>
                              updateDailyDate(row.id, event.currentTarget.value)
                            }
                            disabled={disabled}
                            aria-invalid={badDate}
                            aria-describedby={
                              badDate ? dailyDateErrorId(row.id) : undefined
                            }
                            className={
                              badDate ? "border-destructive" : undefined
                            }
                          />
                          {badDate && (
                            <p
                              id={dailyDateErrorId(row.id)}
                              role="alert"
                              className="text-xs text-destructive"
                            >
                              {duplicate
                                ? "มีวันที่นี้ในรายการอื่นแล้ว กรุณาเลือกวันที่ไม่ซ้ำ"
                                : row.date === ""
                                  ? "กรุณาเลือกวันที่สำหรับยอดที่กรอก"
                                  : "วันที่ไม่อยู่ในเดือนที่เลือก"}
                            </p>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {periodLabel} · {firstDate} ถึง {lastDate} ·
                          หากยังไม่มีรายการรับ-จ่าย สามารถเว้นช่องนี้ทั้งหมดได้
                        </p>
                      </div>

                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        {DAILY_GROUPS.map((group) => (
                          <div
                            key={group.label}
                            role="group"
                            aria-label={`${group.label} รายการที่ ${index + 1}`}
                            className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4"
                          >
                            <h5 className="text-sm font-semibold text-foreground">
                              {group.label}
                            </h5>
                            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                              {group.columns.map((column) => {
                                const value = row.values[column.field];
                                const invalid =
                                  !isValidStockMaterialNumber(value);

                                return (
                                  <div
                                    key={column.field}
                                    className="min-w-0 space-y-1.5"
                                  >
                                    <Label
                                      htmlFor={dailyFieldId(
                                        row.id,
                                        column.field,
                                      )}
                                    >
                                      {column.label}
                                    </Label>
                                    <Input
                                      id={dailyFieldId(row.id, column.field)}
                                      type="text"
                                      inputMode="decimal"
                                      autoComplete="off"
                                      value={value}
                                      onChange={(event) =>
                                        updateDailyField(
                                          row.id,
                                          column.field,
                                          event.currentTarget.value,
                                        )
                                      }
                                      placeholder="เว้นว่างได้"
                                      disabled={disabled}
                                      aria-invalid={invalid}
                                      aria-describedby={
                                        invalid
                                          ? `${dailyNumberHelpId} ${dailyFieldErrorId(row.id, column.field)}`
                                          : dailyNumberHelpId
                                      }
                                      className={
                                        invalid
                                          ? "border-destructive"
                                          : undefined
                                      }
                                    />
                                    {invalid && (
                                      <p
                                        id={dailyFieldErrorId(
                                          row.id,
                                          column.field,
                                        )}
                                        role="alert"
                                        className="text-xs text-destructive"
                                      >
                                        กรุณากรอกตัวเลขโดยไม่ใส่จุลภาค
                                        หรือปล่อยว่าง
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {dailyRows.length} รายการ · เพิ่มได้สูงสุด {daysInMonth}{" "}
                  วันในเดือนนี้
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDailyRow}
                  disabled={disabled || dailyRows.length >= daysInMonth}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มรายการรับ-จ่าย
                </Button>
              </div>
            </section>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-4 py-3 shadow-sm sm:px-6">
            {submitError && (
              <p
                role="alert"
                className="mb-2 text-xs leading-relaxed text-destructive"
              >
                {submitError}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-muted-foreground">
                บันทึกลงฉบับร่างก่อน ต้องกดบันทึกจากหน้าหลักอีกครั้ง
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={disabled}>
                  <PackagePlus className="size-4" aria-hidden="true" />
                  เพิ่มรายการวัสดุ
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
