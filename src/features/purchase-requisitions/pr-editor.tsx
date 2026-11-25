"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import {
  PageHeader,
  SectionCard,
  SelectField,
} from "@/src/components/factory/patterns";
import { usePR } from "./pr-provider";
import {
  newPR,
  newPRItem,
  priorityLabel,
  validatePR,
  type PR,
  type PRItem,
} from "./pr-domain";
import { PRTotals, money } from "./pr-components";
import { lineAmounts } from "./pr-domain";
import { MasterSelect } from "@/src/features/master-data/master-select";
import { useMasterData } from "@/src/features/master-data/master-provider";

export function PREditor({
  original,
  onSaved,
  onCancel,
}: {
  original?: PR;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { create, save, user } = usePR();
  const masters = useMasterData();
  const materials = masters.state.rows.filter((row) => row.kind === "materials" && row.active);
  const [form, setForm] = useState<PR>(() =>
    original ? structuredClone(original) : {
      ...newPR(), requester: user.displayName,
      masterRefs: { requester: { id: user.id, code: user.id, kind: "personnel", name: user.displayName, value: user.displayName } },
    },
  );
  const [error, setError] = useState("");
  const embedded = Boolean(onSaved);
  const update = <K extends keyof PR>(key: K, value: PR[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (id: string, patch: Partial<PRItem>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  const [saving, setSaving] = useState(false);
  async function persist(submit: boolean) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const issue = validatePR(form, submit);
      if (issue) throw new Error(issue);
      if (original) {
        await save(form, submit);
        if (onSaved) onSaved(original.id);
        else router.push(`/pr/${original.id}`);
      } else {
        const id = await create(form, submit);
        if (onSaved) onSaved(id);
        else router.push(`/pr/${id}`);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  if (original && !["draft", "rejected"].includes(original.status))
    return <p role="alert">เอกสารนี้ไม่อนุญาตให้แก้ไข</p>;
  return (
    <div
      className={
        embedded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "space-y-5"
      }
    >
      {!embedded && (
        <PageHeader
          title={original ? `แก้ไข ${original.number}` : "สร้างใบขอซื้อ (PR)"}
          description="ฉบับร่างกรอกไม่ครบได้ แต่จำนวนและราคาต้องถูกต้อง"
          parent={{ title: "ใบขอซื้อ", href: "/pr" }}
        />
      )}
      <div
        className={
          embedded
            ? "min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto pr-1 pb-5"
            : "space-y-5"
        }
      >
      <SectionCard
        title="ข้อมูลหัวเอกสาร"
        subtitle={
          embedded
            ? "ฉบับร่างกรอกไม่ครบได้ แต่จำนวนและราคาต้องถูกต้อง"
            : undefined
        }
        contentClassName={embedded ? "min-w-0" : undefined}
      >
        <div
          className={
            embedded
              ? "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          <div className="grid gap-2">
            <Label htmlFor="pr-date">วันที่เอกสาร *</Label>
            <Input
              id="pr-date"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pr-requester">ผู้ขอซื้อ</Label>
            <Input id="pr-requester" value={form.requester} readOnly />
          </div>
          <MasterSelect kind="departments" label="ฝ่าย/แผนก *" value={form.department}
            onChange={(department) => update("department", department)} />
          <MasterSelect
            kind="warehouses"
            code
            reference={form.masterRefs?.warehouse}
            label="คลัง / Site *"
            value={form.warehouseCode}
            onChange={(value, ref) => {
              setForm((current) => ({
                ...current,
                warehouseCode: value,
                warehouseName: ref?.name ?? "",
                masterRefs: ref
                  ? { ...current.masterRefs, warehouse: ref }
                  : current.masterRefs,
              }));
            }}
          />
          <SelectField
            label="ประเภทคำขอ *"
            value={form.category || "none"}
            onChange={(value) =>
              update("category", value === "none" ? "" : value)
            }
            options={[
              { value: "none", label: "เลือกประเภท" },
              ...["วัตถุดิบ", "วัสดุ", "ซ่อมบำรุง"].map((value) => ({
                value,
                label: value,
              })),
            ]}
          />
          <div className="grid gap-2">
            <Label htmlFor="pr-needed">วันที่ต้องการใช้ *</Label>
            <Input
              id="pr-needed"
              type="date"
              min={form.date}
              value={form.neededDate}
              onChange={(event) => update("neededDate", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pr-reference">เลขที่อ้างอิง</Label>
            <Input
              id="pr-reference"
              value={form.referenceNo}
              onChange={(event) => update("referenceNo", event.target.value)}
            />
          </div>
          <MasterSelect
            kind="personnel"
            reference={form.masterRefs?.approver}
            filter={(id) =>
              masters.state.personnel.some(
                (p) =>
                  p.id === id &&
                  p.role === "ผู้ดูแลโรงงาน",
              )
            }
            label="ผู้อนุมัติที่กำหนด *"
            value={form.approver}
            onChange={(value, ref) =>
              setForm((current) => ({
                ...current,
                approver: value,
                masterRefs: ref
                  ? { ...current.masterRefs, approver: ref }
                  : current.masterRefs,
              }))
            }
          />
          <SelectField
            label="ความเร่งด่วน"
            value={form.priority}
            onChange={(value) => update("priority", value as PR["priority"])}
            options={Object.entries(priorityLabel).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <SelectField
            label="ประเภทธุรกรรม"
            value={form.transactionType}
            onChange={(value) =>
              update("transactionType", value as PR["transactionType"])
            }
            options={[
              { value: "Non-VAT", label: "Non-VAT" },
              { value: "VAT", label: "VAT · 7% เพิ่มจากราคาก่อนภาษี" },
            ]}
          />
          <div
            className={
              embedded
                ? "grid min-w-0 gap-2 sm:col-span-2"
                : "grid gap-2 md:col-span-2"
            }
          >
            <Label htmlFor="pr-purpose">วัตถุประสงค์ *</Label>
            <Textarea
              id="pr-purpose"
              value={form.purpose}
              onChange={(event) => update("purpose", event.target.value)}
            />
          </div>
          <div
            className={
              embedded
                ? "grid min-w-0 gap-2 sm:col-span-2"
                : "grid gap-2 md:col-span-2"
            }
          >
            <Label htmlFor="pr-remarks">หมายเหตุ</Label>
            <Textarea
              id="pr-remarks"
              value={form.remarks}
              onChange={(event) => update("remarks", event.target.value)}
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          * จำเป็นเมื่อส่งอนุมัติ · ตัวเลือกอ้างอิงข้อมูลหลักในตั้งค่าระบบ
        </p>
      </SectionCard>
      <SectionCard
        title="รายการสินค้า/วัตถุดิบ"
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={form.items.length >= 100}
            onClick={() =>
              update("items", [...form.items, newPRItem(crypto.randomUUID())])
            }
          >
            เพิ่มรายการ
          </Button>
        }
      >
        <div className="space-y-4">
          {form.items.map((item, index) => (
            <section
              key={item.id}
              className={
                embedded
                  ? "min-w-0 space-y-4 rounded-xl border bg-muted/10 p-4 sm:p-5"
                  : "space-y-3 rounded-lg border p-4"
              }
            >
              <div className="flex items-center justify-between gap-3">
                {embedded ? (
                  <div>
                    <p className="text-xs text-muted-foreground">รายการขอซื้อ</p>
                    <h3 className="font-semibold">ลำดับที่ {index + 1}</h3>
                  </div>
                ) : (
                  <h3 className="text-sm font-semibold">รายการ {index + 1}</h3>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`ลบรายการ ${index + 1}`}
                  disabled={form.items.length === 1}
                  onClick={() =>
                    update(
                      "items",
                      form.items.filter((row) => row.id !== item.id),
                    )
                  }
                >
                  ลบ
                </Button>
              </div>
              <div
                className={
                  embedded
                    ? "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                    : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                }
              >
                <SelectField
                  label={`สินค้า รายการ ${index + 1} *`}
                  value={item.code || "none"}
                  onChange={(value) => {
                    const row = materials.find((material) => material.code === value);
                    const unit = masters.state.rows.find((master) => master.id === row?.typeId && master.active);
                    setForm((current) => {
                      const refs = { ...current.masterRefs };
                      const key = `material:${item.id}`;
                      if (row) refs[key] = { id: row.id, kind: row.kind, code: row.code, name: row.name, value: row.code };
                      else delete refs[key];
                      return {
                        ...current, masterRefs: refs,
                        items: current.items.map((line) => line.id === item.id
                          ? { ...line, code: row?.code ?? "", name: row?.name ?? "", unit: unit?.name ?? "" }
                          : line),
                      };
                    });
                  }}
                  options={[
                    { value: "none", label: "เลือกสินค้า" },
                    ...materials.map((row) => ({
                      value: row.code,
                      label: `${row.code} · ${row.name}`,
                    })),
                  ]}
                />
                <MasterSelect
                  kind="suppliers"
                  code
                  reference={form.masterRefs?.[`supplier:${item.id}`]}
                  label={`ผู้ขาย รายการ ${index + 1}`}
                  value={item.supplierCode}
                  onChange={(value, ref) => {
                    setForm((current) => ({
                      ...current,
                      items: current.items.map((r) =>
                        r.id === item.id
                          ? {
                              ...r,
                              supplierCode: value,
                              supplierName: ref?.name ?? "",
                            }
                          : r,
                      ),
                      masterRefs: ref
                        ? {
                            ...current.masterRefs,
                            [`supplier:${item.id}`]: ref,
                          }
                        : current.masterRefs,
                    }));
                  }}
                />
                <MasterSelect
                  kind="units"
                  label={`หน่วย รายการ ${index + 1}`}
                  value={item.unit}
                  reference={form.masterRefs?.[`unit:${item.id}`]}
                  filter={(id) => {
                    return materials.find((row) => row.code === item.code)?.typeId === id;
                  }}
                  onChange={(unit, ref) =>
                    setForm((current) => ({
                      ...current,
                      items: current.items.map((r) =>
                        r.id === item.id ? { ...r, unit } : r,
                      ),
                      masterRefs: ref
                        ? { ...current.masterRefs, [`unit:${item.id}`]: ref }
                        : current.masterRefs,
                    }))
                  }
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-quantity`}>
                    จำนวน รายการ {index + 1} *
                  </Label>
                  <Input
                    id={`${item.id}-quantity`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    className={embedded ? "text-right tabular-nums" : undefined}
                    value={Number.isFinite(item.quantity) ? item.quantity : ""}
                    onChange={(event) =>
                      updateItem(item.id, {
                        quantity:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-price`}>
                    ราคา/หน่วย รายการ {index + 1}
                  </Label>
                  <Input
                    id={`${item.id}-price`}
                    type="number"
                    min="0"
                    step="0.01"
                    className={embedded ? "text-right tabular-nums" : undefined}
                    value={item.price ?? ""}
                    onChange={(event) =>
                      updateItem(item.id, {
                        price:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-spec`}>
                    สเปก รายการ {index + 1}
                  </Label>
                  <Input
                    id={`${item.id}-spec`}
                    value={item.specification}
                    onChange={(event) =>
                      updateItem(item.id, { specification: event.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={`${item.id}-remarks`}>
                    หมายเหตุ รายการ {index + 1}
                  </Label>
                  <Input
                    id={`${item.id}-remarks`}
                    value={item.remarks}
                    onChange={(event) =>
                      updateItem(item.id, { remarks: event.target.value })
                    }
                  />
                </div>
              </div>
              {embedded ? (
                <dl className="grid gap-2 rounded-lg border bg-background p-3 text-sm sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <dt className="text-xs text-muted-foreground">ก่อนภาษี</dt>
                  <dd className="font-medium tabular-nums">
                    {money(lineAmounts(item, form.transactionType)?.subtotal)} บาท
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                  <dt className="text-xs text-muted-foreground">ภาษี</dt>
                  <dd className="font-medium tabular-nums">
                    {money(lineAmounts(item, form.transactionType)?.tax)} บาท
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t pt-2 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                  <dt className="text-xs text-muted-foreground">รวม</dt>
                  <dd className="font-semibold tabular-nums">
                    {money(lineAmounts(item, form.transactionType)?.total)} บาท
                  </dd>
                </div>
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">
                  ก่อนภาษี{" "}
                  {money(lineAmounts(item, form.transactionType)?.subtotal)} ·
                  ภาษี {money(lineAmounts(item, form.transactionType)?.tax)} · รวม{" "}
                  {money(lineAmounts(item, form.transactionType)?.total)} บาท
                </p>
              )}
            </section>
          ))}
        </div>
        <PRTotals pr={form} />
      </SectionCard>
      </div>
      {error && (
        <p
          role="alert"
          className={embedded ? "shrink-0 py-2 text-sm text-danger" : "text-sm text-danger"}
        >
          {error}
        </p>
      )}
      <div
        className={
          embedded
            ? "flex shrink-0 flex-col-reverse gap-2 border-t bg-background pt-4 sm:flex-row sm:justify-end"
            : "flex flex-wrap justify-end gap-2"
        }
      >
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onCancel
              ? onCancel()
              : router.push(original ? `/pr/${original.id}` : "/pr")
          }
        >
          กลับโดยไม่บันทึก
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => void persist(false)}>
          บันทึกฉบับร่าง
        </Button>
        <Button type="button" disabled={saving} onClick={() => void persist(true)}>
          ส่งอนุมัติ
        </Button>
      </div>
    </div>
  );
}
