/**
 * Stock RM FF 2569: UI MOCK ONLY.
 *
 * Domain types and pure helpers for editable Excel snapshots in React State.
 * No API, database, browser storage, or automatic Excel recalculation.
 *
 * Source workbook: Stock RM FF 2569.xlsx
 * - ST.RM 68  (the Excel worksheet name has one trailing space)
 * - ST.RM 69
 * - Jan through Dec (B.E. 2569)
 * - สรุปยอดรับ FF 69 (separate received-material report)
 *
 * The Excel heading "ราคา" is represented as "value" (total monetary
 * value). "เฉลี่ย" is represented as "average_price". Neither is derived
 * automatically from weight in this UI mock.
 */

export const STOCK_RM_MONTHS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;

export type StockRmMonth = (typeof STOCK_RM_MONTHS)[number];

/** Annual snapshots exist for 2568/2569; monthly sheets exist for 2569 only. */
export type StockRmPeriod =
  | { view: "YEAR"; year_be: 2568 | 2569 }
  | { view: "MONTH"; year_be: 2569; month: StockRmMonth };

/** First 15 numeric columns (C:Q), each source group has three metrics. */
export const STOCK_RM_MAIN_GROUPS = [
  { id: "opening", label: "ยกมา" },
  { id: "received", label: "รับเข้า" },
  { id: "combined", label: "รวม" },
  { id: "issued", label: "จ่าย" },
  { id: "closing", label: "คงเหลือ" },
] as const;

export const STOCK_RM_MAIN_METRICS = [
  { id: "weight", label: "น้ำหนัก" },
  { id: "average_price", label: "เฉลี่ย" },
  { id: "value", label: "ราคา" },
] as const;

export const STOCK_RM_MAIN_FIELDS = [
  "opening_weight",
  "opening_average_price",
  "opening_value",
  "received_weight",
  "received_average_price",
  "received_value",
  "combined_weight",
  "combined_average_price",
  "combined_value",
  "issued_weight",
  "issued_average_price",
  "issued_value",
  "closing_weight",
  "closing_average_price",
  "closing_value",
] as const;

export type StockRmMainField = (typeof STOCK_RM_MAIN_FIELDS)[number];

/**
 * U:Z (Sum) contains receipts and a breakdown of raw-material issues.
 * These are kept independently of the formulas in columns C:Q.
 */
export const STOCK_RM_TOTAL_FIELDS = [
  "total_received_weight",
  "total_received_value",
  "total_issued_for_production",
  "total_issued_adjustment",
  "total_issued_discarded",
  "total_issued_weight",
] as const;

export type StockRmTotalField = (typeof STOCK_RM_TOTAL_FIELDS)[number];

export const STOCK_RM_SUMMARY_FIELDS = [
  ...STOCK_RM_MAIN_FIELDS,
  ...STOCK_RM_TOTAL_FIELDS,
] as const;

export type StockRmSummaryField =
  (typeof STOCK_RM_SUMMARY_FIELDS)[number];

/** Five columns repeat for each calendar day and each annual month. */
export const STOCK_RM_MOVEMENT_FIELDS = [
  "received_weight",
  "received_value",
  "issued_for_production",
  "issued_adjustment",
  "issued_discarded",
] as const;

export type StockRmMovementField =
  (typeof STOCK_RM_MOVEMENT_FIELDS)[number];

export type StockRmSummaryValues = Record<StockRmSummaryField, string>;
export type StockRmMovementValues = Record<StockRmMovementField, string>;

/**
 * The source column "รายการ / New" contains a code, not a separate name.
 * Keep an optional name for a future verified mapping; do not invent one.
 * The workbook does not declare a universal weight unit in its headers.
 */
export interface StockRmItem {
  no: number;
  code_new: string;
  name: string | null;
}

export interface StockRmDailyEntry {
  date: string; // Gregorian YYYY-MM-DD
  values: StockRmMovementValues;
}

