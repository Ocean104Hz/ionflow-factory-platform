/**
 * Domain for the organic extraction-material receipt / issue ledger.
 * UI MOCK ONLY: no API or database writes.
 *
 * Confirmed: the opening balance is entered MANUALLY for every document.
 * It is never loaded from, or automatically copied from, a prior document.
 *
 * Source: factory paper form FR-P2-06/Rev.03 (23 numbered RM rows).
 * Material names stay editable and empty until the factory confirms them.
 * No one-document-per-day restriction or unapproved required-quantity rules.
 */

export const ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE = "บันทึกการรับ-จ่าย วัตถุดิบต้มสกัด";
export const ORGANIC_EXTRACTION_MATERIAL_LEDGER_CODE = "FR-P2-06/Rev.03";

export const ORGANIC_EXTRACTION_MATERIAL_CODES = [
  "RM-1001",
  "RM-1002",
  "RM-2001",
  "RM-2002",
  "RM-2003",
  "RM-2004",
  "RM-2005",
  "RM-2006",
  "RM-2007",
  "RM-2008",
  "RM-2101",
  "RM-2102",
  "RM-2201",
  "RM-2202",
  "RM-2203",
  "RM-2204",
  "RM-2205",
  "RM-2206",
  "RM-2207",
  "RM-2208",
  "RM-2209",
  "RM-2210",
  "RM-2211",
] as const;

export const ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT =
  ORGANIC_EXTRACTION_MATERIAL_CODES.length;

/** The three issue fields are all deductions, as printed on the sheet. */
export const ORGANIC_EXTRACTION_MATERIAL_QUANTITY_FIELDS = [
  "opening_balance",
  "received",
  "issued_for_production",
  "issued_adjustment",
  "issued_waste",
] as const;

export type OrganicExtractionMaterialQuantityField =
  (typeof ORGANIC_EXTRACTION_MATERIAL_QUANTITY_FIELDS)[number];

/** One material row, with a calculated (not persisted) closing balance. */
export interface OrganicExtractionMaterialLedgerRow {
  row_number: number;
  material_code: string;
  material_name: string;
  unit: string;
  opening_balance: string;
  received: string;
  issued_for_production: string;
  issued_adjustment: string;
  issued_waste: string;
  remark: string;
}

export interface OrganicExtractionMaterialLedgerSheet {
  id: string;
  document_date: string;
  prepared_by: string;
  inspected_by: string;
  rows: OrganicExtractionMaterialLedgerRow[];
  created_at: string;
  updated_at: string;
}

export type OrganicExtractionMaterialLedgerErrors = Record<string, string>;

export interface OrganicExtractionMaterialLedgerHistoryFilters {
  search: string;
  from: string;
  to: string;
}

export const emptyOrganicExtractionMaterialLedgerFilters:
  OrganicExtractionMaterialLedgerHistoryFilters = {
    search: "",
    from: "",
    to: "",
  };

/** New sheets deliberately start with EMPTY opening balances. */
export function blankOrganicExtractionMaterialLedgerSheet():
  OrganicExtractionMaterialLedgerSheet {
  return {
    id: "",
    document_date: "",
    prepared_by: "",
    inspected_by: "",
    rows: ORGANIC_EXTRACTION_MATERIAL_CODES.map((materialCode, index) => ({
      row_number: index + 1,
      material_code: materialCode,
      material_name: "",
      unit: "Kg",
      opening_balance: "",
      received: "",
      issued_for_production: "",
      issued_adjustment: "",
      issued_waste: "",
      remark: "",
    })),
    created_at: "",
    updated_at: "",
  };
}

export function isValidOrganicExtractionMaterialDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function formatOrganicExtractionMaterialDate(value: string): string {
  if (!isValidOrganicExtractionMaterialDate(value)) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${Number(year) + 543}`;
}

export function organicExtractionMaterialSavedDateKey(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date(value));

  const get = (type: "year" | "month" | "day"): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatOrganicExtractionMaterialSavedDate(
  value: string,
): string {
  return (
    formatOrganicExtractionMaterialDate(
      organicExtractionMaterialSavedDateKey(value),
    ) || "-"
  );
}

/* All values are strings; this avoids losing user-entered decimal precision. */
const NONNEGATIVE_QUANTITY_PATTERN =
  /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

type DecimalQuantity = {
  units: bigint;
  places: number;
};

/** Empty quantities count as zero ONLY when computing a populated row. */
function parseOrganicExtractionMaterialQuantity(
  value: string,
): DecimalQuantity | null {
  const text = value.trim();
  if (text === "") {
    return { units: BigInt(0), places: 0 };
  }
  if (!NONNEGATIVE_QUANTITY_PATTERN.test(text)) {
    return null;
  }

  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  return {
    units: BigInt(`${whole}${fraction}`),
    places: fraction.length,
  };
}

export function isValidOrganicExtractionMaterialQuantity(
  value: string,
): boolean {
  return parseOrganicExtractionMaterialQuantity(value) !== null;
}

function decimalQuantityToString(units: bigint, places: number): string {
  const isNegative = units < BigInt(0);
  const digits = (isNegative ? -units : units)
    .toString()
    .padStart(places + 1, "0");

  if (places === 0) {
    return `${isNegative ? "-" : ""}${digits}`;
  }

  const whole = digits.slice(0, -places);
  const fraction = digits.slice(-places).replace(/0+$/, "");
  return `${isNegative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function hasOrganicExtractionMaterialQuantityEntry(
  row: OrganicExtractionMaterialLedgerRow,
): boolean {
  return ORGANIC_EXTRACTION_MATERIAL_QUANTITY_FIELDS.some(
    (field) => row[field].trim() !== "",
  );
}

/**
 * Closing = opening + received - production - adjustment - waste.
 * Return null if all quantity cells are blank, or any is invalid.
 * BigInt scaling keeps 0.1 + 0.2 - 0.3 exactly equal to zero.
 * Negative results are returned visibly; business blocking is not invented.
 */
export function calculateOrganicExtractionMaterialClosingBalance(
  row: OrganicExtractionMaterialLedgerRow,
): string | null {
  if (!hasOrganicExtractionMaterialQuantityEntry(row)) {
    return null;
  }

  const amounts = ORGANIC_EXTRACTION_MATERIAL_QUANTITY_FIELDS.map((field) =>
    parseOrganicExtractionMaterialQuantity(row[field]),
  );
  if (amounts.some((amount) => amount === null)) {
    return null;
  }

  const validAmounts = amounts.filter(
    (amount): amount is DecimalQuantity => amount !== null,
  );
  const places = Math.max(...validAmounts.map((amount) => amount.places));
  const values = validAmounts.map(
    (amount) =>
      amount.units * BigInt(10) ** BigInt(places - amount.places),
  );

  const [opening, received, production, adjustment, waste] = values;
  if (
    opening === undefined ||
    received === undefined ||
    production === undefined ||
    adjustment === undefined ||
    waste === undefined
  ) {
    return null;
  }

  const closing = opening + received - production - adjustment - waste;
  return decimalQuantityToString(closing, places);
}

export function validateOrganicExtractionMaterialLedgerSheet(
  sheet: OrganicExtractionMaterialLedgerSheet,
): OrganicExtractionMaterialLedgerErrors {
  const errors: OrganicExtractionMaterialLedgerErrors = {};

  if (!isValidOrganicExtractionMaterialDate(sheet.document_date)) {
    errors.document_date = "กรุณาระบุวันที่เอกสารให้ถูกต้อง";
  }

  if (sheet.rows.length !== ORGANIC_EXTRACTION_MATERIAL_ROW_COUNT) {
    errors.rows = "เอกสารต้องมี 23 แถวตามแบบฟอร์มต้นฉบับ";
  }

  ORGANIC_EXTRACTION_MATERIAL_CODES.forEach((materialCode, index) => {
    const row = sheet.rows[index];
    if (
      !row ||
      row.row_number !== index + 1 ||
      row.material_code !== materialCode
    ) {
      errors[`rows.${index}.material_code`] = "ลำดับรายการไม่ตรงกับแบบฟอร์มต้นฉบับ";
      return;
    }

    ORGANIC_EXTRACTION_MATERIAL_QUANTITY_FIELDS.forEach((field) => {
      if (!isValidOrganicExtractionMaterialQuantity(row[field])) {
        errors[`rows.${index}.${field}`] = "กรุณากรอกจำนวนที่ไม่ติดลบให้ถูกต้อง";
      }
    });
  });

  return errors;
}

/** In-memory save; never pulls a balance from another document. */
export function saveOrganicExtractionMaterialLedgerSheet(
  records: readonly OrganicExtractionMaterialLedgerSheet[],
  draft: OrganicExtractionMaterialLedgerSheet,
  newId: string,
  savedAt: string,
): {
  saved: OrganicExtractionMaterialLedgerSheet;
  records: OrganicExtractionMaterialLedgerSheet[];
} {
  if (
    Object.keys(validateOrganicExtractionMaterialLedgerSheet(draft)).length > 0
  ) {
    throw new Error("กรุณาแก้ไขข้อมูลที่แจ้งก่อนบันทึก");
  }
  if (!Number.isFinite(Date.parse(savedAt))) {
    throw new Error("วันที่บันทึกไม่ถูกต้อง");
  }

  const original = draft.id
    ? records.find((sheet) => sheet.id === draft.id)
    : undefined;

  if (draft.id && !original) {
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  }
  if (!draft.id && (!newId || records.some((sheet) => sheet.id === newId))) {
    throw new Error("รหัสเอกสารซ้ำ กรุณาลองใหม่");
  }

  const saved: OrganicExtractionMaterialLedgerSheet = structuredClone({
    ...draft,
    id: draft.id || newId,
    prepared_by: draft.prepared_by.trim(),
    inspected_by: draft.inspected_by.trim(),
    created_at: original?.created_at || savedAt,
    updated_at: savedAt,
    rows: draft.rows.map((row) => ({
      ...row,
      material_name: row.material_name.trim(),
      unit: row.unit.trim(),
      opening_balance: row.opening_balance.trim(),
      received: row.received.trim(),
      issued_for_production: row.issued_for_production.trim(),
      issued_adjustment: row.issued_adjustment.trim(),
      issued_waste: row.issued_waste.trim(),
      remark: row.remark.trim(),
    })),
  });

  const nextRecords = original
    ? records.map((record) => (record.id === saved.id ? saved : record))
    : [saved, ...records];

  return { saved, records: nextRecords };
}

export function deleteOrganicExtractionMaterialLedgerSheet(
  records: readonly OrganicExtractionMaterialLedgerSheet[],
  id: string,
): OrganicExtractionMaterialLedgerSheet[] {
  return records.filter((record) => record.id !== id);
}

export function organicExtractionMaterialLedgerFilterError(
  filters: OrganicExtractionMaterialLedgerHistoryFilters,
): string {
  if (
    (filters.from && !isValidOrganicExtractionMaterialDate(filters.from)) ||
    (filters.to && !isValidOrganicExtractionMaterialDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }
  return filters.from && filters.to && filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}

export function filterOrganicExtractionMaterialLedgerSheets(
  records: readonly OrganicExtractionMaterialLedgerSheet[],
  filters: OrganicExtractionMaterialLedgerHistoryFilters,
): OrganicExtractionMaterialLedgerSheet[] {
  if (organicExtractionMaterialLedgerFilterError(filters)) {
    return [];
  }

  const search = filters.search.trim().toLocaleLowerCase();
  return records.filter((sheet) => {
    if (filters.from && sheet.document_date < filters.from) {
      return false;
    }
    if (filters.to && sheet.document_date > filters.to) {
      return false;
    }
    if (!search) {
      return true;
    }

    const values = [
      sheet.id,
      sheet.document_date,
      sheet.prepared_by,
      sheet.inspected_by,
      ...sheet.rows.flatMap((row) => [
        row.material_code,
        row.material_name,
        row.remark,
      ]),
    ];
    return values.some((value) => value.toLocaleLowerCase().includes(search));
  });
}

export function paginateOrganicExtractionMaterialLedgerSheets<T>(
  records: readonly T[],
  requestedPage: number,
  pageSize: number,
): {
  page: number;
  totalPages: number;
  items: T[];
} {
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(records.length / safeSize));
  const page = Math.max(
    1,
    Math.min(
      Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1,
      totalPages,
    ),
  );
  return {
    page,
    totalPages,
    items: records.slice((page - 1) * safeSize, page * safeSize),
  };
}
