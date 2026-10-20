"use client";
import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/src/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";
import {
  SectionCard,
  SelectField,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { qualityProfiles, type ProfileId } from "./production-quality-profiles";
import {
  averageFor,
  averageMetricIds,
  blankFormula,
  emptyReading,
  formatDuration,
  metrics,
  removeFormula,
  selectedSlots,
  statusLabel,
  timeSlots,
  validateInspection,
  warnings,
  type Inspection,
  type Slot,
} from "./production-quality-domain";
import { QualityMatrix } from "./production-quality-matrix";
import { useProductionQuality } from "./production-quality-provider";

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  error?: string;
  readOnly?: boolean;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={!!error}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
export function QualityCalculations({
  row,
  onChange,
  errors = {},
}: {
  row: Inspection;
  onChange?: (row: Inspection) => void;
  errors?: Record<string, string>;
}) {
  const options = [
    { value: "empty", label: "ยังไม่ระบุ" },
    ...timeSlots.map((value) => ({ value, label: value })),
  ];
  return (
    <SectionCard
      title="สรุปการทดสอบแยกสูตร"
      subtitle="เลือกช่วงเวลาของแต่ละสูตร · เวลาเพิ่มเติมไม่ถูกนับซ้ำ · การคำนวณไม่ใช่การอนุมัติคุณภาพ"
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {row.formulas.map((f) => {
          const slots = selectedSlots(f);
          const update = (patch: Partial<typeof f>) =>
            onChange?.({
              ...row,
              formulas: row.formulas.map((x) =>
                x.id === f.id ? { ...x, ...patch } : x,
              ),
            });
          return (
            <div key={f.id} className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium break-words">
                {f.formulaName || "สูตรยังไม่ระบุ"} ·{" "}
                {f.lotCode || "ยังไม่มี Lot"}
              </h3>
              {onChange ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label={`เริ่มช่วง ${f.formulaName || f.id}`}
                      value={f.startTime || "empty"}
                      options={options}
                      onChange={(v) =>
                        update({ startTime: v === "empty" ? "" : (v as Slot) })
                      }
                    />
                    <SelectField
                      label={`สิ้นสุดช่วง ${f.formulaName || f.id}`}
                      value={f.endTime || "empty"}
                      options={options}
                      onChange={(v) =>
                        update({ endTime: v === "empty" ? "" : (v as Slot) })
                      }
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        เวลาเพิ่มเติม ({f.extraSlots.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="max-h-80 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-3">
                        {timeSlots.map((slot) => (
                          <Label key={slot} className="flex items-center gap-2">
                            <Checkbox
                              checked={f.extraSlots.includes(slot)}
                              onCheckedChange={(checked) =>
                                update({
                                  extraSlots: checked
                                    ? [...f.extraSlots, slot]
                                    : f.extraSlots.filter((s) => s !== slot),
                                })
                              }
                            />
                            {slot}
                          </Label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  ช่วง {f.startTime || "—"} – {f.endTime || "—"} · เพิ่มเติม{" "}
                  {f.extraSlots.join(", ") || "—"}
                </p>
              )}
              {errors[`calculation.${f.id}`] && (
                <p role="alert" className="text-xs text-danger">
                  {errors[`calculation.${f.id}`]}
                </p>
              )}
              <p className="text-sm">
                ช่วงเวลาที่เลือก <strong>{slots.length}</strong> ครั้ง
              </p>
              <dl className="grid grid-cols-2 gap-3">
                {averageMetricIds.map((id) => {
                  const avg = averageFor(row, id, slots);
                  return (
                    <div key={id}>
                      <dt className="text-xs text-muted-foreground">
                        {metrics.find((m) => m.id === id)!.label}
                      </dt>
                      <dd className="mt-1 font-medium tabular-nums">
                        {id === "water_solubility"
                          ? formatDuration(avg)
                          : avg === null
                            ? "—"
                            : avg.toLocaleString("th-TH", {
                                maximumFractionDigits: 3,
                              })}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
export function QualityForm({
  row,
  onChange,
  onSaved,
}: {
  row: Inspection;
  onChange: (row: Inspection) => void;
  onSaved: (row: Inspection) => void;
}) {
  const { records, save } = useProductionQuality();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [profileChange, setProfileChange] = useState<ProfileId | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const patch = (value: Partial<Inspection>) => {
    setMessage("");
    onChange({ ...row, ...value });
  };
  function submit(status: Inspection["recordStatus"]) {
    const candidate = { ...row, recordStatus: status };
    const nextErrors = validateInspection(candidate, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาตรวจสอบข้อมูลที่ระบุด้านล่าง");
      return;
    }
    try {
      const saved = save(candidate);
      onSaved(saved);
      setMessage(
        `บันทึก${status === "DRAFT" ? "แบบร่าง" : "ผลตรวจ"}ใน demo session แล้ว`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  const notes = warnings(row);
  return (
    <form
      className="min-w-0 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(row.recordStatus);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={row.recordStatus === "DRAFT" ? "neutral" : "info"}>
          {statusLabel(row)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          ยังไม่มีการประเมินผลอนุมัติรวม · ไม่เปลี่ยนสต็อก
        </span>
      </div>
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <p className="font-medium">ข้อมูลที่ต้องแก้ไขก่อนบันทึก</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {Object.entries(errors).map(([key, error]) => {
              const [metricId, slot] = key.split(".");
              const metric = metrics.find((m) => m.id === metricId);
              return (
                <li key={key}>
                  {metric ? `${metric.label} ${slot}: ` : ""}
                  {error}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <SectionCard
        title="ข้อมูลเอกสาร"
        subtitle="ช่อง * จำเป็นเมื่อบันทึกผลตรวจ · แบบร่างเก็บข้อมูลที่ยังไม่ครบได้"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            {row.id ? (
              <Field
                label="โรงงาน * (เอกสารที่บันทึกแล้วเปลี่ยนไม่ได้)"
                value={qualityProfiles[row.profileId].label}
                readOnly
              />
            ) : (
              <SelectField
                label="โรงงาน *"
                value={row.profileId}
                options={Object.entries(qualityProfiles).map(([value, p]) => ({
                  value,
                  label: p.label,
                }))}
                onChange={(v) => {
                  if (v !== row.profileId) setProfileChange(v as ProfileId);
                }}
              />
            )}
            {errors.profileId && (
              <p className="text-danger">{errors.profileId}</p>
            )}
          </div>
          <Field
            label="วันที่ตรวจสอบ *"
            type="date"
            value={row.inspectionDate}
            onChange={(inspectionDate) => patch({ inspectionDate })}
            error={errors.inspectionDate}
          />
          <Field
            label="เลขที่เอกสาร *"
            value={row.documentNumber}
            onChange={(documentNumber) => patch({ documentNumber })}
            error={errors.documentNumber}
          />
          <Field
            label="สถานที่ผลิต *"
            value={row.productionSite}
            onChange={(productionSite) => patch({ productionSite })}
            error={errors.productionSite}
          />
          <div className="space-y-2">
            <SelectField
              label="สายการผลิต *"
              value={row.productionLine || "empty"}
              options={[
                { value: "empty", label: "เลือกสายการผลิต" },
                ...qualityProfiles[row.profileId].lines.map((value) => ({
                  value,
                  label: value,
                })),
              ]}
              onChange={(v) =>
                patch({ productionLine: v === "empty" ? "" : v })
              }
            />
            {errors.productionLine && (
              <p role="alert" className="text-xs text-danger">
                {errors.productionLine}
              </p>
            )}
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title="สูตรปุ๋ยและ Lot"
        subtitle="ข้อมูลอ้างอิงภายในเอกสาร ไม่ใช่การเชื่อม BOM หรือ Inventory"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                formulas: [...row.formulas, blankFormula(crypto.randomUUID())],
              })
            }
          >
            <Plus />
            เพิ่มสูตร
          </Button>
        }
      >
        {errors.formulas && (
          <p role="alert" className="mb-3 text-danger">
            {errors.formulas}
          </p>
        )}
        <div className="space-y-4">
          {row.formulas.map((f, i) => (
            <div
              key={f.id}
              className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Field
                label={`สูตร / ผลิตภัณฑ์ ${i + 1}`}
                value={f.formulaName}
                onChange={(formulaName) =>
                  patch({
                    formulas: row.formulas.map((x) =>
                      x.id === f.id ? { ...x, formulaName } : x,
                    ),
                  })
                }
                error={errors[`formula.${f.id}`]}
              />
              <Field
                label={`Lot ${i + 1}`}
                value={f.lotCode}
                onChange={(lotCode) =>
                  patch({
                    formulas: row.formulas.map((x) =>
                      x.id === f.id ? { ...x, lotCode } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`ลบสูตร ${i + 1}`}
                onClick={() => setRemoveId(f.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
      <QualityMatrix row={row} onChange={onChange} errors={errors} />
      {notes.length > 0 && (
        <div className="space-y-1 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          <p className="font-medium">ข้อควรตรวจสอบ (ไม่ใช่เกณฑ์อนุมัติ)</p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      <SectionCard
        title="เวลาเครื่องจักร"
        subtitle="รองรับการทำงานข้ามเที่ยงคืน ภายในวันผลิตเดียว · ไม่คำนวณเวลาหยุดรวมโดยไม่มีข้อกำหนด"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["machineStart", "เวลาเปิดเครื่อง"],
              ["workStart", "เวลาเริ่มงาน"],
              ["workStop", "เวลาหยุดงาน"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              type="time"
              value={row[key]}
              onChange={(v) => patch({ [key]: v })}
              error={errors[key]}
            />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {row.stops.map((s, i) => (
            <div
              key={s.id}
              className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_2fr_auto]"
            >
              {(
                [
                  ["stop", "เวลาหยุด"],
                  ["restart", "เริ่มใหม่"],
                  ["reason", "เหตุผล"],
                ] as const
              ).map(([key, label]) => (
                <Field
                  key={key}
                  label={`${label} ${i + 1}`}
                  type={key === "reason" ? "text" : "time"}
                  value={s[key]}
                  onChange={(v) =>
                    patch({
                      stops: row.stops.map((x) =>
                        x.id === s.id ? { ...x, [key]: v } : x,
                      ),
                    })
                  }
                  error={key === "reason" ? errors[`stop.${s.id}`] : undefined}
                />
              ))}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`ลบช่วงหยุด ${i + 1}`}
                onClick={() =>
                  patch({ stops: row.stops.filter((x) => x.id !== s.id) })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {errors.stops && (
            <p role="alert" className="text-danger">
              {errors.stops}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                stops: [
                  ...row.stops,
                  {
                    id: crypto.randomUUID(),
                    stop: "",
                    restart: "",
                    reason: "",
                  },
                ],
              })
            }
          >
            <Plus />
            เพิ่มช่วงหยุดเครื่อง
          </Button>
        </div>
      </SectionCard>
      <QualityCalculations row={row} onChange={onChange} errors={errors} />
      <SectionCard
        title="ข้อมูลผู้ลงชื่อ"
        subtitle="ข้อมูลสาธิต ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ และไม่ใช่การอนุมัติ"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {row.signers.map((s, i) => (
            <div key={s.role} className="space-y-3">
              <Field
                label={s.role}
                value={s.name}
                onChange={(name) =>
                  patch({
                    signers: row.signers.map((x, n) =>
                      n === i ? { ...x, name } : x,
                    ),
                  })
                }
              />
              {(i === 0 || i === 2) && (
                <Field
                  label={`วันที่ ${s.role}`}
                  type="date"
                  value={s.date}
                  onChange={(date) =>
                    patch({
                      signers: row.signers.map((x, n) =>
                        n === i ? { ...x, date } : x,
                      ),
                    })
                  }
                  error={errors[`signer.${i}`]}
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="หมายเหตุ">
        <Label htmlFor="quality-notes">หมายเหตุเอกสาร</Label>
        <Textarea
          id="quality-notes"
          className="mt-2"
          value={row.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </SectionCard>
      <div className="sticky bottom-0 z-30 flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card p-3 shadow-sm">
        <p role="status" className="mr-auto max-w-xl text-sm">
          {message}
        </p>
        {row.recordStatus === "DRAFT" && (
          <Button type="submit" variant="outline">
            บันทึกแบบร่าง
          </Button>
        )}
        <Button type="button" onClick={() => submit("RECORDED")}>
          {row.recordStatus === "RECORDED" ? "บันทึกการแก้ไข" : "บันทึกผลตรวจ"}
        </Button>
      </div>
      <AlertDialog
        open={profileChange !== null}
        onOpenChange={(open) => {
          if (!open) setProfileChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>เปลี่ยนโรงงานของแบบฟอร์ม?</AlertDialogTitle>
            <AlertDialogDescription>
              ล้างสายการผลิตและค่าฝุ่นเดิมที่ไม่เข้ากับโปรไฟล์ใหม่ ข้อมูลตัวเลข
              อุณหภูมิ สูตรและ Lot ยังคงอยู่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (profileChange) {
                  const dust = Object.fromEntries(
                    Object.entries(row.readings.dust_environment ?? {}).map(
                      ([slot, r]) => [
                        slot,
                        {
                          ...emptyReading(
                            metrics.find((m) => m.id === "dust_environment")!,
                          ),
                          note: r.note,
                        },
                      ],
                    ),
                  );
                  patch({
                    profileId: profileChange,
                    productionLine: "",
                    readings: { ...row.readings, dust_environment: dust },
                  });
                }
                setProfileChange(null);
              }}
            >
              ยืนยันเปลี่ยนโรงงาน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบสูตรและช่วงคำนวณของสูตรนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              ค่าตรวจวัดและสูตรอื่นจะไม่ถูกเปลี่ยน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeId) onChange(removeFormula(row, removeId));
                setRemoveId(null);
              }}
            >
              ยืนยันลบสูตร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
