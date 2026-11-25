
/**
 *
 * โครงสร้างข้อมูลสำหรับแบบบันทึกการรับ - จ่าย วัตถุดิบเม็ดฟู่
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

/* ---------------- material master data ---------------- */

export const effervescentMaterialDefinitions:
  readonly EffervescentMaterialDefinition[] = [
    { no: 1, code: "WIP-PDAM-01", material_name: "ผงอะมิโน", unit: "กก." },
    { no: 2, code: "RM-1501", material_name: "21-0-0", unit: "กก." },
    { no: 3, code: "RM-4001", material_name: "มอนโตแดรกซ์ตริน", unit: "กก." },
    { no: 4, code: "RM-4003", material_name: "กรดซิตริก(กรดมะนาว)", unit: "กก." },
    { no: 5, code: "RM-4004", material_name: "โซเดียมไบคาร์บอเนต", unit: "กก." },
    { no: 6, code: "RM-4005", material_name: "แป้งข้าวโพด", unit: "กก." },
    { no: 7, code: "RM-4006", material_name: "แคป-โอ-ซิล", unit: "กก." },
    { no: 8, code: "RM-4101", material_name: "สีน้ำเงิน", unit: "กก." },
    { no: 9, code: "RM-4102", material_name: "สีม่วง", unit: "กก." },
    { no: 10, code: "RM-4103", material_name: "สีเขียว", unit: "กก." },
    { no: 11, code: "RM-4104", material_name: "สีเหลือง", unit: "กก." },
    { no: 12, code: "RM-4105", material_name: "สีส้ม", unit: "กก." },
    { no: 13, code: "RM-4106", material_name: "สีน้ำตาล", unit: "กก." },
    { no: 14, code: "RM-4107", material_name: "สีแดง", unit: "กก." },
  ];

/* ---------------- create material rows ---------------- */

export function createEffervescentMaterialLedgerRows(
  documentKey: string,
): EffervescentMaterialLedgerRow[] {
  return effervescentMaterialDefinitions.map((material) =>
    blankEffervescentMaterialRow(
      `${documentKey}-row-${String(material.no).padStart(2, "0")}`,
      material,
    ),
  );
}

/* ---------------- create blank document ---------------- */

export function createBlankEffervescentMaterialLedgerSheet(
  documentKey: string,
): EffervescentMaterialLedgerSheet {
  return blankEffervescentMaterialSheet(
    createEffervescentMaterialLedgerRows(documentKey),
  );
}
