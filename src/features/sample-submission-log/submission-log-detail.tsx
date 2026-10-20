"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { SubmissionLogSections } from "./submission-log-form";
import type { SubmissionLog } from "./submission-log-domain";

export function SubmissionLogDetail({
  row,
  print,
  onClose,
}: {
  row: SubmissionLog | null;
  print: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!row}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-6xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? "พรีวิว A4 แนวตั้ง" : "รายละเอียดแบบบันทึกการส่งตัวอย่าง"}
          </DialogTitle>
          <DialogDescription>
            ข้อมูลสาธิต อ่านอย่างเดียว · ไม่ใช่การอนุมัติห้องปฏิบัติการ
            {print ? " · ไม่สร้าง PDF หรือสั่งพิมพ์จริง" : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto rounded-lg border bg-muted/20 p-3">
          {row && (
            <article
              data-log-paper={print ? "portrait" : undefined}
              className={
                print
                  ? "submission-log-paper mx-auto space-y-4 border bg-white p-[10mm] text-black [&_[data-slot=card]]:rounded-none [&_[data-slot=card]]:border-black [&_[data-slot=card]]:bg-white [&_[data-slot=card]]:text-black [&_p]:text-black [&_label]:text-black [&_[data-slot=checkbox]]:border-black [&_[data-slot=radio-group-item]]:border-black [&_[data-state=checked]]:text-black"
                  : "min-w-0 space-y-4"
              }
              style={print ? { width: "210mm", minHeight: "297mm" } : undefined}
            >
              {print && (
                <style>{`.submission-log-paper [data-slot=card] { overflow:visible; break-inside:auto; box-shadow:none; } .submission-log-paper h2 { break-after:avoid; } .submission-log-paper label { break-inside:avoid;background:white;border-color:black; } .submission-log-paper [data-slot=badge] { background:white;border-color:black;color:black; } .submission-log-paper [data-state=checked][data-slot=checkbox] { background:black;color:white; } .submission-log-paper [data-slot=radio-group-item] svg { fill:black; } @media print { @page { size:A4 portrait; margin:10mm; } .submission-log-paper { width:auto!important;min-height:0!important;border:0!important;padding:0!important; } }`}</style>
              )}
              <header className="space-y-2 border-b pb-3">
                <h2 className="text-lg font-semibold">
                  แบบบันทึกการส่งตัวอย่าง
                </h2>
                <p className="break-all text-sm">
                  เลขที่คำขอ {row.doc_no} · รหัสตัวอย่าง {row.sample_code}
                </p>
                <p className="text-xs">
                  MOCK / DEMO · ชื่อและการเลือกทั้งหมดเป็นข้อมูลตัวอย่าง
                  ไม่ใช่ลายมือชื่อหรือผลอนุมัติจริง
                </p>
              </header>
              <SubmissionLogSections row={row} />
            </article>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button>{print ? "ปิดพรีวิว" : "ปิดรายละเอียด"}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
