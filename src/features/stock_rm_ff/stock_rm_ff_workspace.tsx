"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
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
  addStockRmRow,
  DEFAULT_STOCK_RM_FILTERS,
  blankStockRmSheet,
  isValidStockRmNumber,
  STOCK_RM_SUMMARY_FIELDS,
  STOCK_RM_MOVEMENT_FIELDS,
  stockRmSourceSheetName,
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
import { StockRmTable, type StockRmTableProps } from "./stock_rm_ff_table";

/**
 * Stock RM FF: persisted monthly and annual snapshots.
 * React State contains an editable draft, never the authoritative saved data.
 * Only the Save action writes to the API. No Excel formulas are recalculated.
 */

const RM_API = "/api/stock/rm-ff";
const CSRF_COOKIE = "ionflow_factory_csrf";
const MAX_CHANGED_ROWS = 2000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LOAD_FAILED = "ไม่สามารถโหลดข้อมูลสต็อกวัตถุดิบจากฐานข้อมูลได้";
const INVALID_RESPONSE = "รูปแบบข้อมูลจาก API ไม่ถูกต้อง";
const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึกซ้ำ";

type StockRmSnapshot = { sheet: StockRmSheet; revision: string };

type PendingRmDeleteSave = {
  snapshot: StockRmSnapshot;
  draft: StockRmSheet;
  rows: StockRmRow[];
};

class StockRmApiError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "StockRmApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && !value.includes("\0");
}

function exactFields(
  value: Record<string, unknown>,
  fields: readonly string[],
) {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

function hasNumericTextFields(value: unknown, fields: readonly string[]) {
  return (
    isRecord(value) &&
    exactFields(value, fields) &&
    fields.every((field) => {
      const cell = value[field];
      return isText(cell) && isValidStockRmNumber(cell);
    })
  );
}

function isStockRmRow(value: unknown): value is StockRmRow {
  if (!isRecord(value) || !isRecord(value.item)) return false;
  const item = value.item;
  return (
    exactFields(value, ["item", "summary", "remark", "daily", "year_months"]) &&
    exactFields(item, ["no", "code_new", "name"]) &&
    typeof item.no === "number" &&
    Number.isSafeInteger(item.no) &&
    item.no >= 1 &&
    isText(item.code_new) &&
    Boolean(item.code_new.trim()) &&
    (item.name === null || (isText(item.name) && Boolean(item.name.trim()))) &&
    isText(value.remark) &&
    hasNumericTextFields(value.summary, STOCK_RM_SUMMARY_FIELDS) &&
    Array.isArray(value.daily) &&
    value.daily.length <= 31 &&
    value.daily.every(
      (entry: unknown) =>
        isRecord(entry) &&
        exactFields(entry, ["date", "values"]) &&
        isText(entry.date) &&
        hasNumericTextFields(entry.values, STOCK_RM_MOVEMENT_FIELDS),
    ) &&
    Array.isArray(value.year_months) &&
    value.year_months.length <= 12 &&
    value.year_months.every(
      (entry: unknown) =>
        isRecord(entry) &&
        exactFields(entry, ["month", "values"]) &&
        typeof entry.month === "number" &&
        Number.isInteger(entry.month) &&
        entry.month >= 1 &&
        entry.month <= 12 &&
        hasNumericTextFields(entry.values, STOCK_RM_MOVEMENT_FIELDS),
    )
  );
}

function isSheetTimestamp(value: unknown): boolean {
  return isText(value) && (value === "" || Number.isFinite(Date.parse(value)));
}

function isStockRmSheet(
  value: unknown,
  period: StockRmPeriod,
): value is StockRmSheet {
  if (!isRecord(value) || !isRecord(value.period)) return false;
  const actual = value.period;
  const expectedFields =
    period.view === "MONTH"
      ? ["view", "year_be", "month"]
      : ["view", "year_be"];
  if (
    !exactFields(actual, expectedFields) ||
    actual.view !== period.view ||
    actual.year_be !== period.year_be ||
    (period.view === "MONTH" && actual.month !== period.month)
  )
    return false;
  return (
    value.id === stockRmPeriodKey(period) &&
    value.source_sheet_name === stockRmSourceSheetName(period) &&
    isSheetTimestamp(value.created_at) &&
    isSheetTimestamp(value.updated_at) &&
    Array.isArray(value.rows) &&
    value.rows.every(isStockRmRow)
  );
}

function hasUniqueCodes(rows: readonly StockRmRow[]): boolean {
  return (
    new Set(rows.map((row) => row.item.code_new.trim())).size === rows.length
  );
}

function readApiSnapshot(
  payload: unknown,
  period: StockRmPeriod,
  writing = false,
): StockRmSnapshot {
  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    !isText(payload.revision) ||
    !/^[a-f0-9]{64}$/.test(payload.revision) ||
    !isStockRmSheet(payload.sheet, period) ||
    !hasUniqueCodes(payload.sheet.rows) ||
    Object.keys(validateStockRmSheet(payload.sheet)).length > 0
  ) {
    throw new StockRmApiError(
      writing ? UNCERTAIN_SAVE : INVALID_RESPONSE,
      writing,
    );
  }
  return { sheet: payload.sheet, revision: payload.revision };
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
    if (/^[A-Za-z0-9_-]{43}$/.test(token)) return token;
  } catch {
    // Never send a mutation without a valid CSRF cookie.
  }
  throw new StockRmApiError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token ที่ถูกต้อง");
}

