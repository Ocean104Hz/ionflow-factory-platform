
/**
 * QC Product Weight Check
 * UI MOCK ONLY
 *
 * หนึ่งเอกสารมีหลายรอบตรวจ
 * หนึ่งรอบตรวจมี 4 กลุ่ม กลุ่มละ 4 ค่าน้ำหนัก
 */

/* ---------------- constants ---------------- */

export const QC_WEIGHT_GROUP_KEYS = [
  "group_1",
  "group_2",
  "group_3",
  "group_4",
] as const;

export const QC_WEIGHT_READING_INDEXES = [
  0,
  1,
  2,
  3,
] as const;

export const QC_WEIGHT_RESULT_OPTIONS = [
  { value: "PASS", label: "ผ่าน" },
  { value: "FAIL", label: "ไม่ผ่าน" },
] as const;

/* ---------------- types ---------------- */

export type QcWeightGroupKey =
  (typeof QC_WEIGHT_GROUP_KEYS)[number];

export const QC_WEIGHT_TIMED_GROUP_KEYS = ["group_2", "group_3", "group_4"] as const;

export type QcWeightTimedGroupKey = (typeof QC_WEIGHT_TIMED_GROUP_KEYS)[number];
export type QcWeightTimeRange = { start: string; end: string };
export type QcWeightGroupTimes = Record<QcWeightTimedGroupKey, QcWeightTimeRange>;

export type QcWeightReadingIndex =
  (typeof QC_WEIGHT_READING_INDEXES)[number];

export type QcWeightResult =
  | ""
  | "PASS"
  | "FAIL";

export type QcWeightReadings = [
  string,
  string,
  string,
  string,
];

export type QcWeightMeasurements = Record<
  QcWeightGroupKey,
  QcWeightReadings
>;

export interface QcProductWeightCheckRow {
  id: string;
  time: string;
  measurements: QcWeightMeasurements;
  average: string;
  result: QcWeightResult;
}


export interface QcProductWeightCheckRow {
  id: string;
  time_group_id?: string;
  time: string;
  measurements: QcWeightMeasurements;
  average: string;
  result: QcWeightResult;
}

export interface QcProductWeightCheckDocument {
  id: string;

  // ข้อมูลเอกสาร
  doc_no: string;
  doc_date: string;

  // ข้อมูลผลิตภัณฑ์
  product_name: string;
  lot_no: string;
  pack_size: string;
  pack_count: string;
  weight_spec: string;

  // ตารางตรวจสอบ
  group_times: QcWeightGroupTimes;
  rows: QcProductWeightCheckRow[];

  // ส่วนท้ายเอกสาร
  remark: string;
  prepared_by: string;
  prepared_date: string;
  checked_by: string;
  checked_date: string;

  // ข้อมูลระบบ MOCK
  created_at: string;
  updated_at: string;
}

export type QcWeightErrors = Record<
  string,
  string
>;

export interface QcWeightHistoryFilters {
  search: string;
  from: string;
  to: string;
}

/* ---------------- header fields ---------------- */

export const QC_WEIGHT_HEADER_FIELDS = [
  "doc_no",
  "doc_date",
  "product_name",
  "lot_no",
  "pack_size",
  "pack_count",
  "weight_spec",
  "remark",
  "prepared_by",
  "prepared_date",
  "checked_by",
  "checked_date",
] as const;

export type QcWeightHeaderField =
  (typeof QC_WEIGHT_HEADER_FIELDS)[number];

export const QC_WEIGHT_HEADER_LABELS: Record<
  QcWeightHeaderField,
  string
> = {
  doc_no: "เลขที่เอกสาร",
  doc_date: "วันที่",
  product_name: "ผลิตภัณฑ์",
  lot_no: "หมายเลขล็อต",
  pack_size: "ขนาดบรรจุ",
  pack_count: "จำนวนบรรจุ",
  weight_spec: "เกณฑ์น้ำหนัก",
  remark: "หมายเหตุ",
  prepared_by: "ผู้จัดทำ",
  prepared_date: "วันที่",
  checked_by: "ผู้ตรวจสอบ",
  checked_date: "วันที่",
};

/* ---------------- defaults ---------------- */

export const emptyQcWeightFilters:
  QcWeightHistoryFilters = {
  search: "",
  from: "",
  to: "",
};

function blankReadings(): QcWeightReadings {
  return ["", "", "", ""];
}

export function blankQcWeightRow(
  id: string,
): QcProductWeightCheckRow {
  return {
    id,
    time: "",
    measurements: {
      group_1: blankReadings(),
      group_2: blankReadings(),
      group_3: blankReadings(),
      group_4: blankReadings(),
    },
    average: "",
    result: "",
  };
}

