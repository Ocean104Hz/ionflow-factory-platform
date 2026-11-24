
import { Fragment } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  QC_WEIGHT_GROUP_KEYS,
  QC_WEIGHT_READING_INDEXES,
  formatQcWeightDate,
  type QcProductWeightCheckDocument,
  type QcProductWeightCheckRow,
} from "./qc_product_weight_check_domain";

/* ---------------- constants ---------------- */

const ROWS_PER_PAGE = 15;

const REPEAT_HEADER_EVERY = 3;

const PAPER_FORM_CODE = "FR-P2-20/REV.01";

const headerCellClass =
  "border border-black/80 bg-white px-1 py-1 " +
  "text-center text-[9px] font-semibold " +
  "leading-tight whitespace-normal text-black";

const bodyCellClass =
  "h-[5.8mm] border border-black/70 " +
  "px-0.5 py-1 text-center text-[9px] " +
  "leading-tight whitespace-normal break-all " +
  "align-middle text-black";

const repeatCellClass =
  "h-[3.2mm] border border-black/70 " +
  "px-0.5 py-0 text-center text-[8px] " +
  "leading-none text-black";

/* ---------------- types ---------------- */

type Props = {
  document: QcProductWeightCheckDocument;
};

/* ---------------- helpers ---------------- */

function displayText(value: string): string {
  return value.trim() || "-";
}

function displayDate(value: string): string {
  return formatQcWeightDate(value) || "-";
}

function paperPages(
  rows: readonly QcProductWeightCheckRow[],
): QcProductWeightCheckRow[][] {
  if (rows.length === 0) {
    return [[]];
  }

  const pages: QcProductWeightCheckRow[][] = [];

  for (
    let index = 0;
    index < rows.length;
    index += ROWS_PER_PAGE
  ) {
    pages.push(
      rows.slice(index, index + ROWS_PER_PAGE),
    );
  }

  return pages;
}

/* ---------------- component ---------------- */

