
"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SelectField } from "@/src/components/factory/patterns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";

import {
  blankStockProductsDailyEntry,
  datesInStockProductsMonth,
  upsertStockProductsDailyEntry,
  type StockProductsDailyEntry,
  type StockProductsDailyField,
  type StockProductsMonth,
  type StockProductsStockRow,
  type StockProductsFormErrors,
} from "./stock_products_domain";

/* ---------------- types ---------------- */

interface StockProductsDailyFormProps {
  row: StockProductsStockRow;
  period: StockProductsMonth;
  initialDate?: string;
  onSave: (row: StockProductsStockRow) => void;
  onCancel: () => void;
}

/* ---------------- constants ---------------- */

const DAILY_FIELDS = [
  {
    key: "received_in",
    label: "รับเข้าจากการผลิต",
  },
  {
    key: "received_return",
    label: "รับคืนสินค้า",
  },
  {
    key: "issued_customer",
    label: "จ่ายสินค้าให้ลูกค้า",
  },
  {
    key: "issued_promotion",
    label: "ส่งเสริมการขาย",
  },
  {
    key: "issued_office_sample",
    label: "ใช้สำนักงาน / ตัวอย่าง",
  },
  {
    key: "issued_other",
    label: "จ่ายอื่น ๆ",
  },
  {
    key: "damaged",
    label: "สินค้าชำรุด",
  },
] as const satisfies readonly {
  key: StockProductsDailyField;
  label: string;
}[];

/* ---------------- helpers ---------------- */