async function requestRmJson(
  url: string,
  init: RequestInit,
  writing: boolean,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new StockRmApiError(writing ? UNCERTAIN_SAVE : LOAD_FAILED, writing);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    // Only a well-formed, explicit input rejection is safe to retry without
    // refreshing. An unknown response may have followed a successful commit.
    const invalidInput =
      response.status === 400 && isRecord(payload) && payload.ok === false;
    const reloadRequired = writing && !invalidInput;
    const message =
      response.status === 401 || response.status === 403
        ? "กรุณาตรวจสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน"
        : isRecord(payload) && payload.ok === false && isText(payload.message)
          ? payload.message
          : writing
            ? UNCERTAIN_SAVE
            : LOAD_FAILED;
    throw new StockRmApiError(message, reloadRequired);
  }
  return payload;
}

async function loadRmSheet(
  period: StockRmPeriod,
  signal: AbortSignal,
): Promise<StockRmSnapshot> {
  const params = new URLSearchParams({
    view: period.view,
    year_be: String(period.year_be),
  });
  if (period.view === "MONTH") params.set("month", String(period.month));
  const payload = await requestRmJson(`${RM_API}?${params}`, { signal }, false);
  return readApiSnapshot(payload, period);
}

// Compare source values, not property ordering. Code New is the row identity
// only within this period, exactly as in the existing domain and API.
function rowSignature(row: StockRmRow): string {
  return JSON.stringify([
    row.item.no,
    row.item.code_new,
    row.item.name,
    STOCK_RM_SUMMARY_FIELDS.map((field) => row.summary[field]),
    row.remark,
    [...row.daily]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => [
        entry.date,
        STOCK_RM_MOVEMENT_FIELDS.map((field) => entry.values[field]),
      ]),
    [...row.year_months]
      .sort((a, b) => a.month - b.month)
      .map((entry) => [
        entry.month,
        STOCK_RM_MOVEMENT_FIELDS.map((field) => entry.values[field]),
      ]),
  ]);
}

function rowsByCode(rows: readonly StockRmRow[]) {
  return new Map(rows.map((row) => [row.item.code_new, rowSignature(row)]));
}

function changedRows(saved: StockRmSheet, draft: StockRmSheet) {
  if (
    saved.id !== draft.id ||
    !hasUniqueCodes(saved.rows) ||
    !hasUniqueCodes(draft.rows)
  ) {
    throw new StockRmApiError(
      "งวดรายงานหรือรหัสวัตถุดิบไม่ถูกต้อง กรุณาตรวจสอบฉบับร่าง",
    );
  }
  const previous = rowsByCode(saved.rows);
  const current = rowsByCode(draft.rows);
  return {
    changes: draft.rows.filter(
      (row) =>
        previous.get(row.item.code_new) !== current.get(row.item.code_new),
    ),
    // Never derive deletions from a filtered list. Only the complete draft
    // and its saved baseline participate in this comparison.
    deletedRefs: [...previous.keys()].filter((code) => !current.has(code)),
  };
}