export function blankQcWeightGroupTimes(): QcWeightGroupTimes {
  return {
    group_2: { start: "", end: "" },
    group_3: { start: "", end: "" },
    group_4: { start: "", end: "" },
  };
}

// Older JSONB documents/clients lack the field. Only default an absent field;
// explicitly supplied malformed values must still be rejected by the API parser.
export function withQcWeightGroupTimes<T extends object>(
  document: T,
  previous?: object,
): T & { group_times: unknown } {
  const group_times = "group_times" in document
    ? document.group_times
    : previous && "group_times" in previous
      ? previous.group_times
      : blankQcWeightGroupTimes();
  return { ...document, group_times };
}

export function updateQcWeightGroupTime(
  document: QcProductWeightCheckDocument,
  group: QcWeightTimedGroupKey,
  part: keyof QcWeightTimeRange,
  value: string,
): QcProductWeightCheckDocument {
  return {
    ...document,
    group_times: {
      ...document.group_times,
      [group]: { ...document.group_times[group], [part]: value },
    },
  };
}

export function formatQcWeightGroupHeading(
  document: Pick<QcProductWeightCheckDocument, "group_times">,
  group: QcWeightGroupKey,
): string {
  if (group === "group_1") return "ตั้งค่าเครื่อง";
  const range = document.group_times?.[group];
  if (!range?.start && !range?.end) return "-";
  return `${range.start || "--:--"} - ${range.end || "--:--"}`;
}

export function blankQcWeightDocument(
  rowId: string,
): QcProductWeightCheckDocument {
  return {
    id: "",

    doc_no: "",
    doc_date: "",

    product_name: "",
    lot_no: "",
    pack_size: "",
    pack_count: "",
    weight_spec: "",

    group_times: blankQcWeightGroupTimes(),
    rows: [blankQcWeightRow(rowId)],

    remark: "",
    prepared_by: "",
    prepared_date: "",
    checked_by: "",
    checked_date: "",

    created_at: "",
    updated_at: "",
  };
}

/* ---------------- update readings ---------------- */

export function calculateQcWeightAverage(
  measurements: QcWeightMeasurements,
): string {
  const values = Object.values(measurements)
    .flat()
    .map((value) => value.trim())
    .filter((value) => value !== "");

  if (
    values.length === 0 ||
    values.some((value) => !isValidQcWeightValue(value))
  ) {
    return "";
  }

  const decimals = values.map((value) => {
    const [whole, fraction = ""] = value.split(".");

    return {
      whole: whole || "0",
      fraction,
    };
  });

  const scale = Math.max(
    0,
    ...decimals.map((item) => item.fraction.length),
  );

  const sum = decimals.reduce(
    (total, item) =>
      total +
      BigInt(item.whole + item.fraction.padEnd(scale, "0")),
    BigInt(0),
  );

  const denominator =
    BigInt(values.length) *
    BigInt("1" + "0".repeat(scale));

  const rounded =
    (sum * BigInt(2000) + denominator) /
    (denominator * BigInt(2));

  const digits = rounded.toString().padStart(4, "0");

  return `${digits.slice(0, -3)}.${digits.slice(-3)}`;
}

export function updateQcWeightReading(
  row: QcProductWeightCheckRow,
  group: QcWeightGroupKey,
  index: QcWeightReadingIndex,
  value: string,
): QcProductWeightCheckRow {
  const readings = [
    ...row.measurements[group],
  ] as QcWeightReadings;

  readings[index] = value;

  const measurements: QcWeightMeasurements = {
    ...row.measurements,
    [group]: readings,
  };

  return {
    ...row,
    measurements,
    average: calculateQcWeightAverage(measurements),
  };
}

/* ---------------- date helpers ---------------- */

