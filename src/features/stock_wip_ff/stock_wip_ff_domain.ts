/**
 * Stock WIP FF 2569: UI MOCK ONLY.
 * This module contains no API, database, storage, or inventory integration.
 * Values are editable text snapshots; no Excel formulas are recalculated.
 */

export const STOCK_WIP_MONTHS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;

export type StockWipMonth = (typeof STOCK_WIP_MONTHS)[number];
export type StockWipCategory = "LIQUID_FERTILIZER" | "TABLET";
export type StockWipUnit = "L" | "Pcs.";

export const STOCK_WIP_CATEGORIES = [
  { id: "LIQUID_FERTILIZER", label: "Lliquid fertilizer (L)", unit: "L" },
  { id: "TABLET", label: "Tablet (Pcs.)", unit: "Pcs." },
] as const satisfies readonly {
  id: StockWipCategory;
  label: string;
  unit: StockWipUnit;
}[];

/** The workbook has annual sheets for 2568/2569 and monthly sheets for 2569. */
export type StockWipPeriod =
  | { view: "YEAR"; year_be: 2568 | 2569 }
  | { view: "MONTH"; year_be: 2569; month: StockWipMonth };

export const STOCK_WIP_MOVEMENT_FIELDS = [
  "received",
  "used_for_production",
  "used_for_packaging",
  "other_issues",
  "transfer_kan_1",
  "transfer_kan_3",
  "transfer_ico",
  "transfer_bio",
] as const;

export type StockWipMovementField =
  (typeof STOCK_WIP_MOVEMENT_FIELDS)[number];

export const STOCK_WIP_SUMMARY_FIELDS = [
  "opening_balance",
  ...STOCK_WIP_MOVEMENT_FIELDS,
  "closing_balance",
] as const;

export type StockWipSummaryField =
  (typeof STOCK_WIP_SUMMARY_FIELDS)[number];

/**
 * Empty string: the cell is available but has no entered value.
 * null: BIO transfer is not a column in this source sheet (Jan/Feb 2569).
 */
export type StockWipMovementValues = Record<
  Exclude<StockWipMovementField, "transfer_bio">,
  string
> & { transfer_bio: string | null };

export type StockWipSummaryValues = StockWipMovementValues & {
  opening_balance: string;
  closing_balance: string;
};

export interface StockWipItem {
  no: number;
  code_new: string;
  code_old: string | null;
  name: string;
  category: StockWipCategory;
  unit: StockWipUnit;
}

export interface StockWipDailyEntry {
  date: string; // Gregorian ISO date (YYYY-MM-DD) for HTML date inputs.
  values: StockWipMovementValues;
}

export interface StockWipRow {
  item: StockWipItem;
  summary: StockWipSummaryValues;
  daily: StockWipDailyEntry[]; // Empty for YEAR views.
}

export interface StockWipSheet {
  id: string;
  period: StockWipPeriod;
  source_sheet_name: string;
  supports_bio_transfer: boolean;
  rows: StockWipRow[];
  created_at: string;
  updated_at: string;
}

export interface StockWipFilters {
  period: StockWipPeriod;
  category: StockWipCategory | "ALL";
  search: string;
}

export const DEFAULT_STOCK_WIP_FILTERS: StockWipFilters = {
  period: { view: "MONTH", year_be: 2569, month: 1 },
  category: "ALL",
  search: "",
};

export type StockWipValidationErrors = Record<string, string>;

export function stockWipPeriodKey(period: StockWipPeriod): string {
  return period.view === "YEAR"
    ? `year-${period.year_be}`
    : `month-${period.year_be}-${String(period.month).padStart(2, "0")}`;
}

export function stockWipSourceSheetName(period: StockWipPeriod): string {
  return period.view === "YEAR"
    ? `Data-WIP ${period.year_be - 2500}`
    : `Data-WIP ${period.month}`;
}

export function stockWipSupportsBioTransfer(period: StockWipPeriod): boolean {
  // Both annual layouts have BIO, but monthly Jan/Feb 2569 do not.
  return period.view === "YEAR" || period.month >= 3;
}

export function blankStockWipMovement(
  supportsBioTransfer: boolean,
): StockWipMovementValues {
  return {
    received: "",
    used_for_production: "",
    used_for_packaging: "",
    other_issues: "",
    transfer_kan_1: "",
    transfer_kan_3: "",
    transfer_ico: "",
    transfer_bio: supportsBioTransfer ? "" : null,
  };
}

export function blankStockWipSummary(
  supportsBioTransfer: boolean,
): StockWipSummaryValues {
  return {
    opening_balance: "",
    ...blankStockWipMovement(supportsBioTransfer),
    closing_balance: "",
  };
}

export function blankStockWipSheet(
  period: StockWipPeriod,
  items: readonly StockWipItem[] = [],
): StockWipSheet {
  const supportsBio = stockWipSupportsBioTransfer(period);

  return {
    id: stockWipPeriodKey(period),
    period,
    source_sheet_name: stockWipSourceSheetName(period),
    supports_bio_transfer: supportsBio,
    rows: items.map((item) => ({
      item: { ...item },
      summary: blankStockWipSummary(supportsBio),
      daily: [],
    })),
    created_at: "",
    updated_at: "",
  };
}

/** Date must belong to the selected monthly sheet, including leap-year rules. */
export function isStockWipDateInMonth(
  date: string,
  period: StockWipPeriod,
): boolean {
  if (period.view !== "MONTH" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const dateObject = new Date(Date.UTC(year, month - 1, day));

  return (
    year === period.year_be - 543 &&
    month === period.month &&
    day >= 1 &&
    dateObject.getUTCFullYear() === year &&
    dateObject.getUTCMonth() + 1 === month &&
    dateObject.getUTCDate() === day
  );
}

/** Allows blank inputs while editing, but rejects negative or nonnumeric data. */
export function isValidStockWipQuantity(value: string): boolean {
  const text = value.trim();
  return text === "" || /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text);
}

