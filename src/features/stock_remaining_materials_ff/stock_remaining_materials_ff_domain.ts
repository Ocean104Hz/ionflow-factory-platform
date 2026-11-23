/**
 * Stock Material FF: UI mock domain for "วัสดุคงเหลือFF-2569.xlsx".
 *
 * Source worksheets:
 * - ยอดยกมา2568 : a snapshot dated 31 December B.E. 2568
 * - JAN, FEB, MAR, APR, MAY, JUN, JULY, AUG, SEP, OCT : B.E. 2569
 *
 * All values are editable Excel snapshots in React State only.
 * This module does not call an API, write to a database, persist to storage,
 * or recalculate Excel formulas. Blank cells must remain distinct from zero.
 *
 * A material code is NOT a row identifier: the workbook includes duplicate
 * codes and real material rows with no code. Imported rows use Excel
 * source_row; newly created mock rows use their own client_id instead.
 */

export const STOCK_MATERIAL_FF_MONTHS_2569 = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const;

export type StockMaterialMonth2569 =
  (typeof STOCK_MATERIAL_FF_MONTHS_2569)[number];

/** All periods actually present in the uploaded workbook. */
export type StockMaterialPeriod =
  | { view: "MONTH"; year_be: 2568; month: 12 }
  | { view: "MONTH"; year_be: 2569; month: StockMaterialMonth2569 };

export const STOCK_MATERIAL_FF_SOURCE_SHEETS = [
  { year_be: 2568, month: 12, source_sheet_name: "ยอดยกมา2568" },
  { year_be: 2569, month: 1, source_sheet_name: "JAN" },
  { year_be: 2569, month: 2, source_sheet_name: "FEB" },
  { year_be: 2569, month: 3, source_sheet_name: "MAR" },
  { year_be: 2569, month: 4, source_sheet_name: "APR" },
  { year_be: 2569, month: 5, source_sheet_name: "MAY" },
  { year_be: 2569, month: 6, source_sheet_name: "JUN" },
  { year_be: 2569, month: 7, source_sheet_name: "JULY" },
  { year_be: 2569, month: 8, source_sheet_name: "AUG" },
  { year_be: 2569, month: 9, source_sheet_name: "SEP" },
  { year_be: 2569, month: 10, source_sheet_name: "OCT" },
] as const;

/**
 * Excel summary cells F:U (16 numeric fields).
 * Safety-Stock (W) is separate because some source cells contain free text.
 * Remark (V) is separate as well.
 */
export const STOCK_MATERIAL_FF_SUMMARY_FIELDS = [
  "opening_quantity", // F : ยกมา / จำนวน
  "purchased_quantity", // G : รับซื้อ / จำนวน
  "purchased_unit_price", // H : รับซื้อ / ราคาต่อชิ้น
  "purchased_value", // I : รับซื้อ / รวมราคา
  "transfer_received_quantity", // J : รับโอน / จำนวน
  "transfer_received_unit_price", // K : รับโอน / ราคาต่อชิ้น
  "transfer_received_value", // L : รับโอน / รวมราคา
  "combined_quantity", // M : ยอดรวม / จำนวน
  "combined_unit_price", // N : ยอดรวม / ราคาต่อชิ้น
  "combined_value", // O : ยอดรวม / รวมราคา
  "issued_for_production", // P : จ่าย / ผลิต
  "issued_damaged", // Q : จ่าย / ชำรุด
  "issued_to_bio", // R : จ่าย / โอนBIO
  "issued_other", // S : จ่าย / อื่น ๆ
  "total_issued_quantity", // T : รวมจ่าย
  "closing_quantity", // U : คงเหลือ
] as const;

export type StockMaterialSummaryField =
  (typeof STOCK_MATERIAL_FF_SUMMARY_FIELDS)[number];

export type StockMaterialSummaryValues = Record<
  StockMaterialSummaryField,
  string
>;

