"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { SelectField, SectionCard } from "@/src/components/factory/patterns";
import {
  blankMaster,
  masterErrors,
  productTypes,
  BOMValidationError,
  type Master,
  type FieldErrors,
} from "./bom-domain";
import { useBOM } from "./bom-provider";

export function BOMMasterForm({
  initial,
  onSaved,
  onClose,
}: {
  initial?: Master;
  onSaved: (id: string) => void;
  onClose: () => void;
}) {
  const { state, saveMaster } = useBOM();
  const [form, setForm] = useState(initial ?? blankMaster());
  const [errors, setErrors] = useState<FieldErrors>({});
  const input = (
    key:
      | "code"
      | "name"
      | "unit"
      | "usageType"
      | "company"
      | "process"
      | "category"
      | "brand"
      | "department",
    label: string,
    required = false,
  ) => (
    <div className="grid gap-2" key={key}>
      <Label htmlFor={`bom-master-${key}`}>
        {label}
        {required && " *"}
      </Label>
      <Input
        id={`bom-master-${key}`}
        required={required}
        value={form[key]}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `bom-master-error-${key}` : undefined}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {errors[key] && (
        <p id={`bom-master-error-${key}`} className="text-xs text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const issues = masterErrors(state, form);
        setErrors(issues);
        if (Object.keys(issues).length) return;
        try {
          onSaved(saveMaster(form));
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
      <SectionCard title="ข้อมูลสินค้า / วัตถุดิบ">
        <div className="grid gap-4 sm:grid-cols-2">
          {input("code", "รหัสสินค้า/วัตถุดิบ", true)}
          {input("name", "ชื่อสินค้า/วัตถุดิบ", true)}
          <div>
            <SelectField
              label="ประเภทสินค้า *"
              value={form.type}
              onChange={(type) =>
                setForm({ ...form, type: type as Master["type"] })
              }
              options={Object.entries(productTypes).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            {errors.type && (
              <p className="mt-2 text-xs text-danger">{errors.type}</p>
            )}
          </div>
          {input("unit", "หน่วยหลัก", true)}
          {input("usageType", "ประเภทการใช้งาน")}
        </div>
        <div className="mt-4 grid gap-2">
          <Label htmlFor="bom-master-notes">หมายเหตุ</Label>
          <Textarea
            id="bom-master-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </SectionCard>
      <SectionCard
        title="ข้อมูลเพิ่มเติม"
        subtitle="ไม่บังคับ · ใช้สำหรับค้นหาและกรองรายการในโมดูล BOM"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {input("company", "บริษัท")}
          {input("process", "กระบวนการผลิต")}
          {input("category", "หมวดสินค้า")}
          {input("brand", "แบรนด์")}
          {input("department", "ฝ่าย / แผนก")}
        </div>
      </SectionCard>
      {!!Object.keys(errors).length && (
        <p role="alert" className="text-danger">
          {errors.form ?? Object.values(errors)[0]}
        </p>
      )}
      <div className="sticky -bottom-5 flex justify-end gap-2 border-t bg-background py-4">
        <Button variant="outline" type="button" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit">บันทึกข้อมูลหลัก</Button>
      </div>
    </form>
  );
}
