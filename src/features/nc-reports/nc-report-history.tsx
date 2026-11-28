"use client";

import { useRef, useState } from "react";

import {
  ChevronDown,
  FileText,
  Pencil,
  Printer,
  SlidersHorizontal,
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

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";

import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import { formatThaiDate } from "@/src/lib/date/thai-date";

import {
  ncDecisions,
  type NCDecision,
  type NCFilters,
  type NCReport,
} from "./nc-report-types";

import {
  emptyNCFilters,
  filterNC,
  paginateNC,
  ncFilterError,
  validNCDate,
} from "./nc-report-mock-helpers";

const decisionStyles: Record<NCDecision, string> = {
  accept_concession:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  rework:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  return_back:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  reproduce:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  scrap:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
};

const headClass =
  "h-11 whitespace-normal px-4 py-3 text-sm font-semibold text-white";

const cellClass =
  "whitespace-normal px-4 py-3 align-top text-sm";

export function NCReportHistory({
  records,
  readOnly = false,
  onView,
  onEdit,
  onPrint,
  onDelete,
}: {
  records: NCReport[];
  readOnly?: boolean;
  onView: (r: NCReport) => void;
  onEdit: (r: NCReport) => void;
  onPrint: (r: NCReport) => void;
  onDelete: (r: NCReport) => void;
}) {
  const [filters, setFilters] = useState<NCFilters>({
    ...emptyNCFilters,
  });

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);

  const [deleteTarget, setDeleteTarget] =
    useState<NCReport | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const deleteTrigger =
    useRef<HTMLButtonElement | null>(null);

  const manageTriggers = useRef(
    new Map<string, HTMLButtonElement>(),
  );

  const rows = filterNC(records, filters);
  const paged = paginateNC(rows, page, size);
  const filterError = ncFilterError(filters);

  const pages = Math.max(
    1,
    Math.ceil(rows.length / size),
  );

  const activeFilter =
    filters.search !== "" ||
    filters.from !== "" ||
    filters.to !== "" ||
    filters.department !== "all";

  const departments = Array.from(
    new Set(
      records
        .map((r) => r.department)
        .filter((v) => v.trim() && v !== "all"),
    ),
  );

  if (
    filters.department !== "all" &&
    !departments.includes(filters.department)
  ) {
    departments.push(filters.department);
  }

  function updateFilter<K extends keyof NCFilters>(
    key: K,
    value: NCFilters[K],
  ) {
    setFilters((previous) => ({
      ...previous,
      [key]: value,
    }));

    setPage(1);
  }

  function clearFilters() {
    setFilters({ ...emptyNCFilters });
    setPage(1);
  }

  return (
    <Card className="min-w-0 gap-0 rounded-xl border bg-card py-0 shadow-sm">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="text-base font-semibold">
          <h2>ข้อมูลที่บันทึก</h2>
        </CardTitle>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              aria-label="ตัวกรองเพิ่มเติม"
            >
              <SlidersHorizontal aria-hidden="true" />
              ตัวกรองเพิ่มเติม
              {filters.department !== "all" ? " (1)" : ""}
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-72 max-w-[calc(100vw-32px)] space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="nc-filter-department">
                กรองแผนก
              </Label>

              <Select
                value={filters.department}
                onValueChange={(v) =>
                  updateFilter("department", v)
                }
              >
                <SelectTrigger
                  id="nc-filter-department"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    ทุกแผนก
                  </SelectItem>

                  {departments.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={clearFilters}
              disabled={!activeFilter}
            >
              ล้างตัวกรอง
            </Button>
          </PopoverContent>
        </Popover>
      </CardHeader>

      <CardContent className="min-w-0 space-y-3 p-4">
        <div className="grid items-start gap-3 sm:grid-cols-2 @[900px]/main:grid-cols-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="nc-search" className="leading-relaxed">
              ค้นหา
            </Label>

            <Input
              ref={searchRef}
              id="nc-search"
              className="h-9 rounded-lg"
              placeholder="ค้นหาเลขที่เอกสาร / ชื่อสินค้า / แผนก / ผู้พบ..."
              value={filters.search}
              onChange={(e) =>
                updateFilter("search", e.target.value)
              }
            />
          </div>

          <div className="min-w-0 [&_label]:leading-relaxed [&_button]:h-9 [&_button]:rounded-lg">
            <ThaiBuddhistDatePicker
              label="จากวันที่"
              value={filters.from}
              onChange={(v) => updateFilter("from", v)}
            />
          </div>

          <div className="min-w-0 [&_label]:leading-relaxed [&_button]:h-9 [&_button]:rounded-lg">
            <ThaiBuddhistDatePicker
              label="ถึงวันที่"
              value={filters.to}
              onChange={(v) => updateFilter("to", v)}
              error={filterError || undefined}
            />
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="nc-page-size" className="leading-relaxed">
              แสดงต่อหน้า
            </Label>

            <Select
              value={String(size)}
              onValueChange={(v) => {
                setSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger
                id="nc-page-size"
                className="h-9 w-full rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {[5, 10, 20, 50, 100].map((n) => (
                  <SelectItem
                    key={n}
                    value={String(n)}
                  >
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filterError && (
          <p role="alert" className="sr-only">
            {filterError}
          </p>
        )}

        {filters.department !== "all" && (
          <p className="text-xs text-muted-foreground">
            แผนกที่เลือก: {filters.department}
          </p>
        )}

        <Table
          className="min-w-212.5 table-fixed text-foreground"
          containerProps={{
            className: "rounded-lg border",
            role: "region",
            "aria-label":
              "ตารางประวัติใบ NC เลื่อนแนวนอนเพื่อดูข้อมูล",
            tabIndex: 0,
          }}
        >
          <TableHeader>
            <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
              <TableHead className={`${headClass} w-[14%]`}>
                เลขที่เอกสาร
              </TableHead>

              <TableHead className={`${headClass} w-[12%]`}>
                วันที่
              </TableHead>

              <TableHead className={`${headClass} w-[14%]`}>
                แผนก
              </TableHead>

              <TableHead className={`${headClass} w-[31%]`}>
                รายการ/ปัญหา (ย่อ)
              </TableHead>

              <TableHead className={`${headClass} w-[16%]`}>
                ผลตัดสินใจ
              </TableHead>

              <TableHead className={`${headClass} w-[13%] text-center`}>
                จัดการ
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paged.rows.map((r) => {
              const selected = ncDecisions.filter(([k]) => r.decisions[k]);

              const summary = [
                r.product_name,
                r.problem_defect,
              ]
                .map((v) => v.trim())
                .filter(Boolean)
                .join(" · ");

              return (
                <TableRow
                  key={r.id}
                  className="border-border/60 hover:bg-muted/40"
                >
                  <TableCell className={cellClass}>
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => onView(r)}
                      className="h-auto max-w-full whitespace-normal p-0 text-left font-medium text-foreground wrap-break-word"
                    >
                      {r.doc_no || "-"}
                    </Button>
                  </TableCell>

                  <TableCell className={cellClass}>
                    {validNCDate(r.doc_date)
                      ? formatThaiDate(r.doc_date)
                      : "-"}
                  </TableCell>

                  <TableCell className={`${cellClass} wrap-break-word`}>
                    {r.department || "-"}
                  </TableCell>

                  <TableCell className={`${cellClass} wrap-break-word`}>
                    <p
                      className="line-clamp-2 text-xs leading-relaxed"
                      title={summary}
                    >
                      {summary || "-"}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {[r.quantity, r.unit]
                        .filter(Boolean)
                        .join(" ") || "-"}
                    </p>
                  </TableCell>

                  <TableCell className={cellClass}>
                    <div className="flex flex-wrap gap-1">
                      {selected.length ? selected.map(([k, label]) => (
                        <span
                          key={k}
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs leading-relaxed ${decisionStyles[k]}`}
                          title={label}
                        >
                          {k === "reproduce"
                            ? "ผลิตใหม่"
                            : label}
                        </span>
                      )) : (
                        <span className="text-muted-foreground">
                          -
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className={`${cellClass} text-center`}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          ref={(node) => {
                            if (node) {
                              manageTriggers.current.set(
                                r.id,
                                node,
                              );
                            } else {
                              manageTriggers.current.delete(
                                r.id,
                              );
                            }
                          }}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 gap-2 rounded-xl border-[#a6bf49] bg-muted/40 px-3 font-medium text-[#173b63] shadow-none hover:bg-muted data-[state=open]:border-[#a6bf49] data-[state=open]:bg-muted dark:text-foreground"
                          aria-label={`จัดการ ${r.doc_no}`}
                        >
                          จัดการ
                          <ChevronDown aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="w-56 max-w-[calc(100vw-24px)] rounded-xl p-2 shadow-lg **:data-[slot=dropdown-menu-item]:min-h-10 **:data-[slot=dropdown-menu-item]:cursor-pointer **:data-[slot=dropdown-menu-item]:gap-3 **:data-[slot=dropdown-menu-item]:rounded-lg **:data-[slot=dropdown-menu-item]:px-3 **:data-[slot=dropdown-menu-item]:py-2"
                        onCloseAutoFocus={(event) => {
                          if (deleteTarget) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <DropdownMenuItem
                          onSelect={() => onView(r)}
                        >
                          <FileText
                            aria-hidden="true"
                            className="text-current"
                          />
                          ดูรายละเอียด
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onSelect={() => onPrint(r)}
                        >
                          <Printer
                            aria-hidden="true"
                            className="text-current"
                          />
                          พิมพ์เอกสาร
                        </DropdownMenuItem>

                        {!readOnly && (
                          <>
                            <DropdownMenuItem
                              onSelect={() => onEdit(r)}
                            >
                              <Pencil
                                aria-hidden="true"
                                className="text-current"
                              />
                              แก้ไข
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                deleteTrigger.current =
                                  manageTriggers.current.get(r.id) ??
                                  null;

                                setDeleteTarget(r);
                              }}
                            >
                              <Trash2 aria-hidden="true" />
                              ลบเอกสาร
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}

            {!paged.rows.length && (
              <TableRow>
                <TableCell
                  colSpan={6}
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

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="status">
            ทั้งหมด <strong>{rows.length}</strong> รายการ

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
              disabled={paged.page <= 1}
              onClick={() => setPage(paged.page - 1)}
            >
              ก่อนหน้า
            </Button>

            <span className="whitespace-nowrap">
              หน้า {paged.page} / {pages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={paged.page >= pages}
              onClick={() => setPage(paged.page + 1)}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog
        open={!readOnly && !!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();

            if (deleteTrigger.current?.isConnected) {
              deleteTrigger.current.focus();
            } else {
              searchRef.current?.focus();
            }

            deleteTrigger.current = null;
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              ลบเอกสาร {deleteTarget?.doc_no}?
            </AlertDialogTitle>

            <AlertDialogDescription>
              นำเอกสารออกจากรายการและเก็บประวัติการลบ
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={readOnly}
              onClick={() => {
                if (!readOnly && deleteTarget) {
                  onDelete(deleteTarget);
                }

                setDeleteTarget(null);
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}