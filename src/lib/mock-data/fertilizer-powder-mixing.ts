import {
  blankReport,
  type MaterialCatalog,
  type MixingReport,
} from "@/src/features/fertilizer-powder-mixing/mixing-domain";

export const mixingCatalog: MaterialCatalog[] = [
  {
    material_code: "DEMO-RM001",
    material_name: "วัตถุดิบผงสูตรพื้นฐาน A (จำลอง)",
    unit: "กิโลกรัม",
    stock_balance: 2400,
  },
  {
    material_code: "DEMO-RM002",
    material_name: "วัตถุดิบผงผสม B (จำลอง)",
    unit: "กิโลกรัม",
    stock_balance: 1600,
  },
  {
    material_code: "DEMO-RM003",
    material_name: "สารปรับสภาพตัวอย่าง C",
    unit: "กระสอบ",
    stock_balance: 120,
  },
  {
    material_code: "DEMO-RM004",
    material_name: "วัสดุผงทดลอง D",
    unit: "กิโลกรัม",
    stock_balance: 0,
  },
];
export const mixingFormulas = [
  "DEMO สูตรผงมาตรฐาน A",
  "DEMO สูตรผงพิเศษ B",
  "DEMO สูตรทดลอง C",
];
export const mixingLocations = [
  "DEMO อาคารผสม 1",
  "DEMO อาคารผสม 2",
  "DEMO พื้นที่ทดลอง",
];
export const demoMixingReports: MixingReport[] = Array.from(
  { length: 6 },
  (_, i) => {
    const day = `2026-10-${String(16 - i).padStart(2, "0")}`;
    return {
      ...blankReport(day, `MIX-DEMO-${String(i + 1).padStart(4, "0")}`),
      id: `demo-mix-${i + 1}`,
      fertilizer: mixingFormulas[i % 3],
      lot_no: `DEMO-LOT-${i + 1}`,
      shift: i % 2 ? "ดึก" : "เช้า",
      location: mixingLocations[i % 3],
      loader_no: `DEMO-${(i % 2) + 1}`,
      mix_duration: 1.5,
      materials: mixingCatalog
        .slice(0, (i % 2) + 2)
        .map((m, j) => ({
          ...m,
          id: `m-${i}-${j}`,
          lot_no: `DEMO-MLOT-${j + 1}`,
          order_qty: (j + 1) * 50,
        })),
      mix_rounds: Array.from({ length: 2 + (i % 2) }, (_, j) => ({
        id: `r-${i}-${j}`,
        round_date: day,
        shift: i % 2 ? "ดึก" : "เช้า",
        loader_load_count: String(j + 2),
        is_pass: i === 2 && j === 0 ? null : i === 1 && j === 1 ? false : true,
        operator_mixer: "พนักงานผสม DEMO",
        supervisor: "หัวหน้างาน DEMO",
      })),
      inspector: i === 2 ? "" : "ผู้ตรวจ DEMO",
      inspector_date: i === 2 ? "" : day,
      production: "เจ้าหน้าที่ผลิต DEMO",
      factory_qa: "ผู้จัดการ DEMO",
      created_at: `${day}T01:00:00Z`,
      updated_at: `${day}T04:00:00Z`,
      updated_by: "ผู้ใช้งานจำลอง",
    };
  },
);
export function mixingImportSamples(): MixingReport[] {
  const valid = structuredClone(demoMixingReports[0]);
  valid.id = "sample-valid";
  valid.doc_no = "MIX-DEMO-IMPORT-01";
  const duplicate = structuredClone(valid);
  duplicate.id = "sample-duplicate";
  duplicate.doc_no = demoMixingReports[0].doc_no;
  const invalid = structuredClone(valid);
  invalid.id = "sample-invalid";
  invalid.doc_no = "MIX-DEMO-IMPORT-02";
  invalid.materials[0].order_qty = 0;
  return [valid, duplicate, invalid];
}
