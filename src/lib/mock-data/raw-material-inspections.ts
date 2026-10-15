import {
  blankInspection,
  type Inspection,
  inspectionChecks,
} from "@/src/features/raw-material-inspections/inspection-domain";
export const mockInspections: Inspection[] = [0, 1, 2].map((index) => ({
  ...blankInspection(),
  id: `demo-qc-${index + 1}`,
  number: `QC-DEMO-000${index + 1}`,
  date: "2026-10-15",
  location: "โรงงานสาธิต",
  lot: `DEMO-LOT-00${index + 1}`,
  trip: String(index + 1),
  sender: "บริษัทผู้จำหน่ายตัวอย่าง จำกัด",
  material: ["วัตถุดิบตัวอย่าง A", "วัสดุผสมตัวอย่าง B", "วัตถุดิบตัวอย่าง C"][
    index
  ],
  reference: `IN-DEMO-000${index + 1}`,
  inspector: index ? "เจ้าหน้าที่ QC ตัวอย่าง" : "",
  inspectorDate: index ? "2026-10-15" : "",
  finalized: index > 0,
  checks: Object.fromEntries(
    inspectionChecks.map(({ key }) => [
      key,
      {
        result:
          index === 0
            ? "pending"
            : index === 2 && key === "bag"
              ? "fail"
              : "pass",
        note:
          index === 2 && key === "bag" ? "กระสอบฉีกขาด (ข้อมูลตัวอย่าง)" : "",
      },
    ]),
  ) as Inspection["checks"],
}));