export function QcProductWeightCheckPaper({
  document,
}: Props) {
  const pages = paperPages(document.rows);

  return (
    <div className="space-y-5">
      {pages.map((pageRows, pageIndex) => {
        const displayedRows: (
          | QcProductWeightCheckRow
          | null
        )[] = Array.from(
          { length: ROWS_PER_PAGE },
          (_, index) => pageRows[index] ?? null,
        );

        return (
          <article
            key={`${document.id || "new"}-${pageIndex}`}
            className="mx-auto flex min-h-[190mm] w-[277mm] flex-col border border-slate-300 bg-white px-[7mm] py-[6mm] text-black shadow-sm"
          >
            {/* Document Number */}

            <div className="flex items-start justify-between gap-4 text-[9px]">
              <span>
                เลขที่เอกสาร:{" "}
                {displayText(document.doc_no)}
              </span>

              <div className="text-right">
                <p>
                  วันที่เอกสาร:{" "}
                  {displayDate(document.doc_date)}
                </p>

                {pages.length > 1 && (
                  <p>
                    หน้า {pageIndex + 1}/{pages.length}
                  </p>
                )}
              </div>
            </div>

            {/* Company And Document Title */}

            <header className="mt-2 space-y-1 text-center">
              <h2 className="text-[13px] font-semibold leading-relaxed text-black">
                บริษัท ไอออนิค จำกัด
                (โรงงานกาญจนบุรี 2)
              </h2>

              <h3 className="text-[12px] font-semibold leading-relaxed text-black">
                ใบบันทึกการตรวจเช็ค QC
                น้ำหนักของผลิตภัณฑ์
              </h3>
            </header>

            {/* Product Information */}

            <section className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[10px]">
              <div className="flex min-w-0 items-end gap-2">
                <span className="shrink-0">
                  ผลิตภัณฑ์
                </span>

                <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 wrap-break-word">
                  {displayText(
                    document.product_name,
                  )}
                </span>
              </div>

              <div className="flex min-w-0 items-end gap-2">
                <span className="shrink-0">
                  หมายเลขบ็อกซ์
                </span>

                <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 wrap-break-word">
                  {displayText(document.lot_no)}
                </span>
              </div>

              <div className="flex min-w-0 items-end gap-2">
                <span className="shrink-0">
                  จำนวนบรรจุ
                </span>

                <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 wrap-break-word">
                  {displayText(
                    document.pack_count,
                  )}
                </span>
              </div>

              <div className="flex min-w-0 items-end gap-2">
                <span className="shrink-0">
                  เกณฑ์น้ำหนัก
                </span>

                <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 wrap-break-word">
                  {displayText(
                    document.weight_spec,
                  )}
                </span>
              </div>
            </section>

            {/* Main Weight Table */}

            <section className="mt-4">
              <Table className="w-full table-fixed border-collapse text-black">
                <colgroup>
                  {/* Time */}

                  <col className="w-[8%]" />

                  {/* 4 groups x 4 readings */}

                  {QC_WEIGHT_GROUP_KEYS.flatMap(
                    (group) =>
                      QC_WEIGHT_READING_INDEXES.map(
                        (index) => (
                          <col
                            key={`${group}-${index}`}
                            className="w-[4.25%]"
                          />
                        ),
                      ),
                  )}

                  {/* Average */}

                  <col className="w-[8%]" />

                  {/* Pass / Fail */}

                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                </colgroup>

                {/* Table Header */}

                <TableHeader>
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className={headerCellClass}
                    >
                      เวลา
                    </TableHead>

                    {QC_WEIGHT_GROUP_KEYS.map(
                      (group, groupIndex) => (
                        <TableHead
                          key={group}
                          colSpan={4}
                          className={headerCellClass}
                        >
                          กลุ่มที่ {groupIndex + 1}
                        </TableHead>
                      ),
                    )}

                    <TableHead
                      rowSpan={2}
                      className={headerCellClass}
                    >
                      ค่าเฉลี่ย
                    </TableHead>

                    <TableHead
                      colSpan={2}
                      className={headerCellClass}
                    >
                      ผลการตรวจสอบ
                    </TableHead>
                  </TableRow>

                  <TableRow>
                    {QC_WEIGHT_GROUP_KEYS.flatMap(
                      (group) =>
                        QC_WEIGHT_READING_INDEXES.map(
                          (index) => (
                            <TableHead
                              key={`${group}-${index}`}
                              className={headerCellClass}
                            >
                              {index + 1}
                            </TableHead>
                          ),
                        ),
                    )}

                    <TableHead
                      className={headerCellClass}
                    >
                      ผ่าน
                    </TableHead>

                    <TableHead
                      className={headerCellClass}
                    >
                      ไม่ผ่าน
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* Table Body */}

                <TableBody>
                  {displayedRows.map(
                    (row, rowIndex) => (
                      <Fragment
                        key={
                          row?.id ??
                          `blank-${pageIndex}-${rowIndex}`
                        }
                      >
                        {/* Repeated Number Header */}

                        {rowIndex > 0 &&
                          rowIndex %
                            REPEAT_HEADER_EVERY ===
                            0 && (
                            <TableRow>
                              <TableCell
                                className={
                                  repeatCellClass
                                }
                              />

                              {QC_WEIGHT_GROUP_KEYS.flatMap(
                                (group) =>
                                  QC_WEIGHT_READING_INDEXES.map(
                                    (index) => (
                                      <TableCell
                                        key={`${group}-${index}`}
                                        className={
                                          repeatCellClass
                                        }
                                      >
                                        {index + 1}
                                      </TableCell>
                                    ),
                                  ),
                              )}

                              <TableCell
                                className={
                                  repeatCellClass
                                }
                              />

                              <TableCell
                                className={
                                  repeatCellClass
                                }
                              />

                              <TableCell
                                className={
                                  repeatCellClass
                                }
                              />
                            </TableRow>
                          )}

                        {/* Weight Reading Row */}

                        <TableRow>
                          {/* Time */}

                          <TableCell
                            className={bodyCellClass}
                          >
                            {row?.time ?? ""}
                          </TableCell>

                          {/* Measurements */}

                          {QC_WEIGHT_GROUP_KEYS.flatMap(
                            (group) =>
                              QC_WEIGHT_READING_INDEXES.map(
                                (index) => (
                                  <TableCell
                                    key={`${group}-${index}`}
                                    className={
                                      bodyCellClass
                                    }
                                  >
                                    {row?.measurements[
                                      group
                                    ][index] ?? ""}
                                  </TableCell>
                                ),
                              ),
                          )}

                          {/* Average */}

                          <TableCell
                            className={bodyCellClass}
                          >
                            {row?.average ?? ""}
                          </TableCell>

                          {/* Pass */}

                          <TableCell
                            className={`${bodyCellClass} text-[12px] font-bold`}
                          >
                            {row?.result === "PASS"
                              ? "✓"
                              : ""}
                          </TableCell>

                          {/* Fail */}

                          <TableCell
                            className={`${bodyCellClass} text-[12px] font-bold`}
                          >
                            {row?.result === "FAIL"
                              ? "✓"
                              : ""}
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ),
                  )}
                </TableBody>
              </Table>
            </section>

            {/* Document Footer */}

            <footer className="mt-auto space-y-3 pt-4 text-[10px]">
              {/* Remark */}

              <div className="space-y-1">
                <p>หมายเหตุ</p>

                <div className="min-h-[6mm] border-b border-black/70 pb-1 whitespace-pre-wrap wrap-break-word">
                  {document.remark.trim()}
                </div>

                <div className="min-h-[4mm] border-b border-black/70" />
              </div>

              {/* Signatures */}

              <div className="grid grid-cols-2 gap-x-16 pt-1">
                {/* Prepared By */}

                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">
                      ผู้จัดทำ
                    </span>

                    <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 text-center wrap-break-word">
                      {document.prepared_by.trim()}
                    </span>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="shrink-0">
                      วันที่
                    </span>

                    <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 text-center">
                      {formatQcWeightDate(
                        document.prepared_date,
                      )}
                    </span>
                  </div>
                </div>

                {/* Checked By */}

                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">
                      ผู้ตรวจสอบ
                    </span>

                    <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 text-center wrap-break-word">
                      {document.checked_by.trim()}
                    </span>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="shrink-0">
                      วันที่
                    </span>

                    <span className="min-w-0 flex-1 border-b border-dotted border-black pb-0.5 text-center">
                      {formatQcWeightDate(
                        document.checked_date,
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Code */}

              <p className="pt-1 text-right text-[9px]">
                {PAPER_FORM_CODE}
              </p>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
