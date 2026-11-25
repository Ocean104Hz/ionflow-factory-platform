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
  STOCK_RM_MOVEMENT_FIELDS,
  blankStockRmCreateInput,
  blankStockRmMovement,
  isStockRmDateInMonth,
  isValidStockRmNumber,
  type StockRmCreateInput,
  type StockRmMovementField,
  type StockRmMovementValues,
  type StockRmPeriod,
} from "./stock_rm_ff_domain";

/** UI mock: monthly draft only. Workspace owns Save and Discard. */
export interface StockRmFfCreateFormProps {
  open: boolean;
  period: StockRmPeriod;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: StockRmCreateInput) => void | boolean;
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

type DailyGroup = {
  label: string;
  columns: readonly { field: StockRmMovementField; label: string }[];
};

const DAILY_GROUPS: readonly DailyGroup[] = [
  {
    label: "รับเข้า (+)",
    columns: [
      { field: "received_weight", label: "น้ำหนัก" },
      { field: "received_value", label: "ราคา" },
    ],
  },
  {
    label: "จ่ายออก (-)",
    columns: [
      { field: "issued_for_production", label: "ใช้ผลิต" },
      { field: "issued_adjustment", label: "ปรับค่า" },
      { field: "issued_discarded", label: "ทิ้ง" },
    ],
  },
];

interface DailyDraftRow {
  id: number;
  date: string;
  values: StockRmMovementValues;
}

function blankDailyDraftRow(id: number): DailyDraftRow {
  return { id, date: "", values: blankStockRmMovement() };
}

function hasMovementValues(values: StockRmMovementValues): boolean {
  return STOCK_RM_MOVEMENT_FIELDS.some((field) => values[field].trim() !== "");
}

