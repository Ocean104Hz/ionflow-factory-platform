"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { PageHeader, SelectField } from "@/src/components/factory/patterns";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import { CustomerMaterialsForm } from "./stock_customer_materials_form";
import { CustomerMaterialsDailyForm } from "./stock_customer_materials_daily_form";
import { CustomerMaterialsCountForm } from "./stock_customer_materials_count_form";
import { CustomerMaterialsDetail } from "./stock_customer_materials_detail";
import {
  blankCustomerMaterialsRow,
  buildCustomerMaterialsSaveRequest,
  CUSTOMER_MATERIALS_DEFAULT_SHEET,
  CUSTOMER_MATERIALS_PERIODS,
  CUSTOMER_MATERIALS_SHEET_NAMES,
  CUSTOMER_MATERIALS_SO_SHEET_NAMES,
  CUSTOMER_MATERIALS_SUMMARY_FIELDS,
  CUSTOMER_MATERIALS_SUMMARY_LABELS,
  customerMaterialsDaysInPeriod,
  customerMaterialsRowKey,
  filterCustomerMaterialsRows,
  isCustomerMaterialsSoSheetName,
  readCustomerMaterialsSaveResponse,
  readCustomerMaterialsSnapshot,
  removeCustomerMaterialsRow,
  replaceCustomerMaterialsRow,
  updateCustomerMaterialsCount,
  upsertCustomerMaterialsRow,
  type CustomerMaterialsFormMode,
  type CustomerMaterialsRow,
  type CustomerMaterialsSheet,
  type CustomerMaterialsSheetName,
  type CustomerMaterialsSoFilter,
  type CustomerMaterialsSnapshot,
} from "./stock_customer_materials_domain";

/* ---------------- configuration ---------------- */

const PAGE_SIZE = 25;
const STOCK_API = "/api/stock/customer-materials";
const CSRF_COOKIE = "ionflow_factory_csrf";
const MAX_CHANGED_ROWS = 2000;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

const SHEET_OPTIONS = CUSTOMER_MATERIALS_SHEET_NAMES.map((name) => ({
  value: name,
  label: `${CUSTOMER_MATERIALS_PERIODS[name].label} (${name})`,
}));

const SO_OPTIONS: { value: CustomerMaterialsSoFilter; label: string }[] = [
  { value: "ALL", label: "ทั้งหมด" },
  ...CUSTOMER_MATERIALS_SO_SHEET_NAMES.map((name) => ({
    value: name,
    label: name,
  })),
];

const ITEM_COLUMNS = [
  { field: "sales_customer", label: "ฝ่ายขาย / ลูกค้า" },
  { field: "material_type", label: "ประเภทวัสดุ" },
  { field: "code", label: "รหัสสินค้า" },
  { field: "no", label: "No." },
  { field: "description", label: "รายละเอียด" },
  { field: "unit", label: "หน่วยนับ" },
] as const;

/* ---------------- API and snapshot state ---------------- */

const LOAD_FAILED = "ไม่สามารถโหลดข้อมูลวัสดุคงเหลือลูกค้าจากฐานข้อมูลได้";
const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ";

class CustomerMaterialsApiError extends Error {
  constructor(message: string, readonly reloadRequired = false) {
    super(message);
    this.name = "CustomerMaterialsApiError";
  }
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
    // Never send a write request without the CSRF token.
  }
  throw new CustomerMaterialsApiError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token");
}

async function requestJson(
  url: string,
  init: RequestInit,
  writing = false,
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
    throw new CustomerMaterialsApiError(
      writing ? UNCERTAIN_SAVE : LOAD_FAILED,
      writing,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const reloadRequired = writing && (
      response.ok || response.status >= 500 ||
      response.status === 409 || response.status === 404 ||
      response.status === 401 || response.status === 403 ||
      !isRecord(payload) || payload.ok !== false
    );
    const message = response.status === 401 || response.status === 403
      ? "กรุณาตรวจสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน stock_customer_materials"
      : isRecord(payload) && typeof payload.message === "string" && payload.message
        ? payload.message
        : writing ? UNCERTAIN_SAVE : LOAD_FAILED;
    throw new CustomerMaterialsApiError(message, reloadRequired);
  }
  return payload;
}

