
/**
 * UI MOCK ONLY.
 * ไม่เรียก API, ไม่บันทึกฐานข้อมูล
 * หนึ่งแบบบันทึกสามารถมีตัวอย่างได้หลายแถว
 */

export type LabSampleField =
  | "sent_date"
  | "sent_time"
  | "sample_name"
  | "lot_no"
  | "lot_date"
  | "sample_characteristics"
  | "analysis_request"
  | "sender_name"
  | "received_by"
  | "received_date"
  | "sample_code"
  | "request_no"
  | "remark";

export const LAB_SAMPLE_FIELDS = [
  "sent_date",
  "sent_time",
  "sample_name",
  "lot_no",
  "lot_date",
  "sample_characteristics",
  "analysis_request",
  "sender_name",
  "received_by",
  "received_date",
  "sample_code",
  "request_no",
  "remark",
] as const satisfies readonly LabSampleField[];

export const LAB_SAMPLE_FIELD_LABELS: Record<
  LabSampleField,
  string
> = {
  sent_date: "วันที่ส่งตัวอย่าง",
  sent_time: "เวลาส่งตัวอย่าง",
  sample_name: "ชื่อตัวอย่าง",
  lot_no: "Lot.",
  lot_date: "วันที่ Lot.",
  sample_characteristics: "ลักษณะตัวอย่าง",
  analysis_request: "รายการวิเคราะห์",
  sender_name: "ผู้ส่งตัวอย่าง",
  received_by: "ผู้รับตัวอย่าง",
  received_date: "วันที่รับตัวอย่าง",
  sample_code: "รหัสตัวอย่าง",
  request_no: "เลขที่คำขอ",
  remark: "หมายเหตุ",
};

export interface LabSampleReceivingRow
  extends Record<LabSampleField, string> {
  id: string;
}

export interface LabSampleReceivingSheet {
  id: string;
  rows: LabSampleReceivingRow[];
  created_at: string;
  updated_at: string;
}

export type LabSampleErrors = Record<string, string>;

export interface LabSampleHistoryFilters {
  search: string;
  from: string;
  to: string;
}

/* ---------------- constants ---------------- */

export const LAB_PAPER_ROWS_PER_PAGE = 24;

export const emptyLabFilters: LabSampleHistoryFilters = {
  search: "",
  from: "",
  to: "",
};

/* ---------------- empty data ---------------- */

export function blankLabSampleRow(
  id: string,
): LabSampleReceivingRow {
  return {
    id,
    sent_date: "",
    sent_time: "",
    sample_name: "",
    lot_no: "",
    lot_date: "",
    sample_characteristics: "",
    analysis_request: "",
    sender_name: "",
    received_by: "",
    received_date: "",
    sample_code: "",
    request_no: "",
    remark: "",
  };
}

export function blankLabSheet(
  rowId: string,
): LabSampleReceivingSheet {
  return {
    id: "",
    rows: [blankLabSampleRow(rowId)],
    created_at: "",
    updated_at: "",
  };
}

/* ---------------- dates ---------------- */

