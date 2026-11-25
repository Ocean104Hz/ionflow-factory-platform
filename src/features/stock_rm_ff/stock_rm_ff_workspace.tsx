"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
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
import {
  createStockRmMockSheets,
  stockRmMockImportWarnings,
} from "@/src/lib/mock-data/stock_rm_ff";

import {
  addStockRmRow,
  DEFAULT_STOCK_RM_FILTERS,
  saveStockRmSheet,
  stockRmPeriodKey,
  updateStockRmDaily,
  updateStockRmRemark,
  updateStockRmSummary,
  validateStockRmSheet,
  type StockRmCreateInput,
  type StockRmFilters as StockRmFilterValues,
  type StockRmMovementField,
  type StockRmPeriod,
  type StockRmRow,
  type StockRmSheet,
  type StockRmSummaryField,
  type StockRmValidationErrors,
} from "./stock_rm_ff_domain";
import { StockRmFfCreateForm } from "./stock_rm_ff_create_form";
import { StockRmDailyDetail } from "./stock_rm_ff_daily_detail";
import { StockRmFilters } from "./stock_rm_ff_filters";
import { StockRmSummary } from "./stock_rm_ff_summary";
import { StockRmTable } from "./stock_rm_ff_table";

/**
 * Stock RM FF: UI MOCK ONLY.
 * All edits and saved sheets stay in React State and reset on page refresh.
 * No API, database, browser storage, or automatic Excel recalculation.
 */

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
  title?: string;
};

function copyFilters(filters: StockRmFilterValues): StockRmFilterValues {
  return {
    ...filters,
    period: { ...filters.period },
  };
}

function createInitialDraft(): StockRmSheet {
  const key = stockRmPeriodKey(DEFAULT_STOCK_RM_FILTERS.period);
  const sheet = createStockRmMockSheets().find((entry) => entry.id === key);

  if (!sheet) {
    throw new Error(`Missing initial Stock RM FF mock sheet: ${key}`);
  }

  return sheet;
}

function periodLabel(period: StockRmPeriod): string {
  if (period.view === "YEAR") {
    return `สรุปรายปี พ.ศ. ${period.year_be}`;
  }

  const monthName = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(period.year_be - 543, period.month - 1, 1)));

  return `${monthName} พ.ศ. ${period.year_be}`;
}

function filterStockRmRows(
  rows: readonly StockRmRow[],
  filters: StockRmFilterValues,
): StockRmRow[] {
  const search = filters.search.trim().toLocaleLowerCase("th-TH");

  if (!search) {
    return [...rows];
  }

  return rows.filter((row) =>
    [row.item.code_new, row.item.name ?? ""].some((value) =>
      value.toLocaleLowerCase("th-TH").includes(search),
    ),
  );
}

