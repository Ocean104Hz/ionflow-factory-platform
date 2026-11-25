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
  ORGANIC_QC_RESULTS,
  ORGANIC_RAW_MATERIAL_FORM_CODE,
  ORGANIC_RAW_MATERIAL_FORM_TITLE,
  ORGANIC_RAW_MATERIAL_ROW_COUNT,
  formatOrganicMaterialDate,
  formatOrganicMaterialDateTime,
  getOrganicMaterialUsedRows,
  getOrganicQcLabel,
  type OrganicQcField,
  type OrganicQcResult,
  type OrganicRawMaterialReceivingSheet,
} from "./organic_raw_material_receiving_domain";
import { OrganicRawMaterialReceivingPaper } from "./organic_raw_material_receiving_paper";

type Props = {
  sheet: OrganicRawMaterialReceivingSheet | null;
  print: boolean;
  onClose: () => void;
  onEdit: (sheet: OrganicRawMaterialReceivingSheet) => void;
  onPrint: (sheet: OrganicRawMaterialReceivingSheet) => void;
};

const labels = {
  detailTitle: "รายละเอียดใบตรวจรับวัตถุดิบ",
  printTitle: "พรีวิวใบตรวจรับวัตถุดิบ",
  detailDescription: "แสดงข้อมูลแบบอ่านอย่างเดียว",
  printDescription: "พรีวิวรูปแบบเอกสารก่อนพิมพ์",
  mock: "เอกสารชุดอินทรีย์",
  date: "วันที่เอกสาร",
  id: "รหัสเอกสารภายใน",
  slots: "จำนวนแถวทั้งหมด",
  used: "รายการที่บันทึก",
  receivedBy: "ผู้รับ",
  inspectedBy: "ผู้ตรวจสอบ",
  created: "วันที่บันทึก",
  updated: "อัปเดตล่าสุด",
  number: "ลำดับ",
  material: "รหัสวัตถุดิบ",
  supplier: "รหัส Supplier",
  quantity: "จำนวน",
  unit: "หน่วย",
  qc: "การตรวจสอบคุณภาพ",
  weight: "น้ำหนัก",
  contamination: "สิ่งปนเปื้อน",
  physical: "กายภาพ",
  color: "สี",
  remark: "หมายเหตุ",
  legend: "สัญลักษณ์ผลตรวจ",
  edit: "แก้ไข",
  preview: "พรีวิวก่อนพิมพ์",
  close: "ปิด",
} as const;

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle text-sm";

const qcColumns: ReadonlyArray<{ field: OrganicQcField; label: string }> = [
  { field: "qc_weight", label: labels.weight },
  { field: "qc_contamination", label: labels.contamination },
  { field: "qc_physical", label: labels.physical },
  { field: "qc_color", label: labels.color },
];

function displayText(value: string): string {
  return value.trim() || "-";
}

