export const productTypes = {
  FINISHED_GOOD: "สินค้าสำเร็จรูป",
  SEMI_FINISHED: "สินค้ากึ่งสำเร็จรูป",
  RAW_MATERIAL: "วัตถุดิบ",
  SUB_MATERIAL: "วัสดุย่อย",
  OTHER: "อื่นๆ",
} as const;
export const formulaStatuses = {
  DRAFT: "ร่าง",
  ACTIVE: "ใช้งาน",
  INACTIVE: "ยกเลิกใช้",
} as const;
export type ProductType = keyof typeof productTypes;
export type FormulaStatus = keyof typeof formulaStatuses;
export type Master = {
  id: string;
  code: string;
  name: string;
  type: ProductType;
  unit: string;
  usageType: string;
  notes: string;
  company: string;
  process: string;
  category: string;
  brand: string;
  department: string;
  defaultFormulaId: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};
export type Component = {
  materialId: string;
  quantity: number;
  unit: string;
  remarks: string;
};
export type Formula = {
  id: string;
  masterId: string;
  code: string;
  name: string;
  version: string;
  status: FormulaStatus;
  batchSize: number;
  unit: string;
  effectiveDate: string;
  notes: string;
  ingredients: Component[];
  packaging: Component[];
  createdAt: string;
  updatedAt: string;
  history: { at: string; actor: string; action: string }[];
};
export type BOMState = { masters: Master[]; formulas: Formula[] };
export type FieldErrors = Record<string, string>;
export class BOMValidationError extends Error {
  constructor(public fields: FieldErrors) {
    super(Object.values(fields)[0]);
  }
}
const normal = (v: string) => v.trim().toUpperCase();
export const canHaveFormula = (m: Master) =>
  m.type !== "RAW_MATERIAL" && m.type !== "SUB_MATERIAL";
const positive = (n: number) => Number.isFinite(n) && n > 0;
const has = (o: object, key: string) => Object.hasOwn(o, key);
const check = (errors: FieldErrors) => {
  if (Object.keys(errors).length) throw new BOMValidationError(errors);
};
export const blankMaster = (): Master => ({
  id: "",
  code: "",
  name: "",
  type: "FINISHED_GOOD",
  unit: "กิโลกรัม",
  usageType: "",
  notes: "",
  company: "",
  process: "",
  category: "",
  brand: "",
  department: "",
  defaultFormulaId: null,
  createdAt: "",
  updatedAt: "",
  updatedBy: "",
});
export const blankFormula = (master: Master): Formula => ({
  id: "",
  masterId: master.id,
  code: "",
  name: "",
  version: "",
  status: "DRAFT",
  batchSize: 1000,
  unit: master.unit,
  effectiveDate: "",
  notes: "",
  ingredients: [],
  packaging: [],
  createdAt: "",
  updatedAt: "",
  history: [],
});

