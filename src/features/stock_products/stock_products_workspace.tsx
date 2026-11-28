"use client";

import {
  RowActionItem,
  RowActionMenu,
} from "@/src/components/factory/row-action-menu";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Boxes,
  CalendarDays,
  FileSpreadsheet,
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
import { StockProductsImportDialog } from "./import/stock_products_import_dialog";

import {
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
  validateStockProductsImportedSoRow,
  validateStockProductsSoSheetCoverage,
  STOCK_PRODUCTS_DAILY_FIELDS,
  STOCK_PRODUCTS_EXCEL_SO_COLUMNS,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  type StockProductsDailyField,
  type StockProductsDailyValues,
  type StockProductsMonth,
  type StockProductsRawCell,
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
  desc: "จัดการสต็อกสินค้า รับ-จ่ายรายวัน และรายการ SO ",
  storage: "",
  stock: "สต็อกสินค้าคงเหลือ",
  productCount: "รายการสินค้า",
  dailyCount: "รายการรับ-จ่ายรายวัน",
  soCount: "บรรทัดรายการ SO",

  stockGroup: "เลือก SO",
  allStockGroups: "สรุปสินค้าสำเร็จรูปคงเหลือ FF",
  unassignedStockGroup: "ไม่ระบุหมวด",
  stockSearch: "ค้นหาสินค้า",
  stockPlaceholder: "ค้นหารหัสสินค้า ชื่อ หรือประเภท",
  soSearch: "ค้นหารายการ SO",
  soPlaceholder: "ค้นหาวันที่ เลข SO ลูกค้า หรือชื่อสินค้า",
  noSo: "ไม่พบรายการที่มีเลข SO ในชีตหรือคำค้นหาที่เลือก",
  soDate: "วันที่ SO",
  soNumber: "เลข SO",
  customer: "ลูกค้า",
  soQuantity: "จำนวน SO",
  sheetHint:
    "",
  noStock: "ไม่พบรายการสินค้าที่ตรงกับการค้นหา",
  dailyButton: "ดูรายวัน",
  dailyTitle: "รายละเอียดรับ-จ่ายรายวัน",
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
  group: "SO",
  code: "รหัสสินค้า",
  productName: "ชื่อสินค้า",
  unit: "หน่วย",
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
  soHint: "รายการ SO ทุกเดือนและทุกปี ไม่หักยอดสต็อกอัตโนมัติ",
  databaseHint: "ข้อมูลจากฐานข้อมูล ไม่นำเข้า Local Storage อัตโนมัติ",
  dailyHint: "แสดงครบทุกวันในเดือน รวมวันที่ไม่มีการเคลื่อนไหว",
  stockDetail: "ข้อมูลสินค้า",
  dailyRows: "วันที่มีรายการ",
  importExcel: "นำเข้า Excel",
  importHint:
    "เมื่อยืนยันการนำเข้า ระบบจะแทนที่ Stock เฉพาะงวดนี้ และ SO ทุกเดือนทุกปีทั้ง 16 ชีต รวมถึง SO ที่เพิ่มด้วยตนเอง ตาม Excel ล่าสุด",
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

const ALL_STOCK_GROUPS = "ALL";
const UNASSIGNED_STOCK_GROUP = "UNASSIGNED";
const STOCK_GROUP_PREFIX = "group:";
const SO_SHEET_PREFIX = "so:";

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

// item_group is already provided by the API as row.item.group.
// Treat blank/whitespace-only groups as unassigned; never modify source rows.
function stockGroupValue(group: string | null): string {
  const label = group?.trim();
  return label ? `${STOCK_GROUP_PREFIX}${label}` : UNASSIGNED_STOCK_GROUP;
}

function hasSoNumber(row: StockProductsSoRow): boolean {
  return row.so_number.trim().length > 0;
}

function selectedSoSheetName(
  value: string,
): StockProductsSoSheetName | undefined {
  return STOCK_PRODUCTS_SO_SHEET_NAMES.find(
    (name) => value === `${SO_SHEET_PREFIX}${name}`,
  );
}

function buildStockGroupOptions(
  rows: readonly StockProductsStockRow[],
  sheets: StockProductsWorkbook["so_sheets"],
  selectedGroup: string,
): { value: string; label: string }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = stockGroupValue(row.item.group);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  // Preserve the selected group with a zero count if its last item is deleted.
  if (
    selectedGroup.startsWith(STOCK_GROUP_PREFIX) &&
    !counts.has(selectedGroup)
  ) {
    counts.set(selectedGroup, 0);
  }

  const groups = [...counts.entries()]
    .filter(([value]) => value !== UNASSIGNED_STOCK_GROUP)
    .sort(([left], [right]) => left.localeCompare(right, "th-TH"));

  const soCounts = new Map(
    sheets.map((sheet) => [sheet.name, sheet.rows.filter(hasSoNumber).length]),
  );

  // Sheet and stock-group options have different identities and count units.
  // Never infer a stock item's SO relationship from its name or group.
  return [
    {
      value: ALL_STOCK_GROUPS,
      label: `${COPY.allStockGroups} `,
    },
    ...STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => ({
      value: `${SO_SHEET_PREFIX}${name}`,
      label: `${name} (${(soCounts.get(name) ?? 0).toLocaleString("th-TH")} SO)`,
    })),
    ...groups.map(([value, count]) => ({
      value,
      label: `Stock · ${value.slice(STOCK_GROUP_PREFIX.length)} (${count.toLocaleString("th-TH")} สินค้า)`,
    })),
    {
      value: UNASSIGNED_STOCK_GROUP,
      label: `Stock · ${COPY.unassignedStockGroup} (${(counts.get(UNASSIGNED_STOCK_GROUP) ?? 0).toLocaleString("th-TH")} สินค้า)`,
    },
  ];
}

