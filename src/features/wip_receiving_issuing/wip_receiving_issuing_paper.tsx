import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  WIP_FORM_CODE,
  WIP_MASTER_ITEMS,
  WIP_QUANTITY_FIELDS,
  calculateWipClosingBalance,
  formatWipDate,
  getWipItemDisplayName,
  type WipReceivingIssuingSheet,
} from "./wip_receiving_issuing_domain";

/* ---------------- types ---------------- */

type Props = {
  sheet: WipReceivingIssuingSheet;
};

/* ---------------- labels ---------------- */

const labels = {
  title: "บันทึกการรับ-จ่าย WIP",
  date: "วันที่",
  number: "No.",
  item: "รายการ",
  unit: "หน่วย",
  opening: "ยอดยกมา",
  received: "รับ",
  issued: "จ่าย (-)",
  production: "ผลิต",
  product: "สินค้า",
  transfer: "โอน",
  closing: "คงเหลือ",
  remark: "หมายเหตุ",
  prepared: "ผู้จัดทำ",
  checked: "ผู้ตรวจสอบ",
} as const;

/* ---------------- paper styles ---------------- */

const headerClass = [
  "!h-auto border border-black bg-white",
  "!px-1 !py-1.5 text-center align-middle",
  "text-[10px] font-semibold leading-tight",
  "!whitespace-normal !text-black",
].join(" ");

const cellClass = [
  "h-[9mm] border border-black",
  "!p-1 !align-middle text-[10px] leading-tight",
  "break-words [overflow-wrap:anywhere]",
  "!whitespace-pre-wrap !text-black",
].join(" ");

const centeredCellClass = `${cellClass} text-center`;
const numericCellClass = `${cellClass} text-right tabular-nums`;

/* ---------------- helpers ---------------- */

function formatQuantity(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.replaceAll(",", "");
  const [whole, fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/* ---------------- component ---------------- */

export function WipReceivingIssuingPaper({ sheet }: Props) {
  return (
    <article
      aria-label={labels.title}
      className={[
        "relative mx-auto box-border",
        "min-h-[190mm] w-[277mm]",
        "bg-white px-[5mm] pb-[15mm] pt-[4mm]",
        "text-black shadow-md",
        "print:m-0 print:break-after-auto print:shadow-none",
      ].join(" ")}
    >
      {/* Document header */}
      <header className="relative mb-[4mm] min-h-[19mm] text-center">
        <h2 className="pt-[3mm] text-[13px] font-bold leading-5">
          {labels.title}
        </h2>
        <p className="absolute bottom-0 right-0 text-[10px]">
          {labels.date} {formatWipDate(sheet.document_date) || "........................"}
        </p>
      </header>

      {/* WIP table: 11 fixed rows in the same order as the paper form */}
      <Table className="w-full table-fixed border-collapse text-black">
        <caption className="sr-only">{labels.title}</caption>
        <colgroup>
          <col className="w-[5%]" />
          <col className="w-[16%]" />
          <col className="w-[7%]" />
          <col className="w-[11%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[14%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="border-0 hover:bg-white">
            <TableHead rowSpan={2} className={headerClass}>
              {labels.number}
            </TableHead>
            <TableHead rowSpan={2} className={headerClass}>
              {labels.item}
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
            <TableHead className={headerClass}>{labels.production}</TableHead>
            <TableHead className={headerClass}>{labels.product}</TableHead>
            <TableHead className={headerClass}>{labels.transfer}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {WIP_MASTER_ITEMS.map((item, index) => {
            const row = sheet.rows.find((entry) => entry.item_id === item.id);
            const hasQuantity = row
              ? WIP_QUANTITY_FIELDS.some((field) => row[field].trim() !== "")
              : false;
            const closingBalance = row && hasQuantity
              ? calculateWipClosingBalance(row)
              : null;

            return (
              <TableRow
                key={item.id}
                className="border-0 hover:bg-white print:break-inside-avoid"
              >
                <TableCell className={centeredCellClass}>{index + 1}</TableCell>
                <TableCell className={cellClass}>
                  {getWipItemDisplayName(item.id)}
                </TableCell>
                <TableCell className={centeredCellClass}>{item.unit}</TableCell>
                <TableCell className={numericCellClass}>
                  {formatQuantity(row?.opening_balance ?? "")}
                </TableCell>
                <TableCell className={numericCellClass}>
                  {formatQuantity(row?.received ?? "")}
                </TableCell>
                <TableCell className={numericCellClass}>
                  {formatQuantity(row?.issued_for_production ?? "")}
                </TableCell>
                <TableCell className={numericCellClass}>
                  {formatQuantity(row?.issued_as_product ?? "")}
                </TableCell>
                <TableCell className={numericCellClass}>
                  {formatQuantity(row?.transferred_out ?? "")}
                </TableCell>
                <TableCell className={numericCellClass}>
                  {closingBalance === null ? "" : formatQuantity(closingBalance)}
                </TableCell>
                <TableCell className={cellClass}>{row?.remark ?? ""}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Signature fields: no signature is fabricated */}
      <footer className="mt-[5mm] flex items-end justify-between gap-[8mm] text-[10px]">
        <p className="flex min-w-0 flex-1 items-end gap-1">
          <span className="shrink-0">{labels.prepared}</span>
          <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 pb-0.5 text-center">
            {sheet.prepared_by.trim() || " "}
          </span>
        </p>
        <p className="flex min-w-0 flex-1 items-end gap-1">
          <span className="shrink-0">{labels.checked}</span>
          <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 pb-0.5 text-center">
            {sheet.checked_by.trim() || " "}
          </span>
        </p>
      </footer>

      <p className="absolute bottom-[3mm] right-[5mm] text-[9px] text-black">
        {WIP_FORM_CODE}
      </p>
    </article>
  );
}
