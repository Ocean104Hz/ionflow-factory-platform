"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

import { StockProductsForm } from "./stock_products_form";
import { StockProductsDailyForm } from "./stock_products_daily_form";
import { StockProductsSoForm } from "./stock_products_so_form";

import {
  appendStockProductsSoRow,
  blankStockProductsDaily,
  blankStockProductsRow,
  datesInStockProductsMonth,
  filterStockProductsRows,
  filterStockProductsSoRows,
  isValidStockProductsAddedDate,
  stockProductsRowKey,
  stockProductsSoRowKey,
  upsertStockProductsRow,
  validateStockProductsRow,
  validateStockProductsSoForStock,
  validateStockProductsSoSheetCoverage,
  STOCK_PRODUCTS_DAILY_FIELDS,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  type StockProductsDailyField,
  type StockProductsDailyValues,
  type StockProductsMonth,
  type StockProductsSoRow,
  type StockProductsSoSheetName,
  type StockProductsWorkbook,
  type StockProductsStockRow,
  type StockProductsSummaryField,
} from "./stock_products_domain";

/**
 * FF stock workspace backed by /api/stock/products.
 * Daily entries and SO records do not recalculate or deduct stock.
 * The existing report month is retained; browser-local data is not imported.
 */

const COPY = {
  title: "สต็อกสินค้า",
  desc: "จัดการสต็อกสินค้า รับ-จ่ายรายวัน และรายการ SO ทั้ง 16 ชีต",
  storage: "ฐานข้อมูลจริง",
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
  dateRaw: "วันที่ SO",
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
  databaseHint: "ข้อมูลจากฐานข้อมูล ไม่นำเข้า Local Storage อัตโนมัติ",
  dateHint: "วันที่ SO ตามที่บันทึกในฐานข้อมูล",
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
const STOCK_API = "/api/stock/products";
const CSRF_COOKIE = "ionflow_factory_csrf";
// Retain the existing October 2569 report period from the legacy workbook.
const REPORT_PERIOD: StockProductsMonth = { year_be: 2569, month: 10 };
const EMPTY_WORKBOOK: StockProductsWorkbook = {
  stock: {
    source_sheet_name: "Stock Products",
    report_caption: COPY.storage,
    period: REPORT_PERIOD,
    rows: [],
  },
  so_sheets: STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => ({ name, rows: [] })),
};
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
};

type DailyEditor = {
  row: StockProductsStockRow;
  date: string;
};

type SoEditor = {
  id: string;
  sheet: StockProductsSoSheetName;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function isDatabaseId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d{0,18}$/.test(value) &&
    (value.length < 19 || value <= "9223372036854775807")
  );
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
    isDatabaseId(item.id) &&
    (item.so_row_id === undefined ||
      item.so_row_id === null ||
      typeof item.so_row_id === "string") &&
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
    isDatabaseId(value.id) &&
    typeof value.stock_row_key === "string" &&
    value.stock_row_key.startsWith("stock:local:") &&
    isDatabaseId(value.stock_row_key.slice("stock:local:".length)) &&
    STOCK_PRODUCTS_SO_SHEET_NAMES.some((name) => name === value.sheet_name) &&
    typeof value.source_row === "number" &&
    Number.isInteger(value.source_row) &&
    typeof value.date_raw === "string" &&
    isValidStockProductsAddedDate(value.date_raw) &&
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

class StockApiError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "StockApiError";
  }
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
  throw new StockApiError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token");
}

const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ";
const LOAD_FAILED = "ไม่สามารถโหลดข้อมูลสต็อกจากฐานข้อมูลได้";
const INVALID_RESPONSE = "รูปแบบข้อมูลจาก API ไม่ถูกต้อง";

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
    throw new StockApiError(writing ? UNCERTAIN_SAVE : LOAD_FAILED, writing);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const reload =
      writing &&
      (response.ok ||
        response.status >= 500 ||
        response.status === 404 ||
        response.status === 409 ||
        response.status === 401 ||
        response.status === 403);
    let message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : writing
          ? UNCERTAIN_SAVE
          : LOAD_FAILED;
    if (response.status === 401 || response.status === 403) {
      message = "กรุณาตรวจสอบการเข้าสู่ระบบและสิทธิ์การใช้งาน";
    }
    throw new StockApiError(message, reload);
  }
  return payload;
}

