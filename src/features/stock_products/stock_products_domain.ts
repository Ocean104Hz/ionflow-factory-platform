/**
 * Finished-product stock FF: shared domain contracts.
 *
 * Source workbook: 1 finished-product summary worksheet and 16 SO worksheets.
 * Source workbook data is a snapshot, not an API or a live inventory ledger.
 *
 * IMPORTANT:
 * - SO records never deduct stock. Manual SO rows reference existing stock rows.
 * - Excel SO rows are independent of stock and may have an invalid source date.
 * - Item codes and names are not unique keys; use sheet and Excel row.
 * - Empty cells remain distinct from the numeric value zero.
 * - Preserve the source date text separately from the normalized document date.
 * - Source summary and daily cells are not recalculated here.
 */

export const STOCK_PRODUCTS_SO_SHEET_NAMES = [
  "KA",
  "IB",
  "TY",
  "IV",
  "MAXNIC",
  "IFK",
  "K-ONE",
  "IAM",
  "IAT",
  "PN(\u0e1e\u0e23\u0e35\u0e2d\u0e2d\u0e19\u0e34\u0e04)",
  "MKS",
  "GREENNAX",
  "ODM-OLM",
  "FTW",
  "SAT",
  "WM",
] as const;

export type StockProductsSoSheetName =
  (typeof STOCK_PRODUCTS_SO_SHEET_NAMES)[number];

/** One date column group in the summary worksheet contains seven cells. */
export const STOCK_PRODUCTS_DAILY_FIELDS = [
  "received_in", // T + (day - 1) * 7 : received from production
  "received_return", // U : returned to stock
  "issued_customer", // V : delivered to customer
  "issued_promotion", // W : sales promotion
  "issued_office_sample", // X : office/sample use
  "issued_other", // Y : other issues
  "damaged", // Z : damaged items
] as const;

export type StockProductsDailyField =
  (typeof STOCK_PRODUCTS_DAILY_FIELDS)[number];
export type StockProductsDailyValues = Record<StockProductsDailyField, string>;

/** Summary source cells F:P. The worksheet's literal "total" cell is F. */
export const STOCK_PRODUCTS_SUMMARY_FIELDS = [
  "balance_quantity", // F : 'total' in source (do not infer opening stock)
  "received_in", // G : received
  "received_return", // H : returned
  "issued_customer", // I : customer
  "issued_promotion", // J : sales promotion
  "issued_office_sample", // K : office samples
  "issued_other", // L : other
  "damaged", // M : damaged
  "remaining_quantity", // N : remaining
  "physical_count", // O : stock count
  "count_difference", // P : difference
] as const;

export type StockProductsSummaryField =
  (typeof STOCK_PRODUCTS_SUMMARY_FIELDS)[number];
export type StockProductsSummaryValues = Record<
  StockProductsSummaryField,
  string
>;

export const STOCK_PRODUCTS_EXCEL_STOCK_COLUMNS = {
  item_no: 1, // A
  group: 2, // B
  code: 3, // C
  name: 4, // D
  unit: 5, // E
  summary_first: 6, // F
  summary_last: 16, // P
  remark: 17, // Q
  daily_first: 20, // T
  daily_field_count: 7,
  last_day: 31,
  daily_last: 236, // IB
} as const;

export const STOCK_PRODUCTS_EXCEL_SO_COLUMNS = {
  date: 1, // A
  customer_name: 2, // B
  so_number: 3, // C
  product_name: 5, // E
  quantity: 6, // F
  unit: 7, // G
  supplementary_first: 8, // H
  supplementary_last: 14, // N
} as const;

export interface StockProductsMonth {
  year_be: number;
  month: number;
}

export interface StockProductsItem {
  id?: string;
  added_date?: string | null;
  /** Legacy link from the combined form; preserve previously stored data. */
  so_row_id?: string | null;
  source_row: number;
  no: number | null;
  group: string | null;
  code: string | null;
  name: string;
  unit: string | null;
}

export interface StockProductsDailyEntry {
  /** Gregorian ISO date, e.g. 2026-10-01, derived from the month header. */
  date: string;
  values: StockProductsDailyValues;
}

