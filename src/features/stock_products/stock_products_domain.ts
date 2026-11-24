/**
 * Finished-product stock FF: UI-mock domain contracts.
 *
 * Source workbook: 1 finished-product summary worksheet and 16 SO worksheets.
 * Source workbook data is a snapshot, not an API or a live inventory ledger.
 *
 * IMPORTANT:
 * - SO records are independent reference rows. They never deduct stock.
 * - Item codes and names are not unique keys; use sheet and Excel row.
 * - Empty cells remain distinct from the numeric value zero.
 * - SO dates may be Excel numbers or literal text. Preserve the raw cell.
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
export type StockProductsSummaryValues =
  Record<StockProductsSummaryField, string>;

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
  /** Physical row number in the source Excel summary sheet. */
  source_row: number;
  no: number | null; // A : may restart or be blank
  group: string | null; // B : do not fill down blank source cells
  code: string | null; // C : may be blank or repeated
  name: string; // D
  unit: string | null; // E
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

/** An SO date is intentionally raw: some source cells are malformed. */
export type StockProductsSourceDate = string | number | null;
export type StockProductsRawCell = string | number | boolean | null;

export interface StockProductsSoRow {
  /** Sheet + Excel row identify a record. SO number alone is not unique. */
  sheet_name: StockProductsSoSheetName;
  source_row: number;
  date_raw: StockProductsSourceDate; // A : preserve Excel cell
  customer_name: string; // B
  so_number: string; // C
  product_name: string; // E
  quantity: string; // F : numeric-text, zero differs from blank
  unit: string; // G
  /** H:N source cells, retained without guessing their meanings. */
  supplementary_cells: StockProductsRawCell[];
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
export function datesInStockProductsMonth(period: StockProductsMonth): string[] {
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
  return `stock:${row.item.source_row}`;
}

export function stockProductsSoRowKey(row: StockProductsSoRow): string {
  return `so:${row.sheet_name}:${row.source_row}`;
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
    [row.item.code ?? "", row.item.name, row.item.group ?? "", row.item.unit ?? ""]
      .some((value) => normalizeSearch(value).includes(query)),
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
