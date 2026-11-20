/**
 * ข้อมูลและกฎพื้นฐานสำหรับบันทึกการรับ-จ่าย WIP รายวัน
 * UI MOCK ONLY: ไม่เรียก API และไม่บันทึกฐานข้อมูลจริง
 * หนึ่งวันมีหนึ่งเอกสาร และหนึ่งเอกสารมี WIP 11 รายการคงที่
 */

export const WIP_FORM_CODE = "FR-P2-14/Rev.00";

export type WipMasterItem = {
  readonly id: string;
  readonly name: string | null;
  readonly unit: "ลิตร";
};

/**
 * ลำดับรายการตรงกับกระดาษตัวอย่าง
 * null = ยังอ่านชื่อจากภาพไม่ชัด ไม่ใช่ชื่อสินค้าใหม่
 * ห้ามแทนชื่อเหล่านี้ด้วยชื่อที่คาดเดาก่อนตรวจสอบกับโรงงาน
 */
export const WIP_MASTER_ITEMS = [
  { id: "wip-01", name: "อะซิโทน", unit: "ลิตร" },
  { id: "wip-02", name: null, unit: "ลิตร" },
  { id: "wip-03", name: "B เงิน", unit: "ลิตร" },
  { id: "wip-04", name: "B ส้ม", unit: "ลิตร" },
  { id: "wip-05", name: "B แดง", unit: "ลิตร" },
  { id: "wip-06", name: "ไอเอส", unit: "ลิตร" },
  { id: "wip-07", name: null, unit: "ลิตร" },
  { id: "wip-08", name: "พารา", unit: "ลิตร" },
  { id: "wip-09", name: null, unit: "ลิตร" },
  { id: "wip-10", name: null, unit: "ลิตร" },
  { id: "wip-11", name: null, unit: "ลิตร" },
] as const satisfies readonly WipMasterItem[];

export type WipItemId = (typeof WIP_MASTER_ITEMS)[number]["id"];

export const WIP_QUANTITY_FIELDS = [
  "opening_balance",
  "received",
  "issued_for_production",
  "issued_as_product",
  "transferred_out",
] as const;

export type WipQuantityField = (typeof WIP_QUANTITY_FIELDS)[number];
export type WipRowField = WipQuantityField | "remark";

export interface WipReceivingIssuingRow
  extends Record<WipRowField, string> {
  item_id: WipItemId;
}

/** รูปแบบวันที่และเวลาใช้ string เหมือน Domain ของ Lab */
export interface WipReceivingIssuingSheet {
  id: string;
  document_date: string;
  prepared_by: string;
  checked_by: string;
  rows: WipReceivingIssuingRow[];
  created_at: string;
  updated_at: string;
}

export type WipErrors = Record<string, string>;

export interface WipHistoryFilters {
  search: string;
  from: string;
  to: string;
}

export const emptyWipFilters: WipHistoryFilters = {
  search: "",
  from: "",
  to: "",
};

export function getWipItemDisplayName(itemId: WipItemId): string {
  const index = WIP_MASTER_ITEMS.findIndex((item) => item.id === itemId);

  if (index < 0) {
    return "ไม่พบรายการ WIP";
  }

  return (
    WIP_MASTER_ITEMS[index].name ??
    `รายการที่ ${index + 1} (รอยืนยันชื่อ)`
  );
}

export function getUnconfirmedWipItems(): WipItemId[] {
  return WIP_MASTER_ITEMS.filter((item) => item.name === null).map(
    (item) => item.id,
  );
}

/** การสร้างวันใหม่ไม่คัดลอกยอดยกมาจากวันก่อน */
export function blankWipSheet(): WipReceivingIssuingSheet {
  return {
    id: "",
    document_date: "",
    prepared_by: "",
    checked_by: "",
    rows: WIP_MASTER_ITEMS.map((item) => ({
      item_id: item.id,
      opening_balance: "",
      received: "",
      issued_for_production: "",
      issued_as_product: "",
      transferred_out: "",
      remark: "",
    })),
    created_at: "",
    updated_at: "",
  };
}

/* ---------------- dates ---------------- */

