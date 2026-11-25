/**
 * Customer materials: shared UI and persistence domain.
 * Source: วัสดุคงเหลือลูกค้า-2569.1 FF.xlsx
 *
 * - Summary, daily movements and physical counts are independent inputs.
 * - Do not calculate balances, differences or cross-month carryovers.
 * - Keep source sheet names, row identities and literal values.
 * - An empty string is different from the quantity "0".
 * - This module has no browser, API or database dependencies.
 */

/* ---------------- Source worksheets and columns ---------------- */

export const CUSTOMER_MATERIALS_SHEET_NAMES = [
  "ยอดยกมา2568",
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JULY",
  "AUG",
  "SEP",
  "OCT",
] as const;

export type CustomerMaterialsSheetName =
  (typeof CUSTOMER_MATERIALS_SHEET_NAMES)[number];

export interface CustomerMaterialsPeriod {
  year_be: number;
  /** null for the historical carryover sheet; do not infer a month. */
  month: number | null;
  label: string;
}

export const CUSTOMER_MATERIALS_PERIODS: Readonly<
  Record<CustomerMaterialsSheetName, CustomerMaterialsPeriod>
> = {
  ยอดยกมา2568: { year_be: 2568, month: null, label: "ยอดยกมา 2568" },
  JAN: { year_be: 2569, month: 1, label: "มกราคม 2569" },
  FEB: { year_be: 2569, month: 2, label: "กุมภาพันธ์ 2569" },
  MAR: { year_be: 2569, month: 3, label: "มีนาคม 2569" },
  APR: { year_be: 2569, month: 4, label: "เมษายน 2569" },
  MAY: { year_be: 2569, month: 5, label: "พฤษภาคม 2569" },
  JUN: { year_be: 2569, month: 6, label: "มิถุนายน 2569" },
  JULY: { year_be: 2569, month: 7, label: "กรกฎาคม 2569" },
  AUG: { year_be: 2569, month: 8, label: "สิงหาคม 2569" },
  SEP: { year_be: 2569, month: 9, label: "กันยายน 2569" },
  OCT: { year_be: 2569, month: 10, label: "ตุลาคม 2569" },
};

export const CUSTOMER_MATERIALS_DEFAULT_SHEET: CustomerMaterialsSheetName =
  "OCT";

/** Excel columns G:N. All summary values are manually maintained. */
export const CUSTOMER_MATERIALS_SUMMARY_FIELDS = [
  "opening_quantity",
  "received_in",
  "issued_production",
  "issued_damaged",
  "issued_other",
  "remaining_quantity",
  "physical_count",
  "count_difference",
] as const;

export type CustomerMaterialsSummaryField =
  (typeof CUSTOMER_MATERIALS_SUMMARY_FIELDS)[number];
export type CustomerMaterialsSummaryValues = Record<
  CustomerMaterialsSummaryField,
  string
>;

export const CUSTOMER_MATERIALS_SUMMARY_LABELS: Readonly<
  Record<CustomerMaterialsSummaryField, string>
> = {
  opening_quantity: "ยอดยกมา",
  received_in: "รับเข้า",
  issued_production: "จ่ายผลิต",
  issued_damaged: "จ่ายชำรุด",
  issued_other: "จ่ายอื่น ๆ",
  remaining_quantity: "คงเหลือ",
  physical_count: "ตรวจนับ",
  count_difference: "ผลต่าง",
};

/** Four fields per day, starting at Q. */
export const CUSTOMER_MATERIALS_DAILY_FIELDS = [
  "received_in",
  "issued_production",
  "issued_damaged",
  "issued_other",
] as const;

export type CustomerMaterialsDailyField =
  (typeof CUSTOMER_MATERIALS_DAILY_FIELDS)[number];
export type CustomerMaterialsDailyValues = Record<
  CustomerMaterialsDailyField,
  string
>;

export const CUSTOMER_MATERIALS_DAILY_LABELS: Readonly<
  Record<CustomerMaterialsDailyField, string>
