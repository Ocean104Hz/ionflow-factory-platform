"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { inventoryStatuses } from "@/src/features/inventory/inventory-domain";
import { ledgerContext } from "@/src/features/inventory/inventory-ledger-data";
import type { ProductionReceipt } from "./production-flow-domain";

export function ProductionReceiptDocument({ receipt }: { receipt: ProductionReceipt }) {
  const site = ledgerContext.sites.find((row) => row.id === receipt.siteId);
  const warehouse = ledgerContext.warehouses.find((row) => row.id === receipt.warehouseId);
  return (
    <article data-production-receipt className="space-y-5 rounded-lg bg-background p-4 sm:p-6">
      <header className="space-y-2 border-b pb-4 text-center">
        <h2 className="text-xl font-semibold">ใบรับยอดผลิต</h2>
        <p>{receipt.documentNumber}</p>
        <p className="text-sm text-muted-foreground">
          อ้างอิงรายงาน {receipt.reportId} · {receipt.status === "CONFIRMED" ? "ยืนยันรับแล้ว" : "แบบร่าง"}
        </p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["สินค้า", `${receipt.itemCode} · ${receipt.itemName}`],
          ["จำนวนรับ", `${receipt.quantity} ${receipt.unit}`],
          ["Lot", receipt.lotCode],
          ["โรงงาน", site ? `${site.code} · ${site.name}` : receipt.siteId],
          ["คลัง", warehouse ? `${warehouse.code} · ${warehouse.name}` : receipt.warehouseId],
          ["ตำแหน่ง", receipt.locationLabel],
          ["สถานะสินค้า", inventoryStatuses[receipt.inventoryStatus]],
          ["Ledger event", receipt.ledgerEventId || "ยังไม่ลงบัญชี"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="whitespace-pre-wrap break-words">หมายเหตุ: {receipt.note || "—"}</p>
    </article>
  );
}

export function ProductionReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: ProductionReceipt | null;
  onClose: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(), []);
  function print() {
    if (!content.current || !receipt) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "ใบรับยอดผลิตสำหรับพิมพ์";
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = content.current.cloneNode(true);
    iframe.onload = () => {
      const target = iframe.contentDocument;
      if (!target || !iframe.contentWindow) return;
      const style = target.createElement("style");
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000}dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}dt{font-weight:bold}dd{margin:2px 0}h2{text-align:center;font-size:20px}p{overflow-wrap:anywhere;white-space:pre-wrap}";
      target.head.append(style);
      target.body.replaceChildren(clone);
      target.title = receipt.documentNumber;
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    iframe.srcdoc = "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    frame.current = iframe;
    document.body.append(iframe);
  }
  return (
    <Dialog open={!!receipt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-4xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>รายละเอียดใบรับยอดผลิต</DialogTitle>
          <DialogDescription>เอกสารยืนยันแล้วอ้างอิง Stock Ledger และแก้ไขไม่ได้</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border p-3">
          <div ref={content}>{receipt && <ProductionReceiptDocument receipt={receipt} />}</div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          <Button onClick={print}>พิมพ์ใบรับยอด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
