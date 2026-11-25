"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
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
  addStockWipRow,
  DEFAULT_STOCK_WIP_FILTERS,
  STOCK_WIP_MOVEMENT_FIELDS,
  STOCK_WIP_SUMMARY_FIELDS,
  blankStockWipSheet,
  stockWipSourceSheetName,
  stockWipSupportsBioTransfer,
  stockWipPeriodKey,
  updateStockWipDaily,
  updateStockWipSummary,
  validateStockWipSheet,
  type StockWipCreateInput,
  type StockWipFilters as StockWipFilterValues,
  type StockWipMovementField,
  type StockWipPeriod,
  type StockWipRow,
  type StockWipSheet,
  type StockWipSummaryField,
  type StockWipValidationErrors,
} from "./stock_wip_ff_domain";
import { StockWipFfCreateForm } from "./stock_wip_ff_create_form";
import { StockWipDailyDetail } from "./stock_wip_ff_daily_detail";
import { StockWipFilters } from "./stock_wip_ff_filters";
import { StockWipSummary } from "./stock_wip_ff_summary";
import { StockWipTable } from "./stock_wip_ff_table";

/**
 * The Workspace owns the editable draft. Only Save writes to the database.
 * Daily, monthly and annual values are independent snapshots.
 */

const STOCK_API = "/api/stock/wip-ff";
const CSRF_COOKIE = "ionflow_factory_csrf";
const LOAD_FAILED = "ไม่สามารถโหลดข้อมูล Stock WIP จากฐานข้อมูลได้";
const INVALID_RESPONSE = "รูปแบบข้อมูลจาก API ไม่ถูกต้อง";
const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ";

type Notice = {
  tone: "success" | "error" | "info";
  text: string;
  title?: string;
};

type SavedSnapshot = {
  sheet: StockWipSheet;
  revision: string;
};

class StockWipApiError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "StockWipApiError";
  }
}

function copyFilters(filters: StockWipFilterValues): StockWipFilterValues {
  return {
    ...filters,
    period: { ...filters.period },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCsrfToken(): string {
  try {
    const cookie = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
    const token = cookie
      ? decodeURIComponent(cookie.slice(CSRF_COOKIE.length + 1))
      : "";
    if (token) return token;
  } catch {
    // Never send a write request without the CSRF cookie.
  }
  throw new StockWipApiError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token");
}

async function requestStockJson(
  url: string,
  init: RequestInit,
  writing: boolean,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StockWipApiError(writing ? UNCERTAIN_SAVE : LOAD_FAILED, writing);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const reloadRequired = writing && (response.ok || response.status !== 400);
    const message =
      response.status === 401 || response.status === 403
        ? "กรุณาตรวจสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน"
        : isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : writing
            ? UNCERTAIN_SAVE
            : LOAD_FAILED;
    throw new StockWipApiError(message, reloadRequired);
  }
  return payload;
}

function hasQuantityFields(
  value: unknown,
  fields: readonly StockWipSummaryField[],
  supportsBio: boolean,
): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) =>
      field === "transfer_bio" && !supportsBio
        ? value[field] === null
        : typeof value[field] === "string",
    )
  );
}

function isStockWipRow(
  value: unknown,
  supportsBio: boolean,
): value is StockWipRow {
  if (!isRecord(value) || !isRecord(value.item)) return false;
  const item = value.item;
  return (
    typeof item.no === "number" &&
    Number.isSafeInteger(item.no) &&
    item.no > 0 &&
    typeof item.code_new === "string" &&
    Boolean(item.code_new.trim()) &&
    (item.code_old === null ||
      (typeof item.code_old === "string" && Boolean(item.code_old.trim()))) &&
    typeof item.name === "string" &&
    Boolean(item.name.trim()) &&
    hasQuantityFields(value.summary, STOCK_WIP_SUMMARY_FIELDS, supportsBio) &&
    Array.isArray(value.daily) &&
    value.daily.length <= 31 &&
    value.daily.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.date === "string" &&
        hasQuantityFields(entry.values, STOCK_WIP_MOVEMENT_FIELDS, supportsBio),
    )
  );
}

