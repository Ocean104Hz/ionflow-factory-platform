/**
 * Domain for the organic-unit raw-material receiving / inspection sheet.
 * The source paper has ten numbered entry slots, not a fixed material catalog.
 */

export const ORGANIC_RAW_MATERIAL_FORM_TITLE =
  "ใบตรวจรับวัตถุดิบ/รับเข้าวัตถุดิบ";
export const ORGANIC_RAW_MATERIAL_FORM_CODE = "FR-P2-03/Rev.02";
export const ORGANIC_RAW_MATERIAL_ROW_COUNT = 10;

/** The printed inspection key: / = pass, O = acceptable, X = fail. */
export const ORGANIC_QC_RESULTS = [
  { value: "/", label: "ผ่าน" },
  { value: "O", label: "ยอมรับได้" },
  { value: "X", label: "ไม่ผ่าน" },
] as const;

export type OrganicQcResult = "" | (typeof ORGANIC_QC_RESULTS)[number]["value"];

export const ORGANIC_QC_FIELDS = [
  "qc_weight",
  "qc_contamination",
  "qc_physical",
  "qc_color",
] as const;

export type OrganicQcField = (typeof ORGANIC_QC_FIELDS)[number];
export type OrganicMaterialRowField =
  | "material_code"
  | "supplier_code"
  | "quantity"
  | "unit"
  | OrganicQcField
  | "remark";

export interface OrganicRawMaterialReceivingRow {
  row_number: number;
  material_code: string;
  supplier_code: string;
  quantity: string;
  unit: string;
  qc_weight: OrganicQcResult;
  qc_contamination: OrganicQcResult;
  qc_physical: OrganicQcResult;
  qc_color: OrganicQcResult;
  remark: string;
}

export interface OrganicRawMaterialReceivingSheet {
  id: string;
  document_date: string;
  received_by: string;
  inspected_by: string;
  rows: OrganicRawMaterialReceivingRow[];
  created_at: string;
  updated_at: string;
}

export type OrganicRawMaterialErrors = Record<string, string>;

export interface OrganicRawMaterialHistoryFilters {
  search: string;
  from: string;
  to: string;
}

export const emptyOrganicRawMaterialFilters: OrganicRawMaterialHistoryFilters = {
  search: "",
  from: "",
  to: "",
};

export function blankOrganicRawMaterialRow(
  rowNumber: number,
): OrganicRawMaterialReceivingRow {
  return {
    row_number: rowNumber,
    material_code: "",
    supplier_code: "",
    quantity: "",
    unit: "",
    qc_weight: "",
    qc_contamination: "",
    qc_physical: "",
    qc_color: "",
    remark: "",
  };
}

/** Ten editable paper slots. No material codes or suppliers are invented. */
export function blankOrganicRawMaterialSheet(): OrganicRawMaterialReceivingSheet {
  return {
    id: "",
    document_date: "",
    received_by: "",
    inspected_by: "",
    rows: Array.from({ length: ORGANIC_RAW_MATERIAL_ROW_COUNT }, (_, index) =>
      blankOrganicRawMaterialRow(index + 1),
    ),
    created_at: "",
    updated_at: "",
  };
}

export function isValidOrganicMaterialDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

/** Use explicit Buddhist Era conversion for a stable SSR/client result. */
export function formatOrganicMaterialDate(value: string): string {
  if (!isValidOrganicMaterialDate(value)) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${Number(year) + 543}`;
}

export function organicMaterialSavedDateKey(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date(value));
  const find = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${find("year")}-${find("month")}-${find("day")}`;
}

export function formatOrganicMaterialDateTime(value: string): string {
  return formatOrganicMaterialDate(organicMaterialSavedDateKey(value)) || "-";
}

const QUANTITY_PATTERN = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

/** Quantity is a positive number; keep the entered text for accurate display. */
export function isValidOrganicMaterialQuantity(value: string): boolean {
  const text = value.trim();
  if (!QUANTITY_PATTERN.test(text)) {
    return false;
  }

  const quantity = Number(text.replaceAll(",", ""));
  return Number.isFinite(quantity) && quantity > 0;
}

export function isOrganicQcResult(value: string): value is OrganicQcResult {
  return (
    value === "" ||
    ORGANIC_QC_RESULTS.some((result) => result.value === value)
  );
}

export function getOrganicQcLabel(result: OrganicQcResult): string {
  return ORGANIC_QC_RESULTS.find((item) => item.value === result)?.label ?? "";
}

export function isOrganicMaterialRowUsed(
  row: OrganicRawMaterialReceivingRow,
): boolean {
  return (
    row.material_code.trim() !== "" ||
    row.supplier_code.trim() !== "" ||
    row.quantity.trim() !== "" ||
    row.unit.trim() !== "" ||
    ORGANIC_QC_FIELDS.some((field) => row[field] !== "") ||
    row.remark.trim() !== ""
  );
}

export function getOrganicMaterialUsedRows(
  sheet: OrganicRawMaterialReceivingSheet,
): OrganicRawMaterialReceivingRow[] {
  return sheet.rows.filter(isOrganicMaterialRowUsed);
}