function filterStockRowsByGroup(
  rows: readonly StockProductsStockRow[],
  selectedGroup: string,
  search: string,
): StockProductsStockRow[] {
  const groupRows =
    selectedGroup === ALL_STOCK_GROUPS
      ? rows
      : rows.filter((row) => stockGroupValue(row.item.group) === selectedGroup);
  return filterStockProductsRows(groupRows, search);
}

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

function isSoRawCell(value: unknown): value is StockProductsRawCell {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.includes("\0")) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isSoRow(value: unknown): value is StockProductsSoRow {
  if (!isRecord(value)) return false;

  const sheetName = STOCK_PRODUCTS_SO_SHEET_NAMES.find(
    (name) => name === value.sheet_name,
  );
  const supplementaryCount =
    STOCK_PRODUCTS_EXCEL_SO_COLUMNS.supplementary_last -
    STOCK_PRODUCTS_EXCEL_SO_COLUMNS.supplementary_first +
    1;

  if (
    !isDatabaseId(value.id) ||
    !sheetName ||
    typeof value.source_row !== "number" ||
    !Number.isSafeInteger(value.source_row) ||
    value.source_row < 0 ||
    typeof value.date_raw !== "string" ||
    typeof value.customer_name !== "string" ||
    !value.customer_name.trim() ||
    typeof value.so_number !== "string" ||
    !value.so_number.trim() ||
    typeof value.product_name !== "string" ||
    !value.product_name.trim() ||
    typeof value.quantity !== "string" ||
    !value.quantity.trim() ||
    !Number.isFinite(Number(value.quantity)) ||
    typeof value.unit !== "string" ||
    !Array.isArray(value.supplementary_cells) ||
    value.supplementary_cells.length !== supplementaryCount ||
    !value.supplementary_cells.every(isSoRawCell)
  ) {
    return false;
  }

  if (value.stock_row_key === undefined) {
    // Independent Excel rows have a database ID after saving, but no stock link.
    // The import validator expects a source row without its generated ID.
    if (
      typeof value.source_date_text !== "string" ||
      (value.document_date !== null && typeof value.document_date !== "string")
    ) {
      return false;
    }

    return (
      Object.keys(
        validateStockProductsImportedSoRow({
          sheet_name: sheetName,
          source_row: value.source_row,
          date_raw: value.date_raw,
          document_date: value.document_date,
          source_date_text: value.source_date_text,
          customer_name: value.customer_name,
          so_number: value.so_number,
          product_name: value.product_name,
          quantity: value.quantity,
          unit: value.unit,
          supplementary_cells: value.supplementary_cells,
        }),
      ).length === 0
    );
  }

  // Manually created/legacy SO rows still require a real date and stock ID.
  return (
    typeof value.stock_row_key === "string" &&
    value.stock_row_key.startsWith("stock:local:") &&
    isDatabaseId(value.stock_row_key.slice("stock:local:".length)) &&
    !value.date_raw.startsWith("0000-") &&
    isValidStockProductsAddedDate(value.date_raw) &&
    (value.document_date === undefined ||
      value.document_date === value.date_raw) &&
    (value.source_date_text === undefined ||
      typeof value.source_date_text === "string")
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
                    <RowActionMenu>
                      <RowActionItem
                        type="button"
                        disabled={readOnly}
                        onClick={() => onEdit(date)}
                      >
                        {record ? (
                          <Pencil aria-hidden="true" />
                        ) : (
                          <Plus aria-hidden="true" />
                        )}
                        {record ? "แก้ไข" : "บันทึก"}
                      </RowActionItem>
                    </RowActionMenu>
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

/** Display one row per SO line, including repeated order numbers. */
function StockProductsSoTable({
  rows,
  stockRows,
  loading,
}: {
  rows: readonly StockProductsSoRow[];
  stockRows: readonly StockProductsStockRow[];
  loading: boolean;
}) {
  const stockCodes = new Map(
    stockRows.map((row) => [stockProductsRowKey(row), row.item.code]),
  );

  return (
    <Table
      className="min-w-250 text-xs"
      containerProps={{
        className: "min-w-0 max-w-full border-t border-border",
        tabIndex: 0,
        role: "region",
        "aria-label": "รายการ SO",
      }}
    >
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="min-w-28">{COPY.soDate}</TableHead>
          <TableHead className="min-w-36">{COPY.soNumber}</TableHead>
          <TableHead className="min-w-48">{COPY.customer}</TableHead>
          <TableHead className="min-w-32">{COPY.code}</TableHead>
          <TableHead className="min-w-80">{COPY.productName}</TableHead>
          <TableHead className="min-w-24 text-right">
            {COPY.soQuantity}
          </TableHead>
          <TableHead className="min-w-18">{COPY.unit}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="py-10 text-center text-muted-foreground"
            >
              {loading ? "กำลังโหลด..." : COPY.noSo}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={stockProductsSoRowKey(row)}>
              <TableCell
                className="whitespace-nowrap tabular-nums"
                title={row.source_date_text ?? undefined}
              >
                {originalCell(row.date_raw)}
                {row.document_date === null && (
                  <span className="block text-xs text-amber-700 dark:text-amber-400">
                    {String(row.date_raw ?? "").trim()
                      ? "วันที่ไม่ถูกต้อง"
                      : "ไม่ระบุวันที่"}
                  </span>
                )}
              </TableCell>
              <TableCell className="font-mono">{row.so_number}</TableCell>
              <TableCell className="max-w-64 whitespace-normal wrap-break-word">
                {originalCell(row.customer_name)}
              </TableCell>
              <TableCell className="font-mono">
                {originalCell(
                  row.stock_row_key
                    ? (stockCodes.get(row.stock_row_key) ?? null)
                    : null,
                )}
              </TableCell>
              <TableCell className="max-w-96 whitespace-normal wrap-break-word font-medium">
                {originalCell(row.product_name)}
              </TableCell>
              <TableCell className={QUANTITY_CLASSES}>
                {originalCell(row.quantity)}
              </TableCell>
              <TableCell>{originalCell(row.unit)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export function StockProductsWorkspace() {
  const stockSearchId = useId();
  const [stockSearch, setStockSearch] = useState("");
  const [selectedStockGroup, setSelectedStockGroup] =
    useState(ALL_STOCK_GROUPS);
  const [stockPage, setStockPage] = useState(1);
  const [selectedStockKey, setSelectedStockKey] = useState<string | null>(null);
  const [stockEditor, setStockEditor] = useState<StockEditor | null>(null);
  const [dailyEditor, setDailyEditor] = useState<DailyEditor | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<StockProductsStockRow | null>(null);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [importOpen, setImportOpen] = useState(false);

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
    isSaving ||
    importOpen;

  const selectedStockRow =
    stock.rows.find((row) => stockProductsRowKey(row) === selectedStockKey) ??
    null;
  const selectedSoSheet = selectedSoSheetName(selectedStockGroup);
  const stockGroupOptions = useMemo(
    () => buildStockGroupOptions(stock.rows, soSheets, selectedStockGroup),
    [stock.rows, soSheets, selectedStockGroup],
  );
  const stockRows = useMemo(
    () => filterStockRowsByGroup(stock.rows, selectedStockGroup, stockSearch),
    [stock.rows, selectedStockGroup, stockSearch],
  );
  const soRows = useMemo(
    () =>
      selectedSoSheet
        ? filterStockProductsSoRows(soSheets, {
            sheet: selectedSoSheet,
            search: stockSearch,
          }).filter(hasSoNumber)
        : [],
    [soSheets, selectedSoSheet, stockSearch],
  );
  const selectedSoCount = selectedSoSheet
    ? (soSheets
        .find((sheet) => sheet.name === selectedSoSheet)
        ?.rows.filter(hasSoNumber).length ?? 0)
    : 0;
  const visibleRowCount = selectedSoSheet ? soRows.length : stockRows.length;
  const currentStockPage = Math.min(
    stockPage,
    Math.max(1, Math.ceil(visibleRowCount / PAGE_SIZE)),
  );
  const stockPageRows = stockRows.slice(
    (currentStockPage - 1) * PAGE_SIZE,
    currentStockPage * PAGE_SIZE,
  );
  const soPageRows = soRows.slice(
    (currentStockPage - 1) * PAGE_SIZE,
    currentStockPage * PAGE_SIZE,
  );
  const movementDays = useMemo(
    () => stock.rows.reduce((sum, row) => sum + row.daily.length, 0),
    [stock.rows],
  );

  function clearFeedback() {
    setSaveError("");
    setNotice("");
  }

  function reloadWorkbook() {
    if (
      saveLock.current ||
      loadState.loading ||
      importOpen ||
      stockEditor ||
      dailyEditor ||
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

  /* ---------------- Excel import ---------------- */

  function openImportExcel() {
    if (
      readOnly ||
      saveLock.current ||
      stockEditor ||
      dailyEditor ||
      deleteTarget ||
      selectedStockRow
    ) {
      return;
    }

    clearFeedback();
    setImportOpen(true);
  }

  function handleImported(inserted: number, insertedSo: number) {
    // The committed replacement invalidates the old Stock and SO lists.
    // Keep the result dialog open and reset the stock filters.
    setSelectedStockKey(null);
    setSelectedStockGroup(ALL_STOCK_GROUPS);
    setStockSearch("");
    setStockPage(1);
    setSaveError("");
    setNotice(
      `นำเข้า Excel สำเร็จ: Stock ${inserted.toLocaleString("th-TH")} รายการ สำหรับงวด ${monthLabel(stock.period.year_be, stock.period.month)} และ SO ${insertedSo.toLocaleString("th-TH")} รายการ ทุกเดือนทุกปีตาม Excel ล่าสุด`,
    );

    // Do not display the replaced lists or append rows from the preview.
    // Only a successful canonical GET may re-enable editing.
    setWorkbook(EMPTY_WORKBOOK);
    setRefreshRequired(true);
    setLoadState({ loading: true, error: "" });
    setRefreshToken((previous) => previous + 1);
  }

  function handleImportReloadRequired(message: string) {
    setRefreshRequired(true);
    setNotice("");
    setSaveError(message);
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
        // Reveal the saved item even when it belongs to another group.
        setSelectedStockGroup(ALL_STOCK_GROUPS);
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
          confirm_hard_delete: true,
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
        const deletedKey = stockProductsRowKey(target);

        // The API deletes the product and its linked SO rows atomically.
        // Remove only the confirmed item and matching SO keys from local state.
        setWorkbook((previous) => ({
          ...previous,
          stock: {
            ...previous.stock,
            rows: previous.stock.rows.filter(
              (row) => row.item.id !== deletedId,
            ),
          },
          so_sheets: previous.so_sheets.map((sheet) => ({
            ...sheet,
            rows: sheet.rows.filter((row) => row.stock_row_key !== deletedKey),
          })),
        }));
        if (selectedStockKey === deletedKey) {
          setSelectedStockKey(null);
        }
        setDeleteTarget(null);
        setStockPage(currentStockPage);

        // Reload both Stock and SO from the database before allowing writes.
        setRefreshRequired(true);
        setLoadState({ loading: true, error: "" });
        setRefreshToken((previous) => previous + 1);
      },
      "ลบสินค้าและ SO ที่เชื่อมโยงแบบถาวรเรียบร้อยแล้ว",
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

  function chooseStockGroup(next: string) {
    if (!stockGroupOptions.some((option) => option.value === next)) return;
    setSelectedStockGroup(next);
    setStockSearch("");
    setStockPage(1);
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <PageHeader
        title={COPY.title}
        description={COPY.desc}
        actions={
          <>
            {/* <Badge variant="outline">{COPY.storage}</Badge> */}
            <Button
              type="button"
              variant="outline"
              disabled={readOnly}
              title={COPY.importHint}
              onClick={openImportExcel}
            >
              <FileSpreadsheet
                className="size-4 text-emerald-600"
                aria-hidden="true"
              />
              {COPY.importExcel}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={readOnly}
              onClick={openCreateProduct}
            >
              <Plus className="size-4" aria-hidden="true" />
              เพิ่มสินค้า
            </Button>
          </>
        }
      />

      {loadState.loading && (
        <p
          role="status"
          className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground"
        >
          กำลังโหลดข้อมูลจากฐานข้อมูล...
        </p>
      )}
      {(loadState.error || (refreshRequired && !loadState.loading)) && (
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
              importOpen ||
              Boolean(stockEditor || dailyEditor || deleteTarget)
            }
            onClick={reloadWorkbook}
          >
            โหลดข้อมูลใหม่
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
        {[
          { label: COPY.productCount, value: stock.rows.length, Icon: Boxes },
          { label: COPY.dailyCount, value: movementDays, Icon: CalendarDays }
  
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

      <section
        className="w-full min-w-0 max-w-full space-y-4"
        aria-label={COPY.stock}
      >
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]">
            <SelectField
              label={COPY.stockGroup}
              value={selectedStockGroup}
              onChange={chooseStockGroup}
              options={stockGroupOptions}
              disabled={loadState.loading}
            />
            <div className="min-w-0 space-y-2">
              <Label htmlFor={stockSearchId}>
                {selectedSoSheet ? COPY.soSearch : COPY.stockSearch}
              </Label>
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
                  placeholder={
                    selectedSoSheet ? COPY.soPlaceholder : COPY.stockPlaceholder
                  }
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {visibleRowCount.toLocaleString("th-TH")}/
                {(selectedSoSheet
                  ? selectedSoCount
                  : stock.rows.length
                ).toLocaleString("th-TH")}{" "}
                {selectedSoSheet ? COPY.soCount : COPY.productCount}
              </Badge>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {COPY.sheetHint}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {COPY.importHint}
          </p>
        </div>
        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold">
              {selectedSoSheet ? `รายการ SO · ${selectedSoSheet}` : COPY.stock}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedSoSheet ? COPY.soHint : COPY.stockHint}
            </p>
          </div>
          {selectedSoSheet ? (
            <>
              <StockProductsSoTable
                rows={soPageRows}
                stockRows={stock.rows}
                loading={loadState.loading}
              />
              <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground sm:px-5">
                รหัสสินค้าจะแสดงเฉพาะเมื่อ SO เชื่อมโยงกับ Stock ในงวดนี้ โดยตรง
                ขีด (-) หมายถึงไม่พบรหัสที่เชื่อมโยง
              </p>
            </>
          ) : (
            <Table
              className="min-w-560 text-xs"
              containerProps={{
                className: "min-w-0 max-w-full border-t border-border",
                tabIndex: 0,
                role: "region",
                "aria-label": COPY.stock,
              }}
            >
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="min-w-24 text-center">
                    {COPY.group}
                  </TableHead>
                  <TableHead className="min-w-32">{COPY.code}</TableHead>
                  <TableHead className="min-w-80">{COPY.productName}</TableHead>
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
                  <TableHead className="min-w-28">{COPY.dailyButton}</TableHead>
                  <TableHead className="min-w-28 text-center">จัดการ</TableHead>
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
                      <TableCell className="whitespace-nowrap text-center font-medium">
                        {originalCell(row.item.group)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {originalCell(row.item.code)}
                      </TableCell>
                      <TableCell className="max-w-96 whitespace-normal wrap-break-word font-medium">
                        {row.item.name.trim()}
                      </TableCell>
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
                        <RowActionMenu>
                          <RowActionItem
                            type="button"
                            disabled={readOnly}
                            title="แก้ไขสินค้า"
                            aria-label={`แก้ไข ${row.item.name}`}
                            onClick={() => openEditProduct(row)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            แก้ไขสินค้า
                          </RowActionItem>
                          <RowActionItem
                            type="button"
                            disabled={readOnly}
                            title="ลบสินค้า"
                            aria-label={`ลบสินค้า ${row.item.name}`}
                            onClick={() => openDeleteProduct(row)}
                            className="w-full justify-start text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            ลบสินค้า
                          </RowActionItem>
                        </RowActionMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          <StockProductsPagination
            page={currentStockPage}
            total={visibleRowCount}
            itemLabel={selectedSoSheet ? COPY.soCount : COPY.productCount}
            onPageChange={setStockPage}
          />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {COPY.databaseHint} · {COPY.stockHint} · {COPY.soHint}
      </p>

      <StockProductsImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        period={stock.period}
        onImported={handleImported}
        onReloadRequired={handleImportReloadRequired}
      />

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
          <DialogTitle>ยืนยันการลบสินค้าถาวร</DialogTitle>
          <DialogDescription>
            ระบบจะลบทะเบียนสินค้า ยอดสรุป ข้อมูลรับ-จ่ายรายวัน และ SO
            ทุกรายการที่เชื่อมโยงกับสินค้านี้ในทุกชีต แม้ SO จะอยู่คนละเดือน
            ไม่รวม SO จาก Excel ที่ไม่ได้เชื่อมโยงกับสินค้า
            ข้อมูลที่ถูกลบจะไม่สามารถ เรียกคืนจากหน้านี้ได้
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
                  variant="destructive"
                  disabled={readOnly}
                  onClick={() => {
                    void confirmDeleteProduct();
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {isSaving ? "กำลังลบ..." : "ลบสินค้าและ SO ถาวร"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