function displayQuantity(value: string): string {
  const normalized = value.trim().replaceAll(",", "");

  if (!normalized) {
    return "-";
  }

  const [whole, fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function QcResultCell({ value }: { value: OrganicQcResult }) {
  return (
    <span
      title={getOrganicQcLabel(value) || undefined}
      className="font-semibold tabular-nums"
    >
      {value || "-"}
    </span>
  );
}

export function OrganicRawMaterialReceivingDetail({
  sheet,
  print,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  return (
    <Dialog
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent variant={print ? "preview" : "default"} className="flex max-h-[94dvh] w-[96vw] max-w-none flex-col gap-4 overflow-hidden p-4 sm:max-w-350 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print ? labels.printTitle : labels.detailTitle}
          </DialogTitle>
          <DialogDescription>
            {print ? labels.printDescription : labels.detailDescription}
            {" · "}
            {labels.mock}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {sheet &&
            (print ? (
              <div className="min-w-max">
                <OrganicRawMaterialReceivingPaper sheet={sheet} />
              </div>
            ) : (
              <div className="min-w-0 space-y-5">
                <section className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold">
                        {ORGANIC_RAW_MATERIAL_FORM_TITLE}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ORGANIC_RAW_MATERIAL_FORM_CODE}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {labels.date}: {formatOrganicMaterialDate(sheet.document_date) || "-"}
                    </p>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: labels.id, value: sheet.id },
                      { label: labels.receivedBy, value: sheet.received_by },
                      { label: labels.inspectedBy, value: sheet.inspected_by },
                      {
                        label: labels.created,
                        value: formatOrganicMaterialDateTime(sheet.created_at),
                      },
                      {
                        label: labels.updated,
                        value: formatOrganicMaterialDateTime(sheet.updated_at),
                      },
                      {
                        label: labels.slots,
                        value: String(ORGANIC_RAW_MATERIAL_ROW_COUNT),
                      },
                      {
                        label: labels.used,
                        value: String(getOrganicMaterialUsedRows(sheet).length),
                      },
                    ].map((field) => (
                      <div key={field.label} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                          {field.label}
                        </dt>
                        <dd className="mt-1 wrap-break-word font-medium">
                          {displayText(field.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="min-w-0 rounded-lg border border-border bg-surface p-4">
                  <h3 className="mb-3 font-semibold">{labels.qc}</h3>

                  <div className="max-w-full overflow-x-auto rounded-lg border border-border">
                    <Table className="w-full min-w-300 table-fixed border-collapse">
                      <caption className="sr-only">
                        {ORGANIC_RAW_MATERIAL_FORM_TITLE}
                      </caption>
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                        <col className="w-[9%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[9%]" />
                        <col className="w-[8%]" />
                        <col className="w-[8%]" />
                        <col className="w-[19%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.number}
                          </TableHead>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.material}
                          </TableHead>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.supplier}
                          </TableHead>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.quantity}
                          </TableHead>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.unit}
                          </TableHead>
                          <TableHead colSpan={4} className={headerClass}>
                            {labels.qc}
                          </TableHead>
                          <TableHead rowSpan={2} className={headerClass}>
                            {labels.remark}
                          </TableHead>
                        </TableRow>
                        <TableRow>
                          {qcColumns.map((column) => (
                            <TableHead key={column.field} className={headerClass}>
                              {column.label}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from(
                          { length: ORGANIC_RAW_MATERIAL_ROW_COUNT },
                          (_, index) => {
                            const rowNumber = index + 1;
                            const row = sheet.rows.find(
                              (entry) => entry.row_number === rowNumber,
                            );

                            return (
                              <TableRow key={rowNumber} className="align-middle">
                                <TableCell className={`${cellClass} text-center tabular-nums`}>
                                  {rowNumber}
                                </TableCell>
                                <TableCell className={`${cellClass} wrap-break-word`}>
                                  {displayText(row?.material_code ?? "")}
                                </TableCell>
                                <TableCell className={`${cellClass} wrap-break-word`}>
                                  {displayText(row?.supplier_code ?? "")}
                                </TableCell>
                                <TableCell className={`${cellClass} text-right tabular-nums`}>
                                  {displayQuantity(row?.quantity ?? "")}
                                </TableCell>
                                <TableCell className={`${cellClass} text-center`}>
                                  {displayText(row?.unit ?? "")}
                                </TableCell>
                                {qcColumns.map((column) => (
                                  <TableCell
                                    key={column.field}
                                    className={`${cellClass} text-center`}
                                  >
                                    <QcResultCell value={row?.[column.field] ?? ""} />
                                  </TableCell>
                                ))}
                                <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                                  {displayText(row?.remark ?? "")}
                                </TableCell>
                              </TableRow>
                            );
                          },
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {labels.legend}:
                    </span>
                    {ORGANIC_QC_RESULTS.map((result) => (
                      <span key={result.value}>
                        <span className="font-semibold">{result.value}</span>
                        {` = ${result.label}`}
                      </span>
                    ))}
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
                  {labels.preview}
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
