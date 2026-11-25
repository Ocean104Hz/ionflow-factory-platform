"use client";
import {
  SectionCard,
  InfoGrid,
  InfoRow,
} from "@/src/components/factory/patterns";
import { MixingField } from "./mixing-header";
import type { MixingReport, FieldErrors } from "./mixing-domain";
import { MasterSelect } from "@/src/features/master-data/master-select";
export function MixingSigners({
  row,
  onChange,
  errors = {},
}: {
  row: MixingReport;
  onChange?: (patch: Partial<MixingReport>) => void;
  errors?: FieldErrors;
}) {
  const roles = [
    ["inspector", "ผู้ตรวจสอบคุณภาพ"],
    ["production", "เจ้าหน้าที่ผลิต"],
    ["factory_qa", "ผู้จัดการโรงงาน/QA"],
  ] as const;
  return (
    <SectionCard
      title="ชื่อผู้ลงนาม"
      className="gap-3 rounded-xl border bg-card py-3 shadow-sm [&_[data-slot=card-header]]:border-b [&_[data-slot=card-header]]:px-4 [&_[data-slot=card-header]]:pb-3 [&_[data-slot=card-content]]:px-4"
      subtitle="ข้อมูลชื่อจำลองเท่านั้น ไม่ใช่ลายเซ็นดิจิทัลหรือสิทธิ์อนุมัติจริง"
    >
      {onChange ? (
        <div className="grid gap-4 md:grid-cols-3">
          {roles.map(([key, label]) => (
            <div key={key} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <MasterSelect kind="personnel" reference={row.masterRefs?.[key]} label="ชื่อ / รหัสผู้ใช้" value={row[key]} onChange={(value) => onChange({ [key]: value })} />
              {key === "inspector" && (
                <MixingField label="วันที่ตรวจสอบคุณภาพ" type="date" value={row.inspector_date} onChange={(e) => onChange({ inspector_date: e.target.value })} error={errors.inspector_date} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <InfoGrid>
          {roles.map(([key, label]) => (
            <InfoRow key={key} label={label}>
              {row[key] || "ยังไม่ระบุ"}
            </InfoRow>
          ))}
          <InfoRow label="วันที่ตรวจสอบคุณภาพ">
            {row.inspector_date || "ยังไม่ระบุ"}
          </InfoRow>
        </InfoGrid>
      )}
    </SectionCard>
  );
}
