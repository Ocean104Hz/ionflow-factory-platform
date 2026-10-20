"use client";
import { type ComponentProps } from "react";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Button } from "@/src/components/ui/button";
import { SectionCard, SelectField } from "@/src/components/factory/patterns";
import { OrganicInspectionTable } from "./qc-organic-inspection-table";
import {
  profiles,
  reportFields,
  timeSlots,
  blankFormula,
  calculation,
  selectedTimes,
  durationDisplay,
  summaryFields,
  minutesBetween,
  type OrganicReport,
  type Profile,
  type Formula,
  type Errors,
  type ReportField,
} from "./qc-organic-domain";

export function OrganicField({
  label,
  error,
  readOnly = false,
  ...props
}: ComponentProps<typeof Input> & {
  label: string;
  error?: string;
  readOnly?: boolean;
}) {
  return (
    <div
      className="grid min-w-0 content-start gap-2"
      data-organic-field={props.id}
    >
      <Label htmlFor={props.id}>
        {label}
        {props.required && !readOnly && <span className="text-danger"> *</span>}
      </Label>
      {readOnly ? (
        <p className="whitespace-pre-wrap break-words text-sm">
          {String(props.value || "—")}
        </p>
      ) : (
        <Input
          {...props}
          aria-invalid={!!error}
          aria-describedby={error ? `${props.id}-error` : undefined}
        />
      )}
      {error && (
        <p id={`${props.id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function OrganicFormSections({
  row,
  onChange,
  onProfile,
  errors = {},
  print = false,
}: {
  row: OrganicReport;
  onChange?: (row: OrganicReport) => void;
  onProfile?: (profile: Profile) => void;
  errors?: Errors;
  print?: boolean;
}) {
  const readOnly = !onChange,
    prefix = readOnly ? "read-organic" : "organic";
  const patch = (p: Partial<OrganicReport>) => onChange?.({ ...row, ...p });
  const field = (key: ReportField) => {
    const def = reportFields.find((f) => f[0] === key)!;
    return (
      <OrganicField
        key={key}
        id={`${prefix}-${key}`}
        label={def[1]}
        type={def[2]}
        value={row[key]}
        required={["date", "doc_no", "location"].includes(key)}
        onChange={(e) => patch({ [key]: e.target.value })}
        error={errors[key]}
        readOnly={readOnly}
      />
    );
  };
  const updateFormula = (id: string, p: Partial<Formula>) =>
    patch({
      fertilizer: row.fertilizer.map((f) => (f.id === id ? { ...f, ...p } : f)),
    });
  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <SectionCard
        title="ข้อมูลเอกสาร"
        subtitle="ข้อมูลตัวอย่างเท่านั้น ไม่ใช่ผลอนุมัติ QC"
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {readOnly || row.id ? (
            <div>
              <p className="text-sm font-medium">Factory profile</p>
              <p className="mt-2 text-sm">
                {profiles[row.profile].name} ·{" "}
                {row.id ? "โรงงานของเอกสารเดิมเปลี่ยนไม่ได้" : ""}
              </p>
            </div>
          ) : (
            <SelectField
              label="Factory profile"
              value={row.profile}
              options={Object.entries(profiles).map(([value, p]) => ({
                value,
                label: p.name,
              }))}
              onChange={(v) => onProfile?.(v as Profile)}
            />
          )}
          {(["date", "doc_no", "location"] as const).map(field)}
          {readOnly ? (
            <p>Line การผลิต: {row.line || "—"}</p>
          ) : (
            <div>
              <SelectField
                label="Line การผลิต"
                value={row.line || "unset"}
                options={[
                  { value: "unset", label: "เลือก Line" },
                  ...profiles[row.profile].lines.map((value) => ({
                    value,
                    label: value,
                  })),
                ]}
                onChange={(line) =>
                  patch({ line: line === "unset" ? "" : line })
                }
              />
              {errors.line && (
                <p className="mt-2 text-xs text-danger">{errors.line}</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>
      <SectionCard
        title="สูตรปุ๋ยและ Lot การผลิต"
        action={
          !readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                patch({
                  fertilizer: [
                    ...row.fertilizer,
                    blankFormula(crypto.randomUUID()),
                  ],
                })
              }
            >
              เพิ่มสูตรปุ๋ย
            </Button>
          ) : undefined
        }
      >
        {errors.fertilizer && (
          <p className="mb-3 text-sm text-danger">{errors.fertilizer}</p>
        )}
        <div className="space-y-3">
          {row.fertilizer.map((f, i) => (
            <div
              key={f.id}
              className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              data-formula-id={f.id}
            >
              <OrganicField
                id={`${prefix}-formula-${f.id}-name`}
                required
                label={`ชื่อสูตรปุ๋ย ${i + 1}`}
                value={f.name}
                onChange={(e) => updateFormula(f.id, { name: e.target.value })}
                readOnly={readOnly}
                error={errors[`formula-${f.id}-name`]}
              />
              <OrganicField
                id={`${prefix}-formula-${f.id}-lot`}
                required
                label={`Lot การผลิต ${i + 1}`}
                value={f.lot}
                onChange={(e) => updateFormula(f.id, { lot: e.target.value })}
                readOnly={readOnly}
                error={errors[`formula-${f.id}-lot`]}
              />
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  className="self-end"
                  onClick={() =>
                    patch({
                      fertilizer: row.fertilizer.filter((x) => x.id !== f.id),
                    })
                  }
                  aria-label={`ลบสูตรปุ๋ย ${i + 1}`}
                >
                  ลบ
                </Button>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="ตารางตรวจสอบคุณภาพ"
        subtitle="ผลรายเวลาแยกอิสระทั้ง 16 หัวข้อ ไม่มีการอนุมานผลอนุมัติเอกสาร"
      >
        <OrganicInspectionTable
          row={row}
          onChange={onChange}
          errors={errors}
          print={print}
        />
      </SectionCard>
      <SectionCard
        title="คำนวณ TEST สูตรปุ๋ย"
        subtitle="ต้นฉบับใช้ชื่อ *_sum แต่คำนวณค่าเฉลี่ยจากค่าที่กรอกในเวลาที่เลือก ไม่ใช่ผลรวม; จำนวนครั้งคือจำนวนช่วงเวลาที่เลือก ไม่ได้ยืนยันว่าตรวจครบ"
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {row.fertilizer.map((f, i) => {
            const summary = calculation(row, f);
            return (
              <div
                key={f.id}
                className="min-w-0 space-y-4 rounded-lg border p-4"
                data-summary-id={f.id}
              >
                <h3 className="font-semibold">
                  สูตร {i + 1}: {f.name || "ยังไม่ระบุ"} ·{" "}
                  {f.lot || "ยังไม่ระบุ Lot"}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(["from_time", "to_time"] as const).map((key, j) =>
                    readOnly ? (
                      <p key={key}>
                        {j === 0 ? "ช่วงเวลาเริ่มต้น" : "ช่วงเวลาสิ้นสุด"}:{" "}
                        {f[key] || "—"}
                      </p>
                    ) : (
                      <SelectField
                        key={key}
                        label={j === 0 ? "ช่วงเวลาเริ่มต้น" : "ช่วงเวลาสิ้นสุด"}
                        value={f[key] || "unset"}
                        options={[
                          { value: "unset", label: "ยังไม่ระบุ" },
                          ...timeSlots.map((value) => ({
                            value,
                            label: value,
                          })),
                        ]}
                        onChange={(v) =>
                          updateFormula(f.id, { [key]: v === "unset" ? "" : v })
                        }
                      />
                    ),
                  )}
                </div>
                {errors[`formula-${f.id}-range`] && (
                  <p className="text-sm text-danger">
                    {errors[`formula-${f.id}-range`]}
                  </p>
                )}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    เวลาเพิ่มเติม (ไม่นับเวลาซ้ำ)
                  </legend>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {timeSlots.map((t) => (
                      <Label
                        key={t}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Checkbox
                          aria-label={`เวลาเพิ่มเติม สูตร ${i + 1} ${t}`}
                          checked={f.extra_times.includes(t)}
                          disabled={readOnly}
                          onCheckedChange={(v) =>
                            updateFormula(f.id, {
                              extra_times:
                                v === true
                                  ? [...f.extra_times, t]
                                  : f.extra_times.filter((x) => x !== t),
                            })
                          }
                        />
                        {t}
                      </Label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-muted-foreground">
                  ช่วงที่เลือก: {selectedTimes(f).join(", ") || "—"}
                </p>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      จำนวนครั้งที่ทดสอบปุ๋ย
                    </dt>
                    <dd>{summary.fertilizer_testing}</dd>
                  </div>
                  {summaryFields.map(([key, , label]) => (
                    <div key={key} data-summary-field={key}>
                      <dt className="text-xs text-muted-foreground">
                        {label} (เฉลี่ย)
                      </dt>
                      <dd>
                        {key === "dissolution_sum"
                          ? durationDisplay(summary[key])
                          : summary[key] === null
                            ? "—"
                            : summary[key]?.toFixed(2)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <OrganicField
                  id={`${prefix}-formula-${f.id}-volume_sum`}
                  label="ค่า volume_sum เพิ่มเติม (ไม่คำนวณ: ต้นฉบับเก็บค่าเดิม)"
                  value={f.volume_sum}
                  inputMode="decimal"
                  onChange={(e) =>
                    updateFormula(f.id, { volume_sum: e.target.value })
                  }
                  readOnly={readOnly}
                  error={errors[`formula-${f.id}-volume`]}
                />
              </div>
            );
          })}
        </div>
      </SectionCard>
      <SectionCard
        title="เวลาเดินเครื่องและการหยุดเครื่อง"
        action={
          !readOnly ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                patch({
                  stop_start: [
                    ...row.stop_start,
                    {
                      id: crypto.randomUUID(),
                      machine_stop_time: "",
                      machine_run_time: "",
                      machine_stop_reason: "",
                    },
                  ],
                })
              }
            >
              เพิ่มเวลาหยุดเครื่อง
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            ["machine_start_time", "work_start_time", "work_stop_time"] as const
          ).map(field)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          เวลาทำงาน{" "}
          {minutesBetween(row.work_start_time, row.work_stop_time) ?? "—"} นาที
          · รองรับช่วงเวลาข้ามเที่ยงคืน ไม่ใช่ยอดเวลาทำงานที่ยืนยันแล้ว
        </p>
        <div className="mt-4 space-y-3">
          {row.stop_start.map((s, i) => (
            <div
              key={s.id}
              className="space-y-2 rounded-lg border p-3"
              data-stop-id={s.id}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    ["machine_stop_time", "เวลาหยุดเครื่อง", "time"],
                    ["machine_run_time", "เวลาเดินเครื่องอีกครั้ง", "time"],
                    ["machine_stop_reason", "สาเหตุที่หยุดเครื่อง", "text"],
                  ] as const
                ).map(([key, label, type]) => (
                  <OrganicField
                    key={key}
                    id={`${prefix}-stop-${s.id}-${key}`}
                    label={`${label} ${i + 1}`}
                    type={type}
                    value={s[key]}
                    readOnly={readOnly}
                    onChange={(e) =>
                      patch({
                        stop_start: row.stop_start.map((x) =>
                          x.id === s.id ? { ...x, [key]: e.target.value } : x,
                        ),
                      })
                    }
                  />
                ))}
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-end"
                    onClick={() =>
                      patch({
                        stop_start: row.stop_start.filter((x) => x.id !== s.id),
                      })
                    }
                    aria-label={`ลบเวลาหยุดเครื่อง ${i + 1}`}
                  >
                    ลบ
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                ระยะเวลาหยุด{" "}
                {minutesBetween(s.machine_stop_time, s.machine_run_time) ?? "—"}{" "}
                นาที
              </p>
              {errors[`stop-${s.id}`] && (
                <p className="text-xs text-danger">{errors[`stop-${s.id}`]}</p>
              )}
            </div>
          ))}
          {!row.stop_start.length && (
            <p className="text-sm text-muted-foreground">
              ไม่มีรายการหยุดเครื่อง
            </p>
          )}
        </div>
      </SectionCard>
      <SectionCard
        title="หมายเหตุและผู้เกี่ยวข้อง"
        subtitle="ชื่อและวันที่เป็นข้อความสาธิต ไม่ใช่ลายมือชื่อหรือการอนุมัติจริง"
      >
        <div className="mb-4 grid gap-2">
          <Label htmlFor={`${prefix}-remark`}>หมายเหตุ</Label>
          {readOnly ? (
            <p className="whitespace-pre-wrap break-words">
              {row.remark || "—"}
            </p>
          ) : (
            <Textarea
              id={`${prefix}-remark`}
              value={row.remark}
              onChange={(e) => patch({ remark: e.target.value })}
            />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              "inspector",
              "inspector_date",
              "supervisor",
              "production",
              "production_date",
              "factory_qa",
            ] as const
          ).map(field)}
        </div>
      </SectionCard>
    </div>
  );
}
