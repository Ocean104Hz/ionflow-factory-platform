"use client";

import { useState } from "react";
import { Eye, Pencil, Printer, Search, Trash2 } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  FactoryDataTable,
  Pagination,
  SectionCard,
  SelectField,
} from "@/src/components/factory/patterns";

import {
  emptyEffervescentMaterialHistoryFilters,
  type EffervescentMaterialLedgerHistoryFilters,
  type EffervescentMaterialLedgerSheet,
} from "./effervescent_material_ledger_domain";

/**
 * แสดงประวัติจาก props ที่ Workspace ส่งมา
 * ปุ่มจัดการเรียก callbacks เท่านั้น ไม่มี API หรือฐานข้อมูล
 */

type Props = {
  records: readonly EffervescentMaterialLedgerSheet[];
  onView: (sheet: EffervescentMaterialLedgerSheet) => void;
  onEdit: (sheet: EffervescentMaterialLedgerSheet) => void;
  onPrint: (sheet: EffervescentMaterialLedgerSheet) => void;
  onDelete: (sheet: EffervescentMaterialLedgerSheet) => void;
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatRecordDate(value: string): string {
  if (!isValidDateKey(value)) {
    return "-";
  }

  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

function formatUpdatedAt(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? dateTimeFormatter.format(date)
    : "-";
}

function validateFilters(
  filters: EffervescentMaterialLedgerHistoryFilters,
): string {
  if (
    (filters.from && !isValidDateKey(filters.from)) ||
    (filters.to && !isValidDateKey(filters.to))
  ) {
    return "กรุณาระบุวันที่ให้ถูกต้อง";
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    return "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
  }

  return "";
}

function filterRecords(
  records: readonly EffervescentMaterialLedgerSheet[],
  filters: EffervescentMaterialLedgerHistoryFilters,
): EffervescentMaterialLedgerSheet[] {
  const keyword = filters.search.trim().toLocaleLowerCase();

  return records.filter((sheet) => {
    if (filters.from && sheet.record_date < filters.from) {
      return false;
    }

    if (filters.to && sheet.record_date > filters.to) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const searchableValues = [
      sheet.id,
      sheet.record_date,
      sheet.production_list,
      sheet.prepared_by,
      sheet.checked_by,
      ...sheet.rows.flatMap((row) => [
        row.code,
        row.material_name,
        row.remark,
      ]),
    ];

    return searchableValues.some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    );
  });
}

export function EffervescentMaterialLedgerHistory({
  records,
  onView,
  onEdit,
  onPrint,
  onDelete,
}: Props) {
  const [draftFilters, setDraftFilters] =
    useState<EffervescentMaterialLedgerHistoryFilters>(() => ({
      ...emptyEffervescentMaterialHistoryFilters,
    }));

  const [appliedFilters, setAppliedFilters] =
    useState<EffervescentMaterialLedgerHistoryFilters>(() => ({
      ...emptyEffervescentMaterialHistoryFilters,
    }));

  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRecords = filterRecords(records, appliedFilters);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function applyFilters() {
    const error = validateFilters(draftFilters);
    setFilterError(error);

    if (error) {
      return;
    }

    setAppliedFilters({ ...draftFilters });
    setPage(1);
  }

  function resetFilters() {
    setDraftFilters({ ...emptyEffervescentMaterialHistoryFilters });
    setAppliedFilters({ ...emptyEffervescentMaterialHistoryFilters });
    setFilterError("");
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติการรับ - จ่าย วัตถุดิบเม็ดฟู่"
        subtitle={`พบ ${filteredRecords.length} จาก ${records.length} เอกสาร`}
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="effervescent-history-search">ค้นหา</Label>
              <Input
                id="effervescent-history-search"
                type="search"
                value={draftFilters.search}
                placeholder="เลขที่เอกสาร / รายการผลิต / วัตถุดิบ"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
              />
            </div>

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="effervescent-history-from">จากวันที่บันทึก</Label>
              <Input
                id="effervescent-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "effervescent-history-filter-error" : undefined
                }
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.currentTarget.value,
                  }))
                }
              />
            </div>

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="effervescent-history-to">ถึงวันที่บันทึก</Label>
              <Input
                id="effervescent-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "effervescent-history-filter-error" : undefined
                }
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.currentTarget.value,
                  }))
                }
              />
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">
                <Search className="size-4" aria-hidden="true" />
                ค้นหา
              </Button>
              <Button type="button" variant="outline" onClick={resetFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          </div>

          {filterError && (
            <p
              id="effervescent-history-filter-error"
              role="alert"
              className="text-sm text-danger"
            >
              {filterError}
            </p>
          )}
        </form>
      </SectionCard>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          ทั้งหมด <span className="font-semibold text-foreground">{filteredRecords.length}</span> เอกสาร
        </p>
        <div className="w-40">
          <SelectField
            label="แสดงต่อหน้า"
            value={String(pageSize)}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
            options={[5, 10, 20, 50].map((count) => ({
              value: String(count),
              label: `${count} รายการ`,
            }))}
          />
        </div>
      </div>

      <FactoryDataTable
        rows={paginatedRows}
        rowKey={(sheet) => sheet.id}
        minWidth={1160}
        columns={[
          {
            key: "id",
            label: "รหัสเอกสาร",
            render: (sheet) => (
              <Button
                type="button"
                variant="link"
                title={sheet.id}
                className="h-auto max-w-56 justify-start whitespace-normal break-all p-0 text-left"
                onClick={() => onView(sheet)}
              >
                {sheet.id || "-"}
              </Button>
            ),
          },
          {
            key: "record_date",
            label: "วันที่บันทึก",
            render: (sheet) => (
              <span className="whitespace-nowrap tabular-nums">
                {formatRecordDate(sheet.record_date)}
              </span>
            ),
          },
          {
            key: "production_list",
            label: "รายการผลิต",
            render: (sheet) => (
              <span
                className="block max-w-48 whitespace-normal wrap-break-word"
                title={sheet.production_list}
              >
                {sheet.production_list.trim() || "-"}
              </span>
            ),
          },
          {
            key: "rows",
            label: "จำนวนวัตถุดิบ",
            numeric: true,
            render: (sheet) => (
              <span className="font-medium tabular-nums">{sheet.rows.length}</span>
            ),
          },
          {
            key: "prepared_by",
            label: "ผู้จัดทำ",
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {sheet.prepared_by.trim() || "-"}
              </span>
            ),
          },
          {
            key: "checked_by",
            label: "ผู้ตรวจสอบ",
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {sheet.checked_by.trim() || "-"}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: "แก้ไขล่าสุด",
            render: (sheet) => (
              <span className="whitespace-nowrap tabular-nums">
                {formatUpdatedAt(sheet.updated_at)}
              </span>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (sheet) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onView(sheet)}>
                  <Eye className="size-4" aria-hidden="true" />
                  ดู
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onEdit(sheet)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  แก้ไข
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => onPrint(sheet)}>
                  <Printer className="size-4" aria-hidden="true" />
                  พิมพ์
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => onDelete(sheet)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  ลบ
                </Button>
              </div>
            ),
          },
        ]}
        pagination={
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={filteredRecords.length}
            onChange={setPage}
          />
        }
      />
    </div>
  );
}