async function loadSnapshot(
  name: CustomerMaterialsSheetName,
  signal: AbortSignal,
): Promise<CustomerMaterialsSnapshot> {
  const params = new URLSearchParams({ sheet_name: name });
  const payload = await requestJson(`${STOCK_API}?${params}`, { signal });
  return readCustomerMaterialsSnapshot(payload, name);
}

async function saveSnapshot(
  baseline: CustomerMaterialsSnapshot,
  draft: CustomerMaterialsSheet,
) {
  const request = buildCustomerMaterialsSaveRequest(baseline, draft);
  if (request.changes.length + request.deleted_refs.length > MAX_CHANGED_ROWS) {
    throw new CustomerMaterialsApiError("รายการเปลี่ยนแปลงเกิน 2,000 รายการต่อการบันทึก");
  }
  const body = JSON.stringify(request);
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    throw new CustomerMaterialsApiError("ข้อมูลที่บันทึกมีขนาดเกิน 4 MB");
  }
  const payload = await requestJson(STOCK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": getCsrfToken(),
    },
    body,
  }, true);
  try {
    return readCustomerMaterialsSaveResponse(payload, baseline.sheet.name);
  } catch {
    // A successful HTTP status alone cannot confirm the write result.
    throw new CustomerMaterialsApiError(UNCERTAIN_SAVE, true);
  }
}

interface LoadRequest {
  name: CustomerMaterialsSheetName;
}

interface LoadedSheet {
  request: LoadRequest;
  baseline: CustomerMaterialsSnapshot;
  draft: CustomerMaterialsSheet;
}

interface LoadFailure {
  request: LoadRequest;
  message: string;
}

/* ---------------- dialog state ---------------- */

interface EditorBase {
  row: CustomerMaterialsRow;
  snapshot: CustomerMaterialsSheet;
  returnToDetail: boolean;
}

type EditorState = EditorBase &
  (
    | { kind: "MATERIAL"; mode: CustomerMaterialsFormMode }
    | { kind: "DAILY"; day: number }
    | { kind: "COUNT" }
  );

type DialogState =
  | EditorState
  | { kind: "DETAIL"; key: string }
  | { kind: "DELETE"; row: CustomerMaterialsRow; snapshot: CustomerMaterialsSheet }
  | null;

function displayValue(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : value;
}

/* ---------------- workspace ---------------- */