export interface StockProductsStockRow {
  item: StockProductsItem;
  /** F:P: snapshot values copied from Excel; do not auto-sum daily data. */
  summary: StockProductsSummaryValues;
  remark: string; // Q
  /** T:IB: only days with source values need explicit entries. */
  daily: StockProductsDailyEntry[];
}

export interface StockProductsStockSheet {
  source_sheet_name: string;
  /** Literal heading, not inferred from the uploaded filename. */
  report_caption: string;
  period: StockProductsMonth;
  rows: StockProductsStockRow[];
}

/** Display value; legacy rows may contain Excel numbers or literal text. */
export type StockProductsSourceDate = string | number | null;
export type StockProductsRawCell = string | number | boolean | null;

export interface StockProductsSoRow {
  id?: string;
  /** Required by the manual SO form; omitted for independent Excel SO rows. */
  stock_row_key?: string;
  sheet_name: StockProductsSoSheetName;
  source_row: number;
  date_raw: StockProductsSourceDate;
  /** Gregorian ISO date, or null when the source date cannot be resolved. */
  document_date?: string | null;
  /** Text read from Excel before date normalization; optional for legacy rows. */
  source_date_text?: string;
  customer_name: string;
  so_number: string;
  product_name: string;
  quantity: string;
  unit: string;
  supplementary_cells: StockProductsRawCell[];
}

/** @deprecated Transitional contract for the previous combined form. */
export interface StockProductsNewSoDetails {
  sheet_name: StockProductsSoSheetName | "";
  date_raw: string;
  customer_name: string;
  so_number: string;
  quantity: string;
}

export interface StockProductsSoSheet {
  name: StockProductsSoSheetName;
  /** Empty worksheets are valid, including K-ONE in the source file. */
  rows: StockProductsSoRow[];
}

export interface StockProductsWorkbook {
  stock: StockProductsStockSheet;
  so_sheets: StockProductsSoSheet[];
}

export interface StockProductsSoFilters {
  sheet: StockProductsSoSheetName | "ALL";
  search: string;
}

export const DEFAULT_STOCK_PRODUCTS_SO_FILTERS: StockProductsSoFilters = {
  sheet: "ALL",
  search: "",
};

/** A blank input cell is not the same as the literal value '0'. */
export function blankStockProductsSummary(): StockProductsSummaryValues {
  return {
    balance_quantity: "",
    received_in: "",
    received_return: "",
    issued_customer: "",
    issued_promotion: "",
    issued_office_sample: "",
    issued_other: "",
    damaged: "",
    remaining_quantity: "",
    physical_count: "",
    count_difference: "",
  };
}

export function blankStockProductsDaily(): StockProductsDailyValues {
  return {
    received_in: "",
    received_return: "",
    issued_customer: "",
    issued_promotion: "",
    issued_office_sample: "",
    issued_other: "",
    damaged: "",
  };
}

/** 1-based Excel column index for a day + daily field; day 1 begins at T. */
export function stockProductsExcelDailyColumn(
  day: number,
  field: StockProductsDailyField,
): number {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("The Excel day must be between 1 and 31.");
  }

  const index = STOCK_PRODUCTS_DAILY_FIELDS.indexOf(field);
  if (index < 0) {
    throw new Error("Unknown daily stock-product field.");
  }

  return STOCK_PRODUCTS_EXCEL_STOCK_COLUMNS.daily_first + (day - 1) * 7 + index;
}

function isValidMonth(period: StockProductsMonth): boolean {
  return (
    Number.isInteger(period.year_be) &&
    period.year_be > 543 &&
    Number.isInteger(period.month) &&
    period.month >= 1 &&
    period.month <= 12
  );
}

/** Returns ISO days for the period; no date is taken from the filename. */
export function datesInStockProductsMonth(
  period: StockProductsMonth,
): string[] {
  if (!isValidMonth(period)) {
    return [];
  }

  const year = period.year_be - 543;
  const dayCount = new Date(Date.UTC(year, period.month, 0)).getUTCDate();
  const prefix = `${String(year).padStart(4, "0")}-${String(period.month).padStart(2, "0")}`;
  return Array.from(
    { length: dayCount },
    (_, dayIndex) => `${prefix}-${String(dayIndex + 1).padStart(2, "0")}`,
  );
}

/** Source-row identity is stable even when item codes or names repeat. */

