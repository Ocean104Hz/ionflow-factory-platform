"use client";
import { InfoGrid, InfoRow } from "@/src/components/factory/patterns";
import { Checkbox } from "@/src/components/ui/checkbox";
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
import {
  headerFields,
  productFields,
  descriptionFields,
  reviewerFields,
  ncFieldValue,
} from "./nc-report-mock-helpers";
import { ncDecisions, type NCReport } from "./nc-report-types";

export function NCReportContent({ report }: { report: NCReport }) {
  return (
    <div className="min-w-0 space-y-6 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <section>
        <h3 className="mb-3 text-base font-semibold">ข้อมูลเอกสาร</h3>
        <InfoGrid>
          {headerFields.map(([k, l]) => (
            <InfoRow key={k} label={l}>
              {ncFieldValue(report, k)}
            </InfoRow>
          ))}
        </InfoGrid>
      </section>
      <section>
        <h3 className="mb-3 text-base font-semibold">รายละเอียดข้อบกพร่อง</h3>
        <InfoGrid>
          {productFields.map(([k, l]) => (
            <InfoRow key={k} label={l}>
              {ncFieldValue(report, k)}
            </InfoRow>
          ))}
        </InfoGrid>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          {descriptionFields.map(([k, l]) => (
            <InfoRow key={k} label={l}>
              <span className="whitespace-pre-wrap">
                {ncFieldValue(report, k)}
              </span>
            </InfoRow>
          ))}
        </dl>
      </section>
      <section>
        <h3 className="mb-3 text-base font-semibold">สรุปผลการตัดสินใจ</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {ncDecisions.map(([k, l]) => (
            <div key={k} className="flex items-center gap-2">
              <Checkbox
                checked={report.decisions[k]}
                disabled
                aria-label={l}
                className="disabled:opacity-100"
              />
              <span>{l}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 text-base font-semibold">ผู้ทบทวนและผู้อนุมัติ</h3>
        <InfoGrid>
          {reviewerFields.map(([k, l]) => (
            <InfoRow key={k} label={l}>
              {ncFieldValue(report, k)}
            </InfoRow>
          ))}
        </InfoGrid>
        <p className="mt-3 text-xs">
          ชื่อเป็นข้อความตัวอย่าง ไม่ใช่ลายมือชื่อหรือผลอนุมัติ QA
        </p>
      </section>
    </div>
  );
}
export function NCReportDetail({
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
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-5xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="break-all">
            รายละเอียดใบ NC · {report?.doc_no}
          </DialogTitle>
          <DialogDescription>
            อ่านอย่างเดียว · ข้อมูลตัวอย่าง ไม่ใช่เอกสารอนุมัติจริง
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          {report && <NCReportContent report={report} />}
        </div>
        <DialogFooter className="shrink-0">
          <DialogClose asChild>
            <Button>ปิดรายละเอียด</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
