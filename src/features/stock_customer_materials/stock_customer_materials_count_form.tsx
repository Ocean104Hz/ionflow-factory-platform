"use client";

import { useId, useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";

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
  CUSTOMER_MATERIALS_SUMMARY_LABELS,
  updateCustomerMaterialsCount,
  validateCustomerMaterialsCount,
  type CustomerMaterialsCountValues,
  type CustomerMaterialsFormErrors,
  type CustomerMaterialsRow,
} from "./stock_customer_materials_domain";

/* ---------------- types ---------------- */

interface CustomerMaterialsCountFormProps {
  row: CustomerMaterialsRow;
  onSave: (row: CustomerMaterialsRow) => void;
  onCancel: () => void;
}

/* ---------------- component ---------------- */

/** Mount a new form for each material being counted. */
export function CustomerMaterialsCountForm({
  row,
  onSave,
  onCancel,
}: CustomerMaterialsCountFormProps) {
  const formId = useId();
  const period = CUSTOMER_MATERIALS_PERIODS[row.sheet_name];

  const [draft, setDraft] = useState<CustomerMaterialsCountValues>(() => ({
    physical_count: row.summary.physical_count,
    count_difference: row.summary.count_difference,
    remark: row.remark,
  }));
  const [errors, setErrors] = useState<CustomerMaterialsFormErrors>({});

  /* ---------------- update field ---------------- */

  function updateValue(field: keyof CustomerMaterialsCountValues, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
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

    const nextErrors = validateCustomerMaterialsCount(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    let nextRow: CustomerMaterialsRow;
    try {
      nextRow = updateCustomerMaterialsCount(row, draft);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "ไม่สามารถจัดเตรียมข้อมูลตรวจนับได้",
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
          <DialogTitle>บันทึกตรวจนับวัสดุ</DialogTitle>
          <DialogDescription>
            บันทึกหรือแก้ไขจำนวนตรวจนับและผลต่างตามข้อมูลจริงของงวดที่เลือก
          </DialogDescription>
        </div>

        <form noValidate className="min-w-0 space-y-5" onSubmit={handleSubmit}>
          {/* Read-only material identity. */}
          <section className="space-y-3 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
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

          {/* Reference only: Excel L. No recalculation. */}
          <section className="rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">ยอดคงเหลือตามข้อมูลที่บันทึก</h3>
                <p className="text-xs text-muted-foreground">
                  แสดงเพื่ออ้างอิงเท่านั้น ไม่เปลี่ยนจากการตรวจนับ
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="wrap-break-word text-xl font-semibold tabular-nums">
                  {row.summary.remaining_quantity || "-"}
                </p>
                <p className="text-xs text-muted-foreground">{row.item.unit || "หน่วย"}</p>
              </div>
            </div>
          </section>

          {/* Physical count and difference: Excel M:N. */}
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-semibold">ข้อมูลตรวจนับวัสดุ</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                กรอกจำนวนตรวจนับและผลต่างแยกกัน ระบบไม่คำนวณผลต่างให้เอง
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 content-start gap-2">
                <Label htmlFor={`${formId}-physical-count`}>
                  {CUSTOMER_MATERIALS_SUMMARY_LABELS.physical_count}
                </Label>
                <Input
                  id={`${formId}-physical-count`}
                  name="physical_count"
                  type="text"
                  autoComplete="off"
                  value={draft.physical_count}
                  placeholder="ระบุจำนวนหรือข้อความตามต้นฉบับ"
                  className="tabular-nums"
                  onChange={(event) => updateValue("physical_count", event.currentTarget.value)}
                />
                <p className="text-xs text-muted-foreground">
                  รองรับข้อความใน Excel เดิม เช่น ลบ 2 และค่าตัวเลข
                </p>
              </div>

              <div className="grid min-w-0 content-start gap-2">
                <Label htmlFor={`${formId}-count-difference`}>
                  {CUSTOMER_MATERIALS_SUMMARY_LABELS.count_difference}
                </Label>
                <Input
                  id={`${formId}-count-difference`}
                  name="count_difference"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.count_difference}
                  placeholder="ระบุผลต่าง"
                  className="text-right tabular-nums"
                  aria-invalid={Boolean(errors.count_difference)}
                  aria-describedby={
                    errors.count_difference
                      ? `${formId}-count-difference-error`
                      : `${formId}-count-difference-help`
                  }
                  onChange={(event) => updateValue("count_difference", event.currentTarget.value)}
                />
                {errors.count_difference ? (
                  <p
                    id={`${formId}-count-difference-error`}
                    role="alert"
                    className="text-xs text-destructive"
                  >
                    {errors.count_difference}
                  </p>
                ) : (
                  <p id={`${formId}-count-difference-help`} className="text-xs text-muted-foreground">
                    รองรับตัวเลขบวก ลบ ทศนิยม หรือเว้นว่าง
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Shared remark: Excel O. */}
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Label htmlFor={`${formId}-remark`}>หมายเหตุ</Label>
            <Textarea
              id={`${formId}-remark`}
              name="remark"
              rows={3}
              value={draft.remark}
              placeholder="ระบุหมายเหตุเพิ่มเติม"
              onChange={(event) => updateValue("remark", event.currentTarget.value)}
            />
            <p className="text-xs text-muted-foreground">
              หมายเหตุเป็นช่องเดียวกับหมายเหตุของรายการวัสดุ (คอลัมน์ O)
            </p>
          </section>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p>ช่องว่างและจำนวน 0 มีความหมายแตกต่างกัน</p>
            <p>บันทึกเฉพาะตรวจนับ ผลต่าง และหมายเหตุ ไม่แก้ยอดสรุปอื่นหรือรับ-จ่ายรายวัน</p>
            <p>ไม่คำนวณผลต่าง ยอดคงเหลือ หรือยกยอดข้ามเดือนอัตโนมัติ</p>
            <p>UI Mock · จัดเก็บภายในเบราว์เซอร์เมื่อเชื่อมกับ Workspace ไม่มีฐานข้อมูลจริง</p>
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
            <Button type="submit">บันทึกตรวจนับวัสดุ</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
