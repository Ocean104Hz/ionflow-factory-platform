"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
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
const MAX_CHANGED_ROWS = 2000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
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

type PendingWipDeleteSave = {
  snapshot: SavedSnapshot;
  draft: StockWipSheet;
  rows: readonly StockWipRow[];
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
    const invalidInput =
      response.status === 400 && isRecord(payload) && payload.ok === false;
    const reloadRequired = writing && !invalidInput;
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

function rowSignature(row: StockWipRow): string {
  return JSON.stringify([
    row.item.no,
    row.item.code_new,
    row.item.code_old,
    row.item.name,
    STOCK_WIP_SUMMARY_FIELDS.map((field) => row.summary[field]),
    [...row.daily]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((entry) => [
        entry.date,
        STOCK_WIP_MOVEMENT_FIELDS.map((field) => entry.values[field]),
      ]),
  ]);
}

function rowsByCode(rows: readonly StockWipRow[]) {
  return new Map(rows.map((row) => [row.item.code_new, rowSignature(row)]));
}

function hasUniqueCodes(rows: readonly StockWipRow[]): boolean {
  return (
    new Set(rows.map((row) => row.item.code_new.trim())).size === rows.length
  );
}

function draftChanges(saved: StockWipSheet, draft: StockWipSheet) {
  if (
    saved.id !== draft.id ||
    stockWipPeriodKey(saved.period) !== stockWipPeriodKey(draft.period) ||
    !hasUniqueCodes(saved.rows) ||
    !hasUniqueCodes(draft.rows)
  ) {
    throw new StockWipApiError(INVALID_RESPONSE);
  }
  const previous = rowsByCode(saved.rows);
  const current = rowsByCode(draft.rows);
  return {
    changes: draft.rows.filter(
      (row) =>
        previous.get(row.item.code_new) !== current.get(row.item.code_new),
    ),
    // Compare complete snapshots, never a filtered table.
    deleted_refs: [...previous.keys()].filter((code) => !current.has(code)),
  };
}

async function saveStockWip(
  saved: SavedSnapshot,
  draft: StockWipSheet,
  confirmedDeletedRefs: readonly string[],
): Promise<SavedSnapshot> {
  const { changes, deleted_refs: deletedRefs } = draftChanges(
    saved.sheet,
    draft,
  );
  const confirmed = new Set(confirmedDeletedRefs);
  // A disappearance in the draft is not sufficient consent for a database delete.
  if (
    confirmed.size !== confirmedDeletedRefs.length ||
    confirmed.size !== deletedRefs.length ||
    deletedRefs.some((code) => !confirmed.has(code))
  ) {
    throw new StockWipApiError("กรุณายืนยันการลบสินค้า WIP ถาวรก่อนบันทึก");
  }
  if (changes.length === 0 && deletedRefs.length === 0) return saved;
  const body = JSON.stringify({
    action: "save_sheet",
    period: draft.period,
    expected_revision: saved.revision,
    changes,
    deleted_refs: deletedRefs,
    ...(deletedRefs.length > 0 ? { confirm_hard_delete: true } : {}),
  });
  if (
    changes.length + deletedRefs.length > MAX_CHANGED_ROWS ||
    new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES
  ) {
    throw new StockWipApiError(
      "ข้อมูลที่แก้ไขเกินขนาดที่รองรับ (2,000 รายการ หรือ 4 MiB) กรุณาลดจำนวนรายการก่อนบันทึก",
    );
  }
  const payload = await requestStockJson(
    STOCK_API,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrfToken(),
      },
      body,
    },
    true,
  );
  const snapshot = readSnapshot(payload, draft.period, true);
  if (deletedRefs.length > 0 && payload.deleted !== deletedRefs.length) {
    throw new StockWipApiError(UNCERTAIN_SAVE, true);
  }
  const expected = rowsByCode(draft.rows);
  const actual = rowsByCode(snapshot.sheet.rows);
  if (
    expected.size !== actual.size ||
    [...expected].some(([code, signature]) => actual.get(code) !== signature)
  ) {
    throw new StockWipApiError(UNCERTAIN_SAVE, true);
  }
  return snapshot;
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
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [pendingDeleteSave, setPendingDeleteSave] =
    useState<PendingWipDeleteSave | null>(null);
  const [pendingFilters, setPendingFilters] =
    useState<StockWipFilterValues | null>(null);
  const [errors, setErrors] = useState<StockWipValidationErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const saveLock = useRef(false);

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
      ? draft.rows.find((row) => row.item.code_new === selectedDailyCode)
      : undefined;
  const deleteRow =
    deleteCode === null
      ? undefined
      : draft.rows.find((row) => row.item.code_new === deleteCode);
  const pendingDeletedRows = useMemo(() => {
    const codes = new Set(draft.rows.map((row) => row.item.code_new));
    return (
      savedSheet?.rows.filter((row) => !codes.has(row.item.code_new)) ?? []
    );
  }, [draft.rows, savedSheet]);
  const pendingDeleteCount = pendingDeletedRows.length;
  const editorDialogOpen =
    createOpen ||
    Boolean(selectedDailyRow) ||
    Boolean(deleteRow) ||
    pendingFilters !== null;
  const dialogOpen = editorDialogOpen || pendingDeleteSave !== null;
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

  useEffect(() => {
    if (!hasUnsavedChanges && !isSaving) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  function openPeriod(nextFilters: StockWipFilterValues) {
    if (isBusy || saveLock.current) return;
    // Keep the current draft until the requested period loads successfully.
    setCreateOpen(false);
    setSelectedDailyCode(null);
    setDeleteCode(null);
    setPendingDeleteSave(null);
    setNotice(null);
    setLoadTarget(copyFilters(nextFilters));
  }

  function handleReload() {
    if (isBusy || saveLock.current || dialogOpen) return;
    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(filters));
      return;
    }
    openPeriod(filters);
  }

  function handleFiltersChange(nextFilters: StockWipFilterValues) {
    if (isBusy || saveLock.current || dialogOpen) return;
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
    if (
      !canEdit ||
      saveLock.current ||
      dialogOpen ||
      draft.period.view !== "MONTH"
    ) {
      return;
    }

    setSelectedDailyCode(null);
    setCreateOpen(true);
  }

  function handleCreate(input: StockWipCreateInput) {
    if (
      !canEdit ||
      saveLock.current ||
      !createOpen ||
      draft.period.view !== "MONTH"
    ) {
      return false;
    }
    // Removing and re-creating the same saved code in one batch is ambiguous:
    // the API identifies an existing row by Code New and preserves its item.
    // Require the pending deletion to be saved or discarded first.
    const code = input.code_new.trim();
    if (
      savedSheet?.rows.some((row) => row.item.code_new.trim() === code) &&
      !draft.rows.some((row) => row.item.code_new.trim() === code)
    ) {
      setNotice({
        tone: "error",
        text: `รหัส ${code} อยู่ในรายการรอลบ กรุณาบันทึกการลบหรือยกเลิกการแก้ไขก่อนเพิ่มรหัสเดิม`,
      });
      return false;
    }
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
    if (!canEdit || saveLock.current || dialogOpen) return;
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
    if (
      !canEdit ||
      saveLock.current ||
      selectedDailyCode !== codeNew ||
      draft.period.view !== "MONTH" ||
      pendingDeleteSave !== null
    )
      return;
    setDraft((current) =>
      updateStockWipDaily(current, codeNew, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function openDeleteWip(row: StockWipRow) {
    if (!canEdit || saveLock.current || dialogOpen) return;
    if (draft.rows.some((entry) => entry.item.code_new === row.item.code_new)) {
      setDeleteCode(row.item.code_new);
    }
  }

  function confirmDeleteWip() {
    if (!deleteRow || !canEdit || saveLock.current) return;
    const code = deleteRow.item.code_new;
    const wasSaved = savedSheet?.rows.some((row) => row.item.code_new === code);
    setDraft((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.item.code_new !== code),
    }));
    setDeleteCode(null);
    setSelectedDailyCode(null);
    setErrors({});
    setNotice({
      tone: "info",
      title: "นำสินค้า WIP ออกจากฉบับร่างแล้ว",
      text: wasSaved
        ? `รหัส ${code} รอลบถาวรเฉพาะงวดนี้ กรุณากดบันทึกข้อมูลเพื่อยืนยันการลบ`
        : `นำรหัส ${code} ที่ยังไม่ได้บันทึกออกแล้ว ไม่มีการเขียนข้อมูลลงฐานข้อมูล`,
    });
  }

  function handleDiscard() {
    if (isBusy || saveLock.current || dialogOpen) return;
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
    setDeleteCode(null);
    setPendingDeleteSave(null);
    setErrors({});
    setNotice({
      tone: "info",
      text: reloadRequired
        ? "ยกเลิกฉบับร่างแล้ว กรุณาโหลดข้อมูลล่าสุดจากฐานข้อมูลก่อนแก้ไขอีกครั้ง"
        : "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นค่าที่โหลดหรือบันทึกไว้ล่าสุด",
    });
  }

  async function handleSave(confirmation?: PendingWipDeleteSave) {
    if (
      !canEdit ||
      saveLock.current ||
      !snapshot ||
      !hasUnsavedChanges ||
      editorDialogOpen
    )
      return;
    if (confirmation) {
      if (
        confirmation !== pendingDeleteSave ||
        confirmation.snapshot !== snapshot ||
        confirmation.draft !== draft
      ) {
        return;
      }
    } else if (pendingDeleteSave !== null) {
      return;
    }
    const nextErrors = validateStockWipSheet(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ไขช่องตัวเลขที่ไม่ถูกต้องก่อน",
      });
      return;
    }
    if (pendingDeleteCount > 0 && !confirmation) {
      setPendingDeleteSave({
        snapshot,
        draft,
        rows: pendingDeletedRows,
      });
      return;
    }
    const confirmedDeletedRefs =
      confirmation?.rows.map((row) => row.item.code_new) ?? [];
    saveLock.current = true;
    setIsSaving(true);
    setPendingDeleteSave(null);
    setNotice(null);
    try {
      const saved = await saveStockWip(snapshot, draft, confirmedDeletedRefs);
      setSnapshot(saved);
      setDraft(structuredClone(saved.sheet));
      setErrors({});
      setNotice({
        tone: "success",
        text:
          pendingDeleteCount > 0
            ? `บันทึกข้อมูลเรียบร้อยแล้ว รวมการลบสินค้า WIP ถาวร ${pendingDeleteCount.toLocaleString("th-TH")} รายการจากงวดนี้`
            : "บันทึกข้อมูล Stock WIP ลงฐานข้อมูลเรียบร้อยแล้ว",
      });
    } catch (error) {
      if (!(error instanceof StockWipApiError) || error.reloadRequired) {
        setReloadRequired(true);
      }
      setNotice({
        tone: "error",
        text:
          error instanceof StockWipApiError ? error.message : UNCERTAIN_SAVE,
      });
      // Keep the unsaved draft and original revision. Never retry automatically.
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  function confirmPeriodChange() {
    if (isBusy || saveLock.current || !pendingFilters) {
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
          <>
            <Badge variant="outline">DATABASE</Badge>{" "}
            {draft && (
              <Button
                type="button"
                variant="outline"
                onClick={openCreateForm}
                disabled={
                  !canEdit || dialogOpen || draft.period.view !== "MONTH"
                }
                title={
                  draft.period.view === "YEAR"
                    ? "กรุณาเลือกงวดรายเดือนก่อนเพิ่มรายการ WIP"
                    : "เพิ่มรายการ WIP"
                }
              >
                <Plus className="size-4" aria-hidden="true" />
                เพิ่มรายการ WIP
              </Button>
            )}
          </>
        }
      />

      <fieldset
        disabled={isBusy || dialogOpen}
        className="min-w-0 border-0 p-0"
      >
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
          {pendingDeleteCount > 0 && (
            <p className="text-xs font-medium text-danger">
              รอลบถาวร {pendingDeleteCount.toLocaleString("th-TH")} รายการ ·
              ต้องกดบันทึกข้อมูล
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReload}
            disabled={isBusy || dialogOpen}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            โหลดข้อมูลใหม่
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isBusy || dialogOpen || !hasUnsavedChanges}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!canEdit || dialogOpen || !hasUnsavedChanges}
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
                    if (!isBusy && !saveLock.current && !dialogOpen) {
                      setSelectedDailyCode(row.item.code_new);
                    }
                  }
                : undefined
            }
            onDelete={openDeleteWip}
            disabled={!canEdit || dialogOpen}
          />
        </>
      )}

      {draft.period.view === "MONTH" && (
        <StockWipFfCreateForm
          key={draft.id}
          open={createOpen}
          period={draft.period}
          onOpenChange={(open) => {
            if (!open) setCreateOpen(false);
            else openCreateForm();
          }}
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
        open={pendingDeleteSave !== null}
        onOpenChange={(open) => {
          if (!open && !saveLock.current) setPendingDeleteSave(null);
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              ยืนยันบันทึกและลบสินค้า WIP ถาวร
            </AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะลบทะเบียนสินค้า WIP ยอดสรุป
              และรายละเอียดการเคลื่อนไหวของรายการด้านล่างออกจากฐานข้อมูลในงวดที่เลือก
              พร้อมบันทึกการเพิ่มและแก้ไขทั้งหมด
              การลบที่บันทึกสำเร็จแล้วไม่สามารถเรียกคืนจากหน้านี้ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/25 p-3 text-sm">
            <p className="font-medium">
              {periodLabel(pendingDeleteSave?.draft.period ?? draft.period)} (
              {(pendingDeleteSave?.rows.length ?? 0).toLocaleString("th-TH")}{" "}
              รายการ)
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {pendingDeleteSave?.rows.map((row) => (
                <li
                  key={row.item.code_new}
                  className="wrap-break-word border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="font-medium">{row.item.code_new}</span>
                  {row.item.code_old && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Code Old: {row.item.code_old}
                    </span>
                  )}
                  {row.item.name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {row.item.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              กลับไปยังฉบับร่าง
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                !canEdit ||
                pendingDeleteSave === null ||
                pendingDeleteSave.rows.length === 0
              }
              onClick={() => {
                if (pendingDeleteSave) void handleSave(pendingDeleteSave);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              บันทึกและลบถาวร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      <AlertDialog
        open={deleteRow !== undefined}
        onOpenChange={(open) => {
          if (!open) setDeleteCode(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>นำสินค้า WIP ออกจากฉบับร่าง</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการนำสินค้า WIP ออกจากฉบับร่างของ {periodLabel(draft.period)}{" "}
              หรือไม่? หากเคยบันทึกไว้แล้ว
              ระบบจะลบถาวรเมื่อยืนยันบันทึกจากหน้าหลักเท่านั้น
              สามารถยกเลิกการแก้ไขเพื่อคืนข้อมูลได้ก่อนบันทึก
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteRow && (
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">รหัส {deleteRow.item.code_new}</p>
              {deleteRow.item.code_old && (
                <p className="text-xs text-muted-foreground">
                  Code Old: {deleteRow.item.code_old}
                </p>
              )}
              {deleteRow.item.name && (
                <p className="text-muted-foreground">{deleteRow.item.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                ลำดับ {deleteRow.item.no} · {periodLabel(draft.period)}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!canEdit}
              onClick={confirmDeleteWip}
            >
              นำออกจากฉบับร่าง
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