export function StockCustomerMaterialsWorkspace() {
  const searchId = useId();
  const [loadRequest, setLoadRequest] = useState<LoadRequest>(() => ({
    name: CUSTOMER_MATERIALS_DEFAULT_SHEET,
  }));
  const selectedSheet = loadRequest.name;
  const [selectedSo, setSelectedSo] =
    useState<CustomerMaterialsSoFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const [loaded, setLoaded] = useState<LoadedSheet | null>(null);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadRequired, setReloadRequired] = useState(false);
  const [pendingLoad, setPendingLoad] = useState<LoadRequest | null>(null);
  const savingRef = useRef(false);

  // Object identity distinguishes repeated loads of the same sheet.
  const active = loaded?.request === loadRequest ? loaded : null;
  const displayed = loaded?.request.name === selectedSheet ? loaded : null;
  const sheet = displayed?.draft;
  const loadError = loadFailure?.request === loadRequest ? loadFailure.message : "";
  const isLoading = active === null && loadError === "";
  const readOnly = active === null || isSaving || reloadRequired;
  const hasUnsavedChanges = useMemo(
    () => displayed !== null &&
      displayed.draft !== displayed.baseline.sheet &&
      JSON.stringify(displayed.draft.rows) !== JSON.stringify(displayed.baseline.sheet.rows),
    [displayed],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadSnapshot(loadRequest.name, controller.signal)
      .then((baseline) => {
        if (controller.signal.aborted) return;
        setLoaded({ request: loadRequest, baseline, draft: baseline.sheet });
        setLoadFailure(null);
        setReloadRequired(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadFailure({
          request: loadRequest,
          message: error instanceof Error ? error.message : LOAD_FAILED,
        });
      });
    return () => controller.abort();
  }, [loadRequest]);

  useEffect(() => {
    if (!hasUnsavedChanges && !isSaving) return;
    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  const rows = useMemo(
    () =>
      sheet ? filterCustomerMaterialsRows(sheet.rows, search, selectedSo) : [],
    [sheet, search, selectedSo],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const dailyCount = useMemo(
    () => sheet?.rows.reduce((total, row) => total + row.daily.length, 0) ?? 0,
    [sheet],
  );
  const period = CUSTOMER_MATERIALS_PERIODS[selectedSheet];
  const detailRow =
    dialog?.kind === "DETAIL"
      ? sheet?.rows.find((row) => customerMaterialsRowKey(row) === dialog.key)
      : undefined;

  function clearFeedback() {
    setSaveError("");
    setNotice("");
  }

  function beginLoad(request: LoadRequest) {
    if (savingRef.current || dialog !== null) return;
    clearFeedback();
    setPendingLoad(null);
    if (request.name !== selectedSheet) {
      // An accepted period switch discards only the previous local draft.
      setLoaded(null);
      setReloadRequired(false);
      setSearch("");
      setPage(1);
    }
    setLoadRequest(request);
  }

  function requestLoad(name: CustomerMaterialsSheetName) {
    if (savingRef.current || dialog !== null || pendingLoad !== null) return;
    const request = { name };
    if (hasUnsavedChanges) {
      setPendingLoad(request);
      return;
    }
    beginLoad(request);
  }

  function chooseSheet(value: string) {
    const name = CUSTOMER_MATERIALS_SHEET_NAMES.find(
      (candidate) => candidate === value,
    );
    if (name === undefined || name === selectedSheet) return;
    requestLoad(name);
  }

  function handleReload() {
    if (isLoading) return;
    requestLoad(selectedSheet);
  }

  function handleDiscard() {
    if (!active || savingRef.current || dialog !== null || pendingLoad !== null || !hasUnsavedChanges) return;
    setLoaded({ ...active, draft: active.baseline.sheet });
    setSaveError("");
    setNotice("ยกเลิกการแก้ไขแล้ว คืนค่าจากข้อมูลที่โหลดหรือบันทึกสำเร็จล่าสุด");
  }

  async function handleSave() {
    if (!active || readOnly || savingRef.current || dialog !== null || pendingLoad !== null || !hasUnsavedChanges) return;
    clearFeedback();
    savingRef.current = true;
    setIsSaving(true);
    try {
      const saved = await saveSnapshot(active.baseline, active.draft);
      const baseline: CustomerMaterialsSnapshot = {
        sheet: saved.sheet,
        revision: saved.revision,
      };
      setLoaded({ request: active.request, baseline, draft: baseline.sheet });
      setNotice(
        `บันทึกลงฐานข้อมูลสำเร็จ · เพิ่ม ${saved.inserted} · แก้ไข ${saved.updated} · ลบ ${saved.deleted} รายการ`,
      );
    } catch (error) {
      if (error instanceof CustomerMaterialsApiError && error.reloadRequired) {
        setReloadRequired(true);
      }
      setSaveError(error instanceof Error ? error.message : UNCERTAIN_SAVE);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  function chooseSo(value: string) {
    if (
      value !== "ALL" &&
      value !== "UNASSIGNED" &&
      !isCustomerMaterialsSoSheetName(value)
    ) {
      return;
    }
    clearFeedback();
    setSelectedSo(value);
    setPage(1);
  }

  function openCreate() {
    if (readOnly || !sheet || savingRef.current) return;
    clearFeedback();
    try {
      const row = blankCustomerMaterialsRow(crypto.randomUUID(), sheet.name);
      setDialog({
        kind: "MATERIAL",
        mode: "CREATE",
        row,
        snapshot: sheet,
        returnToDetail: false,
      });
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "ไม่สามารถสร้างรหัสรายการใหม่ได้",
      );
    }
  }

  function openMaterialEditor(
    row: CustomerMaterialsRow,
    returnToDetail = false,
  ) {
    if (readOnly || !sheet || savingRef.current) return;
    clearFeedback();
    setDialog({
      kind: "MATERIAL",
      mode: "EDIT",
      row,
      snapshot: sheet,
      returnToDetail,
    });
  }

  function openDailyEditor(row: CustomerMaterialsRow, day: number) {
    if (
      readOnly || !sheet || savingRef.current ||
      !customerMaterialsDaysInPeriod(row.sheet_name).includes(day)
    )
      return;
    clearFeedback();
    setDialog({ kind: "DAILY", row, day, snapshot: sheet, returnToDetail: true });
  }

  function openCountEditor(row: CustomerMaterialsRow, returnToDetail = false) {
    if (readOnly || !sheet || savingRef.current) return;
    clearFeedback();
    setDialog({ kind: "COUNT", row, snapshot: sheet, returnToDetail });
  }

  function openDelete(row: CustomerMaterialsRow) {
    if (readOnly || !sheet || savingRef.current) return;
    clearFeedback();
    setDialog({ kind: "DELETE", row, snapshot: sheet });
  }

  function closeEditor() {
    setSaveError("");
    if (
      dialog &&
      (dialog.kind === "MATERIAL" ||
        dialog.kind === "DAILY" ||
        dialog.kind === "COUNT") &&
      dialog.returnToDetail
    ) {
      setDialog({ kind: "DETAIL", key: customerMaterialsRowKey(dialog.row) });
    } else {
      setDialog(null);
    }
  }

  /** Stage changes only. The main Save button is the sole write entry point. */
  function stageSheet(
    nextSheet: CustomerMaterialsSheet,
    expectedSnapshot: CustomerMaterialsSheet,
  ) {
    if (readOnly || !active || savingRef.current) {
      throw new Error("ระบบยังไม่พร้อมแก้ไขข้อมูล กรุณาโหลดข้อมูลใหม่");
    }
    if (nextSheet.name !== selectedSheet || active.draft !== expectedSnapshot) {
      throw new Error("ข้อมูลมีการเปลี่ยนแปลง กรุณาปิดฟอร์มและเปิดใหม่ก่อนบันทึก");
    }
    setLoaded({ ...active, draft: nextSheet });
  }

  function saveEditor(row: CustomerMaterialsRow) {
    if (
      !sheet ||
      !dialog ||
      (dialog.kind !== "MATERIAL" &&
        dialog.kind !== "DAILY" &&
        dialog.kind !== "COUNT")
    )
      return;
    clearFeedback();
    try {
      const key = customerMaterialsRowKey(row);
      if (
        row.sheet_name !== selectedSheet ||
        key !== customerMaterialsRowKey(dialog.row)
      ) {
        throw new Error("รายการวัสดุไม่ตรงกับฟอร์มที่เปิดอยู่");
      }
      const current = sheet.rows.find(
        (existing) => customerMaterialsRowKey(existing) === key,
      );
      let nextSheet: CustomerMaterialsSheet;
      let message: string;

      if (dialog.kind === "MATERIAL") {
        nextSheet = upsertCustomerMaterialsRow(sheet, row, dialog.mode);
        message =
          dialog.mode === "CREATE"
            ? "เพิ่มวัสดุลงฉบับร่างแล้ว"
            : "แก้ไขวัสดุในฉบับร่างแล้ว";
      } else {
        if (!current) throw new Error("ไม่พบรายการวัสดุที่ต้องการบันทึก");
        // Dedicated editors may only modify their own group of fields.
        if (dialog.kind === "DAILY") {
          nextSheet = replaceCustomerMaterialsRow(sheet, {
            ...current,
            daily: row.daily,
          });
          message = "บันทึกรับ-จ่ายวัสดุลงฉบับร่างแล้ว";
        } else {
          const counted = updateCustomerMaterialsCount(current, {
            physical_count: row.summary.physical_count,
            count_difference: row.summary.count_difference,
            remark: row.remark,
          });
          nextSheet = replaceCustomerMaterialsRow(sheet, counted);
          message = "บันทึกตรวจนับวัสดุลงฉบับร่างแล้ว";
        }
      }

      stageSheet(nextSheet, dialog.snapshot);
      setNotice(`${message} กรุณากดบันทึกข้อมูลจากหน้าหลักเพื่อจัดเก็บลงฐานข้อมูล`);
      if (dialog.kind === "MATERIAL") {
        setSearch("");
        // Locate the saved row within the filtered table, not the full sheet.
        let matchingRows = filterCustomerMaterialsRows(
          nextSheet.rows,
          "",
          selectedSo,
        );
        let index = matchingRows.findIndex(
          (existing) => customerMaterialsRowKey(existing) === key,
        );
        if (index === -1) {
          // A newly created/reassigned row can be outside the selected SO.
          // Show all groups so the saved item remains visible.
          setSelectedSo("ALL");
          matchingRows = filterCustomerMaterialsRows(nextSheet.rows, "", "ALL");
          index = matchingRows.findIndex(
            (existing) => customerMaterialsRowKey(existing) === key,
          );
        }
        setPage(Math.max(1, Math.floor(index / PAGE_SIZE) + 1));
      }
      closeEditor();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
      );
    }
  }

  function confirmDelete() {
    if (!sheet || dialog?.kind !== "DELETE") return;
    clearFeedback();
    try {
      const key = customerMaterialsRowKey(dialog.row);
      if (!sheet.rows.some((row) => customerMaterialsRowKey(row) === key)) {
        throw new Error("ไม่พบรายการวัสดุที่ต้องการลบ");
      }
      stageSheet(removeCustomerMaterialsRow(sheet, key), dialog.snapshot);
      setDialog(null);
      setPage(currentPage);
      setNotice("นำรายการวัสดุออกจากฉบับร่างแล้ว ฐานข้อมูลจะเปลี่ยนเมื่อกดบันทึกข้อมูลจากหน้าหลัก");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "ไม่สามารถลบข้อมูลได้",
      );
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="วัสดุคงเหลือลูกค้า"
        description="จัดการวัสดุของลูกค้า ยอดสรุป รับ-จ่ายรายวัน และตรวจนับ แยกตามงวดข้อมูล"
        actions={<Badge variant="outline">ฐานข้อมูล</Badge>}
      />

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {loadError}
        </p>
      )}
      {reloadRequired && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          ระบบยังไม่ยืนยันสถานะการบันทึกหรือข้อมูลมีการเปลี่ยนแปลง
          ฉบับร่างยังอยู่ กรุณาตรวจสอบข้อมูลและโหลดข้อมูลใหม่ก่อนบันทึกอีกครั้ง
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}
      {saveError && (
        <p
          role="alert"
          className="fixed right-4 bottom-4 z-1000 max-w-[calc(100vw-2rem)] rounded-lg border border-destructive/30 bg-background p-4 text-sm text-destructive shadow-lg sm:max-w-sm"
        >
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Boxes className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">
              {period.label} ({selectedSheet})
            </p>
            <p className="text-xs text-muted-foreground">
              {sheet?.report_caption || (isLoading ? "กำลังโหลดข้อมูล..." : "ยังไม่ได้โหลดข้อมูล")}
            </p>
            {sheet?.period_caption && (
              <p className="text-xs text-muted-foreground">
                ข้อความงวดตาม Excel: {sheet.period_caption}
              </p>
            )}
          </div>
        </div>
        <Badge variant="secondary">
          {isSaving ? "กำลังบันทึก" : isLoading ? "กำลังโหลด" :
            loadError || reloadRequired ? "ต้องโหลดข้อมูลใหม่" :
              hasUnsavedChanges ? "มีการแก้ไขที่ยังไม่ได้บันทึก" : "ข้อมูลที่บันทึกแล้ว"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          เพิ่ม แก้ไข รับ-จ่าย ตรวจนับ และลบในฉบับร่างก่อน
          แล้วกดบันทึกข้อมูลเพื่อจัดเก็บลงฐานข้อมูลพร้อมกัน
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isSaving || dialog !== null || pendingLoad !== null}
            onClick={handleReload}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> โหลดข้อมูลใหม่
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!active || !hasUnsavedChanges || isSaving || dialog !== null || pendingLoad !== null}
            onClick={handleDiscard}
          >
            <RotateCcw className="size-4" aria-hidden="true" /> ยกเลิกการแก้ไข
          </Button>
          <Button
            type="button"
            disabled={readOnly || !hasUnsavedChanges || dialog !== null || pendingLoad !== null}
            onClick={handleSave}
          >
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            label: "รายการวัสดุในงวด",
            value: sheet?.rows.length ?? 0,
            Icon: Boxes,
          },
          {
            label: "บันทึกรับ-จ่ายรายวัน",
            value: dailyCount,
            Icon: CalendarDays,
          },
          {
            label: "งวดข้อมูลทั้งหมด",
            value: CUSTOMER_MATERIALS_SHEET_NAMES.length,
            Icon: ClipboardCheck,
          },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <p className="text-xs font-medium">{label}</p>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {value.toLocaleString("th-TH")}
            </p>
          </div>
        ))}
      </div>

      <section
        aria-label="ตารางวัสดุคงเหลือลูกค้า"
        className="min-w-0 space-y-4"
      >
        <div className="grid items-end gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
          <SelectField
            label="เลือกงวดข้อมูล"
            value={selectedSheet}
            onChange={chooseSheet}
            options={SHEET_OPTIONS}
            disabled={isSaving || dialog !== null || pendingLoad !== null}
          />
          <SelectField
            label="เลือกกลุ่ม SO"
            value={selectedSo}
            onChange={chooseSo}
            options={SO_OPTIONS}
          />
          <div className="min-w-0 space-y-2">
            <Label htmlFor={searchId}>ค้นหาวัสดุ</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchId}
                type="search"
                autoComplete="off"
                className="pl-9"
                value={search}
                placeholder="ค้นหา SO ลูกค้า รหัสสินค้า รายละเอียด หรือประเภท"
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={readOnly || !sheet}
            onClick={openCreate}
            className="w-full xl:w-auto"
          >
            <Plus className="size-4" aria-hidden="true" /> เพิ่มวัสดุ
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
            <h2 className="font-semibold">รายการวัสดุคงเหลือ</h2>
            <p className="text-xs text-muted-foreground">
              ทุกยอดแสดงตามที่บันทึกไว้ ไม่คำนวณหรือยกยอดอัตโนมัติ
            </p>
          </div>
          <div
            className="max-h-[65dvh] overflow-auto"
            tabIndex={0}
            role="region"
            aria-label="ตารางวัสดุแบบเลื่อนแนวนอนและแนวตั้ง"
          >
            <Table className="min-w-[2000px] text-xs">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  {ITEM_COLUMNS.map(({ field, label }) => (
                    <TableHead
                      key={field}
                      className={
                        field === "description" ? "min-w-72" : "min-w-24"
                      }
                    >
                      {label}
                    </TableHead>
                  ))}
                  {CUSTOMER_MATERIALS_SUMMARY_FIELDS.map((field) => (
                    <TableHead key={field} className="min-w-24 text-right">
                      {CUSTOMER_MATERIALS_SUMMARY_LABELS[field]}
                    </TableHead>
                  ))}
                  <TableHead className="min-w-40">หมายเหตุ</TableHead>
                  <TableHead className="min-w-44 text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={
                        ITEM_COLUMNS.length +
                        CUSTOMER_MATERIALS_SUMMARY_FIELDS.length +
                        2
                      }
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      {!sheet
                        ? isLoading ? "กำลังโหลดข้อมูลจากฐานข้อมูล..." : "ยังไม่สามารถแสดงข้อมูลได้ กรุณาโหลดข้อมูลใหม่"
                        : search.trim() || selectedSo !== "ALL"
                          ? "ไม่พบวัสดุที่ตรงกับตัวกรอง"
                          : "ยังไม่มีรายการวัสดุในงวดนี้"}
                    </TableCell>
                  </TableRow>
                )}
                {visibleRows.map((row) => {
                  const key = customerMaterialsRowKey(row);
                  const name = row.item.description || "วัสดุไม่มีรายละเอียด";
                  return (
                    <TableRow key={key}>
                      {ITEM_COLUMNS.map(({ field }) => (
                        <TableCell
                          key={field}
                          className={
                            field === "description"
                              ? "max-w-96 whitespace-normal wrap-break-word font-medium"
                              : "max-w-48 whitespace-normal wrap-break-word"
                          }
                        >
                          {displayValue(row.item[field])}
                        </TableCell>
                      ))}
                      {CUSTOMER_MATERIALS_SUMMARY_FIELDS.map((field) => (
                        <TableCell
                          key={field}
                          className={
                            field === "remaining_quantity"
                              ? "max-w-40 whitespace-normal wrap-break-word text-right font-semibold tabular-nums"
                              : "max-w-40 whitespace-normal wrap-break-word text-right tabular-nums"
                          }
                        >
                          {displayValue(row.summary[field])}
                        </TableCell>
                      ))}
                      <TableCell className="max-w-56 whitespace-pre-wrap wrap-break-word">
                        {displayValue(row.remark)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`ดูรายละเอียด ${name}`}
                            title="ดูรายละเอียดและรับ-จ่ายรายวัน"
                            onClick={() => {
                              clearFeedback();
                              setDialog({ kind: "DETAIL", key });
                            }}
                          >
                            <Eye className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={readOnly}
                            aria-label={`แก้ไข ${name}`}
                            title="แก้ไขวัสดุ"
                            onClick={() => openMaterialEditor(row)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={readOnly}
                            aria-label={`ตรวจนับ ${name}`}
                            title="บันทึกตรวจนับ"
                            onClick={() => openCountEditor(row)}
                          >
                            <ClipboardCheck
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={readOnly}
                            aria-label={`ลบ ${name}`}
                            title="ลบวัสดุ"
                            className="text-destructive"
                            onClick={() => openDelete(row)}
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <p className="text-muted-foreground">
              แสดง {rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, rows.length)} จาก{" "}
              {rows.length.toLocaleString("th-TH")} รายการ
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                ก่อนหน้า
              </Button>
              <span className="min-w-18 text-center tabular-nums">
                หน้า {currentPage}/{pageCount}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={currentPage >= pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          ข้อมูลจะถูกจัดเก็บลงฐานข้อมูลเมื่อกดบันทึกจากหน้าหลักเท่านั้น
          ไม่แก้ไข Excel ต้นฉบับ และไม่คำนวณยอดข้ามเดือนอัตโนมัติ
        </p>
      </section>

      {pendingLoad && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingLoad(null);
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</DialogTitle>
            <DialogDescription>
              {pendingLoad.name === selectedSheet
                ? "การโหลดข้อมูลใหม่สำเร็จจะแทนที่ฉบับร่างปัจจุบัน หากต้องการเก็บฉบับร่าง กรุณากลับไปตรวจสอบก่อน"
                : "การเปลี่ยนงวดจะทิ้งฉบับร่างของงวดปัจจุบันโดยไม่บันทึกลงฐานข้อมูล"}
            </DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPendingLoad(null)}>
                กลับไปตรวจสอบ
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isSaving}
                onClick={() => beginLoad(pendingLoad)}
              >
                {pendingLoad.name === selectedSheet ? "โหลดข้อมูลใหม่" : "ทิ้งฉบับร่างและเปลี่ยนงวด"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {detailRow && (
        <CustomerMaterialsDetail
          row={detailRow}
          readOnly={readOnly}
          onEditMaterial={() => openMaterialEditor(detailRow, true)}
          onEditDaily={(day) => openDailyEditor(detailRow, day)}
          onEditCount={() => openCountEditor(detailRow, true)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "MATERIAL" && (
        <CustomerMaterialsForm
          row={dialog.row}
          mode={dialog.mode}
          onSave={saveEditor}
          onCancel={closeEditor}
        />
      )}
      {dialog?.kind === "DAILY" && (
        <CustomerMaterialsDailyForm
          row={dialog.row}
          initialDay={dialog.day}
          onSave={saveEditor}
          onCancel={closeEditor}
        />
      )}
      {dialog?.kind === "COUNT" && (
        <CustomerMaterialsCountForm
          row={dialog.row}
          onSave={saveEditor}
          onCancel={closeEditor}
        />
      )}
      {dialog?.kind === "DELETE" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeEditor();
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogTitle>ยืนยันการลบวัสดุ</DialogTitle>
            <DialogDescription>
              นำรายการวัสดุและข้อมูลรับ-จ่ายของงวดที่เลือกออกจากฉบับร่าง
              เมื่อกดบันทึกจากหน้าหลัก ระบบจะยกเลิกเอกสารแบบ Soft Delete
              โดยไม่กระทบงวดอื่นหรือ Excel ต้นฉบับ
            </DialogDescription>
            <div className="space-y-1 rounded-lg border border-border bg-muted/25 p-4">
              <p className="wrap-break-word font-semibold">
                {displayValue(dialog.row.item.description)}
              </p>
              <p className="text-xs text-muted-foreground">
                {CUSTOMER_MATERIALS_PERIODS[dialog.row.sheet_name].label} ·
                รหัสสินค้า: {displayValue(dialog.row.item.code)} · รับ-จ่าย{" "}
                {dialog.row.daily.length} วัน
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEditor}>
                ยกเลิก
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/30 text-destructive"
                disabled={readOnly}
                onClick={confirmDelete}
              >
                ยืนยันการลบ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
