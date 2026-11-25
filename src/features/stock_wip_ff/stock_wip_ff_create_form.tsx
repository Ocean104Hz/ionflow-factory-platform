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

import {
  STOCK_WIP_MOVEMENT_FIELDS,
  blankStockWipCreateInput,
  blankStockWipMovement,
  isStockWipDateInMonth,
  isValidStockWipQuantity,
  stockWipPeriodKey,
  stockWipSupportsBioTransfer,
  type StockWipCreateInput,
  type StockWipMovementField,
  type StockWipMovementValues,
  type StockWipPeriod,
} from "./stock_wip_ff_domain";

/** Monthly draft only. Workspace owns database Save and Discard. */
export interface StockWipFfCreateFormProps {
  open: boolean;
  period: StockWipPeriod;
  onOpenChange: (open: boolean) => void;
  /** Return false to keep the form open when the Workspace cannot accept edits. */
  onCreate: (input: StockWipCreateInput) => void | boolean;
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
  columns: readonly { field: StockWipMovementField; label: string }[];
};

const DAILY_GROUPS: readonly DailyGroup[] = [
  {
    label: "รับเข้า (+)",
    columns: [{ field: "received", label: "รับเข้า" }],
  },
  {
    label: "จ่ายออก (-)",
    columns: [
      { field: "used_for_production", label: "ใช้ผลิต" },
      { field: "used_for_packaging", label: "ใช้บรรจุ" },
      { field: "other_issues", label: "จ่ายอื่น ๆ" },
    ],
  },
  {
    label: "โอน",
    columns: [
      { field: "transfer_kan_1", label: "KAN 1" },
      { field: "transfer_kan_3", label: "KAN 3" },
      { field: "transfer_ico", label: "ICO" },
      { field: "transfer_bio", label: "BIO" },
    ],
  },
];

interface DailyDraftRow {
  id: number;
  date: string;
  values: StockWipMovementValues;
}

function blankDailyDraftRow(
  id: number,
  supportsBioTransfer: boolean,
): DailyDraftRow {
  return { id, date: "", values: blankStockWipMovement(supportsBioTransfer) };
}

function hasMovementValues(values: StockWipMovementValues): boolean {
  return STOCK_WIP_MOVEMENT_FIELDS.some((field) => {
    const value = values[field];
    return value !== null && value.trim() !== "";
  });
}

type MonthlyCreateFormProps = Omit<StockWipFfCreateFormProps, "period"> & {
  period: Extract<StockWipPeriod, { view: "MONTH" }>;
};

export function StockWipFfCreateForm(props: StockWipFfCreateFormProps) {
  if (props.period.view !== "MONTH") {
    return null;
  }

  return (
    <StockWipMonthlyCreateForm
      {...props}
      key={stockWipPeriodKey(props.period)}
      period={props.period}
    />
  );
}

