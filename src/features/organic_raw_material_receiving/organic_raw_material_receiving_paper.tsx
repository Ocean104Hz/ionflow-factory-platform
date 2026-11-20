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
  type OrganicQcField,
  type OrganicRawMaterialReceivingSheet,
} from "./organic_raw_material_receiving_domain";

type Props = {
  sheet: OrganicRawMaterialReceivingSheet;
};

const labels = {
  company: "บริษัท ไอออนิค จำกัด",
  factory: "โรงงานกาญจนบุรี 2",
  date: "วันที่",
  number: "ลำดับ",
  material: "รหัสวัตถุดิบ",
  supplier: "รหัส Supplier",
  quantity: "จำนวน",
  unit: "หน่วย",
  quality: "การตรวจสอบคุณภาพ",
  weight: "น้ำหนัก",
  contamination: "สิ่งปนเปื้อน",
  physical: "กายภาพ",
  color: "สี",
  remark: "หมายเหตุ",
  receivedBy: "ผู้รับ",
  inspectedBy: "ผู้ตรวจสอบ",
} as const;

const qcColumns: ReadonlyArray<{ field: OrganicQcField; label: string }> = [
  { field: "qc_weight", label: labels.weight },
  { field: "qc_contamination", label: labels.contamination },
  { field: "qc_physical", label: labels.physical },
  { field: "qc_color", label: labels.color },
];

const headerClass = [
  "!h-auto border border-black bg-white",
  "!px-1 !py-1.5 text-center align-middle",
  "text-[10px] font-semibold leading-tight",
  "!whitespace-normal !text-black",
].join(" ");

const cellClass = [
  "h-[9mm] border border-black",
  "!px-[1mm] !py-[1mm] align-middle",
  "text-[10px] leading-tight break-words [overflow-wrap:anywhere]",
  "!whitespace-pre-wrap !text-black",
].join(" ");

function formatQuantity(value: string): string {
  const normalized = value.trim().replaceAll(",", "");
  if (!normalized) {
    return "";
  }

  const [whole, fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function OrganicRawMaterialReceivingPaper({ sheet }: Props) {
  return (
    <article
      aria-label={ORGANIC_RAW_MATERIAL_FORM_TITLE}
      className={[
        "mx-auto box-border w-[277mm] min-h-[190mm]",
        "bg-white p-[4mm] text-black shadow-md",
        "print:m-0 print:break-after-auto print:shadow-none",
      ].join(" ")}
    >
      <div className="flex min-h-[182mm] flex-col border border-black">
        <header className="shrink-0">
          <div className="space-y-1 px-[4mm] pb-[3mm] pt-[4mm] text-center">
            <p className="text-[12px] font-semibold leading-5">
              {labels.company}
            </p>
            <p className="text-[11px] font-semibold leading-5">
              {labels.factory}
            </p>
            <h2 className="text-[12px] font-bold leading-5">
              {ORGANIC_RAW_MATERIAL_FORM_TITLE}
            </h2>
          </div>
          <div className="flex min-h-[11mm] items-center justify-end gap-2 border-t border-black px-[4mm] text-[11px]">
            <span>{labels.date}</span>
            <span className="inline-block min-w-[39mm] border-b border-dotted border-black px-1 text-center tabular-nums">
              {formatOrganicMaterialDate(sheet.document_date) || "\u00a0"}
            </span>
          </div>
        </header>

        <Table className="w-full table-fixed border-collapse text-black">
          <caption className="sr-only">{ORGANIC_RAW_MATERIAL_FORM_TITLE}</caption>
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
            <TableRow className="border-0 hover:bg-white">
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
                {labels.quality}
              </TableHead>
              <TableHead rowSpan={2} className={headerClass}>
                {labels.remark}
              </TableHead>
            </TableRow>
            <TableRow className="border-0 hover:bg-white">
              {qcColumns.map((column) => (
                <TableHead key={column.field} className={headerClass}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: ORGANIC_RAW_MATERIAL_ROW_COUNT }, (_, index) => {
              const rowNumber = index + 1;
              const row = sheet.rows.find((entry) => entry.row_number === rowNumber);

              return (
                <TableRow
                  key={rowNumber}
                  className="border-0 hover:bg-white print:break-inside-avoid"
                >
                  <TableCell className={`${cellClass} text-center tabular-nums`}>
                    {rowNumber}
                  </TableCell>
                  <TableCell className={cellClass}>
                    {row?.material_code ?? ""}
                  </TableCell>
                  <TableCell className={cellClass}>
                    {row?.supplier_code ?? ""}
                  </TableCell>
                  <TableCell className={`${cellClass} text-right tabular-nums`}>
                    {formatQuantity(row?.quantity ?? "")}
                  </TableCell>
                  <TableCell className={`${cellClass} text-center`}>
                    {row?.unit ?? ""}
                  </TableCell>
                  {qcColumns.map((column) => (
                    <TableCell
                      key={column.field}
                      className={`${cellClass} text-center font-semibold`}
                    >
                      {row?.[column.field] ?? ""}
                    </TableCell>
                  ))}
                  <TableCell className={cellClass}>
                    {row?.remark ?? ""}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <footer className="mt-auto shrink-0 border-t border-black px-[4mm] pb-[4mm] pt-[3mm]">
          <div className="flex flex-wrap items-center justify-around gap-x-[7mm] gap-y-2 text-[11px]">
            {ORGANIC_QC_RESULTS.map((result) => (
              <span key={result.value}>
                <span className="font-semibold">{result.value}</span>
                {` = ${result.label}`}
              </span>
            ))}
          </div>

          <div className="mt-[7mm] grid grid-cols-2 gap-[10mm] text-[11px]">
            <p className="flex min-w-0 items-end gap-1">
              <span className="shrink-0">{labels.receivedBy}</span>
              <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
                {sheet.received_by.trim() || "\u00a0"}
              </span>
            </p>
            <p className="flex min-w-0 items-end gap-1">
              <span className="shrink-0">{labels.inspectedBy}</span>
              <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
                {sheet.inspected_by.trim() || "\u00a0"}
              </span>
            </p>
          </div>
          <p className="mt-[5mm] text-right text-[10px] font-semibold">
            {ORGANIC_RAW_MATERIAL_FORM_CODE}
          </p>
        </footer>
      </div>
    </article>
  );
}
