"use client";
import { useEffect, useRef } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { SectionCard, SelectField } from "@/src/components/factory/patterns";
import { blankItem, lineAmount, money, poTotals, type PurchaseOrder, type PoErrors, type PoItem } from "./po-domain";

export type PickerKind = "supplier" | "warehouse" | "material" | "pr";
export function PoForm({ doc, errors, onChange, onSave, onCancel, onPick, onNumber, readOnly = false }: {
  doc: PurchaseOrder; errors: PoErrors; onChange: (doc: PurchaseOrder) => void;
  onSave: (submit: boolean) => void; onCancel: () => void;
  onPick: (kind: PickerKind, rowId?: string) => void; onNumber: () => void; readOnly?: boolean;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (Object.keys(errors).length) summaryRef.current?.focus(); },[errors]);
  const totals = poTotals(doc);
  function field(key: string, label: string, value: string, change: (value: string) => void, type = "text", multiline = false, immutable = false) {
    const props = { id: `po-${key}`, name: key, value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(e.target.value), readOnly: readOnly || immutable, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `po-error-${key}` : undefined };
    return <div className="grid min-w-0 gap-2" key={key}><Label htmlFor={props.id}>{label}</Label>{multiline ? <Textarea {...props} rows={2} /> : <Input {...props} type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? 0 : undefined} />}{errors[key] && <p className="text-xs text-danger" id={`po-error-${key}`}>{errors[key]}</p>}</div>;
  }
  function header(key: keyof Pick<PurchaseOrder,"po_no" | "po_date" | "supplier_code_snapshot" | "supplier_name_snapshot" | "warehouse_code" | "warehouse_name" | "payment_term" | "credit_days" | "expected_delivery_date" | "request_ref_no" | "remarks">, label: string, type = "text", multiline = false) {
    return field(key,label,doc[key],(value) => onChange({ ...doc, [key]: value, ...(["supplier_code_snapshot","supplier_name_snapshot"].includes(key) ? { supplier_id: "" } : {}) }),type,multiline,key === "request_ref_no");
  }
  return <form noValidate className="min-w-0 space-y-5" onSubmit={(event) => { event.preventDefault(); onSave(false); }}>
    {!!Object.keys(errors).length && <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"><p className="font-medium">กรุณาตรวจสอบข้อมูลก่อนบันทึก</p><ul className="mt-2 list-inside list-disc">{Object.entries(errors).map(([key,message]) => <li key={key}><a className="underline" href={`#po-${key}`}>{message}</a></li>)}</ul></div>}
    <SectionCard title="ข้อมูลใบสั่งซื้อ" subtitle="ข้อมูลจำลองในหน้านี้เท่านั้น · ช่อง * จำเป็นต้องกรอก">
      <fieldset disabled={readOnly} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {header("po_date","วันที่เอกสาร *","date")}
        <div className="space-y-2">{header("po_no","เลขที่ PO *")}<Button type="button" size="sm" variant="outline" onClick={onNumber}>สร้างเลข PO ตัวอย่าง</Button></div>
        <div className="space-y-2">{header("request_ref_no","อ้างอิง PR ตัวอย่าง")}<div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onPick("pr")}><Search aria-hidden="true" />เลือก PR</Button><Button type="button" size="sm" variant="ghost" disabled={!doc.request_ref_id} onClick={() => onChange({ ...doc, request_ref_id: "", request_ref_no: "" })}>ล้างอ้างอิง</Button></div></div>
        <div className="space-y-2">{header("supplier_code_snapshot","รหัสผู้ขาย")}<Button type="button" size="sm" variant="outline" onClick={() => onPick("supplier")}><Search aria-hidden="true" />เลือกผู้ขายตัวอย่าง</Button></div>
        {header("supplier_name_snapshot","ชื่อผู้ขาย *")}
        <div className="space-y-2">{header("warehouse_code","รหัสคลัง / Site")}<Button type="button" size="sm" variant="outline" onClick={() => onPick("warehouse")}><Search aria-hidden="true" />เลือกคลังตัวอย่าง</Button></div>
        {header("warehouse_name","สถานที่รับเข้า *")}
        <SelectField label="สกุลเงิน" value={doc.currency_code} onChange={(currency_code) => onChange({ ...doc,currency_code })} options={["THB","USD","EUR"].map((value) => ({ value,label:value }))} />
        <SelectField label="ประเภทธุรกรรม / VAT" value={doc.vat_type} onChange={(vat_type) => onChange({ ...doc,vat_type:vat_type as PurchaseOrder["vat_type"] })} options={[{ value:"NON_VAT",label:"NON_VAT · ไม่มี VAT" },{ value:"VAT_EXCLUDED",label:"VAT_EXCLUDED · ไม่รวม VAT" },{ value:"VAT_INCLUDED",label:"VAT_INCLUDED · รวม VAT" }]} />
        {header("payment_term","เงื่อนไขชำระ")}{header("credit_days","เครดิตวัน","number")}{header("expected_delivery_date","วันที่ส่งมอบ","date")}
        <div className="sm:col-span-2 xl:col-span-3">{header("remarks","หมายเหตุเอกสาร","text",true)}</div>
      </fieldset>
    </SectionCard>
    <SectionCard title="รายการสินค้า / วัตถุดิบ" subtitle="ราคากับจำนวนต้องมากกว่า 0 · ระบุภาษีเป็นจำนวนเงินตามต้นฉบับ ไม่คำนวณอัตรา VAT อัตโนมัติ" action={!readOnly && <Button type="button" variant="outline" onClick={() => onChange({ ...doc, items:[...doc.items,blankItem(crypto.randomUUID())] })}><Plus aria-hidden="true" />เพิ่มรายการ</Button>}>
      <div className="space-y-4">{doc.items.map((row,index) => {
        const update = (key: keyof PoItem, value: string) => onChange({ ...doc, items: doc.items.map((item) => item.id === row.id ? { ...item,[key]:value, ...(["material_code_snapshot","material_name_snapshot"].includes(key) ? { raw_material_id:"" } : {}) } : item) });
        const f = (key: keyof PoItem,label: string,type = "text",multiline = false) => field(`items.${row.id}.${key}`,`${label} · รายการ ${index+1}`,row[key],(value) => update(key,value),type,multiline);
        return <section key={row.id} className="min-w-0 space-y-4 rounded-lg border bg-muted/10 p-4" data-po-row={row.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">รายการ {index+1}</h3>{!readOnly && <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onPick("material",row.id)}><Search aria-hidden="true" />เลือกวัตถุดิบตัวอย่าง</Button><Button type="button" size="icon" variant="ghost" aria-label={`ลบรายการ ${index+1}`} disabled={doc.items.length <= 1} onClick={() => onChange({ ...doc,items:doc.items.filter((item) => item.id !== row.id) })}><Trash2 aria-hidden="true" /></Button></div>}</div>
          <fieldset disabled={readOnly} className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {f("material_code_snapshot","รหัสสินค้า *")}{f("material_name_snapshot","ชื่อสินค้า *")}{f("specification","ข้อมูลจำเพาะ","text",true)}{f("ordered_qty","จำนวน *","number")}
            {f("unit_price","ราคา / หน่วย *","number")}{f("tax_amount","ภาษี (จำนวนเงิน)","number")}{f("unit","หน่วย *")}{f("expected_delivery_date","วันจัดส่งสินค้า","date")}
            <div className="sm:col-span-2">{f("remarks","หมายเหตุรายการ","text",true)}</div>
            <div className="grid gap-1 self-end rounded-lg bg-muted p-3 text-sm"><span>จำนวนเงินก่อนภาษี</span><strong>{money(lineAmount(row))} {doc.currency_code}</strong></div>
            {row.discount_amount && <p className="self-end text-xs text-muted-foreground">คงส่วนลดเดิม {row.discount_amount} (ข้อมูลเดิม ไม่คำนวณเพิ่ม)</p>}
          </fieldset>
        </section>;
      })}</div>
      {errors.items && <p id="po-items" role="alert" className="mt-2 text-sm text-danger">{errors.items}</p>}
    </SectionCard>
    <SectionCard title="สรุปมูลค่า"><div className="grid gap-3 sm:grid-cols-3">{[["รวมมูลค่ารายการ",totals.subtotal],["รวมภาษี",totals.tax],["ยอดรวมสุทธิ",totals.total]].map(([label,value]) => <div key={String(label)} className="rounded-lg border bg-muted/20 p-4"><p className="text-sm text-muted-foreground">{String(label)}</p><p className="mt-2 text-xl font-semibold">{money(value as bigint)} <span className="text-sm font-normal">{doc.currency_code}</span></p></div>)}</div></SectionCard>
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{readOnly ? "ปิด" : "ยกเลิก"}</Button>{!readOnly && <><Button type="submit" variant="outline">บันทึกข้อมูลตัวอย่าง</Button><Button type="button" onClick={() => onSave(true)}>ส่งอนุมัติตัวอย่าง</Button></>}</div>
  </form>;
}
