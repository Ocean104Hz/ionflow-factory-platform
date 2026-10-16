"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Checkbox } from "@/src/components/ui/checkbox";
import { SectionCard, SelectField } from "@/src/components/factory/patterns";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableHeader,
} from "@/src/components/ui/table";
import {
  blankFormula,
  formulaErrors,
  formulaStatuses,
  BOMValidationError,
  type Formula,
  type Master,
  type FieldErrors,
  type Component,
} from "./bom-domain";
import { useBOM } from "./bom-provider";
import { BOMMaterialPicker } from "./bom-material-picker";
import { MasterSelect } from "@/src/features/master-data/master-select";

export function BOMFormulaForm({
  master,
  initial,
  onSaved,
  onClose,
}: {
  master: Master;
  initial?: Formula;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const { state, saveFormula } = useBOM();
  const [form, setForm] = useState(initial ?? blankFormula(master));
  const [isDefault, setIsDefault] = useState(
    !!initial && master.defaultFormulaId === initial.id,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const field = (
    key: "code" | "name" | "version" | "unit" | "effectiveDate",
    label: string,
    required = false,
    type = "text",
  ) =>
    key === "unit" ? (
      <MasterSelect
        kind="units"
        label={label}
        value={form.unit}
        reference={form.masterRefs?.unit}
        onChange={(unit) => setForm({ ...form, unit })}
      />
    ) : (
      <div className="grid gap-2">
        <Label htmlFor={`formula-${key}`}>
          {label}
          {required && " *"}
        </Label>
        <Input
          id={`formula-${key}`}
          type={type}
          required={required}
          readOnly={key === "version" && !!initial}
          value={form[key]}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `formula-error-${key}` : undefined}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
        {errors[key] && (
          <p id={`formula-error-${key}`} className="text-xs text-danger">
            {errors[key]}
          </p>
        )}
      </div>
    );
  function components(group: "ingredients" | "packaging", title: string) {
    const rows = form[group];
    function update(index: number, patch: Partial<Component>) {
      setForm((f) => ({
        ...f,
        [group]: f[group].map((r, i) => (i === index ? { ...r, ...patch } : r)),
      }));
    }
    return (
      <SectionCard
        title={title}
        subtitle={
          group === "ingredients"
            ? "ต้องมีอย่างน้อย 1 รายการ · ไม่รวมยอดข้ามหน่วย และไม่หักสต็อก"
            : "ไม่บังคับ · แยกจากวัตถุดิบในสูตร"
        }
        action={
          <BOMMaterialPicker
            masters={state.masters}
            excluded={[master.id, ...rows.map((r) => r.materialId)]}
            label={
              group === "ingredients" ? "เพิ่มวัตถุดิบ" : "เพิ่มบรรจุภัณฑ์"
            }
            onSelect={(m) =>
              setForm((f) => ({
                ...f,
                [group]: [
                  ...f[group],
                  { materialId: m.id, quantity: 1, unit: m.unit, remarks: "" },
                ],
              }))
            }
          />
        }
      >
        {errors[group] && (
          <p role="alert" className="mb-3 text-danger">
            {errors[group]}
          </p>
        )}
        {rows.length ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[790px]">
              <TableHeader>
                <TableRow>
                  <TableHead>รหัส / ชื่อวัสดุ</TableHead>
                  <TableHead>จำนวน *</TableHead>
                  <TableHead>หน่วย *</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead>จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const material = state.masters.find(
                    (m) => m.id === r.materialId,
                  );
                  const error = errors[`${group}.${i}`];
                  return (
                    <TableRow key={r.materialId}>
                      <TableCell className="min-w-52">
                        <p className="font-medium">
                          {material?.code ?? "ไม่พบวัสดุ"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {material?.name ?? r.materialId}
                        </p>
                        {error && (
                          <p
                            role="alert"
                            id={`${group}-${i}-error`}
                            className="mt-2 text-xs text-danger"
                          >
                            {error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-28"
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={Number.isNaN(r.quantity) ? "" : r.quantity}
                          aria-label={`จำนวน ${title} ${material?.code ?? i + 1}`}
                          aria-invalid={!!error}
                          aria-describedby={
                            error ? `${group}-${i}-error` : undefined
                          }
                          onChange={(e) =>
                            update(i, {
                              quantity:
                                e.target.value === ""
                                  ? NaN
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <MasterSelect
                          kind="units"
                          label={`หน่วย ${title} ${material?.code ?? i + 1}`}
                          value={r.unit}
                          onChange={(unit) => update(i, { unit })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="min-w-40"
                          aria-label={`หมายเหตุ ${title} ${material?.code ?? i + 1}`}
                          value={r.remarks}
                          onChange={(e) =>
                            update(i, { remarks: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`ลบ ${title} ${material?.code ?? i + 1}`}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              [group]: f[group].filter(
                                (_, index) => index !== i,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="text-danger" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            {group === "ingredients"
              ? "ยังไม่มีวัตถุดิบ กรุณาเลือกเพิ่มจากข้อมูลหลัก"
              : "สูตรนี้ไม่มีบรรจุภัณฑ์"}
          </p>
        )}
      </SectionCard>
    );
  }
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const issues = formulaErrors(state, form, isDefault);
        setErrors(issues);
        if (Object.keys(issues).length) return;
        try {
          onSaved(saveFormula(form, isDefault));
        } catch (error) {
          setErrors(
            error instanceof BOMValidationError
              ? error.fields
              : {
                  form:
                    error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
                },
          );
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        สินค้า:{" "}
        <span className="font-medium text-foreground">
          {master.code} · {master.name}
        </span>
      </p>
      <SectionCard
        title="A. ข้อมูลสูตร"
        subtitle={
          initial
            ? "เวอร์ชันเดิมถูกล็อก หากต้องการเก็บสูตรใหม่ให้สร้างเวอร์ชันใหม่"
            : "สร้างเวอร์ชันใหม่โดยไม่เขียนทับเวอร์ชันเดิม"
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {field("code", "รหัสสูตร", true)}
          {field("version", "เวอร์ชัน", true)}
          {field("name", "ชื่อสูตร", true)}
          <div>
            <SelectField
              label="สถานะสูตร *"
              value={form.status}
              options={Object.entries(formulaStatuses).map(
                ([value, label]) => ({ value, label }),
              )}
              onChange={(status) =>
                setForm({ ...form, status: status as Formula["status"] })
              }
            />
            {errors.status && (
              <p className="mt-2 text-xs text-danger">{errors.status}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="formula-batch">ปริมาณผลิตต่อรอบ *</Label>
            <Input
              id="formula-batch"
              type="number"
              step="any"
              min="0"
              required
              value={Number.isNaN(form.batchSize) ? "" : form.batchSize}
              aria-invalid={!!errors.batchSize}
              onChange={(e) =>
                setForm({
                  ...form,
                  batchSize:
                    e.target.value === "" ? NaN : Number(e.target.value),
                })
              }
            />
            {errors.batchSize && (
              <p className="text-xs text-danger">{errors.batchSize}</p>
            )}
          </div>
          {field("unit", "หน่วยผลิต", true)}
          {field("effectiveDate", "วันที่เริ่มใช้", false, "date")}
        </div>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="formula-notes">หมายเหตุสูตร</Label>
          <Textarea
            id="formula-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            id="formula-default"
            checked={isDefault}
            onCheckedChange={(v) => setIsDefault(v === true)}
          />
          <Label htmlFor="formula-default">
            ใช้เป็นสูตรเริ่มต้นของสินค้านี้ (ต้องเป็น ACTIVE)
          </Label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          หากยกเลิกเลือกสูตรเริ่มต้นเดิม จะล้างค่าเริ่มต้นเมื่อบันทึก
          โดยไม่เปลี่ยนสถานะของสูตรอื่น
        </p>
        {errors.defaultFormula && (
          <p role="alert" className="mt-2 text-danger">
            {errors.defaultFormula}
          </p>
        )}
      </SectionCard>
      {components("ingredients", "B. วัตถุดิบในสูตร")}
      {components("packaging", "C. บรรจุภัณฑ์")}
      {!!Object.keys(errors).length && (
        <p role="alert" className="text-danger">
          {errors.form ?? Object.values(errors)[0]}
        </p>
      )}
      <div className="sticky -bottom-5 flex justify-end gap-2 border-t bg-background py-4">
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">บันทึกสูตร</Button>
      </div>
    </form>
  );
}