export function masterErrors(state: BOMState, row: Master): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of ["code", "name", "unit"] as const)
    if (!row[key].trim()) errors[key] = "กรุณาระบุข้อมูลนี้";
  if (!has(productTypes, row.type)) errors.type = "ประเภทสินค้าไม่ถูกต้อง";
  if (
    state.masters.some(
      (m) => m.id !== row.id && normal(m.code) === normal(row.code),
    )
  )
    errors.code = "รหัสสินค้า/วัตถุดิบซ้ำ";
  if (!canHaveFormula(row) && state.formulas.some((f) => f.masterId === row.id))
    errors.type = "รายการที่มีสูตรแล้วเปลี่ยนเป็นวัตถุดิบหรือวัสดุย่อยไม่ได้";
  const previous = state.masters.find((m) => m.id === row.id);
  if (row.defaultFormulaId !== (previous?.defaultFormulaId ?? null))
    errors.defaultFormulaId = "เปลี่ยนสูตรเริ่มต้นผ่านคำสั่งเลือกสูตรเท่านั้น";
  return errors;
}
export function formulaErrors(
  state: BOMState,
  row: Formula,
  setDefault: boolean,
): FieldErrors {
  const errors: FieldErrors = {};
  const parent = state.masters.find((m) => m.id === row.masterId);
  if (!parent || !canHaveFormula(parent))
    errors.masterId = "ไม่พบสินค้าต้นทาง หรือประเภทนี้สร้างสูตรไม่ได้";
  for (const key of ["code", "name", "version", "unit"] as const)
    if (!row[key].trim()) errors[key] = "กรุณาระบุข้อมูลนี้";
  if (!has(formulaStatuses, row.status)) errors.status = "สถานะสูตรไม่ถูกต้อง";
  if (!positive(row.batchSize))
    errors.batchSize = "ปริมาณผลิตต้องเป็นตัวเลขที่มากกว่า 0";
  if (
    row.effectiveDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(row.effectiveDate) ||
      !Number.isFinite(Date.parse(row.effectiveDate)) ||
      new Date(row.effectiveDate).toISOString().slice(0, 10) !==
        row.effectiveDate)
  )
    errors.effectiveDate = "วันที่เริ่มใช้ไม่ถูกต้อง";
  if (
    state.formulas.some(
      (f) =>
        f.id !== row.id &&
        f.masterId === row.masterId &&
        normal(f.version) === normal(row.version),
    )
  )
    errors.version = "เวอร์ชันซ้ำภายใต้สินค้านี้";
  const previous = state.formulas.find((f) => f.id === row.id);
  if (
    previous &&
    (previous.masterId !== row.masterId ||
      normal(previous.version) !== normal(row.version))
  )
    errors.version =
      "แก้เวอร์ชันหรือสินค้าของสูตรเดิมไม่ได้ กรุณาสร้างเวอร์ชันใหม่";
  if (setDefault && row.status !== "ACTIVE")
    errors.defaultFormula = "สูตรเริ่มต้นต้องเป็นสถานะใช้งาน (ACTIVE)";
  if (!row.ingredients.length)
    errors.ingredients = "ต้องมีวัตถุดิบอย่างน้อย 1 รายการ";
  for (const group of ["ingredients", "packaging"] as const) {
    const seen = new Set<string>();
    row[group].forEach((item, i) => {
      const key = `${group}.${i}`;
      if (
        !state.masters.some((m) => m.id === item.materialId) ||
        item.materialId === row.masterId
      )
        errors[key] =
          "ไม่พบวัตถุดิบ หรือใช้สินค้าต้นทางเป็นส่วนประกอบของตัวเองไม่ได้";
      else if (seen.has(item.materialId))
        errors[key] = "ส่วนประกอบซ้ำในกลุ่มเดียวกัน";
      else if (!positive(item.quantity))
        errors[key] = "จำนวนต้องเป็นตัวเลขที่มากกว่า 0";
      else if (!item.unit.trim()) errors[key] = "กรุณาระบุหน่วย";
      seen.add(item.materialId);
    });
  }
  return errors;
}
export function saveMaster(
  state: BOMState,
  draft: Master,
  id: string,
  at: string,
): BOMState {
  if (draft.id && !state.masters.some((m) => m.id === draft.id))
    throw new Error("ไม่พบข้อมูลหลักนี้แล้ว กรุณาเปิดรายการใหม่");
  if (!draft.id && state.masters.some((m) => m.id === id))
    throw new Error("ID ข้อมูลหลักซ้ำ");
  check(masterErrors(state, draft));
  const old = state.masters.find((m) => m.id === draft.id);
  const row = {
    ...draft,
    id: old?.id ?? id,
    code: normal(draft.code),
    name: draft.name.trim(),
    unit: draft.unit.trim(),
    createdAt: old?.createdAt ?? at,
    updatedAt: at,
    updatedBy: "ผู้ใช้งานสาธิต",
  };
  return {
    ...state,
    masters: old
      ? state.masters.map((m) => (m.id === row.id ? row : m))
      : [row, ...state.masters],
  };
}
export function saveFormula(
  state: BOMState,
  draft: Formula,
  setDefault: boolean,
  id: string,
  at: string,
): BOMState {
  if (draft.id && !state.formulas.some((f) => f.id === draft.id))
    throw new Error("ไม่พบสูตรนี้แล้ว กรุณาเปิดรายการใหม่");
  if (!draft.id && state.formulas.some((f) => f.id === id))
    throw new Error("ID สูตรซ้ำ");
  check(formulaErrors(state, draft, setDefault));
  const old = state.formulas.find((f) => f.id === draft.id);
  const row: Formula = {
    ...draft,
    id: old?.id ?? id,
    code: normal(draft.code),
    version: normal(draft.version),
    name: draft.name.trim(),
    createdAt: old?.createdAt ?? at,
    updatedAt: at,
    history: [
      ...(old?.history ?? []),
      {
        at,
        actor: "ผู้ใช้งานสาธิต",
        action: old
          ? `แก้ไขสูตร · ${formulaStatuses[draft.status]}`
          : "สร้างสูตร",
      },
    ],
  };
  return {
    masters: state.masters.map((m) =>
      m.id === row.masterId
        ? {
            ...m,
            defaultFormulaId: setDefault
              ? row.id
              : m.defaultFormulaId === row.id
                ? null
                : m.defaultFormulaId,
            updatedAt: at,
            updatedBy: "ผู้ใช้งานสาธิต",
          }
        : m,
    ),
    formulas: old
      ? state.formulas.map((f) => (f.id === row.id ? row : f))
      : [row, ...state.formulas],
  };
}
export function selectDefault(
  state: BOMState,
  masterId: string,
  formulaId: string | null,
  at: string,
): BOMState {
  const master = state.masters.find((m) => m.id === masterId);
  if (!master) throw new Error("ไม่พบสินค้าต้นทาง");
  if (formulaId) {
    const formula = state.formulas.find(
      (f) => f.id === formulaId && f.masterId === masterId,
    );
    if (!formula) throw new Error("สูตรไม่ได้เป็นของสินค้านี้หรือถูกลบแล้ว");
    check(formulaErrors(state, formula, true));
  }
  if (master.defaultFormulaId === formulaId) return state;
  return {
    ...state,
    formulas: state.formulas.map((f) =>
      f.id === formulaId || f.id === master.defaultFormulaId
        ? {
            ...f,
            updatedAt: at,
            history: [
              ...f.history,
              {
                at,
                actor: "ผู้ใช้งานสาธิต",
                action:
                  f.id === formulaId
                    ? "เลือกเป็นสูตรเริ่มต้น"
                    : "ยกเลิกสูตรเริ่มต้น",
              },
            ],
          }
        : f,
    ),
    masters: state.masters.map((m) =>
      m.id === masterId
        ? {
            ...m,
            defaultFormulaId: formulaId,
            updatedAt: at,
            updatedBy: "ผู้ใช้งานสาธิต",
          }
        : m,
    ),
  };
}
export function deleteMaster(state: BOMState, id: string): BOMState {
  if (!state.masters.some((m) => m.id === id))
    throw new Error("ไม่พบข้อมูลหลัก");
  if (
    state.formulas.some(
      (f) =>
        f.masterId === id ||
        [...f.ingredients, ...f.packaging].some((c) => c.materialId === id),
    )
  )
    throw new Error(
      "ลบไม่ได้: รายการนี้ยังมีสูตรหรือถูกใช้เป็นส่วนประกอบในสูตรอื่น",
    );
  return { ...state, masters: state.masters.filter((m) => m.id !== id) };
}
export function deleteFormula(
  state: BOMState,
  id: string,
  at: string,
): BOMState {
  const formula = state.formulas.find((f) => f.id === id);
  if (!formula) throw new Error("ไม่พบสูตร");
  if (state.masters.some((m) => m.defaultFormulaId === id))
    throw new Error("กรุณายกเลิกสูตรเริ่มต้นหรือเลือกสูตรอื่นก่อนลบ");
  return {
    masters: state.masters.map((m) =>
      m.id === formula.masterId
        ? { ...m, updatedAt: at, updatedBy: "ผู้ใช้งานสาธิต" }
        : m,
    ),
    formulas: state.formulas.filter((f) => f.id !== id),
  };
}
export type ImportRow = { key: string } & (
  { kind: "master"; data: Master } | { kind: "formula"; data: Formula }
);
export function importRows(
  state: BOMState,
  rows: ImportRow[],
  at: string,
): BOMState {
  if (!rows.length) throw new Error("กรุณาเลือกอย่างน้อย 1 แถว");
  let next = state;
  for (const row of rows) {
    if (row.data.id)
      throw new Error(
        "การนำเข้าตัวอย่างสร้างรายการใหม่เท่านั้น ไม่เขียนทับข้อมูลเดิม",
      );
    next =
      row.kind === "master"
        ? saveMaster(next, row.data, `import-master-${row.key}`, at)
        : saveFormula(next, row.data, false, `import-formula-${row.key}`, at);
  }
  return next;
}
export function importFeedback(
  state: BOMState,
  rows: ImportRow[],
): Record<string, string> {
  let next = state;
  const errors: Record<string, string> = {};
  for (const row of rows) {
    try {
      next = importRows(next, [row], "2026-10-15T00:00:00Z");
    } catch (error) {
      errors[row.key] =
        error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง";
    }
  }
  return errors;
}
