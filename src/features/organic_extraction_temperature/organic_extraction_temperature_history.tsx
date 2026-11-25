"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
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
  ORGANIC_EXTRACTION_MACHINES,
  emptyOrganicExtractionHistoryFilters,
  filterOrganicExtractionSheets,
  formatOrganicExtractionDate,
  formatOrganicExtractionDateTime,
  hasOrganicExtractionRoundData,
  organicExtractionFilterError,
  paginateOrganicExtractionSheets,
  type OrganicExtractionHistoryFilters,
  type OrganicExtractionProductionRound,
  type OrganicExtractionTemperatureSheet,
} from "./organic_extraction_temperature_domain";

type Props = {
  records: OrganicExtractionTemperatureSheet[];
  onEdit: (sheet: OrganicExtractionTemperatureSheet) => void;
  onView: (sheet: OrganicExtractionTemperatureSheet) => void;
  onPrint: (sheet: OrganicExtractionTemperatureSheet) => void;
  onDelete: (sheet: OrganicExtractionTemperatureSheet) => void;
};

const pageSizeOptions = [5, 10, 20, 50, 100].map((size) => ({
  value: String(size),
  label: `${size} รายการ`,
}));

function displayText(value: string): string {
  return value.trim() || "-";
}

/** Summarize each production round without merging its B1-B6 measurements. */
function RoundSummary({ round }: { round: OrganicExtractionProductionRound | undefined }) {
  if (!round || !hasOrganicExtractionRoundData(round)) {
    return (
      <span className="text-xs text-muted-foreground">
        ยังไม่มีข้อมูลรอบนี้
      </span>
    );
  }

  const quantityCells = round.usage_rows.reduce(
    (count, row) =>
      count +
      ORGANIC_EXTRACTION_MACHINES.filter((machine) =>
        Boolean(row.quantities[machine].trim()),
      ).length,
    0,
  );
  const temperatureCells = round.temperature_rows.reduce(
    (count, row) =>
      count +
      ORGANIC_EXTRACTION_MACHINES.filter((machine) =>
        Boolean(row.temperatures[machine].trim()),
      ).length,
    0,
  );
  const phCells = ORGANIC_EXTRACTION_MACHINES.filter((machine) =>
    Boolean(round.ph_values[machine].trim()),
  ).length;

  const timeRange =
    round.start_time || round.end_time
      ? `${round.start_time || "?"} - ${round.end_time || "?"}`
      : "";

  return (
    <div className="min-w-0 space-y-1">
      <p className="max-w-48 whitespace-normal wrap-break-word text-sm font-medium text-foreground">
        {displayText(round.production_name)}
      </p>
      {timeRange && (
        <p className="text-xs tabular-nums text-muted-foreground">
          เวลา {timeRange}
        </p>
      )}
      <p className="whitespace-normal text-xs text-muted-foreground">
        ปริมาณ {quantityCells} ช่อง · อุณหภูมิ {temperatureCells} ช่อง · pH {phCells} ช่อง
      </p>
    </div>
  );
}

export function OrganicExtractionTemperatureHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: Props) {
  const [draftFilters, setDraftFilters] =
    useState<OrganicExtractionHistoryFilters>(() => ({
      ...emptyOrganicExtractionHistoryFilters,
    }));
  const [filters, setFilters] = useState<OrganicExtractionHistoryFilters>(() => ({
    ...emptyOrganicExtractionHistoryFilters,
  }));
  const [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredRecords = filterOrganicExtractionSheets(records, filters);
  const paginated = paginateOrganicExtractionSheets(
    filteredRecords,
    page,
    pageSize,
  );

  function handleSearch() {
    const error = organicExtractionFilterError(draftFilters);
    setFilterError(error);
    if (error) {
      return;
    }

    setFilters({ ...draftFilters });
    setPage(1);
  }

  function handleResetFilters() {
    setDraftFilters({ ...emptyOrganicExtractionHistoryFilters });
    setFilters({ ...emptyOrganicExtractionHistoryFilters });
    setFilterError("");
    setPage(1);
  }

  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต"
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
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-extraction-history-search">ค้นหา</Label>
              <Input
                id="organic-extraction-history-search"
                value={draftFilters.search}
                placeholder="รหัสเอกสาร / วัตถุดิบ / รายการผลิต / ผู้จัดทำ"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    search: event.currentTarget.value,
                  }))
                }
              />
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <Label htmlFor="organic-extraction-history-from">
                จากวันที่เอกสาร
              </Label>
              <Input
                id="organic-extraction-history-from"
                type="date"
                value={draftFilters.from}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "organic-extraction-history-filter-error" : undefined
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
              <Label htmlFor="organic-extraction-history-to">
                ถึงวันที่เอกสาร
              </Label>
              <Input
                id="organic-extraction-history-to"
                type="date"
                value={draftFilters.to}
                aria-invalid={Boolean(filterError)}
                aria-describedby={
                  filterError ? "organic-extraction-history-filter-error" : undefined
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
              <Button type="button" variant="outline" onClick={handleResetFilters}>
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
          {filterError && (
            <p
              id="organic-extraction-history-filter-error"
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
            options={pageSizeOptions}
          />
        </div>
      </div>

      <FactoryDataTable variant="history"
        rows={paginated.items}
        rowKey={(sheet) => sheet.id}
        minWidth={1210}
        columns={[
          {
            key: "document_date",
            label: "วันที่เอกสาร",
            render: (sheet) => {
              const date =
                formatOrganicExtractionDate(sheet.document_date) ||
                sheet.document_date;
              return (
                <div className="max-w-44 whitespace-normal break-all">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto max-w-full justify-start whitespace-normal p-0 text-left"
                    aria-label={`ดูเอกสารวันที่ ${date} รหัส ${sheet.id}`}
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
            key: "round_1",
            label: "รอบที่ 1",
            render: (sheet) => <RoundSummary round={sheet.rounds[0]} />,
          },
          {
            key: "round_2",
            label: "รอบที่ 2",
            render: (sheet) => <RoundSummary round={sheet.rounds[1]} />,
          },
          {
            key: "prepared_by",
            label: "ผู้จัดทำ",
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {displayText(sheet.prepared_by)}
              </span>
            ),
          },
          {
            key: "inspected_by",
            label: "ผู้ตรวจสอบ",
            render: (sheet) => (
              <span className="block max-w-36 whitespace-normal wrap-break-word">
                {displayText(sheet.inspected_by)}
              </span>
            ),
          },
          {
            key: "updated_at",
            label: "อัปเดตล่าสุด",
            render: (sheet) => (
              <span className="whitespace-nowrap">
                {formatOrganicExtractionDateTime(sheet.updated_at)}
              </span>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (sheet) => {
              const documentLabel = `เอกสารวันที่ ${
                formatOrganicExtractionDate(sheet.document_date) || sheet.document_date
              } รหัส ${sheet.id}`;

              return (
                <RowActionMenu>
                  <RowActionItem type="button" aria-label={`ดู${documentLabel}`} onClick={() => onView(sheet)}>
                    <Eye className="size-4" aria-hidden="true" />
                    ดู
                  </RowActionItem>
                  <RowActionItem type="button" aria-label={`พรีวิว${documentLabel}`} onClick={() => onPrint(sheet)}>
                    <Printer className="size-4" aria-hidden="true" />
                    พรีวิว
                  </RowActionItem>
                  <RowActionItem type="button" aria-label={`แก้ไข${documentLabel}`} onClick={() => onEdit(sheet)}>
                    <Pencil className="size-4" aria-hidden="true" />
                    แก้ไข
                  </RowActionItem>
                  <RowActionItem type="button" aria-label={`ลบ${documentLabel}`} onClick={() => onDelete(sheet)} className="w-full justify-start text-destructive">
                    <Trash2 className="size-4" aria-hidden="true" />
                    ลบ
                  </RowActionItem>
                </RowActionMenu>
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
