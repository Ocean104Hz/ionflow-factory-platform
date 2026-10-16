"use client";
import { useId, type ComponentProps } from "react";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  SectionCard,
  SelectField,
  InfoGrid,
  InfoRow,
} from "@/src/components/factory/patterns";
import {
  mixingFormulas,
  mixingLocations,
} from "@/src/lib/mock-data/fertilizer-powder-mixing";
import { date } from "@/src/lib/formatters";
import { shifts, type MixingReport, type FieldErrors } from "./mixing-domain";
import { MasterSelect } from "@/src/features/master-data/master-select";
import { useMasterData } from "@/src/features/master-data/master-provider";

export function MixingField({
  label,
  error,
  ...props
}: ComponentProps<typeof Input> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="grid min-w-0 content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function MixingHeader({
  row,
  onChange,
  errors = {},
}: {
  row: MixingReport;
  onChange?: (patch: Partial<MixingReport>) => void;
  errors?: FieldErrors;
}) {
  const { state } = useMasterData();
  return (
    <SectionCard
      title="ข้อมูลรายงาน"
      subtitle={
        onChange ? "ระบุข้อมูลการผสม · ช่องที่มี * จำเป็นต้องกรอก" : undefined
      }
    >
      {!onChange ? (
        <InfoGrid>
          {(
            [
              ["วันที่รายงาน", date(row.report_date)],
              ["เลขที่เอกสาร", row.doc_no],
              ["สูตร / ผลิตภัณฑ์", row.fertilizer],
              ["Lot No.", row.lot_no],
              ["กะที่ผลิต", row.shift],
              ["สถานที่ผสม", row.location],
              ["หมายเลขรถตัก", row.loader_no],
              ["ระยะเวลาการผสม (ชั่วโมง)", row.mix_duration ?? "—"],
            ] as const
          ).map(([label, value]) => (
            <InfoRow key={label} label={label}>
              {value}
            </InfoRow>
          ))}
        </InfoGrid>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MixingField
            label="วันที่รายงาน *"
            type="date"
            value={row.report_date}
            onChange={(e) => onChange({ report_date: e.target.value })}
            error={errors.report_date}
          />
          <MixingField
            label="เลขที่เอกสาร *"
            value={row.doc_no}
            onChange={(e) => onChange({ doc_no: e.target.value })}
            error={errors.doc_no}
          />
          <div>
            <SelectField
              label="สูตร / ผลิตภัณฑ์ *"
              value={row.fertilizer}
              onChange={(fertilizer) => onChange({ fertilizer })}
              options={mixingFormulas.map((value) => ({ value, label: value }))}
            />
            {errors.fertilizer && (
              <p className="mt-2 text-xs text-danger">{errors.fertilizer}</p>
            )}
          </div>
          <MixingField
            label="Lot No. *"
            value={row.lot_no}
            onChange={(e) => onChange({ lot_no: e.target.value })}
            error={errors.lot_no}
          />
          <div>
            <MasterSelect
              kind="shifts"
              reference={row.masterRefs?.shift}
              label="กะที่ผลิต *"
              value={row.shift}
              onChange={(shift) => onChange({ shift })}
            />
            {errors.shift && (
              <p className="mt-2 text-xs text-danger">{errors.shift}</p>
            )}
          </div>
          <div>
            <MasterSelect
              kind="areas"
              reference={row.masterRefs?.location}
              label="สถานที่ผสม *"
              value={row.location}
              onChange={(location) => onChange({ location })}
            />
            {errors.location && (
              <p className="mt-2 text-xs text-danger">{errors.location}</p>
            )}
          </div>
          <MasterSelect
            kind="vehicles"
            reference={row.masterRefs?.loader_no}
            filter={(id) => {
              const vehicle = state.rows.find((r) => r.id === id);
              return state.rows.some(
                (r) =>
                  r.id === vehicle?.typeId &&
                  r.kind === "vehicleTypes" &&
                  r.type === "รถตัก" &&
                  r.active,
              );
            }}
            label="หมายเลขรถตัก *"
            value={row.loader_no}
            onChange={(loader_no) => onChange({ loader_no })}
          />
          <MixingField
            label="ระยะเวลาการผสม (ชั่วโมง)"
            type="number"
            step="any"
            value={
              Number.isNaN(row.mix_duration) ? "" : (row.mix_duration ?? "")
            }
            onChange={(e) =>
              onChange({
                mix_duration:
                  e.target.value === "" ? null : e.target.valueAsNumber,
              })
            }
            error={errors.mix_duration}
          />
        </div>
      )}
    </SectionCard>
  );
}