/**
 * A day occupies eight columns, starting at Y on day 1, AG on day 2, etc.
 * The daily transfer issue ("โอน") is kept separate from the monthly
 * summary column "โอนBIO"; the source headings do not equate them.
 */
export const STOCK_MATERIAL_FF_DAILY_FIELDS = [
  "purchased_quantity", // +0 : รับซื้อ
  "transfer_received_quantity", // +1 : รับโอน
  "unit_price", // +2 : ราคาต่อชิ้น
  "received_value", // +3 : รวมราคา
  "issued_for_production", // +4 : ผลิต
  "issued_damaged", // +5 : ชำรุด
  "issued_transfer", // +6 : โอน
  "issued_other", // +7 : อื่น ๆ
] as const;

export type StockMaterialDailyField =
  (typeof STOCK_MATERIAL_FF_DAILY_FIELDS)[number];

export type StockMaterialDailyValues = Record<StockMaterialDailyField, string>;

/**
 * Material identity comes from the physical Excel row, not its product code.
 * The "No." column restarts within material groups and is not unique.
 * Null means the original Excel cell was blank; nothing is invented.
 */
export interface StockMaterialItem {
  /** Actual Excel row >= 6, or 0 when a new item has no Excel source row. */
  source_row: number;
  /** Only on newly created mock items. Never a product code or Excel row. */
  client_id?: string;
  no: number | null;
  category: string | null; // B : ประเภท (no automatic fill-down)
  code: string | null; // C : รหัสสินค้า (may be blank or repeated)
  name: string; // D : รายการบรรจุภัณฑ์
  unit: string | null; // E : หน่วยนับ
}

export interface StockMaterialDailyEntry {
  date: string; // ISO calendar date, Gregorian YYYY-MM-DD
  values: StockMaterialDailyValues;
}

export interface StockMaterialRow {
  item: StockMaterialItem;
  summary: StockMaterialSummaryValues;
  remark: string; // V : หมายเหตุ
  safety_stock: string; // W : numeric OR free-text source cell
  daily: StockMaterialDailyEntry[];
}

/**
 * Form values for a new item. Only name is required.
 * Summary contains the original 16 Excel F:U numeric-text fields.
 * Optional daily movements may contain multiple distinct dates in the selected
 * month. The legacy single-entry shape is accepted for existing form callers.
 * Daily values do not recalculate the 16 summary fields. Omitting summary
 * keeps its 16 numeric-text cells blank; it does not remove the summary model.
 * Empty optional item details are stored as null as in the source workbook.
 */
export interface StockMaterialCreateInput {
  category: string;
  code: string;
  name: string;
  unit: string;
  remark: string;
  safety_stock: string;
  summary?: StockMaterialSummaryValues;
  daily?: StockMaterialDailyEntry | StockMaterialDailyEntry[];
}

/** Existing code keeps using numeric Excel rows; new rows use client_id. */
export type StockMaterialRowRef = number | string;

export interface StockMaterialSheet {
  id: string;
  period: StockMaterialPeriod;
  source_sheet_name: string;
  rows: StockMaterialRow[];
  created_at: string;
  updated_at: string;
}

export interface StockMaterialFilters {
  period: StockMaterialPeriod;
  search: string;
}

export const DEFAULT_STOCK_MATERIAL_FILTERS: StockMaterialFilters = {
  period: { view: "MONTH", year_be: 2569, month: 1 },
  search: "",
};

export type StockMaterialValidationErrors = Record<string, string>;

/** One worksheet per permitted year/month combination. */
export function stockMaterialSourceSheetName(
  period: StockMaterialPeriod,
): string {
  const source = STOCK_MATERIAL_FF_SOURCE_SHEETS.find(
    (entry) => entry.year_be === period.year_be && entry.month === period.month,
  );

  if (!source) {
    throw new Error(
      "The requested material-stock period is not in the source workbook.",
    );
  }

  return source.source_sheet_name;
}

export function stockMaterialPeriodKey(period: StockMaterialPeriod): string {
  return `month-${period.year_be}-${String(period.month).padStart(2, "0")}`;
}

