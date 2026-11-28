
// NAN_LAB_ITECH_THEME_V1

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
  emptyLabFilters,
  filterLabSheets,
  labFilterError,
  paginateLabSheets,
  formatLabDateTime,
  type LabSampleReceivingSheet,
  type LabSampleHistoryFilters,
} from "./lab_sample_receiving_domain";

const headClass =
  "h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold text-white";

const cellClass =
  "px-4 py-3 align-top text-sm";

const menuItemClass =
  "min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground";

/* ---------------- types ---------------- */

type Props = {
  records: LabSampleReceivingSheet[];

  onEdit: (sheet: LabSampleReceivingSheet) => void;
  onView: (sheet: LabSampleReceivingSheet) => void;
  onPrint: (sheet: LabSampleReceivingSheet) => void;
  onDelete: (sheet: LabSampleReceivingSheet) => void;
};

/* ---------------- helpers ---------------- */

function getUniqueValues(
  sheet: LabSampleReceivingSheet,
  field: "request_no" | "sample_code",
): string[] {
  return [
    ...new Set(
      sheet.rows
        .map((row) => row[field].trim())
        .filter(Boolean),
    ),
  ];
}

function summarizeValues(values: string[]): string {
  if (values.length === 0) {
    return "-";
  }

  if (values.length === 1) {
    return values[0];
  }

  return `${values[0]} (+${values.length - 1})`;
}

function getSampleNames(
  sheet: LabSampleReceivingSheet,
): string {
  const names = sheet.rows
    .map((row) => row.sample_name.trim())
    .filter(Boolean);

  return names.length > 0
    ? names.join(", ")
    : "-";
}

/* ---------------- component ---------------- */

export function LabSampleReceivingHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  const [filters, setFilters] =
    useState<LabSampleHistoryFilters>(() => ({
      ...emptyLabFilters,
    }));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filterError = labFilterError(filters);

  const filteredRecords = filterError
    ? []
    : filterLabSheets(records, filters);

  const paginated = paginateLabSheets(
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

  function updateFilter<K extends keyof LabSampleHistoryFilters>(
    key: K,
    value: LabSampleHistoryFilters[K],
  ) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));

    setPage(1);
  }

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
          <div className="min-w-0 space-y-2">
            <Label htmlFor="lab-history-search">
              ค้นหา
            </Label>

            <Input
              id="lab-history-search"
              className="h-9 rounded-lg"
              placeholder="ค้นหา (เลขที่คำขอ/ชื่อ/รหัสตัวอย่าง)"
              value={filters.search}
              onChange={(event) =>
                updateFilter(
                  "search",
                  event.currentTarget.value,
                )
              }
            />
          </div>

          <div className="min-w-0 [&>div>label]:leading-none">
            <ThaiBuddhistDatePicker
              label="จากวันที่"
              value={filters.from}
              onChange={(value) =>
                updateFilter("from", value)
              }
            />
          </div>

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

          <div className="min-w-0 space-y-2">
            <Label htmlFor="lab-history-page-size">
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
                id="lab-history-page-size"
                className="h-9 w-full rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {[5, 10, 20, 50, 100].map((number) => (
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

        {filterError && (
          <p role="alert" className="text-sm text-danger">
            {filterError}
          </p>
        )}

        {/* History Table */}

        <Table
          className="min-w-225 table-fixed text-foreground"
          containerProps={{
            className: "rounded-lg border",
            role: "region",
            "aria-label":
              "ตารางประวัติแบบบันทึกรับตัวอย่าง เลื่อนแนวนอนเพื่อดูข้อมูล",
            tabIndex: 0,
          }}
        >
          <TableHeader>
            <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
              <TableHead className={`${headClass} w-[18%]`}>
                เลขที่คำขอ
              </TableHead>

              <TableHead className={`${headClass} w-[13%]`}>
                วันที่บันทึก
              </TableHead>

              <TableHead className={`${headClass} w-[13%] text-center`}>
                จำนวนตัวอย่าง
              </TableHead>

              <TableHead className={`${headClass} w-[19%]`}>
                ชื่อตัวอย่าง
              </TableHead>

              <TableHead className={`${headClass} w-[13%]`}>
                รหัสตัวอย่าง
              </TableHead>

              <TableHead className={`${headClass} w-[12%]`}>
                อัปเดตล่าสุด
              </TableHead>

              <TableHead className={`${headClass} w-[12%] text-center`}>
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.items.map((sheet) => {
              const requestNumbers = getUniqueValues(
                sheet,
                "request_no",
              );

              const sampleCodes = getUniqueValues(
                sheet,
                "sample_code",
              );

              const sampleNames = getSampleNames(sheet);

              return (
                <TableRow
                  key={sheet.id}
                  className="border-border/60 hover:bg-muted/40"
                >
                  {/* Request Number */}

                  <TableCell className={cellClass}>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => onView(sheet)}
                      className="block h-auto w-full overflow-hidden text-ellipsis whitespace-nowrap p-0 text-left font-medium text-foreground"
                      title={requestNumbers.join(", ")}
                    >
                      {summarizeValues(requestNumbers)}
                    </Button>

                    <p
                      className="truncate text-xs text-muted-foreground"
                      title={sheet.id}
                    >
                      ID: {sheet.id}
                    </p>
                  </TableCell>

                  {/* Created Date */}

                  <TableCell className={cellClass}>
                    <span className="whitespace-nowrap">
                      {formatLabDateTime(sheet.created_at)}
                    </span>
                  </TableCell>

                  {/* Sample Count */}

                  <TableCell className={`${cellClass} text-center`}>
                    <span className="font-medium tabular-nums">
                      {sheet.rows.length}
                    </span>
                  </TableCell>

                  {/* Sample Name */}

                  <TableCell className={cellClass}>
                    <p
                      className="truncate font-medium"
                      title={sampleNames}
                    >
                      {sampleNames}
                    </p>
                  </TableCell>

                  {/* Sample Code */}

                  <TableCell className={cellClass}>
                    <p
                      className="truncate font-medium"
                      title={sampleCodes.join(", ")}
                    >
                      {summarizeValues(sampleCodes)}
                    </p>
                  </TableCell>

                  {/* Updated Date */}

                  <TableCell className={cellClass}>
                    <span className="whitespace-nowrap">
                      {formatLabDateTime(sheet.updated_at)}
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
                          aria-label={`จัดการ ${summarizeValues(requestNumbers)}`}
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
                          onSelect={() => onView(sheet)}
                        >
                          <FileText
                            aria-hidden="true"
                            className="text-current"
                          />
                          ดูรายงาน
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={menuItemClass}
                          onSelect={() => onPrint(sheet)}
                        >
                          <Printer
                            aria-hidden="true"
                            className="text-current"
                          />
                          พิมพ์เอกสาร
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={menuItemClass}
                          onSelect={() => onEdit(sheet)}
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
                          variant="destructive"
                          className={`${menuItemClass} data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive`}
                          onSelect={() => onDelete(sheet)}
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

            {!paginated.items.length && (
              <TableRow>
                <TableCell
                  colSpan={7}
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
