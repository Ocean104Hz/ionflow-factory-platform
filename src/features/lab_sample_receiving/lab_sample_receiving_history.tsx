
"use client";

import { useState } from "react";

import {
  Eye,
  Pencil,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

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

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="lab-history-from">
                จากวันที่บันทึก
              </Label>

              <Input
                id="lab-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "lab-history-filter-error"
                    : undefined
                }
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.currentTarget.value,
                  }))
                }
              />
            </div>

            {/* To Date */}

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="lab-history-to">
                ถึงวันที่บันทึก
              </Label>

              <Input
                id="lab-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "lab-history-filter-error"
                    : undefined
                }
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.currentTarget.value,
                  }))
                }
              />
            </div>

            {/* Actions */}

            <div className="flex flex-wrap items-end gap-2">
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
          </div>

          {/* Filter Error */}

          {filterError && (
            <p
              id="lab-history-filter-error"
              role="alert"
              className="text-sm text-danger"
            >
              {filterError}
            </p>
          )}
        </form>
      </SectionCard>

      {/* Page Size */}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          ทั้งหมด{" "}
          <span className="font-semibold text-foreground">
            {filteredRecords.length}
          </span>{" "}
          เอกสาร
        </div>

        <div className="w-40">
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

      {/* History Table */}

      <FactoryDataTable
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
              <div className="flex flex-wrap items-center gap-2">
                {/* View */}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onView(sheet)}
                >
                  <Eye
                    className="size-4"
                    aria-hidden="true"
                  />
                  ดู
                </Button>

                {/* Print */}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrint(sheet)}
                >
                  <Printer
                    className="size-4"
                    aria-hidden="true"
                  />
                  พิมพ์
                </Button>

                {/* Edit */}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(sheet)}
                >
                  <Pencil
                    className="size-4"
                    aria-hidden="true"
                  />
                  แก้ไข
                </Button>

                {/* Delete */}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => onDelete(sheet)}
                >
                  <Trash2
                    className="size-4"
                    aria-hidden="true"
                  />
                  ลบ
                </Button>
              </div>
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
    </div>
  );
}
