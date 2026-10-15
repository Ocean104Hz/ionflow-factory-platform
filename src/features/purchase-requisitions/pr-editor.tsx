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
  materialItem,
  newPR,
  newPRItem,
  prMaterials,
  priorityLabel,
  prSuppliers,
  prUsers,
  prWarehouses,
  validatePR,
  type PR,
  type PRItem,
} from "./pr-domain";
import { PRTotals, money } from "./pr-components";
import { lineAmounts } from "./pr-domain";

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
  const { create, save } = usePR();
  const [form, setForm] = useState<PR>(() =>
    original ? structuredClone(original) : newPR(),
  );
  const [error, setError] = useState("");
  const update = <K extends keyof PR>(key: K, value: PR[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const updateItem = (id: string, patch: Partial<PRItem>) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  function persist(submit: boolean) {
    try {
      const issue = validatePR(form, submit);
      if (issue) throw new Error(issue);
      if (original) {
        save(form, submit);
        if (onSaved) onSaved(original.id);
        else router.push(`/pr/${original.id}`);
      } else {
        const id = create(form, submit);
        if (onSaved) onSaved(id);
        else router.push(`/pr/${id}`);
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "บันทึกไม่สำเร็จ");
    }
  }
  if (original && !["draft", "rejected"].includes(original.status))
    return <p role="alert">เอกสารนี้ไม่อนุญาตให้แก้ไข</p>;
  return (
    <div className="space-y-5">
      <PageHeader
        title={original ? `แก้ไข ${original.number}` : "สร้างใบขอซื้อ (PR)"}
        description="ข้อมูลสาธิต · ฉบับร่างกรอกไม่ครบได้ แต่จำนวนและราคาต้องถูกต้อง"
        parent={onSaved ? undefined : { title: "ใบขอซื้อ", href: "/pr" }}
      />
      <SectionCard title="ข้อมูลหัวเอกสาร">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="pr-date">วันที่เอกสาร *</Label>
            <Input
              id="pr-date"
              type="date"
              value={form.date}
              onChange={(event) => update("date", event.target.value)}
            />
          </div>
          <SelectField
            label="ผู้ขอซื้อ *"
            value={form.requester || "none"}
            onChange={(value) => {
              const user = prUsers.find((row) => row.name === value);
              setForm((current) => ({
                ...current,
                requester: user?.name ?? "",
                department: user?.department ?? "",
              }));
            }}
            options={[
              { value: "none", label: "เลือกผู้ขอซื้อ" },
              ...prUsers.map((user) => ({
                value: user.name,
                label: user.name,
              })),
            ]}
          />
          <div className="grid gap-2">
            <Label htmlFor="pr-department">ฝ่าย/แผนก</Label>
            <Input id="pr-department" readOnly value={form.department} />
          </div>
          <SelectField
            label="คลัง / Site *"
            value={form.warehouseCode || "none"}
            onChange={(value) => {
              const warehouse = prWarehouses.find((row) => row.code === value);
              setForm((current) => ({
                ...current,
                warehouseCode: warehouse?.code ?? "",
                warehouseName: warehouse?.name ?? "",
              }));
            }}
            options={[
              { value: "none", label: "เลือกคลัง" },
              ...prWarehouses.map((row) => ({
                value: row.code,
                label: `${row.code} · ${row.name}`,
              })),
            ]}
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
          <SelectField
            label="ผู้อนุมัติที่กำหนด *"
            value={form.approver || "none"}
            onChange={(value) =>
              update("approver", value === "none" ? "" : value)
            }
            options={[
              { value: "none", label: "เลือกผู้อนุมัติ" },
              ...prUsers
                .slice(2)
                .map((user) => ({ value: user.name, label: user.name })),
            ]}
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
              { value: "VAT", label: "VAT · สาธิต 7% เพิ่มจากราคาก่อนภาษี" },
            ]}
          />
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="pr-purpose">วัตถุประสงค์ *</Label>
            <Textarea
              id="pr-purpose"
              value={form.purpose}
              onChange={(event) => update("purpose", event.target.value)}
            />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="pr-remarks">หมายเหตุ</Label>
            <Textarea
              id="pr-remarks"
              value={form.remarks}
              onChange={(event) => update("remarks", event.target.value)}
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          * จำเป็นเมื่อส่งอนุมัติ · ตัวเลือกทั้งหมดเป็นข้อมูลหลักสาธิต
        </p>
      </SectionCard>
      <SectionCard
        title="รายการสินค้า/วัตถุดิบ"
        action={
          <Button
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
            <section key={item.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">รายการ {index + 1}</h3>
                <Button
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SelectField
                  label={`สินค้า รายการ ${index + 1} *`}
                  value={item.code || "none"}
                  onChange={(value) => {
                    const selected =
                      value === "none"
                        ? newPRItem(item.id)
                        : materialItem(value, item.id);
                    updateItem(item.id, {
                      ...selected,
                      quantity: item.quantity,
                      remarks: item.remarks,
                    });
                  }}
                  options={[
                    { value: "none", label: "เลือกสินค้า" },
                    ...prMaterials.map((row) => ({
                      value: row.code,
                      label: `${row.code} · ${row.name}`,
                    })),
                  ]}
                />
                <SelectField
                  label={`ผู้ขาย รายการ ${index + 1}`}
                  value={item.supplierCode || "none"}
                  onChange={(value) => {
                    const supplier = prSuppliers.find(
                      (row) => row.code === value,
                    );
                    updateItem(item.id, {
                      supplierCode: supplier?.code ?? "",
                      supplierName: supplier?.name ?? "",
                    });
                  }}
                  options={[
                    { value: "none", label: "ยังไม่ระบุผู้ขาย" },
                    ...prSuppliers.map((row) => ({
                      value: row.code,
                      label: `${row.code} · ${row.name}`,
                    })),
                  ]}
                />
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-unit`}>
                    หน่วย รายการ {index + 1}
                  </Label>
                  <Input id={`${item.id}-unit`} value={item.unit} readOnly />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${item.id}-quantity`}>
                    จำนวน รายการ {index + 1} *
                  </Label>
                  <Input
                    id={`${item.id}-quantity`}
                    type="number"
                    min="0.0001"
                    step="0.0001"
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
              <p className="text-xs text-muted-foreground">
                ก่อนภาษี{" "}
                {money(lineAmounts(item, form.transactionType)?.subtotal)} ·
                ภาษี {money(lineAmounts(item, form.transactionType)?.tax)} · รวม{" "}
                {money(lineAmounts(item, form.transactionType)?.total)} บาท
              </p>
            </section>
          ))}
        </div>
        <PRTotals pr={form} />
      </SectionCard>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() =>
            onCancel
              ? onCancel()
              : router.push(original ? `/pr/${original.id}` : "/pr")
          }
        >
          กลับโดยไม่บันทึก
        </Button>
        <Button variant="outline" onClick={() => persist(false)}>
          บันทึกฉบับร่าง
        </Button>
        <Button onClick={() => persist(true)}>ส่งอนุมัติ</Button>
      </div>
    </div>
  );
}
