"use client";

import { Pencil, Printer, X } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
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

import {
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE,
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE,
  ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT,
  calculateOrganicExtractionMaterialClosingBalance,
  formatOrganicExtractionMaterialDate,
  formatOrganicExtractionMaterialSavedDate,
  hasOrganicExtractionMaterialQuantityEntry,
  type OrganicExtractionMaterialLedgerSheet,
} from "./organic_extraction_material_ledger_domain";
import { OrganicExtractionMaterialLedgerPaper } from "./organic_extraction_material_ledger_paper";

type Props = {
  sheet: OrganicExtractionMaterialLedgerSheet | null;
  print: boolean;
  onClose: () => void;
  onEdit: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
  onPrint: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
};

const labels = {
  details: "รายละเอียดเอกสาร",
  previewDescription: "ตัวอย่างรูปแบบเอกสารก่อนพิมพ์",
  readOnly: "แสดงข้อมูลแบบอ่านอย่างเดียว",
  mock: "UI MOCK ไม่เชื่อมฐานข้อมูลจริง",
  internalId: "รหัสเอกสารภายใน",
  created: "วันที่บันทึก",
  materials: "จำนวนรายการวัตถุดิบ",
  manual: "ยอดยกมาของเอกสารนี้เป็นข้อมูลที่กรอกเอง ไม่ได้ดึงจากเอกสารก่อนหน้า",
  invalid: "กรุณาตรวจสอบข้อมูลตัวเลข",
  close: "ปิด",
  paper: "พรีวิวเอกสาร",
  viewPreview: "พรีวิวก่อนพิมพ์",
  formCode: "รหัสแบบฟอร์ม",
  docDate: "วันที่เอกสาร",
  updated: "อัปเดตล่าสุด",
  row: "ลำดับ",
  materialCode: "รหัสวัตถุดิบ",
  materialName: "รายชื่อวัตถุดิบ",
  unit: "หน่วย",
  opening: "ยอดยกมา",
  received: "รับเข้า (+)",
  issued: "จ่าย (-)",
  production: "ใช้ผลิต",
  adjustment: "ปรับค่า",
  waste: "ทิ้ง (เสีย)",
  closing: "ยอดคงเหลือ",
  remark: "หมายเหตุ",
  prepared: "ผู้จัดทำ",
  inspected: "ผู้ตรวจสอบ",
  edit: "แก้ไข",
} as const;

const headClass =
  "border border-border bg-muted/40 px-2 py-3 text-center " +
  "align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle text-sm";

function displayText(value: string): string {
  return value.trim() || "-";
}

/** Format only for display. Keep the stored decimal strings unchanged. */
function displayQuantity(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "-";
  }

  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return raw;
  }

  const [integerPart = "", fractionPart] = normalized.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionPart === undefined ? grouped : `${grouped}.${fractionPart}`;
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-break-word text-sm font-medium text-foreground">
        {displayText(value)}
      </dd>
    </div>
  );
}

