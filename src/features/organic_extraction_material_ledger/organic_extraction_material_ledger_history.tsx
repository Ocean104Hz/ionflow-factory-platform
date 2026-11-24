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
  ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT,
  emptyOrganicExtractionMaterialLedgerFilters,
  filterOrganicExtractionMaterialLedgerSheets,
  formatOrganicExtractionMaterialDate,
  formatOrganicExtractionMaterialSavedDate,
  hasOrganicExtractionMaterialQuantityEntry,
  organicExtractionMaterialLedgerFilterError,
  paginateOrganicExtractionMaterialLedgerSheets,
  type OrganicExtractionMaterialLedgerHistoryFilters,
  type OrganicExtractionMaterialLedgerSheet,
} from "./organic_extraction_material_ledger_domain";

type Props = {
  records: readonly OrganicExtractionMaterialLedgerSheet[];
  onEdit: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
  onView: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
  onPrint: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
  onDelete: (sheet: OrganicExtractionMaterialLedgerSheet) => void;
};

const labels = {
  historyTitle: "ประวัติบันทึกการรับ-จ่าย วัตถุดิบต้มสกัด",
  documentsFound: "พบ",
  of: "จาก",
  mockDocuments: "เอกสารจำลอง",
  search: "ค้นหา",
  searchPlaceholder: "รหัสเอกสาร / รหัสวัตถุดิบ / ชื่อวัตถุดิบ / ผู้จัดทำ",
  fromDate: "จากวันที่เอกสาร",
  toDate: "ถึงวันที่เอกสาร",
  resetFilters: "ล้างตัวกรอง",
  total: "ทั้งหมด",
  documents: "เอกสาร",
  pageSize: "แสดงต่อหน้า",
  items: "รายการ",
  docDate: "วันที่เอกสาร",
  recordCount: "รายการที่กรอกจำนวน",
  prepared: "ผู้จัดทำ",
  inspected: "ผู้ตรวจสอบ",
  updated: "อัปเดตล่าสุด",
  actions: "จัดการ",
  view: "ดู",
  preview: "พรีวิว",
  edit: "แก้ไข",
  del: "ลบ",
  doc: "เอกสารวันที่",
  identifier: "รหัส",
  manualNote: "ยอดยกมาของแต่ละเอกสารเป็นข้อมูลที่กรอกเอง ไม่ดึงจากเอกสารก่อนหน้า",
} as const;

