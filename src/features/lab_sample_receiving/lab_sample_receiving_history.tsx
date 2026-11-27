// NAN_LAB_ITECH_THEME_V1

"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState } from "react";

import {
  Download,
  FileText,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";

import {
  SectionCard,
  FactoryDataTable,
  Pagination,
  SelectField,
} from "@/src/components/factory/patterns";

import {
  emptyLabFilters,
  filterLabSheets,
  labFilterError,
  paginateLabSheets,
  formatLabDateTime,
  type LabSampleReceivingSheet,
  type LabSampleHistoryFilters,
} from "./lab_sample_receiving_domain";

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
  /* ---------------- filter state ---------------- */

  const [draftFilters, setDraftFilters] =
    useState<LabSampleHistoryFilters>(() => ({
      ...emptyLabFilters,
    }));

  const [filters, setFilters] =
    useState<LabSampleHistoryFilters>(() => ({
      ...emptyLabFilters,
    }));

  const [filterError, setFilterError] = useState("");

  /* ---------------- pagination state ---------------- */

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- derived data ---------------- */

  const filteredRecords = filterLabSheets(
    records,
    filters,
  );

  const paginated = paginateLabSheets(
    filteredRecords,
    page,
    pageSize,
  );

  /* ---------------- filter actions ---------------- */

  function handleSearch() {
    const error = labFilterError(draftFilters);

    setFilterError(error);

    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  function handleResetFilters() {
    setDraftFilters({ ...emptyLabFilters });
    setFilters({ ...emptyLabFilters });

    setFilterError("");
    setPage(1);
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-w-0 space-y-4">
      {/* Search and Filters */}

      <SectionCard
        contentClassName="space-y-4"
        title="ประวัติแบบบันทึกรับตัวอย่าง"
        subtitle={`พบ ${filteredRecords.length} จาก ${records.length} เอกสาร`}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Search */}

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="lab-history-search">
                ค้นหา
              </Label>

              <Input
                id="lab-history-search"
                value={draftFilters.search}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
                placeholder="คำขอ / รหัสตัวอย่าง / ชื่อ..."
              />
            </div>

            {/* From Date */}
            <div className="factory-itech-date-filter min-w-0">
              <ThaiBuddhistDatePicker label="จากวันที่บันทึก" value={draftFilters.from} onChange={(value) => setDraftFilters((current) => ({ ...current, from: value }))} />
            </div>

            {/* To Date */}
            <div className="factory-itech-date-filter min-w-0">
              <ThaiBuddhistDatePicker label="ถึงวันที่บันทึก" value={draftFilters.to} onChange={(value) => setDraftFilters((current) => ({ ...current, to: value }))} error={filterError || undefined} />
            </div>

            <div className="min-w-0">
              <SelectField
                label="แสดงต่อหน้า"
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
                options={[5, 10, 20, 50, 100].map(
                  (number) => ({
                    value: String(number),
                    label: `${number} รายการ`,
                  }),
                )}
              />
            </div>
          </div>

            {/* Actions */}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="submit">
                <Search
                  className="size-4"
                  aria-hidden="true"
                />
                ค้นหา
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetFilters}
              >
                ล้างตัวกรอง
              </Button>
            </div>

          {/* Filter Error */}

          {filterError && (
            <p
              id="lab-history-filter-error"
              role="alert"
              className="sr-only"
            >
              {filterError}
            </p>
          )}
        </form>

        <p className="text-sm text-muted-foreground">ทั้งหมด <span className="font-semibold text-foreground">{filteredRecords.length}</span> เอกสาร</p>

      {/* History Table */}

        <FactoryDataTable variant="history"
        rows={paginated.items}
        rowKey={(sheet) => sheet.id}
        minWidth={1200}
        columns={[
          {
            key: "request_no",
            label: "เลขที่คำขอ",
            render: (sheet) => {
              const requestNumbers = getUniqueValues(
                sheet,
                "request_no",
              );

              return (
                <div className="max-w-44 whitespace-normal break-all">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-full justify-start whitespace-normal break-all p-0 text-left"
                    title={requestNumbers.join(", ")}
                    onClick={() => onView(sheet)}
                  >
                    {summarizeValues(requestNumbers)}
                  </Button>

                  <p
                    className="mt-1 truncate text-xs text-muted-foreground"
                    title={sheet.id}
                  >
                    ID: {sheet.id}
                  </p>
                </div>
              );
            },
          },

          {
            key: "created_at",
            label: "วันที่บันทึก",
            render: (sheet) => (
              <span className="whitespace-nowrap">
                {formatLabDateTime(sheet.created_at)}
              </span>
            ),
          },

          {
            key: "sample_count",
            label: "จำนวนตัวอย่าง",
            numeric: true,
            render: (sheet) => (
              <span className="font-medium tabular-nums">
                {sheet.rows.length}
              </span>
            ),
          },

          {
            key: "sample_name",
            label: "ชื่อตัวอย่าง",
            render: (sheet) => (
              <div
                className="max-w-60 whitespace-normal wrap-break-word"
                title={getSampleNames(sheet)}
              >
                <p className="line-clamp-2">
                  {getSampleNames(sheet)}
                </p>
              </div>
            ),
          },

          {
            key: "sample_code",
            label: "รหัสตัวอย่าง",
            render: (sheet) => {
              const sampleCodes = getUniqueValues(
                sheet,
                "sample_code",
              );

              return (
                <span
                  className="block max-w-40 whitespace-normal break-all"
                  title={sampleCodes.join(", ")}
                >
                  {summarizeValues(sampleCodes)}
                </span>
              );
            },
          },

          {
            key: "updated_at",
            label: "อัปเดตล่าสุด",
            render: (sheet) => (
              <span className="whitespace-nowrap">
                {formatLabDateTime(sheet.updated_at)}
              </span>
            ),
          },

          {
            key: "actions",
            label: "จัดการ",
            render: (sheet) => (
              <RowActionMenu appearance="itech">
                {/* View */}

                <RowActionItem type="button" onClick={() => onView(sheet)}>
                  <FileText
                    className="size-4"
                    aria-hidden="true"
                  />
                  ดูรายงาน
                </RowActionItem>

                {/* Print */}

                <RowActionItem type="button" onClick={() => onPrint(sheet)}>
                  <Printer
                    className="size-4"
                    aria-hidden="true"
                  />
                  พิมพ์เอกสาร
                </RowActionItem>

                {/* Edit */}

                <RowActionItem type="button" onClick={() => onEdit(sheet)}>
                  <Pencil
                    className="size-4"
                    aria-hidden="true"
                  />
                  แก้ไข
                </RowActionItem>

                <RowActionItem disabled title="ยังไม่เปิดใช้งานการนำออก Excel">
                  <Download className="size-4" aria-hidden="true" />
                  นำออก Excel
                </RowActionItem>

                {/* Delete */}

                <RowActionItem type="button" onClick={() => onDelete(sheet)} className="w-full justify-start text-destructive">
                  <Trash2
                    className="size-4"
                    aria-hidden="true"
                  />
                  ลบเอกสาร
                </RowActionItem>
              </RowActionMenu>
            ),
          },
        ]}
        pagination={
          <Pagination
            page={paginated.page}
            pageSize={pageSize}
            total={filteredRecords.length}
            onChange={setPage}
          />
        }
        />
      </SectionCard>
    </div>
  );
}
