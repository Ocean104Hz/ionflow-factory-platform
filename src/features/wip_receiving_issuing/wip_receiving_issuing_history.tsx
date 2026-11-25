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
  FactoryDataTable,
  Pagination,
  SectionCard,
  SelectField,
} from "@/src/components/factory/patterns";

import {
  emptyWipFilters,
  filterWipSheets,
  formatWipDate,
  formatWipDateTime,
  paginateWipSheets,
  wipFilterError,
  type WipHistoryFilters,
  type WipReceivingIssuingSheet,
} from "./wip_receiving_issuing_domain";

/* ---------------- types ---------------- */

type Props = {
  records: WipReceivingIssuingSheet[];
  onEdit: (sheet: WipReceivingIssuingSheet) => void;
  onView: (sheet: WipReceivingIssuingSheet) => void;
  onPrint: (sheet: WipReceivingIssuingSheet) => void;
  onDelete: (sheet: WipReceivingIssuingSheet) => void;
};

/* ---------------- helpers ---------------- */

function displayText(value: string): string {
  return value.trim() || "-";
}

/* ---------------- component ---------------- */

export function WipReceivingIssuingHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  /* ---------------- filter state ---------------- */

  const [draftFilters, setDraftFilters] =
    useState<WipHistoryFilters>(() => ({ ...emptyWipFilters }));

  const [filters, setFilters] =
    useState<WipHistoryFilters>(() => ({ ...emptyWipFilters }));

  const [filterError, setFilterError] = useState("");

  /* ---------------- pagination state ---------------- */

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------------- derived data ---------------- */

  const filteredRecords = filterWipSheets(records, filters);
  const paginated = paginateWipSheets(filteredRecords, page, pageSize);

  /* ---------------- filter actions ---------------- */

  function handleSearch() {
    const error = wipFilterError(draftFilters);
    setFilterError(error);

    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  function handleResetFilters() {
    setDraftFilters({ ...emptyWipFilters });
    setFilters({ ...emptyWipFilters });
    setFilterError("");
    setPage(1);
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-w-0 space-y-4">
      {/* Search and Filters */}
      <SectionCard
        title="ประวัติแบบบันทึกการรับ-จ่าย WIP"
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
              <Label htmlFor="wip-history-search">ค้นหา</Label>
              <Input
                id="wip-history-search"
                value={draftFilters.search}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
                placeholder="รหัสเอกสาร / ชื่อ WIP / ผู้จัดทำ / หมายเหตุ"
              />
            </div>

            {/* From Date: filter document_date, not created_at */}
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="wip-history-from">จากวันที่เอกสาร</Label>
              <Input
                id="wip-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "wip-history-filter-error" : undefined
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
              <Label htmlFor="wip-history-to">ถึงวันที่เอกสาร</Label>
              <Input
                id="wip-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "wip-history-filter-error" : undefined
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
                <Search className="size-4" aria-hidden="true" />
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

          {filterError && (
            <p
              id="wip-history-filter-error"
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
            options={[5, 10, 20, 50, 100].map((number) => ({
              value: String(number),
              label: `${number} รายการ`,
            }))}
          />
        </div>
      </div>

      {/* History Table */}
      <FactoryDataTable
        rows={paginated.items}
        rowKey={(sheet) => sheet.id}
        minWidth={1080}
        columns={[
          {
            key: "document_date",
            label: "วันที่เอกสาร",
            render: (sheet) => (
              <div className="max-w-48 whitespace-normal break-all">
                <Button
                  type="button"
                  variant="link"
                  className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                  onClick={() => onView(sheet)}
                  aria-label={`ดูเอกสาร WIP วันที่ ${formatWipDate(sheet.document_date) || sheet.document_date}`}
                >
                  {formatWipDate(sheet.document_date) || "-"}
                </Button>
                <p
                  className="mt-1 truncate text-xs text-muted-foreground"
                  title={sheet.id}
                >
                  ID: {sheet.id}
                </p>
              </div>
            ),
          },
          {
            key: "wip_count",
            label: "จำนวนรายการ WIP",
            numeric: true,
            render: (sheet) => (
              <span className="font-medium tabular-nums">
                {sheet.rows.length}
              </span>
            ),
          },
          {
            key: "prepared_by",
            label: "ผู้จัดทำ",
            render: (sheet) => (
              <span className="block max-w-40 whitespace-normal wrap-break-word">
                {displayText(sheet.prepared_by)}
              </span>
            ),
          },
          {
            key: "checked_by",
            label: "ผู้ตรวจสอบ",
            render: (sheet) => (
              <span className="block max-w-40 whitespace-normal wrap-break-word">
                {displayText(sheet.checked_by)}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: "อัปเดตล่าสุด",
            render: (sheet) => (
              <span className="whitespace-nowrap">
                {formatWipDateTime(sheet.updated_at)}
              </span>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (sheet) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onView(sheet)}
                >
                  <Eye className="size-4" aria-hidden="true" />
                  ดู
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPrint(sheet)}
                >
                  <Printer className="size-4" aria-hidden="true" />
                  พิมพ์
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(sheet)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  แก้ไข
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