function assertStockWipEditableField(
  sheet: StockWipSheet,
  field: StockWipMovementField | StockWipSummaryField,
): void {
  if (field === "transfer_bio" && !sheet.supports_bio_transfer) {
    throw new Error("BIO transfer is unavailable in this source sheet.");
  }
}

function patchStockWipRow(
  sheet: StockWipSheet,
  codeNew: string,
  update: (row: StockWipRow) => StockWipRow,
): StockWipSheet {
  if (!sheet.rows.some((row) => row.item.code_new === codeNew)) {
    throw new Error(`Unknown Stock WIP item: ${codeNew}`);
  }

  return {
    ...sheet,
    rows: sheet.rows.map((row) =>
      row.item.code_new === codeNew ? update(row) : row,
    ),
  };
}

/** Pure updater: the caller decides when to save the draft to React State. */
export function updateStockWipSummary(
  sheet: StockWipSheet,
  codeNew: string,
  field: StockWipSummaryField,
  value: string,
): StockWipSheet {
  assertStockWipEditableField(sheet, field);

  return patchStockWipRow(sheet, codeNew, (row) => ({
    ...row,
    summary: { ...row.summary, [field]: value },
  }));
}

export function updateStockWipDaily(
  sheet: StockWipSheet,
  codeNew: string,
  date: string,
  field: StockWipMovementField,
  value: string,
): StockWipSheet {
  if (!isStockWipDateInMonth(date, sheet.period)) {
    throw new Error("The daily date is outside the selected month.");
  }

  assertStockWipEditableField(sheet, field);

  return patchStockWipRow(sheet, codeNew, (row) => {
    const existing = row.daily.find((entry) => entry.date === date);
    const nextEntry: StockWipDailyEntry = {
      date,
      values: {
        ...(existing?.values ?? blankStockWipMovement(sheet.supports_bio_transfer)),
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

/**
 * Validation does not infer balances, fill blanks with zero, or reconcile
 * daily / monthly / annual totals. Those rules are not approved for the mock.
 */
export function validateStockWipSheet(
  sheet: StockWipSheet,
): StockWipValidationErrors {
  const errors: StockWipValidationErrors = {};
  const expectedBio = stockWipSupportsBioTransfer(sheet.period);

  if (sheet.id !== stockWipPeriodKey(sheet.period)) {
    errors.id = "The document id does not match its period.";
  }

  if (sheet.source_sheet_name !== stockWipSourceSheetName(sheet.period)) {
    errors.source_sheet_name = "The Excel source sheet does not match its period.";
  }

  if (sheet.supports_bio_transfer !== expectedBio) {
    errors.supports_bio_transfer = "BIO transfer availability does not match this period.";
  }

  const itemCodes = new Set<string>();

  for (const row of sheet.rows) {
    const code = row.item.code_new;
    if (!code.trim() || itemCodes.has(code)) {
      errors[`item.${code || "blank"}`] = "Item code is missing or duplicated.";
    }
    itemCodes.add(code);

    const category = STOCK_WIP_CATEGORIES.find(
      (candidate) => candidate.id === row.item.category,
    );
    if (!category || category.unit !== row.item.unit) {
      errors[`${code}.item.unit`] = "Item category and unit do not match.";
    }

    for (const field of STOCK_WIP_SUMMARY_FIELDS) {
      const value = row.summary[field];
      const key = `${code}.summary.${field}`;

      if (field === "transfer_bio") {
        if (expectedBio ? value === null : value !== null) {
          errors[key] = "BIO transfer availability is incorrect.";
        }
      }

      if (value !== null && !isValidStockWipQuantity(value)) {
        errors[key] = "Enter a nonnegative number or leave the cell empty.";
      }
    }

    if (sheet.period.view === "YEAR" && row.daily.length > 0) {
      errors[`${code}.daily`] = "Yearly sheets cannot contain daily entries.";
    }

    const dates = new Set<string>();
    for (const entry of row.daily) {
      if (!isStockWipDateInMonth(entry.date, sheet.period)) {
        errors[`${code}.daily.${entry.date}`] = "Date is outside this month.";
      }
      if (dates.has(entry.date)) {
        errors[`${code}.daily.duplicate.${entry.date}`] = "Daily date is duplicated.";
      }
      dates.add(entry.date);

      for (const field of STOCK_WIP_MOVEMENT_FIELDS) {
        const value = entry.values[field];
        const key = `${code}.daily.${entry.date}.${field}`;
        if (field === "transfer_bio") {
          if (expectedBio ? value === null : value !== null) {
            errors[key] = "BIO transfer availability is incorrect.";
          }
        }
        if (value !== null && !isValidStockWipQuantity(value)) {
          errors[key] = "Enter a nonnegative number or leave the cell empty.";
        }
      }
    }
  }

  return errors;
}

/** Immutable in-memory save/upsert. A browser reload resets to mock fixtures. */
export function saveStockWipSheet(
  sheets: readonly StockWipSheet[],
  draft: StockWipSheet,
  nowIso: string,
): StockWipSheet[] {
  const errors = validateStockWipSheet(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error("The Stock WIP mock has invalid fields and cannot be saved.");
  }
  if (!Number.isFinite(Date.parse(nowIso))) {
    throw new Error("The save timestamp is invalid.");
  }

  const previous = sheets.find((sheet) => sheet.id === draft.id);
  const saved: StockWipSheet = {
    ...draft,
    rows: draft.rows.map((row) => ({
      ...row,
      item: { ...row.item },
      summary: { ...row.summary },
      daily: row.daily.map((entry) => ({
        date: entry.date,
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
