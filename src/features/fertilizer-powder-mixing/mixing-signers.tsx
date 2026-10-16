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
      title="ผู้ลงชื่อ"
      subtitle="ข้อมูลชื่อจำลองเท่านั้น ไม่ใช่ลายเซ็นดิจิทัลหรือสิทธิ์อนุมัติจริง"
    >
      {onChange ? (
        <div className="grid gap-4 md:grid-cols-3">
          {roles.map(([key, label]) => (
            <MasterSelect
              kind="personnel"
              reference={row.masterRefs?.[key]}
              key={key}
              label={label}
              value={row[key]}
              onChange={(value) => onChange({ [key]: value })}
            />
          ))}
          <MixingField
            label="วันที่ตรวจสอบคุณภาพ"
            type="date"
            value={row.inspector_date}
            onChange={(e) => onChange({ inspector_date: e.target.value })}
            error={errors.inspector_date}
          />
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
