"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
  RotateCcw,
  Save,
} from "lucide-react";

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
import { createStockMaterialMockSheets } from "@/src/lib/mock-data/stock_remaining_materials_ff";

import {
  DEFAULT_STOCK_MATERIAL_FILTERS,
  addStockMaterialRow,
  filterStockMaterialRows,
  saveStockMaterialSheet,
  stockMaterialRowRef,
  stockMaterialPeriodKey,
  updateStockMaterialDaily,
  updateStockMaterialRemark,
  updateStockMaterialSafetyStock,
  updateStockMaterialSummary,
  validateStockMaterialSheet,
  type StockMaterialCreateInput,
  type StockMaterialDailyField,
  type StockMaterialFilters as StockMaterialFilterValues,
  type StockMaterialPeriod,
  type StockMaterialRowRef,
  type StockMaterialSheet,
  type StockMaterialSummaryField,
  type StockMaterialValidationErrors,
} from "./stock_remaining_materials_ff_domain";
import { StockRemainingMaterialsFfCreateForm } from "./stock_remaining_materials_ff_create_form";
import { StockRemainingMaterialsFfDailyDetail } from "./stock_remaining_materials_ff_daily_detail";
import { StockMaterialFilters } from "./stock_remaining_materials_ff_filters";
import { StockRemainingMaterialsFfSummary } from "./stock_remaining_materials_ff_summary";
import { StockRemainingMaterialsFfTable } from "./stock_remaining_materials_ff_table";

/**
 * Remaining Materials FF: Excel-based UI MOCK ONLY.
 *
 * Every month has its own saved snapshot in React State. Edits are made to a
 * separate draft and do not affect the saved snapshot until Save is pressed.
 * Refreshing the page discards every change, including previously saved mocks.
 * No API, database, browser storage, or Excel formula recalculation is used.
 */

type WorkspaceNotice = {
  tone: "success" | "error" | "info" | "draft";
  text: string;
};

function copyFilters(
  filters: StockMaterialFilterValues,
): StockMaterialFilterValues {
  return {
    search: filters.search,
    period: { ...filters.period },
  };
}

function periodLabel(period: StockMaterialPeriod): string {
  const monthName = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(period.year_be - 543, period.month - 1, 1)));

  return `${monthName} พ.ศ. ${period.year_be}`;
}

