import type { MasterReferences } from "@/src/features/master-data/master-domain";
export type Material = {
  id: string;
  material_code: string;
  material_name: string;
  lot_no: string;
  order_qty: number;
  unit: string;
  stock_balance: number;
};
export type MixingRound = {
  id: string;
  round_date: string;
  shift: string;
  loader_load_count: string;
  // null means not inspected yet; a completed inspection still has one Boolean result.
  is_pass: boolean | null;
  operator_mixer: string;
  supervisor: string;
};
export type MixingReport = {
  masterRefs?: MasterReferences;
  id: string;
  report_date: string;
  fertilizer: string;
  doc_no: string;
  lot_no: string;
  shift: string;
  location: string;
  loader_no: string;
  mix_duration: number | null;
  materials: Material[];
  mix_rounds: MixingRound[];
  inspector: string;
  inspector_date: string;
  production: string;
  factory_qa: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
};
export type MaterialCatalog = Pick<
  Material,
  "material_code" | "material_name" | "unit" | "stock_balance"
>;
export type MixingFilters = {
  search: string;
  from: string;
  to: string;
  shift: string;
  result: string;
};
export const emptyFilters: MixingFilters = {
  search: "",
  from: "",
  to: "",
  shift: "all",
  result: "all",
};
export type FieldErrors = Record<string, string>;
export const shifts = ["เช้า", "ดึก", "เช้า-ดึก", "ดึก-เช้า"];
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function blankRound(
  id: string,
  day: string,
  shift = "เช้า",
): MixingRound {
  return {
    id,
    round_date: day,
    shift,
    loader_load_count: "",
    is_pass: null,
    operator_mixer: "",
    supervisor: "",
  };
}
export function blankReport(day: string, doc_no: string): MixingReport {
  return {
    id: "",
    report_date: day,
    fertilizer: "",
    doc_no,
    lot_no: "",
    shift: "เช้า",
    location: "",
    loader_no: "",
    mix_duration: null,
    materials: [],
    mix_rounds: [blankRound("round-1", day)],
    inspector: "",
    inspector_date: "",
    production: "",
    factory_qa: "",
    created_at: "",
    updated_at: "",
    updated_by: "",
  };
}
const normalized = (text: string) => text.trim().toLocaleLowerCase();
export function nextDocumentNumber(records: MixingReport[], base: string) {
  let candidate = base;
  let suffix = 1;
  while (records.some((r) => normalized(r.doc_no) === normalized(candidate)))
    candidate = `${base}-${String(suffix++).padStart(2, "0")}`;
  return candidate;
}
export function summarizeReport(row: MixingReport) {
  const passed = row.mix_rounds.filter((r) => r.is_pass === true).length;
  const failed = row.mix_rounds.filter((r) => r.is_pass === false).length;
  const pending = row.mix_rounds.filter((r) => r.is_pass === null).length;
  const allPass = row.mix_rounds.length > 0 && passed === row.mix_rounds.length;
  return {
    passed,
    failed,
    pending,
    allPass,
    label: allPass ? "ผ่านทุกรอบ" : failed ? "มีรอบไม่ผ่าน" : "รอตรวจครบ",
    tone: allPass
      ? ("success" as const)
      : failed
        ? ("destructive" as const)
        : ("warning" as const),
  };
}
export function validateReport(
  row: MixingReport,
  records: MixingReport[],
  catalog: MaterialCatalog[],
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, label] of [
    ["doc_no", "เลขที่เอกสาร"],
    ["fertilizer", "สูตร / ผลิตภัณฑ์"],
    ["lot_no", "Lot No."],
    ["shift", "กะที่ผลิต"],
    ["location", "สถานที่ผสม"],
    ["loader_no", "หมายเลขรถตัก"],
  ] as const)
    if (!row[key].trim()) errors[key] = `กรุณาระบุ${label}`;
  if (!validDate(row.report_date))
    errors.report_date = "กรุณาระบุวันที่รายงานที่ถูกต้อง";
  if (row.inspector_date && !validDate(row.inspector_date))
    errors.inspector_date = "วันที่ตรวจสอบไม่ถูกต้อง";
  if (
    records.some(
      (r) => r.id !== row.id && normalized(r.doc_no) === normalized(row.doc_no),
    )
  )
    errors.doc_no = "เลขที่เอกสารซ้ำ กรุณาใช้เลขใหม่";
  if (
    row.mix_duration !== null &&
    (!Number.isFinite(row.mix_duration) || row.mix_duration <= 0)
  )
    errors.mix_duration = "ระยะเวลาต้องมากกว่า 0 ชั่วโมง";
  if (!row.materials.length)
    errors.materials = "เพิ่มวัตถุดิบอย่างน้อย 1 รายการ";
  const materialIds = new Set<string>();
  row.materials.forEach((m, i) => {
    const match = catalog.find((c) => c.material_code === m.material_code);
    if (
      !match ||
      m.material_name !== match.material_name ||
      m.unit !== match.unit
    )
      errors[`materials.${i}.material_code`] =
        "กรุณาเลือกวัตถุดิบจากรายการจำลอง";
    if (!m.id || materialIds.has(m.id))
      errors.materials = "รายการวัตถุดิบมีรหัสแถวซ้ำ";
    materialIds.add(m.id);
    if (!Number.isFinite(m.order_qty) || m.order_qty <= 0)
      errors[`materials.${i}.order_qty`] = "จำนวนต้องเป็นตัวเลขมากกว่า 0";
  });
  if (!row.mix_rounds.length) errors.mix_rounds = "เพิ่มรอบผสมอย่างน้อย 1 รอบ";
  const roundIds = new Set<string>();
  row.mix_rounds.forEach((r, i) => {
    if (!r.id || roundIds.has(r.id)) errors.mix_rounds = "รหัสรอบผสมซ้ำ";
    roundIds.add(r.id);
    if (!validDate(r.round_date))
      errors[`rounds.${i}.round_date`] = "กรุณาระบุวันที่ผสมที่ถูกต้อง";
    for (const [key, label] of [
      ["shift", "กะที่ผลิต"],
      ["loader_load_count", "จำนวนตัก"],
      ["operator_mixer", "ผู้ผสม"],
      ["supervisor", "ผู้ควบคุม"],
    ] as const)
      if (!r[key].trim()) errors[`rounds.${i}.${key}`] = `กรุณาระบุ${label}`;
    if (
      r.loader_load_count.trim() &&
      !["ครบ", "ไม่ครบ"].includes(r.loader_load_count.trim()) &&
      (!Number.isFinite(Number(r.loader_load_count)) ||
        Number(r.loader_load_count) <= 0)
    )
      errors[`rounds.${i}.loader_load_count`] =
        "ระบุจำนวนมากกว่า 0 หรือ ครบ / ไม่ครบ";
    if (r.is_pass !== true && r.is_pass !== false && r.is_pass !== null)
      errors[`rounds.${i}.is_pass`] = "ผลตรวจไม่ถูกต้อง";
  });
  return errors;
}
export class MixingValidationError extends Error {
  constructor(public fields: FieldErrors) {
    super(Object.values(fields)[0]);
    this.name = "MixingValidationError";
  }
}
export function saveReport(
  records: MixingReport[],
  draft: MixingReport,
  id: string,
  at: string,
  catalog: MaterialCatalog[],
) {
  if (draft.id && !records.some((r) => r.id === draft.id))
    throw new Error("ไม่พบรายงานนี้ อาจถูกลบแล้ว");
  if (!draft.id && records.some((r) => r.id === id))
    throw new Error("รหัสรายงานซ้ำ");
  const errors = validateReport(draft, records, catalog);
  if (Object.keys(errors).length) throw new MixingValidationError(errors);
  const existing = records.find((r) => r.id === draft.id);
  const row: MixingReport = structuredClone({
    ...draft,
    id: draft.id || id,
    doc_no: draft.doc_no.trim(),
    created_at: existing?.created_at || at,
    updated_at: at,
    updated_by: "ผู้ใช้งานจำลอง",
  });
  // Stock is a catalog reference, never an editable balance or an inventory transaction.
  row.materials = row.materials.map((m) => ({
    ...m,
    stock_balance: catalog.find((c) => c.material_code === m.material_code)!
      .stock_balance,
  }));
  return existing
    ? records.map((r) => (r.id === row.id ? row : r))
    : [row, ...records];
}
export function deleteReport(records: MixingReport[], id: string) {
  if (!records.some((r) => r.id === id))
    throw new Error("ไม่พบรายงานที่ต้องการลบ");
  return records.filter((r) => r.id !== id);
}
export function copyReport(
  records: MixingReport[],
  id: string,
  nextId: string,
  at: string,
  catalog: MaterialCatalog[],
) {
  const source = records.find((r) => r.id === id);
  if (!source) throw new Error("ไม่พบรายงานต้นฉบับ");
  const draft = structuredClone(source);
  draft.id = "";
  draft.doc_no = nextDocumentNumber(records, `${source.doc_no}-COPY`);
  draft.inspector =
    draft.inspector_date =
    draft.production =
    draft.factory_qa =
      "";
  draft.mix_rounds = draft.mix_rounds.map((r) => ({ ...r, is_pass: null }));
  return saveReport(records, draft, nextId, at, catalog);
}
export function filterReports(records: MixingReport[], filters: MixingFilters) {
  return records.filter(
    (r) =>
      (!filters.search.trim() ||
        [r.doc_no, r.fertilizer, r.lot_no, r.location].some((v) =>
          normalized(v).includes(normalized(filters.search)),
        )) &&
      (!filters.from || r.report_date >= filters.from) &&
      (!filters.to || r.report_date <= filters.to) &&
      (filters.shift === "all" || r.shift === filters.shift) &&
      (filters.result === "all" ||
        (filters.result === "pass"
          ? summarizeReport(r).allPass
          : !summarizeReport(r).allPass)),
  );
}
export function previewImport(
  rows: MixingReport[],
  records: MixingReport[],
  catalog: MaterialCatalog[],
) {
  return rows.map((row, index) => {
    const candidate = { ...row, id: "" };
    const errors = validateReport(
      candidate,
      [...records, ...rows.slice(0, index)],
      catalog,
    );
    return { row, errors, valid: Object.keys(errors).length === 0 };
  });
}
export function importReports(
  records: MixingReport[],
  rows: MixingReport[],
  ids: string[],
  at: string,
  catalog: MaterialCatalog[],
) {
  if (!rows.length) throw new Error("เลือกข้อมูลตัวอย่างอย่างน้อย 1 รายการ");
  if (ids.length !== rows.length) throw new Error("รหัสข้อมูลนำเข้าไม่ครบ");
  return rows.reduce(
    (next, row, i) => saveReport(next, { ...row, id: "" }, ids[i], at, catalog),
    records,
  );
}
