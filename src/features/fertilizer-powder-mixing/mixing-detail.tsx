"use client";
import {
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { dateTime } from "@/src/lib/formatters";
import { MixingHeader } from "./mixing-header";
import { MixingMaterialTable } from "./mixing-material-table";
import { MixingRoundTable } from "./mixing-round-table";
import { MixingSigners } from "./mixing-signers";
import { summarizeReport, type MixingReport } from "./mixing-domain";
export function MixingDetail({ row }: { row: MixingReport }) {
  const summary = summarizeReport(row);
  return (
    <div className="space-y-4">
      <StatusBadge tone={summary.tone}>{summary.label}</StatusBadge>
      <MixingHeader row={row} />
      <MixingMaterialTable rows={row.materials} />
      <MixingRoundTable
        rows={row.mix_rounds}
        day={row.report_date}
        shift={row.shift}
      />
      <MixingSigners row={row} />
      <SectionCard title="ข้อมูลการบันทึกจำลอง">
        <InfoGrid>
          <InfoRow label="สร้างเมื่อ">{dateTime(row.created_at)}</InfoRow>
          <InfoRow label="แก้ไขล่าสุด">{dateTime(row.updated_at)}</InfoRow>
          <InfoRow label="ผู้บันทึก">{row.updated_by}</InfoRow>
          <InfoRow label="การเก็บข้อมูล">
            เฉพาะเซสชันนี้ · รีโหลดหน้าเพื่อคืนข้อมูลเริ่มต้น
          </InfoRow>
        </InfoGrid>
      </SectionCard>
    </div>
  );
}