/** The annual sheets show the same five movement fields for Jan-Dec. */
export interface StockRmYearMonthEntry {
  month: StockRmMonth;
  values: StockRmMovementValues;
}

export interface StockRmRow {
  item: StockRmItem;
  summary: StockRmSummaryValues;
  remark: string; // Excel column R; empty string is an empty cell.
  daily: StockRmDailyEntry[]; // Monthly sheets only.
  year_months: StockRmYearMonthEntry[]; // Annual sheets only.
}

export interface StockRmSheet {
  id: string;
  period: StockRmPeriod;
  source_sheet_name: string;
  rows: StockRmRow[];
  created_at: string;
  updated_at: string;
}

export interface StockRmFilters {
  period: StockRmPeriod;
  search: string;
}

export const DEFAULT_STOCK_RM_FILTERS: StockRmFilters = {
  period: { view: "MONTH", year_be: 2569, month: 1 },
  search: "",
};

export type StockRmValidationErrors = Record<string, string>;

/** The 15th sheet is a separate report, not a thirteenth month. */
export const STOCK_RM_RECEIPT_REPORT_SHEET = "สรุปยอดรับ FF 69";

export interface StockRmReceiptValues {
  weight: string;
  value: string;
}

export interface StockRmReceiptMonth {
  month: StockRmMonth;
  values: StockRmReceiptValues;
}

export interface StockRmReceiptReportRow {
  item: StockRmItem;
  annual: StockRmReceiptValues;
  months: StockRmReceiptMonth[];
}

export interface StockRmReceiptReport {
  source_sheet_name: typeof STOCK_RM_RECEIPT_REPORT_SHEET;
  year_be: 2569;
  rows: StockRmReceiptReportRow[];
}

export function stockRmPeriodKey(period: StockRmPeriod): string {
  return period.view === "YEAR"
    ? `year-${period.year_be}`
    : `month-${period.year_be}-${String(period.month).padStart(2, "0")}`;
}

export function stockRmSourceSheetName(period: StockRmPeriod): string {
  if (period.view === "YEAR") {
    // Do not trim: the workbook's 2568 worksheet really ends in a space.
    return period.year_be === 2568 ? "ST.RM 68 " : "ST.RM 69";
  }

  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ] as const;

  return names[period.month - 1];
}

export function blankStockRmSummary(): StockRmSummaryValues {
  return Object.fromEntries(
    STOCK_RM_SUMMARY_FIELDS.map((field) => [field, ""]),
  ) as StockRmSummaryValues;
}

export function blankStockRmMovement(): StockRmMovementValues {
  return {
    received_weight: "",
    received_value: "",
    issued_for_production: "",
    issued_adjustment: "",
    issued_discarded: "",
  };
}

export function blankStockRmSheet(
  period: StockRmPeriod,
  items: readonly StockRmItem[] = [],
): StockRmSheet {
  return {
    id: stockRmPeriodKey(period),
    period: { ...period },
    source_sheet_name: stockRmSourceSheetName(period),
    rows: items.map((item) => ({
      item: { ...item },
      summary: blankStockRmSummary(),
      remark: "",
      daily: [],
      year_months: [],
    })),
    created_at: "",
    updated_at: "",
  };
}