export function isValidWipDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function formatWipDate(value: string): string {
  if (!isValidWipDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function wipSavedDateKey(value: string): string {
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

export function formatWipDateTime(value: string): string {
  return formatWipDate(wipSavedDateKey(value)) || "-";
}

/* ---------------- amounts ---------------- */

const QUANTITY_PATTERN = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

type DecimalParts = {
  units: bigint;
  decimalPlaces: number;
};

/** ช่องว่างมีค่าเป็น 0, รับเลขจำนวนบวกและทศนิยมตามที่ผู้ใช้กรอก */
function parseWipQuantity(value: string): DecimalParts | null {
  const text = value.trim();

  if (!text) {
    return { units: BigInt(0), decimalPlaces: 0 };
  }

  if (!QUANTITY_PATTERN.test(text)) {
    return null;
  }

  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");

  return {
    units: BigInt(`${whole}${fraction}`),
    decimalPlaces: fraction.length,
  };
}

export function isValidWipQuantity(value: string): boolean {
  return parseWipQuantity(value) !== null;
}

function decimalToString(units: bigint, decimalPlaces: number): string {
  const negative = units < BigInt(0);
  const digits = (negative ? -units : units)
    .toString()
    .padStart(decimalPlaces + 1, "0");

  if (decimalPlaces === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const whole = digits.slice(0, -decimalPlaces);
  const fraction = digits.slice(-decimalPlaces).replace(/0+$/, "");

  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

/**
 * คงเหลือ = ยอดยกมา + รับ - ผลิต - สินค้า - โอน
 * ใช้ bigint เพื่อคำนวณทศนิยมตรงค่า โดยไม่เกิด floating point error
 */
export function calculateWipClosingBalance(
  row: WipReceivingIssuingRow,
): string | null {
  const amounts = WIP_QUANTITY_FIELDS.map((field) =>
    parseWipQuantity(row[field]),
  );

  if (amounts.some((amount) => amount === null)) {
    return null;
  }

  // ตรวจ null แล้วด้านบน แต่ TypeScript ยังต้องการ type guard
  const validAmounts = amounts.filter(
    (amount): amount is DecimalParts => amount !== null,
  );
  const decimalPlaces = Math.max(
    ...validAmounts.map((amount) => amount.decimalPlaces),
  );
  const values = validAmounts.map(
    (amount) =>
      amount.units * BigInt(10) ** BigInt(decimalPlaces - amount.decimalPlaces),
  );

  const remaining = values[0] + values[1] - values[2] - values[3] - values[4];

  return decimalToString(remaining, decimalPlaces);
}

/* ---------------- validation ---------------- */

export function validateWipSheet(
  sheet: WipReceivingIssuingSheet,
): WipErrors {
  const errors: WipErrors = {};

  if (!isValidWipDate(sheet.document_date)) {
    errors.document_date = "กรุณาระบุวันที่เอกสารให้ถูกต้อง";
  }

  if (sheet.rows.length !== WIP_MASTER_ITEMS.length) {
    errors.rows = "รายการ WIP ต้องตรงกับรายการคงที่ทั้ง 11 แถว";
  }

  WIP_MASTER_ITEMS.forEach((masterItem, index) => {
    const row = sheet.rows[index];

    if (!row || row.item_id !== masterItem.id) {
      errors[`rows.${index}.item_id`] =
        "ลำดับรายการ WIP ไม่ตรงกับเอกสารต้นแบบ";
      return;
    }

    WIP_QUANTITY_FIELDS.forEach((field) => {
      if (!isValidWipQuantity(row[field])) {
        errors[`rows.${index}.${field}`] =
          "กรุณากรอกจำนวนที่ไม่ติดลบให้ถูกต้อง";
      }
    });

    const remaining = calculateWipClosingBalance(row);

    if (remaining?.startsWith("-")) {
      errors[`rows.${index}.closing_balance`] =
        "จำนวนจ่ายรวมต้องไม่มากกว่ายอดยกมารวมกับยอดรับ";
    }
  });

  return errors;
}

/* ---------------- save/delete ---------------- */

export function saveWipSheet(
  records: readonly WipReceivingIssuingSheet[],
  draft: WipReceivingIssuingSheet,
  newId: string,
  savedAt: string,
): {
  saved: WipReceivingIssuingSheet;
  records: WipReceivingIssuingSheet[];
} {
  if (Object.keys(validateWipSheet(draft)).length > 0) {
    throw new Error("กรุณาแก้ไขข้อมูลที่แจ้งก่อนบันทึก");
  }

  if (!Number.isFinite(Date.parse(savedAt))) {
    throw new Error("วันที่บันทึกไม่ถูกต้อง");
  }

  const oldSheet = draft.id
    ? records.find((sheet) => sheet.id === draft.id)
    : undefined;

  if (draft.id && !oldSheet) {
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  }

  if (
    !draft.id &&
    (!newId || records.some((sheet) => sheet.id === newId))
  ) {
    throw new Error("รหัสเอกสารซ้ำ กรุณาลองใหม่");
  }

  if (
    records.some(
      (sheet) =>
        sheet.document_date === draft.document_date &&
        sheet.id !== draft.id,
    )
  ) {
    throw new Error("มีแบบบันทึกรับ-จ่าย WIP สำหรับวันที่นี้อยู่แล้ว");
  }

  const saved: WipReceivingIssuingSheet = structuredClone({
    ...draft,
    id: draft.id || newId,
    prepared_by: draft.prepared_by.trim(),
    checked_by: draft.checked_by.trim(),
    created_at: oldSheet?.created_at || savedAt,
    updated_at: savedAt,
    rows: draft.rows.map((row) => ({
      ...row,
      opening_balance: row.opening_balance.trim(),
      received: row.received.trim(),
      issued_for_production: row.issued_for_production.trim(),
      issued_as_product: row.issued_as_product.trim(),
      transferred_out: row.transferred_out.trim(),
      remark: row.remark.trim(),
    })),
  });

  const nextRecords = oldSheet
    ? records.map((sheet) => (sheet.id === draft.id ? saved : sheet))
    : [saved, ...records];

  return { saved, records: nextRecords };
}

export function deleteWipSheet(
  records: readonly WipReceivingIssuingSheet[],
  id: string,
): WipReceivingIssuingSheet[] {
  return records.filter((sheet) => sheet.id !== id);
}

/* ---------------- history ---------------- */

export function wipFilterError(filters: WipHistoryFilters): string {
  if (
    (filters.from && !isValidWipDate(filters.from)) ||
    (filters.to && !isValidWipDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  return filters.from && filters.to && filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}

export function filterWipSheets(
  records: readonly WipReceivingIssuingSheet[],
  filters: WipHistoryFilters,
): WipReceivingIssuingSheet[] {
  if (wipFilterError(filters)) {
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

    const searchableValues = [
      sheet.id,
      sheet.document_date,
      sheet.prepared_by,
      sheet.checked_by,
      ...sheet.rows.flatMap((row) => [
        getWipItemDisplayName(row.item_id),
        row.remark,
      ]),
    ];

    return searchableValues.some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    );
  });
}

export function paginateWipSheets<T>(
  records: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(records.length / safePageSize));
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
    items: records.slice(
      (page - 1) * safePageSize,
      page * safePageSize,
    ),
  };
}
