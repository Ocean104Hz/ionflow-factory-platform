"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, Save } from "lucide-react";

import { PageHeader } from "@/src/components/factory/patterns";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
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
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { createStockWipMockSheets } from "@/src/lib/mock-data/stock_wip_ff";

import {
  DEFAULT_STOCK_WIP_FILTERS,
  saveStockWipSheet,
  stockWipPeriodKey,
  updateStockWipDaily,
  updateStockWipSummary,
  validateStockWipSheet,
  type StockWipFilters as StockWipFilterValues,
  type StockWipMovementField,
  type StockWipPeriod,
  type StockWipRow,
  type StockWipSheet,
  type StockWipSummaryField,
  type StockWipValidationErrors,
} from "./stock_wip_ff_domain";
import { StockWipDailyDetail } from "./stock_wip_ff_daily_detail";
import { StockWipFilters } from "./stock_wip_ff_filters";
import { StockWipSummary } from "./stock_wip_ff_summary";
import { StockWipTable } from "./stock_wip_ff_table";

/**
 * Stock WIP FF: UI MOCK ONLY.
 * All edits and saved sheets remain in React State, and are lost on page refresh.
 * No API, database, browser storage, or automatic Excel balance calculation.
 */

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
};

function copyFilters(filters: StockWipFilterValues): StockWipFilterValues {
  return {
    ...filters,
    period: { ...filters.period },
  };
}

function createInitialDraft(): StockWipSheet {
  const key = stockWipPeriodKey(DEFAULT_STOCK_WIP_FILTERS.period);
  const sheet = createStockWipMockSheets().find((entry) => entry.id === key);

  if (!sheet) {
    throw new Error(`Missing initial Stock WIP mock sheet: ${key}`);
  }

  return sheet;
}

function periodLabel(period: StockWipPeriod): string {
  if (period.view === "YEAR") {
    return `สรุปรายปี พ.ศ. ${period.year_be}`;
  }

  const calendarMonth = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(period.year_be - 543, period.month - 1, 1)));

  return `${calendarMonth} พ.ศ. ${period.year_be}`;
}

function normalizeSearch(text: string): string {
  return text.trim().toLocaleLowerCase("th-TH");
}

function filterStockWipRows(
  rows: readonly StockWipRow[],
  filters: StockWipFilterValues,
): StockWipRow[] {
  const search = normalizeSearch(filters.search);

  return rows.filter((row) => {
    if (filters.category !== "ALL" && row.item.category !== filters.category) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [row.item.code_new, row.item.code_old ?? "", row.item.name].some(
      (value) => normalizeSearch(value).includes(search),
    );
  });
}