export function blankStockMaterialSummary(): StockMaterialSummaryValues {
  return {
    opening_quantity: "",
    purchased_quantity: "",
    purchased_unit_price: "",
    purchased_value: "",
    transfer_received_quantity: "",
    transfer_received_unit_price: "",
    transfer_received_value: "",
    combined_quantity: "",
    combined_unit_price: "",
    combined_value: "",
    issued_for_production: "",
    issued_damaged: "",
    issued_to_bio: "",
    issued_other: "",
    total_issued_quantity: "",
    closing_quantity: "",
  };
}

export function blankStockMaterialDaily(): StockMaterialDailyValues {
  return {
    purchased_quantity: "",
    transfer_received_quantity: "",
    unit_price: "",
    received_value: "",
    issued_for_production: "",
    issued_damaged: "",
    issued_transfer: "",
    issued_other: "",
  };
}

/** Form starts empty; do not invent stock quantities or product codes. */
export function blankStockMaterialCreateInput(): StockMaterialCreateInput {
  return {
    category: "",
    code: "",
    name: "",
    unit: "",
    remark: "",
    safety_stock: "",
  };
}

export function blankStockMaterialSheet(
  period: StockMaterialPeriod,
  items: readonly StockMaterialItem[] = [],
): StockMaterialSheet {
  return {
    id: stockMaterialPeriodKey(period),
    period: { ...period },
    source_sheet_name: stockMaterialSourceSheetName(period),
    rows: items.map((item) => ({
      item: { ...item },
      summary: blankStockMaterialSummary(),
      remark: "",
      safety_stock: "",
      daily: [],
    })),
    created_at: "",
    updated_at: "",
  };
}

/**
 * Stable selection key for a row. The numeric 0 is NEVER returned as a key.
 * Existing table and modal callers may still pass Excel source_row numbers.
 */
export function stockMaterialRowRef(
  row: StockMaterialRow,
): StockMaterialRowRef {
  return row.item.client_id ?? row.item.source_row;
}

/**
 * Append a new item only to the supplied month's draft.
 * clientId should be generated once by the UI (for example with
 * crypto.randomUUID()), then retained across draft/save/discard operations.
 * No browser API, HTTP request, storage, or database is used here.
 */