> = {
  received_in: "รับเข้า",
  issued_production: "จ่ายผลิต",
  issued_damaged: "จ่ายชำรุด",
  issued_other: "จ่ายอื่น ๆ",
};

/** One-based source column indices. Column P is not a daily field. */
export const CUSTOMER_MATERIALS_EXCEL_COLUMNS = {
  sales_customer: 1,
  material_type: 2,
  code: 3,
  no: 4,
  description: 5,
  unit: 6,
  summary_first: 7,
  summary_last: 14,
  remark: 15,
  daily_first: 17,
  daily_field_count: 4,
  last_day: 31,
  daily_last: 140,
} as const;

/* ---------------- SO groups ---------------- */

/** Same 16 SO identifiers as the stock-products feature. */
export const CUSTOMER_MATERIALS_SO_SHEET_NAMES = [
  "KA",
  "IB",
  "TY",
  "IV",
  "MAXNIC",
  "IFK",
  "K-ONE",
  "IAM",
  "IAT",
  "PN(พรีออนิค)",
  "MKS",
  "GREENNAX",
  "ODM-OLM",
  "FTW",
  "SAT",
  "WM",
] as const;

export type CustomerMaterialsSoSheetName =
  (typeof CUSTOMER_MATERIALS_SO_SHEET_NAMES)[number];

export type CustomerMaterialsSoFilter =
  | CustomerMaterialsSoSheetName
  | "ALL"
  | "UNASSIGNED";

export function isCustomerMaterialsSoSheetName(
  value: unknown,
): value is CustomerMaterialsSoSheetName {
  return CUSTOMER_MATERIALS_SO_SHEET_NAMES.some((name) => name === value);
}

/* ---------------- Domain contracts ---------------- */

export interface CustomerMaterialsItem {
  /** Local identity, only assigned to newly created rows. */
  id?: string;
  /** Date the material was added (ISO YYYY-MM-DD); absent in original Excel rows. */
  added_date?: string | null;
  /** SO group is independent of the original sales/customer cell (A). */
  so_sheet?: CustomerMaterialsSoSheetName | null;
  /** Excel row number, or 0 for a locally created row. */
  source_row: number;
  /** A: literal cell value. Blank cells are not guessed or filled down. */
  sales_customer: string | null;
  /** B: literal material type, including mixed source descriptions. */
  material_type: string | null;
  code: string | null;
  no: string | null;
  description: string;
  unit: string | null;
}

export interface CustomerMaterialsDailyEntry {
  /** Source day number (1-31), not an inferred calendar date. */
  day: number;
  values: CustomerMaterialsDailyValues;
}

export interface CustomerMaterialsRow {
  sheet_name: CustomerMaterialsSheetName;
  item: CustomerMaterialsItem;
  /** Literal G:N values; preserve non-numeric source text as well. */
  summary: CustomerMaterialsSummaryValues;
  remark: string;
  daily: CustomerMaterialsDailyEntry[];
}

export interface CustomerMaterialsSheet {
  name: CustomerMaterialsSheetName;
  report_caption: string;
  /** Preserve the original caption, even when its date is invalid. */
  period_caption: string;
  rows: CustomerMaterialsRow[];
}

export interface CustomerMaterialsWorkbook {
  sheets: CustomerMaterialsSheet[];
}

export type CustomerMaterialsCountValues = Pick<
  CustomerMaterialsSummaryValues,
  "physical_count" | "count_difference"
> & { remark: string };

export type CustomerMaterialsFormErrors = Record<string, string>;
export type CustomerMaterialsFormMode = "CREATE" | "EDIT";

/* ---------------- Blank forms and calendar ---------------- */

export function blankCustomerMaterialsSummary(): CustomerMaterialsSummaryValues {
  return {
    opening_quantity: "",
    received_in: "",
    issued_production: "",
    issued_damaged: "",
    issued_other: "",
    remaining_quantity: "",
    physical_count: "",
    count_difference: "",
  };
}

export function blankCustomerMaterialsDaily(): CustomerMaterialsDailyValues {
  return {
    received_in: "",
    issued_production: "",
    issued_damaged: "",
    issued_other: "",
  };
}

