"use client";

import { useState } from "react";

import {
  ChevronDown,
  Download,
  FileText,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";

import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";

import {
  emptyQcWeightFilters,
  filterQcWeightDocuments,
  formatQcWeightDate,
  paginateQcWeightDocuments,
  qcWeightFilterError,
  type QcProductWeightCheckDocument,
  type QcWeightHistoryFilters,
} from "./qc_product_weight_check_domain";

const headClass =
  "h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold text-white";

const cellClass =
  "px-4 py-3 align-top text-sm";

const menuItemClass =
  "min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground";

/* ---------------- types ---------------- */

type Props = {
  records: QcProductWeightCheckDocument[];

  onEdit: (
    document: QcProductWeightCheckDocument,
  ) => void;

  onView: (
    document: QcProductWeightCheckDocument,
  ) => void;

  onPrint: (
    document: QcProductWeightCheckDocument,
  ) => void;

  onDelete: (
    document: QcProductWeightCheckDocument,
  ) => void;
};

/* ---------------- helpers ---------------- */

function getResultCounts(
  document: QcProductWeightCheckDocument,
) {
  return {
    passed: document.rows.filter(
      (row) => row.result === "PASS",
    ).length,

    failed: document.rows.filter(
      (row) => row.result === "FAIL",
    ).length,

    pending: document.rows.filter(
      (row) => row.result === "",
    ).length,
  };
}

function formatUpdatedAt(value: string): string {
  if (
    !value ||
    !Number.isFinite(Date.parse(value))
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
    hourCycle: "h23",
  }).format(new Date(value));
}

/* ---------------- component ---------------- */