export function StockRemainingMaterialsFfWorkspace() {
  const [savedSheets, setSavedSheets] = useState<StockMaterialSheet[]>(
    createStockMaterialMockSheets,
  );
  const [draft, setDraft] = useState<StockMaterialSheet>(() => {
    const initialKey = stockMaterialPeriodKey(
      DEFAULT_STOCK_MATERIAL_FILTERS.period,
    );
    const initialSheet = savedSheets.find((sheet) => sheet.id === initialKey);

    if (!initialSheet) {
      throw new Error(
        `Missing initial material stock mock sheet: ${initialKey}`,
      );
    }

    return structuredClone(initialSheet);
  });
  const [filters, setFilters] = useState<StockMaterialFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_MATERIAL_FILTERS),
  );
  const [selectedDailyRowRef, setSelectedDailyRowRef] =
    useState<StockMaterialRowRef | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingFilters, setPendingFilters] =
    useState<StockMaterialFilterValues | null>(null);
  const [errors, setErrors] = useState<StockMaterialValidationErrors>({});
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = savedSheets.find((sheet) => sheet.id === draft.id);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft.rows) !== JSON.stringify(savedSheet?.rows ?? []),
    [draft.rows, savedSheet?.rows],
  );
  const visibleRows = useMemo(() => {
    const filtered = filterStockMaterialRows(draft.rows, filters.search);
    // Show recently created mock items first; preserve Excel row order.
    return [
      ...filtered.filter((row) => row.item.client_id !== undefined),
      ...filtered.filter((row) => row.item.client_id === undefined),
    ];
  }, [draft.rows, filters.search]);
  const selectedDailyRow =
    selectedDailyRowRef === null
      ? undefined
      : draft.rows.find(
          (row) => stockMaterialRowRef(row) === selectedDailyRowRef,
        );
  const errorEntries = Object.entries(errors);
  const errorCount = errorEntries.length;

  useEffect(() => {
    if (errorCount > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errorCount]);

  function openPeriod(nextFilters: StockMaterialFilterValues) {
    const nextKey = stockMaterialPeriodKey(nextFilters.period);
    const nextSheet = savedSheets.find((sheet) => sheet.id === nextKey);

    if (!nextSheet) {
      setNotice({
        tone: "error",
        text: `ไม่พบข้อมูลจำลองสำหรับ ${periodLabel(nextFilters.period)}`,
      });
      return;
    }

    setFilters(copyFilters(nextFilters));
    setDraft(structuredClone(nextSheet));
    setSelectedDailyRowRef(null);
    setIsCreateOpen(false);
    setErrors({});
    setNotice(null);
  }

  function handleFiltersChange(nextFilters: StockMaterialFilterValues) {
    const currentKey = stockMaterialPeriodKey(filters.period);
    const nextKey = stockMaterialPeriodKey(nextFilters.period);

    // Searching within the same sheet must not discard unsaved edits.
    if (currentKey === nextKey) {
      setFilters(copyFilters(nextFilters));
      setSelectedDailyRowRef(null);
      return;
    }

    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(nextFilters));
      return;
    }

    openPeriod(nextFilters);
  }

  function handleSummaryChange(
    rowRef: StockMaterialRowRef,
    field: StockMaterialSummaryField,
    value: string,
  ) {
    setDraft((current) =>
      updateStockMaterialSummary(current, rowRef, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleRemarkChange(rowRef: StockMaterialRowRef, value: string) {
    setDraft((current) => updateStockMaterialRemark(current, rowRef, value));
    setErrors({});
    setNotice(null);
  }

  function handleSafetyStockChange(rowRef: StockMaterialRowRef, value: string) {
    setDraft((current) =>
      updateStockMaterialSafetyStock(current, rowRef, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleDailyChange(
    rowRef: StockMaterialRowRef,
    date: string,
    field: StockMaterialDailyField,
    value: string,
  ) {
    setDraft((current) =>
      updateStockMaterialDaily(current, rowRef, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleCreateMaterial(input: StockMaterialCreateInput): boolean {
    try {
      // Generate an identity, not a counterfeit Excel source_row.
      const clientId = crypto.randomUUID();
      const nextDraft = addStockMaterialRow(draft, input, clientId);

      // Report all newly entered days from the validated domain result.
      // The creation form can now submit several dates at once.
      const createdRow = nextDraft.rows.find(
        (row) => row.item.client_id === clientId,
      );
      const dailyCount = createdRow?.daily.length ?? 0;
      const dailyNotice =
        dailyCount > 0
          ? `เพิ่มรายละเอียดรับ-จ่ายรายวัน ${dailyCount} วันแล้ว เปิดดูได้จากปุ่ม “ดูรายวัน” · `
          : "";

      setDraft(nextDraft);
      // Clear search so the new item is visible at the top of the table.
      setFilters((current) => ({ ...current, search: "" }));
      setSelectedDailyRowRef(null);
      setErrors({});
      setNotice({
        tone: "draft",
        text:
          `เพิ่มวัสดุ “${input.name.trim()}” ใน${periodLabel(draft.period)}แล้ว ` +
          dailyNotice +
          "ยอดสรุปรายเดือนเริ่มเป็นช่องว่างและยังแก้ไขได้ในตารางหลัก กรุณากดบันทึกข้อมูลจำลองเพื่อเก็บไว้ใน React State",
      });
      return true;
    } catch {
      // The form will keep its values and display an error.
      return false;
    }
  }

  function handleDiscard() {
    if (!savedSheet) {
      setNotice({
        tone: "error",
        text: "ไม่พบข้อมูลที่บันทึกไว้สำหรับเดือนนี้",
      });
      return;
    }

    setDraft(structuredClone(savedSheet));
    setSelectedDailyRowRef(null);
    setIsCreateOpen(false);
    setErrors({});
    setNotice({
      tone: "info",
      text: "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นค่าที่บันทึกไว้ล่าสุดในหน้านี้",
    });
  }

  function handleSave() {
    const nextErrors = validateStockMaterialSheet(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ไขตัวเลขที่ผิดรูปแบบในตารางหลักหรือรายละเอียดรายวัน",
      });
      return;
    }

    try {
      const nextSheets = saveStockMaterialSheet(
        savedSheets,
        draft,
        new Date().toISOString(),
      );
      const nextSavedSheet = nextSheets.find((sheet) => sheet.id === draft.id);

      if (!nextSavedSheet) {
        throw new Error("The saved material stock mock sheet was not found.");
      }

      setSavedSheets(nextSheets);
      setDraft(structuredClone(nextSavedSheet));
      setErrors({});
      setNotice({
        tone: "success",
        text: "บันทึกข้อมูลจำลองใน React State แล้ว ข้อมูลทั้งหมดจะกลับเป็นค่าเริ่มต้นเมื่อรีเฟรชหน้าเว็บ",
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
        title="วัสดุคงเหลือ FF"
        description="รายการวัสดุและบรรจุภัณฑ์จากไฟล์ วัสดุคงเหลือFF-2569.xlsx"
        actions={
          <Badge variant="outline">UI MOCK · React State เท่านั้น</Badge>
        }
      />

      <StockMaterialFilters
        value={filters}
        onChange={handleFiltersChange}
        onReset={() =>
          handleFiltersChange(copyFilters(DEFAULT_STOCK_MATERIAL_FILTERS))
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {periodLabel(draft.period)}
          </p>
          <p className="text-xs text-muted-foreground">
            ชีต {draft.source_sheet_name} · แสดง{" "}
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
            onClick={() => setIsCreateOpen(true)}
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            เพิ่มวัสดุ
          </Button>
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
          ) : notice.tone === "draft" ? (
            <PackagePlus className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          <AlertTitle>
            {notice.tone === "success"
              ? "บันทึกสำเร็จ (เฉพาะข้อมูลจำลอง)"
              : notice.tone === "error"
                ? "ต้องตรวจสอบข้อมูล"
                : notice.tone === "draft"
                  ? "เพิ่มวัสดุในฉบับร่างแล้ว"
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
              พบข้อมูลที่ไม่ผ่านการตรวจสอบ {errorCount.toLocaleString("th-TH")}{" "}
              ช่อง
            </AlertTitle>
            <AlertDescription>
              กรุณาตรวจสอบช่องตัวเลขที่มีสีเตือนในตารางหลักหรือในรายละเอียดรายวัน
              รวมถึงรายการที่ถูกซ่อนจากการค้นหา แล้วลองบันทึกอีกครั้ง
            </AlertDescription>
          </Alert>
        </div>
      )}

      <StockRemainingMaterialsFfSummary rows={visibleRows} />

      <StockRemainingMaterialsFfTable
        rows={visibleRows}
        onChange={handleSummaryChange}
        onRemarkChange={handleRemarkChange}
        onSafetyStockChange={handleSafetyStockChange}
        onNewSummaryChange={handleSummaryChange}
        onNewRemarkChange={handleRemarkChange}
        onNewSafetyStockChange={handleSafetyStockChange}
        onViewDaily={(row) => setSelectedDailyRowRef(stockMaterialRowRef(row))}
        onViewDailyNew={(row) =>
          setSelectedDailyRowRef(stockMaterialRowRef(row))
        }
      />

      <StockRemainingMaterialsFfCreateForm
        open={isCreateOpen}
        period={draft.period}
        onOpenChange={setIsCreateOpen}
        onCreate={handleCreateMaterial}
      />

      <Dialog
        open={selectedDailyRow !== undefined}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSelectedDailyRowRef(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className={
            "max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] " +
            "max-w-none overflow-y-auto p-2 " +
            "sm:max-w-[calc(100vw-3rem)] sm:p-4 2xl:max-w-360"
          }
        >
          {selectedDailyRow && (
            <>
              <DialogTitle className="sr-only">
                รายละเอียดรายวันของ {selectedDailyRow.item.name}{" "}
                {selectedDailyRow.item.client_id === undefined
                  ? `แถว Excel ${selectedDailyRow.item.source_row}`
                  : "วัสดุเพิ่มใหม่"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                ข้อมูลรับ-จ่ายรายวันของวัสดุในเดือนที่เลือก
                การแก้ไขจะยังไม่ถูกบันทึกจนกว่าจะกดบันทึกจากหน้าหลัก
              </DialogDescription>
              <StockRemainingMaterialsFfDailyDetail
                sheet={draft}
                row={selectedDailyRow}
                onChange={handleDailyChange}
                onNewChange={handleDailyChange}
                onClose={() => setSelectedDailyRowRef(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ข้อมูลจำลองจาก Excel · รายการเดิมแยกด้วยเลขแถว Excel
        และวัสดุเพิ่มใหม่ใช้ client_id · เพิ่มวัสดุเฉพาะเดือนที่เลือก ·
        สรุปยอดแยกหน่วยนับ ไม่คำนวณราคาหรือยอดคงเหลืออัตโนมัติ ·
        ไม่มีการเชื่อมต่อ API ฐานข้อมูล หรือพื้นที่จัดเก็บของเบราว์เซอร์
      </p>

      <AlertDialog
        open={pendingFilters !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPendingFilters(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              การเปลี่ยนเดือนหรือปีจะทิ้งการแก้ไขของชีตปัจจุบัน
              หากต้องการเก็บข้อมูล กรุณากลับไปกดบันทึกก่อนเปลี่ยนช่วงเวลา
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
