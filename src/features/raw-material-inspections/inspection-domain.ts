import type { MasterReferences } from "@/src/features/master-data/master-domain";
export const inspectionChecks = [
  {
    key: "color",
    label: "สีเทียบกับตัวอย่าง",
    hint: "เทียบกับตัวอย่างมาตรฐานที่โรงงานกำหนด",
  },
  {
    key: "moisture",
    label: "ความชื้น (%)",
    hint: "บันทึกค่าที่วัดได้และเกณฑ์ของวัตถุดิบในหมายเหตุ",
  },
  {
    key: "impurities",
    label: "สิ่งปลอมปน (%)",
    hint: "ตรวจตามข้อกำหนดของวัตถุดิบแต่ละประเภท",
  },
  { key: "sieve", label: "ผงผ่านตะแกรง #2", hint: "ระบุผลและเกณฑ์ที่ใช้ตรวจ" },
  { key: "solubility", label: "การละลายน้ำ", hint: "ระบุเวลาและสภาพการละลาย" },
  {
    key: "bag",
    label: "สภาพกระสอบบรรจุ",
    hint: "ตรวจการฉีกขาด ความสะอาด และถุงชั้นใน",
  },
  {
    key: "physical",
    label: "ลักษณะทางกายภาพ",
    hint: "ตรวจการจับตัวเป็นก้อน ผิวสัมผัส และสิ่งเจือปน",
  },
] as const;
export type CheckKey = (typeof inspectionChecks)[number]["key"];
export type CheckResult = "pending" | "pass" | "fail" | "na";
export type Inspection = {
  masterRefs?: MasterReferences;
  id: string;
  number: string;
  date: string;
  location: string;
  lot: string;
  trip: string;
  sender: string;
  material: string;
  reference: string;
  inspector: string;
  inspectorDate: string;
  approver: string;
  approverDate: string;
  finalized: boolean;
  checks: Record<CheckKey, { result: CheckResult; note: string }>;
};
export function blankInspection(): Inspection {
  return {
    id: "",
    number: "",
    date: "",
    location: "",
    lot: "",
    trip: "",
    sender: "",
    material: "",
    reference: "",
    inspector: "",
    inspectorDate: "",
    approver: "",
    approverDate: "",
    finalized: false,
    checks: Object.fromEntries(
      inspectionChecks.map(({ key }) => [key, { result: "pending", note: "" }]),
    ) as Inspection["checks"],
  };
}
export function inspectionStatus(row: Inspection) {
  if (!row.finalized) return "รอตรวจสอบ";
  return inspectionChecks.some(({ key }) => row.checks[key].result === "fail")
    ? "ไม่ผ่าน"
    : "ผ่าน";
}
export function validateInspection(
  row: Inspection,
  records: Inspection[],
): string {
  if (
    ![
      row.number,
      row.date,
      row.location,
      row.lot,
      row.sender,
      row.material,
    ].every((v) => v.trim())
  )
    return "กรุณาระบุเลขเอกสาร วันที่ โรงงาน Lot ผู้ส่ง และวัตถุดิบให้ครบ";
  if (
    records.some(
      (r) =>
        r.id !== row.id &&
        r.number.trim().toLowerCase() === row.number.trim().toLowerCase(),
    )
  )
    return "เลขที่เอกสารนี้มีอยู่แล้ว";
  if (row.trip && (!/^\d+$/.test(row.trip) || Number(row.trip) < 1))
    return "เที่ยวรถต้องเป็นจำนวนเต็มมากกว่า 0";
  if (Boolean(row.approver.trim()) !== Boolean(row.approverDate))
    return "กรุณาระบุชื่อและวันที่ผู้อนุมัติให้ครบคู่กัน";
  if (!row.finalized) return "";
  if (!row.inspector.trim() || !row.inspectorDate)
    return "กรุณาระบุผู้ตรวจสอบและวันที่ตรวจ";
  const checks = inspectionChecks.map(({ key }) => row.checks[key]);
  if (checks.some((c) => c.result === "pending"))
    return "กรุณาระบุผลตรวจให้ครบทั้ง 7 หัวข้อ";
  if (checks.every((c) => c.result === "na"))
    return "ต้องมีรายการที่ตรวจจริงอย่างน้อย 1 หัวข้อ";
  if (
    checks.some(
      (c) => (c.result === "fail" || c.result === "na") && !c.note.trim(),
    )
  )
    return "กรุณาระบุเหตุผลสำหรับหัวข้อที่ไม่ผ่านหรือไม่เกี่ยวข้อง";
  return "";
}
