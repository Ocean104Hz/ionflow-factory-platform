"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SectionCard } from "@/src/components/factory/patterns";
import {
  periodRange,
  validRange,
  type DateRange,
  type DashboardPeriod,
} from "@/src/lib/mock-data/dashboard";
export function PeriodFilter({
  period,
  range,
  anchor,
  onChange,
}: {
  period: DashboardPeriod;
  range: DateRange;
  anchor: string;
  onChange: (period: DashboardPeriod, range: DateRange) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  return (
    <SectionCard
      title="ช่วงเวลาวิเคราะห์"
      subtitle="ข้อมูลสาธิตรายวัน · วันที่ในอนาคตและนอกชุดข้อมูลแสดงเป็นศูนย์"
    >
      <div className="flex flex-wrap gap-2" aria-label="เลือกช่วงเวลา">
        {(
          [
            ["today", "วันนี้"],
            ["week", "7 วัน"],
            ["month", "เดือนนี้"],
            ["year", "ปีนี้"],
            ["custom", "กำหนดเอง"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            variant={
              (custom ? value === "custom" : value === period)
                ? "default"
                : "outline"
            }
            aria-pressed={custom ? value === "custom" : value === period}
            onClick={() => {
              setError("");
              setCustom(value === "custom");
              if (value === "custom") setDraft(range);
              else onChange(value, periodRange(value, anchor));
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {custom && (
        <form
          className="mt-5 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validRange(draft)) {
              setError(
                "ระบุวันที่ให้ถูกต้อง โดยวันเริ่มต้นต้องไม่เกินวันสิ้นสุด",
              );
              return;
            }
            setError("");
            onChange("custom", draft);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="analytics-from">วันที่เริ่มต้น</Label>
            <Input
              id="analytics-from"
              type="date"
              required
              value={draft.from}
              aria-invalid={!!error}
              aria-describedby={error ? "analytics-range-error" : undefined}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="analytics-to">วันที่สิ้นสุด</Label>
            <Input
              id="analytics-to"
              type="date"
              required
              value={draft.to}
              aria-invalid={!!error}
              aria-describedby={error ? "analytics-range-error" : undefined}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </div>
          <Button type="submit">ใช้ช่วงเวลา</Button>
          {error && (
            <p
              id="analytics-range-error"
              role="alert"
              className="text-sm text-danger sm:col-span-3"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </SectionCard>
  );
}