const pageSizeOptions = [5, 10, 20, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} ${labels.items}`,
}));

function displayText(value: string): string {
  return value.trim() || "-";
}

/** Do not sum balances of different raw materials into a document total. */
function countPopulatedQuantityRows(
  sheet: OrganicExtractionMaterialLedgerSheet,
): number {
  return sheet.rows.filter(hasOrganicExtractionMaterialQuantityEntry).length;
}

export function OrganicExtractionMaterialLedgerHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  const [draftFilters, setDraftFilters] =
    useState<OrganicExtractionMaterialLedgerHistoryFilters>(() => ({
      ...emptyOrganicExtractionMaterialLedgerFilters,
    }));
  const [filters, setFilters] =
    useState<OrganicExtractionMaterialLedgerHistoryFilters>(() => ({
      ...emptyOrganicExtractionMaterialLedgerFilters,
    }));
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRecords = filterOrganicExtractionMaterialLedgerSheets(
    records,
    filters,
  );
  const paginated = paginateOrganicExtractionMaterialLedgerSheets(
    filteredRecords,
    page,
    pageSize,
  );

  function handleSearch() {
    const error = organicExtractionMaterialLedgerFilterError(draftFilters);
    setFilterError(error);
    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  function handleResetFilters() {
    setDraftFilters({ ...emptyOrganicExtractionMaterialLedgerFilters });
    setFilters({ ...emptyOrganicExtractionMaterialLedgerFilters });
    setFilterError("");
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title={labels.historyTitle}
        subtitle={`${labels.documentsFound} ${filteredRecords.length} ${labels.of} ${records.length} ${labels.mockDocuments}`}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-extraction-ledger-history-search">
                {labels.search}
              </Label>
              <Input
                id="organic-extraction-ledger-history-search"
                value={draftFilters.search}
                placeholder={labels.searchPlaceholder}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
              />
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-extraction-ledger-history-from">
                {labels.fromDate}
              </Label>
              <Input
                id="organic-extraction-ledger-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "organic-extraction-ledger-history-filter-error"
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
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-extraction-ledger-history-to">
                {labels.toDate}
              </Label>
              <Input
                id="organic-extraction-ledger-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError
                    ? "organic-extraction-ledger-history-filter-error"
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
            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit">
                <Search className="size-4" aria-hidden="true" />
                {labels.search}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleResetFilters}
              >
                {labels.resetFilters}
              </Button>
            </div>
          </div>
          {filterError && (
            <p
              id="organic-extraction-ledger-history-filter-error"
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
          {labels.total}{" "}
          <span className="font-semibold text-foreground">
            {filteredRecords.length}
          </span>{" "}
          {labels.documents}
        </p>
        <div className="w-40">
          <SelectField
            label={labels.pageSize}
            value={String(pageSize)}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
            options={pageSizeOptions}
          />
        </div>
      </div>

      <FactoryDataTable
        rows={paginated.items}
        rowKey={(sheet) => sheet.id}
        minWidth={1050}
        columns={[
          {
            key: "document_date",
            label: labels.docDate,
            render: (sheet) => {
              const date =
                formatOrganicExtractionMaterialDate(sheet.document_date) ||
                sheet.document_date;
              return (
                <div className="max-w-44 min-w-0">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                    aria-label={`${labels.view}${labels.doc} ${date} ${labels.identifier} ${sheet.id}`}
                    onClick={() => onView(sheet)}
                  >
                    {date}
                  </Button>
                  <p
                    className="mt-1 max-w-44 truncate text-xs text-muted-foreground"
                    title={sheet.id}
                  >
                    ID: {sheet.id}
                  </p>
                </div>
              );
            },
          },
          {
            key: "quantity_count",
            label: labels.recordCount,
            numeric: true,
            render: (sheet) => (
              <span className="whitespace-nowrap font-medium tabular-nums">
                {countPopulatedQuantityRows(sheet)} /{" "}
                {ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT}
              </span>
            ),
          },
          {
            key: "prepared_by",
            label: labels.prepared,
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {displayText(sheet.prepared_by)}
              </span>
            ),
          },
          {
            key: "inspected_by",
            label: labels.inspected,
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {displayText(sheet.inspected_by)}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: labels.updated,
            render: (sheet) => (
              <span className="whitespace-nowrap text-sm tabular-nums">
                {formatOrganicExtractionMaterialSavedDate(sheet.updated_at)}
              </span>
            ),
          },
          {
            key: "actions",
            label: labels.actions,
            render: (sheet) => {
              const date =
                formatOrganicExtractionMaterialDate(sheet.document_date) ||
                sheet.document_date;
              const documentLabel = `${labels.doc} ${date} ${labels.identifier} ${sheet.id}`;

              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${labels.view}${documentLabel}`}
                    onClick={() => onView(sheet)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {labels.view}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${labels.preview}${documentLabel}`}
                    onClick={() => onPrint(sheet)}
                  >
                    <Printer className="size-4" aria-hidden="true" />
                    {labels.preview}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${labels.edit}${documentLabel}`}
                    onClick={() => onEdit(sheet)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {labels.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:text-danger"
                    aria-label={`${labels.del}${documentLabel}`}
                    onClick={() => onDelete(sheet)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {labels.del}
                  </Button>
                </div>
              );
            },
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
      <p className="text-xs text-muted-foreground">
        {labels.manualNote}
      </p>
    </div>
  );
}