export function addStockMaterialRow(
  sheet: StockMaterialSheet,
  input: StockMaterialCreateInput,
  clientId: string,
): StockMaterialSheet {
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("A new mock material needs a non-empty client ID.");
  }

  if (sheet.rows.some((row) => row.item.client_id === clientId)) {
    throw new Error(
      "This mock material client ID already exists in the month.",
    );
  }

  // Do not append rows to an unknown month or a mismatched worksheet.
  if (
    sheet.id !== stockMaterialPeriodKey(sheet.period) ||
    sheet.source_sheet_name !== stockMaterialSourceSheetName(sheet.period)
  ) {
    throw new Error(
      "The material-stock draft does not match its selected month.",
    );
  }

  if (
    typeof input.category !== "string" ||
    typeof input.code !== "string" ||
    typeof input.name !== "string" ||
    typeof input.unit !== "string" ||
    typeof input.remark !== "string" ||
    typeof input.safety_stock !== "string"
  ) {
    throw new Error("New material details must be text.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Please enter a material name.");
  }

  // Copy and validate every F:U cell. Missing summary is accepted only for
  // backwards compatibility with callers created before the expanded form.
  // Never derive "combined", "total issued" or "closing" automatically.
  const summaryInput = input.summary;
  if (
    summaryInput !== undefined &&
    (summaryInput === null ||
      typeof summaryInput !== "object" ||
      Array.isArray(summaryInput))
  ) {
    throw new Error(
      "New material summary must be an object of numeric text fields.",
    );
  }

  const summary = blankStockMaterialSummary();
  if (summaryInput !== undefined) {
    for (const field of STOCK_MATERIAL_FF_SUMMARY_FIELDS) {
      const value: unknown = summaryInput[field];
      if (typeof value !== "string" || !isValidStockMaterialNumber(value)) {
        throw new Error(
          `Invalid new material summary value for ${field}. ` +
            "Enter a valid number or leave the cell empty.",
        );
      }
      summary[field] = value;
    }
  }

  // Each selected date has one set of eight daily cells, matching the Excel
  // source and updateStockMaterialDaily. Multiple dates may be created at once;
  // the older single-entry payload remains valid for existing form callers.
  const dailyInput = input.daily;
  if (
    dailyInput !== undefined &&
    (dailyInput === null || typeof dailyInput !== "object")
  ) {
    throw new Error("New material daily movement must be an object or array.");
  }

  const dailyInputs: readonly StockMaterialDailyEntry[] =
    dailyInput === undefined
      ? []
      : Array.isArray(dailyInput)
        ? dailyInput
        : [dailyInput];
  const seenDailyDates = new Set<string>();
  const daily: StockMaterialDailyEntry[] = [];

  for (const entry of dailyInputs) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(
        "New material daily movement must contain valid entries.",
      );
    }
    if (
      typeof entry.date !== "string" ||
      !isStockMaterialDateInPeriod(entry.date, sheet.period)
    ) {
      throw new Error(
        "The new material movement date is outside the selected month.",
      );
    }
    if (seenDailyDates.has(entry.date)) {
      throw new Error("The new material movement date is duplicated.");
    }
    seenDailyDates.add(entry.date);

    const dailyValuesInput = entry.values;
    if (
      dailyValuesInput === null ||
      typeof dailyValuesInput !== "object" ||
      Array.isArray(dailyValuesInput)
    ) {
      throw new Error(
        "New material daily values must be an object of numeric text fields.",
      );
    }

    const values = blankStockMaterialDaily();
    for (const field of STOCK_MATERIAL_FF_DAILY_FIELDS) {
      const value: unknown = dailyValuesInput[field];
      if (typeof value !== "string" || !isValidStockMaterialNumber(value)) {
        throw new Error(
          `Invalid new material daily value for ${field}. ` +
            "Enter a valid number or leave the cell empty.",
        );
      }
      values[field] = value;
    }

    daily.push({ date: entry.date, values });
  }
  daily.sort((left, right) => left.date.localeCompare(right.date));

  const optionalText = (text: string): string | null => text.trim() || null;
  const row: StockMaterialRow = {
    item: {
      source_row: 0, // Sentinel: not a real Excel row; use client_id as the key.
      client_id: clientId,
      no: null,
      category: optionalText(input.category),
      code: optionalText(input.code),
      name,
      unit: optionalText(input.unit),
    },
    summary,
    remark: input.remark,
    safety_stock: input.safety_stock,
    daily,
  };

  return { ...sheet, rows: [...sheet.rows, row] };
}

export function isStockMaterialDateInPeriod(
  date: string,
  period: StockMaterialPeriod,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const checkDate = new Date(Date.UTC(year, month - 1, day));

  return (
    year === period.year_be - 543 &&
    month === period.month &&
    day >= 1 &&
    checkDate.getUTCFullYear() === year &&
    checkDate.getUTCMonth() + 1 === month &&
    checkDate.getUTCDate() === day
  );
}

/** Number syntax only: no automatic stock, price, or valuation calculation. */
export function isValidStockMaterialNumber(value: string): boolean {
  const text = value.trim();
  return text === "" || /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text);
}

function patchStockMaterialRow(
  sheet: StockMaterialSheet,
  rowRef: StockMaterialRowRef,
  update: (row: StockMaterialRow) => StockMaterialRow,
): StockMaterialSheet {
  const matches = (row: StockMaterialRow): boolean =>
    typeof rowRef === "string"
      ? row.item.client_id === rowRef
      : rowRef >= 6 &&
        row.item.client_id === undefined &&
        row.item.source_row === rowRef;

  // Never allow the source_row=0 sentinel to address every new row at once.
  if (!sheet.rows.some(matches)) {
    throw new Error(
      typeof rowRef === "number"
        ? `Unknown material-stock Excel source row: ${rowRef}`
        : `Unknown mock material client ID: ${rowRef}`,
    );
  }

  return {
    ...sheet,
    rows: sheet.rows.map((row) => (matches(row) ? update(row) : row)),
  };
}

