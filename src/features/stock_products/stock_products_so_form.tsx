"use client";

import { useId, useState, type FormEvent } from "react";
import { ClipboardList } from "lucide-react";

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
  blankStockProductsSoRow,
  stockProductsRowKey,
  validateStockProductsSoForStock,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  type StockProductsSoRow,
  type StockProductsSoSheetName,
  type StockProductsFormErrors,
  type StockProductsStockRow,
} from "./stock_products_domain";

/* ---------------- types ---------------- */

interface StockProductsSoFormProps {
  id: string;
  initialSheet?: StockProductsSoSheetName;
  stockRows: readonly StockProductsStockRow[];
  onSave: (row: StockProductsSoRow) => void;
  onCancel: () => void;
}

type SoInputField =
  | "date_raw"
  | "customer_name"
  | "so_number"
  | "quantity"
  | "unit";

/* ---------------- constants ---------------- */

const SO_SHEET_OPTIONS = STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => ({
  value: name,
  label: name,
}));

const SO_FIELDS = [
  {
    key: "date_raw",
    label: "วันที่ *",
    placeholder: "ระบุวันที่",
    type: "date",
    required: true,
  },
  {
    key: "so_number",
    label: "เลข SO *",
    placeholder: "กรอกเลข SO",
    type: "text",
    required: true,
  },
  {
    key: "customer_name",
    label: "ชื่อลูกค้า *",
    placeholder: "กรอกชื่อลูกค้า",
    type: "text",
    required: true,
  },
  {
    key: "quantity",
    label: "จำนวน *",
    placeholder: "ระบุจำนวนสินค้า",
    type: "text",
    required: true,
  },
  {
    key: "unit",
    label: "หน่วย",
    placeholder: "เช่น ขวด กล่อง ลิตร",
    type: "text",
    required: false,
  },
] as const satisfies readonly {
  key: SoInputField;
  label: string;
  placeholder: string;
  type: string;
  required: boolean;
}[];

/* ---------------- component ---------------- */