/** Blank paper slots may remain empty, but a populated slot needs identifying data. */
export function validateOrganicRawMaterialSheet(
  sheet: OrganicRawMaterialReceivingSheet,
): OrganicRawMaterialErrors {
  const errors: OrganicRawMaterialErrors = {};

  if (!isValidOrganicMaterialDate(sheet.document_date)) {
    errors.document_date = "กรุณาระบุวันที่เอกสารให้ถูกต้อง";
  }

  if (sheet.rows.length !== ORGANIC_RAW_MATERIAL_ROW_COUNT) {
    errors.rows = "เอกสารต้องมี 10 แถวตามแบบฟอร์มต้นฉบับ";
  }

  sheet.rows.forEach((row, index) => {
    if (row.row_number !== index + 1) {
      errors[`rows.${index}.row_number`] =
        "ลำดับรายการไม่ตรงกับแบบฟอร์มต้นฉบับ";
    }

    ORGANIC_QC_FIELDS.forEach((field) => {
      if (!isOrganicQcResult(row[field])) {
        errors[`rows.${index}.${field}`] =
          "ผลตรวจสอบคุณภาพไม่ถูกต้อง";
      }
    });

    if (!isOrganicMaterialRowUsed(row)) {
      return;
    }

    if (!row.material_code.trim()) {
      errors[`rows.${index}.material_code`] = "กรุณาระบุรหัสวัตถุดิบ";
    }

    if (!isValidOrganicMaterialQuantity(row.quantity)) {
      errors[`rows.${index}.quantity`] =
        "กรุณาระบุจำนวนที่มากกว่า 0 ให้ถูกต้อง";
    }

    if (!row.unit.trim()) {
      errors[`rows.${index}.unit`] = "กรุณาระบุหน่วย";
    }
  });

  return errors;
}

/** Validates and normalizes the receiving document. */
export function saveOrganicRawMaterialSheet(
  records: readonly OrganicRawMaterialReceivingSheet[],
  draft: OrganicRawMaterialReceivingSheet,
  newId: string,
  savedAt: string,
): {
  saved: OrganicRawMaterialReceivingSheet;
  records: OrganicRawMaterialReceivingSheet[];
} {
  if (Object.keys(validateOrganicRawMaterialSheet(draft)).length > 0) {
    throw new Error("กรุณาแก้ไขข้อมูลที่แจ้งก่อนบันทึก");
  }

  if (!Number.isFinite(Date.parse(savedAt))) {
    throw new Error("วันที่บันทึกไม่ถูกต้อง");
  }

  const oldSheet = draft.id
    ? records.find((record) => record.id === draft.id)
    : undefined;

  if (draft.id && !oldSheet) {
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  }

  if (!draft.id && (!newId || records.some((record) => record.id === newId))) {
    throw new Error("รหัสเอกสารซ้ำ กรุณาลองใหม่");
  }

  if (
    records.some(
      (record) =>
        record.document_date === draft.document_date &&
        record.id !== draft.id,
    )
  ) {
    throw new Error("มีใบตรวจรับวัตถุดิบสำหรับวันที่นี้อยู่แล้ว");
  }

  const saved: OrganicRawMaterialReceivingSheet = structuredClone({
    ...draft,
    id: draft.id || newId,
    received_by: draft.received_by.trim(),
    inspected_by: draft.inspected_by.trim(),
    created_at: oldSheet?.created_at || savedAt,
    updated_at: savedAt,
    rows: draft.rows.map((row) => ({
      ...row,
      material_code: row.material_code.trim(),
      supplier_code: row.supplier_code.trim(),
      quantity: row.quantity.trim(),
      unit: row.unit.trim(),
      remark: row.remark.trim(),
    })),
  });

  const nextRecords = oldSheet
    ? records.map((record) => (record.id === draft.id ? saved : record))
    : [saved, ...records];

  return { saved, records: nextRecords };
}

export function deleteOrganicRawMaterialSheet(
  records: readonly OrganicRawMaterialReceivingSheet[],
  id: string,
): OrganicRawMaterialReceivingSheet[] {
  return records.filter((record) => record.id !== id);
}

export function organicMaterialFilterError(
  filters: OrganicRawMaterialHistoryFilters,
): string {
  if (
    (filters.from && !isValidOrganicMaterialDate(filters.from)) ||
    (filters.to && !isValidOrganicMaterialDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  return filters.from && filters.to && filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}

export function filterOrganicRawMaterialSheets(
  records: readonly OrganicRawMaterialReceivingSheet[],
  filters: OrganicRawMaterialHistoryFilters,
): OrganicRawMaterialReceivingSheet[] {
  if (organicMaterialFilterError(filters)) {
    return [];
  }

  const keyword = filters.search.trim().toLocaleLowerCase();

  return records.filter((sheet) => {
    if (filters.from && sheet.document_date < filters.from) {
      return false;
    }
    if (filters.to && sheet.document_date > filters.to) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    const searchable = [
      sheet.id,
      sheet.document_date,
      sheet.received_by,
      sheet.inspected_by,
      ...sheet.rows.flatMap((row) => [
        row.material_code,
        row.supplier_code,
        row.quantity,
        row.unit,
        row.remark,
      ]),
    ];

    return searchable.some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    );
  });
}

export function paginateOrganicRawMaterialSheets<T>(
  records: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
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