/** Immutable draft edit. Distinct rows may have the same product code. */
export function updateStockMaterialSummary(
  sheet: StockMaterialSheet,
  rowRef: StockMaterialRowRef,
  field: StockMaterialSummaryField,
  value: string,
): StockMaterialSheet {
  return patchStockMaterialRow(sheet, rowRef, (row) => ({
    ...row,
    summary: { ...row.summary, [field]: value },
  }));
}

export function updateStockMaterialRemark(
  sheet: StockMaterialSheet,
  rowRef: StockMaterialRowRef,
  remark: string,
): StockMaterialSheet {
  return patchStockMaterialRow(sheet, rowRef, (row) => ({
    ...row,
    remark,
  }));
}

/** Safety-Stock is text because some real Excel rows contain notes in W. */
export function updateStockMaterialSafetyStock(
  sheet: StockMaterialSheet,
  rowRef: StockMaterialRowRef,
  safetyStock: string,
): StockMaterialSheet {
  return patchStockMaterialRow(sheet, rowRef, (row) => ({
    ...row,
    safety_stock: safetyStock,
  }));
}

/** Insert a missing valid date or update only one field of an existing day. */
export function updateStockMaterialDaily(
  sheet: StockMaterialSheet,
  rowRef: StockMaterialRowRef,
  date: string,
  field: StockMaterialDailyField,
  value: string,
): StockMaterialSheet {
  if (!isStockMaterialDateInPeriod(date, sheet.period)) {
    throw new Error(
      "The material movement date is outside the selected month.",
    );
  }

  return patchStockMaterialRow(sheet, rowRef, (row) => {
    const existing = row.daily.find((entry) => entry.date === date);
    const updatedEntry: StockMaterialDailyEntry = {
      date,
      values: {
        ...(existing?.values ?? blankStockMaterialDaily()),
        [field]: value,
      },
    };

    return {
      ...row,
      daily: existing
        ? row.daily.map((entry) => (entry.date === date ? updatedEntry : entry))
        : [...row.daily, updatedEntry].sort((left, right) =>
            left.date.localeCompare(right.date),
          ),
    };
  });
}

/** Search real source text; items without codes remain searchable by name. */
export function filterStockMaterialRows(
  rows: readonly StockMaterialRow[],
  search: string,
): StockMaterialRow[] {
  const query = search.trim().toLocaleLowerCase();
  if (!query) {
    return [...rows];
  }

  return rows.filter((row) =>
    [row.item.code, row.item.name, row.item.category, row.item.unit].some(
      (text) => text?.toLocaleLowerCase().includes(query) ?? false,
    ),
  );
}

/**
 * Validate one material-stock snapshot, without checking whether formulas
 * in the uploaded Excel happen to reconcile across columns.
 */