export function StockRmFfCreateForm({
  open,
  period,
  onOpenChange,
  onCreate,
  disabled = false,
}: StockRmFfCreateFormProps) {
  const formId = useId();
  const nextDailyRowId = useRef(1);
  const [values, setValues] = useState(blankStockRmCreateInput);
  const [dailyRows, setDailyRows] = useState<DailyDraftRow[]>(() => [
    blankDailyDraftRow(0),
  ]);
  const [codeError, setCodeError] = useState("");
  const [submitError, setSubmitError] = useState("");

  // Creation is supported only for monthly sheets, never annual snapshots.
  if (period.view !== "MONTH") {
    return null;
  }

  const periodLabel = `${MONTH_NAMES[period.month - 1]} พ.ศ. ${period.year_be}`;
  const calendarYear = period.year_be - 543;
  const monthPrefix = `${calendarYear}-${String(period.month).padStart(2, "0")}`;
  const daysInMonth = new Date(
    Date.UTC(calendarYear, period.month, 0),
  ).getUTCDate();
  const firstDate = `${monthPrefix}-01`;
  const lastDate = `${monthPrefix}-${String(daysInMonth).padStart(2, "0")}`;
  const codeId = `${formId}-code`;
  const codeErrorId = `${codeId}-error`;
  const remarkId = `${formId}-remark`;
  const dailyHelpId = `${formId}-daily-help`;
  const dailyDateId = (rowId: number) => `${formId}-daily-${rowId}-date`;
  const dailyFieldId = (rowId: number, field: StockRmMovementField) =>
    `${formId}-daily-${rowId}-${field}`;

  const seenDates = new Set<string>();
  const duplicateDates = new Set<string>();
  for (const row of dailyRows) {
    if (row.date !== "") {
      if (seenDates.has(row.date)) {
        duplicateDates.add(row.date);
      }
      seenDates.add(row.date);
    }
  }

  function getDateError(row: DailyDraftRow): string {
    if (row.date === "") {
      return hasMovementValues(row.values)
        ? "กรุณาเลือกวันที่สำหรับยอดที่กรอก"
        : "";
    }
    if (!isStockRmDateInMonth(row.date, period)) {
      return "วันที่ไม่อยู่ในเดือนที่เลือก";
    }
    if (duplicateDates.has(row.date)) {
      return "มีวันที่นี้ในรายการอื่นแล้ว กรุณาเลือกวันที่ไม่ซ้ำ";
    }
    return "";
  }

  function updateField(field: "code_new" | "remark", value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field === "code_new") {
      setCodeError("");
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
    field: StockRmMovementField,
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
    setDailyRows((current) =>
      current.length >= daysInMonth
        ? current
        : [...current, blankDailyDraftRow(id)],
    );
    setSubmitError("");
  }

  function removeDailyRow(rowId: number) {
    if (disabled) {
      return;
    }
    setDailyRows((current) =>
      current.length === 1
        ? [blankDailyDraftRow(current[0].id)]
        : current.filter((row) => row.id !== rowId),
    );
    setSubmitError("");
  }

  function closeForm() {
    setValues(blankStockRmCreateInput());
    setDailyRows([blankDailyDraftRow(0)]);
    nextDailyRowId.current = 1;
    setCodeError("");
    setSubmitError("");
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const codeNew = values.code_new.trim();
    setCodeError(codeNew ? "" : "กรุณาระบุรหัสวัตถุดิบ");
    const problems: string[] = [];
    if (!codeNew) {
      problems.push("กรุณาระบุรหัสวัตถุดิบ");
    }
    const dateErrors = dailyRows.map(getDateError).filter(Boolean);
    problems.push(...new Set(dateErrors));
    const invalidNumberCount = dailyRows.reduce(
      (count, row) =>
        count +
        STOCK_RM_MOVEMENT_FIELDS.filter(
          (field) => !isValidStockRmNumber(row.values[field]),
        ).length,
      0,
    );
    if (invalidNumberCount > 0) {
      problems.push(`พบตัวเลขรายวันผิดรูปแบบ ${invalidNumberCount} ช่อง`);
    }
    if (problems.length > 0) {
      setSubmitError(problems.join(" · "));
      return;
    }

    const daily = dailyRows
      .filter((row) => row.date !== "")
      .map((row) => ({ date: row.date, values: { ...row.values } }));

    setSubmitError("");
    try {
      const accepted = onCreate({
        code_new: codeNew,
        remark: values.remark,
        daily,
      });
      if (accepted === false) {
        setSubmitError("ไม่สามารถเพิ่มวัตถุดิบได้ กรุณาตรวจสอบข้อมูลอีกครั้ง");
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message ===
          "The RM item code already exists in the selected month."
          ? "รหัสวัตถุดิบนี้มีอยู่แล้วในเดือนที่เลือก"
          : "ไม่สามารถเพิ่มวัตถุดิบได้ กรุณาตรวจสอบข้อมูลอีกครั้ง";
      setSubmitError(message);
      return;
    }
    // The new row is now in the monthly draft, not permanently saved.
    closeForm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (nextOpen) {
          onOpenChange(true);
        } else {
          closeForm();
        }
      }}
    >
      <DialogContent className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden bg-white p-0 sm:w-[calc(100vw-2rem)] sm:max-w-4xl dark:bg-background">
        <div className="min-w-0 shrink-0 space-y-1 border-b border-border bg-white px-4 py-4 pr-12 sm:px-6 dark:bg-background">
          <div className="flex items-center gap-2">
            <PackagePlus
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <DialogTitle className="text-lg font-semibold">
              เพิ่มรายการวัตถุดิบ
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            เพิ่มวัตถุดิบใหม่เฉพาะเดือน {periodLabel} โดยไม่กระทบข้อมูลเดือนอื่น
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
                  ข้อมูลวัตถุดิบ
                </h3>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={codeId}>
                    รหัสวัตถุดิบ (New)
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id={codeId}
                    type="text"
                    autoComplete="off"
                    value={values.code_new}
                    onChange={(event) =>
                      updateField("code_new", event.currentTarget.value)
                    }
                    placeholder="ระบุรหัสวัตถุดิบ"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(codeError)}
                    aria-describedby={codeError ? codeErrorId : undefined}
                    disabled={disabled}
                  />
                  {codeError && (
                    <p
                      id={codeErrorId}
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {codeError}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    ระบบกำหนดลำดับรายการให้อัตโนมัติเมื่อเพิ่มวัตถุดิบ
                  </p>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={remarkId}>หมายเหตุ (ถ้ามี)</Label>
                  <Textarea
                    id={remarkId}
                    value={values.remark}
                    onChange={(event) =>
                      updateField("remark", event.currentTarget.value)
                    }
                    placeholder="ระบุหมายเหตุ"
                    rows={2}
                    disabled={disabled}
                    className="min-h-16 resize-y"
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
                    id={dailyHelpId}
                    className="text-xs leading-relaxed text-muted-foreground"
                  >
                    กรอกวันละหนึ่งรายการในเดือนที่เลือก หรือเว้นว่างได้
                    ยอดรายวันไม่เปลี่ยนยอดสรุปรายเดือน
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
                  const dateId = dailyDateId(row.id);
                  const dateError = getDateError(row);
                  const dateErrorId = `${dateId}-error`;
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
                          <Label htmlFor={dateId}>วันที่ทำรายการ</Label>
                          <Input
                            id={dateId}
                            type="date"
                            min={firstDate}
                            max={lastDate}
                            value={row.date}
                            onChange={(event) =>
                              updateDailyDate(row.id, event.currentTarget.value)
                            }
                            disabled={disabled}
                            aria-invalid={Boolean(dateError)}
                            aria-describedby={
                              dateError ? dateErrorId : undefined
                            }
                            className={
                              dateError ? "border-destructive" : undefined
                            }
                          />
                          {dateError && (
                            <p
                              id={dateErrorId}
                              role="alert"
                              className="text-xs text-destructive"
                            >
                              {dateError}
                            </p>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {periodLabel} · {firstDate} ถึง {lastDate} ·
                          หากยังไม่มีรายการรับ-จ่าย สามารถเว้นส่วนนี้ทั้งหมดได้
                        </p>
                      </div>

                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        {DAILY_GROUPS.map((group) => (
                          <fieldset
                            key={group.label}
                            className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4"
                          >
                            <legend className="sr-only">
                              {group.label} รายการที่ {index + 1}
                            </legend>
                            <h5
                              aria-hidden="true"
                              className="text-sm font-semibold text-foreground"
                            >
                              {group.label}
                            </h5>
                            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                              {group.columns.map(({ field, label }) => {
                                const value = row.values[field];
                                const invalid = !isValidStockRmNumber(value);
                                const inputId = dailyFieldId(row.id, field);
                                const errorId = `${inputId}-error`;
                                return (
                                  <div
                                    key={field}
                                    className="min-w-0 space-y-1.5"
                                  >
                                    <Label htmlFor={inputId}>{label}</Label>
                                    <Input
                                      id={inputId}
                                      type="text"
                                      inputMode="decimal"
                                      autoComplete="off"
                                      value={value}
                                      onChange={(event) =>
                                        updateDailyField(
                                          row.id,
                                          field,
                                          event.currentTarget.value,
                                        )
                                      }
                                      placeholder="เว้นว่างได้"
                                      disabled={disabled}
                                      aria-invalid={invalid}
                                      aria-describedby={
                                        invalid
                                          ? `${dailyHelpId} ${errorId}`
                                          : dailyHelpId
                                      }
                                      className={
                                        invalid
                                          ? "border-destructive"
                                          : undefined
                                      }
                                    />
                                    {invalid && (
                                      <p
                                        id={errorId}
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
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="border-t border-border pt-3 text-right text-xs text-muted-foreground">
                {dailyRows.length}/{daysInMonth} รายการ
              </p>
            </section>
          </div>

          <div className="shrink-0 border-t border-border bg-white px-4 py-3 shadow-sm sm:px-6 dark:bg-background">
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
                เพิ่มลงฉบับร่างก่อน กดบันทึกที่หน้าหลักอีกครั้ง
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={disabled}>
                  <PackagePlus className="size-4" aria-hidden="true" />
                  เพิ่มรายการวัตถุดิบ
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
