"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Boxes,
  CalendarDays,
  ClipboardList,
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
import { stockProductsMockWorkbook } from "@/src/lib/mock-data/stock_products";

import { StockProductsForm } from "./stock_products_form";
import { StockProductsDailyForm } from "./stock_products_daily_form";
import { StockProductsSoForm } from "./stock_products_so_form";

import {
  appendStockProductsSoForStock,
  blankStockProductsRow,
  datesInStockProductsMonth,
  filterStockProductsRows,
  filterStockProductsSoRows,
  isValidStockProductsAddedDate,
  removeStockProductsRow,
  stockProductsRowKey,
  stockProductsSoRowKey,
  upsertStockProductsRow,
  validateStockProductsRow,
  validateStockProductsSoSheetCoverage,
  STOCK_PRODUCTS_DAILY_FIELDS,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  STOCK_PRODUCTS_STORAGE_KEY,
  STOCK_PRODUCTS_STORAGE_VERSION,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  type StockProductsDailyField,
  type StockProductsDailyValues,
  type StockProductsMonth,
  type StockProductsSoRow,
  type StockProductsSoSheetName,
  type StockProductsStoredData,
  type StockProductsWorkbook,
  type StockProductsStockRow,
  type StockProductsSummaryField,
} from "./stock_products_domain";

/**
 * Editable FF stock UI mock, with browser-local persistence.
 * The imported snapshot stays unchanged. Daily entries and SO records do not
 * automatically recalculate or deduct stock. No API or database is used.
 */

const COPY = {
  title: "สต็อกสินค้า",
  desc: "จัดการสต็อกสินค้า รับ-จ่ายรายวัน และรายการ SO ทั้ง 16 ชีต",
  storage: "UI MOCK · Local Storage",
  source: "ข้อมูลต้นฉบับ",
  stock: "สต็อกสินค้าคงเหลือ",
  so: "รายการ SO",
  productCount: "รายการสินค้า",
  dailyCount: "รายการรับ-จ่ายรายวัน",
  soCount: "บรรทัดรายการ SO",
  soSheets: "ชีต SO",
  stockSearch: "ค้นหาสินค้า",
  stockPlaceholder: "ค้นหารหัสสินค้า ชื่อ หรือประเภท",
  soSearch: "ค้นหารายการ SO",
  soPlaceholder: "ชื่อลูกค้า เลข SO หรือชื่อสินค้า",
  pickSheet: "เลือกชีต SO",
  allSheets: "ทุกชีต",
  noStock: "ไม่พบรายการสินค้าที่ตรงกับการค้นหา",
  noSo: "ไม่พบรายการ SO ในชีตหรือตัวกรองที่เลือก",
  dailyButton: "ดูรายวัน",
  dailyTitle: "รายละเอียดรับ-จ่ายรายวัน",
  dateRaw: "วันที่ต้นฉบับ",
  totalF: "ยอด (F)",
  received: "รับเข้า",
  receivedReturn: "รับคืน",
  issuedCustomer: "จ่ายลูกค้า",
  promotion: "ส่งเสริมฯ",
  office: "ตัวอย่าง",
  other: "จ่ายอื่น",
  damaged: "ชำรุด",
  remaining: "คงเหลือ",
  count: "ตรวจนับ",
  difference: "ผลต่าง",
  remark: "หมายเหตุ",
  group: "ประเภท",
  code: "รหัสสินค้า",
  productName: "ชื่อสินค้า",
  unit: "หน่วย",
  soNumber: "เลข SO",
  customer: "ลูกค้า",
  quantity: "จำนวน",
  empty: "ไม่มีข้อมูล",
  showing: "แสดง",
  from: "จาก",
  page: "หน้า",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  close: "ปิด",
  date: "วันที่",
  period: "ประจำเดือน",
  summary: "ยอดสรุปตาม Excel",
  stockHint: "ยอดสรุปแสดงตามข้อมูลที่บันทึก โดยไม่คำนวณอัตโนมัติ",
  soHint: "รายการ SO ไม่หักยอดสต็อกอัตโนมัติ",
  mockHint: "ข้อมูลทดลองจัดเก็บในเบราว์เซอร์ ไม่มี API หรือฐานข้อมูลจริง",
  dateHint: "วันที่ SO แสดงค่าดิบจาก Excel อาจเป็นตัวเลข ไม่แปลงโดยการเดา",
  dailyHint: "แสดงครบทุกวันในเดือน รวมวันที่ไม่มีการเคลื่อนไหว",
  stockDetail: "ข้อมูลสินค้า",
  dailyRows: "วันที่มีรายการ",
} as const;

