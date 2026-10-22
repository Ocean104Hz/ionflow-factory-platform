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
import type {
  ProductionFormulaSheet,
  ProductionReport,
} from "./production-flow-domain";

const number = (value: number | null) =>
  value === null
    ? "—"
    : value.toLocaleString("th-TH", { maximumFractionDigits: 6 });

export function ProductionReportDocument({
  report,
  sheet,
}: {
  report: ProductionReport;
  sheet: ProductionFormulaSheet;
}) {
  const line = sheet.lines.find((row) => row.orderLineId === report.orderLineId);
  return (
    <article data-production-report className="space-y-5 rounded-lg bg-background p-4 sm:p-6">
      <header className="space-y-2 border-b pb-4 text-center">
        <h2 className="text-xl font-semibold">รายงานการผลิต</h2>
        <p>{report.documentNumber} · วันที่ {report.reportDate || "—"}</p>
        <p className="text-sm text-muted-foreground">
          ใบสั่งผลิต {sheet.orderNumber} · สูตร {line?.formulaVersion ?? "—"} · Lot {line?.lot ?? "—"}
        </p>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["สินค้า", `${line?.productCode ?? "—"} · ${line?.productName ?? "—"}`],
          ["กะ / ไลน์ผลิต", `${report.shift || "—"} · ${report.productionLine || "—"}`],
          ["เวลาเริ่ม–สิ้นสุด", `${report.startTime || "—"}–${report.endTime || "—"}`],
          ["ยอดตามแผน", `${number(line?.plannedQuantity ?? null)} ${report.unit}`],
          ["ยอดผลิตดี", `${number(report.goodQuantity)} ${report.unit}`],
          ["ของเสีย/สูญเสีย", `${number(report.wasteQuantity)} ${report.unit}`],
          ["ผู้รับผิดชอบ", report.operator || "—"],
          ["สถานะ", report.status === "RECORDED" ? "บันทึกรายงานแล้ว" : "แบบร่าง"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3">
        <h3 className="font-semibold">วัตถุดิบตามสูตรเทียบใช้จริง</h3>
        {report.materials.map((material) => (
          <div key={material.materialId} className="grid gap-2 border-b pb-2 sm:grid-cols-3">
            <span>{material.code} · {material.name}</span>
            <span>แผน {number(material.quantity)} {material.unit}</span>
            <span>จริง {number(material.actualQuantity)} {material.unit}</span>
          </div>
        ))}
      </section>
      <p className="whitespace-pre-wrap break-words">หมายเหตุ: {report.note || "—"}</p>
      <p className="text-xs text-muted-foreground">
        รายงานนี้บันทึกผลผลิตจริง แต่ไม่รับสินค้าเข้าคลัง
      </p>
    </article>
  );
}

export function ProductionReportDialog({
  report,
  sheet,
  onClose,
}: {
  report: ProductionReport | null;
  sheet: ProductionFormulaSheet | null;
  onClose: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(), []);
  function print() {
    if (!content.current || !report) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "รายงานการผลิตสำหรับพิมพ์";
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = content.current.cloneNode(true);
    iframe.onload = () => {
      const target = iframe.contentDocument;
      if (!target || !iframe.contentWindow) return;
      const style = target.createElement("style");
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000}article{break-inside:avoid}section{margin:12px 0}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}dt{font-weight:bold}dd{margin:2px 0}h2{text-align:center;font-size:20px}p{overflow-wrap:anywhere;white-space:pre-wrap}";
      target.head.append(style);
      target.body.replaceChildren(clone);
      target.title = report.documentNumber;
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    iframe.srcdoc = "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    frame.current = iframe;
    document.body.append(iframe);
  }
  return (
    <Dialog open={!!report && !!sheet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>รายละเอียดรายงานการผลิต</DialogTitle>
          <DialogDescription>รายงานผลจริงจากใบสูตร snapshot โดยไม่ลงสต็อก</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border p-3">
          <div ref={content}>
            {report && sheet && <ProductionReportDocument report={report} sheet={sheet} />}
          </div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          <Button onClick={print}>พิมพ์รายงาน</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