export function StockRmWorkspace() {
  const [savedSheets, setSavedSheets] = useState<StockRmSheet[]>(
    createStockRmMockSheets,
  );
  const [draft, setDraft] = useState<StockRmSheet>(createInitialDraft);
  const [filters, setFilters] = useState<StockRmFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_RM_FILTERS),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDailyCode, setSelectedDailyCode] = useState<string | null>(
    null,
  );
  const [pendingFilters, setPendingFilters] =
    useState<StockRmFilterValues | null>(null);
  const [errors, setErrors] = useState<StockRmValidationErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = savedSheets.find((sheet) => sheet.id === draft.id);
  const hasUnsavedChanges =
    JSON.stringify(draft.rows) !== JSON.stringify(savedSheet?.rows ?? []);
  const visibleRows = useMemo(
    () => filterStockRmRows(draft.rows, filters),
    [draft.rows, filters],
  );
  const selectedDailyRow =
    selectedDailyCode !== null && draft.period.view === "MONTH"
      ? draft.rows.find((row) => row.item.code_new === selectedDailyCode)
      : undefined;
  const errorCount = Object.keys(errors).length;
  const sourceWarnings = stockRmMockImportWarnings.filter(
    (warning) => warning.source_sheet_name === draft.source_sheet_name,
  );

  useEffect(() => {
    if (errorCount > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errorCount]);

  function openPeriod(nextFilters: StockRmFilterValues) {
    const key = stockRmPeriodKey(nextFilters.period);
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
    setCreateOpen(false);
    setSelectedDailyCode(null);
    setErrors({});
    setNotice(null);
  }

  function handleFiltersChange(nextFilters: StockRmFilterValues) {
    const currentKey = stockRmPeriodKey(filters.period);
    const nextKey = stockRmPeriodKey(nextFilters.period);

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

  function openCreateForm() {
    if (draft.period.view !== "MONTH") {
      return;
    }

    setSelectedDailyCode(null);
    setCreateOpen(true);
  }

  function handleCreate(input: StockRmCreateInput) {
    // Validate synchronously so a failure reaches the create form's catch.
    // Do not update savedSheets here; Save and Discard remain in Workspace.
    const nextDraft = addStockRmRow(draft, input);

    setDraft(nextDraft);
    setFilters((current) => ({ ...current, search: "" }));
    setSelectedDailyCode(null);
    setErrors({});
    setNotice({
      tone: "info",
      title: "เพิ่มวัตถุดิบลงฉบับร่างแล้ว",
      text: "เพิ่มรายการวัตถุดิบแล้ว กรุณากดบันทึกข้อมูลจำลองจากหน้าหลักเพื่อเก็บการแก้ไข",
    });
  }

  function handleSummaryChange(
    codeNew: string,
    field: StockRmSummaryField,
    value: string,
  ) {
    setDraft((current) => updateStockRmSummary(current, codeNew, field, value));
    setErrors({});
    setNotice(null);
  }

  function handleRemarkChange(codeNew: string, value: string) {
    setDraft((current) => updateStockRmRemark(current, codeNew, value));
    setErrors({});
    setNotice(null);
  }

  function handleDailyChange(
    codeNew: string,
    date: string,
    field: StockRmMovementField,
    value: string,
  ) {
    setDraft((current) =>
      updateStockRmDaily(current, codeNew, date, field, value),
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
    const nextErrors = validateStockRmSheet(draft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ไขช่องตัวเลขที่ไม่ถูกต้องก่อน",
      });
      return;
    }

    try {
      const updatedSheets = saveStockRmSheet(
        savedSheets,
        draft,
        new Date().toISOString(),
      );
      const saved = updatedSheets.find((sheet) => sheet.id === draft.id);

      if (!saved) {
        throw new Error("The saved mock Stock RM sheet was not found.");
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
        title="Stock RM FF"
        description="สต็อกวัตถุดิบจากไฟล์ Stock RM FF 2569.xlsx"
        actions={
          <Badge variant="outline">UI MOCK · React State เท่านั้น</Badge>
        }
      />

      <StockRmFilters
        value={filters}
        onChange={handleFiltersChange}
        onReset={() =>
          handleFiltersChange(copyFilters(DEFAULT_STOCK_RM_FILTERS))
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
            onClick={openCreateForm}
            disabled={draft.period.view !== "MONTH"}
            title={
              draft.period.view === "YEAR"
                ? "กรุณาเลือกงวดรายเดือนก่อนเพิ่มวัตถุดิบ"
                : "เพิ่มรายการวัตถุดิบ"
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มวัตถุดิบ
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
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          <AlertTitle>
            {notice.title ??
              (notice.tone === "success"
                ? "บันทึกสำเร็จ (เฉพาะข้อมูลจำลอง)"
                : notice.tone === "error"
                  ? "ต้องตรวจสอบข้อมูล"
                  : "ยกเลิกการแก้ไขแล้ว")}
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
              กรุณาตรวจสอบช่องที่มีสีเตือนในตารางหลักหรือรายละเอียดรายวัน
              แล้วบันทึกใหม่
            </AlertDescription>
          </Alert>
        </div>
      )}

      {sourceWarnings.length > 0 && (
        <Alert>
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>พบข้อมูลใน Excel ที่ไม่สามารถกำหนดวันที่ได้</AlertTitle>
          <AlertDescription>
            {sourceWarnings.map((warning) => (
              <p key={`${warning.source_sheet_name}-${warning.cell}`}>
                ชีต {warning.source_sheet_name} เซลล์ {warning.cell}
                {" · "}รหัส {warning.code_new} มีค่า {warning.value}
                {" · "}อยู่ในคอลัมน์วันที่ไม่มีจริงของเดือน
                จึงไม่ถูกนำไปใส่ในรายการรายวัน กรุณาตรวจไฟล์ต้นฉบับ
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <StockRmSummary rows={visibleRows} />

      <StockRmTable
        rows={visibleRows}
        onChange={handleSummaryChange}
        onRemarkChange={handleRemarkChange}
        onViewDaily={
          draft.period.view === "MONTH"
            ? (row) => setSelectedDailyCode(row.item.code_new)
            : undefined
        }
      />

      {draft.period.view === "MONTH" && (
        <StockRmFfCreateForm
          key={draft.id}
          open={createOpen}
          period={draft.period}
          onOpenChange={setCreateOpen}
          onCreate={handleCreate}
        />
      )}

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
          className={
            "max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] " +
            "max-w-none overflow-y-auto p-2 " +
            "sm:max-w-[calc(100vw-3rem)] sm:p-4 2xl:max-w-360"
          }
        >
          {selectedDailyRow && (
            <>
              <DialogTitle className="sr-only">
                ข้อมูลรายวันของรหัส {selectedDailyRow.item.code_new}
              </DialogTitle>
              <DialogDescription className="sr-only">
                ดูและแก้ไขรายการเคลื่อนไหวรายวันของวัตถุดิบ
                โดยต้องกดบันทึกจากหน้า Stock RM FF หลัก
              </DialogDescription>
              <StockRmDailyDetail
                sheet={draft}
                row={selectedDailyRow}
                onChange={handleDailyChange}
                onClose={() => setSelectedDailyCode(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ข้อมูลจำลองอ้างอิงจาก Excel เท่านั้น · น้ำหนัก ราคาเฉลี่ย มูลค่า
        และยอดรายวันไม่ถูกคำนวณตามกันอัตโนมัติ · ไม่มีการเชื่อม API ฐานข้อมูล
        หรือพื้นที่จัดเก็บของเบราว์เซอร์
      </p>

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