const STOCK_COLUMNS = [
  { field: "balance_quantity", label: COPY.totalF },
  { field: "received_in", label: COPY.received },
  { field: "received_return", label: COPY.receivedReturn },
  { field: "issued_customer", label: COPY.issuedCustomer },
  { field: "issued_promotion", label: COPY.promotion },
  { field: "issued_office_sample", label: COPY.office },
  { field: "issued_other", label: COPY.other },
  { field: "damaged", label: COPY.damaged },
  { field: "remaining_quantity", label: COPY.remaining },
  { field: "physical_count", label: COPY.count },
  { field: "count_difference", label: COPY.difference },
] as const satisfies readonly {
  field: StockProductsSummaryField;
  label: string;
}[];

const DAILY_COLUMNS = [
  { field: "received_in", label: COPY.received },
  { field: "received_return", label: COPY.receivedReturn },
  { field: "issued_customer", label: COPY.issuedCustomer },
  { field: "issued_promotion", label: COPY.promotion },
  { field: "issued_office_sample", label: COPY.office },
  { field: "issued_other", label: COPY.other },
  { field: "damaged", label: COPY.damaged },
] as const satisfies readonly {
  field: StockProductsDailyField;
  label: string;
}[];

const SO_SHEET_OPTIONS = [
  { value: "ALL", label: COPY.allSheets },
  ...STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => ({
    value: name,
    label: name,
  })),
];

const PAGE_SIZE = 25;
const STORAGE_EVENT = "ionflow:stock-products:changed";
const STORAGE_UNAVAILABLE = "__STOCK_PRODUCTS_STORAGE_UNAVAILABLE__";
const QUANTITY_CLASSES = "whitespace-nowrap text-right tabular-nums";

function originalCell(value: string | number | boolean | null): string {
  return value === null || value === "" ? "-" : String(value);
}

function monthLabel(yearBe: number, month: number): string {
  const monthName = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(yearBe - 543, month - 1, 1)));
  return `${monthName} ${yearBe}`;
}

type StockEditor = {
  mode: "CREATE" | "EDIT";
  row: StockProductsStockRow;
  snapshot: string | null;
};

type DailyEditor = {
  row: StockProductsStockRow;
  date: string;
  snapshot: string | null;
};

type SoEditor = {
  id: string;
  sheet: StockProductsSoSheetName;
  snapshot: string | null;
};

type DeleteTarget = {
  row: StockProductsStockRow;
  snapshot: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isOptionalId(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length > 0);
}

function hasStringFields(value: unknown, fields: readonly string[]): boolean {
  return (
    isRecord(value) && fields.every((field) => typeof value[field] === "string")
  );
}

function isStockRow(value: unknown): value is StockProductsStockRow {
  if (!isRecord(value) || !isRecord(value.item)) return false;
  const item = value.item;

  return (
    isOptionalId(item.id) &&
    (item.so_row_id === null || isOptionalId(item.so_row_id)) &&
    (item.added_date === undefined ||
      item.added_date === null ||
      item.added_date === "" ||
      (typeof item.added_date === "string" &&
        isValidStockProductsAddedDate(item.added_date))) &&
    typeof item.source_row === "number" &&
    Number.isInteger(item.source_row) &&
    (item.no === null ||
      (typeof item.no === "number" && Number.isFinite(item.no))) &&
    isNullableString(item.group) &&
    isNullableString(item.code) &&
    typeof item.name === "string" &&
    isNullableString(item.unit) &&
    typeof value.remark === "string" &&
    hasStringFields(value.summary, STOCK_PRODUCTS_SUMMARY_FIELDS) &&
    Array.isArray(value.daily) &&
    value.daily.every(
      (entry: unknown) =>
        isRecord(entry) &&
        typeof entry.date === "string" &&
        hasStringFields(entry.values, STOCK_PRODUCTS_DAILY_FIELDS),
    )
  );
}