/** Reject non-existent dates and dates outside the selected month. */
export function isStockRmDateInMonth(
  date: string,
  period: StockRmPeriod,
): boolean {
  if (period.view !== "MONTH" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    year === period.year_be - 543 &&
    month === period.month &&
    day >= 1 &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

/**
 * Empty source cells are not zero. This validates number syntax only.
 * Signed decimals are accepted because no restriction on adjustments or
 * negative balances has been agreed; no calculations are performed here.
 */
export function isValidStockRmNumber(value: string): boolean {
  const text = value.trim();
  return text === "" || /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text);
}

function patchStockRmRow(
  sheet: StockRmSheet,
  codeNew: string,
  update: (row: StockRmRow) => StockRmRow,
): StockRmSheet {
  if (!sheet.rows.some((row) => row.item.code_new === codeNew)) {
    throw new Error(`Unknown Stock RM FF item: ${codeNew}`);
  }

  return {
    ...sheet,
    rows: sheet.rows.map((row) =>
      row.item.code_new === codeNew ? update(row) : row,
    ),
  };
}

/** Pure state update: does not save the sheet or change other fields. */
export function updateStockRmSummary(
  sheet: StockRmSheet,
  codeNew: string,
  field: StockRmSummaryField,
  value: string,
): StockRmSheet {
  return patchStockRmRow(sheet, codeNew, (row) => ({
    ...row,
    summary: { ...row.summary, [field]: value },
  }));
}

export function updateStockRmRemark(
  sheet: StockRmSheet,
  codeNew: string,
  value: string,
): StockRmSheet {
  return patchStockRmRow(sheet, codeNew, (row) => ({
    ...row,
    remark: value,
  }));
}

/** For monthly sheets only; insert a missing date in chronological order. */
export function updateStockRmDaily(
  sheet: StockRmSheet,
  codeNew: string,
  date: string,
  field: StockRmMovementField,
  value: string,
): StockRmSheet {
  if (!isStockRmDateInMonth(date, sheet.period)) {
    throw new Error("The daily date is outside the selected RM month.");
  }

  return patchStockRmRow(sheet, codeNew, (row) => {
    const existing = row.daily.find((entry) => entry.date === date);
    const nextEntry: StockRmDailyEntry = {
      date,
      values: {
        ...(existing?.values ?? blankStockRmMovement()),
        [field]: value,
      },
    };

    return {
      ...row,
      daily: existing
        ? row.daily.map((entry) => (entry.date === date ? nextEntry : entry))
        : [...row.daily, nextEntry].sort((left, right) =>
            left.date.localeCompare(right.date),
          ),
    };
  });
}

/** Annual sheets contain a five-field summary for each month. */
export function updateStockRmYearMonth(
  sheet: StockRmSheet,
  codeNew: string,
  month: StockRmMonth,
  field: StockRmMovementField,
  value: string,
): StockRmSheet {
  if (sheet.period.view !== "YEAR") {
    throw new Error("Monthly sheets do not contain annual month summaries.");
  }
  if (!STOCK_RM_MONTHS.includes(month)) {
    throw new Error("The annual RM month is invalid.");
  }

  return patchStockRmRow(sheet, codeNew, (row) => {
    const existing = row.year_months.find((entry) => entry.month === month);
    const nextEntry: StockRmYearMonthEntry = {
      month,
      values: {
        ...(existing?.values ?? blankStockRmMovement()),
        [field]: value,
      },
    };

    return {
      ...row,
      year_months: existing
        ? row.year_months.map((entry) =>
            entry.month === month ? nextEntry : entry,
          )
        : [...row.year_months, nextEntry].sort(
            (left, right) => left.month - right.month,
          ),
    };
  });
}

/**
 * Validation checks structure and numeric syntax only. It does not infer
 * missing values, recalculate cost averages, or reconcile daily/monthly/
 * yearly totals. The Excel source contains formulas, not business rules
 * approved for live recalculation.
 */
export function validateStockRmSheet(
  sheet: StockRmSheet,
): StockRmValidationErrors {
  const errors: StockRmValidationErrors = {};

  if (sheet.id !== stockRmPeriodKey(sheet.period)) {
    errors.id = "Sheet id does not match its period.";
  }
  if (sheet.source_sheet_name !== stockRmSourceSheetName(sheet.period)) {
    errors.source_sheet_name = "Source Excel sheet does not match its period.";
  }

  const itemCodes = new Set<string>();

  for (const row of sheet.rows) {
    const code = row.item.code_new;
    if (!code.trim() || itemCodes.has(code)) {
      errors[`item.${code || "blank"}`] = "The RM item code is missing or duplicated.";
    }
    itemCodes.add(code);

    if (!Number.isInteger(row.item.no) || row.item.no < 1) {
      errors[`${code}.item.no`] = "The item number must be a positive integer.";
    }
    if (row.item.name !== null && typeof row.item.name !== "string") {
      errors[`${code}.item.name`] = "The item name must be text or null.";
    }
    if (typeof row.remark !== "string") {
      errors[`${code}.remark`] = "The remark must be text.";
    }

    for (const field of STOCK_RM_SUMMARY_FIELDS) {
      const value = row.summary[field];
      if (typeof value !== "string" || !isValidStockRmNumber(value)) {
        errors[`${code}.summary.${field}`] =
          "Enter a valid number or leave the cell empty.";
      }
    }

    if (sheet.period.view === "YEAR" && row.daily.length > 0) {
      errors[`${code}.daily`] = "Annual sheets cannot contain daily entries.";
    }
    if (sheet.period.view === "MONTH" && row.year_months.length > 0) {
      errors[`${code}.year_months`] =
        "Monthly sheets cannot contain annual month entries.";
    }

    const dates = new Set<string>();
    for (const entry of row.daily) {
      if (!isStockRmDateInMonth(entry.date, sheet.period)) {
        errors[`${code}.daily.${entry.date}`] =
          "Daily date is outside the selected month.";
      }
      if (dates.has(entry.date)) {
        errors[`${code}.daily.duplicate.${entry.date}`] =
          "The daily date occurs more than once.";
      }
      dates.add(entry.date);

      for (const field of STOCK_RM_MOVEMENT_FIELDS) {
        const value = entry.values[field];
        if (typeof value !== "string" || !isValidStockRmNumber(value)) {
          errors[`${code}.daily.${entry.date}.${field}`] =
            "Enter a valid number or leave the cell empty.";
        }
      }
    }

    const months = new Set<number>();
    for (const entry of row.year_months) {
      if (!STOCK_RM_MONTHS.some((month) => month === entry.month)) {
        errors[`${code}.year_months.${entry.month}`] =
          "The annual summary month is invalid.";
      }
      if (months.has(entry.month)) {
        errors[`${code}.year_months.duplicate.${entry.month}`] =
          "The annual summary month occurs more than once.";
      }
      months.add(entry.month);

      for (const field of STOCK_RM_MOVEMENT_FIELDS) {
        const value = entry.values[field];
        if (typeof value !== "string" || !isValidStockRmNumber(value)) {
          errors[`${code}.year_months.${entry.month}.${field}`] =
            "Enter a valid number or leave the cell empty.";
        }
      }
    }
  }

  return errors;
}

/** Immutable in-memory upsert. A browser refresh resets all mock edits. */
export function saveStockRmSheet(
  sheets: readonly StockRmSheet[],
  draft: StockRmSheet,
  nowIso: string,
): StockRmSheet[] {
  const errors = validateStockRmSheet(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error("Stock RM FF contains invalid fields and cannot be saved.");
  }
  if (!Number.isFinite(Date.parse(nowIso))) {
    throw new Error("The save timestamp is invalid.");
  }

  const previous = sheets.find((sheet) => sheet.id === draft.id);
  const saved: StockRmSheet = {
    ...draft,
    period: { ...draft.period },
    rows: draft.rows.map((row) => ({
      ...row,
      item: { ...row.item },
      summary: { ...row.summary },
      daily: row.daily.map((entry) => ({
        date: entry.date,
        values: { ...entry.values },
      })),
      year_months: row.year_months.map((entry) => ({
        month: entry.month,
        values: { ...entry.values },
      })),
    })),
    created_at: previous?.created_at || draft.created_at || nowIso,
    updated_at: nowIso,
  };

  return previous
    ? sheets.map((sheet) => (sheet.id === saved.id ? saved : sheet))
    : [...sheets, saved];
}
