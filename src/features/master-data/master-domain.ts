export const masterKinds = {
  sites: "โรงงาน / Site",
  areas: "พื้นที่ปฏิบัติงาน",
  warehouses: "คลังสินค้า",
  departments: "ฝ่าย / แผนก",
  lines: "สายการผลิต",
  shifts: "กะการทำงาน",
  vehicleTypes: "ประเภทรถ",
  vehicles: "รถใช้งานภายใน",
  equipment: "เครื่องจักร / อุปกรณ์",
  units: "หน่วยนับ",
  categories: "หมวดสินค้า",
  brands: "แบรนด์",
  processes: "กระบวนการผลิต",
  suppliers: "ผู้ขาย",
} as const;
export type MasterKind = keyof typeof masterKinds;
export type MasterRow = {
  id: string;
  kind: MasterKind;
  code: string;
  name: string;
  active: boolean;
  type: string;
  parentId: string;
  typeId: string;
  start: string;
  end: string;
  contact: string;
  phone: string;
  aliases: string[];
};
export type MasterSnapshot = {
  id: string;
  kind: MasterKind | "personnel";
  code: string;
  name: string;
  value: string;
};
export type MasterReferences = Record<string, MasterSnapshot>;
export type Personnel = import("@/src/lib/mock-data/settings").DemoUser;
export type MasterState = {
  rows: MasterRow[];
  personnel: Personnel[];
  used: string[];
};
export type ReferenceField = { kind: MasterSnapshot["kind"]; value: string };
export const parentKinds: Partial<Record<MasterKind, MasterKind[]>> = {
  areas: ["sites"],
  warehouses: ["sites"],
  departments: ["departments"],
  lines: ["sites", "areas"],
  vehicles: ["sites", "areas"],
  equipment: ["sites", "areas", "lines"],
};
export function blankMaster(kind: MasterKind, id: string): MasterRow {
  return {
    id,
    kind,
    code: "",
    name: "",
    active: true,
    type: "",
    parentId: "",
    typeId: "",
    start: "",
    end: "",
    contact: "",
    phone: "",
    aliases: [],
  };
}
const norm = (v: string) => v.trim().toLocaleLowerCase("th");
export function masterError(state: MasterState, row: MasterRow): string {
  if (!Object.hasOwn(masterKinds, row.kind))
    return "ประเภทข้อมูลหลักไม่ถูกต้อง";
  if (!/^[A-Z0-9_-]{1,30}$/i.test(row.code.trim()))
    return "รหัสต้องเป็น A–Z, 0–9, - หรือ _ ไม่เกิน 30 ตัวอักษร";
  if (!row.name.trim() || row.name.trim().length > 100)
    return "กรุณาระบุชื่อไม่เกิน 100 ตัวอักษร";
  if (
    state.rows.some(
      (r) =>
        r.id !== row.id &&
        r.kind === row.kind &&
        (norm(r.code) === norm(row.code) ||
          [r.name, ...r.aliases].some((v) => norm(v) === norm(row.name))),
    )
  )
    return "รหัสหรือชื่อซ้ำในหมวดเดียวกัน";
  if (row.parentId) {
    const parent = state.rows.find((r) => r.id === row.parentId);
    const previous = state.rows.find((r) => r.id === row.id);
    if (
      !parent ||
      !parentKinds[row.kind]?.includes(parent.kind) ||
      (!parent.active && previous?.parentId !== row.parentId)
    )
      return "กรุณาเลือกหน่วยงานหรือพื้นที่ต้นสังกัดที่ถูกต้องและเปิดใช้งาน";
    const visited = new Set([row.id]);
    let next: MasterRow | undefined = parent;
    while (next) {
      if (visited.has(next.id)) return "หน่วยงานต้นสังกัดอ้างอิงวนกลับไม่ได้";
      visited.add(next.id);
      next = state.rows.find((r) => r.id === next?.parentId);
    }
  }
  if (row.kind === "vehicles") {
    const type = state.rows.find(
      (r) => r.id === row.typeId && r.kind === "vehicleTypes",
    );
    if (
      !type ||
      (!type.active &&
        state.rows.find((r) => r.id === row.id)?.typeId !== type.id)
    )
      return "กรุณาเลือกประเภทรถที่เปิดใช้งาน";
  } else if (row.typeId) return "หมวดนี้ไม่รองรับประเภทรถ";
  if (
    row.kind === "vehicleTypes" &&
    !["รถตัก", "รถยก", "อื่นๆ"].includes(row.type)
  )
    return "กรุณาเลือกกลุ่มการใช้งานของประเภทรถ";
  if (
    row.kind === "shifts" &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end) ||
      row.start === row.end)
  )
    return "ระบุเวลาเริ่มและสิ้นสุดกะให้ถูกต้องและไม่เท่ากัน (ข้ามวันได้)";
  return "";
}
export function saveMaster(state: MasterState, row: MasterRow) {
  const error = masterError(state, row);
  if (error) throw new Error(error);
  const saved = {
    ...row,
    aliases: [...row.aliases],
    code: row.code.trim().toUpperCase(),
    name: row.name.trim(),
  };
  const existing = state.rows.find((r) => r.id === row.id);
  if (existing && existing.name !== saved.name)
    saved.aliases = [
      ...new Set([...existing.aliases, existing.name, ...saved.aliases]),
    ];
  if (existing && existing.kind !== row.kind)
    throw new Error("เปลี่ยนหมวดของรหัสเดิมไม่ได้");
  return {
    ...state,
    rows: existing
      ? state.rows.map((r) => (r.id === row.id ? saved : r))
      : [...state.rows, saved],
  };
}
export function deleteMaster(state: MasterState, id: string) {
  if (!state.rows.some((r) => r.id === id)) throw new Error("ไม่พบข้อมูลหลัก");
  const row = state.rows.find((r) => r.id === id)!;
  if (
    state.used.includes(id) ||
    state.rows.some((r) => r.parentId === id || r.typeId === id) ||
    (row.kind === "departments" &&
      state.personnel.some((p) =>
        [row.name, ...row.aliases].includes(p.department),
      ))
  )
    throw new Error("รายการนี้ถูกอ้างอิงแล้ว กรุณาปิดใช้งานแทนการลบ");
  return { ...state, rows: state.rows.filter((r) => r.id !== id) };
}
export function choices(state: MasterState, kind: MasterSnapshot["kind"]) {
  return kind === "personnel"
    ? state.personnel
        .filter((p) => p.active)
        .map((p) => ({ id: p.id, code: p.id, name: p.displayName }))
    : state.rows.filter((r) => r.kind === kind && r.active);
}
export function snapshot(
  kind: MasterSnapshot["kind"],
  row: { id: string; code: string; name: string },
  value = row.name,
): MasterSnapshot {
  return { kind, id: row.id, code: row.code, name: row.name, value };
}
export function referenceRow(state: MasterState, ref: MasterSnapshot) {
  return ref.kind === "personnel"
    ? state.personnel.find((r) => r.id === ref.id)
    : state.rows.find((r) => r.id === ref.id && r.kind === ref.kind);
}
export function captureReferences(
  state: MasterState,
  fields: Record<string, ReferenceField>,
  previous: MasterReferences = {},
  legacy = false,
): MasterReferences {
  const refs: MasterReferences = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field.value) continue;
    const old = previous[key];
    if (old && old.kind === field.kind && old.value === field.value) {
      if (!referenceRow(state, old))
        throw new Error(`ไม่พบข้อมูลหลักเดิม: ${field.value}`);
      refs[key] = { ...old };
      continue;
    }
    const row =
      field.kind === "personnel"
        ? state.personnel.find((p) => p.active && p.displayName === field.value)
        : state.rows.find(
            (r) =>
              r.kind === field.kind &&
              r.active &&
              (r.name === field.value ||
                r.code === field.value ||
                r.aliases.includes(field.value)),
          );
    if (!row) {
      if (legacy) continue;
      throw new Error(`กรุณาเลือกข้อมูลหลักที่เปิดใช้งาน: ${field.value}`);
    }
    refs[key] =
      field.kind === "personnel"
        ? snapshot(
            field.kind,
            {
              id: row.id,
              code: row.id,
              name: "displayName" in row ? row.displayName : row.name,
            },
            field.value,
          )
        : snapshot(field.kind, row as MasterRow, field.value);
  }
  return refs;
}
export function retainReferences(
  state: MasterState,
  refs: MasterReferences,
): MasterState {
  return {
    ...state,
    used: [
      ...new Set([...state.used, ...Object.values(refs).map((r) => r.id)]),
    ],
  };
}