export function stockProductsRowKey(row: StockProductsStockRow): string {
  return row.item.id
    ? `stock:local:${row.item.id}`
    : `stock:${row.item.source_row}`;
}

export function stockProductsSoRowKey(row: StockProductsSoRow): string {
  return row.id
    ? `so:local:${row.id}`
    : `so:${row.sheet_name}:${row.source_row}`;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH");
}

/** Filter the stock snapshot only. This does not consult SO records. */
export function filterStockProductsRows(
  rows: readonly StockProductsStockRow[],
  search: string,
): StockProductsStockRow[] {
  const query = normalizeSearch(search);
  if (!query) {
    return [...rows];
  }

  return rows.filter((row) =>
    [
      row.item.code ?? "",
      row.item.name,
      row.item.group ?? "",
      row.item.unit ?? "",
    ].some((value) => normalizeSearch(value).includes(query)),
  );
}

/** Search SO rows across one or all source worksheets; never alter stock. */
export function filterStockProductsSoRows(
  sheets: readonly StockProductsSoSheet[],
  filters: StockProductsSoFilters,
): StockProductsSoRow[] {
  const query = normalizeSearch(filters.search);
  const matched: StockProductsSoRow[] = [];

  for (const sheet of sheets) {
    if (filters.sheet !== "ALL" && sheet.name !== filters.sheet) {
      continue;
    }
    for (const row of sheet.rows) {
      if (
        !query ||
        [
          row.sheet_name,
          row.date_raw == null ? "" : String(row.date_raw),
          row.source_date_text ?? "",
          row.customer_name,
          row.so_number,
          row.product_name,
          row.quantity,
          row.unit,
        ].some((value) => normalizeSearch(value).includes(query))
      ) {
        matched.push(row);
      }
    }
  }

  return matched;
}

/** Preserve the original 16 SO tabs even when one contains zero entries. */
export function validateStockProductsSoSheetCoverage(
  sheets: readonly StockProductsSoSheet[],
): string[] {
  const errors: string[] = [];
  const names = new Set<StockProductsSoSheetName>();

  for (const sheet of sheets) {
    if (!STOCK_PRODUCTS_SO_SHEET_NAMES.includes(sheet.name)) {
      errors.push(`Unknown SO worksheet: ${sheet.name}`);
    }
    if (names.has(sheet.name)) {
      errors.push(`Duplicate SO worksheet: ${sheet.name}`);
    }
    names.add(sheet.name);
  }

  for (const name of STOCK_PRODUCTS_SO_SHEET_NAMES) {
    if (!names.has(name)) {
      errors.push(`Missing SO worksheet: ${name}`);
    }
  }

  return errors;
}

// --------------------------------------------------
// Stock Products Local Storage
// --------------------------------------------------

export const STOCK_PRODUCTS_STORAGE_KEY = "ionflow:stock-products:v1";

export const STOCK_PRODUCTS_STORAGE_VERSION = 1;

export interface StockProductsStoredData {
  version: typeof STOCK_PRODUCTS_STORAGE_VERSION;
  workbook: StockProductsWorkbook;
}

// --------------------------------------------------
// Create blank stock product
// --------------------------------------------------

export function blankStockProductsRow(id: string): StockProductsStockRow {
  return {
    item: {
      id,
      added_date: "",
      source_row: 0,
      no: null,
      group: "",
      code: "",
      name: "",
      unit: "",
    },
    summary: blankStockProductsSummary(),
    remark: "",
    daily: [],
  };
}

// --------------------------------------------------
// Create blank daily entry
// --------------------------------------------------

export function blankStockProductsDailyEntry(
  date: string,
): StockProductsDailyEntry {
  return {
    date,
    values: blankStockProductsDaily(),
  };
}

// --------------------------------------------------
// Create blank SO row
// --------------------------------------------------

export function blankStockProductsSoRow(
  id: string,
  sheetName: StockProductsSoSheetName,
): StockProductsSoRow {
  return {
    id,
    sheet_name: sheetName,
    source_row: 0,
    date_raw: "",
    customer_name: "",
    so_number: "",
    product_name: "",
    quantity: "",
    unit: "",
    supplementary_cells: [null, null, null, null, null, null, null],
  };
}

// --------------------------------------------------
// Form validation
// --------------------------------------------------

export type StockProductsFormErrors = Record<string, string>;

