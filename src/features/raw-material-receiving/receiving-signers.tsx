"use client";

import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SectionCard } from "@/src/components/factory/patterns";
import type { ReceivingSigners } from "./receiving-domain";

const signerFields = [
  { key: "issuerName", title: "ผู้ออก/วันที่" },
  { key: "approverName", title: "ผู้อนุมัติ" },
  { key: "recorderName", title: "ผู้บันทึกบัญชี" },
  { key: "inspectorName", title: "ผู้ตรวจสอบ" },
] as const satisfies readonly { key: keyof ReceivingSigners; title: string }[];

export function ReceivingSignersSection({
  value,
  onChange,
}: {
  value: ReceivingSigners;
  onChange: (next: ReceivingSigners) => void;
}) {
  return (
    <SectionCard
      title="รายชื่อผู้ลงนาม"
      subtitle="ข้อมูลผู้เกี่ยวข้องในเอกสารทดลอง ไม่ใช่การลงนามหรืออนุมัติจริง"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {signerFields.map(({ key, title }) => (
          <div key={key} className="min-w-0 space-y-2 rounded-xl border bg-surface p-4">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Label htmlFor={`inbound-signer-${key}`} className="text-xs">
              ชื่อ / รหัสผู้ใช้
            </Label>
            <Input
              id={`inbound-signer-${key}`}
              value={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
              placeholder="ชื่อ-สกุล"
              autoComplete="off"
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
