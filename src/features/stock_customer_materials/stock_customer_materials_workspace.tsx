"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Boxes,
  CalendarDays,
  ClipboardCheck,
  Eye,
  Pencil,
  Plus,
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
import { stockCustomerMaterialsMockWorkbook } from "@/src/lib/mock-data/stock_customer_materials";

import { CustomerMaterialsForm } from "./stock_customer_materials_form";
import { CustomerMaterialsDailyForm } from "./stock_customer_materials_daily_form";
import { CustomerMaterialsCountForm } from "./stock_customer_materials_count_form";
import { CustomerMaterialsDetail } from "./stock_customer_materials_detail";
import {
  applyCustomerMaterialsSheetChanges,
  blankCustomerMaterialsRow,
  blankCustomerMaterialsStoredData,
  buildCustomerMaterialsSheetChanges,
  CUSTOMER_MATERIALS_DEFAULT_SHEET,
  CUSTOMER_MATERIALS_PERIODS,
  CUSTOMER_MATERIALS_SHEET_NAMES,
  CUSTOMER_MATERIALS_SO_SHEET_NAMES,
  CUSTOMER_MATERIALS_STORAGE_KEY,
  CUSTOMER_MATERIALS_SUMMARY_FIELDS,
  CUSTOMER_MATERIALS_SUMMARY_LABELS,
  customerMaterialsDaysInPeriod,
  customerMaterialsRowKey,
  filterCustomerMaterialsRows,
  isCustomerMaterialsSoSheetName,
  isCustomerMaterialsStoredData,
  removeCustomerMaterialsRow,
  replaceCustomerMaterialsRow,
  updateCustomerMaterialsCount,
  upsertCustomerMaterialsRow,
  validateCustomerMaterialsSheetCoverage,
  type CustomerMaterialsFormMode,
  type CustomerMaterialsRow,
  type CustomerMaterialsSheet,
  type CustomerMaterialsSheetName,
  type CustomerMaterialsSoFilter,
  type CustomerMaterialsStoredData,
  type CustomerMaterialsWorkbook,
} from "./stock_customer_materials_domain";

/* ---------------- configuration ---------------- */

const PAGE_SIZE = 25;
const STORAGE_EVENT = "ionflow:customer-materials:changed";
const STORAGE_UNAVAILABLE = Symbol("customer-materials-storage-unavailable");

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

/* ---------------- browser storage ---------------- */

type StorageSnapshot = string | null | typeof STORAGE_UNAVAILABLE;

interface StorageResult {
  workbook: CustomerMaterialsWorkbook;
  stored: CustomerMaterialsStoredData;
  error: string;
}

function subscribeStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getStorageSnapshot(): StorageSnapshot {
  try {
    return window.localStorage.getItem(CUSTOMER_MATERIALS_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

function getServerSnapshot(): null {
  return null;
}

function decodeStorage(snapshot: StorageSnapshot): StorageResult {
  const source = stockCustomerMaterialsMockWorkbook;
  const empty = blankCustomerMaterialsStoredData();
  const fallback = (error: string): StorageResult => ({
    workbook: source,
    stored: empty,
    error,
  });

  if (validateCustomerMaterialsSheetCoverage(source.sheets).length > 0) {
    return fallback(
      "ข้อมูลต้นฉบับมีชีตไม่ครบหรือชื่อชีตซ้ำ ระบบระงับการบันทึกไว้ก่อน",
    );
  }
  if (snapshot === STORAGE_UNAVAILABLE) {
    return fallback(
      "ไม่สามารถเข้าถึง Local Storage ได้ ขณะนี้แสดงข้อมูลต้นฉบับแบบอ่านอย่างเดียว",
    );
  }
  if (snapshot === null) {
    return { workbook: source, stored: empty, error: "" };
  }

  try {
    const stored: unknown = JSON.parse(snapshot);
    if (!isCustomerMaterialsStoredData(stored)) {
      throw new Error("Invalid stored data");
    }
    const workbook: CustomerMaterialsWorkbook = {
      sheets: source.sheets.map((sheet) =>
        applyCustomerMaterialsSheetChanges(sheet, stored.changes[sheet.name]),
      ),
    };
    return { workbook, stored, error: "" };
  } catch {
    // Never delete or replace malformed data automatically.
    return fallback(
      "ข้อมูลที่บันทึกใน Local Storage ไม่ถูกต้องหรือไม่ตรงกับต้นฉบับ ระบบแสดงข้อมูลต้นฉบับและระงับการบันทึกเพื่อรักษาข้อมูลเดิม",
    );
  }
}

/* ---------------- dialog state ---------------- */

interface EditorBase {
  row: CustomerMaterialsRow;
  snapshot: StorageSnapshot;
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
  | { kind: "DELETE"; row: CustomerMaterialsRow; snapshot: StorageSnapshot }
  | null;

function displayValue(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : value;
}

/* ---------------- workspace ---------------- */

export function StockCustomerMaterialsWorkspace() {
  const searchId = useId();
  const [selectedSheet, setSelectedSheet] =
    useState<CustomerMaterialsSheetName>(CUSTOMER_MATERIALS_DEFAULT_SHEET);
  const [selectedSo, setSelectedSo] =
    useState<CustomerMaterialsSoFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const snapshot = useSyncExternalStore(
    subscribeStorage,
    getStorageSnapshot,
    getServerSnapshot,
  );
  const {
    workbook,
    stored,
    error: storageError,
  } = useMemo(() => decodeStorage(snapshot), [snapshot]);
  const readOnly = storageError !== "";
  const sheet = workbook.sheets.find(
    (current) => current.name === selectedSheet,
  );
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

  function chooseSheet(value: string) {
    const name = CUSTOMER_MATERIALS_SHEET_NAMES.find(
      (candidate) => candidate === value,
    );
    if (name === undefined) return;
    clearFeedback();
    setSelectedSheet(name);
    setSearch("");
    setPage(1);
    setDialog(null);
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
    if (readOnly || !sheet) return;
    clearFeedback();
    try {
      const row = blankCustomerMaterialsRow(crypto.randomUUID(), sheet.name);
      setDialog({
        kind: "MATERIAL",
        mode: "CREATE",
        row,
        snapshot,
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
    if (readOnly) return;
    clearFeedback();
    setDialog({
      kind: "MATERIAL",
      mode: "EDIT",
      row,
      snapshot,
      returnToDetail,
    });
  }

  function openDailyEditor(row: CustomerMaterialsRow, day: number) {
    if (
      readOnly ||
      !customerMaterialsDaysInPeriod(row.sheet_name).includes(day)
    )
      return;
    clearFeedback();
    setDialog({ kind: "DAILY", row, day, snapshot, returnToDetail: true });
  }

  function openCountEditor(row: CustomerMaterialsRow, returnToDetail = false) {
    if (readOnly) return;
    clearFeedback();
    setDialog({ kind: "COUNT", row, snapshot, returnToDetail });
  }

  function openDelete(row: CustomerMaterialsRow) {
    if (readOnly) return;
    clearFeedback();
    setDialog({ kind: "DELETE", row, snapshot });
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

  /** Save only the changed rows/deletions for the selected sheet. */
  function commitSheet(
    nextSheet: CustomerMaterialsSheet,
    expectedSnapshot: StorageSnapshot,
  ) {
    if (storageError) throw new Error(storageError);
    if (
      nextSheet.name !== selectedSheet ||
      expectedSnapshot !== snapshot ||
      getStorageSnapshot() !== expectedSnapshot
    ) {
      throw new Error(
        "ข้อมูลมีการเปลี่ยนแปลง กรุณาปิดฟอร์มและเปิดใหม่ก่อนบันทึก",
      );
    }
    const source = stockCustomerMaterialsMockWorkbook.sheets.find(
      (current) => current.name === nextSheet.name,
    );
    if (!source) throw new Error("ไม่พบชีตข้อมูลต้นฉบับ");

    const sheetChanges = buildCustomerMaterialsSheetChanges(source, nextSheet);
    const changes = { ...stored.changes };
    if (
      sheetChanges.upserts.length === 0 &&
      sheetChanges.deleted_keys.length === 0
    ) {
      delete changes[nextSheet.name];
    } else {
      changes[nextSheet.name] = sheetChanges;
    }
    const nextStored: CustomerMaterialsStoredData = { ...stored, changes };
    const serialized = JSON.stringify(nextStored);
    if (!isCustomerMaterialsStoredData(nextStored)) {
      throw new Error("โครงสร้างข้อมูลไม่ถูกต้อง ไม่สามารถบันทึกได้");
    }
    // A failed setItem does not close the form or discard the previous data.
    window.localStorage.setItem(CUSTOMER_MATERIALS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_EVENT));
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
            ? "เพิ่มวัสดุเรียบร้อยแล้ว"
            : "แก้ไขวัสดุเรียบร้อยแล้ว";
      } else {
        if (!current) throw new Error("ไม่พบรายการวัสดุที่ต้องการบันทึก");
        // Dedicated editors may only modify their own group of fields.
        if (dialog.kind === "DAILY") {
          nextSheet = replaceCustomerMaterialsRow(sheet, {
            ...current,
            daily: row.daily,
          });
          message = "บันทึกรับ-จ่ายวัสดุเรียบร้อยแล้ว";
        } else {
          const counted = updateCustomerMaterialsCount(current, {
            physical_count: row.summary.physical_count,
            count_difference: row.summary.count_difference,
            remark: row.remark,
          });
          nextSheet = replaceCustomerMaterialsRow(sheet, counted);
          message = "บันทึกตรวจนับวัสดุเรียบร้อยแล้ว";
        }
      }

      commitSheet(nextSheet, dialog.snapshot);
      setNotice(message);
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
      commitSheet(removeCustomerMaterialsRow(sheet, key), dialog.snapshot);
      setDialog(null);
      setPage(currentPage);
      setNotice("ลบรายการวัสดุจากงวดที่เลือกเรียบร้อยแล้ว");
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
        actions={<Badge variant="outline">UI MOCK · Local Storage</Badge>}
      />

      {storageError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {storageError}
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
              {sheet?.report_caption || "ไม่พบข้อมูลชีต"}
            </p>
            {sheet?.period_caption && (
              <p className="text-xs text-muted-foreground">
                ข้อความงวดตาม Excel: {sheet.period_caption}
              </p>
            )}
          </div>
        </div>
        <Badge variant="secondary">
          {!storageError && stored.changes[selectedSheet]
            ? "ข้อมูลที่แก้ไขในเบราว์เซอร์"
            : "ข้อมูลต้นฉบับ"}
        </Badge>
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
            value: workbook.sheets.length,
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
                      {search.trim() || selectedSo !== "ALL"
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
          UI Mock: บันทึกเฉพาะข้อมูลที่เปลี่ยนในเบราว์เซอร์นี้ ไม่แก้ไข Excel
          ต้นฉบับ ไม่เชื่อมต่อ API หรือฐานข้อมูล และไม่คำนวณยอดข้ามเดือน
        </p>
      </section>

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
              ลบเฉพาะรายการวัสดุและข้อมูลรับ-จ่ายของงวดที่เลือก
              โดยไม่ลบข้อมูลในงวดอื่นหรือแก้ไข Excel ต้นฉบับ
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
