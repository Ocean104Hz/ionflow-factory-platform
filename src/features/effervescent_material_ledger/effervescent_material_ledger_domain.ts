
/**
 * UI MOCK ONLY
 *
 * โครงสร้างข้อมูลสำหรับแบบบันทึกการรับ - จ่าย วัตถุดิบเม็ดฟู่
 * ไม่มีการเรียก API หรือเชื่อมต่อฐานข้อมูล
 *
 * ยอดคงเหลือและปรับค่าเป็นข้อมูลอิสระ
 * ยังไม่กำหนดสูตรคำนวณหรือกติกาการเพิ่ม/ลดสต็อก
 */

/* ---------------- document metadata ---------------- */

export const EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT = {
  company_name: "บริษัท ไอออนิค จำกัด  (โรงงานกาญจนบุรี 2)",
  title: "บันทึกการ รับ - จ่าย วัตถุดิบเม็ดฟู่",
  form_code: "FR-P2-36/Rev.00",
  paper_row_count: 21,
} as const;

/* ---------------- material quantities ---------------- */

export const EFFERVESCENT_MATERIAL_QUANTITY_FIELDS = [
  "opening_balance",
  "received",
  "production_use",
  "adjustment",
  "discarded",
  "closing_balance",
] as const;

export type EffervescentMaterialQuantityField =
  (typeof EFFERVESCENT_MATERIAL_QUANTITY_FIELDS)[number];

/**
 * ข้อมูลวัตถุดิบตั้งต้น ใช้สร้างแถวใหม่ในแบบบันทึก
 */
export interface EffervescentMaterialDefinition {
  no: number;
  code: string;
  material_name: string;
  unit: string;
}

/**
 * เก็บปริมาณเป็น string เพื่อรองรับช่องว่างขณะกรอก
 * ยังไม่แปลงค่าและไม่คำนวณยอดคงเหลือ
 */
export interface EffervescentMaterialLedgerRow
  extends EffervescentMaterialDefinition,
    Record<EffervescentMaterialQuantityField, string> {
  id: string;
  remark: string;
}

export const EFFERVESCENT_MATERIAL_FIELD_LABELS: Record<
  Exclude<keyof EffervescentMaterialLedgerRow, "id">,
  string
> = {
  no: "No.",
  code: "CODE",
  material_name: "รายชื่อวัตถุดิบ",
  unit: "หน่วย",
  opening_balance: "ยอดยกมา",
  received: "รับเข้า (+)",
  production_use: "ใช้ผลิต",
  adjustment: "ปรับค่า",
  discarded: "ทิ้ง ( เสีย )",
  closing_balance: "ยอดคงเหลือ",
  remark: "หมายเหตุ",
};

/* ---------------- document and history ---------------- */

export interface EffervescentMaterialLedgerSheet {
  id: string;
  record_date: string;
  production_list: string;
  prepared_by: string;
  checked_by: string;
  rows: EffervescentMaterialLedgerRow[];
  created_at: string;
  updated_at: string;
}

export interface EffervescentMaterialLedgerHistoryFilters {
  search: string;
  from: string;
  to: string;
}

export const emptyEffervescentMaterialHistoryFilters:
  EffervescentMaterialLedgerHistoryFilters = {
    search: "",
    from: "",
    to: "",
  };

/* ---------------- blank data ---------------- */

export function blankEffervescentMaterialRow(
  id: string,
  material: EffervescentMaterialDefinition,
): EffervescentMaterialLedgerRow {
  return {
    id,
    no: material.no,
    code: material.code,
    material_name: material.material_name,
    unit: material.unit,
    opening_balance: "",
    received: "",
    production_use: "",
    adjustment: "",
    discarded: "",
    closing_balance: "",
    remark: "",
  };
}

export function blankEffervescentMaterialSheet(
  rows: readonly EffervescentMaterialLedgerRow[] = [],
): EffervescentMaterialLedgerSheet {
  return {
    id: "",
    record_date: "",
    production_list: "",
    prepared_by: "",
    checked_by: "",
    rows: rows.map((row) => ({ ...row })),
    created_at: "",
    updated_at: "",
  };
}
