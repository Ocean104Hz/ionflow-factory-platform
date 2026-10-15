export type MasterSettingKind = "departments" | "warehouses";
export type MasterSettingRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  active: boolean;
};
export const masterSettingTypes: Record<MasterSettingKind, string[]> = {
  departments: ["ฝ่าย", "แผนก"],
  warehouses: ["คลังสินค้า", "สถานที่", "โรงงาน"],
};
export const demoMasterSettings: Record<MasterSettingKind, MasterSettingRow[]> =
  {
    departments: [
      {
        id: "dep-1",
        code: "DEP-001",
        name: "บริหาร",
        type: "ฝ่าย",
        active: true,
      },
      {
        id: "dep-2",
        code: "DEP-002",
        name: "การผลิต",
        type: "ฝ่าย",
        active: true,
      },
      {
        id: "dep-3",
        code: "DEP-003",
        name: "คลังสินค้า",
        type: "แผนก",
        active: true,
      },
      {
        id: "dep-4",
        code: "DEP-004",
        name: "บัญชี",
        type: "แผนก",
        active: true,
      },
      { id: "dep-5", code: "DEP-005", name: "QC", type: "แผนก", active: false },
    ],
    warehouses: [
      {
        id: "wh-1",
        code: "WH01",
        name: "คลังหลักสาธิต",
        type: "คลังสินค้า",
        active: true,
      },
      {
        id: "wh-2",
        code: "WH02",
        name: "คลังรองสาธิต",
        type: "คลังสินค้า",
        active: true,
      },
      {
        id: "wh-3",
        code: "SITE-DEMO",
        name: "จุดรับสินค้าสาธิต",
        type: "สถานที่",
        active: true,
      },
      {
        id: "wh-4",
        code: "FAC-DEMO",
        name: "โรงงานตัวอย่าง",
        type: "โรงงาน",
        active: false,
      },
    ],
  };
export function validateMasterSetting(
  row: MasterSettingRow,
  rows: MasterSettingRow[],
  kind: MasterSettingKind,
): string {
  const code = row.code.trim().toUpperCase();
  const name = row.name.trim();
  if (!/^[A-Z0-9_-]{1,30}$/.test(code))
    return "กรุณาระบุรหัสเป็น A–Z, 0–9, - หรือ _ ไม่เกิน 30 ตัวอักษร";
  if (!name || name.length > 100) return "กรุณาระบุชื่อไม่เกิน 100 ตัวอักษร";
  if (!masterSettingTypes[kind].includes(row.type))
    return "กรุณาเลือกประเภทที่ถูกต้อง";
  if (
    rows.some(
      (other) =>
        other.id !== row.id && other.code.trim().toUpperCase() === code,
    )
  )
    return "รหัสนี้มีอยู่แล้ว";
  if (
    rows.some(
      (other) =>
        other.id !== row.id &&
        other.name.trim().toLocaleLowerCase("th-TH") ===
          name.toLocaleLowerCase("th-TH"),
    )
  )
    return "ชื่อนี้มีอยู่แล้ว";
  return "";
}
