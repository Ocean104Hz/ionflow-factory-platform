"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";

import {
  CUSTOMER_MATERIALS_DAILY_FIELDS,
  CUSTOMER_MATERIALS_DAILY_LABELS,
  CUSTOMER_MATERIALS_PERIODS,
  customerMaterialsDaysInPeriod,
  getCustomerMaterialsDailyEntry,
  upsertCustomerMaterialsDailyEntry,
  validateCustomerMaterialsDailyEntry,
  type CustomerMaterialsDailyEntry,
  type CustomerMaterialsDailyField,
  type CustomerMaterialsFormErrors,
  type CustomerMaterialsRow,
} from "./stock_customer_materials_domain";

/* ---------------- types ---------------- */

interface CustomerMaterialsDailyFormProps {
  row: CustomerMaterialsRow;
  initialDay?: number;
  onSave: (row: CustomerMaterialsRow) => void;
  onCancel: () => void;
}

/* ---------------- helpers ---------------- */

function copyDailyEntry(
  row: CustomerMaterialsRow,
  day: number,
): CustomerMaterialsDailyEntry {
  const entry = getCustomerMaterialsDailyEntry(row, day);
  return { ...entry, values: { ...entry.values } };
}

/* ---------------- component ---------------- */

/** Mount a new form for each material being edited. */
export function CustomerMaterialsDailyForm({
  row,
  initialDay,
  onSave,
  onCancel,
}: CustomerMaterialsDailyFormProps) {
  const formId = useId();
  const period = CUSTOMER_MATERIALS_PERIODS[row.sheet_name];
  const days = customerMaterialsDaysInPeriod(row.sheet_name);
  const isCarryover = period.month === null;

  const [draft, setDraft] = useState<CustomerMaterialsDailyEntry | null>(() => {
    const day = initialDay ?? days[0];
    // Do not silently redirect an invalid source-day selection to another day.
    return day !== undefined && days.includes(day)
      ? copyDailyEntry(row, day)
      : null;
  });
  const [errors, setErrors] = useState<CustomerMaterialsFormErrors>({});
  const [pendingDay, setPendingDay] = useState<number | null>(null);

  const existingEntry = draft
    ? row.daily.find((entry) => entry.day === draft.day)
    : undefined;
  const originalEntry = draft
    ? getCustomerMaterialsDailyEntry(row, draft.day)
    : null;
  const isDirty =
    draft !== null &&
    originalEntry !== null &&
    CUSTOMER_MATERIALS_DAILY_FIELDS.some(
      (field) => draft.values[field] !== originalEntry.values[field],
    );

  function dayLabel(day: number): string {
    return isCarryover
      ? `ช่องวันที่ ${day} (ตาม Excel)`
      : `วันที่ ${day} ${period.label}`;
  }

  /* ---------------- select day ---------------- */

  function loadDay(day: number) {
    if (!days.includes(day)) {
      return;
    }

    setDraft(copyDailyEntry(row, day));
    setErrors({});
    setPendingDay(null);
  }

  function handleDayChange(value: string) {
    const day = Number(value);
    if (!days.includes(day) || day === draft?.day) {
      return;
    }

    if (isDirty) {
      setPendingDay(day);
      return;
    }

    loadDay(day);
  }

  /* ---------------- update value ---------------- */

  function updateValue(field: CustomerMaterialsDailyField, value: string) {
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            values: { ...previous.values, [field]: value },
          }
        : previous,
    );

    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      delete next.form;
      return next;
    });
  }

  /* ---------------- submit ---------------- */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pendingDay !== null) {
      return;
    }
    if (!draft) {
      setErrors({ day: "กรุณาเลือกวันที่รับ-จ่ายวัสดุ" });
      return;
    }

    const nextErrors = validateCustomerMaterialsDailyEntry(row.sheet_name, draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    let nextRow: CustomerMaterialsRow;
    try {
      nextRow = upsertCustomerMaterialsDailyEntry(row, draft);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "ไม่สามารถจัดเตรียมข้อมูลรับ-จ่ายได้",
      });
      return;
    }

    onSave(nextRow);
  }

  /* ---------------- render ---------------- */

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <div className="space-y-1 pr-6">
          <DialogTitle>บันทึกรับ-จ่ายวัสดุรายวัน</DialogTitle>
          <DialogDescription>
            เพิ่มหรือแก้ไขการรับ-จ่ายวัสดุของลูกค้าตามวันที่เลือกลงฉบับร่าง
          </DialogDescription>
        </div>

        <form noValidate className="min-w-0 space-y-5" onSubmit={handleSubmit}>
          <section className="space-y-3 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold">ข้อมูลวัสดุ</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "งวดข้อมูล", value: `${period.label} (${row.sheet_name})` },
                { label: "ฝ่ายขาย / ลูกค้า", value: row.item.sales_customer },
                { label: "ประเภทวัสดุ", value: row.item.material_type },
                { label: "รหัสสินค้า", value: row.item.code },
                { label: "No.", value: row.item.no },
                { label: "หน่วยนับ", value: row.item.unit },
                { label: "รายละเอียด", value: row.item.description, wide: true },
              ].map((field) => (
                <div
                  key={field.label}
                  className={field.wide ? "min-w-0 sm:col-span-2" : "min-w-0"}
                >
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="mt-1 wrap-break-word text-sm font-medium">
                    {field.value || "-"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-day`}>
                {isCarryover ? "ช่องวันที่ตาม Excel *" : "วันที่รับ-จ่ายวัสดุ *"}
              </Label>
              <select
                id={`${formId}-day`}
                name="day"
                required
                value={draft ? String(draft.day) : ""}
                disabled={pendingDay !== null}
                aria-invalid={Boolean(errors.day)}
                aria-describedby={errors.day ? `${formId}-day-error` : undefined}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(event) => handleDayChange(event.currentTarget.value)}
              >
                <option value="" disabled>เลือกวันที่</option>
                {days.map((day) => (
                  <option key={day} value={String(day)}>
                    {dayLabel(day)}
                    {row.daily.some((entry) => entry.day === day)
                      ? " · มีข้อมูลแล้ว"
                      : ""}
                  </option>
                ))}
              </select>
              {errors.day && (
                <p id={`${formId}-day-error`} role="alert" className="text-xs text-destructive">
                  {errors.day}
                </p>
              )}
            </div>

            {isCarryover && (
              <p className="text-xs text-muted-foreground">
                ชีตยอดยกมา 2568 ใช้ช่องวันที่ 1–31 ตามต้นฉบับ Excel
                โดยไม่กำหนดเดือนหรือวันที่ปฏิทินเพิ่มเติม
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {!draft
                ? "วันที่เดิมไม่อยู่ในงวดที่แก้ไขได้ กรุณาเลือกวันที่ที่ถูกต้อง โดยข้อมูลเดิมจะไม่ถูกเปลี่ยน"
                : existingEntry
                  ? "วันที่เลือกมีข้อมูลอยู่แล้ว สามารถแก้ไขข้อมูลเดิมได้"
                  : "วันที่เลือกยังไม่มีข้อมูลรับ-จ่าย"}
            </p>

            {pendingDay !== null && (
              <div role="alert" className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">มีข้อมูลที่ยังไม่ได้บันทึกลงฉบับร่าง</p>
                <p className="text-xs text-muted-foreground">
                  หากเปลี่ยนเป็น{dayLabel(pendingDay)}
                  ข้อมูลที่กำลังแก้ไขของวันที่เดิมจะไม่ถูกเก็บลงฉบับร่าง
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setPendingDay(null)}>
                    แก้ไขต่อ
                  </Button>
                  <Button type="button" size="sm" onClick={() => loadDay(pendingDay)}>
                    เปลี่ยนวันที่
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">รายการรับ-จ่ายวัสดุ</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ระบุจำนวนตามประเภทการรับ-จ่ายของวันที่เลือก
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {CUSTOMER_MATERIALS_DAILY_FIELDS.map((field) => {
                const inputId = `${formId}-${field}`;
                const error = errors[field];
                return (
                  <div key={field} className="grid min-w-0 gap-2">
                    <Label htmlFor={inputId}>{CUSTOMER_MATERIALS_DAILY_LABELS[field]}</Label>
                    <div className="relative">
                      <Input
                        id={inputId}
                        name={field}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft?.values[field] ?? ""}
                        placeholder="ระบุจำนวน"
                        disabled={!draft || pendingDay !== null}
                        className="pr-20 text-right tabular-nums"
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${inputId}-error` : undefined}
                        onChange={(event) => updateValue(field, event.currentTarget.value)}
                      />
                      <span
                        title={row.item.unit || "หน่วย"}
                        className="pointer-events-none absolute top-1/2 right-3 max-w-16 -translate-y-1/2 truncate text-xs text-muted-foreground"
                      >
                        {row.item.unit || "หน่วย"}
                      </span>
                    </div>
                    {error && (
                      <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p>ช่องว่างและจำนวน 0 มีความหมายแตกต่างกัน</p>
            <p>หากล้างข้อมูลทั้ง 4 ช่องแล้วบันทึกลงฉบับร่าง จะนำเฉพาะรายการรับ-จ่ายของวันที่เลือกออกจากฉบับร่าง</p>
            <p>ไม่คำนวณยอดสรุป คงเหลือ ผลต่าง หรือยกยอดข้ามเดือนอัตโนมัติ</p>
            <p>การแก้ไขจะอยู่ในฉบับร่าง กรุณากดบันทึกข้อมูลจากหน้าหลักเพื่อจัดเก็บลงฐานข้อมูล</p>
          </div>

          {errors.form && (
            <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
              {errors.form}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={!draft || pendingDay !== null}>
              บันทึกลงฉบับร่าง
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