export function isValidStockProductsAddedDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateStockProductsRow(
  row: StockProductsStockRow,
  mode: "CREATE" | "EDIT" = "EDIT",
): StockProductsFormErrors {
  const errors: StockProductsFormErrors = {};

  if (!row.item.name.trim()) {
    errors.name = "กรุณาระบุชื่อสินค้า";
  }

  const addedDate = row.item.added_date?.trim() ?? "";

  if (!addedDate) {
    if (mode === "CREATE") {
      errors.added_date = "กรุณาระบุวันที่เพิ่มสินค้า";
    }
  } else if (!isValidStockProductsAddedDate(addedDate)) {
    errors.added_date = "กรุณาระบุวันที่ให้ถูกต้อง";
  }

  return errors;
}

export function validateStockProductsSoRow(
  row: Pick<
    StockProductsSoRow,
    "date_raw" | "customer_name" | "so_number" | "product_name" | "quantity"
  >,
): StockProductsFormErrors {
  const errors: StockProductsFormErrors = {};

  if (row.date_raw === null || String(row.date_raw).trim() === "") {
    errors.date_raw = "กรุณาระบุวันที่";
  }

  if (!row.customer_name.trim()) {
    errors.customer_name = "กรุณาระบุชื่อลูกค้า";
  }

  if (!row.so_number.trim()) {
    errors.so_number = "กรุณาระบุเลข SO";
  }

  if (!row.product_name.trim()) {
    errors.product_name = "กรุณาระบุชื่อสินค้า";
  }

  if (!row.quantity.trim()) {
    errors.quantity = "กรุณาระบุจำนวน";
  } else if (!Number.isFinite(Number(row.quantity))) {
    errors.quantity = "กรุณาระบุจำนวนเป็นตัวเลข";
  }

  return errors;
}

/** Validate an Excel SO row independently of stock and manual-form rules. */
export function validateStockProductsImportedSoRow(
  row: StockProductsSoRow,
): StockProductsFormErrors {
  const errors = validateStockProductsSoRow(row);

  // Excel rows may preserve an invalid or empty date without inventing one.
  // The parser supplies both date fields; legacy and manual rows need not.
  delete errors.date_raw;
  if (
    typeof row.source_date_text !== "string" ||
    row.source_date_text.includes("\0")
  ) {
    errors.source_date_text = "ไม่พบข้อความวันที่ต้นฉบับจาก Excel";
  }

  if (
    row.document_date !== null &&
    (typeof row.document_date !== "string" ||
      row.document_date.startsWith("0000-") ||
      !isValidStockProductsAddedDate(row.document_date))
  ) {
    errors.document_date = "วันที่จริงของ SO ไม่ถูกต้อง";
  }

  if (
    typeof row.date_raw !== "string" ||
    row.date_raw !== (row.document_date ?? row.source_date_text)
  ) {
    errors.date_raw = "วันที่แสดงผลไม่ตรงกับข้อมูลวันที่จาก Excel";
  }

  if (!STOCK_PRODUCTS_SO_SHEET_NAMES.includes(row.sheet_name)) {
    errors.sheet_name = "ไม่พบชีต SO ที่รองรับ";
  }

  if (!Number.isSafeInteger(row.source_row) || row.source_row < 1) {
    errors.source_row = "ลำดับแถว Excel ไม่ถูกต้อง";
  }

  // Source rows must not be linked by a guessed stock identity.
  if (row.stock_row_key !== undefined) {
    errors.stock_row_key = "รายการ SO จาก Excel ต้องไม่มีการจับคู่ Stock";
  }

  if (row.id !== undefined) {
    errors.id = "รายการ SO จาก Excel ต้องไม่มี ID จากฐานข้อมูล";
  }

  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(
      row.quantity.trim(),
    ) ||
    !Number.isFinite(Number(row.quantity))
  ) {
    errors.quantity = "กรุณาตรวจสอบค่าจำนวนสินค้าใน Excel";
  }

  const supplementaryCount =
    STOCK_PRODUCTS_EXCEL_SO_COLUMNS.supplementary_last -
    STOCK_PRODUCTS_EXCEL_SO_COLUMNS.supplementary_first +
    1;
  if (
    row.supplementary_cells.length !== supplementaryCount ||
    !row.supplementary_cells.every(
      (value) =>
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "string" && !value.includes("\0")) ||
        (typeof value === "number" && Number.isFinite(value)),
    )
  ) {
    errors.supplementary_cells = "ข้อมูลเพิ่มเติม SO คอลัมน์ H ถึง N ไม่ถูกต้อง";
  }

  return errors;
}

