"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  FactoryDataTable,
  SectionCard,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { date } from "@/src/lib/formatters";
import { MixingField } from "./mixing-header";
import { MasterSelect } from "@/src/features/master-data/master-select";
import {
  blankRound,
  shifts,
  type MixingRound,
  type FieldErrors,
} from "./mixing-domain";

export function MixingRoundTable({
  rows,
  day,
  shift,
  onChange,
  errors = {},
}: {
  rows: MixingRound[];
  day: string;
  shift: string;
  onChange?: (rows: MixingRound[]) => void;
  errors?: FieldErrors;
}) {
  const update = (index: number, patch: Partial<MixingRound>) =>
    onChange?.(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const textFields = [
    ["round_date", "วันที่ผสม", "date"],
    ["loader_load_count", "จำนวนตัก", "text"],
    ["operator_mixer", "ผู้ผสม (รถตัก)", "text"],
    ["supervisor", "ผู้ควบคุม (QC/หัวหน้า)", "text"],
  ] as const;
  const columns: Column<MixingRound>[] = [
    { key: "n", label: "รอบ", render: (_, i) => i + 1 },
    ...textFields.slice(0, 1).map(([key, label, type]) => ({
      key,
      label,
      render: (r: MixingRound, i: number) =>
        onChange ? (
          <div className="min-w-40">
            <MixingField
              label={`${label} รอบ ${i + 1} *`}
              type={type}
              value={r[key]}
              onChange={(e) => update(i, { [key]: e.target.value })}
              error={errors[`rounds.${i}.${key}`]}
            />
          </div>
        ) : (
          date(r[key])
        ),
    })),
    {
      key: "shift",
      label: "กะที่ผลิต",
      render: (r, i) =>
        onChange ? (
          <div className="min-w-32">
            <MasterSelect
              kind="shifts"
              label={`กะ รอบ ${i + 1} *`}
              value={r.shift}
              onChange={(shift) => update(i, { shift })}
            />
            {errors[`rounds.${i}.shift`] && (
              <p className="text-xs text-danger">
                {errors[`rounds.${i}.shift`]}
              </p>
            )}
          </div>
        ) : (
          r.shift
        ),
    },
    ...textFields.slice(1, 2).map(([key, label, type]) => ({
      key,
      label,
      render: (r: MixingRound, i: number) =>
        onChange ? (
          <div className="min-w-32">
            <MixingField
              label={`${label} รอบ ${i + 1} *`}
              type={type}
              placeholder="เช่น 4 / ครบ"
              value={r[key]}
              onChange={(e) => update(i, { [key]: e.target.value })}
              error={errors[`rounds.${i}.${key}`]}
            />
          </div>
        ) : (
          r[key]
        ),
    })),
    {
      key: "result",
      label: "ผลตรวจ 6 จุด",
      render: (r, i) =>
        onChange ? (
          <div className="min-w-36">
            <SelectField
              label={`ผลตรวจ 6 จุด รอบ ${i + 1}`}
              value={
                r.is_pass === null ? "pending" : r.is_pass ? "pass" : "fail"
              }
              onChange={(v) =>
                update(i, { is_pass: v === "pending" ? null : v === "pass" })
              }
              options={[
                { value: "pending", label: "ยังไม่ตรวจ" },
                { value: "pass", label: "ผ่าน" },
                { value: "fail", label: "ไม่ผ่าน" },
              ]}
            />
            {errors[`rounds.${i}.is_pass`] && (
              <p className="text-xs text-danger">
                {errors[`rounds.${i}.is_pass`]}
              </p>
            )}
          </div>
        ) : (
          <StatusBadge
            tone={
              r.is_pass === null
                ? "warning"
                : r.is_pass
                  ? "success"
                  : "destructive"
            }
          >
            {r.is_pass === null ? "ยังไม่ตรวจ" : r.is_pass ? "ผ่าน" : "ไม่ผ่าน"}
          </StatusBadge>
        ),
    },
    ...textFields.slice(2).map(([key, label, type]) => ({
      key,
      label,
      render: (r: MixingRound, i: number) =>
        onChange ? (
          <div className="min-w-44">
            <MixingField
              label={`${label} รอบ ${i + 1} *`}
              type={type}
              value={r[key]}
              onChange={(e) => update(i, { [key]: e.target.value })}
              error={errors[`rounds.${i}.${key}`]}
            />
          </div>
        ) : (
          r[key]
        ),
    })),
  ];
  if (onChange)
    columns.push({
      key: "remove",
      label: "จัดการ",
      render: (r, i) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`ลบรอบผสม ${i + 1}`}
          onClick={() => onChange(rows.filter((m) => m.id !== r.id))}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ),
    });
  return (
    <SectionCard
      title="รอบผสมและผลตรวจ"
      subtitle={`ผ่าน ${rows.filter((r) => r.is_pass === true).length} · ไม่ผ่าน ${rows.filter((r) => r.is_pass === false).length} · ยังไม่ตรวจ ${rows.filter((r) => r.is_pass === null).length} — ผลตรวจต่อรอบ ไม่ใช่สถานะอนุมัติเอกสาร`}
      action={
        onChange && (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange([...rows, blankRound(crypto.randomUUID(), day, shift)])
            }
          >
            <Plus aria-hidden="true" />
            เพิ่มรอบผสม
          </Button>
        )
      }
    >
      {errors.mix_rounds && (
        <p role="alert" className="mb-3 text-danger">
          {errors.mix_rounds}
        </p>
      )}
      <FactoryDataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        minWidth={1150}
      />
    </SectionCard>
  );
}
