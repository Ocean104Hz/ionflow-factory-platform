/**
 * UI MOCK domain for the organic-unit extraction-material / production-temperature log.
 *
 * Confirmed paper layout:
 * - One date with two independently recorded production rounds (left/right).
 * - Twenty-four printed material slots are shared as labels across the two rounds.
 * - Each round records B1-B6 material use, four temperature checkpoints, and pH.
 *
 * The photograph does not establish required process values, material master names,
 * or a one-document-per-day rule. Do not invent those business constraints here.
 */

export const ORGANIC_EXTRACTION_FORM_TITLE =
  "ใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต";

export const ORGANIC_EXTRACTION_MATERIAL_COUNT = 24;
export const ORGANIC_EXTRACTION_ROUND_COUNT = 2;

export const ORGANIC_EXTRACTION_MACHINES = [
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
] as const;

export type OrganicExtractionMachine =
  (typeof ORGANIC_EXTRACTION_MACHINES)[number];

export const ORGANIC_EXTRACTION_TEMPERATURE_MINUTES = [
  90,
  120,
  150,
  180,
] as const;

export type OrganicExtractionTemperatureMinute =
  (typeof ORGANIC_EXTRACTION_TEMPERATURE_MINUTES)[number];

export type OrganicExtractionRoundNumber = 1 | 2;

/**
 * Printed CODE column, transcribed from the supplied form.
 * Names stay editable and empty until the factory confirms the master list.
 */
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
  "RM-3001",
] as const;

/** Values are strings so the UI does not lose the user's entered precision. */
export type OrganicExtractionMachineValues = Record<
  OrganicExtractionMachine,
  string
>;

export interface OrganicExtractionMaterial {
  row_number: number;
  material_code: string;
  material_name: string;
  unit: string;
}

export interface OrganicExtractionUsageRow {
  row_number: number;
  quantities: OrganicExtractionMachineValues;
  remark: string;
}

export interface OrganicExtractionTemperatureRow {
  minute: OrganicExtractionTemperatureMinute;
  temperatures: OrganicExtractionMachineValues;
  remark: string;
}

/** A round owns its own values, even when both rounds use the same material. */
export interface OrganicExtractionProductionRound {
  round_number: OrganicExtractionRoundNumber;
  production_name: string;
  start_time: string;
  end_time: string;
  usage_rows: OrganicExtractionUsageRow[];
  temperature_rows: OrganicExtractionTemperatureRow[];
  ph_values: OrganicExtractionMachineValues;
  ph_remark: string;
}

export interface OrganicExtractionTemperatureSheet {
  id: string;
  document_date: string;
  prepared_by: string;
  inspected_by: string;
  materials: OrganicExtractionMaterial[];
  rounds: OrganicExtractionProductionRound[];
  created_at: string;
  updated_at: string;
}

export type OrganicExtractionErrors = Record<string, string>;

export interface OrganicExtractionHistoryFilters {
  search: string;
  from: string;
  to: string;
}

export const emptyOrganicExtractionHistoryFilters: OrganicExtractionHistoryFilters = {
  search: "",
  from: "",
  to: "",
};

export function blankOrganicExtractionMachineValues(): OrganicExtractionMachineValues {
  return {
    B1: "",
    B2: "",
    B3: "",
    B4: "",
    B5: "",
    B6: "",
  };
}

function trimOrganicExtractionMachineValues(
  values: OrganicExtractionMachineValues,
): OrganicExtractionMachineValues {
  return {
    B1: values.B1.trim(),
    B2: values.B2.trim(),
    B3: values.B3.trim(),
    B4: values.B4.trim(),
    B5: values.B5.trim(),
    B6: values.B6.trim(),
  };
}

export function blankOrganicExtractionMaterials(): OrganicExtractionMaterial[] {
  return ORGANIC_EXTRACTION_MATERIAL_CODES.map((materialCode, index) => ({
    row_number: index + 1,
    material_code: materialCode,
    material_name: "",
    unit: "Kg",
  }));
}

