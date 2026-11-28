"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";

import {
  validateStockProductsRow,
  type StockProductsFormErrors,
  type StockProductsStockRow,
  type StockProductsSummaryField,
} from "./stock_products_domain";

/* ---------------- types ---------------- */

interface StockProductsFormProps {
  row: StockProductsStockRow;
  mode: "CREATE" | "EDIT";
  onSave: (row: StockProductsStockRow) => void;
  onCancel: () => void;
}

type ItemField = "code" | "name" | "group" | "unit" | "added_date";

/* ---------------- constants ---------------- */

const SUMMARY_FIELDS = [
  { key: "balance_quantity", label: "ยอด (F)" },
  { key: "received_in", label: "รับเข้า" },
  { key: "received_return", label: "รับคืน" },
  { key: "issued_customer", label: "จ่ายลูกค้า" },
  { key: "issued_promotion", label: "ส่งเสริมการขาย" },
  { key: "issued_office_sample", label: "ตัวอย่าง" },
  { key: "issued_other", label: "จ่ายอื่น" },
  { key: "damaged", label: "ชำรุด" },
  { key: "remaining_quantity", label: "คงเหลือ" },
  { key: "physical_count", label: "ตรวจนับ" },
  { key: "count_difference", label: "ผลต่าง" },
] as const satisfies readonly {
  key: StockProductsSummaryField;
  label: string;
}[];

const ITEM_FIELDS = [
  {
    key: "code",
    label: "รหัสสินค้า",
    placeholder: "กรอกรหัสสินค้า",
  },
  {
    key: "group",
    label: "ประเภทสินค้า",
    placeholder: "กรอกประเภทสินค้า",
  },
  {
    key: "name",
    label: "ชื่อสินค้า *",
    placeholder: "กรอกชื่อสินค้า",
  },
  {
    key: "unit",
    label: "หน่วย",
    placeholder: "เช่น ขวด กล่อง ลิตร",
  },
] as const satisfies readonly {
  key: ItemField;
  label: string;
  placeholder: string;
}[];

/* ---------------- component ---------------- */

export function StockProductsForm({
  row,
  mode,
  onSave,
  onCancel,
}: StockProductsFormProps) {
  const formId = useId();

  const [draft, setDraft] = useState<StockProductsStockRow>(row);

  const [errors, setErrors] = useState<StockProductsFormErrors>({});

  const isCreate = mode === "CREATE";

  /* ---------------- update item ---------------- */

  function updateItem(key: ItemField, value: string) {
    setDraft((previous) => ({
      ...previous,
      item: {
        ...previous.item,
        [key]: value,
      },
    }));

    setErrors((previous) => {
      const next = { ...previous };

      delete next[key];

      return next;
    });
  }

  /* ---------------- update summary ---------------- */

  function updateSummary(key: StockProductsSummaryField, value: string) {
    setDraft((previous) => ({
      ...previous,
      summary: {
        ...previous.summary,
        [key]: value,
      },
    }));
  }

  /* ---------------- submit ---------------- */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRow: StockProductsStockRow = {
      ...draft,
      item: {
        ...draft.item,
        added_date: draft.item.added_date?.trim() || null,
        code: draft.item.code?.trim() || null,
        name: draft.item.name.trim(),
        group: draft.item.group?.trim() || null,
        unit: draft.item.unit?.trim() || null,
      },
    };

    const nextErrors = validateStockProductsRow(nextRow, mode);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
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
          lg:max-w-4xl
        "
      >
        {/* Header */}

        <div className="space-y-1 pr-6">
          <DialogTitle>
            {isCreate ? "เพิ่มสินค้าใหม่" : "แก้ไขข้อมูลสินค้า"}
          </DialogTitle>

          <DialogDescription>
            {isCreate
              ? "เพิ่มข้อมูลสินค้าและยอดสรุปสต็อก โดยไม่สร้างรายการ SO"
              : "แก้ไขข้อมูลสินค้าและยอดสรุป โดยไม่แก้ไขรายการ SO เดิมอัตโนมัติ"}
          </DialogDescription>
        </div>

        <form noValidate className="min-w-0 space-y-5" onSubmit={handleSubmit}>
          {/* Product information */}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลสินค้า</h3>

              <p className="mt-1 text-xs text-muted-foreground">
                ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${formId}-added-date`}>
                วันที่เพิ่มสินค้า{isCreate ? " *" : ""}
              </Label>
              <Input
                id={`${formId}-added-date`}
                name="added_date"
                type="date"
                value={draft.item.added_date ?? ""}
                required={isCreate}
                className="w-full"
                aria-invalid={Boolean(errors.added_date)}
                aria-describedby={
                  errors.added_date ? `${formId}-added-date-error` : undefined
                }
                onChange={(event) =>
                  updateItem("added_date", event.currentTarget.value)
                }
              />
              {errors.added_date && (
                <p
                  id={`${formId}-added-date-error`}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.added_date}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ITEM_FIELDS.map((field) => {
                const inputId = `${formId}-${field.key}`;

                const error = errors[field.key];

                return (
                  <div key={field.key} className="grid min-w-0 gap-2">
                    <Label htmlFor={inputId}>{field.label}</Label>

                    <Input
                      id={inputId}
                      name={field.key}
                      value={draft.item[field.key] ?? ""}
                      placeholder={field.placeholder}
                      required={field.key === "name"}
                      autoComplete="off"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(event) =>
                        updateItem(field.key, event.currentTarget.value)
                      }
                    />

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

          {/* Summary information */}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลยอดสรุปสต็อก</h3>

              <p className="mt-1 text-xs text-muted-foreground">
                ระบุยอดตามข้อมูลจริง ช่องว่างและตัวเลข 0 มีความหมายแตกต่างกัน
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SUMMARY_FIELDS.map((field) => {
                const inputId = `${formId}-summary-${field.key}`;

                return (
                  <div key={field.key} className="grid min-w-0 gap-2">
                    <Label htmlFor={inputId}>{field.label}</Label>

                    <Input
                      id={inputId}
                      name={field.key}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="ระบุจำนวน"
                      value={draft.summary[field.key]}
                      className="text-right tabular-nums"
                      onChange={(event) =>
                        updateSummary(field.key, event.currentTarget.value)
                      }
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Remark */}

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Label htmlFor={`${formId}-remark`}>หมายเหตุ</Label>

            <Textarea
              id={`${formId}-remark`}
              name="remark"
              rows={3}
              value={draft.remark}
              placeholder="ระบุหมายเหตุเพิ่มเติม"
              onChange={(event) => {
                const remark = event.currentTarget.value;
                setDraft((previous) => ({ ...previous, remark }));
              }}
            />
          </section>

          {/* Actions */}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>

            <Button type="submit">
              {isCreate ? "บันทึกสินค้าใหม่" : "บันทึกการแก้ไข"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