function hasValidDailyDates(
  row: StockProductsStockRow,
  period: StockProductsMonth,
): boolean {
  const validDates = new Set(datesInStockProductsMonth(period));
  const dates = row.daily.map((entry) => entry.date);
  return (
    new Set(dates).size === dates.length &&
    dates.every((date) => validDates.has(date))
  );
}

function readApiWorkbook(
  payload: Record<string, unknown>,
  period: StockProductsMonth,
): StockProductsWorkbook {
  if (
    !isRecord(payload.period) ||
    payload.period.year_be !== period.year_be ||
    payload.period.month !== period.month
  ) {
    throw new StockApiError(INVALID_RESPONSE);
  }
  const workbook: unknown = {
    stock: { ...EMPTY_WORKBOOK.stock, period, rows: payload.rows },
    so_sheets: payload.so_sheets,
  };
  if (
    !isWorkbook(workbook) ||
    validateStockProductsSoSheetCoverage(workbook.so_sheets).length > 0
  ) {
    throw new StockApiError(INVALID_RESPONSE);
  }
  const stockKeys = workbook.stock.rows.map(stockProductsRowKey);
  const soKeys = workbook.so_sheets.flatMap((sheet) =>
    sheet.rows.map(stockProductsSoRowKey),
  );
  if (
    new Set(stockKeys).size !== stockKeys.length ||
    new Set(soKeys).size !== soKeys.length ||
    workbook.stock.rows.some((row) => !hasValidDailyDates(row, period))
  ) {
    throw new StockApiError(INVALID_RESPONSE);
  }
  return workbook;
}

async function loadStockWorkbook(
  signal: AbortSignal,
): Promise<StockProductsWorkbook> {
  const params = new URLSearchParams({
    year_be: String(REPORT_PERIOD.year_be),
    month: String(REPORT_PERIOD.month),
  });
  const payload = await requestStockJson(
    `${STOCK_API}?${params}`,
    { signal },
    false,
  );
  return readApiWorkbook(payload, REPORT_PERIOD);
}

async function writeStock(
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
) {
  return requestStockJson(
    STOCK_API,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": getCsrfToken(),
      },
      body: JSON.stringify(body),
    },
    true,
  );
}

function productFields(row: StockProductsStockRow) {
  const { code, name, group, unit, added_date } = row.item;
  return { code, name, group, unit, added_date: added_date ?? null };
}

function productBody(
  row: StockProductsStockRow,
  editor: StockEditor,
  period: StockProductsMonth,
) {
  const common = {
    period,
    item: productFields(row),
    summary: row.summary,
    remark: row.remark,
  };
  if (editor.mode === "CREATE") return { action: "create_product", ...common };
  const previous = editor.row;
  return {
    action: "update_product",
    item_id: previous.item.id,
    ...common,
    expected: {
      item: { id: previous.item.id, ...productFields(previous) },
      summary: previous.summary,
      remark: previous.remark,
    },
  };
}

function readSavedProduct(
  payload: Record<string, unknown>,
  period: StockProductsMonth,
  expectedId?: string,
): StockProductsStockRow {
  const row = payload.row;
  if (
    !isStockRow(row) ||
    !hasValidDailyDates(row, period) ||
    (expectedId !== undefined && row.item.id !== expectedId)
  ) {
    throw new StockApiError(UNCERTAIN_SAVE, true);
  }
  return row;
}

