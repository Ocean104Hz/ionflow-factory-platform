"use client";

import { Plus, Trash2 } from "lucide-react";
import { SectionCard, SelectField } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { requisitionMaterials } from "@/src/lib/mock-data/material-requisitions";
import {
  newMaterial,
  newWip,
  profiles,
  signerFields,
  summarize,
  units,
  wipSizes,
  wipQuantities,
  type Errors,
  type Requisition,
  type FactoryProfile,
} from "./material-requisition-domain";

export function MaterialRequisitionForm({
  row,
  errors,
  onChange,
  onProfileChange,
  onSave,
  onReset,
}: {
  row: Requisition;
  errors: Errors;
  onChange: (row: Requisition) => void;
  onProfileChange: (profile: FactoryProfile) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const patch = (value: Partial<Requisition>) => onChange({ ...row, ...value });
  const summary = summarize(row);
  const field = (
    id: string,
    label: string,
    value: string | number | null,
    change: (value: string) => void,
    type = "text",
    list?: string,
    errorKey = id,
  ) => (
    <div className="grid min-w-0 content-start gap-2" key={id}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        step={type === "number" ? "any" : undefined}
        list={list}
        value={value ?? ""}
        onChange={(e) => change(e.target.value)}
        aria-invalid={!!errors[errorKey]}
        aria-describedby={errors[errorKey] ? `${id}-error` : undefined}
      />
      {errors[errorKey] && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {errors[errorKey]}
        </p>
      )}
    </div>
  );
  const numeric = (value: string) => (value === "" ? null : Number(value));
  return (
    <form
      className="min-w-0 space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <p className="font-medium">กรุณาตรวจสอบข้อมูลก่อนบันทึก</p>
          <ul className="mt-2 list-inside list-disc">
            {[...new Set(Object.values(errors))].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <SectionCard
        title="ข้อมูลเอกสาร"
        subtitle="ข้อมูลตัวอย่างเท่านั้น · ช่องที่มี * จำเป็นต้องกรอก"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {row.id ? (
            <div className="grid content-start gap-2">
              <Label htmlFor="profile">โรงงาน</Label>
              <Input
                id="profile"
                value={profiles[row.profile].label}
                readOnly
              />
            </div>
          ) : (
            <SelectField
              label="โรงงาน *"
              value={row.profile}
              onChange={(v) => onProfileChange(v as FactoryProfile)}
              options={Object.entries(profiles).map(([value, p]) => ({
                value,
                label: `${p.label} · ${p.location}`,
              }))}
            />
          )}
          {field(
            "location",
            "สถานที่ *",
            row.location,
            (location) => patch({ location }),
            "text",
            "req-locations",
          )}
          {field(
            "date",
            "วันที่เอกสาร *",
            row.date,
            (date) => patch({ date }),
            "date",
          )}
          {field("doc_no", "เอกสารเลขที่ *", row.doc_no, (doc_no) =>
            patch({ doc_no }),
          )}
        </div>
        <datalist id="req-locations">
          <option value={profiles[row.profile].location} />
        </datalist>
        <p className="mt-3 text-xs text-muted-foreground">
          กรอกเลข ST ด้วยตนเอง เช่น ST-DEMO-007 · ระบบแสดงคำนำหน้า ST
          เพียงครั้งเดียว ไม่มีการจองเลขกลาง
        </p>
      </SectionCard>
      <SectionCard
        title="รายการเบิกวัสดุ/วัตถุดิบ"
        subtitle="ขนาดเป็น kg · กรอกได้เอง หรือเลือกวัสดุสมมติ โดยไม่ดึงข้อมูลจากคลังจริง"
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              patch({
                material_details: [
                  ...row.material_details,
                  newMaterial(crypto.randomUUID()),
                ],
              })
            }
          >
            <Plus />
            เพิ่มวัสดุ
          </Button>
        }
      >
        <div className="mb-4 max-w-sm">
          <SelectField
            label="เลือกวัสดุตัวอย่างเพื่อเพิ่มรายการ"
            value=""
            onChange={(id) => {
              const item = requisitionMaterials.find((r) => r.id === id);
              if (item)
                patch({
                  material_details: [
                    ...row.material_details,
                    {
                      ...newMaterial(crypto.randomUUID()),
                      m_item_name: item.name,
                      m_size: item.size,
                      m_unit: item.unit,
                    },
                  ],
                });
            }}
            options={requisitionMaterials.map((m) => ({
              value: m.id,
              label: m.name,
            }))}
          />
        </div>
        <Table className="min-w-[940px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">ชื่อรายการ</TableHead>
              <TableHead className="w-[140px]">ขนาด (kg)</TableHead>
              <TableHead className="w-[140px]">จำนวนเบิก</TableHead>
              <TableHead className="w-[140px]">หน่วยนับ</TableHead>
              <TableHead>หมายเหตุรายการ</TableHead>
              <TableHead className="w-16">ลบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.material_details.map((m, index) => {
              const update = (value: Partial<typeof m>) =>
                patch({
                  material_details: row.material_details.map((r) =>
                    r.id === m.id ? { ...r, ...value } : r,
                  ),
                });
              return (
                <TableRow key={m.id} data-row-id={m.id}>
                  <TableCell className="align-top">
                    {field(
                      `${m.id}-m_item_name`,
                      `ชื่อรายการวัสดุ ${index + 1}`,
                      m.m_item_name,
                      (m_item_name) => update({ m_item_name }),
                      "text",
                      undefined,
                      `${m.id}.name`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${m.id}-m_size`,
                      `ขนาดวัสดุ ${index + 1}`,
                      m.m_size,
                      (v) => update({ m_size: numeric(v) }),
                      "number",
                      undefined,
                      `${m.id}.size`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${m.id}-m_qty`,
                      `จำนวนวัสดุ ${index + 1}`,
                      m.m_qty,
                      (v) => update({ m_qty: numeric(v) }),
                      "number",
                      undefined,
                      `${m.id}.qty`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${m.id}-m_unit`,
                      `หน่วยวัสดุ ${index + 1}`,
                      m.m_unit,
                      (m_unit) => update({ m_unit }),
                      "text",
                      "req-units",
                      `${m.id}.unit`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${m.id}-m_desc`,
                      `หมายเหตุวัสดุ ${index + 1}`,
                      m.m_desc,
                      (m_desc) => update({ m_desc }),
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`ลบวัสดุ ${index + 1}`}
                      onClick={() =>
                        patch({
                          material_details: row.material_details.filter(
                            (r) => r.id !== m.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!row.material_details.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  ยังไม่มีรายการวัสดุ กดเพิ่มวัสดุเพื่อเริ่มต้น
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
      <SectionCard
        title="รายการเบิกวัตถุดิบ WIP"
        subtitle="วัตถุดิบระหว่างการผลิต · แยกจากรายการวัสดุด้านบน"
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              patch({
                wip_materials: [
                  ...row.wip_materials,
                  newWip(crypto.randomUUID()),
                ],
              })
            }
          >
            <Plus />
            เพิ่ม WIP
          </Button>
        }
      >
        <Table className="min-w-[940px] table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">ชื่อรายการ WIP</TableHead>
              <TableHead className="w-[140px]">ขนาด (kg)</TableHead>
              <TableHead className="w-[140px]">จำนวน</TableHead>
              <TableHead className="w-[140px]">หน่วยนับ</TableHead>
              <TableHead>หมายเหตุ</TableHead>
              <TableHead className="w-16">ลบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.wip_materials.map((w, index) => {
              const update = (value: Partial<typeof w>) =>
                patch({
                  wip_materials: row.wip_materials.map((r) =>
                    r.id === w.id ? { ...r, ...value } : r,
                  ),
                });
              return (
                <TableRow key={w.id} data-row-id={w.id}>
                  <TableCell className="align-top">
                    {field(
                      `${w.id}-w_item_name`,
                      `ชื่อรายการ WIP ${index + 1}`,
                      w.w_item_name,
                      (w_item_name) => update({ w_item_name }),
                      "text",
                      "req-wip-names",
                      `${w.id}.name`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${w.id}-w_size`,
                      `ขนาด WIP ${index + 1}`,
                      w.w_size,
                      (v) => update({ w_size: numeric(v) }),
                      "number",
                      "req-wip-sizes",
                      `${w.id}.size`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${w.id}-w_qty`,
                      `จำนวน WIP ${index + 1}`,
                      w.w_qty,
                      (v) => update({ w_qty: numeric(v) }),
                      "number",
                      "req-wip-quantities",
                      `${w.id}.qty`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${w.id}-w_unit`,
                      `หน่วย WIP ${index + 1}`,
                      w.w_unit,
                      (w_unit) => update({ w_unit }),
                      "text",
                      "req-units",
                      `${w.id}.unit`,
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {field(
                      `${w.id}-w_desc`,
                      `หมายเหตุ WIP ${index + 1}`,
                      w.w_desc,
                      (w_desc) => update({ w_desc }),
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`ลบ WIP ${index + 1}`}
                      onClick={() =>
                        patch({
                          wip_materials: row.wip_materials.filter(
                            (r) => r.id !== w.id,
                          ),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!row.wip_materials.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  ยังไม่มีรายการ WIP
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SectionCard>
      <datalist id="req-units">
        {units.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <datalist id="req-wip-names">
        {profiles[row.profile].wipNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="req-wip-sizes">
        {wipSizes.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="req-wip-quantities">
        {wipQuantities.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <SectionCard title="สรุปรายการเบิก">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["จำนวนรายการวัสดุ", summary.materials],
            ["จำนวนรายการ WIP", summary.wip],
            ["จำนวนรายการรวม", summary.total],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          จำนวนแยกตามหน่วย:{" "}
          {Object.entries(summary.quantities)
            .map(([u, q]) => `${q.toLocaleString("th-TH")} ${u}`)
            .join(" · ") || "—"}{" "}
          · ไม่ใช่รายการตัดสต็อก
        </p>
      </SectionCard>
      <SectionCard
        title="รายชื่อผู้ลงนาม"
        subtitle="ข้อความจำลอง ไม่ใช่ลายเซ็นดิจิทัลหรือการอนุมัติจริง · ไม่บังคับตามแบบต้นฉบับ"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {signerFields.map(([key, label]) =>
            field(key, label, row[key], (v) => patch({ [key]: v })),
          )}
        </div>
      </SectionCard>
      <div className="flex flex-wrap justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={onReset}>
          ยกเลิก
        </Button>
        <Button type="submit">บันทึกข้อมูลตัวอย่าง</Button>
      </div>
    </form>
  );
}
