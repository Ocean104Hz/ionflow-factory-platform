"use client";

import { Pencil, Printer } from "lucide-react";

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
  InfoGrid,
  InfoRow,
  SectionCard,
  StatusBadge,
} from "@/src/components/factory/patterns";

import {
  QC_WEIGHT_GROUP_KEYS,
  QC_WEIGHT_READING_INDEXES,
  formatQcWeightDate,
  qcWeightResultLabel,
  type QcProductWeightCheckDocument,
} from "./qc_product_weight_check_domain";

import { QcProductWeightCheckPaper } from "./qc_product_weight_check_paper";

/* ---------------- types ---------------- */

type Props = {
  document: QcProductWeightCheckDocument | null;
  print: boolean;
  onClose: () => void;
  onEdit: (document: QcProductWeightCheckDocument) => void;
  onPrint: (document: QcProductWeightCheckDocument) => void;
};

/* ---------------- helpers ---------------- */

function displayText(value: string): string {
  return value.trim() || "-";
}

function displayDate(value: string): string {
  return formatQcWeightDate(value) || "-";
}

function displayDateTime(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

/* ---------------- component ---------------- */

export function QcProductWeightCheckDetail({
  document,
  print,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  return (
    <Dialog
      open={document !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] min-w-0 flex-col gap-4 overflow-hidden p-4 sm:max-w-6xl sm:p-6">
        {/* Header */}

        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print
              ? "พรีวิวใบบันทึก QC น้ำหนักผลิตภัณฑ์"
              : "รายละเอียดการตรวจเช็ค QC น้ำหนักผลิตภัณฑ์"}
          </DialogTitle>

          <DialogDescription>
            {print
              ? "พรีวิวกระดาษ A4 แนวนอน ยังไม่ได้สั่งพิมพ์จริง"
              : "แสดงรายละเอียดเอกสาร QC แบบอ่านอย่างเดียว"}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}

        <div className="min-h-0 min-w-0 overflow-auto rounded-lg border bg-muted/20 p-3">
          {document &&
            (print ? (
              /* Paper Preview */

              <div className="mx-auto w-max">
                <QcProductWeightCheckPaper document={document} />
              </div>
            ) : (
              /* Document Detail */

              <div className="min-w-0 space-y-4">
                {/* Document Information */}

                <SectionCard title="ข้อมูลเอกสาร">
                  <InfoGrid>
                    <InfoRow label="เลขที่เอกสาร">
                      {displayText(document.doc_no)}
                    </InfoRow>

                    <InfoRow label="วันที่เอกสาร">
                      {displayDate(document.doc_date)}
                    </InfoRow>

                    <InfoRow label="จำนวนรอบตรวจ">
                      {document.rows.length} รอบ
                    </InfoRow>

                    <InfoRow label="แก้ไขล่าสุด">
                      {displayDateTime(document.updated_at)}
                    </InfoRow>
                  </InfoGrid>
                </SectionCard>

                {/* Product Information */}

                <SectionCard title="ข้อมูลผลิตภัณฑ์">
                  <InfoGrid>
                    <InfoRow label="ชื่อผลิตภัณฑ์">
                      {displayText(document.product_name)}
                    </InfoRow>

                    <InfoRow label="หมายเลขล็อต">
                      {displayText(document.lot_no)}
                    </InfoRow>

                    <InfoRow label="จำนวนบรรจุ">
                      {displayText(document.pack_count)}
                    </InfoRow>

                    <InfoRow label="เกณฑ์น้ำหนัก">
                      {displayText(document.weight_spec)}
                    </InfoRow>
                  </InfoGrid>
                </SectionCard>

                {/* Weight Check Results */}

                <SectionCard
                  title="ผลการตรวจสอบน้ำหนัก"
                  subtitle={`ทั้งหมด ${document.rows.length} รอบตรวจ`}
                >
                  <div className="space-y-4">
                    {document.rows.map((row, rowIndex) => (
                      <div
                        key={row.id}
                        className="min-w-0 space-y-4 rounded-lg border bg-background p-4"
                      >
                        {/* Row Header */}

                        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                          <div className="space-y-1">
                            <h3 className="font-semibold">
                              รอบตรวจที่ {rowIndex + 1}
                            </h3>

                            <p className="text-sm text-muted-foreground">
                              เวลา {displayText(row.time)}
                            </p>
                          </div>

                          <StatusBadge
                            tone={
                              row.result === "PASS"
                                ? "success"
                                : row.result === "FAIL"
                                  ? "destructive"
                                  : "neutral"
                            }
                          >
                            {qcWeightResultLabel(row.result)}
                          </StatusBadge>
                        </div>

                        {/* Measurement Groups */}

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {QC_WEIGHT_GROUP_KEYS.map((group, groupIndex) => (
                            <div
                              key={group}
                              className="min-w-0 rounded-lg border bg-muted/20 p-3"
                            >
                              <h4 className="mb-3 text-sm font-semibold">
                                กลุ่มที่ {groupIndex + 1}
                              </h4>

                              <div className="grid grid-cols-4 gap-2">
                                {QC_WEIGHT_READING_INDEXES.map((index) => (
                                  <div
                                    key={index}
                                    className="min-w-0 space-y-1 rounded-md border bg-background p-2 text-center"
                                  >
                                    <p className="text-xs text-muted-foreground">
                                      ค่า {index + 1}
                                    </p>

                                    <p className="wrap-break-word text-sm font-semibold tabular-nums">
                                      {displayText(
                                        row.measurements[group][index],
                                      )}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Average And Result */}

                        <div className="border-t pt-3">
                          <InfoGrid>
                            <InfoRow label="ค่าเฉลี่ย">
                              {displayText(row.average)}
                            </InfoRow>

                            <InfoRow label="ผลการตรวจสอบ">
                              {qcWeightResultLabel(row.result)}
                            </InfoRow>
                          </InfoGrid>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Remark */}

                <SectionCard title="หมายเหตุ">
                  <p className="wrap-break-word whitespace-pre-wrap text-sm leading-relaxed">
                    {displayText(document.remark)}
                  </p>
                </SectionCard>

                {/* Prepared And Checked */}

                <SectionCard title="ผู้จัดทำและผู้ตรวจสอบ">
                  <InfoGrid>
                    <InfoRow label="ผู้จัดทำ">
                      {displayText(document.prepared_by)}
                    </InfoRow>

                    <InfoRow label="วันที่">
                      {displayDate(document.prepared_date)}
                    </InfoRow>

                    <InfoRow label="ผู้ตรวจสอบ">
                      {displayText(document.checked_by)}
                    </InfoRow>

                    <InfoRow label="วันที่">
                      {displayDate(document.checked_date)}
                    </InfoRow>
                  </InfoGrid>
                </SectionCard>
              </div>
            ))}
        </div>

        {/* Actions */}

        <DialogFooter className="shrink-0">
          {document && !print && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onEdit(document)}
              >
                <Pencil className="size-4" aria-hidden="true" />
                แก้ไข
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onPrint(document)}
              >
                <Printer className="size-4" aria-hidden="true" />
                พรีวิว A4
              </Button>
            </>
          )}

          <Button type="button" onClick={onClose}>
            {print ? "ปิดพรีวิว" : "ปิดรายละเอียด"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
