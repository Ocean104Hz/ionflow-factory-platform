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
  CUSTOMER_MATERIALS_PERIODS,
  CUSTOMER_MATERIALS_SO_SHEET_NAMES,
  CUSTOMER_MATERIALS_SUMMARY_LABELS,
  isCustomerMaterialsSoSheetName,
  validateCustomerMaterialsRow,
  type CustomerMaterialsFormErrors,
  type CustomerMaterialsFormMode,
  type CustomerMaterialsItem,
  type CustomerMaterialsRow,
  type CustomerMaterialsSummaryField,
} from "./stock_customer_materials_domain";

/* ---------------- types ---------------- */

interface CustomerMaterialsFormProps {
  row: CustomerMaterialsRow;
  mode: CustomerMaterialsFormMode;
  onSave: (row: CustomerMaterialsRow) => void;
  onCancel: () => void;
}

type ItemField = Exclude<
  keyof CustomerMaterialsItem,
  "id" | "source_row" | "so_sheet"
>;
type EditableSummaryField = Exclude<
  CustomerMaterialsSummaryField,
  "physical_count" | "count_difference"
>;

/* ---------------- constants ---------------- */

const ITEM_FIELDS = [
  {
    key: "sales_customer",
    label: "ฝ่ายขาย / ลูกค้า",
    placeholder: "ระบุฝ่ายขายหรือลูกค้า",
  },
  {
    key: "material_type",
    label: "ประเภทวัสดุ",
    placeholder: "ระบุประเภทวัสดุ",
  },
  {
    key: "code",
    label: "รหัสสินค้า",
    placeholder: "ระบุรหัสสินค้า",
  },
  {
    key: "no",
    label: "No.",
    placeholder: "ระบุ No. ตามเอกสาร",
  },
  {
    key: "description",
    label: "รายละเอียด *",
    placeholder: "ระบุรายละเอียดวัสดุ",
  },
  {
    key: "unit",
    label: "หน่วยนับ",
    placeholder: "ระบุหน่วยนับ",
  },
] as const satisfies readonly {
  key: ItemField;
  label: string;
  placeholder: string;
}[];

const EDITABLE_SUMMARY_FIELDS = [
  "opening_quantity",
  "received_in",
  "issued_production",
  "issued_damaged",
  "issued_other",
  "remaining_quantity",
] as const satisfies readonly EditableSummaryField[];

/* ---------------- input normalization ---------------- */

function normalizeOptionalField(
  value: string | null,
  original: string | null,
  mode: CustomerMaterialsFormMode,
): string | null {
  // Preserve untouched source values, including null and empty strings.
  if (mode === "EDIT" && value === original) {
    return original;
  }

  return value?.trim() || null;
}

/* ---------------- component ---------------- */