function isSoRow(value: unknown): value is StockProductsSoRow {
  if (!isRecord(value)) return false;

  return (
    isOptionalId(value.id) &&
    isOptionalId(value.stock_row_key) &&
    STOCK_PRODUCTS_SO_SHEET_NAMES.some((name) => name === value.sheet_name) &&
    typeof value.source_row === "number" &&
    Number.isInteger(value.source_row) &&
    (isNullableString(value.date_raw) ||
      (typeof value.date_raw === "number" &&
        Number.isFinite(value.date_raw))) &&
    hasStringFields(value, [
      "customer_name",
      "so_number",
      "product_name",
      "quantity",
      "unit",
    ]) &&
    Array.isArray(value.supplementary_cells) &&
    value.supplementary_cells.every(
      (cell: unknown) =>
        isNullableString(cell) ||
        typeof cell === "boolean" ||
        (typeof cell === "number" && Number.isFinite(cell)),
    )
  );
}

function isWorkbook(value: unknown): value is StockProductsWorkbook {
  if (!isRecord(value) || !isRecord(value.stock)) return false;
  const stock = value.stock;
  const period = stock.period;

  if (
    !isRecord(period) ||
    typeof period.year_be !== "number" ||
    !Number.isInteger(period.year_be) ||
    period.year_be <= 543 ||
    typeof period.month !== "number" ||
    !Number.isInteger(period.month) ||
    period.month < 1 ||
    period.month > 12 ||
    typeof stock.source_sheet_name !== "string" ||
    typeof stock.report_caption !== "string" ||
    !Array.isArray(stock.rows) ||
    !stock.rows.every(isStockRow) ||
    !Array.isArray(value.so_sheets)
  ) {
    return false;
  }

  return value.so_sheets.every(
    (sheet: unknown) =>
      isRecord(sheet) &&
      STOCK_PRODUCTS_SO_SHEET_NAMES.some((name) => name === sheet.name) &&
      Array.isArray(sheet.rows) &&
      sheet.rows.every(
        (row: unknown) => isSoRow(row) && row.sheet_name === sheet.name,
      ),
  );
}

function subscribeStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

function getStorageSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STOCK_PRODUCTS_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

function getServerSnapshot(): null {
  return null;
}

function decodeWorkbook(raw: string | null): {
  workbook: StockProductsWorkbook;
  error: string;
} {
  if (raw === null) {
    return { workbook: stockProductsMockWorkbook, error: "" };
  }

  if (raw === STORAGE_UNAVAILABLE) {
    return {
      workbook: stockProductsMockWorkbook,
      error: "ไม่สามารถเข้าถึง Local Storage ของเบราว์เซอร์ได้",
    };
  }

  try {
    const data: unknown = JSON.parse(raw);

    if (
      !isRecord(data) ||
      data.version !== STOCK_PRODUCTS_STORAGE_VERSION ||
      !isWorkbook(data.workbook)
    ) {
      throw new Error("Invalid stored workbook");
    }

    const workbook = data.workbook;
    const stockKeys = workbook.stock.rows.map(stockProductsRowKey);
    const soKeys = workbook.so_sheets.flatMap((sheet) =>
      sheet.rows.map(stockProductsSoRowKey),
    );
    const validSoKeys = new Set(soKeys);
    const validDates = new Set(
      datesInStockProductsMonth(workbook.stock.period),
    );

    if (
      validateStockProductsSoSheetCoverage(workbook.so_sheets).length > 0 ||
      new Set(stockKeys).size !== stockKeys.length ||
      new Set(soKeys).size !== soKeys.length ||
      workbook.stock.rows.some((row) => {
        const dates = row.daily.map((entry) => entry.date);
        return (
          (row.item.so_row_id != null &&
            !validSoKeys.has(`so:local:${row.item.so_row_id}`)) ||
          new Set(dates).size !== dates.length ||
          dates.some((date) => !validDates.has(date))
        );
      })
    ) {
      throw new Error("Invalid stored row identities or dates");
    }

    return { workbook, error: "" };
  } catch {
    return {
      workbook: stockProductsMockWorkbook,
      error:
        "ข้อมูล Local Storage ไม่ถูกต้อง ระบบแสดงข้อมูลต้นฉบับและระงับการบันทึกเพื่อป้องกันข้อมูลเดิมสูญหาย",
    };
  }
}

