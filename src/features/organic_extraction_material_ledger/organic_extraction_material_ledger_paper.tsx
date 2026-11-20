import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  ORGANIC_EXTRACTION_MATERIAL_CODES,
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE,
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE,
  calculateOrganicExtractionMaterialClosingBalance,
  formatOrganicExtractionMaterialDate,
  hasOrganicExtractionMaterialQuantityEntry,
  type OrganicExtractionMaterialLedgerSheet,
} from "./organic_extraction_material_ledger_domain";

type Props = {
  sheet: OrganicExtractionMaterialLedgerSheet;
};

const labels = {
  company: "บริษัท ไอออนิค จำกัด",
  factory: "(โรงงานกาญจนบุรี 2)",
  date: "วันที่",
  number: "No.",
  code: "CODE",
  material: "รายชื่อวัตถุดิบ",
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
  invalid: "ตรวจสอบ",
} as const;

const headerClass = [
  "!h-auto border border-black bg-white",
  "!px-[1mm] !py-[1.5mm] text-center align-middle",
  "text-[9px] font-semibold leading-tight",
  "!whitespace-normal !text-black",
].join(" ");

const cellClass = [
  "h-[8.5mm] border border-black",
  "!px-[1mm] !py-[0.5mm] align-middle",
  "text-[9px] leading-tight [overflow-wrap:anywhere]",
  "!whitespace-pre-wrap !text-black",
].join(" ");

function formatQuantity(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return raw;
  }

  const [whole = "", fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

export function OrganicExtractionMaterialLedgerPaper({ sheet }: Props) {
  const documentDate = formatOrganicExtractionMaterialDate(sheet.document_date);

  return (
    <article
      aria-label={ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
      className={[
        "mx-auto box-border flex w-[210mm] min-h-[297mm] flex-col",
        "bg-white px-[9mm] pb-[10mm] pt-[11mm] text-black shadow-md",
        "print:m-0 print:break-after-auto print:shadow-none",
      ].join(" ")}
    >
      <header className="mb-[5mm] shrink-0">
        <div className="text-center">
          <p className="text-[12px] font-semibold leading-5">
            {labels.company} {labels.factory}
          </p>
          <h2 className="mt-[1mm] text-[12px] font-bold leading-5">
            {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
          </h2>
        </div>
        <div className="mt-[4mm] flex items-end justify-end gap-[2mm] text-[10px]">
          <span>{labels.date}</span>
          <span className="inline-block min-w-[33mm] border-b border-dotted border-black px-1 text-center tabular-nums">
            {documentDate || "\u00a0"}
          </span>
        </div>
      </header>

      <Table className="w-full table-fixed border-collapse text-black">
        <caption className="sr-only">
          {ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
        </caption>
        <colgroup>
          <col className="w-[4%]" />
          <col className="w-[11%]" />
          <col className="w-[17%]" />
          <col className="w-[6%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[8%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="border-0 hover:bg-white">
            <TableHead rowSpan={2} className={headerClass}>
              {labels.number}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.code}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.material}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.unit}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.opening}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.received}
            </TableHead>
            <TableHead colSpan={3} className={headerClass}>
              {labels.issued}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.closing}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.remark}
            </TableHead>
          </TableRow>
          <TableRow className="border-0 hover:bg-white">
            <TableHead className={headerClass}>
              {labels.production}
            </TableHead>
            <TableHead className={headerClass}>
              {labels.adjustment}
            </TableHead>
            <TableHead className={headerClass}>
              {labels.waste}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ORGANIC_EXTRACTION_MATERIAL_CODES.map((code, index) => {
            const rowNumber = index + 1;
            const row = sheet.rows.find((item) => item.row_number === rowNumber);
            const closingBalance = row
              ? calculateOrganicExtractionMaterialClosingBalance(row)
              : null;
            const hasEntry = row
              ? hasOrganicExtractionMaterialQuantityEntry(row)
              : false;
            const closingText = closingBalance === null
              ? hasEntry
                ? labels.invalid
                : ""
              : formatQuantity(closingBalance);

            return (
              <TableRow
                key={code}
                className="border-0 hover:bg-white print:break-inside-avoid"
              >
                <TableCell className={`${cellClass} text-center tabular-nums`}>
                  {rowNumber}
                </TableCell>
                <TableCell className={`${cellClass} text-center font-medium`}>
                  {row?.material_code ?? code}
                </TableCell>
                <TableCell className={cellClass}>
                  {row?.material_name ?? ""}
                </TableCell>
                <TableCell className={`${cellClass} text-center`}>
                  {row?.unit ?? "Kg"}
                </TableCell>
                <TableCell className={`${cellClass} text-right tabular-nums`}>
                  {formatQuantity(row?.opening_balance ?? "")}
                </TableCell>
                <TableCell className={`${cellClass} text-right tabular-nums`}>
                  {formatQuantity(row?.received ?? "")}
                </TableCell>
                <TableCell className={`${cellClass} text-right tabular-nums`}>
                  {formatQuantity(row?.issued_for_production ?? "")}
                </TableCell>
                <TableCell className={`${cellClass} text-right tabular-nums`}>
                  {formatQuantity(row?.issued_adjustment ?? "")}
                </TableCell>
                <TableCell className={`${cellClass} text-right tabular-nums`}>
                  {formatQuantity(row?.issued_waste ?? "")}
                </TableCell>
                <TableCell
                  className={`${cellClass} text-right font-semibold tabular-nums`}
                >
                  {closingText}
                </TableCell>
                <TableCell className={cellClass}>
                  {row?.remark ?? ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <footer className="mt-auto shrink-0 pt-[8mm] text-[10px]">
        <div className="grid grid-cols-2 gap-[18mm]">
          <p className="flex min-w-0 items-end gap-1">
            <span className="shrink-0">{labels.prepared}</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
              {sheet.prepared_by.trim() || "\u00a0"}
            </span>
          </p>
          <p className="flex min-w-0 items-end gap-1">
            <span className="shrink-0">{labels.inspected}</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
              {sheet.inspected_by.trim() || "\u00a0"}
            </span>
          </p>
        </div>
        <p className="mt-[7mm] text-right font-semibold">
          {ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE}
        </p>
      </footer>
    </article>
  );
}