export function blankCustomerMaterialsRow(
  id: string,
  sheetName: CustomerMaterialsSheetName,
): CustomerMaterialsRow {
  if (!id.trim()) {
    throw new Error("กรุณาระบุรหัสอ้างอิงรายการวัสดุ");
  }

  return {
    sheet_name: sheetName,
    item: {
      id,
      added_date: "",
      so_sheet: null,
      source_row: 0,
      sales_customer: "",
      material_type: "",
      code: "",
      no: "",
      description: "",
      unit: "",
    },
    summary: blankCustomerMaterialsSummary(),
    remark: "",
    daily: [],
  };
}

export function blankCustomerMaterialsDailyEntry(
  day: number,
): CustomerMaterialsDailyEntry {
  if (!isCustomerMaterialsSourceDay(day)) {
    throw new Error("วันที่ในตาราง Excel ต้องอยู่ระหว่าง 1 ถึง 31");
  }

  return { day, values: blankCustomerMaterialsDaily() };
}

export function isCustomerMaterialsSourceDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

/** Valid editing slots: calendar days for monthly sheets, literal slots for carryover. */
export function customerMaterialsDaysInPeriod(
  sheetName: CustomerMaterialsSheetName,
): number[] {
  const period = CUSTOMER_MATERIALS_PERIODS[sheetName];
  const dayCount =
    period.month === null
      ? 31
      : new Date(Date.UTC(period.year_be - 543, period.month, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => index + 1);
}

/** Return no ISO date for the historical sheet rather than invent a month. */
export function customerMaterialsDateForDay(
  sheetName: CustomerMaterialsSheetName,
  day: number,
): string | null {
  const period = CUSTOMER_MATERIALS_PERIODS[sheetName];

  if (
    period.month === null ||
    !customerMaterialsDaysInPeriod(sheetName).includes(day)
  ) {
    return null;
  }

  const year = String(period.year_be - 543).padStart(4, "0");
  const month = String(period.month).padStart(2, "0");
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

export function customerMaterialsExcelDailyColumn(
  day: number,
  field: CustomerMaterialsDailyField,
): number {
  if (!isCustomerMaterialsSourceDay(day)) {
    throw new Error("วันที่ในตาราง Excel ต้องอยู่ระหว่าง 1 ถึง 31");
  }

  const fieldIndex = CUSTOMER_MATERIALS_DAILY_FIELDS.indexOf(field);
  if (fieldIndex < 0) {
    throw new Error("ไม่พบประเภทการรับ-จ่ายรายวัน");
  }

  return (
    CUSTOMER_MATERIALS_EXCEL_COLUMNS.daily_first +
    (day - 1) * CUSTOMER_MATERIALS_EXCEL_COLUMNS.daily_field_count +
    fieldIndex
  );
}

/* ---------------- Identity and search ---------------- */

export function customerMaterialsRowKey(row: CustomerMaterialsRow): string {
  const identity = row.item.id
    ? `local:${row.item.id}`
    : `source:${row.item.source_row}`;

  return `customer-materials:${row.sheet_name}:${identity}`;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH");
}

export function filterCustomerMaterialsRows(
  rows: readonly CustomerMaterialsRow[],
  search: string,
  soFilter: CustomerMaterialsSoFilter = "ALL",
): CustomerMaterialsRow[] {
  const matchingSo = rows.filter((row) => {
    if (soFilter === "ALL") return true;
    if (soFilter === "UNASSIGNED") {
      return row.item.so_sheet === undefined || row.item.so_sheet === null;
    }
    return row.item.so_sheet === soFilter;
  });

  const query = normalizeSearch(search);
  if (!query) {
    return matchingSo;
  }

  return matchingSo.filter((row) =>
    [
      row.item.so_sheet ?? "",
      row.item.sales_customer ?? "",
      row.item.material_type ?? "",
      row.item.code ?? "",
      row.item.no ?? "",
      row.item.description,
      row.item.unit ?? "",
      row.remark,
    ].some((value) => normalizeSearch(value).includes(query)),
  );
}

export function validateCustomerMaterialsSheetCoverage(
  sheets: readonly CustomerMaterialsSheet[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<CustomerMaterialsSheetName>();

  for (const sheet of sheets) {
    if (!CUSTOMER_MATERIALS_SHEET_NAMES.includes(sheet.name)) {
      errors.push(`ไม่พบชีตในไฟล์ต้นฉบับ: ${sheet.name}`);
    }
    if (seen.has(sheet.name)) {
      errors.push(`ชื่อชีตซ้ำ: ${sheet.name}`);
    }
    seen.add(sheet.name);
  }

  for (const name of CUSTOMER_MATERIALS_SHEET_NAMES) {
    if (!seen.has(name)) {
      errors.push(`ขาดชีต: ${name}`);
    }
  }

  return errors;
}

/* ---------------- Form validation ---------------- */

/** A blank field is valid; this check does not impose stock/sign rules. */
function isQuantityInput(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized === "" ||
    (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized) &&
      Number.isFinite(Number(normalized)))
  );
}

/** Validate a calendar date independently of the selected inventory period. */
export function isValidCustomerMaterialsAddedDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateCustomerMaterialsRow(
  row: CustomerMaterialsRow,
  mode: CustomerMaterialsFormMode = "EDIT",
  previous?: CustomerMaterialsRow,
): CustomerMaterialsFormErrors {
  const errors: CustomerMaterialsFormErrors = {};

  if (!row.item.description.trim()) {
    errors.description = "กรุณาระบุรายละเอียดวัสดุ";
  }

  if (mode === "CREATE" && !row.item.id?.trim()) {
    errors.id = "ไม่พบรหัสอ้างอิงรายการใหม่";
  }

  const addedDate = row.item.added_date?.trim() ?? "";
  if (!addedDate && mode === "CREATE") {
    errors.added_date = "กรุณาระบุวันที่เพิ่มวัสดุ";
  } else if (addedDate && !isValidCustomerMaterialsAddedDate(addedDate)) {
    errors.added_date = "กรุณาระบุวันที่ให้ถูกต้อง";
  }

  const soSheet = row.item.so_sheet;
  if (soSheet === undefined || soSheet === null) {
    if (mode === "CREATE") {
      errors.so_sheet = "กรุณาเลือกกลุ่ม SO";
    }
  } else if (!isCustomerMaterialsSoSheetName(soSheet)) {
    errors.so_sheet = "กรุณาเลือกกลุ่ม SO ที่ถูกต้อง";
  }

  for (const field of CUSTOMER_MATERIALS_SUMMARY_FIELDS) {
    // The source contains literal physical-count notes, e.g. "ลบ 2".
    // Keep that field text-capable and do not reject unchanged source cells.
    if (
      field === "physical_count" ||
      row.summary[field] === previous?.summary[field]
    ) {
      continue;
    }
    if (!isQuantityInput(row.summary[field])) {
      errors[field] =
        `กรุณาระบุ${CUSTOMER_MATERIALS_SUMMARY_LABELS[field]}เป็นตัวเลข`;
    }
  }

  return errors;
}

export function validateCustomerMaterialsDailyEntry(
  sheetName: CustomerMaterialsSheetName,
  entry: CustomerMaterialsDailyEntry,
): CustomerMaterialsFormErrors {
  const errors: CustomerMaterialsFormErrors = {};

  if (!customerMaterialsDaysInPeriod(sheetName).includes(entry.day)) {
    errors.day = "กรุณาเลือกวันที่ในงวดข้อมูลที่ถูกต้อง";
  }

  for (const field of CUSTOMER_MATERIALS_DAILY_FIELDS) {
    if (!isQuantityInput(entry.values[field])) {
      errors[field] =
        `กรุณาระบุ${CUSTOMER_MATERIALS_DAILY_LABELS[field]}เป็นตัวเลข`;
    }
  }

  return errors;
}

export function validateCustomerMaterialsCount(
  values: CustomerMaterialsCountValues,
): CustomerMaterialsFormErrors {
  const errors: CustomerMaterialsFormErrors = {};

  // Physical count may include a literal note, as in the source workbook.
  if (!isQuantityInput(values.count_difference)) {
    errors.count_difference = "กรุณาระบุผลต่างเป็นตัวเลข";
  }

  return errors;
}

function assertValidForm(errors: CustomerMaterialsFormErrors): void {
  const messages = Object.values(errors);
  if (messages.length > 0) {
    throw new Error(messages.join(" / "));
  }
}

/* ---------------- Immutable data operations ---------------- */

export function upsertCustomerMaterialsRow(
  sheet: CustomerMaterialsSheet,
  row: CustomerMaterialsRow,
  mode: CustomerMaterialsFormMode,
): CustomerMaterialsSheet {
  if (!isCustomerMaterialsRow(row) || row.sheet_name !== sheet.name) {
    throw new Error(
      "รายการวัสดุไม่ตรงกับงวดข้อมูลที่เลือกหรือโครงสร้างไม่ถูกต้อง",
    );
  }

  const key = customerMaterialsRowKey(row);
  const previous = sheet.rows.find(
    (existing) => customerMaterialsRowKey(existing) === key,
  );

  if (mode === "CREATE" && (previous || row.item.source_row !== 0)) {
    throw new Error("รหัสอ้างอิงรายการวัสดุซ้ำหรือไม่ใช่รายการใหม่");
  }
  if (mode === "EDIT" && !previous) {
    throw new Error("ไม่พบรายการวัสดุที่ต้องการแก้ไข");
  }

  assertValidForm(validateCustomerMaterialsRow(row, mode, previous));
  // The stock form must not overwrite movements or physical-count values.
  // Daily and count forms have their own operations below.
  const nextRow = previous
    ? {
        ...row,
        daily: previous.daily,
        summary: {
          ...row.summary,
          physical_count: previous.summary.physical_count,
          count_difference: previous.summary.count_difference,
        },
      }
    : row;

  return {
    ...sheet,
    rows: previous
      ? sheet.rows.map((existing) =>
          customerMaterialsRowKey(existing) === key ? nextRow : existing,
        )
      : [...sheet.rows, nextRow],
  };
}

export function removeCustomerMaterialsRow(
  sheet: CustomerMaterialsSheet,
  key: string,
): CustomerMaterialsSheet {
  return {
    ...sheet,
    rows: sheet.rows.filter((row) => customerMaterialsRowKey(row) !== key),
  };
}

export function getCustomerMaterialsDailyEntry(
  row: CustomerMaterialsRow,
  day: number,
): CustomerMaterialsDailyEntry {
  return (
    row.daily.find((entry) => entry.day === day) ??
    blankCustomerMaterialsDailyEntry(day)
  );
}

/** Update exactly one day; a blank day is omitted, not converted to zero. */
export function upsertCustomerMaterialsDailyEntry(
  row: CustomerMaterialsRow,
  entry: CustomerMaterialsDailyEntry,
): CustomerMaterialsRow {
  assertValidForm(validateCustomerMaterialsDailyEntry(row.sheet_name, entry));

  const values = { ...entry.values };
  for (const field of CUSTOMER_MATERIALS_DAILY_FIELDS) {
    values[field] = values[field].trim();
  }

  const daily = row.daily.filter((existing) => existing.day !== entry.day);
  if (CUSTOMER_MATERIALS_DAILY_FIELDS.some((field) => values[field] !== "")) {
    daily.push({ day: entry.day, values });
  }

  return {
    ...row,
    daily: daily.sort((left, right) => left.day - right.day),
    // summary and remark remain unchanged.
  };
}

export function updateCustomerMaterialsCount(
  row: CustomerMaterialsRow,
  values: CustomerMaterialsCountValues,
): CustomerMaterialsRow {
  assertValidForm(validateCustomerMaterialsCount(values));

  return {
    ...row,
    summary: {
      ...row.summary,
      physical_count: values.physical_count,
      count_difference: values.count_difference,
    },
    remark: values.remark,
  };
}

/** Replace a row after a dedicated daily/count operation, without recalculation. */
export function replaceCustomerMaterialsRow(
  sheet: CustomerMaterialsSheet,
  row: CustomerMaterialsRow,
): CustomerMaterialsSheet {
  const key = customerMaterialsRowKey(row);
  if (
    !isCustomerMaterialsRow(row) ||
    row.sheet_name !== sheet.name ||
    !sheet.rows.some((existing) => customerMaterialsRowKey(existing) === key)
  ) {
    throw new Error("ไม่พบรายการวัสดุในงวดข้อมูลที่เลือก");
  }

  return {
    ...sheet,
    rows: sheet.rows.map((existing) =>
      customerMaterialsRowKey(existing) === key ? row : existing,
    ),
  };
}

/* ---------------- Legacy Local Storage contracts ---------------- */

// Retained for compatibility until the workspace switches to the API.
// These helpers do not read, upload or migrate browser data.

export const CUSTOMER_MATERIALS_STORAGE_KEY = "ionflow:customer-materials:v1";
export const CUSTOMER_MATERIALS_STORAGE_VERSION = 1;

/** Store only changed/new rows and source-row deletions, not all 11 sheets. */
export interface CustomerMaterialsSheetChanges {
  upserts: CustomerMaterialsRow[];
  deleted_keys: string[];
}

export interface CustomerMaterialsStoredData {
  version: typeof CUSTOMER_MATERIALS_STORAGE_VERSION;
  changes: Partial<
    Record<CustomerMaterialsSheetName, CustomerMaterialsSheetChanges>
  >;
}

export function blankCustomerMaterialsStoredData(): CustomerMaterialsStoredData {
  return { version: CUSTOMER_MATERIALS_STORAGE_VERSION, changes: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function hasStringFields(value: unknown, fields: readonly string[]): boolean {
  return (
    isRecord(value) && fields.every((field) => typeof value[field] === "string")
  );
}

/** Structural check only: never coerce original source quantities or notes. */
export function isCustomerMaterialsRow(
  value: unknown,
): value is CustomerMaterialsRow {
  if (!isRecord(value) || !isRecord(value.item)) {
    return false;
  }

  const item = value.item;
  const sheetName = value.sheet_name;
  const hasLocalId = typeof item.id === "string" && item.id.trim() !== "";
  const validIdentity =
    typeof item.source_row === "number" &&
    Number.isInteger(item.source_row) &&
    ((hasLocalId && item.source_row === 0) ||
      (item.id === undefined && item.source_row >= 6));

  if (
    !CUSTOMER_MATERIALS_SHEET_NAMES.some((name) => name === sheetName) ||
    !validIdentity ||
    !(
      item.added_date === undefined ||
      item.added_date === null ||
      item.added_date === "" ||
      (typeof item.added_date === "string" &&
        isValidCustomerMaterialsAddedDate(item.added_date))
    ) ||
    !(
      item.so_sheet === undefined ||
      item.so_sheet === null ||
      isCustomerMaterialsSoSheetName(item.so_sheet)
    ) ||
    typeof item.description !== "string" ||
    ![
      item.sales_customer,
      item.material_type,
      item.code,
      item.no,
      item.unit,
    ].every(isNullableString) ||
    !hasStringFields(value.summary, CUSTOMER_MATERIALS_SUMMARY_FIELDS) ||
    typeof value.remark !== "string" ||
    !Array.isArray(value.daily)
  ) {
    return false;
  }

  const seen = new Set<number>();
  for (const entry of value.daily) {
    if (
      !isRecord(entry) ||
      typeof entry.day !== "number" ||
      !isCustomerMaterialsSourceDay(entry.day) ||
      seen.has(entry.day) ||
      !hasStringFields(entry.values, CUSTOMER_MATERIALS_DAILY_FIELDS)
    ) {
      return false;
    }
    seen.add(entry.day);
  }

  return true;
}

function indexCustomerMaterialsRows(
  sheetName: CustomerMaterialsSheetName,
  rows: readonly CustomerMaterialsRow[],
): Map<string, CustomerMaterialsRow> {
  const indexed = new Map<string, CustomerMaterialsRow>();

  for (const row of rows) {
    if (!isCustomerMaterialsRow(row) || row.sheet_name !== sheetName) {
      throw new Error("โครงสร้างข้อมูลวัสดุไม่ถูกต้องหรืออยู่คนละชีต");
    }
    const key = customerMaterialsRowKey(row);
    if (indexed.has(key)) {
      throw new Error("พบรหัสอ้างอิงรายการวัสดุซ้ำ");
    }
    indexed.set(key, row);
  }

  return indexed;
}

/** Build a small per-sheet diff against the complete baseline snapshot. */
export function buildCustomerMaterialsSheetChanges(
  source: CustomerMaterialsSheet,
  current: CustomerMaterialsSheet,
): CustomerMaterialsSheetChanges {
  if (source.name !== current.name) {
    throw new Error("ไม่สามารถเปรียบเทียบข้อมูลต่างชีตได้");
  }

  const original = indexCustomerMaterialsRows(source.name, source.rows);
  const edited = indexCustomerMaterialsRows(current.name, current.rows);
  const upserts: CustomerMaterialsRow[] = [];
  const deletedKeys: string[] = [];

  for (const [key, row] of edited) {
    const oldRow = original.get(key);
    if (!oldRow && !row.item.id) {
      throw new Error("ไม่พบแถวต้นฉบับของรายการวัสดุ");
    }
    if (!oldRow || JSON.stringify(oldRow) !== JSON.stringify(row)) {
      upserts.push(row);
    }
  }

  for (const key of original.keys()) {
    if (!edited.has(key)) {
      deletedKeys.push(key);
    }
  }

  return { upserts, deleted_keys: deletedKeys };
}

/** Restore one sheet; invalid overlays fail rather than silently losing data. */
export function applyCustomerMaterialsSheetChanges(
  source: CustomerMaterialsSheet,
  changes?: CustomerMaterialsSheetChanges,
): CustomerMaterialsSheet {
  if (!changes) {
    return source;
  }

  const original = indexCustomerMaterialsRows(source.name, source.rows);
  const upserts = indexCustomerMaterialsRows(source.name, changes.upserts);
  const deleted = new Set(changes.deleted_keys);

  if (deleted.size !== changes.deleted_keys.length) {
    throw new Error("ข้อมูลรายการที่ลบซ้ำกัน");
  }

  for (const key of deleted) {
    if (!original.has(key) || upserts.has(key)) {
      throw new Error("ข้อมูลรายการที่ลบไม่ตรงกับต้นฉบับ");
    }
  }

  for (const [key, row] of upserts) {
    if (!original.has(key) && !row.item.id) {
      throw new Error("ไม่พบแถวต้นฉบับของรายการวัสดุ");
    }
  }

  const rows = source.rows
    .filter((row) => !deleted.has(customerMaterialsRowKey(row)))
    .map((row) => upserts.get(customerMaterialsRowKey(row)) ?? row);

  for (const [key, row] of upserts) {
    if (!original.has(key)) {
      rows.push(row);
    }
  }

  return { ...source, rows };
}

/** Parse stored metadata and rows; source identity checks happen when applying. */
export function isCustomerMaterialsStoredData(
  value: unknown,
): value is CustomerMaterialsStoredData {
  if (
    !isRecord(value) ||
    value.version !== CUSTOMER_MATERIALS_STORAGE_VERSION ||
    !isRecord(value.changes)
  ) {
    return false;
  }

  for (const [name, changes] of Object.entries(value.changes)) {
    if (
      !CUSTOMER_MATERIALS_SHEET_NAMES.some((sheetName) => sheetName === name) ||
      !isRecord(changes) ||
      !Array.isArray(changes.upserts) ||
      !Array.isArray(changes.deleted_keys) ||
      !changes.deleted_keys.every((key: unknown) => typeof key === "string") ||
      !changes.upserts.every(
        (row: unknown) =>
          isCustomerMaterialsRow(row) && row.sheet_name === name,
      )
    ) {
      return false;
    }
  }

  return true;
}

/* ---------------- Database API contracts ---------------- */

/** A successfully loaded or saved sheet and its server-issued revision. */
export interface CustomerMaterialsSnapshot {
  sheet: CustomerMaterialsSheet;
  revision: string;
}

/** GET /api/stock/customer-materials?sheet_name=... */
export interface CustomerMaterialsGetResponse extends CustomerMaterialsSnapshot {
  ok: true;
}

/** POST /api/stock/customer-materials */
export interface CustomerMaterialsSaveRequest {
  action: "save_sheet";
  sheet_name: CustomerMaterialsSheetName;
  expected_revision: string;
  changes: CustomerMaterialsRow[];
  deleted_refs: string[];
}

export interface CustomerMaterialsSaveResponse extends CustomerMaterialsGetResponse {
  inserted: number;
  updated: number;
  deleted: number;
}

function isCustomerMaterialsRevision(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isChangeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Decode a successful GET or POST response without changing literal cells.
 * Do not treat an invalid response as an empty sheet or fall back to mock data.
 * Historical source slots outside the calendar month are structurally valid;
 * the existing editing rules continue to prevent changes to those slots.
 */
export function readCustomerMaterialsSnapshot(
  value: unknown,
  expectedSheetName: CustomerMaterialsSheetName,
): CustomerMaterialsSnapshot {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    !isCustomerMaterialsRevision(value.revision) ||
    !isRecord(value.sheet)
  ) {
    throw new Error("รูปแบบข้อมูลจาก API ไม่ถูกต้อง");
  }

  const { sheet, revision } = value;
  if (
    sheet.name !== expectedSheetName ||
    typeof sheet.report_caption !== "string" ||
    typeof sheet.period_caption !== "string" ||
    !Array.isArray(sheet.rows) ||
    !sheet.rows.every(isCustomerMaterialsRow)
  ) {
    throw new Error(
      "ข้อมูลจาก API ไม่ตรงกับงวดที่เลือกหรือมีโครงสร้างไม่ถูกต้อง",
    );
  }

  // Reject duplicate identities and rows belonging to a different sheet.
  indexCustomerMaterialsRows(expectedSheetName, sheet.rows);

  return {
    revision,
    sheet: {
      name: expectedSheetName,
      report_caption: sheet.report_caption,
      period_caption: sheet.period_caption,
      rows: sheet.rows,
    },
  };
}

/** Decode the saved snapshot and the server's actual operation counts. */
export function readCustomerMaterialsSaveResponse(
  value: unknown,
  expectedSheetName: CustomerMaterialsSheetName,
): CustomerMaterialsSaveResponse {
  const snapshot = readCustomerMaterialsSnapshot(value, expectedSheetName);
  if (
    !isRecord(value) ||
    !isChangeCount(value.inserted) ||
    !isChangeCount(value.updated) ||
    !isChangeCount(value.deleted)
  ) {
    throw new Error("ไม่สามารถยืนยันผลการบันทึกจาก API ได้");
  }

  return {
    ok: true,
    ...snapshot,
    inserted: value.inserted,
    updated: value.updated,
    deleted: value.deleted,
  };
}

/**
 * Compare the complete saved sheet with the complete draft, never the filtered
 * or paginated rows. Omitted baseline rows become explicit deletion refs;
 * the API performs Soft Delete only after a successful transaction.
 * The revision is received from the server, not generated by the client.
 */
export function buildCustomerMaterialsSaveRequest(
  baseline: CustomerMaterialsSnapshot,
  draft: CustomerMaterialsSheet,
): CustomerMaterialsSaveRequest {
  if (!isCustomerMaterialsRevision(baseline.revision)) {
    throw new Error(
      "ไม่พบ Revision ที่ถูกต้อง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก",
    );
  }

  const { upserts, deleted_keys: deletedRefs } =
    buildCustomerMaterialsSheetChanges(baseline.sheet, draft);

  return {
    action: "save_sheet",
    sheet_name: baseline.sheet.name,
    expected_revision: baseline.revision,
    changes: upserts,
    deleted_refs: deletedRefs,
  };
}
