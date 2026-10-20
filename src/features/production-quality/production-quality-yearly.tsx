"use client";
import { useState } from "react";
import {
  FactoryDataTable,
  SectionCard,
  SelectField,
} from "@/src/components/factory/patterns";
import {
  averageMetricIds,
  formatDuration,
  metrics,
  yearlySummary,
} from "./production-quality-domain";
import { qualityProfiles } from "./production-quality-profiles";
import { useProductionQuality } from "./production-quality-provider";
export function QualityYearly() {
  const { records } = useProductionQuality();
  const availableYears = Array.from(
    new Set(records.map((r) => r.inspectionDate.slice(0, 4)).filter(Boolean)),
  )
    .sort()
    .reverse();
  const [year, setYear] = useState(
      availableYears[0] || String(new Date().getFullYear()),
    ),
    [month, setMonth] = useState("all"),
    [profile, setProfile] = useState("all"),
    [formula, setFormula] = useState("all");
  const years = Array.from(new Set([...availableYears, year]))
    .sort()
    .reverse();
  const summary = yearlySummary(records, year, month, profile, formula);
  const format = (id: string, n: number | null) =>
    id === "water_solubility"
      ? formatDuration(n)
      : n === null
        ? "—"
        : n.toLocaleString("th-TH", { maximumFractionDigits: 3 });
  return (
    <div className="space-y-4">
      <SectionCard
        title="สรุปรายปี"
        subtitle="เฉพาะเอกสารบันทึกผลแล้ว · ไม่รวมแบบร่าง · แสดงเฉพาะตัววัดที่มีความหมายเดียวกันระหว่างโรงงาน"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="ปี (พ.ศ.)"
            value={year}
            onChange={setYear}
            options={years.map((value) => ({
              value,
              label: String(Number(value) + 543),
            }))}
          />
          <SelectField
            label="เดือน"
            value={month}
            onChange={setMonth}
            options={[
              { value: "all", label: "ทุกเดือน" },
              ...Array.from({ length: 12 }, (_, i) => ({
                value: String(i + 1).padStart(2, "0"),
                label: new Intl.DateTimeFormat("th-TH", {
                  month: "long",
                }).format(new Date(2026, i, 1)),
              })),
            ]}
          />
          <SelectField
            label="โรงงานสรุป"
            value={profile}
            onChange={setProfile}
            options={[
              { value: "all", label: "ทุกโรงงาน" },
              ...Object.entries(qualityProfiles).map(([value, p]) => ({
                value,
                label: p.label,
              })),
            ]}
          />
          <SelectField
            label="สูตรสรุป"
            value={formula}
            onChange={setFormula}
            options={[
              { value: "all", label: "ทุกสูตร" },
              ...Array.from(
                new Set(
                  records.flatMap((r) =>
                    r.formulas.map((f) => f.formulaName).filter(Boolean),
                  ),
                ),
              ).map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          เลือกสูตรจะใช้เฉพาะช่วงคำนวณที่ผูกกับสูตรนั้น
          หากยังไม่เลือกช่วงจะไม่นำค่าของสูตรอื่นมารวม ·
          รวมทุกสูตรนับแต่ละเอกสารและช่วงเวลาเพียงครั้งเดียว
        </p>
      </SectionCard>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["เอกสารตรวจสอบ", String(summary.documents)],
          ["ช่วงเวลาที่มีผลตรวจ", String(summary.slots)],
          [
            "ความชื้นเฉลี่ย (%)",
            format("moisture_content", summary.averages.moisture_content),
          ],
          [
            "ละลายน้ำเฉลี่ย (นาที:วินาที)",
            formatDuration(summary.averages.water_solubility),
          ],
        ].map(([label, value]) => (
          <SectionCard key={label} title={label}>
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
          </SectionCard>
        ))}
      </div>
      <FactoryDataTable
        rows={summary.monthly}
        rowKey={(r) => String(r.month)}
        minWidth={1050}
        columns={[
          { key: "month", label: "เดือน", render: (r) => String(r.month) },
          { key: "docs", label: "เอกสาร", render: (r) => String(r.documents) },
          { key: "slots", label: "ช่วงตรวจ", render: (r) => String(r.slots) },
          ...averageMetricIds.map((id) => ({
            key: id,
            label: metrics.find((m) => m.id === id)!.label,
            render: (r: (typeof summary.monthly)[number]) => (
              <div>
                {format(id, r.averages[id])}
                <p className="text-xs text-muted-foreground">
                  {r.counts[id]} ค่า
                </p>
              </div>
            ),
          })),
        ]}
      />
    </div>
  );
}
