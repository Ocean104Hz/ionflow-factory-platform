"use client";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import { NCReportContent } from "./nc-report-detail";
import type { NCReport } from "./nc-report-types";

export function NCReportPrintPreview({
  report,
  onClose,
}: {
  report: NCReport | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!report}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-7xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>พรีวิวพิมพ์ใบ NC</DialogTitle>
          <DialogDescription>
            A4 แนวนอน 297 × 210 มม. · Mock preview เท่านั้น
            ยังไม่เปิดหน้าต่างพิมพ์หรือสร้าง PDF · ข้อความยาวต่อเนื่องได้
          </DialogDescription>
        </DialogHeader>
        <div
          className="min-h-0 overflow-auto rounded-lg border bg-muted p-3"
          role="region"
          aria-label="เอกสาร NC A4 แนวนอน เลื่อนเพื่ออ่านทั้งหมด"
          tabIndex={0}
        >
          <article
            data-nc-print
            className="mx-auto space-y-5 border bg-white p-[10mm] text-black shadow-sm [&_dt]:text-black [&_[data-slot=checkbox]]:border-black [&_[data-state=checked]]:bg-black [&_[data-state=checked]]:text-white"
            style={{ width: "297mm", minHeight: "210mm" }}
          >
            <header className="space-y-2 border-b border-black pb-4 text-center">
              <h2 className="text-xl font-semibold">ใบรายงานข้อบกพร่อง (NC)</h2>
              <p className="text-sm">
                ข้อมูลตัวอย่าง · ไม่ใช่หลักฐานอนุมัติหรือคำสั่งเปลี่ยนสต็อก
              </p>
              <p className="break-all text-sm">เลขที่เอกสาร {report?.doc_no}</p>
            </header>
            {report && <NCReportContent report={report} />}
          </article>
        </div>
        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button>ปิดพรีวิว</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
