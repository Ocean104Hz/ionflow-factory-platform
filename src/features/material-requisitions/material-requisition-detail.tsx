"use client";
import { useRef, useEffect } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  documentNumber,
  profiles,
  signerFields,
  type Requisition,
} from "./material-requisition-domain";

export function RequisitionDocument({ row }: { row: Requisition }) {
  return (
    <article
      data-requisition-document
      className="min-w-0 space-y-6 break-words"
    >
      <header className="space-y-2 border-b pb-4 text-center">
        <h2 className="text-xl font-semibold">ใบเบิกวัสดุ/วัตถุดิบ</h2>
        <p>ข้อมูลตัวอย่าง · ไม่มีการตัดสต็อกหรืออนุมัติจริง</p>
      </header>
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          ["โรงงาน", profiles[row.profile].label],
          ["สถานที่", row.location],
          ["เอกสารเลขที่", documentNumber(row.doc_no)],
          ["วันที่เอกสาร", row.date],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h3 className="mb-3 font-semibold">รายการเบิกวัสดุ/วัตถุดิบ</h3>
        <Table className="min-w-[600px] table-fixed">
          <TableHeader>
            <TableRow>
              {[
                "ชื่อรายการ",
                "ขนาด (kg)",
                "จำนวนเบิก",
                "หน่วยนับ",
                "หมายเหตุรายการ",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.material_details.map((r) => (
              <TableRow key={r.id}>
                {[r.m_item_name, r.m_size, r.m_qty, r.m_unit, r.m_desc].map(
                  (value, index) => (
                    <TableCell
                      key={index}
                      className="whitespace-pre-wrap break-words align-top"
                    >
                      {value ?? "—"}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
            {!row.material_details.length && (
              <TableRow>
                <TableCell colSpan={5}>ไม่มีรายการวัสดุ</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">รายการเบิกวัตถุดิบ WIP</h3>
        <Table className="min-w-[600px] table-fixed">
          <TableHeader>
            <TableRow>
              {[
                "ชื่อรายการ WIP",
                "ขนาด (kg)",
                "จำนวน",
                "หน่วยนับ",
                "หมายเหตุ",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {row.wip_materials.map((r) => (
              <TableRow key={r.id}>
                {[r.w_item_name, r.w_size, r.w_qty, r.w_unit, r.w_desc].map(
                  (value, index) => (
                    <TableCell
                      key={index}
                      className="whitespace-pre-wrap break-words align-top"
                    >
                      {value ?? "—"}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
            {!row.wip_materials.length && (
              <TableRow>
                <TableCell colSpan={5}>ไม่มีรายการ WIP</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
      <section>
        <h3 className="mb-3 font-semibold">
          รายชื่อผู้ลงนาม (ข้อความตัวอย่าง)
        </h3>
        <dl className="grid gap-5 lg:grid-cols-3">
          {signerFields.map(([key, label]) => (
            <div key={key} data-field={key}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-3 whitespace-pre-wrap break-all border-b pb-2">
                {row[key] || "—"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-xs text-muted-foreground">
        สร้าง: {row.createdAt} · แก้ไข: {row.updatedAt}
      </p>
    </article>
  );
}
export function MaterialRequisitionDetail({
  row,
  print,
  onClose,
  onEdit,
}: {
  row: Requisition | null;
  print: boolean;
  onClose: () => void;
  onEdit: (row: Requisition) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frame.current?.remove(), []);
  function printDocument() {
    if (!content.current) return;
    frame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "เอกสารใบเบิกสำหรับพิมพ์";
    iframe.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = content.current.cloneNode(true);
    iframe.onload = () => {
      const doc = iframe.contentDocument;
      if (!doc || !iframe.contentWindow) return;
      const style = doc.createElement("style");
      style.textContent =
        "@page{size:A4 portrait;margin:12mm}body{font:12px/1.5 system-ui,sans-serif;color:#000;background:#fff}h2,header{text-align:center}h3{font-size:14px;margin:18px 0 8px}table{width:100%;min-width:0!important;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:6px;white-space:pre-wrap;overflow-wrap:anywhere;vertical-align:top}tr{break-inside:avoid}thead{display:table-header-group}[data-slot=table-container]{overflow:visible!important}dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}dt{font-weight:bold}dd{margin:4px 0;white-space:pre-wrap;overflow-wrap:anywhere}section{margin-top:20px}p{overflow-wrap:anywhere}";
      doc.head.append(style);
      doc.title = row ? documentNumber(row.doc_no) : "ใบเบิกวัสดุ";
      doc.body.replaceChildren(clone);
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
      open={!!row}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? "พรีวิวเอกสารใบเบิก" : "รายละเอียดใบเบิก"}
          </DialogTitle>
          <DialogDescription>
            {print
              ? "A4 แนวตั้ง · เนื้อหายาวต่อหน้าได้ · พิมพ์ผ่านเบราว์เซอร์ ไม่สร้าง PDF"
              : "ข้อมูลจำลองสำหรับตรวจสอบ ไม่ใช่รายการเบิกจากคลังจริง"}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto rounded-lg border p-4 sm:p-6">
          <div ref={content}>{row && <RequisitionDocument row={row} />}</div>
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (row) {
                onEdit(row);
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