export function OrganicExtractionMaterialLedgerDetail({
  sheet,
  print,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  const displayDate = sheet
    ? formatOrganicExtractionMaterialDate(sheet.document_date) ||
      sheet.document_date ||
      "-"
    : "-";
  const populatedCount = sheet
    ? sheet.rows.filter(hasOrganicExtractionMaterialQuantityEntry).length
    : 0;

  return (
    <Dialog
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-none flex-col gap-4 overflow-hidden p-4 sm:max-w-350 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? labels.paper : labels.details}{" "}
            {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
          </DialogTitle>
          <DialogDescription>
            {print ? labels.previewDescription : labels.readOnly}
            {" / "}{labels.mock}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {sheet &&
            (print ? (
              <div className="min-w-max">
                <OrganicExtractionMaterialLedgerPaper sheet={sheet} />
              </div>
            ) : (
              <div className="min-w-0 space-y-5">
                <section className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 text-base font-semibold text-foreground">
                      {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
                    </h2>
                    <span className="text-sm font-medium text-foreground">
                      {labels.docDate}: {displayDate}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label={labels.internalId} value={sheet.id} />
                    <DetailField
                      label={labels.formCode}
                      value={ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE}
                    />
                    <DetailField
                      label={labels.prepared}
                      value={sheet.prepared_by}
                    />
                    <DetailField
                      label={labels.inspected}
                      value={sheet.inspected_by}
                    />
                    <DetailField
                      label={labels.created}
                      value={formatOrganicExtractionMaterialSavedDate(sheet.created_at)}
                    />
                    <DetailField
                      label={labels.updated}
                      value={formatOrganicExtractionMaterialSavedDate(sheet.updated_at)}
                    />
                    <DetailField
                      label={labels.materials}
                      value={`${populatedCount} / ${ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT}`}
                    />
                  </dl>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {labels.manual}
                  </p>
                </section>

                <section className="min-w-0 rounded-lg border border-border bg-surface p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {sheet.rows.length} {labels.row}
                    </span>
                  </div>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-border">
                    <Table className="w-full min-w-365 table-fixed border-collapse text-sm">
                      <caption className="sr-only">
                        {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
                        {" / "}{displayDate}
                      </caption>
                      <colgroup>
                        <col className="w-14" />
                        <col className="w-30" />
                        <col className="w-60" />
                        <col className="w-20" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-32" />
                        <col className="w-36" />
                        <col className="w-52" />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.row}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.materialCode}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.materialName}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.unit}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.opening}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.received}
                          </TableHead>
                          <TableHead colSpan={3} className={headClass}>
                            {labels.issued}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.closing}
                          </TableHead>
                          <TableHead rowSpan={2} className={headClass}>
                            {labels.remark}
                          </TableHead>
                        </TableRow>
                        <TableRow>
                          <TableHead className={headClass}>
                            {labels.production}
                          </TableHead>
                          <TableHead className={headClass}>
                            {labels.adjustment}
                          </TableHead>
                          <TableHead className={headClass}>
                            {labels.waste}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheet.rows.map((row) => {
                          const closingBalance =
                            calculateOrganicExtractionMaterialClosingBalance(row);
                          const hasEntry =
                            hasOrganicExtractionMaterialQuantityEntry(row);
                          const isNegative =
                            closingBalance?.startsWith("-") ?? false;

                          return (
                            <TableRow key={row.row_number}>
                              <TableCell className={`${cellClass} text-center tabular-nums`}>
                                {row.row_number}
                              </TableCell>
                              <TableCell className={`${cellClass} font-medium`}>
                                {displayText(row.material_code)}
                              </TableCell>
                              <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                                {displayText(row.material_name)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-center`}>
                                {displayText(row.unit)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-right tabular-nums`}>
                                {displayQuantity(row.opening_balance)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-right tabular-nums`}>
                                {displayQuantity(row.received)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-right tabular-nums`}>
                                {displayQuantity(row.issued_for_production)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-right tabular-nums`}>
                                {displayQuantity(row.issued_adjustment)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-right tabular-nums`}>
                                {displayQuantity(row.issued_waste)}
                              </TableCell>
                              <TableCell
                                className={`${cellClass} bg-muted/10 text-right font-semibold tabular-nums ${isNegative ? "text-danger" : "text-foreground"}`}
                              >
                                {closingBalance === null
                                  ? hasEntry
                                    ? labels.invalid
                                    : "-"
                                  : displayQuantity(closingBalance)}
                              </TableCell>
                              <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                                {displayText(row.remark)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </div>
            ))}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          {sheet && (
            <>
              <Button type="button" variant="outline" onClick={() => onEdit(sheet)}>
                <Pencil className="size-4" aria-hidden="true" />
                {labels.edit}
              </Button>
              {!print && (
                <Button type="button" onClick={() => onPrint(sheet)}>
                  <Printer className="size-4" aria-hidden="true" />
                  {labels.viewPreview}
                </Button>
              )}
            </>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="size-4" aria-hidden="true" />
              {labels.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