export function isValidQcWeightDate(
  value: string,
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`,
  );

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function isValidQcWeightTime(
  value: string,
): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
  );
}

export function formatQcWeightDate(
  value: string,
): string {
  if (!isValidQcWeightDate(value)) {
    return "";
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

/* ---------------- weight validation ---------------- */

export function isValidQcWeightValue(
  value: string,
): boolean {
  const normalized = value.trim();

  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(
    normalized,
  );
}

/* ---------------- result display ---------------- */

export function qcWeightResultLabel(
  result: QcWeightResult,
): string {
  if (result === "PASS") {
    return "ผ่าน";
  }

  if (result === "FAIL") {
    return "ไม่ผ่าน";
  }

  return "ยังไม่ระบุ";
}

/* ---------------- validation ---------------- */

export function validateQcWeightDocument(
  document: QcProductWeightCheckDocument,
  existing: readonly QcProductWeightCheckDocument[] = [],
): QcWeightErrors {
  const errors: QcWeightErrors = {};

  /* Document Number */

  if (!document.doc_no.trim()) {
    errors.doc_no =
      "ไม่พบเลขที่เอกสารภายใน";
  }

  /* Product */

  if (!document.product_name.trim()) {
    errors.product_name =
      "กรุณากรอกชื่อผลิตภัณฑ์";
  }

  /* Duplicate Document Number */

  const duplicateDocument = existing.some(
    (item) =>
      item.id !== document.id &&
      item.doc_no.trim().toLowerCase() ===
      document.doc_no.trim().toLowerCase(),
  );

  if (
    document.doc_no.trim() &&
    duplicateDocument
  ) {
    errors.doc_no =
      "เลขที่เอกสารนี้มีอยู่แล้ว";
  }

  /* Dates */

  for (const field of [
    "doc_date",
    "prepared_date",
    "checked_date",
  ] as const) {
    const value = document[field];

    if (
      value &&
      !isValidQcWeightDate(value)
    ) {
      errors[field] = "วันที่ไม่ถูกต้อง";
    }
  }

  /* Group time ranges (optional as a pair, 24-hour format) */
  for (const group of QC_WEIGHT_TIMED_GROUP_KEYS) {
    const range = document.group_times[group];
    if (range.start && !isValidQcWeightTime(range.start)) {
      errors[`group_times.${group}.start`] = "เวลาเริ่มต้นต้องอยู่ในรูปแบบ HH:mm";
    }
    if (range.end && !isValidQcWeightTime(range.end)) {
      errors[`group_times.${group}.end`] = "เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:mm";
    }
    if (range.start && !range.end) {
      errors[`group_times.${group}.end`] = "กรุณาเลือกเวลาสิ้นสุด";
    }
    if (!range.start && range.end) {
      errors[`group_times.${group}.start`] = "กรุณาเลือกเวลาเริ่มต้น";
    }
  }

  /* Rows */

  if (document.rows.length === 0) {
    errors.rows =
      "กรุณาเพิ่มรอบตรวจอย่างน้อย 1 รายการ";
  }

  const rowIds = new Set<string>();

  document.rows.forEach((row, rowIndex) => {
    /* Row ID */

    if (!row.id || rowIds.has(row.id)) {
      errors[`rows.${rowIndex}.id`] =
        "รหัสรอบตรวจไม่ถูกต้องหรือซ้ำกัน";
    }

    rowIds.add(row.id);

    /* Time */

    if (
      row.time &&
      !isValidQcWeightTime(row.time)
    ) {
      errors[`rows.${rowIndex}.time`] =
        "เวลาต้องอยู่ในรูปแบบ HH:mm";
    }

    /* Measurements */

    for (const group of QC_WEIGHT_GROUP_KEYS) {
      for (
        const index of QC_WEIGHT_READING_INDEXES
      ) {
        const value =
          row.measurements[group][index];

        if (
          value.trim() &&
          !isValidQcWeightValue(value)
        ) {
          errors[
            `rows.${rowIndex}.${group}.${index}`
          ] = "กรุณากรอกค่าน้ำหนักเป็นตัวเลข";
        }
      }
    }

    /* Average */

    if (
      row.average.trim() &&
      !isValidQcWeightValue(row.average)
    ) {
      errors[`rows.${rowIndex}.average`] =
        "ค่าเฉลี่ยต้องเป็นตัวเลข";
    }

    /* Result */

    if (
      row.result !== "" &&
      row.result !== "PASS" &&
      row.result !== "FAIL"
    ) {
      errors[`rows.${rowIndex}.result`] =
        "ผลการตรวจสอบไม่ถูกต้อง";
    }
  });

  return errors;
}

/* ---------------- normalize data ---------------- */

function normalizeReadings(
  readings: QcWeightReadings,
): QcWeightReadings {
  return [
    readings[0].trim(),
    readings[1].trim(),
    readings[2].trim(),
    readings[3].trim(),
  ];
}

function normalizeQcWeightRow(
  row: QcProductWeightCheckRow,
): QcProductWeightCheckRow {
  return {
    ...row,
    time: row.time.trim(),
    average: row.average.trim(),
    measurements: {
      group_1: normalizeReadings(
        row.measurements.group_1,
      ),
      group_2: normalizeReadings(
        row.measurements.group_2,
      ),
      group_3: normalizeReadings(
        row.measurements.group_3,
      ),
      group_4: normalizeReadings(
        row.measurements.group_4,
      ),
    },
  };
}

/* ---------------- save MOCK ---------------- */

export function saveQcWeightDocument(
  existing: readonly QcProductWeightCheckDocument[],
  draft: QcProductWeightCheckDocument,
  newId: string,
  savedAt: string,
): {
  saved: QcProductWeightCheckDocument;
  records: QcProductWeightCheckDocument[];
} {
  const previous = draft.id
    ? existing.find(
      (item) => item.id === draft.id,
    )
    : undefined;

  if (draft.id && !previous) {
    throw new Error(
      "ไม่พบเอกสารที่ต้องการแก้ไข",
    );
  }

  const errors = validateQcWeightDocument(
    draft,
    existing,
  );

  if (Object.keys(errors).length > 0) {
    throw new Error(
      "กรุณาตรวจสอบข้อมูลก่อนบันทึก",
    );
  }

  if (
    !Number.isFinite(Date.parse(savedAt))
  ) {
    throw new Error(
      "วันที่บันทึกไม่ถูกต้อง",
    );
  }

  if (
    !draft.id &&
    (!newId ||
      existing.some(
        (item) => item.id === newId,
      ))
  ) {
    throw new Error(
      "รหัสเอกสารภายในซ้ำ",
    );
  }

  const saved: QcProductWeightCheckDocument = {
    ...draft,

    id: draft.id || newId,

    /* Document */

    doc_no: draft.doc_no.trim(),
    doc_date: draft.doc_date,

    /* Product */

    product_name: draft.product_name.trim(),
    lot_no: draft.lot_no.trim(),
    pack_size: draft.pack_size.trim(),
    pack_count: draft.pack_count.trim(),
    weight_spec: draft.weight_spec.trim(),

    /* Footer */

    remark: draft.remark.trim(),
    prepared_by: draft.prepared_by.trim(),
    checked_by: draft.checked_by.trim(),

    /* Rows */

    group_times: {
      group_2: { ...draft.group_times.group_2 },
      group_3: { ...draft.group_times.group_3 },
      group_4: { ...draft.group_times.group_4 },
    },
    rows: draft.rows.map(normalizeQcWeightRow),

    /* System */

    created_at:
      previous?.created_at || savedAt,
    updated_at: savedAt,
  };

  const records = previous
    ? existing.map((item) =>
      item.id === draft.id ? saved : item,
    )
    : [saved, ...existing];

  return {
    saved,
    records,
  };
}

/* ---------------- delete MOCK ---------------- */

export function deleteQcWeightDocument(
  records: readonly QcProductWeightCheckDocument[],
  id: string,
): QcProductWeightCheckDocument[] {
  return records.filter(
    (document) => document.id !== id,
  );
}

/* ---------------- history filters ---------------- */

export function qcWeightFilterError(
  filters: QcWeightHistoryFilters,
): string {
  if (
    (filters.from &&
      !isValidQcWeightDate(filters.from)) ||
    (filters.to &&
      !isValidQcWeightDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  if (
    filters.from &&
    filters.to &&
    filters.from > filters.to
  ) {
    return "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
  }

  return "";
}

export function filterQcWeightDocuments(
  records: readonly QcProductWeightCheckDocument[],
  filters: QcWeightHistoryFilters,
): QcProductWeightCheckDocument[] {
  if (qcWeightFilterError(filters)) {
    return [];
  }

  const keyword = filters.search
    .trim()
    .toLocaleLowerCase();

  return records.filter((document) => {
    /* Date From */

    if (
      filters.from &&
      document.doc_date < filters.from
    ) {
      return false;
    }

    /* Date To */

    if (
      filters.to &&
      document.doc_date > filters.to
    ) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    /* Searchable Values */

    const values = [
      document.doc_no,
      document.product_name,
      document.lot_no,
      document.pack_size,
      document.pack_count,
      document.weight_spec,
      document.prepared_by,
      document.checked_by,

      ...document.rows.flatMap((row) => [
        row.time,
        row.average,
        qcWeightResultLabel(row.result),
        ...QC_WEIGHT_GROUP_KEYS.flatMap(
          (group) => row.measurements[group],
        ),
      ]),
    ];

    return values.some((value) =>
      value.toLocaleLowerCase().includes(
        keyword,
      ),
    );
  });
}

/* ---------------- pagination ---------------- */

export function paginateQcWeightDocuments<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize: number,
) {
  const safeSize =
    Number.isInteger(pageSize) && pageSize > 0
      ? pageSize
      : 10;

  const totalPages = Math.max(
    1,
    Math.ceil(items.length / safeSize),
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
      (page - 1) * safeSize,
      page * safeSize,
    ),
  };
}