export function validateStockMaterialSheet(
  sheet: StockMaterialSheet,
): StockMaterialValidationErrors {
  const errors: StockMaterialValidationErrors = {};
  const source = STOCK_MATERIAL_FF_SOURCE_SHEETS.find(
    (entry) =>
      entry.year_be === sheet.period.year_be &&
      entry.month === sheet.period.month,
  );

  if (!source) {
    errors.period = "The period is not present in the source workbook.";
  } else if (sheet.source_sheet_name !== source.source_sheet_name) {
    errors.source_sheet_name = "The Excel source sheet name is incorrect.";
  }

  if (sheet.id !== stockMaterialPeriodKey(sheet.period)) {
    errors.id = "The material-stock sheet ID does not match its period.";
  }

  const sourceRows = new Set<number>();
  const clientIds = new Set<string>();

  for (const [index, row] of sheet.rows.entries()) {
    const rowId = row.item.source_row;
    const clientId = row.item.client_id;
    const isNewItem = clientId !== undefined;
    const errorKey = isNewItem ? `row.mock.${index}` : `row.${rowId}`;

    if (isNewItem) {
      if (rowId !== 0) {
        errors[`${errorKey}.source_row`] =
          "New mock materials must not claim an Excel source row.";
      }
      if (typeof clientId !== "string" || !clientId.trim()) {
        errors[`${errorKey}.client_id`] =
          "Mock material client ID is required.";
      } else if (clientIds.has(clientId)) {
        errors[`${errorKey}.client_id`] =
          "Mock material client ID is duplicated.";
      } else {
        clientIds.add(clientId);
      }
    } else {
      if (!Number.isInteger(rowId) || rowId < 6 || sourceRows.has(rowId)) {
        errors[`${errorKey}.source_row`] =
          "Excel source row must be unique and start at row 6.";
      }
      sourceRows.add(rowId);
    }

    if (
      row.item.no !== null &&
      (!Number.isInteger(row.item.no) || row.item.no < 1)
    ) {
      errors[`${errorKey}.no`] = "The No. column must be positive or blank.";
    }

    if (
      (row.item.code !== null && typeof row.item.code !== "string") ||
      (row.item.category !== null && typeof row.item.category !== "string") ||
      (row.item.unit !== null && typeof row.item.unit !== "string") ||
      typeof row.item.name !== "string" ||
      !row.item.name.trim()
    ) {
      errors[`${errorKey}.item`] = "The material details contain invalid text.";
    }

    if (typeof row.remark !== "string") {
      errors[`${errorKey}.remark`] = "Remark must be text.";
    }
    if (typeof row.safety_stock !== "string") {
      errors[`${errorKey}.safety_stock`] = "Safety-Stock must be text.";
    }

    for (const field of STOCK_MATERIAL_FF_SUMMARY_FIELDS) {
      const value = row.summary[field];
      if (typeof value !== "string" || !isValidStockMaterialNumber(value)) {
        errors[`${errorKey}.summary.${field}`] =
          "Enter a valid number or leave the cell empty.";
      }
    }

    const dailyDates = new Set<string>();
    for (const entry of row.daily) {
      if (!isStockMaterialDateInPeriod(entry.date, sheet.period)) {
        errors[`${errorKey}.daily.${entry.date}`] =
          "The daily date is not in the selected month.";
      }
      if (dailyDates.has(entry.date)) {
        errors[`${errorKey}.daily.duplicate.${entry.date}`] =
          "The daily date is duplicated.";
      }
      dailyDates.add(entry.date);

      for (const field of STOCK_MATERIAL_FF_DAILY_FIELDS) {
        const value = entry.values[field];
        if (typeof value !== "string" || !isValidStockMaterialNumber(value)) {
          errors[`${errorKey}.daily.${entry.date}.${field}`] =
            "Enter a valid number or leave the cell empty.";
        }
      }
    }
  }

  return errors;
}

/** Save a deep copy in React State only. Refreshing the browser resets it. */
export function saveStockMaterialSheet(
  sheets: readonly StockMaterialSheet[],
  draft: StockMaterialSheet,
  nowIso: string,
): StockMaterialSheet[] {
  if (Object.keys(validateStockMaterialSheet(draft)).length > 0) {
    throw new Error(
      "Material stock contains invalid values and cannot be saved.",
    );
  }
  if (!Number.isFinite(Date.parse(nowIso))) {
    throw new Error("The save timestamp is invalid.");
  }

  const current = sheets.find((sheet) => sheet.id === draft.id);
  if (sheets.filter((sheet) => sheet.id === draft.id).length > 1) {
    throw new Error("The material-stock period occurs more than once.");
  }

  const saved: StockMaterialSheet = {
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
    })),
    created_at: current?.created_at || draft.created_at || nowIso,
    updated_at: nowIso,
  };

  return current
    ? sheets.map((sheet) => (sheet.id === saved.id ? saved : sheet))
    : [...sheets, saved];
}