export function StockProductsSoForm({
  id,
  initialSheet,
  stockRows,
  onSave,
  onCancel,
}: StockProductsSoFormProps) {
  const formId = useId();

  const [draft, setDraft] = useState<StockProductsSoRow>(() =>
    blankStockProductsSoRow(
      id,
      initialSheet ?? STOCK_PRODUCTS_SO_SHEET_NAMES[0],
    ),
  );

  const [errors, setErrors] = useState<StockProductsFormErrors>({});

  const availableStockRows = stockRows.filter((row) => row.item.name.trim());
  const selectedStockRow = availableStockRows.find(
    (row) => stockProductsRowKey(row) === draft.stock_row_key,
  );
  const productSelectId = `${formId}-stock-row-key`;

  /* ---------------- select sheet ---------------- */

  function handleSheetChange(value: string) {
    const sheetName = STOCK_PRODUCTS_SO_SHEET_NAMES.find(
      (name) => name === value,
    );

    if (sheetName === undefined) {
      return;
    }

    setDraft((previous) => ({
      ...previous,
      sheet_name: sheetName,
    }));

    setErrors((previous) => {
      const next = { ...previous };

      delete next.sheet_name;

      return next;
    });
  }

  /* ---------------- select stock product ---------------- */

  function handleStockChange(value: string) {
    const selected = availableStockRows.find(
      (row) => stockProductsRowKey(row) === value,
    );

    setDraft((previous) => ({
      ...previous,
      stock_row_key: selected ? stockProductsRowKey(selected) : "",
      product_name: selected?.item.name.trim() ?? "",
      unit: selected?.item.unit?.trim() ?? "",
    }));

    setErrors((previous) => {
      const next = { ...previous };
      delete next.stock_row_key;
      delete next.product_name;
      return next;
    });
  }

  /* ---------------- update field ---------------- */

  function updateField(key: SoInputField, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));

    setErrors((previous) => {
      const next = { ...previous };

      delete next[key];

      return next;
    });
  }

  /* ---------------- submit ---------------- */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRow: StockProductsSoRow = {
      ...draft,
      date_raw: draft.date_raw === null ? "" : String(draft.date_raw).trim(),
      customer_name: draft.customer_name.trim(),
      so_number: draft.so_number.trim(),
      product_name: selectedStockRow?.item.name.trim() ?? "",
      quantity: draft.quantity.trim(),
      unit: draft.unit.trim(),
    };

    const nextErrors = validateStockProductsSoForStock(nextRow, stockRows);

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
          lg:max-w-3xl
        "
      >
        {/* Header */}

        <div className="space-y-1 pr-6">
          <DialogTitle>เพิ่มรายการ SO</DialogTitle>

          <DialogDescription>
            บันทึกรายการ SO ใหม่ โดยเลือกชีต SO และสินค้าที่มีอยู่ในสต็อก
          </DialogDescription>
        </div>

        <form noValidate className="min-w-0 space-y-5" onSubmit={handleSubmit}>
          {/* Select SO sheet */}

          <section className="space-y-4 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex items-center gap-2">
              <ClipboardList
                className="size-4 text-primary"
                aria-hidden="true"
              />

              <h3 className="text-sm font-semibold">เลือกชีต SO</h3>
            </div>

            <SelectField
              label="ชีต SO *"
              value={draft.sheet_name}
              options={SO_SHEET_OPTIONS}
              onChange={handleSheetChange}
            />

            {errors.sheet_name && (
              <p role="alert" className="text-xs text-destructive">
                {errors.sheet_name}
              </p>
            )}
          </section>

          {/* Select stock product */}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">เลือกสินค้า</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                เลือกสินค้าที่มีอยู่ในสต็อก ไม่ต้องสร้างสินค้าใหม่
              </p>
            </div>

            <div className="grid min-w-0 gap-2">
              <Label htmlFor={productSelectId}>สินค้า *</Label>
              <select
                id={productSelectId}
                name="stock_row_key"
                required
                value={
                  selectedStockRow ? stockProductsRowKey(selectedStockRow) : ""
                }
                disabled={availableStockRows.length === 0}
                aria-invalid={Boolean(errors.stock_row_key)}
                aria-describedby={
                  errors.stock_row_key ? `${productSelectId}-error` : undefined
                }
                onChange={(event) =>
                  handleStockChange(event.currentTarget.value)
                }
                className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive"
              >
                <option value="">เลือกสินค้าจากสต็อก</option>
                {availableStockRows.map((row) => {
                  const key = stockProductsRowKey(row);
                  const label = [
                    row.item.code,
                    row.item.name.trim(),
                    row.item.unit,
                  ]
                    .filter((part) => part?.trim())
                    .join(" · ");

                  return (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  );
                })}
              </select>

              {errors.stock_row_key && (
                <p
                  id={`${productSelectId}-error`}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {errors.stock_row_key}
                </p>
              )}

              {availableStockRows.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  ยังไม่มีสินค้าให้เลือก กรุณาเพิ่มสินค้าในหน้าสต็อกก่อน
                </p>
              )}
            </div>
          </section>

          {/* SO information */}

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลรายการ SO</h3>

              <p className="mt-1 text-xs text-muted-foreground">
                ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {SO_FIELDS.map((field) => {
                const inputId = `${formId}-${field.key}`;

                const error = errors[field.key];

                const fullWidth = field.key === "customer_name";

                return (
                  <div
                    key={field.key}
                    className={
                      fullWidth
                        ? "grid min-w-0 gap-2 sm:col-span-2"
                        : "grid min-w-0 gap-2"
                    }
                  >
                    <Label htmlFor={inputId}>{field.label}</Label>

                    <Input
                      id={inputId}
                      name={field.key}
                      type={field.type}
                      value={String(draft[field.key] ?? "")}
                      placeholder={field.placeholder}
                      required={field.required}
                      autoComplete="off"
                      inputMode={
                        field.key === "quantity" ? "decimal" : undefined
                      }
                      className={
                        field.key === "quantity"
                          ? "text-right tabular-nums"
                          : undefined
                      }
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(event) =>
                        updateField(field.key, event.currentTarget.value)
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

          {/* Information */}

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              รายการ SO สามารถมีเลขเอกสารซ้ำกันได้
              เนื่องจากหนึ่งเอกสารอาจมีสินค้าหลายรายการ
            </p>

            <p>การเพิ่มรายการ SO จะไม่หักยอดสต็อกสินค้าอัตโนมัติ</p>

            <p>
              UI Mock · ข้อมูลจัดเก็บภายในเบราว์เซอร์ เมื่อบันทึกสำเร็จ
              ไม่มีการเชื่อมต่อฐานข้อมูลจริง
            </p>
          </div>

          {/* Actions */}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>

            <Button type="submit" disabled={availableStockRows.length === 0}>
              บันทึกรายการ SO
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