function StockWipMonthlyCreateForm({
  open,
  period,
  onOpenChange,
  onCreate,
  disabled = false,
}: MonthlyCreateFormProps) {
  const formId = useId();
  const supportsBioTransfer = stockWipSupportsBioTransfer(period);
  const nextDailyRowId = useRef(1);
  const [values, setValues] = useState(blankStockWipCreateInput);
  const [dailyRows, setDailyRows] = useState<DailyDraftRow[]>(() => [
    blankDailyDraftRow(0, supportsBioTransfer),
  ]);
  const [codeError, setCodeError] = useState("");
  const [nameError, setNameError] = useState("");
  const [submitError, setSubmitError] = useState("");

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
  const oldCodeId = `${formId}-old-code`;
  const nameId = `${formId}-name`;
  const nameErrorId = `${nameId}-error`;
  const dailyHelpId = `${formId}-daily-help`;
  const dailyDateId = (rowId: number) => `${formId}-daily-${rowId}-date`;
  const dailyFieldId = (rowId: number, field: StockWipMovementField) =>
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
    if (!isStockWipDateInMonth(row.date, period)) {
      return "วันที่ไม่อยู่ในเดือนที่เลือก";
    }
    if (duplicateDates.has(row.date)) {
      return "มีวันที่นี้ในรายการอื่นแล้ว กรุณาเลือกวันที่ไม่ซ้ำ";
    }
    return "";
  }

  function updateField(field: "code_new" | "code_old" | "name", value: string) {
    if (disabled) {
      return;
    }
    setValues((current) => ({ ...current, [field]: value }));
    if (field === "code_new") {
      setCodeError("");
    }
    if (field === "name") {
      setNameError("");
    }
    setSubmitError("");
  }

  function updateDailyDate(rowId: number, date: string) {
    if (disabled) {
      return;
    }
    setDailyRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, date } : row)),
    );
    setSubmitError("");
  }

  function updateDailyField(
    rowId: number,
    field: StockWipMovementField,
    value: string,
  ) {
    if (disabled || (field === "transfer_bio" && !supportsBioTransfer)) {
      return;
    }
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
        : [...current, blankDailyDraftRow(id, supportsBioTransfer)],
    );
    setSubmitError("");
  }

  function removeDailyRow(rowId: number) {
    if (disabled) {
      return;
    }
    setDailyRows((current) =>
      current.length === 1
        ? [blankDailyDraftRow(current[0].id, supportsBioTransfer)]
        : current.filter((row) => row.id !== rowId),
    );
    setSubmitError("");
  }

  function closeForm() {
    setValues(blankStockWipCreateInput());
    setDailyRows([blankDailyDraftRow(0, supportsBioTransfer)]);
    nextDailyRowId.current = 1;
    setCodeError("");
    setNameError("");
    setSubmitError("");
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const codeNew = values.code_new.trim();
    const name = values.name.trim();
    const problems: string[] = [];
    const missingCode = codeNew ? "" : "กรุณาระบุรหัสใหม่";
    const missingName = name ? "" : "กรุณาระบุชื่อสินค้า";
    setCodeError(missingCode);
    setNameError(missingName);
    problems.push(...[missingCode, missingName].filter(Boolean));
    const dateErrors = dailyRows.map(getDateError).filter(Boolean);
    problems.push(...new Set(dateErrors));
    const invalidNumberCount = dailyRows.reduce(
      (count, row) =>
        count +
        STOCK_WIP_MOVEMENT_FIELDS.filter((field) => {
          const value = row.values[field];
          if (field === "transfer_bio" && !supportsBioTransfer) {
            return value !== null;
          }
          return value === null || !isValidStockWipQuantity(value);
        }).length,
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
        code_old: values.code_old.trim(),
        name,
        daily,
      });
      if (accepted === false) {
        setSubmitError(
          "ยังไม่สามารถเพิ่มลงฉบับร่างได้ กรุณาตรวจสอบสถานะการโหลดข้อมูลหรือการบันทึกจากหน้าหลัก",
        );
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message ===
          "The WIP item code already exists in the selected month."
          ? "รหัสใหม่นี้มีอยู่แล้วหรืออยู่ระหว่างรอลบในเดือนที่เลือก กรุณาตรวจสอบรายการในหน้าหลัก"
          : "ไม่สามารถเพิ่มรายการ WIP ได้ กรุณาตรวจสอบข้อมูลอีกครั้ง";
      setSubmitError(message);
      return;
    }
    // The Workspace accepted the row into its draft. No API write has occurred.
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
      <DialogContent className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-w-4xl">
        <div className="min-w-0 shrink-0 space-y-1 border-b border-border bg-background px-4 py-4 pr-12 sm:px-6">
          <div className="flex items-center gap-2">
            <PackagePlus
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <DialogTitle className="text-lg font-semibold">
              เพิ่มรายการ WIP
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed">
            เพิ่มรายการ WIP ใหม่เฉพาะเดือน {periodLabel}{" "}
            ลงฉบับร่างโดยไม่กระทบข้อมูลเดือนอื่น
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
                  ข้อมูลสินค้า WIP
                </h3>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={codeId}>
                    รหัสใหม่ (New)
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
                    placeholder="ระบุรหัสใหม่"
                    required
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
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={oldCodeId}>รหัสเก่า (Old)</Label>
                  <Input
                    id={oldCodeId}
                    type="text"
                    autoComplete="off"
                    value={values.code_old}
                    onChange={(event) =>
                      updateField("code_old", event.currentTarget.value)
                    }
                    placeholder="ระบุรหัสเก่า (ถ้ามี)"
                    disabled={disabled}
                  />
                </div>
                <div className="min-w-0 space-y-2 sm:col-span-2">
                  <Label htmlFor={nameId}>
                    ชื่อสินค้า
                    <span className="ml-1 text-destructive" aria-hidden="true">
                      *
                    </span>
                  </Label>
                  <Input
                    id={nameId}
                    type="text"
                    autoComplete="off"
                    value={values.name}
                    onChange={(event) =>
                      updateField("name", event.currentTarget.value)
                    }
                    placeholder="ระบุชื่อสินค้า WIP"
                    required
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
              </div>
              <p className="text-xs text-muted-foreground">
                ระบบกำหนดลำดับให้อัตโนมัติเมื่อเพิ่มรายการ
              </p>
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
                    เพิ่มได้หลายวันที่ในเดือนที่เลือก วันละหนึ่งรายการ
                    ยอดรายวันจะไม่คำนวณเปลี่ยนยอดสรุปรายเดือน
                  </p>
                  {!supportsBioTransfer && (
                    <p className="text-xs text-muted-foreground">
                      เดือนนี้ไม่มีช่องโอน BIO ตาม Excel ต้นฉบับ
                    </p>
                  )}
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
                          <div
                            key={group.label}
                            role="group"
                            aria-label={`${group.label} รายการที่ ${index + 1}`}
                            className={`min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4 ${group.label === "โอน" ? "md:col-span-2" : ""}`}
                          >
                            <h5 className="text-sm font-semibold text-foreground">
                              {group.label}
                            </h5>
                            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                              {group.columns
                                .filter(
                                  ({ field }) =>
                                    field !== "transfer_bio" ||
                                    supportsBioTransfer,
                                )
                                .map(({ field, label }) => {
                                  const value = row.values[field] ?? "";
                                  const invalid =
                                    !isValidStockWipQuantity(value);
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
                                          กรุณากรอกจำนวนตั้งแต่ 0 ขึ้นไป
                                          โดยไม่ใส่จุลภาค หรือปล่อยว่าง
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
                เพิ่มลงฉบับร่างก่อน ต้องกดบันทึกข้อมูลจากหน้าหลักอีกครั้ง
                จึงจะจัดเก็บลงฐานข้อมูล
              </p>
              <div className="flex shrink-0 justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeForm}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={disabled}>
                  <PackagePlus className="size-4" aria-hidden="true" />
                  เพิ่มลงฉบับร่าง
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
