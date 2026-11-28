"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PackagePlus,
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
  DEFAULT_STOCK_MATERIAL_FILTERS,
  addStockMaterialRow,
  filterStockMaterialRows,
  blankStockMaterialSheet,
  isValidStockMaterialNumber,
  stockMaterialSourceSheetName,
  STOCK_MATERIAL_FF_DAILY_FIELDS,
  STOCK_MATERIAL_FF_SUMMARY_FIELDS,
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
  type StockMaterialRow,
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
 * Remaining Materials FF: saved monthly snapshots from the database.
 * Edits remain in a separate draft until the user saves the entire change set.
 * Do not import mock rows or recalculate Excel values automatically.
 */

const MATERIAL_API = "/api/stock/remaining-materials-ff";
const CSRF_COOKIE = "ionflow_factory_csrf";
const MAX_CHANGED_ROWS = 2000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LOAD_FAILED = "ไม่สามารถโหลดข้อมูลวัสดุคงเหลือจากฐานข้อมูลได้";
const INVALID_RESPONSE = "รูปแบบข้อมูลจาก API ไม่ถูกต้อง";
const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจสอบข้อมูลล่าสุดก่อนบันทึกซ้ำ";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type MaterialSnapshot = { sheet: StockMaterialSheet; revision: string };

class MaterialApiError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "MaterialApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && !value.includes("\0");
}

function isNullableText(value: unknown): boolean {
  return value === null || isText(value);
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
      return isText(cell) && isValidStockMaterialNumber(cell);
    })
  );
}

function isMaterialRow(value: unknown): value is StockMaterialRow {
  if (!isRecord(value) || !isRecord(value.item)) return false;
  const item = value.item;
  const itemFields = ["source_row", "no", "category", "code", "name", "unit"];
  if (item.client_id !== undefined) itemFields.push("client_id");

  return (
    exactFields(value, [
      "item",
      "summary",
      "remark",
      "safety_stock",
      "daily",
    ]) &&
    exactFields(item, itemFields) &&
    typeof item.source_row === "number" &&
    Number.isSafeInteger(item.source_row) &&
    (item.client_id === undefined
      ? item.source_row >= 6
      : isText(item.client_id) &&
        UUID_PATTERN.test(item.client_id) &&
        item.source_row === 0 &&
        item.no === null) &&
    (item.no === null ||
      (typeof item.no === "number" &&
        Number.isSafeInteger(item.no) &&
        item.no >= 1)) &&
    isNullableText(item.category) &&
    isNullableText(item.code) &&
    isText(item.name) &&
    Boolean(item.name.trim()) &&
    isNullableText(item.unit) &&
    isText(value.remark) &&
    isText(value.safety_stock) &&
    hasNumericTextFields(value.summary, STOCK_MATERIAL_FF_SUMMARY_FIELDS) &&
    Array.isArray(value.daily) &&
    value.daily.length <= 31 &&
    value.daily.every(
      (entry: unknown) =>
        isRecord(entry) &&
        exactFields(entry, ["date", "values"]) &&
        isText(entry.date) &&
        hasNumericTextFields(entry.values, STOCK_MATERIAL_FF_DAILY_FIELDS),
    )
  );
}

function isSheetTimestamp(value: unknown): boolean {
  return isText(value) && (value === "" || Number.isFinite(Date.parse(value)));
}

function isMaterialSheet(
  value: unknown,
  period: StockMaterialPeriod,
): value is StockMaterialSheet {
  return (
    isRecord(value) &&
    isRecord(value.period) &&
    exactFields(value.period, ["view", "year_be", "month"]) &&
    value.period.view === period.view &&
    value.period.year_be === period.year_be &&
    value.period.month === period.month &&
    value.id === stockMaterialPeriodKey(period) &&
    value.source_sheet_name === stockMaterialSourceSheetName(period) &&
    isSheetTimestamp(value.created_at) &&
    isSheetTimestamp(value.updated_at) &&
    Array.isArray(value.rows) &&
    value.rows.every(isMaterialRow)
  );
}

