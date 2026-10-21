export type FactoryProfile = "itech" | "ifoam";
export const profiles = {
  itech: {
    label: "iTech",
    location: "โรงงานกาญ 1",
    wipNames: [
      "วัตถุดิบ WIP",
      "ยอดเบิกวัตถุดิบ",
      "ปุ๋ยอินทรีย์ WIP",
      "สารปรับสภาพดิน WIP",
    ],
  },
  ifoam: {
    label: "iFoam",
    location: "โรงงานกาญ 3",
    wipNames: [
      "วัตถุดิบ WIP",
      "ยอดเบิกวัตถุดิบ",
      "ปุ๋ยอินทรีย์ WIP",
      "สารปรับสภาพดิน WIP",
    ],
  },
} as const;
export const units = [
  "กระสอบ",
  "Bag",
  "กิโลกรัม",
  "ตัน",
  "ด้าย",
  "ม้วน",
  "เส้น",
] as const;
export const wipSizes = [10, 12, 30, 50];
export const wipQuantities = [1, 2, 3, 4];
export const signerFields = [
  [
    "bag_dispenser_bag_warehouse_staff",
    "ผู้จ่ายกระสอบ / เจ้าหน้าที่คลังกระสอบ",
  ],
  ["requisitioner_production_supervisor", "ผู้เบิก / หัวหน้าฝ่ายผลิต"],
  ["inventory_auditor", "ผู้ตรวจสอบ (เจ้าหน้าที่คลังสินค้า)"],
] as const;
export interface MaterialRow {
  id: string;
  m_item_name: string;
  m_size: number | null;
  m_qty: number | null;
  m_unit: string;
  m_desc: string;
}
export interface WipRow {
  id: string;
  w_item_name: string;
  w_size: number | null;
  w_qty: number | null;
  w_unit: string;
  w_desc: string;
}
export interface Requisition {
  id: string;
  profile: FactoryProfile;
  location: string;
  date: string;
  doc_no: string;
  material_details: MaterialRow[];
  wip_materials: WipRow[];
  bag_dispenser_bag_warehouse_staff: string;
  requisitioner_production_supervisor: string;
  inventory_auditor: string;
  createdAt: string;
  updatedAt: string;
}
export type Errors = Record<string, string>;
export const newMaterial = (id: string): MaterialRow => ({
  id,
  m_item_name: "",
  m_size: null,
  m_qty: null,
  m_unit: "",
  m_desc: "",
});
export const newWip = (id: string): WipRow => ({
  id,
  w_item_name: "",
  w_size: null,
  w_qty: null,
  w_unit: "",
  w_desc: "",
});
export function blankRequisition(
  profile: FactoryProfile = "itech",
): Requisition {
  return {
    id: "",
    profile,
    location: profiles[profile].location,
    date: "",
    doc_no: "",
    material_details: [],
    wip_materials: [],
    bag_dispenser_bag_warehouse_staff: "",
    requisitioner_production_supervisor: "",
    inventory_auditor: "",
    createdAt: "",
    updatedAt: "",
  };
}
// Legacy prints ST outside doc_no. Accept a pasted prefix without printing it twice.
export function documentNumber(value: string): string {
  const suffix = value
    .trim()
    .replace(/^ST(?:\s*[-:]\s*|\s*)/i, "")
    .trim();
  return suffix ? `ST-${suffix}` : "";
}
export function materialEmpty(r: MaterialRow) {
  return (
    !r.m_item_name.trim() &&
    r.m_size === null &&
    r.m_qty === null &&
    !r.m_unit.trim() &&
    !r.m_desc.trim()
  );
}
export function wipEmpty(r: WipRow) {
  return (
    !r.w_item_name.trim() &&
    r.w_size === null &&
    r.w_qty === null &&
    !r.w_unit.trim() &&
    !r.w_desc.trim()
  );
}
export function validateRequisition(
  row: Requisition,
  records: readonly Requisition[],
): Errors {
  const errors: Errors = {};
  if (!profiles[row.profile]) errors.profile = "กรุณาเลือกโรงงาน";
  if (!row.location.trim()) errors.location = "กรุณาระบุสถานที่";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
    !Number.isFinite(Date.parse(row.date)) ||
    new Date(row.date).toISOString().slice(0, 10) !== row.date
  )
    errors.date = "กรุณาระบุวันที่เอกสารที่ถูกต้อง";
  if (!documentNumber(row.doc_no)) errors.doc_no = "กรุณากรอกเอกสารเลขที่";
  else if (
    records.some(
      (r) =>
        r.id !== row.id &&
        documentNumber(r.doc_no).toLocaleLowerCase() ===
          documentNumber(row.doc_no).toLocaleLowerCase(),
    )
  )
    errors.doc_no = "เลขที่เอกสารซ้ำกับข้อมูลตัวอย่าง";
  const check = (
    id: string,
    name: string,
    size: number | null,
    qty: number | null,
    unit: string,
  ) => {
    if (!name.trim()) errors[`${id}.name`] = "กรุณากรอกชื่อรายการ";
    if (size === null || !Number.isFinite(size) || size <= 0)
      errors[`${id}.size`] = "ขนาด (kg) ต้องมากกว่า 0";
    if (qty === null || !Number.isFinite(qty) || qty <= 0)
      errors[`${id}.qty`] = "จำนวนต้องเป็นตัวเลขมากกว่า 0";
    if (!unit.trim()) errors[`${id}.unit`] = "กรุณาระบุหน่วยนับ";
  };
  const materials = row.material_details.filter((r) => !materialEmpty(r));
  const wip = row.wip_materials.filter((r) => !wipEmpty(r));
  materials.forEach((r) =>
    check(r.id, r.m_item_name, r.m_size, r.m_qty, r.m_unit),
  );
  wip.forEach((r) => check(r.id, r.w_item_name, r.w_size, r.w_qty, r.w_unit));
  if (!materials.length && !wip.length)
    errors.items = "ต้องมีอย่างน้อย 1 รายการวัสดุ หรือ WIP";
  const ids = [...row.material_details, ...row.wip_materials].map((r) => r.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    errors.items = "รหัสแถวซ้ำหรือไม่ถูกต้อง กรุณาสร้างแถวใหม่";
  const original = records.find((r) => r.id === row.id);
  if (original && original.profile !== row.profile)
    errors.profile = "ไม่สามารถเปลี่ยนโรงงานของใบเบิกเดิม";
  return errors;
}
export function saveRequisition(
  records: readonly Requisition[],
  draft: Requisition,
  newId: string,
  now: string,
): { records: Requisition[]; row?: Requisition; errors: Errors } {
  const errors = validateRequisition(draft, records);
  if (draft.id && !records.some((r) => r.id === draft.id))
    errors.document = "ไม่พบใบเบิกเดิม กรุณาเปิดเอกสารอีกครั้ง";
  if (!draft.id && (!newId || records.some((r) => r.id === newId)))
    errors.document = "รหัสเอกสารไม่ถูกต้อง";
  if (Object.keys(errors).length) return { records: [...records], errors };
  const original = records.find((r) => r.id === draft.id);
  const row = structuredClone({
    ...draft,
    id: draft.id || newId,
    doc_no: documentNumber(draft.doc_no),
    material_details: draft.material_details.filter((r) => !materialEmpty(r)),
    wip_materials: draft.wip_materials.filter((r) => !wipEmpty(r)),
    createdAt: original?.createdAt || now,
    updatedAt: now,
  });
  return {
    records: original
      ? records.map((r) => (r.id === row.id ? row : r))
      : [row, ...records],
    row,
    errors: {},
  };
}
export function deleteRequisition(records: readonly Requisition[], id: string) {
  return records.filter((r) => r.id !== id);
}
export interface HistoryFilters {
  search: string;
  from: string;
  to: string;
  profile: string;
}
export function filterRequisitions(
  records: readonly Requisition[],
  filters: HistoryFilters,
) {
  const q = filters.search.trim().toLocaleLowerCase();
  return records.filter(
    (r) =>
      (!filters.profile || r.profile === filters.profile) &&
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to) &&
      (!q ||
        [
          r.doc_no,
          r.location,
          r.requisitioner_production_supervisor,
          ...r.material_details.map((m) => m.m_item_name),
          ...r.wip_materials.map((w) => w.w_item_name),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q)),
  );
}
export function summarize(row: Requisition) {
  const materials = row.material_details.filter((r) => !materialEmpty(r));
  const wip = row.wip_materials.filter((r) => !wipEmpty(r));
  const quantities: Record<string, number> = {};
  for (const [unit, qty] of [
    ...materials.map((r) => [r.m_unit, r.m_qty] as const),
    ...wip.map((r) => [r.w_unit, r.w_qty] as const),
  ]) {
    if (unit.trim() && qty !== null && Number.isFinite(qty) && qty > 0)
      quantities[unit.trim()] = (quantities[unit.trim()] || 0) + qty;
  }
  return {
    materials: materials.length,
    wip: wip.length,
    total: materials.length + wip.length,
    quantities,
  };
}
