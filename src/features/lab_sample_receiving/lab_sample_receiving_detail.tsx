
"use client";

import { Pencil, Printer, X } from "lucide-react";

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
  InfoGrid,
  InfoRow,
} from "@/src/components/factory/patterns";

import {
  LAB_SAMPLE_FIELD_LABELS,
  formatLabDate,
  formatLabLotDate,
  type LabSampleField,
  type LabSampleReceivingRow,
  type LabSampleReceivingSheet,
} from "./lab_sample_receiving_domain";

import { LabSampleReceivingPaper } from "./lab_sample_receiving_paper";

/* ---------------- types ---------------- */

type Props = {
  sheet: LabSampleReceivingSheet | null;
  print: boolean;
  onClose: () => void;
  onEdit: (sheet: LabSampleReceivingSheet) => void;
  onPrint: (sheet: LabSampleReceivingSheet) => void;
};

/* ---------------- detail fields ---------------- */

const detailFields = [
  "sent_date",
  "sent_time",
  "sample_name",
  "lot_no",
  "sample_characteristics",
  "analysis_request",
  "sender_name",
  "received_by",
  "received_date",
  "sample_code",
  "request_no",
  "remark",
] as const satisfies readonly LabSampleField[];

/* ---------------- helpers ---------------- */

function displayValue(
  row: LabSampleReceivingRow,
  field: LabSampleField,
): string {
  if (field === "lot_no") {
    return formatLabLotDate(row) || "-";
  }

  if (
    field === "sent_date" ||
    field === "lot_date" ||
    field === "received_date"
  ) {
    return formatLabDate(row[field]) || "-";
  }

  return row[field]?.trim() || "-";
}

function displayLabel(field: LabSampleField): string {
  if (field === "lot_no") {
    return "Lot./วันที่";
  }

  return LAB_SAMPLE_FIELD_LABELS[field];
}

/* ---------------- main component ---------------- */

export function LabSampleReceivingDetail({
  sheet,
  print,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  const isOpen = sheet !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        className={
          "flex max-h-[94dvh] w-[96vw] max-w-none " +
          "flex-col gap-4 overflow-hidden p-4 " +
          "sm:max-w-350 sm:p-6"
        }
      >
        {/* Modal Header */}

        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print
              ? "ตัวอย่างก่อนพิมพ์ i-Lab"
              : "รายละเอียดแบบบันทึกรับตัวอย่าง"}
          </DialogTitle>

          <DialogDescription>
            {print
              ? "พรีวิวเอกสาร A4 แนวนอน"
              : "แสดงข้อมูลแบบอ่านอย่างเดียว"}
            {" · "}
            รายละเอียดเอกสารที่บันทึก
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body */}

        <div
          className={
            "min-h-0 flex-1 overflow-auto " +
            "rounded-lg border border-border " +
            "bg-muted/20 p-3"
          }
        >
          {sheet &&
            (print ? (
              /* Print Preview */

              <div className="min-w-max">
                <LabSampleReceivingPaper sheet={sheet} />
              </div>
            ) : (
              /* Read-only Detail */

              <div className="space-y-5">
                {/* Document Summary */}

                <div className="rounded-lg border bg-surface p-4">
                  <h2 className="text-base font-semibold">
                    i-Lab แบบบันทึกรับตัวอย่าง
                  </h2>

                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        รหัสเอกสารภายใน
                      </p>

                      <p className="mt-1 break-all font-medium">
                        {sheet.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        จำนวนรายการตัวอย่าง
                      </p>

                      <p className="mt-1 font-medium">
                        {sheet.rows.length} รายการ
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sample Rows */}

                {sheet.rows.map((row, index) => (
                  <section
                    key={row.id}
                    className="rounded-lg border bg-surface p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <h3 className="font-semibold">
                        ตัวอย่างที่ {index + 1}
                      </h3>

                      <span className="text-xs text-muted-foreground">
                        {row.sample_code || "ยังไม่มีรหัสตัวอย่าง"}
                      </span>
                    </div>

                    <InfoGrid>
                      {detailFields.map((field) => (
                        <InfoRow
                          key={field}
                          label={displayLabel(field)}
                        >
                          <span className="whitespace-pre-wrap wrap-break-word">
                            {displayValue(row, field)}
                          </span>
                        </InfoRow>
                      ))}
                    </InfoGrid>
                  </section>
                ))}

                {/* Empty State */}

                {sheet.rows.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    ไม่พบรายการตัวอย่าง
                  </p>
                )}
              </div>
            ))}
        </div>

        {/* Modal Footer */}

        <DialogFooter className="shrink-0 gap-2">
          {sheet && (
            <>
              {/* Edit */}

              <Button
                type="button"
                variant="outline"
                onClick={() => onEdit(sheet)}
              >
                <Pencil
                  className="size-4"
                  aria-hidden="true"
                />
                แก้ไข
              </Button>

              {/* Print Preview */}

              {!print && (
                <Button
                  type="button"
                  onClick={() => onPrint(sheet)}
                >
                  <Printer
                    className="size-4"
                    aria-hidden="true"
                  />
                  พรีวิวก่อนพิมพ์
                </Button>
              )}
            </>
          )}

          {/* Close */}

          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
            >
              <X
                className="size-4"
                aria-hidden="true"
              />
              ปิด
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