function readSnapshot(
  payload: Record<string, unknown>,
  period: StockWipPeriod,
  writing: boolean,
): SavedSnapshot {
  const source = payload.sheet;
  const revision = payload.revision;
  const supportsBio = stockWipSupportsBioTransfer(period);
  const invalid = () =>
    new StockWipApiError(writing ? UNCERTAIN_SAVE : INVALID_RESPONSE, writing);

  if (
    !isRecord(source) ||
    !isRecord(source.period) ||
    source.period.view !== period.view ||
    source.period.year_be !== period.year_be ||
    (period.view === "MONTH" && source.period.month !== period.month) ||
    (period.view === "YEAR" && Object.hasOwn(source.period, "month")) ||
    source.id !== stockWipPeriodKey(period) ||
    source.source_sheet_name !== stockWipSourceSheetName(period) ||
    source.supports_bio_transfer !== supportsBio ||
    typeof source.created_at !== "string" ||
    typeof source.updated_at !== "string" ||
    typeof revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(revision) ||
    !Array.isArray(source.rows) ||
    !source.rows.every((row: unknown) => isStockWipRow(row, supportsBio))
  ) {
    throw invalid();
  }

  const rows: StockWipRow[] = source.rows;
  const sheet: StockWipSheet = {
    ...blankStockWipSheet(period),
    rows,
    created_at: source.created_at,
    updated_at: source.updated_at,
  };
  const codes = new Set(rows.map((row) => row.item.code_new.trim()));
  if (
    codes.size !== rows.length ||
    Object.keys(validateStockWipSheet(sheet)).length > 0
  ) {
    throw invalid();
  }
  return { sheet, revision };
}

async function loadStockWip(
  period: StockWipPeriod,
  signal: AbortSignal,
): Promise<SavedSnapshot> {
  const params = new URLSearchParams({
    view: period.view,
    year_be: String(period.year_be),
  });
  if (period.view === "MONTH") params.set("month", String(period.month));
  const payload = await requestStockJson(
    `${STOCK_API}?${params}`,
    { signal },
    false,
  );
  return readSnapshot(payload, period, false);
}

function draftChanges(saved: StockWipSheet, draft: StockWipSheet) {
  const savedRows = new Map(saved.rows.map((row) => [row.item.code_new, row]));
  const draftCodes = new Set(draft.rows.map((row) => row.item.code_new));
  return {
    changes: draft.rows.filter(
      (row) =>
        JSON.stringify(row) !==
        JSON.stringify(savedRows.get(row.item.code_new)),
    ),
    // Compare the full draft, never the filtered table. Only explicitly removed
    // rows from the saved snapshot become deletion references.
    deleted_refs: saved.rows
      .filter((row) => !draftCodes.has(row.item.code_new))
      .map((row) => row.item.code_new),
  };
}

async function saveStockWip(
  snapshot: SavedSnapshot,
  draft: StockWipSheet,
): Promise<SavedSnapshot> {
  if (snapshot.sheet.id !== draft.id) {
    throw new StockWipApiError(INVALID_RESPONSE, true);
  }
  const payload = await requestStockJson(
    STOCK_API,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrfToken(),
      },
      body: JSON.stringify({
        action: "save_sheet",
        period: draft.period,
        expected_revision: snapshot.revision,
        ...draftChanges(snapshot.sheet, draft),
      }),
    },
    true,
  );
  return readSnapshot(payload, draft.period, true);
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
    if (!search) {
      return true;
    }

    return [row.item.code_new, row.item.code_old ?? "", row.item.name].some(
      (value) => normalizeSearch(value).includes(search),
    );
  });
}

