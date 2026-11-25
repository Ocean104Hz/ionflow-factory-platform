import {
  EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT,
  type EffervescentMaterialLedgerRow,
  type EffervescentMaterialLedgerSheet,
} from "./effervescent_material_ledger_domain";

/**
 *
 * แสดงแบบฟอร์มรับ - จ่ายวัตถุดิบเม็ดฟู่สำหรับพรีวิวและพิมพ์
 * ใช้ข้อความปริมาณที่บันทึกไว้โดยตรง ไม่คำนวณยอดคงเหลือ
 * และไม่กำหนดความหมายของช่องปรับค่า
 *
 * ขนาดหน้ากระดาษอ้างอิง A4 แนวนอน
 * การเลือกแนวกระดาษทำในหน้าต่างพิมพ์ของเบราว์เซอร์
 */

type Props = {
  sheet: EffervescentMaterialLedgerSheet;
};

const DOCUMENT = EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT;

const headerClass =
  "border border-black bg-white px-1 py-1 text-center " +
  "align-middle text-[10px] font-semibold leading-tight " +
  "whitespace-normal text-black";

const cellClass =
  "h-[5.8mm] border border-black px-1 py-0.5 " +
  "align-middle text-[10px] leading-tight " +
  "whitespace-pre-wrap wrap-break-word text-black";

const numericCellClass = `${cellClass} text-right tabular-nums`;

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatRecordDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return "";
  }

  return dateFormatter.format(date);
}

function splitPaperRows(
  rows: readonly EffervescentMaterialLedgerRow[],
): EffervescentMaterialLedgerRow[][] {
  const pageSize = DOCUMENT.paper_row_count;
  const pages: EffervescentMaterialLedgerRow[][] = [];

  for (let index = 0; index < rows.length; index += pageSize) {
    pages.push(rows.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[]];
}

export function EffervescentMaterialLedgerPaper({ sheet }: Props) {
  const pages = splitPaperRows(sheet.rows);

  return (
    <div className="space-y-5 print:space-y-0">
      {pages.map((pageRows, pageIndex) => {
        const paddedRows: (EffervescentMaterialLedgerRow | null)[] = [
          ...pageRows,
        ];

        while (paddedRows.length < DOCUMENT.paper_row_count) {
          paddedRows.push(null);
        }

        const isLastPage = pageIndex === pages.length - 1;

        return (
          <article
            key={`${sheet.id || "draft"}-page-${pageIndex + 1}`}
            aria-label={`${DOCUMENT.title} หน้า ${pageIndex + 1} จาก ${pages.length}`}
            className={
              "mx-auto box-border min-h-[190mm] w-[277mm] " +
              "bg-white px-[5mm] pb-[5mm] pt-[4mm] text-black shadow-md " +
              "print:m-0 print:break-after-page print:shadow-none " +
              "last:print:break-after-auto"
            }
          >
            {/* ส่วนหัวเอกสาร */}
            <header className="mb-[3mm] text-black">
              <p className="text-center text-[14px] font-bold leading-5">
                {DOCUMENT.company_name}
              </p>
              <h2 className="text-center text-[14px] font-bold leading-5">
                {DOCUMENT.title}
              </h2>

              <div className="mt-[2mm] flex items-end justify-end gap-2 text-[11px]">
                <span>วันที่</span>
                <span className="inline-block min-w-[38mm] border-b border-black px-1 text-center tabular-nums">
                  {formatRecordDate(sheet.record_date)}
                </span>
              </div>
            </header>

            {/* ตารางรับ-จ่ายตามโครงสร้าง Excel */}
            <table className="w-full table-fixed border-collapse text-black">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[12%]" />
                <col className="w-[20%]" />
                <col className="w-[5%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
              </colgroup>

              <thead>
                <tr>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    No.
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    CODE
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    รายชื่อวัตถุดิบ
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    หน่วย
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    ยอดยกมา
                  </th>
                  <th scope="col" className={headerClass}>
                    รับเข้า
                  </th>
                  <th colSpan={3} scope="colgroup" className={headerClass}>
                    จ่าย (-)
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    ยอดคงเหลือ
                  </th>
                  <th rowSpan={2} scope="col" className={headerClass}>
                    หมายเหตุ
                  </th>
                </tr>
                <tr>
                  <th scope="col" className={headerClass}>
                    (+)
                  </th>
                  <th scope="col" className={headerClass}>
                    ใช้ผลิต
                  </th>
                  <th scope="col" className={headerClass}>
                    ปรับค่า
                  </th>
                  <th scope="col" className={headerClass}>
                    ทิ้ง ( เสีย )
                  </th>
                </tr>
              </thead>

              <tbody>
                {paddedRows.map((row, rowIndex) => (
                  <tr
                    key={row?.id ?? `empty-${pageIndex}-${rowIndex}`}
                    className="break-inside-avoid"
                  >
                    <td className={`${cellClass} text-center tabular-nums`}>
                      {row?.no ?? ""}
                    </td>
                    <td className={cellClass}>{row?.code ?? ""}</td>
                    <td className={cellClass}>
                      {row?.material_name ?? ""}
                    </td>
                    <td className={`${cellClass} text-center`}>
                      {row?.unit ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.opening_balance ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.received ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.production_use ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.adjustment ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.discarded ?? ""}
                    </td>
                    <td className={numericCellClass}>
                      {row?.closing_balance ?? ""}
                    </td>
                    <td className={cellClass}>
                      {row?.remark ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ส่วนท้ายเอกสารปรากฏในหน้าสุดท้าย */}
            {isLastPage && (
              <div className="mt-[3mm] text-[11px] leading-5">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 font-semibold">
                    รายการผลิต
                  </span>
                  <div className="min-h-[10mm] flex-1 whitespace-pre-wrap wrap-break-word border-b border-black px-1">
                    {sheet.production_list}
                  </div>
                </div>

                <div className="mt-[5mm] grid grid-cols-2 gap-[12mm]">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">ผู้จัดทำ</span>
                    <span className="min-h-[6mm] flex-1 whitespace-pre-wrap wrap-break-word border-b border-dotted border-black px-1 text-center">
                      {sheet.prepared_by}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">ผู้ตรวจสอบ</span>
                    <span className="min-h-[6mm] flex-1 whitespace-pre-wrap wrap-break-word border-b border-dotted border-black px-1 text-center">
                      {sheet.checked_by}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <footer className="mt-[4mm] text-right text-[10px] text-black">
              {DOCUMENT.form_code}
            </footer>
          </article>
        );
      })}
    </div>
  );
}
