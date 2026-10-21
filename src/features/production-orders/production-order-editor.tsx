"use client";
import { useState } from "react";
import type { ProductionOrder, OrderItem } from "@/src/lib/mock-data";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { SectionCard, SelectField } from "@/src/components/factory/patterns";
import { useProductionOrders } from "./production-orders-provider";

const blankItem = (): OrderItem => ({ sku: "", name: "", type: "", quantity: 0, unit: "", price: 0, note: "" });
function blank(): ProductionOrder {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), number: "", salesOrder: "", company: "", customer: "", customerCode: "", source: "Sales Hub", date: now.slice(0,10), received: now, updated: now, revision: 1, warehouse: "", document: "รับข้อมูลแล้ว", material: "รอตรวจสอบวัตถุดิบ", approval: "รอการอนุมัติจากโรงงาน", production: "ยังไม่เริ่มผลิต", requestedDate: "", pickup: "", proposal: null, cancellation: null, items: [blankItem()], note: "" };
}
const labels = { number: "เลขที่คำสั่งการผลิต", salesOrder: "อ้างอิง Sales Order", company: "บริษัทต้นทาง", customer: "ลูกค้า", customerCode: "รหัสลูกค้าต้นทาง", warehouse: "ชื่อคลังเดิม (ยังไม่ใช่ Master ID)", date: "วันที่เอกสาร", requestedDate: "กำหนดผลิตเสร็จ", pickup: "วันเวลารับสินค้า", note: "หมายเหตุ" };
export function ProductionOrderEditor({ existing, onClose }: { existing?: ProductionOrder; onClose: () => void }) {
  const { save, busy, versions } = useProductionOrders();
  const [expectedVersion] = useState(() => existing ? versions[existing.id] : null);
  const [draft, setDraft] = useState(() => existing ? structuredClone(existing) : blank());
  const [keys, setKeys] = useState(() => draft.items.map(() => crypto.randomUUID()));
  const [error, setError] = useState("");
  const locked = !!existing && (existing.production !== "ยังไม่เริ่มผลิต" || existing.document === "ยกเลิกแล้ว");
  return <SectionCard title={existing ? "แก้ไขคำสั่ง Local" : "เพิ่มคำสั่งในฐานข้อมูล Local"} subtitle="บันทึกข้อมูลที่ระบุเอง ไม่ใช่การรับรองข้อมูลหรือส่งเอกสารไป Sales Hub / Datalink">
    <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); try { await save(draft, expectedVersion); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่ได้"); } }}>
      <fieldset disabled={busy} className="space-y-4" aria-busy={busy}>
        {existing ? <p className="text-sm">ต้นทางเดิม: {draft.source}</p> : <SelectField label="ต้นทางที่ระบุ" value={draft.source} onChange={(source) => setDraft({ ...draft, source: source as ProductionOrder["source"] })} options={[{ value: "Sales Hub", label: "Sales Hub" }, { value: "Datalink", label: "Datalink" }]} />}
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => <div className="grid gap-2" key={key}><Label htmlFor={`po-${key}`}>{labels[key]}</Label><Input id={`po-${key}`} disabled={!!existing && ["number","salesOrder","company","customerCode"].includes(key)} required={["number","company","customer","date","requestedDate","pickup"].includes(key)}
            type={key === "date" || key === "requestedDate" ? "date" : key === "pickup" ? "datetime-local" : "text"}
            value={key === "pickup" ? draft.pickup.slice(0,16) : draft[key]}
            onChange={(e) => setDraft({ ...draft, [key]: key === "pickup" && e.target.value ? `${e.target.value}:00+07:00` : e.target.value })} /></div>)}
        </div>
        {draft.items.map((item, index) => <div className="space-y-3 rounded-lg border p-4" key={keys[index]}>
          <p className="text-sm font-medium">รายการ {index + 1}</p>
          <fieldset disabled={locked} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(["sku","name","type","quantity","unit","price","note"] as const).map((key) => <div className="grid gap-1" key={key}><Label htmlFor={`${keys[index]}-${key}`}>{{ sku: "SKU เดิม", name: "ชื่อสินค้า", type: "ประเภท", quantity: "จำนวน", unit: "หน่วย", price: "ราคา", note: "หมายเหตุรายการ" }[key]}</Label><Input id={`${keys[index]}-${key}`} required={["sku","name","quantity","unit"].includes(key)} type={key === "quantity" || key === "price" ? "number" : "text"} min={key === "quantity" ? "0.000001" : "0"} step="any" value={item[key]} onChange={(e) => setDraft({ ...draft, items: draft.items.map((row, i) => i === index ? { ...row, [key]: key === "quantity" || key === "price" ? Number(e.target.value) : e.target.value } : row) })} /></div>)}
          </fieldset>
          <Button type="button" variant="outline" disabled={locked || draft.items.length === 1} onClick={() => { setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) }); setKeys(keys.filter((_, i) => i !== index)); }}>ลบรายการ</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={locked} onClick={() => { setDraft({ ...draft, items: [...draft.items, blankItem()] }); setKeys([...keys, crypto.randomUUID()]); }}>เพิ่มรายการ</Button>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { if (window.confirm("ละทิ้งการแก้ไขที่ยังไม่บันทึกหรือไม่?")) onClose(); }}>ยกเลิก</Button><Button type="submit" disabled={!!existing && existing.document === "ยกเลิกแล้ว"}>บันทึก PostgreSQL</Button></div>
      </fieldset>
    </form>
  </SectionCard>;
}