function formatDailyDate(date: string): string {
  const parsedDate = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getDailyEntry(
  row: StockProductsStockRow,
  date: string,
): StockProductsDailyEntry {
  const existing = row.daily.find(
    (entry) => entry.date === date,
  );

  if (existing) {
    return {
      ...existing,
      values: {
        ...existing.values,
      },
    };
  }

  return blankStockProductsDailyEntry(date);
}

/* ---------------- component ---------------- */

export function StockProductsDailyForm({
  row,
  period,
  initialDate,
  onSave,
  onCancel,
}: StockProductsDailyFormProps) {
  const formId = useId();

  const dates = datesInStockProductsMonth(period);

  const [draft, setDraft] =
    useState<StockProductsDailyEntry>(() => {
      const date =
        initialDate && dates.includes(initialDate)
          ? initialDate
          : dates[0] ?? "";

      return getDailyEntry(row, date);
    });

  const [errors, setErrors] =
    useState<StockProductsFormErrors>({});

  const [pendingDate, setPendingDate] =
    useState<string | null>(null);

  const existingEntry = row.daily.find(
    (entry) => entry.date === draft.date,
  );

  const originalEntry = getDailyEntry(
    row,
    draft.date,
  );

  const isDirty = DAILY_FIELDS.some(
    ({ key }) =>
      originalEntry.values[key] !== draft.values[key],
  );

  const dateOptions = dates.map((date) => {
    const hasEntry = row.daily.some(
      (entry) => entry.date === date,
    );

    return {
      value: date,
      label: `${formatDailyDate(date)}${
        hasEntry ? " · มีข้อมูลแล้ว" : ""
      }`,
    };
  });

  /* ---------------- select date ---------------- */

  function loadDate(date: string) {
    setDraft(getDailyEntry(row, date));
    setErrors({});
    setPendingDate(null);
  }

  function handleDateChange(date: string) {
    if (
      !dates.includes(date) ||
      date === draft.date
    ) {
      return;
    }

    if (isDirty) {
      setPendingDate(date);
      return;
    }

    loadDate(date);
  }

  /* ---------------- update value ---------------- */

  function updateValue(
    key: StockProductsDailyField,
    value: string,
  ) {
    setDraft((previous) => ({
      ...previous,
      values: {
        ...previous.values,
        [key]: value,
      },
    }));

    setErrors((previous) => {
      const next = { ...previous };

      delete next[key];
      delete next.form;

      return next;
    });
  }

  /* ---------------- validation ---------------- */

  function validateEntry(
    entry: StockProductsDailyEntry,
  ): StockProductsFormErrors {
    const nextErrors: StockProductsFormErrors = {};

    if (!dates.includes(entry.date)) {
      nextErrors.date =
        "กรุณาเลือกวันที่ภายในเดือนของเอกสาร";
    }

    for (const { key } of DAILY_FIELDS) {
      const value = entry.values[key].trim();

      if (
        value !== "" &&
        !Number.isFinite(Number(value))
      ) {
        nextErrors[key] =
          "กรุณาระบุจำนวนเป็นตัวเลข";
      }
    }

    return nextErrors;
  }

  /* ---------------- submit ---------------- */

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (pendingDate !== null) {
      return;
    }

    const nextErrors = validateEntry(draft);

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    let nextRow: StockProductsStockRow;

    try {
      nextRow = upsertStockProductsDailyEntry(
        row,
        draft,
        period,
      );
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "ไม่สามารถจัดเตรียมข้อมูลได้",
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
      <DialogContent
        className="
          max-h-[calc(100dvh-2rem)]
          w-[calc(100vw-2rem)]
          max-w-none
          overflow-y-auto
          sm:max-w-2xl
          lg:max-w-3xl
        "
      >
        {/* Header */}

        <div className="space-y-1 pr-6">
          <DialogTitle>
            บันทึกรับ-จ่ายสินค้ารายวัน
          </DialogTitle>

          <DialogDescription>
            เพิ่มหรือแก้ไขข้อมูลการเคลื่อนไหว
            ของสินค้าตามวันที่เลือก
          </DialogDescription>
        </div>

        <form
          noValidate
          className="min-w-0 space-y-5"
          onSubmit={handleSubmit}
        >
          {/* Product information */}

          <section className="space-y-3 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex items-center gap-2">
              <CalendarDays
                className="size-4 text-primary"
                aria-hidden="true"
              />

              <h3 className="text-sm font-semibold">
                ข้อมูลสินค้า
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  รหัสสินค้า
                </p>

                <p className="mt-1 text-sm font-medium">
                  {row.item.code || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  ประเภทสินค้า
                </p>

                <p className="mt-1 text-sm font-medium">
                  {row.item.group || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  ชื่อสินค้า
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {row.item.name}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">
                  หน่วย
                </p>

                <p className="mt-1 text-sm font-medium">
                  {row.item.unit || "-"}
                </p>
              </div>
            </div>
          </section>

          {/* Select date */}

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <SelectField
              label="วันที่รับ-จ่ายสินค้า *"
              value={draft.date}
              options={dateOptions}
              onChange={handleDateChange}
            />

            {errors.date && (
              <p
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.date}
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              {existingEntry
                ? "วันที่เลือกมีข้อมูลอยู่แล้ว สามารถแก้ไขข้อมูลเดิมได้"
                : "วันที่เลือกยังไม่มีข้อมูลรับ-จ่าย"}
            </p>

            {pendingDate !== null && (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
              >
                <p className="text-sm font-medium">
                  มีข้อมูลที่ยังไม่ได้บันทึก
                </p>

                <p className="text-xs text-muted-foreground">
                  หากเปลี่ยนวันที่
                  ข้อมูลที่กำลังแก้ไขจะไม่ถูกบันทึก
                </p>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPendingDate(null)
                    }
                  >
                    แก้ไขต่อ
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      loadDate(pendingDate)
                    }
                  >
                    เปลี่ยนวันที่
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Daily values */}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">
                รายการรับ-จ่ายสินค้า
              </h3>

              <p className="mt-1 text-xs text-muted-foreground">
                ระบุจำนวนตามประเภทการเคลื่อนไหว
                ของสินค้า
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {DAILY_FIELDS.map((field) => {
                const inputId =
                  `${formId}-${field.key}`;

                const error = errors[field.key];

                return (
                  <div
                    key={field.key}
                    className="grid min-w-0 gap-2"
                  >
                    <Label htmlFor={inputId}>
                      {field.label}
                    </Label>

                    <div className="relative">
                      <Input
                        id={inputId}
                        name={field.key}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft.values[field.key]}
                        placeholder="ระบุจำนวน"
                        className="pr-20 text-right tabular-nums"
                        aria-invalid={Boolean(error)}
                        aria-describedby={
                          error
                            ? `${inputId}-error`
                            : undefined
                        }
                        onChange={(event) =>
                          updateValue(
                            field.key,
                            event.currentTarget.value,
                          )
                        }
                      />

                      <span className="pointer-events-none absolute top-1/2 right-3 max-w-16 -translate-y-1/2 truncate text-xs text-muted-foreground">
                        {row.item.unit || "หน่วย"}
                      </span>
                    </div>

                    {error && (
                      <p
                        id={`${inputId}-error`}
                        role="alert"
                        className="text-xs text-destructive"
                      >
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Information */}

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              ช่องว่างและจำนวน 0 มีความหมายแตกต่างกัน
            </p>

            <p>
              หากล้างข้อมูลทั้ง 7 ช่องแล้วบันทึก
              รายการรับ-จ่ายของวันที่เลือกจะถูกนำออก
            </p>

            <p>
              การบันทึกข้อมูลรายวันจะไม่คำนวณ
              หรือเปลี่ยนแปลงยอดสรุปสต็อกอัตโนมัติ
            </p>

     
          </div>

          {errors.form && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
            >
              {errors.form}
            </p>
          )}

          {/* Actions */}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              ยกเลิก
            </Button>

            <Button
              type="submit"
              disabled={
                dates.length === 0 ||
                pendingDate !== null
              }
            >
              บันทึกรับ-จ่ายสินค้า
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