/** @deprecated Transitional validator for the previous combined form. */
export function validateStockProductsNewSoDetails(
  details: StockProductsNewSoDetails,
  productName: string,
): StockProductsFormErrors {
  const errors = validateStockProductsSoRow({
    ...details,
    product_name: productName,
  });

  if (
    !STOCK_PRODUCTS_SO_SHEET_NAMES.some((name) => name === details.sheet_name)
  ) {
    errors.sheet_name = "กรุณาเลือกชีต SO";
  }

  const date = details.date_raw.trim();
  if (date && !isValidStockProductsAddedDate(date)) {
    errors.date_raw = "กรุณาระบุวันที่ SO ให้ถูกต้อง";
  }

  return errors;
}

// --------------------------------------------------
// Add or update stock product
// --------------------------------------------------

export function upsertStockProductsRow(
  rows: readonly StockProductsStockRow[],
  nextRow: StockProductsStockRow,
): StockProductsStockRow[] {
  const key = stockProductsRowKey(nextRow);

  const exists = rows.some((row) => stockProductsRowKey(row) === key);

  if (!exists) {
    return [...rows, nextRow];
  }

  return rows.map((row) => (stockProductsRowKey(row) === key ? nextRow : row));
}

// --------------------------------------------------
// Delete stock product
// --------------------------------------------------

export function removeStockProductsRow(
  rows: readonly StockProductsStockRow[],
  rowKey: string,
): StockProductsStockRow[] {
  return rows.filter((row) => stockProductsRowKey(row) !== rowKey);
}

// --------------------------------------------------
// Add or update daily entry
// --------------------------------------------------