export function isValidLabDate(
  value: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function isValidLabTime(
  value: string,
): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatLabDate(
  value: string,
): string {
  if (!isValidLabDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function labSavedDateKey(
  value: string,
): string {
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

export function formatLabDateTime(
  value: string,
): string {
  return formatLabDate(labSavedDateKey(value)) || "-";
}

/* ---------------- lot formatting ---------------- */

export function formatLabLotDate(
  row: Pick<
    LabSampleReceivingRow,
    "lot_no" | "lot_date"
  >,
): string {
  const lot = row.lot_no.trim();
  const date = formatLabDate(row.lot_date);

  if (lot && date) {
    return `${lot} / ${date}`;
  }

  return lot || date;
}

/* ---------------- validation ---------------- */

export function validateLabSheet(
  sheet: LabSampleReceivingSheet,
): LabSampleErrors {
  const errors: LabSampleErrors = {};

  if (sheet.rows.length === 0) {
    errors.rows =
      "กรุณาเพิ่มรายการตัวอย่างอย่างน้อย 1 แถว";
  }

  const seenIds = new Set<string>();

  sheet.rows.forEach((row, index) => {
    if (!row.id || seenIds.has(row.id)) {
      errors[`rows.${index}.id`] =
        "รายการตัวอย่างมีรหัสภายในซ้ำหรือไม่ถูกต้อง";
    }

    seenIds.add(row.id);

    if (!row.sample_name.trim()) {
      errors[`rows.${index}.sample_name`] =
        "กรุณากรอกชื่อตัวอย่าง";
    }

    if (!row.lot_no.trim()) {
      errors[`rows.${index}.lot_no`] =
        "กรุณากรอก Lot.";
    }

    for (const key of [
      "sent_date",
      "lot_date",
      "received_date",
    ] as const) {
      if (row[key] && !isValidLabDate(row[key])) {
        errors[`rows.${index}.${key}`] =
          "วันที่ไม่ถูกต้อง";
      }
    }

    if (
      row.sent_time &&
      !isValidLabTime(row.sent_time)
    ) {
      errors[`rows.${index}.sent_time`] =
        "เวลาต้องอยู่ในรูปแบบ HH:mm";
    }
  });

  return errors;
}

/* ---------------- save ---------------- */

export function saveLabSheet(
  sheets: readonly LabSampleReceivingSheet[],
  draft: LabSampleReceivingSheet,
  newId: string,
  savedAt: string,
): {
  saved: LabSampleReceivingSheet;
  records: LabSampleReceivingSheet[];
} {
  if (
    Object.keys(validateLabSheet(draft)).length > 0
  ) {
    throw new Error(
      "กรุณาแก้ไขข้อมูลที่แจ้งก่อนบันทึก",
    );
  }

  if (!Number.isFinite(Date.parse(savedAt))) {
    throw new Error("วันที่บันทึกไม่ถูกต้อง");
  }

  const oldSheet = draft.id
    ? sheets.find((sheet) => sheet.id === draft.id)
    : undefined;

  if (draft.id && !oldSheet) {
    throw new Error(
      "ไม่พบเอกสารที่ต้องการแก้ไข",
    );
  }

  if (
    !draft.id &&
    (!newId || sheets.some((sheet) => sheet.id === newId))
  ) {
    throw new Error(
      "รหัสชุดแบบบันทึกซ้ำ กรุณาลองใหม่",
    );
  }

  const saved = structuredClone({
    ...draft,
    id: draft.id || newId,
    created_at: oldSheet?.created_at || savedAt,
    updated_at: savedAt,

    rows: draft.rows.map((row) => {
      const normalized: LabSampleReceivingRow = {
        ...row,
      };

      for (const field of LAB_SAMPLE_FIELDS) {
        normalized[field] = normalized[field].trim();
      }

      return normalized;
    }),
  });

  const records = oldSheet
    ? sheets.map((sheet) =>
        sheet.id === draft.id ? saved : sheet,
      )
    : [saved, ...sheets];

  return { saved, records };
}

/* ---------------- delete ---------------- */

export function deleteLabSheet(
  sheets: readonly LabSampleReceivingSheet[],
  id: string,
): LabSampleReceivingSheet[] {
  return sheets.filter((sheet) => sheet.id !== id);
}

/* ---------------- history filters ---------------- */

export function labFilterError(
  filters: LabSampleHistoryFilters,
): string {
  if (
    (filters.from && !isValidLabDate(filters.from)) ||
    (filters.to && !isValidLabDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  return filters.from &&
    filters.to &&
    filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}

export function filterLabSheets(
  sheets: readonly LabSampleReceivingSheet[],
  filters: LabSampleHistoryFilters,
): LabSampleReceivingSheet[] {
  if (labFilterError(filters)) {
    return [];
  }

  const keyword = filters.search
    .trim()
    .toLocaleLowerCase();

  return sheets.filter((sheet) => {
    const createdDate = labSavedDateKey(
      sheet.created_at,
    );

    if (
      filters.from &&
      createdDate < filters.from
    ) {
      return false;
    }

    if (
      filters.to &&
      createdDate > filters.to
    ) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [
      sheet.id,
      ...sheet.rows.flatMap((row) =>
        LAB_SAMPLE_FIELDS.map((key) => row[key]),
      ),
    ].some((value) =>
      value.toLocaleLowerCase().includes(keyword),
    );
  });
}

/* ---------------- pagination ---------------- */

export function paginateLabSheets<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? pageSize
      : 10;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / safePageSize),
  );

  const page = Math.max(
    1,
    Math.min(
      Number.isFinite(requestedPage)
        ? Math.trunc(requestedPage)
        : 1,
      totalPages,
    ),
  );

  return {
    page,
    totalPages,
    items: items.slice(
      (page - 1) * safePageSize,
      page * safePageSize,
    ),
  };
}

/* ---------------- paper pagination ---------------- */

export function splitLabPaperRows(
  rows: readonly LabSampleReceivingRow[],
  count = LAB_PAPER_ROWS_PER_PAGE,
): LabSampleReceivingRow[][] {
  const size = Math.max(
    1,
    Math.trunc(count) || LAB_PAPER_ROWS_PER_PAGE,
  );

  const pages: LabSampleReceivingRow[][] = [];

  for (let i = 0; i < rows.length; i += size) {
    pages.push([
      ...rows.slice(i, i + size),
    ]);
  }

  return pages.length ? pages : [[]];
}