function readApiSnapshot(
  payload: unknown,
  period: StockMaterialPeriod,
  writing = false,
): MaterialSnapshot {
  if (
    !isRecord(payload) ||
    payload.ok !== true ||
    !isText(payload.revision) ||
    !/^[a-f0-9]{64}$/.test(payload.revision) ||
    !isMaterialSheet(payload.sheet, period) ||
    Object.keys(validateStockMaterialSheet(payload.sheet)).length > 0
  ) {
    throw new MaterialApiError(
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
    if (token) return token;
  } catch {
    // Do not send a write request without the CSRF cookie.
  }
  throw new MaterialApiError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token");
}

async function requestMaterialJson(
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
    throw new MaterialApiError(writing ? UNCERTAIN_SAVE : LOAD_FAILED, writing);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const reloadRequired =
      writing &&
      (response.ok ||
        response.status >= 500 ||
        [401, 403, 404, 409].includes(response.status));
    const message =
      response.status === 401 || response.status === 403
        ? "กรุณาตรวจสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน"
        : isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : writing
            ? UNCERTAIN_SAVE
            : LOAD_FAILED;
    throw new MaterialApiError(message, reloadRequired);
  }
  return payload;
}

async function loadMaterialSheet(
  period: StockMaterialPeriod,
  signal: AbortSignal,
): Promise<MaterialSnapshot> {
  const params = new URLSearchParams({
    year_be: String(period.year_be),
    month: String(period.month),
  });
  const payload = await requestMaterialJson(
    `${MATERIAL_API}?${params}`,
    { signal },
    false,
  );
  return readApiSnapshot(payload, period);
}

// Compare only business data; do not depend on object key ordering or timestamps.
function materialRowSignature(row: StockMaterialRow): string {
  const { item, summary, remark, safety_stock: safetyStock, daily } = row;
  return JSON.stringify([
    item.source_row,
    item.client_id ?? null,
    item.no,
    item.category,
    item.code,
    item.name,
    item.unit,
    STOCK_MATERIAL_FF_SUMMARY_FIELDS.map((field) => summary[field]),
    remark,
    safetyStock,
    [...daily]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => [
        entry.date,
        STOCK_MATERIAL_FF_DAILY_FIELDS.map((field) => entry.values[field]),
      ]),
  ]);
}

function rowsByRef(rows: readonly StockMaterialRow[]) {
  return new Map(
    rows.map((row) => [stockMaterialRowRef(row), materialRowSignature(row)]),
  );
}

function changedMaterialRows(
  saved: StockMaterialSheet,
  draft: StockMaterialSheet,
  deleteRefs: readonly StockMaterialRowRef[],
) {
  if (saved.id !== draft.id) throw new MaterialApiError("เดือนรายงานไม่ตรงกัน");
  const previous = rowsByRef(saved.rows);
  const current = rowsByRef(draft.rows);
  const deleting = new Set(deleteRefs);
  // A missing row is never enough to authorize deletion. Each removed saved
  // row must have been explicitly selected by the user in this draft.
  if (
    previous.size !== saved.rows.length ||
    current.size !== draft.rows.length ||
    deleting.size !== deleteRefs.length ||
    deleteRefs.some((ref) => !previous.has(ref) || current.has(ref)) ||
    [...previous.keys()].some(
      (ref) => !current.has(ref) && !deleting.has(ref),
    )
  ) {
    throw new MaterialApiError("รายการวัสดุไม่ถูกต้อง กรุณาตรวจสอบฉบับร่าง");
  }
  return draft.rows.filter((row) => {
    const key = stockMaterialRowRef(row);
    return previous.get(key) !== current.get(key);
  });
}

