
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  blankLabSampleRow,
  formatLabDate,
  formatLabLotDate,
  LAB_PAPER_ROWS_PER_PAGE,
  splitLabPaperRows,
  type LabSampleReceivingSheet,
} from "./lab_sample_receiving_domain";

/* ---------------- types ---------------- */

type Props = {
  sheet: LabSampleReceivingSheet;
};

/* ---------------- styles ---------------- */

const headerClass = [
  "!h-auto",
  "border border-black",
  "bg-white",
  "!px-1 !py-1.5",
  "text-center text-[9px] font-semibold",
  "leading-tight !whitespace-normal !text-black",
].join(" ");

const cellClass = [
  "h-[6mm]",
  "border border-black",
  "!p-1 !align-middle",
  "text-[9px] leading-tight",
  "break-words [overflow-wrap:anywhere]",
  "!whitespace-pre-wrap !text-black",
].join(" ");

const centerCellClass = `${cellClass} text-center`;

/* ---------------- component ---------------- */

export function LabSampleReceivingPaper({
  sheet,
}: Props) {
  const pages = splitLabPaperRows(sheet.rows);

  return (
    <div className="space-y-5 print:space-y-0">
      {pages.map((pageRows, pageIndex) => {
        /* เติมแถวว่างตามแบบฟอร์มกระดาษ */

        const missingRows = Math.max(
          0,
          LAB_PAPER_ROWS_PER_PAGE - pageRows.length,
        );

        const emptyRows = Array.from(
          { length: missingRows },
          (_, index) =>
            blankLabSampleRow(
              `print-empty-${pageIndex}-${index}`,
            ),
        );

        const paddedRows = [
          ...pageRows,
          ...emptyRows,
        ];

        return (
          <article
            key={`${sheet.id || "draft"}-${pageIndex}`}
            aria-label={`แบบบันทึก i-Lab หน้า ${
              pageIndex + 1
            } จาก ${pages.length}`}
            className={[
              "relative mx-auto box-border",
              "min-h-[190mm] w-[277mm]",
              "bg-white px-[4mm] pb-[9mm] pt-[3mm]",
              "text-black shadow-md",
              "print:m-0 print:shadow-none",
              "print:break-after-page",
              "last:print:break-after-auto",
            ].join(" ")}
          >
            {/* Document Header */}

            <header className="relative mb-[3mm] min-h-[13mm] text-center">
              <p className="text-[12px] font-bold leading-5">
                i-Lab
              </p>

              <h2 className="text-[13px] font-bold leading-5">
                แบบบันทึกรับตัวอย่าง
              </h2>

              <p className="absolute right-0 top-0 text-[9px]">
                หน้า {pageIndex + 1} / {pages.length}
              </p>
            </header>

            {/* Document Table */}

            <Table className="w-full table-fixed border-collapse text-black">
              <colgroup>
                <col className="w-[5%]" />
                <col className="w-[5%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[20%]" />
                <col className="w-[7%]" />
                <col className="w-[7%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
              </colgroup>

              {/* Table Header */}

              <TableHeader>
                <TableRow className="border-0 hover:bg-white">
                  <TableHead className={headerClass}>
                    วันที่
                  </TableHead>

                  <TableHead className={headerClass}>
                    เวลา
                  </TableHead>

                  <TableHead
                    colSpan={3}
                    className={headerClass}
                  >
                    รายละเอียดตัวอย่าง
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    รายการวิเคราะห์
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    ผู้ส่งตัวอย่าง
                  </TableHead>

                  <TableHead
                    colSpan={4}
                    className={headerClass}
                  >
                    สำหรับเจ้าหน้าที่
                  </TableHead>

                  <TableHead
                    rowSpan={2}
                    className={headerClass}
                  >
                    หมายเหตุ
                  </TableHead>
                </TableRow>

                <TableRow className="border-0 hover:bg-white">
                  <TableHead className={headerClass}>
                    ส่งตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ส่งตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ชื่อตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    Lot./วันที่
                  </TableHead>

                  <TableHead className={headerClass}>
                    ลักษณะตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    ผู้รับตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    วันที่รับตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    รหัสตัวอย่าง
                  </TableHead>

                  <TableHead className={headerClass}>
                    เลขที่คำขอ
                  </TableHead>
                </TableRow>
              </TableHeader>

              {/* Table Body */}

              <TableBody>
                {paddedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-0 hover:bg-white print:break-inside-avoid"
                  >
                    {/* วันที่ส่งตัวอย่าง */}

                    <TableCell className={centerCellClass}>
                      {formatLabDate(row.sent_date)}
                    </TableCell>

                    {/* เวลาส่งตัวอย่าง */}

                    <TableCell className={centerCellClass}>
                      {row.sent_time}
                    </TableCell>

                    {/* ชื่อตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {row.sample_name}
                    </TableCell>

                    {/* Lot. / วันที่ */}

                    <TableCell className={centerCellClass}>
                      {formatLabLotDate(row)}
                    </TableCell>

                    {/* ลักษณะตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {row.sample_characteristics}
                    </TableCell>

                    {/* รายการวิเคราะห์ */}

                    <TableCell className={cellClass}>
                      {row.analysis_request}
                    </TableCell>

                    {/* ผู้ส่งตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {row.sender_name}
                    </TableCell>

                    {/* ผู้รับตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {row.received_by}
                    </TableCell>

                    {/* วันที่รับตัวอย่าง */}

                    <TableCell className={centerCellClass}>
                      {formatLabDate(row.received_date)}
                    </TableCell>

                    {/* รหัสตัวอย่าง */}

                    <TableCell className={cellClass}>
                      {row.sample_code}
                    </TableCell>

                    {/* เลขที่คำขอ */}

                    <TableCell className={cellClass}>
                      {row.request_no}
                    </TableCell>

                    {/* หมายเหตุ */}

                    <TableCell className={cellClass}>
                      {row.remark}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Document Footer */}

            <footer className="absolute bottom-[2mm] right-[4mm] text-[9px] leading-4 text-black">
              F-7.1(5) Rev.01 10-10-63
            </footer>
          </article>
        );
      })}
    </div>
  );
}
