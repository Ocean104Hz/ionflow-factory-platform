import {
  blankMaster,
  blankFormula,
  type BOMState,
  type Master,
  type Formula,
  type ImportRow,
} from "@/src/features/bom/bom-domain";
const at = "2026-10-15T03:00:00Z";
const master = (
  id: string,
  code: string,
  name: string,
  type: Master["type"],
  unit = "กิโลกรัม",
): Master => ({
  ...blankMaster(),
  id,
  code,
  name,
  type,
  unit,
  usageType: type === "SUB_MATERIAL" ? "บรรจุภัณฑ์" : "ผลิต",
  company: "บริษัทสาธิต",
  process: "ผสม",
  category: "วัสดุตัวอย่าง",
  brand: "DEMO",
  department: "ผลิต",
  createdAt: at,
  updatedAt: at,
  updatedBy: "ผู้ใช้งานสาธิต",
});
const masters = [
  master(
    "fg-a",
    "DEMO-FG001",
    "ผลิตภัณฑ์ผสมมาตรฐานสำหรับงานโรงงาน รุ่นตัวอย่าง A",
    "FINISHED_GOOD",
  ),
  master("sf-a", "DEMO-SF001", "วัสดุผสมกึ่งสำเร็จรูป", "SEMI_FINISHED"),
  master("raw-a", "DEMO-RM001", "วัตถุดิบหลัก A", "RAW_MATERIAL"),
  master("raw-b", "DEMO-RM002", "วัตถุดิบเสริม B", "RAW_MATERIAL"),
  master("bag", "DEMO-PK001", "ถุงบรรจุตัวอย่าง", "SUB_MATERIAL", "ใบ"),
  master("other", "DEMO-OT001", "วัสดุอื่นสำหรับทดลอง", "OTHER"),
  master("fg-b", "DEMO-FG002", "ผลิตภัณฑ์ใหม่ยังไม่มีสูตร", "FINISHED_GOOD"),
];
const formula = (
  id: string,
  parent: Master,
  version: string,
  status: Formula["status"],
  packaging = false,
): Formula => ({
  ...blankFormula(parent),
  id,
  code: `${parent.code}-F`,
  name: `สูตรผสมตัวอย่าง ${version}`,
  version,
  status,
  effectiveDate: "2026-10-15",
  ingredients: [
    { materialId: "raw-a", quantity: 800, unit: "กิโลกรัม", remarks: "" },
    { materialId: "raw-b", quantity: 200, unit: "กิโลกรัม", remarks: "" },
  ],
  packaging: packaging
    ? [{ materialId: "bag", quantity: 40, unit: "ใบ", remarks: "" }]
    : [],
  createdAt: at,
  updatedAt: at,
  history: [{ at, actor: "ผู้ใช้งานสาธิต", action: "สร้างสูตรตัวอย่าง" }],
});
export const demoBOM: BOMState = {
  masters: masters.map((m) =>
    m.id === "fg-a" ? { ...m, defaultFormulaId: "formula-a2" } : m,
  ),
  formulas: [
    formula("formula-a1", masters[0], "V1", "INACTIVE"),
    formula("formula-a2", masters[0], "V2", "ACTIVE", true),
    formula("formula-a3", masters[0], "V3", "DRAFT", true),
    formula("formula-s1", masters[1], "V1", "ACTIVE"),
  ],
};
export function demoImportRows(): ImportRow[] {
  const fresh = {
    ...blankMaster(),
    code: "DEMO-IMPORT01",
    name: "สินค้าใหม่จากตัวอย่าง Import",
    unit: "กิโลกรัม",
  };
  const newFormula = {
    ...formula("", masters[0], "V4", "DRAFT"),
    createdAt: "",
    updatedAt: "",
    history: [],
  };
  return [
    { key: "row-2", kind: "master", data: fresh },
    {
      key: "row-3",
      kind: "master",
      data: { ...fresh, code: "DEMO-FG001", name: "ตัวอย่างรหัสซ้ำ" },
    },
    { key: "row-4", kind: "formula", data: newFormula },
    {
      key: "row-5",
      kind: "formula",
      data: { ...newFormula, version: "V2", name: "ตัวอย่างเวอร์ชันซ้ำ" },
    },
    {
      key: "row-6",
      kind: "formula",
      data: {
        ...newFormula,
        version: "V5",
        ingredients: [
          { materialId: "raw-a", quantity: 0, unit: "กิโลกรัม", remarks: "" },
        ],
      },
    },
  ];
}