export function blankOrganicExtractionRound(
  roundNumber: OrganicExtractionRoundNumber,
): OrganicExtractionProductionRound {
  return {
    round_number: roundNumber,
    production_name: "",
    start_time: "",
    end_time: "",
    usage_rows: Array.from(
      { length: ORGANIC_EXTRACTION_MATERIAL_COUNT },
      (_, index) => ({
        row_number: index + 1,
        quantities: blankOrganicExtractionMachineValues(),
        remark: "",
      }),
    ),
    temperature_rows: ORGANIC_EXTRACTION_TEMPERATURE_MINUTES.map((minute) => ({
      minute,
      temperatures: blankOrganicExtractionMachineValues(),
      remark: "",
    })),
    ph_values: blankOrganicExtractionMachineValues(),
    ph_remark: "",
  };
}

export function blankOrganicExtractionSheet(): OrganicExtractionTemperatureSheet {
  return {
    id: "",
    document_date: "",
    prepared_by: "",
    inspected_by: "",
    materials: blankOrganicExtractionMaterials(),
    rounds: [blankOrganicExtractionRound(1), blankOrganicExtractionRound(2)],
    created_at: "",
    updated_at: "",
  };
}

export function isValidOrganicExtractionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function formatOrganicExtractionDate(value: string): string {
  if (!isValidOrganicExtractionDate(value)) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${Number(year) + 543}`;
}

export function organicExtractionSavedDateKey(value: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date(value));

  const field = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function formatOrganicExtractionDateTime(value: string): string {
  return formatOrganicExtractionDate(organicExtractionSavedDateKey(value)) || "-";
}

const OPTIONAL_DECIMAL_PATTERN =
  /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

/** Blank cells are permitted until required-field rules are approved. */
export function isValidOptionalOrganicExtractionNumber(
  value: string,
  allowNegative: boolean,
): boolean {
  const text = value.trim();
  if (!text) {
    return true;
  }

  if (!OPTIONAL_DECIMAL_PATTERN.test(text)) {
    return false;
  }

  const numberValue = Number(text.replaceAll(",", ""));
  return (
    Number.isFinite(numberValue) &&
    (allowNegative || numberValue >= 0)
  );
}

export function hasOrganicExtractionRoundData(
  round: OrganicExtractionProductionRound,
): boolean {
  return (
    round.production_name.trim() !== "" ||
    round.start_time.trim() !== "" ||
    round.end_time.trim() !== "" ||
    round.usage_rows.some(
      (row) =>
        row.remark.trim() !== "" ||
        ORGANIC_EXTRACTION_MACHINES.some((machine) =>
          Boolean(row.quantities[machine].trim()),
        ),
    ) ||
    round.temperature_rows.some(
      (row) =>
        row.remark.trim() !== "" ||
        ORGANIC_EXTRACTION_MACHINES.some((machine) =>
          Boolean(row.temperatures[machine].trim()),
        ),
    ) ||
    round.ph_remark.trim() !== "" ||
    ORGANIC_EXTRACTION_MACHINES.some((machine) =>
      Boolean(round.ph_values[machine].trim()),
    )
  );
}

/**
 * Structural and numeric checks only. There is deliberately no invented
 * minimum/maximum temperature, pH limit, or mandatory number of active tanks.
 */
export function validateOrganicExtractionSheet(
  sheet: OrganicExtractionTemperatureSheet,
): OrganicExtractionErrors {
  const errors: OrganicExtractionErrors = {};

  if (!isValidOrganicExtractionDate(sheet.document_date)) {
    errors.document_date = "กรุณาระบุวันที่เอกสารให้ถูกต้อง";
  }

  if (sheet.materials.length !== ORGANIC_EXTRACTION_MATERIAL_COUNT) {
    errors.materials = "รายการวัตถุดิบต้องมี 24 แถวตามเอกสารต้นฉบับ";
  }

  sheet.materials.forEach((material, index) => {
    if (material.row_number !== index + 1) {
      errors[`materials.${index}.row_number`] = "ลำดับวัตถุดิบไม่ถูกต้อง";
    }
    if (!material.material_code.trim()) {
      errors[`materials.${index}.material_code`] = "กรุณาระบุรหัสวัตถุดิบ";
    }
  });

  if (sheet.rounds.length !== ORGANIC_EXTRACTION_ROUND_COUNT) {
    errors.rounds = "ต้องมีช่องข้อมูลการผลิต 2 รอบตามแบบฟอร์ม";
  }

  sheet.rounds.forEach((round, roundIndex) => {
    if (round.round_number !== roundIndex + 1) {
      errors[`rounds.${roundIndex}.round_number`] =
        "ลำดับรอบการผลิตไม่ถูกต้อง";
    }

    if (round.usage_rows.length !== ORGANIC_EXTRACTION_MATERIAL_COUNT) {
      errors[`rounds.${roundIndex}.usage_rows`] =
        "ช่องใช้วัตถุดิบต้องมี 24 แถว";
    }

    round.usage_rows.forEach((row, rowIndex) => {
      if (row.row_number !== rowIndex + 1) {
        errors[`rounds.${roundIndex}.usage_rows.${rowIndex}.row_number`] =
          "ลำดับรายการวัตถุดิบไม่ถูกต้อง";
      }

      ORGANIC_EXTRACTION_MACHINES.forEach((machine) => {
        if (!isValidOptionalOrganicExtractionNumber(row.quantities[machine], false)) {
          errors[`rounds.${roundIndex}.usage_rows.${rowIndex}.quantities.${machine}`] =
            "ปริมาณวัตถุดิบต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป";
        }
      });
    });

    if (
      round.temperature_rows.length !==
      ORGANIC_EXTRACTION_TEMPERATURE_MINUTES.length
    ) {
      errors[`rounds.${roundIndex}.temperature_rows`] =
        "อุณหภูมิต้องมีช่วง 90, 120, 150 และ 180 นาที";
    }

    round.temperature_rows.forEach((row, rowIndex) => {
      if (row.minute !== ORGANIC_EXTRACTION_TEMPERATURE_MINUTES[rowIndex]) {
        errors[`rounds.${roundIndex}.temperature_rows.${rowIndex}.minute`] =
          "ช่วงเวลาวัดอุณหภูมิไม่ตรงกับแบบฟอร์ม";
      }

      ORGANIC_EXTRACTION_MACHINES.forEach((machine) => {
        if (!isValidOptionalOrganicExtractionNumber(row.temperatures[machine], true)) {
          errors[`rounds.${roundIndex}.temperature_rows.${rowIndex}.temperatures.${machine}`] =
            "อุณหภูมิต้องเป็นตัวเลข";
        }
      });
    });

    ORGANIC_EXTRACTION_MACHINES.forEach((machine) => {
      if (!isValidOptionalOrganicExtractionNumber(round.ph_values[machine], true)) {
        errors[`rounds.${roundIndex}.ph_values.${machine}`] =
          "ค่า pH ต้องเป็นตัวเลข";
      }
    });
  });

  return errors;
}

function normalizeOrganicExtractionSheet(
  draft: OrganicExtractionTemperatureSheet,
): OrganicExtractionTemperatureSheet {
  return {
    ...draft,
    document_date: draft.document_date.trim(),
    prepared_by: draft.prepared_by.trim(),
    inspected_by: draft.inspected_by.trim(),
    materials: draft.materials.map((material) => ({
      ...material,
      material_code: material.material_code.trim(),
      material_name: material.material_name.trim(),
      unit: material.unit.trim(),
    })),
    rounds: draft.rounds.map((round) => ({
      ...round,
      production_name: round.production_name.trim(),
      start_time: round.start_time.trim(),
      end_time: round.end_time.trim(),
      usage_rows: round.usage_rows.map((row) => ({
        ...row,
        quantities: trimOrganicExtractionMachineValues(row.quantities),
        remark: row.remark.trim(),
      })),
      temperature_rows: round.temperature_rows.map((row) => ({
        ...row,
        temperatures: trimOrganicExtractionMachineValues(row.temperatures),
        remark: row.remark.trim(),
      })),
      ph_values: trimOrganicExtractionMachineValues(round.ph_values),
      ph_remark: round.ph_remark.trim(),
    })),
  };
}

/** In-memory only. No date uniqueness restriction was confirmed. */
export function saveOrganicExtractionSheet(
  records: readonly OrganicExtractionTemperatureSheet[],
  draft: OrganicExtractionTemperatureSheet,
  newId: string,
  savedAt: string,
): {
  saved: OrganicExtractionTemperatureSheet;
  records: OrganicExtractionTemperatureSheet[];
} {
  if (Object.keys(validateOrganicExtractionSheet(draft)).length > 0) {
    throw new Error("กรุณาตรวจสอบข้อมูลก่อนบันทึก");
  }

  if (!savedAt || !Number.isFinite(Date.parse(savedAt))) {
    throw new Error("วันที่บันทึกไม่ถูกต้อง");
  }

  const previous = draft.id
    ? records.find((item) => item.id === draft.id)
    : undefined;

  if (draft.id && !previous) {
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  }

  if (!draft.id && (!newId || records.some((item) => item.id === newId))) {
    throw new Error("รหัสเอกสารซ้ำ กรุณาลองใหม่");
  }

  const saved = structuredClone({
    ...normalizeOrganicExtractionSheet(draft),
    id: draft.id || newId,
    created_at: previous?.created_at || savedAt,
    updated_at: savedAt,
  });

  const nextRecords = previous
    ? records.map((item) => (item.id === draft.id ? saved : item))
    : [saved, ...records];

  return { saved, records: nextRecords };
}

export function deleteOrganicExtractionSheet(
  records: readonly OrganicExtractionTemperatureSheet[],
  id: string,
): OrganicExtractionTemperatureSheet[] {
  return records.filter((item) => item.id !== id);
}

export function organicExtractionFilterError(
  filters: OrganicExtractionHistoryFilters,
): string {
  if (
    (filters.from && !isValidOrganicExtractionDate(filters.from)) ||
    (filters.to && !isValidOrganicExtractionDate(filters.to))
  ) {
    return "ช่วงวันที่ไม่ถูกต้อง";
  }

  if (filters.from && filters.to && filters.from > filters.to) {
    return "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด";
  }

  return "";
}

export function filterOrganicExtractionSheets(
  records: readonly OrganicExtractionTemperatureSheet[],
  filters: OrganicExtractionHistoryFilters,
): OrganicExtractionTemperatureSheet[] {
  if (organicExtractionFilterError(filters)) {
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

    const text = [
      sheet.id,
      sheet.document_date,
      sheet.prepared_by,
      sheet.inspected_by,
      ...sheet.materials.flatMap((material) => [
        material.material_code,
        material.material_name,
      ]),
      ...sheet.rounds.flatMap((round) => [
        round.production_name,
        round.start_time,
        round.end_time,
        ...round.usage_rows.map((row) => row.remark),
        ...round.temperature_rows.map((row) => row.remark),
        round.ph_remark,
      ]),
    ];

    return text.some((value) => value.toLocaleLowerCase().includes(keyword));
  });
}

export function paginateOrganicExtractionSheets<T>(
  records: readonly T[],
  requestedPage: number,
  pageSize: number,
): { page: number; totalPages: number; items: T[] } {
  const safeSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(records.length / safeSize));
  const page = Number.isInteger(requestedPage)
    ? Math.min(totalPages, Math.max(1, requestedPage))
    : 1;

  return {
    page,
    totalPages,
    items: records.slice((page - 1) * safeSize, page * safeSize),
  };
}
