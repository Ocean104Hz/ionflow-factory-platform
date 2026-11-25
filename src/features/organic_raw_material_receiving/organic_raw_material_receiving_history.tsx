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
  emptyOrganicRawMaterialFilters,
  filterOrganicRawMaterialSheets,
  formatOrganicMaterialDate,
  formatOrganicMaterialDateTime,
  getOrganicMaterialUsedRows,
  organicMaterialFilterError,
  paginateOrganicRawMaterialSheets,
  type OrganicRawMaterialHistoryFilters,
  type OrganicRawMaterialReceivingSheet,
} from "./organic_raw_material_receiving_domain";

type Props = {
  records: OrganicRawMaterialReceivingSheet[];
  onEdit: (sheet: OrganicRawMaterialReceivingSheet) => void;
  onView: (sheet: OrganicRawMaterialReceivingSheet) => void;
  onPrint: (sheet: OrganicRawMaterialReceivingSheet) => void;
  onDelete: (sheet: OrganicRawMaterialReceivingSheet) => void;
};

const text = {
  title: "ประวัติใบตรวจรับวัตถุดิบ/รับเข้าวัตถุดิบ",
  search: "ค้นหา",
  searchPlaceholder: "รหัสเอกสาร / รหัสวัตถุดิบ / Supplier / ผู้รับ / หมายเหตุ",
  from: "จากวันที่เอกสาร",
  to: "ถึงวันที่เอกสาร",
  reset: "ล้างตัวกรอง",
  pageSize: "แสดงต่อหน้า",
  date: "วันที่เอกสาร",
  used: "รายการที่บันทึก",
  receiver: "ผู้รับ",
  inspector: "ผู้ตรวจสอบ",
  updated: "อัปเดตล่าสุด",
  actions: "จัดการ",
  view: "ดู",
  print: "พิมพ์",
  edit: "แก้ไข",
  delete: "ลบ",
  document: "เอกสาร",
  records: "รายการ",
  all: "ทั้งหมด",
  found: "พบ",
  fromCount: "จาก",
  demo: "เอกสาร",
  viewDocument: "ดูใบตรวจรับวัตถุดิบวันที่",
  printDocument: "พรีวิวใบตรวจรับวัตถุดิบวันที่",
  editDocument: "แก้ไขใบตรวจรับวัตถุดิบวันที่",
  deleteDocument: "ลบใบตรวจรับวัตถุดิบวันที่",
} as const;

const pageSizeOptions = [5, 10, 20, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} ${text.records}`,
}));

function displayText(value: string): string {
  return value.trim() || "-";
}

export function OrganicRawMaterialReceivingHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  const [draftFilters, setDraftFilters] = useState<OrganicRawMaterialHistoryFilters>(
    () => ({ ...emptyOrganicRawMaterialFilters }),
  );
  const [filters, setFilters] = useState<OrganicRawMaterialHistoryFilters>(
    () => ({ ...emptyOrganicRawMaterialFilters }),
  );
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRecords = filterOrganicRawMaterialSheets(records, filters);
  const paginated = paginateOrganicRawMaterialSheets(
    filteredRecords,
    page,
    pageSize,
  );

  function handleSearch() {
    const error = organicMaterialFilterError(draftFilters);
    setFilterError(error);
    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  function handleResetFilters() {
    setDraftFilters({ ...emptyOrganicRawMaterialFilters });
    setFilters({ ...emptyOrganicRawMaterialFilters });
    setFilterError("");
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title={text.title}
        subtitle={`${text.found} ${filteredRecords.length} ${text.fromCount} ${records.length} ${text.demo}`}
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
              <Label htmlFor="organic-material-history-search">
                {text.search}
              </Label>
              <Input
                id="organic-material-history-search"
                value={draftFilters.search}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
                placeholder={text.searchPlaceholder}
              />
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-material-history-from">
                {text.from}
              </Label>
              <Input
                id="organic-material-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "organic-material-history-filter-error" : undefined
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
              <Label htmlFor="organic-material-history-to">
                {text.to}
              </Label>
              <Input
                id="organic-material-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "organic-material-history-filter-error" : undefined
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
                {text.search}
              </Button>
              <Button type="button" variant="outline" onClick={handleResetFilters}>
                {text.reset}
              </Button>
            </div>
          </div>
          {filterError && (
            <p
              id="organic-material-history-filter-error"
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
          {text.all} <span className="font-semibold text-foreground">{filteredRecords.length}</span> {text.document}
        </p>
        <div className="w-40">
          <SelectField
            label={text.pageSize}
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
        minWidth={1080}
        columns={[
          {
            key: "document_date",
            label: text.date,
            render: (sheet) => {
              const formattedDate =
                formatOrganicMaterialDate(sheet.document_date) || sheet.document_date;
              return (
                <div className="max-w-48 whitespace-normal break-all">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                    aria-label={`${text.viewDocument} ${formattedDate}`}
                    onClick={() => onView(sheet)}
                  >
                    {formattedDate}
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
            key: "used_rows",
            label: text.used,
            numeric: true,
            render: (sheet) => (
              <span className="font-medium tabular-nums">
                {getOrganicMaterialUsedRows(sheet).length}/{sheet.rows.length}
              </span>
            ),
          },
          {
            key: "received_by",
            label: text.receiver,
            render: (sheet) => (
              <span className="block max-w-40 whitespace-normal wrap-break-word">
                {displayText(sheet.received_by)}
              </span>
            ),
          },
          {
            key: "inspected_by",
            label: text.inspector,
            render: (sheet) => (
              <span className="block max-w-40 whitespace-normal wrap-break-word">
                {displayText(sheet.inspected_by)}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: text.updated,
            render: (sheet) => (
              <span className="whitespace-nowrap">
                {formatOrganicMaterialDateTime(sheet.updated_at)}
              </span>
            ),
          },
          {
            key: "actions",
            label: text.actions,
            render: (sheet) => {
              const date =
                formatOrganicMaterialDate(sheet.document_date) || sheet.document_date;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${text.viewDocument} ${date}`}
                    onClick={() => onView(sheet)}
                  >
                    <Eye className="size-4" aria-hidden="true" />
                    {text.view}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${text.printDocument} ${date}`}
                    onClick={() => onPrint(sheet)}
                  >
                    <Printer className="size-4" aria-hidden="true" />
                    {text.print}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${text.editDocument} ${date}`}
                    onClick={() => onEdit(sheet)}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    {text.edit}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`${text.deleteDocument} ${date}`}
                    className="text-danger hover:text-danger"
                    onClick={() => onDelete(sheet)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {text.delete}
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
    </div>
  );
}