function dailyChange(
  previous: StockProductsStockRow,
  next: StockProductsStockRow,
  period: StockProductsMonth,
) {
  if (
    !hasValidDailyDates(previous, period) ||
    !hasValidDailyDates(next, period)
  ) {
    throw new StockApiError("วันที่รับ-จ่ายไม่ถูกต้อง");
  }
  const changes = datesInStockProductsMonth(period).flatMap((date) => {
    const expected =
      previous.daily.find((entry) => entry.date === date)?.values ??
      blankStockProductsDaily();
    const values =
      next.daily.find((entry) => entry.date === date)?.values ??
      blankStockProductsDaily();
    return STOCK_PRODUCTS_DAILY_FIELDS.some(
      (field) => expected[field] !== values[field],
    )
      ? [{ date, expected, values }]
      : [];
  });
  if (changes.length > 1) {
    throw new StockApiError("กรุณาบันทึกรับ-จ่ายทีละวัน");
  }
  return changes[0];
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
  const [deleteTarget, setDeleteTarget] =
    useState<StockProductsStockRow | null>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");

  const [workbook, setWorkbook] =
    useState<StockProductsWorkbook>(EMPTY_WORKBOOK);
  const [loadState, setLoadState] = useState({ loading: true, error: "" });
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void loadStockWorkbook(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setWorkbook(next);
        setLoadState({ loading: false, error: "" });
        setRefreshRequired(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoadState({
          loading: false,
          error: error instanceof StockApiError ? error.message : LOAD_FAILED,
        });
      });
    return () => controller.abort();
  }, [refreshToken]);

  const { stock, so_sheets: soSheets } = workbook;
  const readOnly =
    loadState.loading ||
    Boolean(loadState.error) ||
    refreshRequired ||
    isSaving;

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

  function reloadWorkbook() {
    if (
      saveLock.current ||
      loadState.loading ||
      stockEditor ||
      dailyEditor ||
      soEditor ||
      deleteTarget
    )
      return;
    clearFeedback();
    setLoadState({ loading: true, error: "" });
    setRefreshToken((previous) => previous + 1);
  }

  async function runSave<T>(
    work: () => Promise<T>,
    commit: (value: T) => void,
    message: string,
  ) {
    if (readOnly || saveLock.current) return;
    saveLock.current = true;
    setIsSaving(true);
    clearFeedback();
    try {
      const result = await work();
      commit(result);
      setNotice(message);
    } catch (error) {
      if (!(error instanceof StockApiError) || error.reloadRequired) {
        setRefreshRequired(true);
      }
      setSaveError(
        error instanceof StockApiError ? error.message : UNCERTAIN_SAVE,
      );
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  }

  function openCreateProduct() {
    if (readOnly || saveLock.current) return;
    clearFeedback();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const row = blankStockProductsRow(crypto.randomUUID());
    setStockEditor({
      mode: "CREATE",
      row: {
        ...row,
        item: { ...row.item, added_date: `${year}-${month}-${day}` },
      },
    });
  }

  function openEditProduct(row: StockProductsStockRow) {
    if (readOnly || saveLock.current) return;
    clearFeedback();
    setStockEditor({ mode: "EDIT", row });
  }

  function replaceProduct(saved: StockProductsStockRow) {
    const rows = upsertStockProductsRow(stock.rows, saved);
    setWorkbook((previous) => ({
      ...previous,
      stock: { ...previous.stock, rows },
    }));
    return rows;
  }

  async function saveProduct(row: StockProductsStockRow) {
    if (!stockEditor || readOnly || saveLock.current) return;
    const editor = stockEditor;
    const isCreate = editor.mode === "CREATE";
    const key = stockProductsRowKey(row);
    const exists = stock.rows.some(
      (current) => stockProductsRowKey(current) === key,
    );
    if (
      isCreate === exists ||
      key !== stockProductsRowKey(editor.row) ||
      (!isCreate && !isDatabaseId(row.item.id)) ||
      row.item.so_row_id !== editor.row.item.so_row_id
    ) {
      setSaveError("ไม่สามารถระบุรายการสินค้าได้ กรุณาเปิดฟอร์มใหม่");
      return;
    }
    const error = Object.values(validateStockProductsRow(row, editor.mode))[0];
    if (error) {
      setSaveError(error);
      return;
    }
    await runSave(
      async () => {
        const payload = await writeStock(
          isCreate ? "POST" : "PATCH",
          productBody(row, editor, stock.period),
        );
        const saved = readSavedProduct(
          payload,
          stock.period,
          isCreate ? undefined : editor.row.item.id,
        );
        if (
          isCreate &&
          stock.rows.some((current) => current.item.id === saved.item.id)
        ) {
          throw new StockApiError(UNCERTAIN_SAVE, true);
        }
        return saved;
      },
      (saved) => {
        const rows = replaceProduct(saved);
        setStockEditor(null);
        setStockSearch("");
        const index = rows.findIndex(
          (current) =>
            stockProductsRowKey(current) === stockProductsRowKey(saved),
        );
        setStockPage(Math.floor(index / PAGE_SIZE) + 1);
      },
      isCreate ? "เพิ่มสินค้าเรียบร้อยแล้ว" : "แก้ไขสินค้าเรียบร้อยแล้ว",
    );
  }

  function openDeleteProduct(row: StockProductsStockRow) {
    if (readOnly || saveLock.current) return;
    clearFeedback();
    setDeleteTarget(row);
  }

  function closeDeleteProduct() {
    if (saveLock.current) return;
    setDeleteTarget(null);
    setSaveError("");
  }

  async function confirmDeleteProduct() {
    if (!deleteTarget || readOnly || saveLock.current) return;
    const target = deleteTarget;
    const itemId = target.item.id;
    if (
      !isDatabaseId(itemId) ||
      !stock.rows.some((row) => row.item.id === itemId)
    ) {
      setSaveError(INVALID_RESPONSE);
      return;
    }

    await runSave(
      async () => {
        const payload = await writeStock("DELETE", {
          action: "delete_product",
          item_id: itemId,
          period: stock.period,
          expected: {
            item: { id: itemId, ...productFields(target) },
            summary: target.summary,
            remark: target.remark,
            daily: target.daily,
          },
        });
        if (payload.item_id !== itemId) {
          throw new StockApiError(UNCERTAIN_SAVE, true);
        }
        return itemId;
      },
      (deletedId) => {
        setWorkbook((previous) => ({
          ...previous,
          stock: {
            ...previous.stock,
            rows: previous.stock.rows.filter(
              (row) => row.item.id !== deletedId,
            ),
          },
        }));
        if (selectedStockKey === stockProductsRowKey(target)) {
          setSelectedStockKey(null);
        }
        setDeleteTarget(null);
        setStockPage(currentStockPage);
      },
      "ลบสินค้าออกจากเดือนรายงานเรียบร้อยแล้ว",
    );
  }

  function openDailyEditor(row: StockProductsStockRow, date: string) {
    if (readOnly || saveLock.current) return;
    clearFeedback();
    setSelectedStockKey(null);
    setDailyEditor({ row, date });
  }

  function closeDailyEditor() {
    if (saveLock.current) return;
    if (dailyEditor) setSelectedStockKey(stockProductsRowKey(dailyEditor.row));
    setDailyEditor(null);
    setSaveError("");
  }

  async function saveDaily(row: StockProductsStockRow) {
    if (!dailyEditor || readOnly || saveLock.current) return;
    const previous = dailyEditor.row;
    const itemId = previous.item.id;
    if (
      !isDatabaseId(itemId) ||
      stockProductsRowKey(row) !== stockProductsRowKey(previous) ||
      !stock.rows.some((current) => current.item.id === itemId)
    ) {
      setSaveError("ไม่พบสินค้าที่ต้องการบันทึก");
      return;
    }
    let change: ReturnType<typeof dailyChange>;
    try {
      change = dailyChange(previous, row, stock.period);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : INVALID_RESPONSE);
      return;
    }
    if (!change) {
      closeDailyEditor();
      return;
    }
    await runSave(
      async () => {
        const payload = await writeStock("POST", {
          action: "save_daily",
          item_id: itemId,
          period: stock.period,
          date: change.date,
          values: change.values,
          expected: change.expected,
        });
        return readSavedProduct(payload, stock.period, itemId);
      },
      (saved) => {
        replaceProduct(saved);
        setDailyEditor(null);
        setSelectedStockKey(stockProductsRowKey(saved));
      },
      "บันทึกข้อมูลรับ-จ่ายเรียบร้อยแล้ว",
    );
  }

  function openCreateSo() {
    if (readOnly || saveLock.current) return;
    clearFeedback();
    setSoEditor({
      id: crypto.randomUUID(),
      sheet:
        selectedSheet === "ALL"
          ? STOCK_PRODUCTS_SO_SHEET_NAMES[0]
          : selectedSheet,
    });
  }

  async function saveSo(row: StockProductsSoRow) {
    if (!soEditor || readOnly || saveLock.current) return;
    const selected = stock.rows.find(
      (current) => stockProductsRowKey(current) === row.stock_row_key,
    );
    if (
      row.id !== soEditor.id ||
      !selected ||
      !isDatabaseId(selected.item.id)
    ) {
      setSaveError("กรุณาเลือกสินค้าจากสต็อก");
      return;
    }
    const error = Object.values(
      validateStockProductsSoForStock(row, stock.rows),
    )[0];
    if (error) {
      setSaveError(error);
      return;
    }
    const itemId = selected.item.id;
    await runSave(
      async () => {
        const payload = await writeStock("POST", {
          action: "create_so",
          item_id: itemId,
          period: stock.period,
          sheet_name: row.sheet_name,
          date_raw: String(row.date_raw).trim(),
          customer_name: row.customer_name.trim(),
          so_number: row.so_number.trim(),
          quantity: row.quantity.trim(),
          unit: row.unit.trim(),
        });
        const saved = payload.row;
        if (
          !isSoRow(saved) ||
          saved.sheet_name !== row.sheet_name ||
          saved.stock_row_key !== stockProductsRowKey(selected) ||
          soSheets.some((sheet) =>
            sheet.rows.some((current) => current.id === saved.id),
          )
        ) {
          throw new StockApiError(UNCERTAIN_SAVE, true);
        }
        return saved;
      },
      (saved) => {
        const sheets = appendStockProductsSoRow(soSheets, saved);
        const sheet = sheets.find(
          (current) => current.name === saved.sheet_name,
        );
        setWorkbook((previous) => ({ ...previous, so_sheets: sheets }));
        setSoEditor(null);
        setSelectedSheet(saved.sheet_name);
        setSoSearch("");
        setSoPage(
          Math.max(1, Math.ceil((sheet?.rows.length ?? 0) / PAGE_SIZE)),
        );
      },
      "เพิ่มรายการ SO เรียบร้อยแล้ว",
    );
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

      {loadState.loading && (
        <p
          role="status"
          className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
        >
          กำลังโหลดข้อมูลจากฐานข้อมูล...
        </p>
      )}
      {(loadState.error || refreshRequired) && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger"
        >
          {loadState.error ||
            "กรุณาปิดฟอร์มและโหลดข้อมูลใหม่ก่อนบันทึกอีกครั้ง"}
        </p>
      )}
      {isSaving && (
        <p
          role="status"
          className="fixed right-4 bottom-4 z-1000 max-w-sm rounded-lg border border-border bg-background p-4 text-sm shadow-lg"
        >
          กำลังบันทึกข้อมูล...
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{COPY.storage}</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              loadState.loading ||
              isSaving ||
              Boolean(stockEditor || dailyEditor || soEditor || deleteTarget)
            }
            onClick={reloadWorkbook}
          >
            โหลดข้อมูลใหม่
          </Button>
        </div>
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
                        {loadState.loading ? "กำลังโหลด..." : COPY.noStock}
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
                              aria-label={`ลบสินค้า ${row.item.name}`}
                              className="text-danger"
                              onClick={() => openDeleteProduct(row)}
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
                        {loadState.loading ? "กำลังโหลด..." : COPY.noSo}
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
        {COPY.databaseHint} · {COPY.stockHint} · {COPY.soHint}
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
          onSave={(row) => {
            void saveProduct(row);
          }}
          onCancel={() => {
            if (saveLock.current) return;
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
          onSave={(row) => {
            void saveDaily(row);
          }}
          onCancel={closeDailyEditor}
        />
      )}

      {soEditor && (
        <StockProductsSoForm
          key={soEditor.id}
          id={soEditor.id}
          initialSheet={soEditor.sheet}
          stockRows={stock.rows}
          onSave={(row) => {
            void saveSo(row);
          }}
          onCancel={() => {
            if (saveLock.current) return;
            setSoEditor(null);
            setSaveError("");
          }}
        />
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeDeleteProduct();
        }}
      >
        <DialogContent
          className="w-[calc(100vw-2rem)] sm:max-w-md"
          showCloseButton={!isSaving}
        >
          <DialogTitle>ยืนยันการลบสินค้า</DialogTitle>
          <DialogDescription>
            สินค้าจะถูกนำออกจากสต็อกของเดือนที่แสดง โดยไม่ลบทะเบียนสินค้า
            ข้อมูลรับ-จ่าย หรือ SO ออกจากฐานข้อมูล
          </DialogDescription>
          {deleteTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/25 p-4">
                <p className="font-semibold">{deleteTarget.item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {monthLabel(stock.period.year_be, stock.period.month)}
                </p>
                <p className="text-xs text-muted-foreground">
                  รหัสสินค้า: {originalCell(deleteTarget.item.code)} ·
                  ข้อมูลรายวัน {deleteTarget.daily.length} วัน
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={closeDeleteProduct}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    void confirmDeleteProduct();
                  }}
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
