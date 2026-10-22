"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { inventoryStatuses } from "@/src/features/inventory/inventory-domain";
import { ledgerContext } from "@/src/features/inventory/inventory-ledger-data";
import type { ProductionReceipt } from "./production-flow-domain";

function formatDocumentDate(receipt: ProductionReceipt) {
  const value = receipt.createdAt || receipt.confirmedAt || receipt.updatedAt;
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function ProductionReceiptDocument({ receipt }: { receipt: ProductionReceipt }) {
  const site = ledgerContext.sites.find((row) => row.id === receipt.siteId);
  const warehouse = ledgerContext.warehouses.find((row) => row.id === receipt.warehouseId);
  const confirmed = receipt.status === "CONFIRMED";

  return (
    <article data-production-receipt className="space-y-5 rounded-lg bg-background p-4 sm:p-6">
      <header className="space-y-2 border-b pb-4 text-center">
        <h2 className="text-xl font-semibold">ใบรับยอดผลิต</h2>
        <p className="text-sm text-muted-foreground">
          อ้างอิงรายงาน {receipt.reportId} · {confirmed ? "ยืนยันรับแล้ว" : "แบบร่าง"}
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border">
        <h3 className="border-b bg-surface-muted px-4 py-3 text-sm font-semibold">ส่วนหัวเอกสาร</h3>
        <dl className="grid gap-4 p-4 sm:grid-cols-3">
          {[
            ["สถานที่", site ? `${site.code} · ${site.name}` : receipt.siteId],
            ["วันที่เอกสาร", formatDocumentDate(receipt)],
            ["เอกสารเลขที่", receipt.documentNumber],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <h3 className="border-b bg-surface-muted px-4 py-3 text-sm font-semibold">รายการรับยอดการผลิต</h3>
        <Table className="min-w-[720px]">
          <TableHeader className="bg-surface-muted/70">
            <TableRow>
              <TableHead className="w-16 text-center">No.</TableHead>
              <TableHead>รายการ</TableHead>
              <TableHead>รหัสสินค้า</TableHead>
              <TableHead className="text-right">จำนวนรับ</TableHead>
              <TableHead>หน่วยนับ</TableHead>
              <TableHead>Lot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-center text-muted-foreground">1</TableCell>
              <TableCell className="font-medium">{receipt.itemName}</TableCell>
              <TableCell>{receipt.itemCode}</TableCell>
              <TableCell className="text-right tabular-nums">{receipt.quantity}</TableCell>
              <TableCell>{receipt.unit}</TableCell>
              <TableCell>{receipt.lotCode || "—"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section className="overflow-hidden rounded-xl border">
        <h3 className="border-b bg-surface-muted px-4 py-3 text-sm font-semibold">ข้อมูลปลายทางคลัง</h3>
        <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["คลังสินค้า", warehouse ? `${warehouse.code} · ${warehouse.name}` : receipt.warehouseId],
            ["ตำแหน่งจัดเก็บ", receipt.locationLabel],
            ["สถานะสินค้า", inventoryStatuses[receipt.inventoryStatus]],
            ["Ledger event", receipt.ledgerEventId || "ยังไม่ลงบัญชี"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border p-4">
        <h3 className="text-sm font-semibold">หมายเหตุ</h3>
        <p className="mt-2 min-h-12 whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {receipt.note || "—"}
        </p>
      </section>
    </article>
  );
}

export function ProductionReceiptDialog({ receipt, onClose }: { receipt: ProductionReceipt | null; onClose: () => void }) {
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
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000}article{display:grid;gap:14px}header{text-align:center;border-bottom:1px solid #bbb;padding-bottom:10px}section{border:1px solid #bbb;border-radius:8px;overflow:hidden}h2{font-size:20px;margin:0}h3{font-size:12px;margin:0;padding:8px 10px;border-bottom:1px solid #bbb;background:#f5f5f5}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px;margin:0}dt{font-weight:bold}dd{margin:2px 0}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}p{overflow-wrap:anywhere;white-space:pre-wrap;margin:0;padding:10px}";
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
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>รายละเอียดใบรับยอดผลิต</DialogTitle>
          <DialogDescription>แสดงเอกสารตามข้อมูลที่บันทึกใน Factory โดยไม่เปลี่ยนข้อมูลต้นทาง</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border p-2 sm:p-3">
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
