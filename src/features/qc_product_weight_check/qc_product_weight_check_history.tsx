
"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
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
  FactoryDataTable,
  Pagination,
  SectionCard,
  SelectField,
} from "@/src/components/factory/patterns";

import {
  emptyQcWeightFilters,
  filterQcWeightDocuments,
  formatQcWeightDate,
  paginateQcWeightDocuments,
  qcWeightFilterError,
  type QcProductWeightCheckDocument,
  type QcWeightHistoryFilters,
} from "./qc_product_weight_check_domain";

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

  const [draftFilters, setDraftFilters] =
    useState<QcWeightHistoryFilters>(() => ({
      ...emptyQcWeightFilters,
    }));

  const [filters, setFilters] =
    useState<QcWeightHistoryFilters>(() => ({
      ...emptyQcWeightFilters,
    }));

  const [filterError, setFilterError] =
    useState("");

  /* ---------------- pagination ---------------- */

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- derived data ---------------- */

  const filteredRecords =
    filterQcWeightDocuments(
      records,
      filters,
    );

  const paginated =
    paginateQcWeightDocuments(
      filteredRecords,
      page,
      pageSize,
    );

  /* ---------------- search ---------------- */

  function handleSearch() {
    const error = qcWeightFilterError(
      draftFilters,
    );

    setFilterError(error);

    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  /* ---------------- reset filters ---------------- */

  function handleResetFilters() {
    setDraftFilters({
      ...emptyQcWeightFilters,
    });

    setFilters({
      ...emptyQcWeightFilters,
    });

    setFilterError("");
    setPage(1);
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-w-0 space-y-4">
      {/* Search And Filters */}

      <SectionCard
        title="ประวัติการตรวจเช็ค QC น้ำหนักผลิตภัณฑ์"
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
              <Label htmlFor="qc-weight-history-search">
                ค้นหาเอกสาร
              </Label>

              <Input
                id="qc-weight-history-search"
                value={draftFilters.search}
                placeholder="เลขที่เอกสาร / ผลิตภัณฑ์ / หมายเลขบ็อกซ์"
                onChange={(event) => {
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }));

                  setFilterError("");
                }}
              />
            </div>

            {/* From Date */}

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="qc-weight-history-from">
                จากวันที่เอกสาร
              </Label>

              <Input
                id="qc-weight-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "qc-weight-history-filter-error"
                    : undefined
                }
                onChange={(event) => {
                  setDraftFilters((current) => ({
                    ...current,
                    from: event.currentTarget.value,
                  }));

                  setFilterError("");
                }}
              />
            </div>

            {/* To Date */}

            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="qc-weight-history-to">
                ถึงวันที่เอกสาร
              </Label>

              <Input
                id="qc-weight-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "qc-weight-history-filter-error"
                    : undefined
                }
                onChange={(event) => {
                  setDraftFilters((current) => ({
                    ...current,
                    to: event.currentTarget.value,
                  }));

                  setFilterError("");
                }}
              />
            </div>

            {/* Filter Buttons */}

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
              id="qc-weight-history-filter-error"
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
        <p className="text-sm text-muted-foreground">
          ทั้งหมด{" "}
          <span className="font-semibold text-foreground">
            {filteredRecords.length}
          </span>{" "}
          เอกสาร
        </p>

        <div className="w-40">
          <SelectField
            label="แสดงต่อหน้า"
            value={String(pageSize)}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
            options={[5, 10, 20, 50].map(
              (number) => ({
                value: String(number),
                label: `${number} รายการ`,
              }),
            )}
          />
        </div>
      </div>

      {/* History Table */}

      <FactoryDataTable variant="history"
        rows={paginated.items}
        rowKey={(document) => document.id}
        minWidth={1350}
        columns={[
          /* Document Number */

          {
            key: "doc_no",
            label: "เลขที่เอกสาร",
            render: (document) => (
              <Button
                type="button"
                variant="link"
                className="h-auto max-w-44 justify-start whitespace-normal break-all p-0 text-left"
                onClick={() => onView(document)}
              >
                {document.doc_no}
              </Button>
            ),
          },

          /* Document Date */

          {
            key: "doc_date",
            label: "วันที่เอกสาร",
            render: (document) => (
              <span className="whitespace-nowrap">
                {formatQcWeightDate(
                  document.doc_date,
                ) || "-"}
              </span>
            ),
          },

          /* Product */

          {
            key: "product_name",
            label: "ชื่อผลิตภัณฑ์",
            render: (document) => (
              <span
                className="block max-w-52 whitespace-normal wrap-break-word"
                title={document.product_name}
              >
                {document.product_name || "-"}
              </span>
            ),
          },

          /* Box Number */

          {
            key: "box_no",
            label: "หมายเลขบ็อกซ์",
            render: (document) => (
              <span className="block max-w-36 wrap-break-word">
                {document.lot_no || "-"}
              </span>
            ),
          },

          /* Check Count */

          {
            key: "row_count",
            label: "จำนวนรอบตรวจ",
            numeric: true,
            render: (document) => (
              <span className="font-medium tabular-nums">
                {document.rows.length}
              </span>
            ),
          },

          /* Check Results */

          {
            key: "results",
            label: "ผลการตรวจสอบ",
            render: (document) => {
              const counts =
                getResultCounts(document);

              return (
                <div className="flex min-w-36 flex-col gap-1 text-xs">
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
              );
            },
          },

          /* Updated Date */

          {
            key: "updated_at",
            label: "แก้ไขล่าสุด",
            render: (document) => (
              <span className="whitespace-nowrap">
                {formatUpdatedAt(
                  document.updated_at,
                )}
              </span>
            ),
          },

          /* Actions */

          {
            key: "actions",
            label: "จัดการ",
            render: (document) => (
              <RowActionMenu>
                {/* View */}

                <RowActionItem type="button" onClick={() => onView(document)}>
                  <Eye
                    className="size-4"
                    aria-hidden="true"
                  />
                  ดู
                </RowActionItem>

                {/* Print Preview */}

                <RowActionItem type="button" onClick={() => onPrint(document)}>
                  <Printer
                    className="size-4"
                    aria-hidden="true"
                  />
                  พรีวิว
                </RowActionItem>

                {/* Edit */}

                <RowActionItem type="button" onClick={() => onEdit(document)}>
                  <Pencil
                    className="size-4"
                    aria-hidden="true"
                  />
                  แก้ไข
                </RowActionItem>

                {/* Delete */}

                <RowActionItem type="button" onClick={() => onDelete(document)} className="w-full justify-start text-destructive">
                  <Trash2
                    className="size-4"
                    aria-hidden="true"
                  />
                  ลบ
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
    </div>
  );
}