export function upsertStockProductsDailyEntry(
  row: StockProductsStockRow,
  entry: StockProductsDailyEntry,
  period: StockProductsMonth,
): StockProductsStockRow {
  const validDates = datesInStockProductsMonth(period);

  if (!validDates.includes(entry.date)) {
    throw new Error("วันที่รับ-จ่ายไม่อยู่ในเดือนของเอกสาร");
  }

  const daily = row.daily.filter((record) => record.date !== entry.date);

  const hasValues = STOCK_PRODUCTS_DAILY_FIELDS.some(
    (field) => entry.values[field].trim() !== "",
  );

  if (hasValues) {
    daily.push(entry);
  }

  return {
    ...row,
    daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

// --------------------------------------------------
// Add SO row
// --------------------------------------------------

export function appendStockProductsSoRow(
  sheets: readonly StockProductsSoSheet[],
  nextRow: StockProductsSoRow,
): StockProductsSoSheet[] {
  const target = sheets.find((sheet) => sheet.name === nextRow.sheet_name);

  if (!target) {
    throw new Error("ไม่พบชีต SO ที่เลือก");
  }

  const key = stockProductsSoRowKey(nextRow);

  if (target.rows.some((row) => stockProductsSoRowKey(row) === key)) {
    throw new Error("พบรายการ SO ที่มี ID ซ้ำกัน");
  }

  return sheets.map((sheet) =>
    sheet.name === nextRow.sheet_name
      ? {
          ...sheet,
          rows: [...sheet.rows, nextRow],
        }
      : sheet,
  );
}

/** @deprecated Transitional helper for the previous combined form. */
export function createStockProductWithSo(
  workbook: StockProductsWorkbook,
  row: StockProductsStockRow,
  details: StockProductsNewSoDetails,
  soId: string,
): StockProductsWorkbook {
  const productErrors = validateStockProductsRow(row, "CREATE");
  const soErrors = validateStockProductsNewSoDetails(details, row.item.name);
  const error = [
    ...Object.values(productErrors),
    ...Object.values(soErrors),
  ][0];

  if (error) {
    throw new Error(error);
  }

  if (!row.item.id?.trim() || !soId.trim()) {
    throw new Error("ไม่สามารถระบุ ID ของสินค้าและรายการ SO ได้");
  }

  const key = stockProductsRowKey(row);
  if (
    workbook.stock.rows.some((current) => stockProductsRowKey(current) === key)
  ) {
    throw new Error("พบ ID สินค้าซ้ำกัน");
  }

  if (
    workbook.so_sheets.some((sheet) =>
      sheet.rows.some((current) => current.id === soId),
    )
  ) {
    throw new Error("พบ ID รายการ SO ซ้ำกัน");
  }

  const sheetName = STOCK_PRODUCTS_SO_SHEET_NAMES.find(
    (name) => name === details.sheet_name,
  );
  if (!sheetName) {
    throw new Error("ไม่พบชีต SO ที่เลือก");
  }

  const soRow: StockProductsSoRow = {
    ...blankStockProductsSoRow(soId, sheetName),
    date_raw: details.date_raw.trim(),
    customer_name: details.customer_name.trim(),
    so_number: details.so_number.trim(),
    product_name: row.item.name.trim(),
    quantity: details.quantity.trim(),
    unit: row.item.unit?.trim() ?? "",
  };

  const stockRow: StockProductsStockRow = {
    ...row,
    item: {
      ...row.item,
      added_date: row.item.added_date?.trim() ?? null,
      name: row.item.name.trim(),
      so_row_id: soId,
    },
  };

  const soSheets = appendStockProductsSoRow(workbook.so_sheets, soRow);

  return {
    ...workbook,
    stock: {
      ...workbook.stock,
      rows: [...workbook.stock.rows, stockRow],
    },
    so_sheets: soSheets,
  };
}

/** Validate a new SO against the stock list without changing imported SO rows. */
export function validateStockProductsSoForStock(
  row: StockProductsSoRow,
  rows: readonly StockProductsStockRow[],
): StockProductsFormErrors {
  const selected = rows.find(
    (current) => stockProductsRowKey(current) === row.stock_row_key,
  );
  const errors = validateStockProductsSoRow({
    ...row,
    product_name: selected?.item.name ?? "",
  });

  if (!selected || !selected.item.name.trim()) {
    delete errors.product_name;
    errors.stock_row_key = "กรุณาเลือกสินค้าจากสต็อก";
  }

  if (!STOCK_PRODUCTS_SO_SHEET_NAMES.includes(row.sheet_name)) {
    errors.sheet_name = "กรุณาเลือกชีต SO";
  }

  if (
    row.date_raw !== null &&
    String(row.date_raw).trim() !== "" &&
    (typeof row.date_raw !== "string" ||
      !isValidStockProductsAddedDate(row.date_raw.trim()))
  ) {
    errors.date_raw = "กรุณาระบุวันที่ SO ให้ถูกต้อง";
  }

  return errors;
}

/** Append only a new SO row. The stock rows and their summaries stay unchanged. */
export function appendStockProductsSoForStock(
  workbook: StockProductsWorkbook,
  row: StockProductsSoRow,
): StockProductsWorkbook {
  const error = Object.values(
    validateStockProductsSoForStock(row, workbook.stock.rows),
  )[0];

  if (error) {
    throw new Error(error);
  }

  const selected = workbook.stock.rows.find(
    (current) => stockProductsRowKey(current) === row.stock_row_key,
  );

  if (!selected) {
    throw new Error("ไม่พบสินค้าที่เลือกในสต็อก");
  }

  if (!row.id?.trim()) {
    throw new Error("ไม่สามารถระบุ ID รายการ SO ได้");
  }

  const key = stockProductsSoRowKey(row);
  if (
    workbook.so_sheets.some((sheet) =>
      sheet.rows.some((current) => stockProductsSoRowKey(current) === key),
    )
  ) {
    throw new Error("พบ ID รายการ SO ซ้ำกัน");
  }

  const nextRow: StockProductsSoRow = {
    ...blankStockProductsSoRow(row.id, row.sheet_name),
    stock_row_key: stockProductsRowKey(selected),
    date_raw: String(row.date_raw).trim(),
    customer_name: row.customer_name.trim(),
    so_number: row.so_number.trim(),
    product_name: selected.item.name.trim(),
    quantity: row.quantity.trim(),
    unit: row.unit.trim(),
  };

  return {
    ...workbook,
    so_sheets: appendStockProductsSoRow(workbook.so_sheets, nextRow),
  };
}