export function StockWipWorkspace() {
  const [savedSheets, setSavedSheets] = useState<StockWipSheet[]>(
    createStockWipMockSheets,
  );
  const [draft, setDraft] = useState<StockWipSheet>(createInitialDraft);
  const [filters, setFilters] = useState<StockWipFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_WIP_FILTERS),
  );
  const [selectedDailyCode, setSelectedDailyCode] = useState<string | null>(
    null,
  );
  const [pendingFilters, setPendingFilters] =
    useState<StockWipFilterValues | null>(null);
  const [errors, setErrors] = useState<StockWipValidationErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = savedSheets.find((sheet) => sheet.id === draft.id);
  const hasUnsavedChanges =
    JSON.stringify(draft.rows) !== JSON.stringify(savedSheet?.rows ?? []);
  const visibleRows = useMemo(
    () => filterStockWipRows(draft.rows, filters),
    [draft.rows, filters],
  );
  const selectedDailyRow =
    selectedDailyCode && draft.period.view === "MONTH"
      ? visibleRows.find((row) => row.item.code_new === selectedDailyCode)
      : undefined;
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (errorCount > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errorCount]);

  function openPeriod(nextFilters: StockWipFilterValues) {
    const key = stockWipPeriodKey(nextFilters.period);
    const nextSheet = savedSheets.find((sheet) => sheet.id === key);

    if (!nextSheet) {
      setNotice({
        tone: "error",
        text: `ไม่พบข้อมูลจำลองสำหรับช่วงเวลา ${periodLabel(nextFilters.period)}`,
      });
      return;
    }

    setFilters(copyFilters(nextFilters));
    setDraft(structuredClone(nextSheet));
    setSelectedDailyCode(null);
    setErrors({});
    setNotice(null);
  }

  function handleFiltersChange(nextFilters: StockWipFilterValues) {
    const currentKey = stockWipPeriodKey(filters.period);
    const nextKey = stockWipPeriodKey(nextFilters.period);

    if (currentKey === nextKey) {
      setFilters(copyFilters(nextFilters));
      setSelectedDailyCode(null);
      return;
    }

    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(nextFilters));
      return;
    }

    openPeriod(nextFilters);
  }

  function handleSummaryChange(
    codeNew: string,
    field: StockWipSummaryField,
    value: string,
  ) {
    setDraft((current) =>
      updateStockWipSummary(current, codeNew, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleDailyChange(
    codeNew: string,
    date: string,
    field: StockWipMovementField,
    value: string,
  ) {
    setDraft((current) =>
      updateStockWipDaily(current, codeNew, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleDiscard() {
    if (!savedSheet) {
      setNotice({
        tone: "error",
        text: "ไม่พบข้อมูลที่บันทึกไว้สำหรับช่วงเวลานี้",
      });
      return;
    }

    setDraft(structuredClone(savedSheet));
    setErrors({});
    setNotice({
      tone: "info",
      text: "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นค่าที่บันทึกไว้ล่าสุดในหน้านี้",
    });
  }

  function handleSave() {
    const nextErrors = validateStockWipSheet(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ช่องตัวเลขที่ไม่ถูกต้องก่อน",
      });
      return;
    }

    try {
      const updatedSheets = saveStockWipSheet(
        savedSheets,
        draft,
        new Date().toISOString(),
      );
      const saved = updatedSheets.find((sheet) => sheet.id === draft.id);

      if (!saved) {
        throw new Error("The saved mock sheet was not found.");
      }

      setSavedSheets(updatedSheets);
      setDraft(structuredClone(saved));
      setErrors({});
      setNotice({
        tone: "success",
        text: "บันทึกข้อมูลจำลองใน React State แล้ว ข้อมูลจะหายเมื่อรีเฟรชหน้าเว็บ",
      });
    } catch {
      setNotice({
        tone: "error",
        text: "ไม่สามารถบันทึกข้อมูลจำลองได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
      });
    }
  }

  function confirmPeriodChange() {
    if (!pendingFilters) {
      return;
    }

    openPeriod(pendingFilters);
    setPendingFilters(null);
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Stock WIP FF"
        description="สต็อกสินค้าระหว่างการผลิตจากไฟล์ Stock WIP FF 2569.xlsx"
        actions={
          <Badge variant="outline">UI MOCK · React State เท่านั้น</Badge>
        }
      />

      <StockWipFilters
        value={filters}
        onChange={handleFiltersChange}
        onReset={() =>
          handleFiltersChange(copyFilters(DEFAULT_STOCK_WIP_FILTERS))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {periodLabel(filters.period)}
          </p>
          <p className="text-xs text-muted-foreground">
            {draft.source_sheet_name} · แสดง{" "}
            {visibleRows.length.toLocaleString("th-TH")} จาก{" "}
            {draft.rows.length.toLocaleString("th-TH")} รายการ
          </p>
          <p className="text-xs text-muted-foreground">
            {hasUnsavedChanges
              ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
              : "ข้อมูลตรงกับฉบับที่บันทึกไว้ในหน้านี้"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={!hasUnsavedChanges}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
          >
            <Save className="size-4" aria-hidden="true" />
            บันทึกข้อมูลจำลอง
          </Button>
        </div>
      </div>

      {notice && (
        <Alert variant={notice.tone === "error" ? "destructive" : "default"}>
          {notice.tone === "success" ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          <AlertTitle>
            {notice.tone === "success"
              ? "บันทึกสำเร็จ (เฉพาะข้อมูลจำลอง)"
              : notice.tone === "error"
                ? "ต้องตรวจสอบข้อมูล"
                : "ยกเลิกการแก้ไขแล้ว"}
          </AlertTitle>
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {errorCount > 0 && (
        <div ref={errorSummaryRef} tabIndex={-1}>
          <Alert variant="destructive">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertTitle>
              พบข้อมูลที่ไม่ผ่านการตรวจสอบ {errorCount} ช่อง
            </AlertTitle>
            <AlertDescription>
              ตรวจสอบช่องที่มีสีเตือนในตารางหลักหรือรายละเอียดรายวัน
              แล้วบันทึกใหม่
            </AlertDescription>
          </Alert>
        </div>
      )}

      <StockWipSummary rows={visibleRows} />

      <StockWipTable
        rows={visibleRows}
        supportsBioTransfer={draft.supports_bio_transfer}
        onChange={handleSummaryChange}
        onViewDaily={
          draft.period.view === "MONTH"
            ? (row) => setSelectedDailyCode(row.item.code_new)
            : undefined
        }
      />

      <Dialog
        open={Boolean(selectedDailyRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDailyCode(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-2 sm:max-w-[calc(100vw-3rem)] sm:p-4 2xl:max-w-360"
        >
          {selectedDailyRow && (
            <>
              <DialogTitle className="sr-only">
                ข้อมูลรายวันของ {selectedDailyRow.item.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                ดูและแก้ไขยอดเคลื่อนไหวรายวัน โดยต้องกดบันทึกข้อมูลจากหน้า Stock
                WIP หลัก
              </DialogDescription>
              <StockWipDailyDetail
                sheet={draft}
                row={selectedDailyRow}
                onChange={handleDailyChange}
                onClose={() => setSelectedDailyCode(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>



      <AlertDialog
        open={pendingFilters !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingFilters(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              การเปลี่ยนช่วงเวลาจะทิ้งการแก้ไขของชีตปัจจุบัน
              หากต้องการเก็บข้อมูล กรุณากลับไปกดบันทึกก่อนเปลี่ยนปีหรือเดือน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปบันทึกก่อน</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmPeriodChange}
            >
              ทิ้งการแก้ไขและเปลี่ยนช่วงเวลา
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
