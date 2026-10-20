"use client";
import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/src/components/ui/alert-dialog";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  SectionCard,
  SelectField,
  StatusBadge,
} from "@/src/components/factory/patterns";
import {
  packagingProfiles,
  packagingTimes,
  packagingUnits,
  type PackagingProfileId,
} from "./packaging-profiles";
import {
  newReport,
  newContext,
  newObservation,
  addSet,
  removeSet,
  removeContext,
  updateSet,
  validateReport,
  recordLabel,
  thaiDate,
  type PackagingReport,
  type PackagingSet,
} from "./packaging-domain";
import { usePackaging } from "./packaging-provider";

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {onChange ? (
        <Input
          id={id}
          type={type}
          inputMode={type === "text" ? "text" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">
          {type === "date" && value ? thaiDate(value) : value || "—"}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
function Pick({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      {onChange ? (
        <SelectField
          label={label}
          value={value || "empty"}
          onChange={(v) => onChange(v === "empty" ? "" : v)}
          options={options.some(o => o.value === "null") ? options : [{ value: "empty", label: "ยังไม่ระบุ" }, ...options]}
        />
      ) : (
        <Field
          label={label}
          value={options.find((o) => o.value === value)?.label || value}
        />
      )}{" "}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
const timeOptions = packagingTimes.map((value) => ({ value, label: value }));
export function PackagingSetContent({
  report,
  set,
  onChange,
  errors = {},
}: {
  report: PackagingReport;
  set: PackagingSet;
  onChange?: (s: PackagingSet) => void;
  errors?: Record<string, string>;
}) {
  const profile = packagingProfiles[report.profileId],
    base = `sets.${set.id}`;
  const [actionError, setActionError] = useState("");
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title={`SET ${set.setNo} · ข้อมูลการบรรจุ`}
        subtitle={
          profile.multiSet
            ? "ข้อมูลบรรจุหลักหนึ่งบริบทต่อ SET"
            : "เก็บสูตรและ Lot ของแต่ละบริบทแยกกัน ไม่รวมข้อมูลคนละสูตร"
        }
        action={
          !profile.multiSet && onChange ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...set,
                  contexts: [...set.contexts, newContext(crypto.randomUUID())],
                })
              }
            >
              <Plus />
              เพิ่มบริบทบรรจุ
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {set.contexts.map((c, i) => {
            const key = `${base}.contexts.${c.id}`;
            return (
              <div key={c.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">บริบท {i + 1}</h3>
                  {onChange && set.contexts.length > 1 && (
                    <ConfirmDialog
                      title="ลบบริบทการบรรจุ?"
                      description="บริบทที่มีผลตรวจอ้างอิงจะยังลบไม่ได้"
                      trigger={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`ลบบริบท ${i + 1}`}
                        >
                          <Trash2 />
                        </Button>
                      }
                      onConfirm={() => {
                        try {
                          const next = removeContext(report, set.id, c.id);
                          onChange(next.sets.find((s) => s.id === set.id)!);
                          setActionError("");
                        } catch (e) {
                          setActionError(
                            e instanceof Error ? e.message : "ลบไม่ได้",
                          );
                        }
                      }}
                    />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {(
                    [
                      ["fertilizerName", "สูตร / ผลิตภัณฑ์", "text"],
                      ["productionDate", "วันที่ผลิต / บรรจุ", "date"],
                      ["packageType", "ประเภทบรรจุภัณฑ์", "text"],
                      ["packageWeight", "น้ำหนักบรรจุที่ระบุ", "text"],
                      ["quantity", "จำนวนบรรจุ", "text"],
                      ["lotCode", "Lot No.", "text"],
                    ] as const
                  ).map(([field, label, type]) => (
                    <Field
                      key={field}
                      label={`${label} · บริบท ${i + 1}`}
                      type={type}
                      value={c[field]}
                      onChange={
                        onChange
                          ? (v) =>
                              onChange({
                                ...set,
                                contexts: set.contexts.map((x) =>
                                  x.id === c.id ? { ...x, [field]: v } : x,
                                ),
                              })
                          : undefined
                      }
                      error={errors[`${key}.${field}`]}
                    />
                  ))}
                  <Pick
                    label={`หน่วยน้ำหนัก · บริบท ${i + 1}`}
                    value={c.packageUnit}
                    options={packagingUnits.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={
                      onChange
                        ? (v) =>
                            onChange({
                              ...set,
                              contexts: set.contexts.map((x) =>
                                x.id === c.id ? { ...x, packageUnit: v } : x,
                              ),
                            })
                        : undefined
                    }
                    error={errors[`${key}.packageUnit`]}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {actionError && (
          <p role="alert" className="mt-3 text-danger">
            {actionError}
          </p>
        )}
      </SectionCard>
      <SectionCard
        title={`SET ${set.setNo} · ผลตรวจการบรรจุ`}
        subtitle="น้ำหนักตัวอย่างเป็น kg · ผ่าน/ไม่ผ่านเป็นผลรายช่อง ไม่ใช่อนุมัติรวม · ค่าละลายน้ำเก็บตัวเลขเดิม ไม่แปลงหน่วย"
        action={
          onChange ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...set,
                  inspections: [
                    ...set.inspections,
                    newObservation(
                      crypto.randomUUID(),
                      set.contexts[0]?.id || "",
                    ),
                  ],
                })
              }
            >
              <Plus />
              เพิ่มผลตรวจ
            </Button>
          ) : undefined
        }
      >
        {!set.inspections.length && (
          <p className="text-muted-foreground">ยังไม่มีผลตรวจ</p>
        )}
        <div className="space-y-4">
          {set.inspections.map((o, i) => {
            const key = `${base}.inspections.${o.id}`;
            const patch = (v: Partial<typeof o>) =>
              onChange?.({
                ...set,
                inspections: set.inspections.map((x) =>
                  x.id === o.id ? { ...x, ...v } : x,
                ),
              });
            return (
              <div key={o.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex justify-between gap-3">
                  <h3 className="font-medium">ผลตรวจ {i + 1}</h3>
                  {onChange && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`ลบผลตรวจ ${i + 1}`}
                      onClick={() =>
                        onChange({
                          ...set,
                          inspections: set.inspections.filter(
                            (x) => x.id !== o.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Pick
                    label={`สูตร / Lot ที่ตรวจ · แถว ${i + 1}`}
                    value={o.contextId}
                    options={set.contexts.map((c, n) => ({
                      value: c.id,
                      label: `${n + 1}. ${c.fertilizerName || "ยังไม่มีสูตร"} / ${c.lotCode || "ยังไม่มี Lot"}`,
                    }))}
                    onChange={
                      onChange ? (contextId) => patch({ contextId }) : undefined
                    }
                    error={errors[`${key}.contextId`]}
                  />
                  <Pick
                    label={`เวลาบรรจุ · แถว ${i + 1}`}
                    value={o.packingTime}
                    options={timeOptions}
                    onChange={
                      onChange
                        ? (packingTime) => patch({ packingTime })
                        : undefined
                    }
                    error={errors[`${key}.packingTime`]}
                  />
                  {(
                    [
                      ["bagWeight1", "น้ำหนักกระสอบ 1 (kg)"],
                      ["bagWeight2", "น้ำหนักกระสอบ 2 (kg)"],
                      ["moisture", "ความชื้น (%)"],
                      ["waterSolubility", "ค่าละลายน้ำ (legacy)"],
                      ["dust", "ฝุ่น (%)"],
                    ] as const
                  ).map(([field, label]) => (
                    <Field
                      key={field}
                      label={`${label} · แถว ${i + 1}`}
                      value={o[field]}
                      onChange={
                        onChange ? (v) => patch({ [field]: v }) : undefined
                      }
                      error={errors[`${key}.${field}`]}
                    />
                  ))}
                  {profile.hourlySampling && (
                    <Pick
                      label={`เวลาสุ่มตรวจรายชั่วโมง · แถว ${i + 1}`}
                      value={o.hourlySamplingTime}
                      options={timeOptions}
                      onChange={
                        onChange
                          ? (hourlySamplingTime) =>
                              patch({ hourlySamplingTime })
                          : undefined
                      }
                      error={errors[`${key}.hourlySamplingTime`]}
                    />
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["physicalCondition", "สภาพทางกายภาพ"],
                      ["bagCodeMarking", "การจดรหัสกระสอบ"],
                      ["bagSealing", "การปิด / เย็บกระสอบ"],
                    ] as const
                  ).map(([field, label]) => (
                    <Pick
                      key={field}
                      label={`${label} · แถว ${i + 1}`}
                      value={o[field] === null ? "null" : String(o[field])}
                      options={[
                        { value: "null", label: "ยังไม่ตรวจ" },
                        { value: "true", label: "ผ่าน" },
                        { value: "false", label: "ไม่ผ่าน" },
                      ]}
                      onChange={
                        onChange
                          ? (v) =>
                              patch({
                                [field]:
                                  v === "null" || !v ? null : v === "true",
                              })
                          : undefined
                      }
                      error={errors[`${key}.${field}`]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={`SET ${set.setNo} · Load Cell`}
          subtitle="บันทึกค่าที่อ่านได้ ไม่ตัดสินผลสอบเทียบอัตโนมัติ"
          action={
            onChange ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...set,
                    loadCells: [
                      ...set.loadCells,
                      { id: crypto.randomUUID(), time: "", weight: "" },
                    ],
                  })
                }
              >
                <Plus />
                เพิ่ม Load Cell
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {set.loadCells.map((l, i) => {
              const key = `${base}.loadCells.${l.id}`;
              return (
                <div key={l.id} className="space-y-2 border-b pb-3">
                  <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field
                      label={`เวลา Load Cell ${i + 1}`}
                      type="time"
                      value={l.time}
                      onChange={
                        onChange
                          ? (v) =>
                              onChange({
                                ...set,
                                loadCells: set.loadCells.map((x) =>
                                  x.id === l.id ? { ...x, time: v } : x,
                                ),
                              })
                          : undefined
                      }
                      error={errors[`${key}.time`]}
                    />
                    <Field
                      label={`น้ำหนัก Load Cell ${i + 1} (kg)`}
                      value={l.weight}
                      onChange={
                        onChange
                          ? (v) =>
                              onChange({
                                ...set,
                                loadCells: set.loadCells.map((x) =>
                                  x.id === l.id ? { ...x, weight: v } : x,
                                ),
                              })
                          : undefined
                      }
                      error={errors[`${key}.weight`]}
                    />
                    {onChange && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`ลบ Load Cell ${i + 1}`}
                        onClick={() =>
                          onChange({
                            ...set,
                            loadCells: set.loadCells.filter(
                              (x) => x.id !== l.id,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {errors[key] && (
                    <p role="alert" className="text-xs text-danger">
                      {errors[key]}
                    </p>
                  )}
                </div>
              );
            })}
            {!set.loadCells.length && (
              <p className="text-sm text-muted-foreground">
                ไม่มีข้อมูล Load Cell
              </p>
            )}
          </div>
        </SectionCard>
        <SectionCard
          title={`SET ${set.setNo} · เทียบเครื่องชั่ง Master`}
          subtitle="แนวทางเดิมตรวจทุก 4 ชั่วโมง ไม่ใช่กฎอนุมัติหรือเกณฑ์ PASS/FAIL"
          action={
            onChange ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...set,
                    comparisons: [
                      ...set.comparisons,
                      {
                        id: crypto.randomUUID(),
                        time: "",
                        qcWeight: "",
                        masterWeight: "",
                      },
                    ],
                  })
                }
              >
                <Plus />
                เพิ่มเทียบ Master
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            {set.comparisons.map((c, i) => {
              const key = `${base}.comparisons.${c.id}`;
              return (
                <div key={c.id} className="space-y-2 border-b pb-3">
                  <div className="grid items-end gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["time", "เวลาเทียบ", "time"],
                        ["qcWeight", "น้ำหนักเครื่อง QC (kg)", "text"],
                        ["masterWeight", "น้ำหนัก Master (kg)", "text"],
                      ] as const
                    ).map(([field, label, type]) => (
                      <Field
                        key={field}
                        label={`${label} ${i + 1}`}
                        value={c[field]}
                        type={type}
                        onChange={
                          onChange
                            ? (v) =>
                                onChange({
                                  ...set,
                                  comparisons: set.comparisons.map((x) =>
                                    x.id === c.id ? { ...x, [field]: v } : x,
                                  ),
                                })
                            : undefined
                        }
                        error={errors[`${key}.${field}`]}
                      />
                    ))}
                    {onChange && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onChange({
                            ...set,
                            comparisons: set.comparisons.filter(
                              (x) => x.id !== c.id,
                            ),
                          })
                        }
                      >
                        <Trash2 />
                        ลบการเทียบ {i + 1}
                      </Button>
                    )}
                  </div>
                  {errors[key] && (
                    <p role="alert" className="text-xs text-danger">
                      {errors[key]}
                    </p>
                  )}
                </div>
              );
            })}
            {!set.comparisons.length && (
              <p className="text-sm text-muted-foreground">
                ไม่มีข้อมูลเทียบ Master
              </p>
            )}
          </div>
        </SectionCard>
      </div>
      {profile.multiSet && (
        <SectionCard title={`หมายเหตุ SET ${set.setNo}`}>
          {onChange ? (
            <Textarea
              aria-label={`หมายเหตุ SET ${set.setNo}`}
              value={set.remarks}
              onChange={(e) => onChange({ ...set, remarks: e.target.value })}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">
              {set.remarks || "—"}
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
export function PackagingForm({
  report,
  onChange,
  onSaved,
}: {
  report: PackagingReport;
  onChange: (r: PackagingReport) => void;
  onSaved: (r: PackagingReport) => void;
}) {
  const { records, save } = usePackaging();
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState("");
  const [profileChange, setProfileChange] = useState<PackagingProfileId | null>(
    null,
  );
  const [active, setActive] = useState(report.sets[0].id);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const profile = packagingProfiles[report.profileId],
    activeId = report.sets.some((s) => s.id === active)
      ? active
      : report.sets[0].id;
  const patch = (v: Partial<PackagingReport>) => {
    setMessage("");
    onChange({ ...report, ...v });
  };
  function submit(status: PackagingReport["status"]) {
    const candidate = { ...report, status },
      e = validateReport(candidate, records);
    setErrors(e);
    if (Object.keys(e).length) {
      setMessage("กรุณาแก้ข้อมูลที่ระบุด้านบนก่อนบันทึก");
      return;
    }
    try {
      const saved = save(candidate);
      onSaved(saved);
      setMessage("บันทึกข้อมูลสาธิตแล้ว · ไม่เปลี่ยนสต็อก");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกไม่ได้");
    }
  }
  return (
    <form
      className="min-w-0 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(report.status);
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={report.status === "DRAFT" ? "neutral" : "info"}>
          {recordLabel(report)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Mock · ยังไม่มีการประเมินผลอนุมัติรวม
        </span>
      </div>
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <p className="font-medium">ข้อมูลที่ต้องแก้ไข (รวมทุก SET)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {Object.entries(errors).map(([key, value]) => (
              <li key={key}>
                {key.startsWith("sets.")
                  ? `SET ${report.sets.find((s) => s.id === key.split(".")[1])?.setNo ?? "—"}: `
                  : ""}
                {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SectionCard
        title="ข้อมูลเอกสาร"
        subtitle="กรอกข้อมูลที่จำเป็นก่อนบันทึกรายงาน · แบบร่างเก็บช่องว่างได้"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.id ? (
            <Field label="โรงงาน" value={profile.label} />
          ) : (
            <Pick
              label="โรงงาน"
              value={report.profileId}
              options={Object.entries(packagingProfiles).map(([value, p]) => ({
                value,
                label: p.label,
              }))}
              onChange={(v) => {
                if (v && v !== report.profileId)
                  setProfileChange(v as PackagingProfileId);
              }}
              error={errors.profileId}
            />
          )}
          <Field
            label="เลขที่เอกสาร"
            value={report.documentNumber}
            onChange={(documentNumber) => patch({ documentNumber })}
            error={errors.documentNumber}
          />
          <Field
            label="วันที่เอกสาร"
            type="date"
            value={report.documentDate}
            onChange={(documentDate) => patch({ documentDate })}
            error={errors.documentDate}
          />
          <Pick
            label="สถานที่บรรจุ"
            value={report.location}
            options={profile.locations.map((value) => ({
              value,
              label: value,
            }))}
            onChange={(location) => patch({ location })}
            error={errors.location}
          />
        </div>
      </SectionCard>
      {profile.multiSet && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={activeId}
            onValueChange={setActive}
            className="min-w-0 max-w-full overflow-x-auto"
          >
            <TabsList>
              {report.sets.map((s) => (
                <TabsTrigger key={s.id} value={s.id}>
                  SET {s.setNo}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const id = crypto.randomUUID();
                onChange(addSet(report, id));
                setActive(id);
              }}
            >
              <Plus />
              เพิ่ม SET
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={report.sets.length <= 1}
              onClick={() => setRemoveId(activeId)}
            >
              <Trash2 />
              ลบ SET
            </Button>
          </div>
        </div>
      )}
      {report.sets
        .filter((s) => s.id === activeId)
        .map((s) => (
          <PackagingSetContent
            key={s.id}
            report={report}
            set={s}
            errors={errors}
            onChange={(next) => onChange(updateSet(report, s.id, () => next))}
          />
        ))}
      <SectionCard
        title="ผู้ลงชื่อ"
        subtitle="ชื่อสาธิต ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์หรือการอนุมัติ"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.signers.map((s, i) => (
            <div key={s.role} className="space-y-3">
              <Field
                label={s.role}
                value={s.name}
                onChange={(name) =>
                  patch({
                    signers: report.signers.map((x, n) =>
                      i === n ? { ...x, name } : x,
                    ),
                  })
                }
              />
              {i === 0 && (
                <Field
                  label="วันที่ผู้ตรวจสอบ"
                  type="date"
                  value={s.date}
                  onChange={(date) =>
                    patch({
                      signers: report.signers.map((x, n) =>
                        i === n ? { ...x, date } : x,
                      ),
                    })
                  }
                  error={errors[`signers.${i}`]}
                />
              )}
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="หมายเหตุเอกสาร">
        <Textarea
          aria-label="หมายเหตุเอกสาร"
          value={report.remarks}
          onChange={(e) => patch({ remarks: e.target.value })}
        />
      </SectionCard>
      <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 rounded-lg border bg-card p-3 shadow-sm">
        <p role="status" className="mr-auto text-sm">
          {message}
        </p>
        {report.status === "DRAFT" && (
          <Button type="submit" variant="outline">
            บันทึกแบบร่าง
          </Button>
        )}
        <Button type="button" onClick={() => submit("RECORDED")}>
          {report.status === "DRAFT" ? "บันทึกรายงาน" : "บันทึกการแก้ไข"}
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
            <AlertDialogTitle>เริ่มแบบฟอร์มของอีกโรงงาน?</AlertDialogTitle>
            <AlertDialogDescription>
              ข้อมูลที่ยังไม่บันทึกทั้งหมดในแบบฟอร์มนี้จะถูกล้าง
              เพื่อไม่ย้ายสูตร/Lot, SET และผู้ลงชื่อไปผิดโรงงาน
              ไม่มีการบันทึกอัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (profileChange) {
                  const next = newReport(profileChange);
                  onChange(next);
                  setActive(next.sets[0].id);
                  setErrors({});
                }
                setProfileChange(null);
              }}
            >
              ยืนยันเริ่มแบบฟอร์มใหม่
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
            <AlertDialogTitle>ลบ SET นี้พร้อมข้อมูลภายใน?</AlertDialogTitle>
            <AlertDialogDescription>
              ผลตรวจ Load Cell, Master และหมายเหตุเฉพาะ SET นี้จะถูกลบ
              ไม่เปลี่ยน SET อื่น
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removeId) {
                  const next = removeSet(report, removeId);
                  onChange(next);
                  setActive(next.sets[0].id);
                }
                setRemoveId(null);
              }}
            >
              ยืนยันลบ SET
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
