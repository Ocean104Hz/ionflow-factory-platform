import {
  blankOrganicRawMaterialSheet,
  type OrganicRawMaterialReceivingRow,
  type OrganicRawMaterialReceivingSheet,
} from "@/src/features/organic_raw_material_receiving/organic_raw_material_receiving_domain";

/**
 * UI MOCK ONLY.
 * Names, material codes, supplier codes, quantities and inspection results
 * are fictional examples. They do not come from a real receiving document.
 * No API, database or browser storage is used.
 */

type DemoRowData = Omit<OrganicRawMaterialReceivingRow, "row_number">;

const DEMO_MATERIAL_ROWS: readonly DemoRowData[] = [
  {
    material_code: "DEMO-RM-001",
    supplier_code: "DEMO-SUP-001",
    quantity: "125",
    unit: "กก.",
    qc_weight: "/",
    qc_contamination: "/",
    qc_physical: "/",
    qc_color: "/",
    remark: "ข้อมูลสาธิต",
  },
  {
    material_code: "DEMO-RM-002",
    supplier_code: "DEMO-SUP-002",
    quantity: "250.50",
    unit: "กก.",
    qc_weight: "/",
    qc_contamination: "O",
    qc_physical: "/",
    qc_color: "/",
    remark: "ยอมรับได้ (ข้อมูลสาธิต)",
  },
  {
    material_code: "DEMO-RM-003",
    supplier_code: "DEMO-SUP-003",
    quantity: "80",
    unit: "ลิตร",
    qc_weight: "/",
    qc_contamination: "/",
    qc_physical: "X",
    qc_color: "/",
    remark: "ไม่ผ่านการตรวจด้านกายภาพ (ข้อมูลสาธิต)",
  },
  {
    material_code: "DEMO-RM-004",
    supplier_code: "DEMO-SUP-004",
    quantity: "1,200",
    unit: "ถุง",
    qc_weight: "/",
    qc_contamination: "/",
    qc_physical: "/",
    qc_color: "O",
    remark: "ข้อมูลสาธิต",
  },
];

/** Number of populated paper slots in each of the six sample documents. */
const DEMO_USED_ROW_COUNTS = [1, 2, 3, 1, 4, 2] as const;

function createDemoSheet(sheetNumber: number): OrganicRawMaterialReceivingSheet {
  const code = String(sheetNumber).padStart(3, "0");
  const day = String(19 - sheetNumber).padStart(2, "0");
  const documentDate = `2026-11-${day}`;
  const savedAt = `${documentDate}T09:00:00+07:00`;
  const usedCount = DEMO_USED_ROW_COUNTS[sheetNumber - 1] ?? 0;
  const blank = blankOrganicRawMaterialSheet();

  return {
    ...blank,
    id: `organic-raw-material-demo-${code}`,
    document_date: documentDate,
    received_by: `ผู้รับสาธิต ${code}`,
    inspected_by: "ผู้ตรวจสอบสาธิต",
    created_at: savedAt,
    updated_at: savedAt,
    rows: blank.rows.map((row, index) => {
      if (index >= usedCount) {
        return row;
      }

      const demo = DEMO_MATERIAL_ROWS[(index + sheetNumber - 1) % DEMO_MATERIAL_ROWS.length];
      return { ...row, ...demo };
    }),
  };
}

export const demoOrganicRawMaterialReceivingSheets: OrganicRawMaterialReceivingSheet[] =
  Array.from({ length: DEMO_USED_ROW_COUNTS.length }, (_, index) =>
    createDemoSheet(index + 1),
  );
