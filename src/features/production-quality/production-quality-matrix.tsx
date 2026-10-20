"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/src/components/ui/table";
import { SelectField, SectionCard } from "@/src/components/factory/patterns";
import { qualityProfiles } from "./production-quality-profiles";
import {
  changeReading,
  displayReading,
  emptyReading,
  metrics,
  timeSlots,
  type Inspection,
  type Reading,
  type Metric,
  type Slot,
} from "./production-quality-domain";

function MetricCell({
  metric,
  slot,
  row,
  onChange,
  error,
}: {
  metric: Metric;
  slot: Slot;
  row: Inspection;
  onChange?: (row: Inspection) => void;
  error?: string;
}) {
  const r = row.readings[metric.id]?.[slot] ?? emptyReading(metric);
  const label = `${metric.label} ${slot}`;
  const update = (next: Reading) =>
    onChange?.(changeReading(row, metric.id, slot, next));
  if (!onChange)
    return (
      <div className="space-y-1 whitespace-normal">
        <span>{displayReading(r) || "—"}</span>
        {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
      </div>
    );
  return (
    <div className="grid w-40 min-w-0 max-w-full gap-1.5 whitespace-normal">
      {r.kind === "boolean" ? (
        <SelectField
          label={label}
          value={r.value === null ? "null" : String(r.value)}
          options={[
            { value: "null", label: "ยังไม่ตรวจ" },
            { value: "true", label: "ผ่าน" },
            { value: "false", label: "ไม่ผ่าน" },
          ]}
          onChange={(v) =>
            update({ ...r, value: v === "null" ? null : v === "true" })
          }
        />
      ) : r.kind === "text" ? (
        <SelectField
          label={label}
          value={r.value || "empty"}
          options={[
            { value: "empty", label: "ยังไม่ระบุ" },
            ...qualityProfiles[row.profileId].dust.map((value) => ({
              value,
              label: value,
            })),
          ]}
          onChange={(v) => update({ ...r, value: v === "empty" ? "" : v })}
        />
      ) : r.kind === "temperature" ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-9 w-full whitespace-normal text-xs"
              aria-label={label}
            >
              {r.value.some(Boolean)
                ? displayReading(r)
                : `ระบุ ${r.value.length} จุด`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3">
            <h3 className="font-medium">{label}</h3>
            <p className="text-xs text-muted-foreground">
              บันทึกแต่ละจุดแยกกัน · ไม่เปลี่ยนค่าอีกชุด
            </p>
            <div className="grid grid-cols-2 gap-3">
              {r.value.map((v, i) => (
                <div key={i}>
                  <Label htmlFor={`${metric.id}-${slot}-${i}`}>
                    จุด {i + 1} (°C)
                  </Label>
                  <Input
                    id={`${metric.id}-${slot}-${i}`}
                    inputMode="decimal"
                    value={v}
                    onChange={(e) =>
                      update({
                        ...r,
                        value: r.value.map((old, n) =>
                          n === i ? e.target.value : old,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <Input
          aria-label={label}
          aria-invalid={!!error}
          inputMode={r.kind === "numeric" ? "decimal" : "text"}
          placeholder={r.kind === "duration" ? "01:30" : "—"}
          value={r.value}
          onChange={(e) => update({ ...r, value: e.target.value })}
        />
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 max-w-full justify-self-start px-1 text-xs text-muted-foreground"
            aria-label={`หมายเหตุ ${label}`}
          >
            {r.note ? "มีหมายเหตุ" : "หมายเหตุ"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="space-y-2">
          <Label htmlFor={`note-${metric.id}-${slot}`}>หมายเหตุ {label}</Label>
          <Textarea
            id={`note-${metric.id}-${slot}`}
            value={r.note}
            onChange={(e) => update({ ...r, note: e.target.value })}
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p
          role="alert"
          className="max-w-44 whitespace-normal text-xs text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
export function QualityMatrix({
  row,
  onChange,
  errors = {},
}: {
  row: Inspection;
  onChange?: (row: Inspection) => void;
  errors?: Record<string, string>;
}) {
  const [focus, setFocus] = useState("all");
  const slots =
    focus === "all" ? timeSlots : timeSlots.filter((s) => s === focus);
  return (
    <SectionCard
      title="ผลตรวจตามช่วงเวลา"
      subtitle="วันผลิตเริ่ม 09:00 และต่อถึง 07:00 วันถัดไป · ค่าว่างไม่ใช่ศูนย์ · ทศนิยมไม่เกิน 3 ตำแหน่ง"
      action={
        <div className="w-44">
          <SelectField
            label="ช่วงเวลาที่แสดง"
            value={focus}
            onChange={setFocus}
            options={[
              { value: "all", label: "ทุกช่วงเวลา" },
              ...timeSlots.map((value) => ({
                value,
                label: `${value}${timeSlots.indexOf(value) >= 14 ? " (+1 วัน)" : ""}`,
              })),
            ]}
          />
        </div>
      }
    >
      {errors.readings && (
        <p role="alert" className="mb-3 text-danger">
          {errors.readings}
        </p>
      )}
      <div
        className="rounded-lg border"
        tabIndex={0}
        role="region"
        aria-label="ตารางผลตรวจ เลื่อนดูเวลาหรือเลือกช่วงเวลา"
      >
        <Table className="w-max min-w-full">
          <TableHeader className="sticky top-0 z-20 bg-muted">
            <TableRow>
              <TableHead className="sticky left-0 z-30 min-w-52 bg-muted">
                หัวข้อตรวจ
              </TableHead>
              {slots.map((slot) => (
                <TableHead key={slot} className="w-48 min-w-48 px-3 text-center">
                  {slot}
                  {timeSlots.indexOf(slot) >= 14 && (
                    <span className="block text-xs">วันถัดไป</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((metric) => (
              <TableRow key={metric.id}>
                <TableCell className="sticky left-0 z-10 w-52 max-w-52 bg-card align-top whitespace-normal font-medium">
                  {metric.id === "dryer_temperature_group_a"
                    ? qualityProfiles[row.profileId].dryerA
                    : metric.id === "dryer_temperature_group_b"
                      ? qualityProfiles[row.profileId].dryerB
                      : metric.label}
                </TableCell>
                {slots.map((slot) => (
                  <TableCell key={slot} className="w-48 min-w-48 px-3 py-2 align-top">
                    <MetricCell
                      metric={metric}
                      slot={slot}
                      row={row}
                      onChange={onChange}
                      error={errors[`${metric.id}.${slot}`]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