/** Mount a new form for each create/edit operation, with the row as its draft. */
export function CustomerMaterialsForm({
  row,
  mode,
  onSave,
  onCancel,
}: CustomerMaterialsFormProps) {
  const formId = useId();
  const isCreate = mode === "CREATE";
  const [draft, setDraft] = useState<CustomerMaterialsRow>(() => {
    if (!isCreate || row.item.added_date) {
      return row;
    }

    // Use the browser's local date, as in the stock-products form.
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return {
      ...row,
      item: {
        ...row.item,
        added_date: `${year}-${month}-${day}`,
      },
    };
  });
  const [errors, setErrors] = useState<CustomerMaterialsFormErrors>({});
  const period = CUSTOMER_MATERIALS_PERIODS[row.sheet_name];

  function clearError(key: string) {
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function updateItem(key: ItemField, value: string) {
    setDraft((previous) => ({
      ...previous,
      item: {
        ...previous.item,
        [key]: value,
      },
    }));
    clearError(key);
  }

  function updateSoSheet(value: string) {
    const soSheet = isCustomerMaterialsSoSheetName(value) ? value : null;
    if (value !== "" && soSheet === null) {
      return;
    }

    setDraft((previous) => ({
      ...previous,
      item: {
        ...previous.item,
        so_sheet: soSheet,
      },
    }));
    clearError("so_sheet");
  }

  function updateSummary(key: EditableSummaryField, value: string) {
    setDraft((previous) => ({
      ...previous,
      summary: {
        ...previous.summary,
        [key]: value,
      },
    }));
    clearError(key);
  }

  /* ---------------- submit ---------------- */

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextRow: CustomerMaterialsRow = {
      ...draft,
      item: {
        ...draft.item,
        ...(draft.item.added_date !== undefined
          ? { added_date: draft.item.added_date?.trim() || null }
          : {}),
        sales_customer: normalizeOptionalField(
          draft.item.sales_customer,
          row.item.sales_customer,
          mode,
        ),
        material_type: normalizeOptionalField(
          draft.item.material_type,
          row.item.material_type,
          mode,
        ),
        code: normalizeOptionalField(draft.item.code, row.item.code, mode),
        no: normalizeOptionalField(draft.item.no, row.item.no, mode),
        description:
          mode === "EDIT" && draft.item.description === row.item.description
            ? row.item.description
            : draft.item.description.trim(),
        unit: normalizeOptionalField(draft.item.unit, row.item.unit, mode),
      },
      // These values belong to the separate daily and count forms.
      daily: row.daily,
      summary: {
        ...draft.summary,
        physical_count: row.summary.physical_count,
        count_difference: row.summary.count_difference,
      },
    };

    const nextErrors = validateCustomerMaterialsRow(
      nextRow,
      mode,
      isCreate ? undefined : row,
    );
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-4xl lg:max-w-6xl xl:max-w-7xl">
        <div className="space-y-1 pr-6">
          <DialogTitle>
            {isCreate ? "เพิ่มวัสดุใหม่" : "แก้ไขข้อมูลวัสดุ"}
          </DialogTitle>
          <DialogDescription>
            บันทึกข้อมูลวัสดุของลูกค้าและยอดสรุปตามงวดที่เลือก
            โดยไม่คำนวณยอดคงเหลืออัตโนมัติ
          </DialogDescription>
        </div>

        <form noValidate className="min-w-0 space-y-5" onSubmit={handleSubmit}>
          {/* Selected worksheet: fixed for this operation. */}
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              งวดข้อมูล
            </p>
            <p className="mt-1 text-sm font-semibold">
              {period.label} ({row.sheet_name})
            </p>
          </div>

          {errors.id && (
            <p role="alert" className="text-sm text-destructive">
              {errors.id}
            </p>
          )}

          {/* Material information: added date, SO group and Excel A:F. */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลวัสดุ</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ช่องที่มีเครื่องหมาย * จำเป็นต้องกรอก
              </p>
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor={`${formId}-added-date`}>
                  วันที่เพิ่มวัสดุ{isCreate ? " *" : ""}
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
                    errors.added_date
                      ? `${formId}-added-date-hint ${formId}-added-date-error`
                      : `${formId}-added-date-hint`
                  }
                  onChange={(event) =>
                    updateItem("added_date", event.currentTarget.value)
                  }
                />
                <p
                  id={`${formId}-added-date-hint`}
                  className="text-xs text-muted-foreground"
                >
                  วันที่เพิ่มรายการวัสดุ ไม่ใช่วันที่รับ-จ่าย
                  และไม่เปลี่ยนงวดข้อมูล
                </p>
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
              <div className="grid min-w-0 gap-2">
                <Label htmlFor={`${formId}-so-sheet`}>
                  กลุ่ม SO{isCreate ? " *" : ""}
                </Label>
                <select
                  id={`${formId}-so-sheet`}
                  name="so_sheet"
                  value={draft.item.so_sheet ?? ""}
                  required={isCreate}
                  aria-invalid={Boolean(errors.so_sheet)}
                  aria-describedby={
                    errors.so_sheet
                      ? `${formId}-so-sheet-hint ${formId}-so-sheet-error`
                      : `${formId}-so-sheet-hint`
                  }
                  className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  onChange={(event) => updateSoSheet(event.currentTarget.value)}
                >
                  <option value="" disabled={isCreate}>
                    {isCreate ? "กรุณาเลือก SO" : "ยังไม่ระบุ SO"}
                  </option>
                  {CUSTOMER_MATERIALS_SO_SHEET_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                <p
                  id={`${formId}-so-sheet-hint`}
                  className="text-xs text-muted-foreground"
                >
                  กลุ่ม SO แยกจากข้อมูลฝ่ายขาย / ลูกค้าใน Excel
                </p>
                {errors.so_sheet && (
                  <p
                    id={`${formId}-so-sheet-error`}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.so_sheet}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {ITEM_FIELDS.map((field) => {
                const inputId = `${formId}-${field.key}`;
                const error = errors[field.key];

                return (
                  <div
                    key={field.key}
                    className={
                      field.key === "description"
                        ? "grid min-w-0 gap-2 sm:col-span-2"
                        : "grid min-w-0 gap-2"
                    }
                  >
                    <Label htmlFor={inputId}>{field.label}</Label>
                    <Input
                      id={inputId}
                      name={field.key}
                      type="text"
                      value={draft.item[field.key] ?? ""}
                      placeholder={field.placeholder}
                      required={field.key === "description"}
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

          {/* Manually maintained summary: Excel G:L. */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลยอดสรุปวัสดุ</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                กรอกยอดแต่ละช่องแยกกันตามข้อมูลจริง ช่องว่างและตัวเลข 0
                มีความหมายแตกต่างกัน
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {EDITABLE_SUMMARY_FIELDS.map((field) => {
                const inputId = `${formId}-summary-${field}`;
                const error = errors[field];

                return (
                  <div key={field} className="grid min-w-0 gap-2">
                    <Label htmlFor={inputId}>
                      {CUSTOMER_MATERIALS_SUMMARY_LABELS[field]}
                    </Label>
                    <Input
                      id={inputId}
                      name={field}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="ระบุจำนวน"
                      value={draft.summary[field]}
                      className="text-right tabular-nums"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${inputId}-error` : undefined}
                      onChange={(event) =>
                        updateSummary(field, event.currentTarget.value)
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

          {/* Remark: Excel O. */}
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

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button type="submit">
              {isCreate ? "บันทึกวัสดุใหม่" : "บันทึกการแก้ไข"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
