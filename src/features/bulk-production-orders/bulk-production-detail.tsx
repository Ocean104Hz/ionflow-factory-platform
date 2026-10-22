"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/components/ui/dialog";
import {
  bulkPrintPages,
  bulkSummary,
  signerLabels,
  type BulkOrder,
} from "./bulk-production-domain";

export function BulkProductionDocument({ doc }: { doc: BulkOrder }) {
  const summary = bulkSummary(doc);
  return (
    <div data-bulk-document className="min-w-0 space-y-5">
      {bulkPrintPages(doc.rows).map((rows, page) => (
        <article
          key={page}
          data-bulk-page
          className="min-w-0 space-y-5 rounded-lg border bg-background p-4 sm:p-6"
        >
          <header className="space-y-2 border-b pb-4 text-center">
            <h2 className="text-xl font-semibold">ใบสั่งผลิต</h2>
            <p className="text-sm">
              ข้อมูลตัวอย่าง · ไม่มีการสั่งผลิตหรือตัดสต็อกจริง
            </p>
            <p className="break-all">
              เลขที่เอกสาร {doc.header.docNo} · วันที่ {doc.header.date}
            </p>
            <p className="text-sm">
              หน้าเอกสาร {page + 1} / {bulkPrintPages(doc.rows).length}
            </p>
          </header>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              ["ผลิตปุ๋ยเบล้าท์ (ตัน)", doc.header.planTons ?? "—"],
              ["รวมเป็นจำนวนกระสอบ", doc.header.targetBags ?? "—"],
              ["ระยะเวลาในการผลิต (วัน)", doc.header.productionDays || "—"],
              ["จ่ายวันที่", doc.header.payDate || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {rows.map((r, i) => (
            <section
              key={r.id}
              data-bulk-print-row={r.id}
              className="min-w-0 rounded-lg border p-4"
            >
              <h3 className="mb-3 font-semibold">
                รายการ {page * 7 + i + 1} · {r.itemName || r.product}
              </h3>
              <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["รหัสสินค้า", r.productCode],
                  ["ผลิตปุ๋ย", r.product],
                  ["Lot", r.lot],
                  ["จำนวนที่สั่งผลิต", `${r.qty ?? 0} ${r.qtyUnit}`],
                  ["ขนาด", `${r.size ?? 0} กิโลกรัม`],
                  ["หมายเหตุขนาด / รายการ", r.sizeNote],
                  [
                    "ยอดค้างการผลิตที่บันทึกเอง",
                    `${r.carryQty ?? 0} ${r.qtyUnit}`,
                  ],
                  ["รายละเอียดยอดค้างการผลิต", r.carryNote],
                ].map(([label, value]) => (
                  <div className="min-w-0" key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="space-y-2 text-sm">
            <h3 className="font-semibold">จำนวนสรุป (ทั้งเอกสาร)</h3>
            <p>
              รวมจากรายการ {summary.totalBags.toLocaleString("th-TH")} กระสอบ ·
              เป้าหมาย {summary.targetBags.toLocaleString("th-TH")} กระสอบ
            </p>
            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              หมายเหตุเอกสาร: {doc.note || "—"}
            </p>
          </section>
          <section>
            <h3 className="mb-3 font-semibold">ลงชื่อ (ข้อความตัวอย่าง)</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              {(
                Object.keys(signerLabels) as Array<keyof typeof signerLabels>
              ).map((key) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground">
                    {signerLabels[key]}
                  </dt>
                  <dd className="mt-2 whitespace-pre-wrap break-words border-b pb-2 [overflow-wrap:anywhere]">
                    {doc.docSigners[key] || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </article>
      ))}
      <p className="break-words text-xs text-muted-foreground">
        สร้าง: {doc.createdAt} · แก้ไข: {doc.updatedAt}
      </p>
    </div>
  );
}
export function BulkProductionDetail({
  doc,
  print,
  onClose,
  onEdit,
}: {
  doc: BulkOrder | null;
  print: boolean;
  onClose: () => void;
  onEdit: (doc: BulkOrder) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(), []);
  function printDocument() {
    if (!content.current) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "ใบสั่งผลิตสำหรับพิมพ์";
    iframe.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = content.current.cloneNode(true);
    iframe.onload = () => {
      const document = iframe.contentDocument;
      if (!document || !iframe.contentWindow) return;
      const style = document.createElement("style");
      style.textContent =
        "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000;background:white}header{text-align:center;border-bottom:1px solid black}h2{font-size:20px}h3{font-size:13px}article{break-after:page}article:last-of-type{break-after:auto}section{margin:12px 0;padding:8px;border:1px solid black;break-inside:avoid}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}dt{font-weight:bold}dd{margin:3px 0;white-space:pre-wrap;overflow-wrap:anywhere}p,h3{overflow-wrap:anywhere;white-space:pre-wrap}";
      document.head.append(style);
      document.body.replaceChildren(clone);
      document.title = doc?.header.docNo || "ใบสั่งผลิต";
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    iframe.srcdoc =
      "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    frame.current = iframe;
    document.body.append(iframe);
  }
  return (
    <Dialog
      open={!!doc}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? "พรีวิวใบสั่งผลิต" : "รายละเอียดใบสั่งผลิต"}
          </DialogTitle>
          <DialogDescription>
            A4 แนวตั้ง · แบ่งกลุ่มละ 7 รายการ ข้อความยาวต่อหน้าได้ ·
            ไม่ใช่เอกสารสั่งผลิตจริง
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border p-3">
          <div ref={content}>{doc && <BulkProductionDocument doc={doc} />}</div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (doc) {
                onEdit(doc);
                onClose();
              }
            }}
          >
            แก้ไข
          </Button>
          <Button onClick={printDocument}>พิมพ์</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
