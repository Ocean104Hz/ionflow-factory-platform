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
import {
  InfoGrid,
  InfoRow,
  StatusBadge,
} from "@/src/components/factory/patterns";
import {
  sampleFields,
  sampleDate,
  resultLabel,
  type SampleSubmission,
} from "./sample-submission-domain";

export function SampleSubmissionDetail({
  report,
  print,
  onClose,
}: {
  report: SampleSubmission | null;
  print: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!report}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-6xl">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? "พรีวิวพิมพ์ใบส่งตัวอย่าง" : "รายละเอียดใบส่งตัวอย่าง"}
          </DialogTitle>
          <DialogDescription>
            {print
              ? "กระดาษตัวอย่าง · ไม่มีการสร้าง PDF หรือเปิดหน้าต่างพิมพ์"
              : "อ่านอย่างเดียว"}{" "}
            · Mock เท่านั้น ไม่เชื่อมระบบจริง
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto pr-1">
          {report && (
            <article
              data-sample-preview={print ? "paper" : "detail"}
              className={`min-w-0 space-y-5 [overflow-wrap:anywhere] ${print ? "rounded-lg border bg-card p-4 sm:p-6" : ""}`}
            >
              <header className="space-y-2 border-b pb-4">
                <h2 className="text-lg font-semibold">
                  ใบส่งตัวอย่างวิเคราะห์
                </h2>
                <p className="break-all text-sm">
                  เลขที่เอกสาร {report.doc_no} · วันที่{" "}
                  {sampleDate(report.doc_date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  เอกสารตัวอย่าง · ผลวิเคราะห์ไม่ใช่การอนุมัติ QA
                </p>
              </header>
              {report.rows.map((row, index) => (
                <section
                  key={row.id}
                  className="space-y-4 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">ตัวอย่าง {index + 1}</h3>
                    <StatusBadge
                      tone={
                        row.analysis_result_status === null
                          ? "neutral"
                          : row.analysis_result_status === "ผ่าน"
                            ? "success"
                            : "destructive"
                      }
                    >
                      {resultLabel(row.analysis_result_status)}
                    </StatusBadge>
                  </div>
                  <InfoGrid>
                    {sampleFields.map(([key, label]) => (
                      <InfoRow key={key} label={label}>
                        <span className="whitespace-pre-wrap">
                          {key === "sent_date" || key === "sample_date"
                            ? sampleDate(row[key])
                            : row[key] || "—"}
                        </span>
                      </InfoRow>
                    ))}
                  </InfoGrid>
                  <p className="text-sm">
                    ผลวิเคราะห์: {resultLabel(row.analysis_result_status)}
                  </p>
                </section>
              ))}
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