export function QcProductWeightCheckHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  /* ---------------- filter state ---------------- */

  const [filters, setFilters] =
    useState<QcWeightHistoryFilters>(() => ({
      ...emptyQcWeightFilters,
    }));

  /* ---------------- pagination ---------------- */

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- derived data ---------------- */

  const filterError =
    qcWeightFilterError(filters);

  const filteredRecords = filterError
    ? []
    : filterQcWeightDocuments(records, filters);

  const paginated =
    paginateQcWeightDocuments(
      filteredRecords,
      page,
      pageSize,
    );

  const pages = Math.max(
    1,
    Math.ceil(filteredRecords.length / pageSize),
  );

  const activeFilter = Boolean(
    filters.search ||
    filters.from ||
    filters.to,
  );

  /* ---------------- live search ---------------- */

  function updateFilter<
    K extends keyof QcWeightHistoryFilters,
  >(
    key: K,
    value: QcWeightHistoryFilters[K],
  ) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));

    setPage(1);
  }

  /* ---------------- render ---------------- */

  return (
    <Card className="min-w-0 gap-0 rounded-xl border bg-card py-0 shadow-sm">
      <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="text-base font-semibold">
          <h2>ข้อมูลที่บันทึก</h2>
        </CardTitle>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 p-4">
        {/* Search and Filters */}

        <div className="grid items-start gap-3 sm:grid-cols-2 @[900px]/main:grid-cols-[1.35fr_1fr_1fr_0.65fr]">
          {/* Search */}

          <div className="min-w-0 space-y-2">
            <Label htmlFor="qc-weight-history-search">
              ค้นหา
            </Label>

            <Input
              id="qc-weight-history-search"
              className="h-9 rounded-lg"
              value={filters.search}
              placeholder="ค้นหา (เลขที่เอกสาร/ผลิตภัณฑ์/หมายเลขบ็อกซ์)"
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.currentTarget.value,
                )
              }
            />
          </div>

          {/* From Date */}

          <div className="min-w-0 [&>div>label]:leading-none">
            <ThaiBuddhistDatePicker
              label="จากวันที่"
              value={filters.from}
              onChange={(value) =>
                updateFilter("from", value)
              }
            />
          </div>

          {/* To Date */}

          <div className="min-w-0 [&>div>label]:leading-none">
            <ThaiBuddhistDatePicker
              label="ถึงวันที่"
              value={filters.to}
              onChange={(value) =>
                updateFilter("to", value)
              }
              error={filterError || undefined}
            />
          </div>

          {/* Page Size */}

          <div className="min-w-0 space-y-2">
            <Label htmlFor="qc-weight-history-page-size">
              ต่อหน้า
            </Label>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger
                id="qc-weight-history-page-size"
                className="h-9 w-full rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {[5, 10, 20, 50].map((number) => (
                  <SelectItem
                    key={number}
                    value={String(number)}
                  >
                    {number} รายการ
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Error */}

        {filterError && (
          <p
            id="qc-weight-history-filter-error"
            role="alert"
            className="text-sm text-danger"
          >
            {filterError}
          </p>
        )}

        {/* History Table */}

        <Table
          className="min-w-275 table-fixed text-foreground"
          containerProps={{
            className: "rounded-lg border",
            role: "region",
            "aria-label":
              "ตารางประวัติการตรวจเช็คน้ำหนักผลิตภัณฑ์ เลื่อนแนวนอนเพื่อดูข้อมูล",
            tabIndex: 0,
          }}
        >
          <TableHeader>
            <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
              <TableHead className={`${headClass} w-[14%]`}>
                เลขที่เอกสาร
              </TableHead>

              <TableHead className={`${headClass} w-[12%]`}>
                วันที่เอกสาร
              </TableHead>

              <TableHead className={`${headClass} w-[17%]`}>
                ชื่อผลิตภัณฑ์
              </TableHead>

              <TableHead className={`${headClass} w-[11%]`}>
                หมายเลขบ็อกซ์
              </TableHead>

              <TableHead className={`${headClass} w-[11%] text-center`}>
                จำนวนรอบตรวจ
              </TableHead>

              <TableHead className={`${headClass} w-[13%]`}>
                ผลการตรวจสอบ
              </TableHead>

              <TableHead className={`${headClass} w-[12%]`}>
                แก้ไขล่าสุด
              </TableHead>

              <TableHead className={`${headClass} w-[10%] text-center`}>
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.items.map((document) => {
              const counts =
                getResultCounts(document);

              return (
                <TableRow
                  key={document.id}
                  className="border-border/60 hover:bg-muted/40"
                >
                  {/* Document Number */}

                  <TableCell className={cellClass}>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => onView(document)}
                      className="block h-auto w-full overflow-hidden text-ellipsis whitespace-nowrap p-0 text-left font-medium text-foreground"
                      title={document.doc_no}
                    >
                      {document.doc_no || "-"}
                    </Button>
                  </TableCell>

                  {/* Document Date */}

                  <TableCell className={cellClass}>
                    <span className="whitespace-nowrap">
                      {formatQcWeightDate(
                        document.doc_date,
                      ) || "-"}
                    </span>
                  </TableCell>

                  {/* Product Name */}

                  <TableCell className={cellClass}>
                    <p
                      className="truncate font-medium"
                      title={document.product_name}
                    >
                      {document.product_name || "-"}
                    </p>
                  </TableCell>

                  {/* Box Number */}

                  <TableCell className={cellClass}>
                    <p
                      className="truncate"
                      title={document.lot_no}
                    >
                      {document.lot_no || "-"}
                    </p>
                  </TableCell>

                  {/* Check Count */}

                  <TableCell className={`${cellClass} text-center`}>
                    <span className="font-medium tabular-nums">
                      {document.rows.length}
                    </span>
                  </TableCell>

                  {/* Check Results */}

                  <TableCell className={cellClass}>
                    <div className="flex min-w-0 flex-col gap-1 text-xs">
                      <span className="text-success">
                        ผ่าน {counts.passed} รอบ
                      </span>

                      <span className="text-danger">
                        ไม่ผ่าน {counts.failed} รอบ
                      </span>

                      <span className="text-muted-foreground">
                        ยังไม่ระบุ {counts.pending} รอบ
                      </span>
                    </div>
                  </TableCell>

                  {/* Updated Date */}

                  <TableCell className={cellClass}>
                    <span className="whitespace-normal wrap-break-word">
                      {formatUpdatedAt(
                        document.updated_at,
                      )}
                    </span>
                  </TableCell>


                  {/* Actions */}

                  <TableCell className={`${cellClass} text-center`}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 rounded-xl border-[#a6bf49] bg-muted/40 px-2.5 text-xs font-medium text-[#173b63]! shadow-none hover:bg-muted hover:text-[#173b63]! data-[state=open]:border-[#a6bf49] data-[state=open]:bg-muted dark:text-foreground! dark:hover:text-foreground!"
                          aria-label={`จัดการ ${document.doc_no}`}
                        >
                          จัดการ
                          <ChevronDown
                            aria-hidden="true"
                            className="size-3.5"
                          />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-52 max-w-[calc(100vw-24px)] rounded-xl border bg-card p-1.5 text-foreground shadow-md"
                      >
                        <DropdownMenuItem
                          className={menuItemClass}
                          onSelect={() => onView(document)}
                        >
                          <FileText
                            aria-hidden="true"
                            className="text-current"
                          />
                          ดูรายงาน
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={menuItemClass}
                          onSelect={() => onPrint(document)}
                        >
                          <Printer
                            aria-hidden="true"
                            className="text-current"
                          />
                          พิมพ์เอกสาร
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={menuItemClass}
                          onSelect={() => onEdit(document)}
                        >
                          <Pencil
                            aria-hidden="true"
                            className="text-current"
                          />
                          แก้ไข
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={menuItemClass}
                          disabled
                          title="ยังไม่เปิดใช้งานการนำออก Excel"
                        >
                          <Download
                            aria-hidden="true"
                            className="text-current"
                          />
                          นำออก Excel
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={`${menuItemClass} data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive`}
                          variant="destructive"
                          onSelect={() => onDelete(document)}
                        >
                          <Trash2 aria-hidden="true" />
                          ลบเอกสาร
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}

            {/* Empty State */}

            {!paginated.items.length && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {filterError
                    ? "กรุณาตรวจสอบช่วงวันที่"
                    : records.length
                      ? "ไม่พบข้อมูลตามตัวกรอง"
                      : "ยังไม่มีข้อมูลในประวัติ"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="status">
            ทั้งหมด{" "}
            <strong>{filteredRecords.length}</strong>{" "}
            รายการ

            {activeFilter && (
              <span className="ml-1 text-muted-foreground">
                (จาก {records.length})
              </span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginated.page <= 1}
              onClick={() =>
                setPage(paginated.page - 1)
              }
            >
              ก่อนหน้า
            </Button>

            <span className="whitespace-nowrap">
              หน้า {paginated.page} / {pages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paginated.page >= pages}
              onClick={() =>
                setPage(paginated.page + 1)
              }
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