async function persistRmSheet(
  saved: StockRmSnapshot,
  draft: StockRmSheet,
  confirmedDeletedRefs: readonly string[],
): Promise<StockRmSnapshot> {
  const { changes, deletedRefs } = changedRows(saved.sheet, draft);
  const confirmed = new Set(confirmedDeletedRefs);
  // A disappearance in the draft is not sufficient consent for a database delete.
  if (
    confirmed.size !== confirmedDeletedRefs.length ||
    confirmed.size !== deletedRefs.length ||
    deletedRefs.some((code) => !confirmed.has(code))
  ) {
    throw new StockRmApiError("กรุณายืนยันการลบวัตถุดิบถาวรก่อนบันทึก");
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
    throw new StockRmApiError(
      "ข้อมูลที่แก้ไขเกินขนาดที่รองรับ (2,000 รายการ หรือ 4 MiB) กรุณาลดจำนวนรายการก่อนบันทึก",
    );
  }
  const payload = await requestRmJson(
    RM_API,
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
  const snapshot = readApiSnapshot(payload, draft.period, true);
  if (
    deletedRefs.length > 0 &&
    (!isRecord(payload) || payload.deleted !== deletedRefs.length)
  ) {
    throw new StockRmApiError(UNCERTAIN_SAVE, true);
  }
  const expected = rowsByCode(draft.rows);
  const actual = rowsByCode(snapshot.sheet.rows);
  if (
    expected.size !== actual.size ||
    [...expected].some(([code, signature]) => actual.get(code) !== signature)
  ) {
    throw new StockRmApiError(UNCERTAIN_SAVE, true);
  }
  return snapshot;
}

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
  const [savedSnapshot, setSavedSnapshot] = useState<StockRmSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<StockRmSheet>(() =>
    blankStockRmSheet(DEFAULT_STOCK_RM_FILTERS.period),
  );
  const [filters, setFilters] = useState<StockRmFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_RM_FILTERS),
  );
  const [loadPeriod, setLoadPeriod] = useState<StockRmPeriod>(() => ({
    ...DEFAULT_STOCK_RM_FILTERS.period,
  }));
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadLock = useRef(true);
  const saveLock = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDailyCode, setSelectedDailyCode] = useState<string | null>(
    null,
  );
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [pendingDeleteSave, setPendingDeleteSave] =
    useState<PendingRmDeleteSave | null>(null);
  const [pendingFilters, setPendingFilters] =
    useState<StockRmFilterValues | null>(null);
  const [errors, setErrors] = useState<StockRmValidationErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = savedSnapshot?.sheet;
  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        savedSheet &&
        JSON.stringify(draft.rows) !== JSON.stringify(savedSheet.rows),
      ),
    [draft.rows, savedSheet],
  );
  const visibleRows = useMemo(
    () => filterStockRmRows(draft.rows, filters),
    [draft.rows, filters],
  );
  const selectedDailyRow =
    selectedDailyCode !== null && draft.period.view === "MONTH"
      ? draft.rows.find((row) => row.item.code_new === selectedDailyCode)
      : undefined;
  const deleteRow =
    deleteCode === null
      ? undefined
      : draft.rows.find((row) => row.item.code_new === deleteCode);
  const pendingDeletedRows = useMemo(() => {
    const codes = new Set(draft.rows.map((row) => row.item.code_new));
    return savedSheet?.rows.filter((row) => !codes.has(row.item.code_new)) ?? [];
  }, [draft.rows, savedSheet]);
  const pendingDeleteCount = pendingDeletedRows.length;
  const errorCount = Object.keys(errors).length;
  const busy = loadState.loading || isSaving;
  const readOnly =
    busy || Boolean(loadState.error) || refreshRequired || !savedSnapshot;
  const editorDialogOpen =
    createOpen ||
    Boolean(selectedDailyRow) ||
    Boolean(deleteRow) ||
    pendingFilters !== null;
  const dialogOpen = editorDialogOpen || pendingDeleteSave !== null;
  const reloadPending =
    pendingFilters !== null &&
    stockRmPeriodKey(pendingFilters.period) ===
      stockRmPeriodKey(filters.period);

  useEffect(() => {
    if (errorCount > 0) errorSummaryRef.current?.focus();
  }, [errorCount]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRmSheet(loadPeriod, controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setSavedSnapshot(snapshot);
        setDraft(structuredClone(snapshot.sheet));
        setLoadState({ loading: false, error: "" });
        setRefreshRequired(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({
          loading: false,
          error: error instanceof StockRmApiError ? error.message : LOAD_FAILED,
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) loadLock.current = false;
      });
    return () => controller.abort();
  }, [loadPeriod]);

  useEffect(() => {
    if (!hasUnsavedChanges && !isSaving) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  function openPeriod(nextFilters: StockRmFilterValues) {
    if (loadLock.current || saveLock.current) return;
    loadLock.current = true;
    setFilters(copyFilters(nextFilters));
    setDraft(blankStockRmSheet(nextFilters.period));
    setSavedSnapshot(null);
    setLoadState({ loading: true, error: "" });
    setRefreshRequired(false);
    setCreateOpen(false);
    setSelectedDailyCode(null);
    setDeleteCode(null);
    setPendingDeleteSave(null);
    setPendingFilters(null);
    setErrors({});
    setNotice(null);
    setLoadPeriod({ ...nextFilters.period });
  }

  function reloadSheet() {
    if (loadLock.current || saveLock.current || dialogOpen) return;
    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(filters));
      return;
    }
    openPeriod(filters);
  }

  function handleFiltersChange(nextFilters: StockRmFilterValues) {
    if (loadLock.current || saveLock.current || dialogOpen) return;
    const currentKey = stockRmPeriodKey(filters.period);
    const nextKey = stockRmPeriodKey(nextFilters.period);
    if (currentKey === nextKey) {
      setFilters(copyFilters(nextFilters));
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
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      dialogOpen ||
      draft.period.view !== "MONTH"
    )
      return;
    setCreateOpen(true);
  }

  function handleCreate(input: StockRmCreateInput): boolean {
    if (
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      !createOpen ||
      draft.period.view !== "MONTH"
    )
      return false;
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
    // Keep the original synchronous validation; the form catches duplicate
    // codes and displays its existing error message without closing.
    const nextDraft = addStockRmRow(draft, input);
    setDraft(nextDraft);
    setFilters((current) => ({ ...current, search: "" }));
    setSelectedDailyCode(null);
    setErrors({});
    setNotice({
      tone: "info",
      title: "เพิ่มวัตถุดิบลงฉบับร่างแล้ว",
      text: "เพิ่มรายการวัตถุดิบแล้ว กรุณากดบันทึกข้อมูลจากหน้าหลักเพื่อจัดเก็บลงฐานข้อมูล",
    });
    return true;
  }

  function handleSummaryChange(
    codeNew: string,
    field: StockRmSummaryField,
    value: string,
  ) {
    if (readOnly || loadLock.current || saveLock.current || dialogOpen) return;
    setDraft((current) => updateStockRmSummary(current, codeNew, field, value));
    setErrors({});
    setNotice(null);
  }

  function handleRemarkChange(codeNew: string, value: string) {
    if (readOnly || loadLock.current || saveLock.current || dialogOpen) return;
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
    if (
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      selectedDailyCode !== codeNew ||
      draft.period.view !== "MONTH"
    )
      return;
    setDraft((current) =>
      updateStockRmDaily(current, codeNew, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function openDaily(row: StockRmRow) {
    if (
      busy ||
      loadLock.current ||
      saveLock.current ||
      dialogOpen ||
      draft.period.view !== "MONTH" ||
      !savedSnapshot
    )
      return;
    if (draft.rows.some((entry) => entry.item.code_new === row.item.code_new)) {
      setSelectedDailyCode(row.item.code_new);
    }
  }

  function openDeleteMaterial(row: StockRmRow) {
    if (readOnly || loadLock.current || saveLock.current || dialogOpen) return;
    if (draft.rows.some((entry) => entry.item.code_new === row.item.code_new)) {
      setDeleteCode(row.item.code_new);
    }
  }

  function confirmDeleteMaterial() {
    if (!deleteRow || readOnly || loadLock.current || saveLock.current) return;
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
      title: "นำวัตถุดิบออกจากฉบับร่างแล้ว",
      text: wasSaved
        ? `รหัส ${code} รอลบถาวรเฉพาะงวดนี้ กรุณากดบันทึกข้อมูลเพื่อยืนยันการลบ`
        : `นำรหัส ${code} ที่ยังไม่ได้บันทึกออกแล้ว ไม่มีการเขียนข้อมูลลงฐานข้อมูล`,
    });
  }

  function handleDiscard() {
    if (loadLock.current || saveLock.current || dialogOpen || !savedSheet)
      return;
    setDraft(structuredClone(savedSheet));
    setSelectedDailyCode(null);
    setCreateOpen(false);
    setDeleteCode(null);
    setErrors({});
    setNotice({
      tone: "info",
      text: "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นฉบับล่าสุดที่โหลดจากฐานข้อมูล",
    });
  }

  async function handleSave(confirmation?: PendingRmDeleteSave) {
    if (
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      !savedSnapshot ||
      !hasUnsavedChanges ||
      editorDialogOpen
    )
      return;
    if (confirmation) {
      if (
        confirmation !== pendingDeleteSave ||
        confirmation.snapshot !== savedSnapshot ||
        confirmation.draft !== draft
      ) {
        return;
      }
    } else if (pendingDeleteSave !== null) {
      return;
    }
    const nextErrors = validateStockRmSheet(draft);
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
        snapshot: savedSnapshot,
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
      const snapshot = await persistRmSheet(
        savedSnapshot,
        draft,
        confirmedDeletedRefs,
      );
      setSavedSnapshot(snapshot);
      setDraft(structuredClone(snapshot.sheet));
      setErrors({});
      setNotice({
        tone: "success",
        text:
          pendingDeleteCount > 0
            ? `บันทึกข้อมูลเรียบร้อยแล้ว รวมการลบวัตถุดิบถาวร ${pendingDeleteCount.toLocaleString("th-TH")} รายการจากงวดนี้`
            : "บันทึกข้อมูลสต็อกวัตถุดิบลงฐานข้อมูลเรียบร้อยแล้ว",
      });
    } catch (error) {
      if (!(error instanceof StockRmApiError) || error.reloadRequired) {
        setRefreshRequired(true);
      }
      setNotice({
        tone: "error",
        text: error instanceof StockRmApiError ? error.message : UNCERTAIN_SAVE,
      });
      // Keep the unsaved draft and original revision. Never retry automatically.
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  function confirmPeriodChange() {
    if (!pendingFilters || loadLock.current || saveLock.current) return;
    openPeriod(pendingFilters);
  }

  // Keep table actions grouped. The existing table still accepts its original
  // props; the next table file will consume onDelete for the row trash button.
  const tableProps = {
    rows: visibleRows,
    disabled: readOnly || dialogOpen,
    onChange: handleSummaryChange,
    onRemarkChange: handleRemarkChange,
    onViewDaily: draft.period.view === "MONTH" ? openDaily : undefined,
    onDelete: openDeleteMaterial,
  } satisfies StockRmTableProps & { onDelete: (row: StockRmRow) => void };

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Stock RM FF"
        description="สต็อกวัตถุดิบตามรูปแบบไฟล์ Stock RM FF 2569.xlsx"
        actions={<><Badge variant="outline">ฐานข้อมูลจริง</Badge> {draft && (<Button
            type="button"
            variant="outline"
            onClick={openCreateForm}
            disabled={readOnly || dialogOpen || draft.period.view !== "MONTH"}
            title={
              draft.period.view === "YEAR"
                ? "กรุณาเลือกงวดรายเดือนก่อนเพิ่มวัตถุดิบ"
                : "เพิ่มรายการวัตถุดิบ"
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มวัตถุดิบ
          </Button>)}</>}
      />

      <fieldset disabled={busy || dialogOpen} className="min-w-0">
        <StockRmFilters
          value={filters}
          onChange={handleFiltersChange}
          onReset={() =>
            handleFiltersChange(copyFilters(DEFAULT_STOCK_RM_FILTERS))
          }
        />
      </fieldset>

      {loadState.loading && (
        <p
          role="status"
          className="rounded-lg border bg-card p-3 text-sm text-muted-foreground"
        >
          กำลังโหลดข้อมูลสต็อกวัตถุดิบจากฐานข้อมูล...
        </p>
      )}
      {loadState.error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>โหลดข้อมูลไม่สำเร็จ</AlertTitle>
          <AlertDescription>{loadState.error}</AlertDescription>
        </Alert>
      )}
      {refreshRequired && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          <AlertTitle>ต้องตรวจสอบข้อมูลล่าสุด</AlertTitle>
          <AlertDescription>
            {hasUnsavedChanges
              ? "ฉบับร่างยังคงอยู่ กรุณาตรวจสอบหรือจดข้อมูลที่แก้ไขก่อนกดโหลดข้อมูลใหม่ "
              : "กรุณาโหลดข้อมูลล่าสุดจากฐานข้อมูล "}
            ระบบจะไม่บันทึกซ้ำจนกว่าจะโหลดข้อมูลล่าสุดสำเร็จ
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {periodLabel(draft.period)}
          </p>
          <p className="text-xs text-muted-foreground">
            {draft.source_sheet_name} · แสดง{" "}
            {visibleRows.length.toLocaleString("th-TH")} จาก{" "}
            {draft.rows.length.toLocaleString("th-TH")} รายการ
          </p>
          <p className="text-xs text-muted-foreground">
            {loadState.loading
              ? "กำลังโหลดข้อมูล"
              : loadState.error
                ? "ยังไม่ได้รับข้อมูลจากฐานข้อมูล"
                : hasUnsavedChanges
                  ? "มีการแก้ไขที่ยังไม่ได้บันทึก"
                  : "ข้อมูลตรงกับฉบับล่าสุดที่โหลดจากฐานข้อมูล"}
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
            disabled={busy || dialogOpen}
            onClick={reloadSheet}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            โหลดข้อมูลใหม่
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={busy || dialogOpen || !hasUnsavedChanges}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={readOnly || dialogOpen || !hasUnsavedChanges}
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
              กรุณาตรวจสอบช่องที่มีสีเตือนในตารางหลักหรือรายละเอียดรายวัน
              รวมถึงรายการที่ถูกซ่อนจากการค้นหา แล้วบันทึกใหม่
            </AlertDescription>
          </Alert>
        </div>
      )}

      {savedSnapshot && (
        <>
          <StockRmSummary rows={visibleRows} />
          <StockRmTable {...tableProps} />
        </>
      )}

      {draft.period.view === "MONTH" && (
        <StockRmFfCreateForm
          key={draft.id}
          open={createOpen}
          period={draft.period}
          onOpenChange={(open) => {
            if (!open) setCreateOpen(false);
            else openCreateForm();
          }}
          onCreate={handleCreate}
          disabled={readOnly}
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
                disabled={readOnly}
                onChange={handleDailyChange}
                onClose={() => setSelectedDailyCode(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ข้อมูลจากฐานข้อมูล · เพิ่ม แก้ไข และลบในฉบับร่างก่อนกดบันทึก ·
        รายเดือนและรายปีแยกจากกัน · น้ำหนัก ราคาเฉลี่ย มูลค่า และยอดรายวัน
        ไม่ถูกคำนวณตามกันอัตโนมัติ · ไม่ได้นำเข้าข้อมูล Excel หรือ Mock
        โดยอัตโนมัติ
      </p>

      <AlertDialog
        open={pendingDeleteSave !== null}
        onOpenChange={(open) => {
          if (!open && !saveLock.current) setPendingDeleteSave(null);
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันบันทึกและลบวัตถุดิบถาวร</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะลบทะเบียนวัตถุดิบ ยอดสรุป และรายละเอียดการเคลื่อนไหวของรายการด้านล่างออกจากฐานข้อมูลในงวดที่เลือก พร้อมบันทึกการเพิ่มและแก้ไขทั้งหมด การลบที่บันทึกสำเร็จแล้วไม่สามารถเรียกคืนจากหน้านี้ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/25 p-3 text-sm">
            <p className="font-medium">
              {periodLabel(draft.period)} ({(pendingDeleteSave?.rows.length ?? 0).toLocaleString("th-TH")} รายการ)
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {pendingDeleteSave?.rows.map((row) => (
                <li
                  key={row.item.code_new}
                  className="wrap-break-word border-b pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="font-medium">{row.item.code_new}</span>
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
            <AlertDialogCancel disabled={isSaving}>กลับไปยังฉบับร่าง</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                readOnly ||
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
              {reloadPending
                ? "การโหลดข้อมูลใหม่จะทิ้งฉบับร่างของงวดนี้ กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"
                : "การเปลี่ยนช่วงเวลาจะทิ้งการแก้ไขของชีตปัจจุบัน หากต้องการเก็บข้อมูล กรุณากลับไปกดบันทึกก่อนเปลี่ยนปีหรือเดือน"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปยังฉบับร่าง</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmPeriodChange}
            >
              {reloadPending
                ? "ทิ้งการแก้ไขและโหลดข้อมูลใหม่"
                : "ทิ้งการแก้ไขและเปลี่ยนช่วงเวลา"}
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
            <AlertDialogTitle>นำวัตถุดิบออกจากฉบับร่าง</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการนำวัตถุดิบออกจากฉบับร่างของ {periodLabel(draft.period)}{" "}
              หรือไม่? หากเคยบันทึกไว้แล้ว ระบบจะลบถาวรเมื่อยืนยันบันทึกจากหน้าหลักเท่านั้น
              สามารถยกเลิกการแก้ไขเพื่อคืนข้อมูลได้ก่อนบันทึก
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteRow && (
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">รหัส {deleteRow.item.code_new}</p>
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
              onClick={confirmDeleteMaterial}
            >
              นำออกจากฉบับร่าง
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
