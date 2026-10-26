"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { money, lineAmount, poTotals, poStatuses, type PurchaseOrder } from "./po-domain";

export function PoPaper({ doc }: { doc: PurchaseOrder }) {
  const totals = poTotals(doc);
  return <article data-po-paper className="min-w-0 space-y-5 rounded-lg border bg-background p-4 sm:p-6">
    <header className="space-y-2 border-b pb-4 text-center"><h2 className="text-xl font-semibold">ใบสั่งซื้อ / Purchase Order</h2><p className="text-sm">UI DEMO · ไม่ใช่คำสั่งซื้อหรือการอนุมัติจริง</p><p className="break-all">{doc.po_no} · {doc.po_date}</p><p className="text-sm">สถานะจำลอง: {poStatuses[doc.status]}</p></header>
    <dl className="grid gap-4 sm:grid-cols-2">{[
      ["ผู้ขาย",`${doc.supplier_code_snapshot} ${doc.supplier_name_snapshot}`],["สถานที่รับเข้า",`${doc.warehouse_code} ${doc.warehouse_name}`],
      ["อ้างอิง PR",doc.request_ref_no],["วันที่ส่งมอบ",doc.expected_delivery_date],["สกุลเงิน / ประเภทธุรกรรม",`${doc.currency_code} / ${doc.vat_type}`],
      ["เงื่อนไขชำระ / เครดิตวัน",`${doc.payment_term} / ${doc.credit_days || "—"}`],
    ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{value || "—"}</dd></div>)}</dl>
    {doc.items.map((item,index) => <section key={item.id} data-po-paper-row={item.id} className="space-y-3 rounded-lg border p-4"><h3 className="text-sm font-semibold">{index+1}. {item.material_code_snapshot} · {item.material_name_snapshot}</h3><dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
      ["ข้อมูลจำเพาะ",item.specification],["จำนวน / หน่วย",`${item.ordered_qty} ${item.unit}`],["ราคา / หน่วย",item.unit_price],
      ["จำนวนเงินก่อนภาษี",money(lineAmount(item))],["ภาษี",item.tax_amount || "0.00"],["ส่วนลดเดิม",item.discount_amount || "0.00"],
      ["รับเข้าแล้ว (ตัวอย่าง)",item.received_qty],["วันจัดส่ง",item.expected_delivery_date],["หมายเหตุ",item.remarks],
    ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{value || "—"}</dd></div>)}</dl></section>)}
    <section className="space-y-2 border-t pt-4 text-sm"><p>รวมมูลค่า {money(totals.subtotal)} · ภาษี {money(totals.tax)} · ยอดรวมสุทธิ {money(totals.total)} {doc.currency_code}</p><p className="whitespace-pre-wrap break-words">หมายเหตุ: {doc.remarks || "—"}</p></section>
    <div className="grid gap-4 sm:grid-cols-3">{["ผู้ขออนุมัติ","ผู้ตรวจสอบ / อนุมัติ","ผู้อนุมัติ"].map((label) => <p key={label} className="border-t pt-5 text-center text-sm">{label}<span className="mt-2 block text-xs text-muted-foreground">พื้นที่แสดงลายเซ็นตัวอย่างเท่านั้น</span></p>)}</div>
  </article>;
}
export function PoPreview({ docs,onClose }: { docs: PurchaseOrder[]; onClose: () => void }) {
  const content = useRef<HTMLDivElement>(null), frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(),[]);
  function print() {
    if (!content.current) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe"), clone = content.current.cloneNode(true);
    iframe.title = "พิมพ์ใบสั่งซื้อตัวอย่าง";
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (!doc || !iframe.contentWindow) return;
      const style = doc.createElement("style");
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:12px/1.5 system-ui;color:black;background:white}article{break-after:page}article:last-child{break-after:auto}header{text-align:center}section{break-inside:avoid;border:1px solid black;padding:8px;margin:10px 0}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}p,h3{overflow-wrap:anywhere}";
      doc.head.append(style); doc.body.replaceChildren(clone); iframe.contentWindow.focus(); iframe.contentWindow.print();
    };
    iframe.srcdoc = "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    frame.current = iframe; document.body.append(iframe);
  }
  return <Dialog open={docs.length>0} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl"><DialogHeader><DialogTitle>พรีวิวใบสั่งซื้อตัวอย่าง</DialogTitle><DialogDescription>A4 แนวตั้ง · {docs.length} เอกสาร · ไม่ใช่เอกสารทางธุรกิจจริง</DialogDescription></DialogHeader><div ref={content} className="min-h-0 space-y-5 overflow-y-auto">{docs.map((doc) => <PoPaper key={doc.id} doc={doc} />)}</div><DialogFooter><Button variant="outline" onClick={onClose}>ปิด</Button><Button onClick={print}>พิมพ์ตัวอย่าง</Button></DialogFooter></DialogContent></Dialog>;
}