export function StockWipWorkspace() {
  const [snapshot, setSnapshot] = useState<SavedSnapshot | null>(null);
  const [draft, setDraft] = useState<StockWipSheet>(() =>
    blankStockWipSheet(DEFAULT_STOCK_WIP_FILTERS.period),
  );
  const [filters, setFilters] = useState<StockWipFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_WIP_FILTERS),
  );
  const [loadTarget, setLoadTarget] = useState<StockWipFilterValues | null>(
    () => copyFilters(DEFAULT_STOCK_WIP_FILTERS),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDailyCode, setSelectedDailyCode] = useState<string | null>(
    null,
  );
  const [pendingFilters, setPendingFilters] =
    useState<StockWipFilterValues | null>(null);
  const [errors, setErrors] = useState<StockWipValidationErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = snapshot?.sheet;
  const hasUnsavedChanges = Boolean(
    savedSheet &&
    JSON.stringify(draft.rows) !== JSON.stringify(savedSheet.rows),
  );
  const isLoading = loadTarget !== null;
  const isBusy = isLoading || isSaving;
  const canEdit = Boolean(snapshot) && !isBusy && !reloadRequired;
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

  useEffect(() => {
    if (!loadTarget) return;
    const controller = new AbortController();
    const target = loadTarget;

    async function load() {
      try {
        const next = await loadStockWip(target.period, controller.signal);
        if (controller.signal.aborted) return;
        setSnapshot(next);
        setDraft(structuredClone(next.sheet));
        setFilters(copyFilters(target));
        setErrors({});
        setReloadRequired(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setNotice({
          tone: "error",
          title: "โหลดข้อมูลไม่สำเร็จ",
          text: error instanceof StockWipApiError ? error.message : LOAD_FAILED,
        });
      } finally {
        if (!controller.signal.aborted) setLoadTarget(null);
      }
    }

    void load();
    return () => controller.abort();
  }, [loadTarget]);

  function openPeriod(nextFilters: StockWipFilterValues) {
    if (isBusy) return;
    // Keep the current draft until the requested period loads successfully.
    setCreateOpen(false);
    setSelectedDailyCode(null);
    setNotice(null);
    setLoadTarget(copyFilters(nextFilters));
  }

  function handleReload() {
    if (isBusy) return;
    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(filters));
      return;
    }
    openPeriod(filters);
  }

  function handleFiltersChange(nextFilters: StockWipFilterValues) {
    if (isBusy) return;
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

  function openCreateForm() {
    if (!canEdit || draft.period.view !== "MONTH") {
      return;
    }

    setSelectedDailyCode(null);
    setCreateOpen(true);
  }

  function handleCreate(input: StockWipCreateInput) {
    if (!canEdit) return false;
    // Validate synchronously so the form can display creation errors.
    // The saved sheet remains unchanged until the user presses Save.
    const nextDraft = addStockWipRow(draft, input);

    setDraft(nextDraft);
    setFilters((current) => ({ ...current, search: "" }));
    setSelectedDailyCode(null);
    setErrors({});
    setNotice({
      tone: "info",
      title: "เพิ่มรายการ WIP ลงฉบับร่างแล้ว",
      text: "เพิ่มรายการ WIP แล้ว กรุณากดบันทึกข้อมูลจากหน้าหลักเพื่อเก็บการแก้ไขลงฐานข้อมูล",
    });
  }

  function handleSummaryChange(
    codeNew: string,
    field: StockWipSummaryField,
    value: string,
  ) {
    if (!canEdit) return;
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
    if (!canEdit) return;
    setDraft((current) =>
      updateStockWipDaily(current, codeNew, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleDiscard() {
    if (isBusy) return;
    if (!savedSheet) {
      setNotice({
        tone: "error",
        text: "ไม่พบข้อมูลที่บันทึกไว้สำหรับช่วงเวลานี้",
      });
      return;
    }

    setDraft(structuredClone(savedSheet));
    setSelectedDailyCode(null);
    setCreateOpen(false);
    setErrors({});
    setNotice({
      tone: "info",
      text: reloadRequired
        ? "ยกเลิกฉบับร่างแล้ว กรุณาโหลดข้อมูลล่าสุดจากฐานข้อมูลก่อนแก้ไขอีกครั้ง"
        : "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นค่าที่โหลดหรือบันทึกไว้ล่าสุด",
    });
  }

  async function handleSave() {
    if (!snapshot || !canEdit || !hasUnsavedChanges) return;

    const nextErrors = validateStockWipSheet(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ช่องตัวเลขที่ไม่ถูกต้องก่อน",
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const saved = await saveStockWip(snapshot, draft);
      setSnapshot(saved);
      setDraft(structuredClone(saved.sheet));
      setErrors({});
      setNotice({
        tone: "success",
        text: "บันทึกข้อมูล Stock WIP ลงฐานข้อมูลเรียบร้อยแล้ว",
      });
    } catch (error) {
      // Preserve the draft. Never retry a write with an uncertain outcome.
      if (!(error instanceof StockWipApiError) || error.reloadRequired) {
        setReloadRequired(true);
      }
      setNotice({
        tone: "error",
        title: "บันทึกข้อมูลไม่สำเร็จ",
        text:
          error instanceof StockWipApiError ? error.message : UNCERTAIN_SAVE,
      });
    } finally {
      setIsSaving(false);
    }
  }

  function confirmPeriodChange() {
    if (isBusy || !pendingFilters) {
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
        actions={<><Badge variant="outline">DATABASE</Badge> {draft && (<Button
            type="button"
            variant="outline"
            onClick={openCreateForm}
            disabled={!canEdit || draft.period.view !== "MONTH"}
            title={
              draft.period.view === "YEAR"
                ? "กรุณาเลือกงวดรายเดือนก่อนเพิ่มรายการ WIP"
                : "เพิ่มรายการ WIP"
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มรายการ WIP
          </Button>)}</>}
      />

      <fieldset disabled={isBusy} className="min-w-0 border-0 p-0">
        <StockWipFilters
          value={filters}
          onChange={handleFiltersChange}
          onReset={() =>
            handleFiltersChange(copyFilters(DEFAULT_STOCK_WIP_FILTERS))
          }
        />
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {periodLabel(filters.period)}
          </p>
          <p className="text-xs text-muted-foreground">
            {snapshot ? (
              <>
                {draft.source_sheet_name} · แสดง{" "}
                {visibleRows.length.toLocaleString("th-TH")} จาก{" "}
                {draft.rows.length.toLocaleString("th-TH")} รายการ
              </>
            ) : (
              "ยังไม่มีข้อมูลที่โหลดสำเร็จ"
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {loadTarget
              ? `กำลังโหลด ${periodLabel(loadTarget.period)} ...`
              : isSaving
                ? "กำลังบันทึกข้อมูล..."
                : !snapshot
                  ? "ยังไม่ได้โหลดข้อมูลจากฐานข้อมูล"
                  : reloadRequired
                    ? "กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขหรือบันทึกอีกครั้ง"
                    : hasUnsavedChanges
                      ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
                      : "ข้อมูลตรงกับฉบับที่โหลดหรือบันทึกไว้ล่าสุด"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReload}
            disabled={isBusy}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            โหลดข้อมูลใหม่
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isBusy || !hasUnsavedChanges}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || !hasUnsavedChanges}
          >
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
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
                ? "บันทึกสำเร็จ"
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
              ตรวจสอบช่องที่มีสีเตือนในตารางหลักหรือรายละเอียดรายวัน
              แล้วบันทึกใหม่
            </AlertDescription>
          </Alert>
        </div>
      )}

      {snapshot && (
        <>
          <StockWipSummary rows={visibleRows} />
          <StockWipTable
            rows={visibleRows}
            supportsBioTransfer={draft.supports_bio_transfer}
            onChange={handleSummaryChange}
            onViewDaily={
              draft.period.view === "MONTH"
                ? (row) => {
                    if (!isBusy) setSelectedDailyCode(row.item.code_new);
                  }
                : undefined
            }
            disabled={!canEdit}
          />
        </>
      )}

      {draft.period.view === "MONTH" && (
        <StockWipFfCreateForm
          key={draft.id}
          open={createOpen}
          period={draft.period}
          onOpenChange={setCreateOpen}
          onCreate={handleCreate}
          disabled={!canEdit}
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
                disabled={!canEdit}
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
              การโหลดข้อมูลใหม่หรือเปลี่ยนช่วงเวลาจะทิ้งฉบับร่างปัจจุบัน
              เมื่อโหลดข้อมูลสำเร็จ หากต้องการเก็บการแก้ไข กรุณากลับไปบันทึกก่อน
              (หากระบบยังอนุญาตให้บันทึก)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปตรวจสอบฉบับร่าง</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmPeriodChange}
            >
              ทิ้งการแก้ไขและโหลดข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
