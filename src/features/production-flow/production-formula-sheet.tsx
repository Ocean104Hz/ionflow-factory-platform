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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import type { ProductionFormulaSheet } from "./production-flow-domain";

const number = (value: number) =>
  value.toLocaleString("th-TH", { maximumFractionDigits: 6 });

export function ProductionFormulaDocument({
  sheet,
}: {
  sheet: ProductionFormulaSheet;
}) {
  return (
    <article data-production-formula className="space-y-5 rounded-lg bg-background p-4 sm:p-6">
      <header className="space-y-2 border-b pb-4 text-center">
        <h2 className="text-xl font-semibold">ใบสูตรผลิต</h2>
        <p>อ้างอิงใบสั่งผลิต {sheet.orderNumber} · วันที่ {sheet.orderDate}</p>
        <p className="text-sm text-muted-foreground">
          Snapshot สูตร ณ {new Date(sheet.issuedAt).toLocaleString("th-TH")} · ออกโดย {sheet.issuedBy}
        </p>
      </header>
      {sheet.lines.map((line, index) => (
        <section key={line.orderLineId} className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="font-semibold">
              รายการ {index + 1} · {line.productCode} · {line.productName}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lot {line.lot} · แผน {number(line.plannedQuantity)} {line.plannedUnit} · สูตร {line.formulaCode} รุ่น {line.formulaVersion} · {number(line.batchCount)} Batch
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>รหัส / รายการ</TableHead>
                  <TableHead className="text-right">จำนวนตามแผน</TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...line.ingredients.map((row) => ({ ...row, kind: "วัตถุดิบ" })),
                  ...line.packaging.map((row) => ({ ...row, kind: "บรรจุภัณฑ์" })),
                ].map((row) => (
                  <TableRow key={`${row.kind}:${row.materialId}`}>
                    <TableCell>{row.kind}</TableCell>
                    <TableCell>{row.code} · {row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {number(row.quantity)} {row.unit}
                    </TableCell>
                    <TableCell>{row.remarks || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        เอกสารนี้เป็นคำสั่งตามสูตรและไม่บันทึกยอดใช้จริงหรือเปลี่ยนสต็อก
      </p>
    </article>
  );
}

export function ProductionFormulaSheetDialog({
  sheet,
  onClose,
}: {
  sheet: ProductionFormulaSheet | null;
  onClose: () => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(), []);
  function print() {
    if (!content.current || !sheet) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "ใบสูตรผลิตสำหรับพิมพ์";
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = content.current.cloneNode(true);
    iframe.onload = () => {
      const target = iframe.contentDocument;
      if (!target || !iframe.contentWindow) return;
      const style = target.createElement("style");
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000}article,section{break-inside:avoid}table{width:100%;border-collapse:collapse}th,td{padding:6px;border:1px solid #888;text-align:left}h2{text-align:center;font-size:20px}p{overflow-wrap:anywhere}";
      target.head.append(style);
      target.body.replaceChildren(clone);
      target.title = `ใบสูตรผลิต ${sheet.orderNumber}`;
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    };
    iframe.srcdoc = "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    frame.current = iframe;
    document.body.append(iframe);
  }
  return (
    <Dialog open={!!sheet} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-6xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>ใบสูตรผลิต</DialogTitle>
          <DialogDescription>
            สูตรและปริมาณถูก snapshot แล้ว ใบสั่งผลิตต้นทางจะถูกล็อกเพื่อป้องกันข้อมูลย้อนหลังเปลี่ยน
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border p-3">
          <div ref={content}>{sheet && <ProductionFormulaDocument sheet={sheet} />}</div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>ปิด</Button>
          <Button onClick={print}>พิมพ์ใบสูตรผลิต</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