function persistWorkbook(workbook: StockProductsWorkbook): void {
  const data: StockProductsStoredData = {
    version: STOCK_PRODUCTS_STORAGE_VERSION,
    workbook,
  };
  const serialized = JSON.stringify(data);

  if (decodeWorkbook(serialized).error) {
    throw new Error("โครงสร้างข้อมูลไม่ถูกต้อง ไม่สามารถบันทึกได้");
  }

  window.localStorage.setItem(STOCK_PRODUCTS_STORAGE_KEY, serialized);
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

interface PaginationProps {
  page: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

function StockProductsPagination({
  page,
  total,
  itemLabel,
  onPageChange,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lastPage = Math.min(page, pages);
  const start = total === 0 ? 0 : (lastPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(lastPage * PAGE_SIZE, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
      <p className="text-muted-foreground">
        {COPY.showing} {start.toLocaleString("th-TH")}-
        {end.toLocaleString("th-TH")} {COPY.from}{" "}
        {total.toLocaleString("th-TH")} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lastPage <= 1}
          onClick={() => onPageChange(lastPage - 1)}
        >
          {COPY.previous}
        </Button>
        <span className="min-w-18 text-center tabular-nums">
          {COPY.page} {lastPage}/{pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lastPage >= pages}
          onClick={() => onPageChange(lastPage + 1)}
        >
          {COPY.next}
        </Button>
      </div>
    </div>
  );
}

/** Keep the 31-day ledger separate from source F:P summary totals. */
function StockProductsDailyView({
  row,
  period,
  readOnly,
  onEdit,
}: {
  row: StockProductsStockRow;
  period: StockProductsMonth;
  readOnly: boolean;
  onEdit: (date: string) => void;
}) {
  const dates = datesInStockProductsMonth(period);
  const valuesByDate = new Map<string, StockProductsDailyValues>(
    row.daily.map((entry) => [entry.date, entry.values]),
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-lg border border-border bg-muted/25 p-3 text-sm">
        <p className="font-semibold text-foreground">{row.item.name.trim()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {COPY.code}: {originalCell(row.item.code)} · {COPY.unit}:{" "}
          {originalCell(row.item.unit)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{COPY.dailyHint}</p>
      </div>
      <div className="max-h-[55dvh] overflow-auto rounded-lg border border-border">
        <Table className="min-w-275 text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="min-w-28">{COPY.date}</TableHead>
              {DAILY_COLUMNS.map((column) => (
                <TableHead key={column.field} className="min-w-28 text-right">
                  {column.label}
                </TableHead>
              ))}
              <TableHead className="min-w-28 text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dates.map((date) => {
              const record = valuesByDate.get(date);
              return (
                <TableRow
                  key={date}
                  className={record ? "bg-primary/5" : undefined}
                >
                  <TableCell className="whitespace-nowrap font-medium tabular-nums">
                    {date}
                  </TableCell>
                  {DAILY_COLUMNS.map((column) => (
                    <TableCell key={column.field} className={QUANTITY_CLASSES}>
                      {originalCell(record?.[column.field] ?? "")}
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={readOnly}
                      onClick={() => onEdit(date)}
                    >
                      {record ? (
                        <Pencil aria-hidden="true" />
                      ) : (
                        <Plus aria-hidden="true" />
                      )}
                      {record ? "แก้ไข" : "บันทึก"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{COPY.stockHint}</p>
    </div>
  );
}

export function StockProductsWorkspace() {
  const stockSearchId = useId();
  const soSearchId = useId();
  const [activeView, setActiveView] = useState<"STOCK" | "SO">("STOCK");
  const [stockSearch, setStockSearch] = useState("");
  const [soSearch, setSoSearch] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<
    StockProductsSoSheetName | "ALL"
  >("ALL");
  const [stockPage, setStockPage] = useState(1);
  const [soPage, setSoPage] = useState(1);
  const [selectedStockKey, setSelectedStockKey] = useState<string | null>(null);
  const [stockEditor, setStockEditor] = useState<StockEditor | null>(null);
  const [dailyEditor, setDailyEditor] = useState<DailyEditor | null>(null);
  const [soEditor, setSoEditor] = useState<SoEditor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const snapshot = useSyncExternalStore(
    subscribeStorage,
    getStorageSnapshot,
    getServerSnapshot,
  );
  const { workbook, error: storageError } = useMemo(
    () => decodeWorkbook(snapshot),
    [snapshot],
  );
  const { stock, so_sheets: soSheets } = workbook;
  const readOnly = Boolean(storageError);
  const selectedStockRow =
    stock.rows.find((row) => stockProductsRowKey(row) === selectedStockKey) ??
    null;
  const stockRows = useMemo(
    () => filterStockProductsRows(stock.rows, stockSearch),
    [stock.rows, stockSearch],
  );
  const soRows = useMemo(
    () =>
      filterStockProductsSoRows(soSheets, {
        sheet: selectedSheet,
        search: soSearch,
      }),
    [soSheets, selectedSheet, soSearch],
  );
  const currentStockPage = Math.min(
    stockPage,
    Math.max(1, Math.ceil(stockRows.length / PAGE_SIZE)),
  );
  const currentSoPage = Math.min(
    soPage,
    Math.max(1, Math.ceil(soRows.length / PAGE_SIZE)),
  );
  const stockPageRows = stockRows.slice(
    (currentStockPage - 1) * PAGE_SIZE,
    currentStockPage * PAGE_SIZE,
  );
  const soPageRows = soRows.slice(
    (currentSoPage - 1) * PAGE_SIZE,
    currentSoPage * PAGE_SIZE,
  );
  const movementDays = useMemo(
    () => stock.rows.reduce((sum, row) => sum + row.daily.length, 0),
    [stock.rows],
  );
  const soLineCount = useMemo(
    () => soSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    [soSheets],
  );

  function clearFeedback() {
    setSaveError("");
    setNotice("");
  }

  function saveWorkbook(
    nextWorkbook: StockProductsWorkbook,
    expectedSnapshot: string | null,
    message: string,
  ): boolean {
    clearFeedback();

    try {
      if (storageError) throw new Error(storageError);

      if (
        expectedSnapshot !== snapshot ||
        getStorageSnapshot() !== expectedSnapshot
      ) {
        throw new Error(
          "ข้อมูลมีการเปลี่ยนแปลง กรุณาปิดฟอร์มแล้วเปิดใหม่ก่อนบันทึก",
        );
      }

      persistWorkbook(nextWorkbook);
      setNotice(message);
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
      );
      return false;
    }
  }

  function openCreateProduct() {
    clearFeedback();

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;
    const row = blankStockProductsRow(crypto.randomUUID());

    setStockEditor({
      mode: "CREATE",
      row: {
        ...row,
        item: {
          ...row.item,
          added_date: today,
        },
      },
      snapshot,
    });
  }

  function openEditProduct(row: StockProductsStockRow) {
    clearFeedback();
    setStockEditor({ mode: "EDIT", row, snapshot });
  }

  function finishProductSave(
    rows: readonly StockProductsStockRow[],
    key: string,
  ) {
    setStockEditor(null);
    setStockSearch("");
    const index = rows.findIndex(
      (current) => stockProductsRowKey(current) === key,
    );
    setStockPage(Math.floor(index / PAGE_SIZE) + 1);
  }

  function saveProduct(row: StockProductsStockRow) {
    if (!stockEditor) return;

    const isCreate = stockEditor.mode === "CREATE";
    const key = stockProductsRowKey(row);
    const exists = stock.rows.some(
      (current) => stockProductsRowKey(current) === key,
    );

    if (
      isCreate === exists ||
      (isCreate && !row.item.id?.trim()) ||
      key !== stockProductsRowKey(stockEditor.row) ||
      row.item.so_row_id !== stockEditor.row.item.so_row_id
    ) {
      setSaveError("ไม่สามารถระบุรายการสินค้าได้ กรุณาปิดฟอร์มแล้วเปิดใหม่");
      return;
    }

    const error = Object.values(
      validateStockProductsRow(row, stockEditor.mode),
    )[0];
    if (error) {
      setSaveError(error);
      return;
    }

    const rows = upsertStockProductsRow(stock.rows, row);
    if (
      !saveWorkbook(
        { ...workbook, stock: { ...stock, rows } },
        stockEditor.snapshot,
        isCreate ? "เพิ่มสินค้าเรียบร้อยแล้ว" : "แก้ไขสินค้าเรียบร้อยแล้ว",
      )
    ) {
      return;
    }

    finishProductSave(rows, key);
  }

  function confirmDeleteProduct() {
    if (!deleteTarget) return;
    const key = stockProductsRowKey(deleteTarget.row);
    const rows = removeStockProductsRow(stock.rows, key);

    if (
      !saveWorkbook(
        { ...workbook, stock: { ...stock, rows } },
        deleteTarget.snapshot,
        "ลบสินค้าเรียบร้อยแล้ว",
      )
    )
      return;

    setDeleteTarget(null);
    if (selectedStockKey === key) setSelectedStockKey(null);
    setStockPage(currentStockPage);
  }

  function openDailyEditor(row: StockProductsStockRow, date: string) {
    clearFeedback();
    setSelectedStockKey(null);
    setDailyEditor({ row, date, snapshot });
  }

  function closeDailyEditor() {
    if (dailyEditor) setSelectedStockKey(stockProductsRowKey(dailyEditor.row));
    setDailyEditor(null);
    setSaveError("");
  }

  function saveDaily(row: StockProductsStockRow) {
    if (!dailyEditor) return;
    const key = stockProductsRowKey(row);

    if (
      key !== stockProductsRowKey(dailyEditor.row) ||
      !stock.rows.some((current) => stockProductsRowKey(current) === key)
    ) {
      setSaveError("ไม่พบสินค้าที่ต้องการบันทึก กรุณาเปิดฟอร์มใหม่");
      return;
    }

    const rows = upsertStockProductsRow(stock.rows, row);
    if (
      !saveWorkbook(
        { ...workbook, stock: { ...stock, rows } },
        dailyEditor.snapshot,
        "บันทึกข้อมูลรับ-จ่ายเรียบร้อยแล้ว",
      )
    )
      return;

    closeDailyEditor();
  }

  function openCreateSo() {
    clearFeedback();
    setSoEditor({
      id: crypto.randomUUID(),
      sheet:
        selectedSheet === "ALL"
          ? STOCK_PRODUCTS_SO_SHEET_NAMES[0]
          : selectedSheet,
      snapshot,
    });
  }

  function saveSo(row: StockProductsSoRow) {
    if (!soEditor) return;

    if (row.id !== soEditor.id) {
      setSaveError("ไม่สามารถระบุรายการ SO ได้ กรุณาปิดฟอร์มแล้วเปิดใหม่");
      return;
    }

    try {
      const nextWorkbook = appendStockProductsSoForStock(workbook, row);
      const sheets = nextWorkbook.so_sheets;
      if (
        !saveWorkbook(
          nextWorkbook,
          soEditor.snapshot,
          "เพิ่มรายการ SO เรียบร้อยแล้ว",
        )
      )
        return;

      const sheet = sheets.find((current) => current.name === row.sheet_name);
      setSoEditor(null);
      setSelectedSheet(row.sheet_name);
      setSoSearch("");
      setSoPage(Math.max(1, Math.ceil((sheet?.rows.length ?? 0) / PAGE_SIZE)));
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "ไม่สามารถเพิ่มรายการ SO ได้",
      );
    }
  }

  function chooseSoSheet(next: string) {
    if (next === "ALL") {
      setSelectedSheet("ALL");
      setSoPage(1);
      return;
    }
    const known = STOCK_PRODUCTS_SO_SHEET_NAMES.find((name) => name === next);
    if (known !== undefined) {
      setSelectedSheet(known);
      setSoPage(1);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title={COPY.title}
        description={COPY.desc}
        actions={<Badge variant="outline">{COPY.storage}</Badge>}
      />

      {storageError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
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
          className="fixed right-4 bottom-4 z-1000 max-w-sm rounded-lg border border-danger/30 bg-background p-4 text-sm text-danger shadow-lg"
        >
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Boxes className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {monthLabel(stock.period.year_be, stock.period.month)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stock.source_sheet_name} · {stock.report_caption}
            </p>
          </div>
        </div>
        <Badge variant="secondary">
          {snapshot !== null && !storageError
            ? "ข้อมูลในเบราว์เซอร์"
            : COPY.source}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: COPY.productCount, value: stock.rows.length, Icon: Boxes },
          { label: COPY.dailyCount, value: movementDays, Icon: CalendarDays },
          { label: COPY.soCount, value: soLineCount, Icon: ClipboardList },
          { label: COPY.soSheets, value: soSheets.length, Icon: Search },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-border bg-card p-4"
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

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Stock products view"
      >
        <Button
          type="button"
          variant={activeView === "STOCK" ? "default" : "outline"}
          aria-pressed={activeView === "STOCK"}
          onClick={() => setActiveView("STOCK")}
        >
          <Boxes className="size-4" aria-hidden="true" />
          {COPY.stock}
        </Button>
        <Button
          type="button"
          variant={activeView === "SO" ? "default" : "outline"}
          aria-pressed={activeView === "SO"}
          onClick={() => setActiveView("SO")}
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          {COPY.so} ({soSheets.length})
        </Button>
      </div>

      {activeView === "STOCK" ? (
        <section className="min-w-0 space-y-4" aria-label={COPY.stock}>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2 sm:max-w-xl">
                <Label htmlFor={stockSearchId}>{COPY.stockSearch}</Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id={stockSearchId}
                    type="search"
                    autoComplete="off"
                    value={stockSearch}
                    onChange={(event) => {
                      setStockSearch(event.currentTarget.value);
                      setStockPage(1);
                    }}
                    placeholder={COPY.stockPlaceholder}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {stockRows.length.toLocaleString("th-TH")}/
                  {stock.rows.length.toLocaleString("th-TH")}{" "}
                  {COPY.productCount}
                </Badge>
                <Button
                  type="button"
                  disabled={readOnly}
                  onClick={openCreateProduct}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มสินค้า
                </Button>
              </div>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold">{COPY.stock}</p>
              <p className="text-xs text-muted-foreground">{COPY.stockHint}</p>
            </div>
            <div className="max-w-full overflow-x-auto border-t border-border">
              <Table className="min-w-560 text-xs">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="min-w-32">{COPY.code}</TableHead>
                    <TableHead className="min-w-80">
                      {COPY.productName}
                    </TableHead>
                    <TableHead className="min-w-24">{COPY.group}</TableHead>
                    <TableHead className="min-w-18">{COPY.unit}</TableHead>
                    {STOCK_COLUMNS.map((column) => (
                      <TableHead
                        key={column.field}
                        className="min-w-24 text-right"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-36">{COPY.remark}</TableHead>
                    <TableHead className="min-w-28">
                      {COPY.dailyButton}
                    </TableHead>
                    <TableHead className="min-w-28 text-center">
                      จัดการ
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockPageRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={18}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {COPY.noStock}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockPageRows.map((row) => (
                      <TableRow key={stockProductsRowKey(row)}>
                        <TableCell className="font-mono text-xs">
                          {originalCell(row.item.code)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.item.name.trim()}
                        </TableCell>
                        <TableCell>{originalCell(row.item.group)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.item.unit)}
                        </TableCell>
                        {STOCK_COLUMNS.map((column) => (
                          <TableCell
                            key={column.field}
                            className={QUANTITY_CLASSES}
                          >
                            {originalCell(row.summary[column.field])}
                          </TableCell>
                        ))}
                        <TableCell
                          className="max-w-48 truncate"
                          title={row.remark}
                        >
                          {originalCell(row.remark)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              clearFeedback();
                              setSelectedStockKey(stockProductsRowKey(row));
                            }}
                          >
                            <CalendarDays
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {COPY.dailyButton}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={readOnly}
                              title="แก้ไขสินค้า"
                              aria-label={`แก้ไข ${row.item.name}`}
                              onClick={() => openEditProduct(row)}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              disabled={readOnly}
                              title="ลบสินค้า"
                              aria-label={`ลบ ${row.item.name}`}
                              className="text-danger"
                              onClick={() => {
                                clearFeedback();
                                setDeleteTarget({ row, snapshot });
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <StockProductsPagination
              page={currentStockPage}
              total={stockRows.length}
              itemLabel={COPY.productCount}
              onPageChange={setStockPage}
            />
          </div>
        </section>
      ) : (
        <section className="min-w-0 space-y-4" aria-label={COPY.so}>
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
            <SelectField
              label={COPY.pickSheet}
              value={selectedSheet}
              onChange={chooseSoSheet}
              options={SO_SHEET_OPTIONS}
            />
            <div className="space-y-2">
              <Label htmlFor={soSearchId}>{COPY.soSearch}</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={soSearchId}
                  type="search"
                  autoComplete="off"
                  value={soSearch}
                  onChange={(event) => {
                    setSoSearch(event.currentTarget.value);
                    setSoPage(1);
                  }}
                  placeholder={COPY.soPlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {COPY.so} ·{" "}
                  {selectedSheet === "ALL" ? COPY.allSheets : selectedSheet}
                </p>
                <p className="text-xs text-muted-foreground">{COPY.soHint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {soRows.length.toLocaleString("th-TH")} {COPY.soCount}
                </Badge>
                <Button
                  type="button"
                  disabled={readOnly}
                  onClick={openCreateSo}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  เพิ่มรายการ SO
                </Button>
              </div>
            </div>
            <div className="max-w-full overflow-x-auto border-t border-border">
              <Table className="min-w-250 text-xs">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="min-w-22">{COPY.soSheets}</TableHead>
                    <TableHead className="min-w-28">{COPY.dateRaw}</TableHead>
                    <TableHead className="min-w-48">{COPY.customer}</TableHead>
                    <TableHead className="min-w-36">{COPY.soNumber}</TableHead>
                    <TableHead className="min-w-72">
                      {COPY.productName}
                    </TableHead>
                    <TableHead className="min-w-20 text-right">
                      {COPY.quantity}
                    </TableHead>
                    <TableHead className="min-w-16">{COPY.unit}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soPageRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {COPY.noSo}
                      </TableCell>
                    </TableRow>
                  ) : (
                    soPageRows.map((row) => (
                      <TableRow key={stockProductsSoRowKey(row)}>
                        <TableCell className="font-medium">
                          {row.sheet_name}
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap font-mono"
                          title={COPY.dateHint}
                        >
                          {originalCell(row.date_raw)}
                        </TableCell>
                        <TableCell>{originalCell(row.customer_name)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.so_number)}
                        </TableCell>
                        <TableCell>{originalCell(row.product_name)}</TableCell>
                        <TableCell className={QUANTITY_CLASSES}>
                          {originalCell(row.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.unit)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <StockProductsPagination
              page={currentSoPage}
              total={soRows.length}
              itemLabel={COPY.soCount}
              onPageChange={setSoPage}
            />
          </div>
          <p className="text-xs text-muted-foreground">{COPY.dateHint}</p>
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {COPY.mockHint} · {COPY.stockHint} · {COPY.soHint}
      </p>

      <Dialog
        open={selectedStockRow !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedStockKey(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-[calc(100vw-3rem)] lg:max-w-5xl">
          <div className="min-w-0 space-y-1 pr-6">
            <DialogTitle>{COPY.dailyTitle}</DialogTitle>
            <DialogDescription>
              {monthLabel(stock.period.year_be, stock.period.month)} ·{" "}
              {COPY.stockHint}
            </DialogDescription>
          </div>
          {selectedStockRow && (
            <>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={
                    readOnly ||
                    datesInStockProductsMonth(stock.period).length === 0
                  }
                  onClick={() => {
                    const date = datesInStockProductsMonth(stock.period)[0];
                    if (date) openDailyEditor(selectedStockRow, date);
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  บันทึกรับ-จ่าย
                </Button>
              </div>
              <StockProductsDailyView
                row={selectedStockRow}
                period={stock.period}
                readOnly={readOnly}
                onEdit={(date) => openDailyEditor(selectedStockRow, date)}
              />
            </>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedStockKey(null)}
            >
              {COPY.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {stockEditor && (
        <StockProductsForm
          key={stockProductsRowKey(stockEditor.row)}
          row={stockEditor.row}
          mode={stockEditor.mode}
          onSave={saveProduct}
          onCancel={() => {
            setStockEditor(null);
            setSaveError("");
          }}
        />
      )}

      {dailyEditor && (
        <StockProductsDailyForm
          key={`${stockProductsRowKey(dailyEditor.row)}:${dailyEditor.date}`}
          row={dailyEditor.row}
          period={stock.period}
          initialDate={dailyEditor.date}
          onSave={saveDaily}
          onCancel={closeDailyEditor}
        />
      )}

      {soEditor && (
        <StockProductsSoForm
          key={soEditor.id}
          id={soEditor.id}
          initialSheet={soEditor.sheet}
          stockRows={stock.rows}
          onSave={saveSo}
          onCancel={() => {
            setSoEditor(null);
            setSaveError("");
          }}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setSaveError("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogTitle>ยืนยันการลบสินค้า</DialogTitle>
          <DialogDescription>
            สินค้าและข้อมูลรับ-จ่ายรายวันของสินค้านี้จะถูกนำออกจากข้อมูลที่บันทึก
            โดยไม่ลบรายการ SO หรือแก้ไข Excel ต้นฉบับ
          </DialogDescription>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="font-semibold">{deleteTarget.row.item.name}</p>
                <p className="text-xs text-muted-foreground">
                  รหัสสินค้า: {originalCell(deleteTarget.row.item.code)} ·
                  ข้อมูลรายวัน {deleteTarget.row.daily.length} วัน
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeleteTarget(null);
                    setSaveError("");
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  disabled={readOnly}
                  onClick={confirmDeleteProduct}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  ยืนยันการลบ
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