async function persistMaterialSheet(
  saved: MaterialSnapshot,
  draft: StockMaterialSheet,
  deleteRefs: readonly StockMaterialRowRef[],
  confirmHardDelete: boolean,
): Promise<MaterialSnapshot> {
  const changes = changedMaterialRows(saved.sheet, draft, deleteRefs);
  if (deleteRefs.length > 0 && !confirmHardDelete) {
    throw new MaterialApiError("กรุณายืนยันการลบวัสดุถาวรก่อนบันทึก");
  }
  if (changes.length === 0 && deleteRefs.length === 0) return saved;
  const body = JSON.stringify({
    action: "save_sheet",
    period: draft.period,
    expected_revision: saved.revision,
    changes,
    ...(deleteRefs.length > 0
      ? { delete_refs: deleteRefs, confirm_hard_delete: true }
      : {}),
  });
  if (
    changes.length + deleteRefs.length > MAX_CHANGED_ROWS ||
    new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES
  ) {
    throw new MaterialApiError(
      "ข้อมูลที่แก้ไขเกินขนาดที่รองรับ (2,000 แถว หรือ 4 MiB) กรุณาลดจำนวนรายการก่อนบันทึก",
    );
  }
  const payload = await requestMaterialJson(
    MATERIAL_API,
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
    deleteRefs.length > 0 &&
    (!isRecord(payload) || payload.deleted !== deleteRefs.length)
  ) {
    throw new MaterialApiError(UNCERTAIN_SAVE, true);
  }
  const expected = rowsByRef(draft.rows);
  const actual = rowsByRef(snapshot.sheet.rows);
  if (
    expected.size !== actual.size ||
    [...expected].some(([key, signature]) => actual.get(key) !== signature)
  ) {
    throw new MaterialApiError(UNCERTAIN_SAVE, true);
  }
  return snapshot;
}

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
  const [savedSnapshot, setSavedSnapshot] = useState<MaterialSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<StockMaterialSheet>(() =>
    blankStockMaterialSheet(DEFAULT_STOCK_MATERIAL_FILTERS.period),
  );
  const [loadPeriod, setLoadPeriod] = useState<StockMaterialPeriod>(() => ({
    ...DEFAULT_STOCK_MATERIAL_FILTERS.period,
  }));
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const loadLock = useRef(true);
  const saveLock = useRef(false);
  const [filters, setFilters] = useState<StockMaterialFilterValues>(() =>
    copyFilters(DEFAULT_STOCK_MATERIAL_FILTERS),
  );
  const [selectedDailyRowRef, setSelectedDailyRowRef] =
    useState<StockMaterialRowRef | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteRefs, setDeleteRefs] = useState<StockMaterialRowRef[]>([]);
  const [confirmDeleteSaveOpen, setConfirmDeleteSaveOpen] = useState(false);
  const [pendingFilters, setPendingFilters] =
    useState<StockMaterialFilterValues | null>(null);
  const [errors, setErrors] = useState<StockMaterialValidationErrors>({});
  const [notice, setNotice] = useState<WorkspaceNotice | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const savedSheet = savedSnapshot?.sheet;
  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        savedSheet &&
        (deleteRefs.length > 0 ||
          JSON.stringify(draft.rows) !== JSON.stringify(savedSheet.rows)),
      ),
    [deleteRefs.length, draft.rows, savedSheet],
  );
  const busy = loadState.loading || isSaving;
  const readOnly =
    busy || Boolean(loadState.error) || refreshRequired || !savedSnapshot;
  const pendingDeletedRows = useMemo(() => {
    const deleting = new Set(deleteRefs);
    return (savedSheet?.rows ?? []).filter((row) =>
      deleting.has(stockMaterialRowRef(row)),
    );
  }, [deleteRefs, savedSheet]);
  const reloadPending =
    pendingFilters !== null &&
    stockMaterialPeriodKey(pendingFilters.period) ===
      stockMaterialPeriodKey(filters.period);
  const visibleRows = useMemo(() => {
    const filtered = filterStockMaterialRows(draft.rows, filters.search);
    // Show manually added materials first; preserve existing row order.
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

  useEffect(() => {
    const controller = new AbortController();
    void loadMaterialSheet(loadPeriod, controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setSavedSnapshot(snapshot);
        setDraft(structuredClone(snapshot.sheet));
        setDeleteRefs([]);
        setConfirmDeleteSaveOpen(false);
        setLoadState({ loading: false, error: "" });
        setRefreshRequired(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({
          loading: false,
          error:
            error instanceof MaterialApiError ? error.message : LOAD_FAILED,
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

  function openPeriod(nextFilters: StockMaterialFilterValues) {
    if (loadLock.current || saveLock.current) return;
    loadLock.current = true;
    setFilters(copyFilters(nextFilters));
    setDraft(blankStockMaterialSheet(nextFilters.period));
    setSavedSnapshot(null);
    setLoadState({ loading: true, error: "" });
    setRefreshRequired(false);
    setSelectedDailyRowRef(null);
    setIsCreateOpen(false);
    setPendingFilters(null);
    setDeleteRefs([]);
    setConfirmDeleteSaveOpen(false);
    setErrors({});
    setNotice(null);
    setLoadPeriod({ ...nextFilters.period });
  }

  function reloadSheet() {
    if (
      loadLock.current ||
      saveLock.current ||
      isCreateOpen ||
      confirmDeleteSaveOpen ||
      selectedDailyRow
    )
      return;
    if (hasUnsavedChanges) {
      setPendingFilters(copyFilters(filters));
      return;
    }
    openPeriod(filters);
  }

  function handleFiltersChange(nextFilters: StockMaterialFilterValues) {
    if (
      loadLock.current ||
      saveLock.current ||
      isCreateOpen ||
      pendingFilters ||
      confirmDeleteSaveOpen
    ) {
      return;
    }
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
    if (readOnly || loadLock.current || saveLock.current) return;
    setDraft((current) =>
      updateStockMaterialSummary(current, rowRef, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleRemarkChange(rowRef: StockMaterialRowRef, value: string) {
    if (readOnly || loadLock.current || saveLock.current) return;
    setDraft((current) => updateStockMaterialRemark(current, rowRef, value));
    setErrors({});
    setNotice(null);
  }

  function handleSafetyStockChange(rowRef: StockMaterialRowRef, value: string) {
    if (readOnly || loadLock.current || saveLock.current) return;
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
    if (readOnly || loadLock.current || saveLock.current) return;
    setDraft((current) =>
      updateStockMaterialDaily(current, rowRef, date, field, value),
    );
    setErrors({});
    setNotice(null);
  }

  function handleCreateMaterial(input: StockMaterialCreateInput): boolean {
    if (readOnly || loadLock.current || saveLock.current) return false;
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
          "ยอดสรุปรายเดือนเริ่มเป็นช่องว่างและยังแก้ไขได้ในตารางหลัก กรุณากดบันทึกข้อมูลเพื่อจัดเก็บลงฐานข้อมูล",
      });
      return true;
    } catch {
      // The form will keep its values and display an error.
      return false;
    }
  }

  function stageDeleteMaterial(rowRef: StockMaterialRowRef) {
    if (
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      !savedSheet ||
      pendingFilters ||
      confirmDeleteSaveOpen ||
      isCreateOpen
    ) {
      return;
    }
    if (!draft.rows.some((row) => stockMaterialRowRef(row) === rowRef)) return;

    const isSaved = savedSheet.rows.some(
      (row) => stockMaterialRowRef(row) === rowRef,
    );
    if (isSaved) {
      setDeleteRefs((current) =>
        current.includes(rowRef) ? current : [...current, rowRef],
      );
    }
    setDraft((current) => ({
      ...current,
      rows: current.rows.filter((row) => stockMaterialRowRef(row) !== rowRef),
    }));
    setSelectedDailyRowRef(null);
    setErrors({});
    setNotice({
      tone: "draft",
      text: isSaved
        ? "นำวัสดุออกจากฉบับร่างแล้ว ระบบจะลบข้อมูลถาวรเมื่อยืนยันการบันทึกเท่านั้น"
        : "นำวัสดุที่ยังไม่ได้บันทึกออกจากฉบับร่างแล้ว ไม่มีข้อมูลในฐานข้อมูลถูกลบ",
    });
  }

  function handleDiscard() {
    if (loadLock.current || saveLock.current || confirmDeleteSaveOpen) return;
    if (!savedSheet) {
      setNotice({
        tone: "error",
        text: "ไม่พบข้อมูลที่บันทึกไว้สำหรับเดือนนี้",
      });
      return;
    }

    setDraft(structuredClone(savedSheet));
    setDeleteRefs([]);
    setConfirmDeleteSaveOpen(false);
    setSelectedDailyRowRef(null);
    setIsCreateOpen(false);
    setErrors({});
    setNotice({
      tone: "info",
      text: "ยกเลิกการแก้ไขแล้ว ข้อมูลกลับไปเป็นฉบับล่าสุดที่โหลดจากฐานข้อมูล",
    });
  }

  async function handleSave(confirmHardDelete = false) {
    if (
      readOnly ||
      loadLock.current ||
      saveLock.current ||
      !savedSnapshot ||
      !hasUnsavedChanges ||
      isCreateOpen ||
      selectedDailyRow ||
      pendingFilters ||
      confirmDeleteSaveOpen !== confirmHardDelete
    )
      return;

    const nextErrors = validateStockMaterialSheet(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setNotice({
        tone: "error",
        text: "ยังบันทึกไม่ได้ กรุณาแก้ไขตัวเลขที่ผิดรูปแบบในตารางหลักหรือรายละเอียดรายวัน",
      });
      return;
    }

    if (deleteRefs.length > 0 && !confirmHardDelete) {
      setConfirmDeleteSaveOpen(true);
      return;
    }

    saveLock.current = true;
    setIsSaving(true);
    setConfirmDeleteSaveOpen(false);
    setNotice(null);
    try {
      const snapshot = await persistMaterialSheet(
        savedSnapshot,
        draft,
        deleteRefs,
        confirmHardDelete,
      );
      setSavedSnapshot(snapshot);
      setDraft(structuredClone(snapshot.sheet));
      setDeleteRefs([]);
      setErrors({});
      setNotice({
        tone: "success",
        text: deleteRefs.length > 0
          ? `บันทึกข้อมูลและลบวัสดุถาวร ${deleteRefs.length.toLocaleString("th-TH")} รายการ`
          : "บันทึกวัสดุ ยอดสรุป และรายละเอียดรายวันลงฐานข้อมูลเรียบร้อยแล้ว",
      });
    } catch (error) {
      if (!(error instanceof MaterialApiError) || error.reloadRequired) {
        setRefreshRequired(true);
      }
      setNotice({
        tone: "error",
        text:
          error instanceof MaterialApiError ? error.message : UNCERTAIN_SAVE,
      });
      // Keep both the draft and its original revision; never silently retry.
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  function confirmPeriodChange() {
    if (!pendingFilters || loadLock.current || saveLock.current) return;
    openPeriod(pendingFilters);
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="วัสดุคงเหลือ FF"
        description="รายการวัสดุและบรรจุภัณฑ์ตามรูปแบบไฟล์ วัสดุคงเหลือFF-2569.xlsx"
        actions={<><Badge variant="outline">ฐานข้อมูลจริง</Badge> {draft && (<Button
            type="button"
            variant="outline"
            disabled={readOnly}
            onClick={() => {
              if (!readOnly && !loadLock.current && !saveLock.current) {
                setIsCreateOpen(true);
              }
            }}
          >
            <PackagePlus className="size-4" aria-hidden="true" />
            เพิ่มวัสดุ
          </Button>)}</>}
      />

      <fieldset disabled={busy} className="min-w-0">
        <StockMaterialFilters
          value={filters}
          onChange={handleFiltersChange}
          onReset={() =>
            handleFiltersChange(copyFilters(DEFAULT_STOCK_MATERIAL_FILTERS))
          }
        />
      </fieldset>

      {loadState.loading && (
        <p
          role="status"
          className="rounded-lg border bg-card p-3 text-sm text-muted-foreground"
        >
          กำลังโหลดข้อมูลวัสดุจากฐานข้อมูล...
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
              ? "ฉบับร่างยังคงอยู่ในหน้านี้ กรุณาตรวจสอบหรือจดข้อมูลที่แก้ไขก่อนกดโหลดข้อมูลใหม่ "
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
            ชีต {draft.source_sheet_name} · แสดง{" "}
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
          {deleteRefs.length > 0 && (
            <p className="text-xs font-medium text-destructive" role="status">
              รอลบถาวรเมื่อบันทึก {deleteRefs.length.toLocaleString("th-TH")} รายการ
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || isCreateOpen || Boolean(selectedDailyRow)}
            onClick={reloadSheet}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            โหลดข้อมูลใหม่
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={busy || !hasUnsavedChanges}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={
              readOnly ||
              !hasUnsavedChanges ||
              isCreateOpen ||
              confirmDeleteSaveOpen ||
              Boolean(selectedDailyRow)
            }
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
          ) : notice.tone === "draft" ? (
            <PackagePlus className="size-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="size-4" aria-hidden="true" />
          )}
          <AlertTitle>
            {notice.tone === "success"
              ? "บันทึกสำเร็จ"
              : notice.tone === "error"
                ? "ต้องตรวจสอบข้อมูล"
                : notice.tone === "draft"
                  ? "ปรับปรุงฉบับร่างแล้ว"
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
        disabled={readOnly}
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
        onOpenChange={(open) => {
          if (!open || (!readOnly && !loadLock.current && !saveLock.current)) {
            setIsCreateOpen(open);
          }
        }}
        disabled={readOnly}
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
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 p-3">
                <p className="text-xs text-muted-foreground">
                  สามารถยกเลิกการแก้ไขเพื่อคืนข้อมูลได้ก่อนบันทึก
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={readOnly}
                  onClick={() =>
                    stageDeleteMaterial(stockMaterialRowRef(selectedDailyRow))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  นำวัสดุออกจากฉบับร่าง
                </Button>
              </div>
              <StockRemainingMaterialsFfDailyDetail
                sheet={draft}
                row={selectedDailyRow}
                disabled={readOnly}
                onChange={handleDailyChange}
                onNewChange={handleDailyChange}
                onClose={() => setSelectedDailyRowRef(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs leading-relaxed text-muted-foreground">
        ข้อมูลจากฐานข้อมูล · การเพิ่ม แก้ไข และลบอยู่ในฉบับร่างจนกว่าจะกดบันทึก ·
        รายการเดิมแยกด้วยเลขแถว Excel และรายการที่สร้างผ่านเว็บใช้ client_id ·
        เพิ่มวัสดุเฉพาะเดือนที่เลือก · ไม่คำนวณราคาหรือยอดคงเหลืออัตโนมัติ ·
        ไม่ได้นำเข้าข้อมูล Excel หรือ Mock โดยอัตโนมัติ
      </p>

      <AlertDialog
        open={confirmDeleteSaveOpen}
        onOpenChange={(open) => {
          if (!open && !saveLock.current) setConfirmDeleteSaveOpen(false);
        }}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันบันทึกและลบวัสดุถาวร</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะลบทะเบียนวัสดุ ยอดสรุป และข้อมูลรับ-จ่ายรายวันของรายการด้านล่างออกจากฐานข้อมูลในเดือนที่เลือก พร้อมบันทึกการเพิ่มและแก้ไขทั้งหมด การลบที่บันทึกสำเร็จแล้วไม่สามารถเรียกคืนจากหน้านี้ได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/25 p-3 text-sm">
            <p className="font-medium">
              {periodLabel(draft.period)} ({deleteRefs.length.toLocaleString("th-TH")} รายการ)
            </p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {pendingDeletedRows.map((row) => (
                <li
                  key={stockMaterialRowRef(row)}
                  className="border-b pb-2 wrap-break-word last:border-b-0 last:pb-0"
                >
                  {row.item.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {row.item.code ?? "-"} ·{" "}
                    {row.item.client_id ?? `Excel ${row.item.source_row}`}
                  </span>
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
                pendingDeletedRows.length !== deleteRefs.length ||
                deleteRefs.length === 0
              }
              onClick={() => {
                void handleSave(true);
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
              {reloadPending
                ? "การโหลดข้อมูลใหม่จะทิ้งฉบับร่างของเดือนนี้ กรุณาตรวจสอบข้อมูลก่อนดำเนินการ"
                : "การเปลี่ยนเดือนหรือปีจะทิ้งการแก้ไขของชีตปัจจุบัน หากต้องการเก็บข้อมูล กรุณากลับไปกดบันทึกก่อนเปลี่ยนช่วงเวลา"}
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
    </div>
  );
}
