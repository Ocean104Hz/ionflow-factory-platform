export interface BulkHeader {
  date: string;
  docNo: string;
  planTons: number | null;
  producedTons: number;
  targetBags: number | null;
  productionDays: string;
  payDate: string;
}
export interface BulkRow {
  id: string;
  itemName: string;
  product: string;
  productCode: string;
  qty: number | null;
  qtyUnit: string;
  lot: string;
  size: number | null;
  sizeNote: string;
  countUnit: string;
  prodDate: string;
  startTime: string;
  endTime: string;
  producedQty: number | null;
  signer: string;
  prodDateNote: string;
  startTimeNote: string;
  endTimeNote: string;
  signerNote: string;
  carryQty: number | null;
  carryNote: string;
  rowTotalNote: string;
}
export interface BulkSigners {
  issuer: string;
  qc: string;
  production: string;
  manager: string;
}
export interface BulkOrder {
  id: string;
  header: BulkHeader;
  rows: BulkRow[];
  docSigners: BulkSigners;
  note: string;
  createdAt: string;
  updatedAt: string;
}
export type BulkErrors = Record<string, string>;
export interface BulkProduct {
  id: string;
  code: string;
  name: string;
  size: number;
  formulaVersion: string;
}
export const signerLabels = {
  issuer: "ผู้ออกใบสั่งผลิต",
  qc: "ฝ่ายตรวจสอบคุณภาพ",
  production: "ฝ่ายผลิต",
  manager: "ผู้จัดการ",
} as const;
export function newBulkRow(id: string): BulkRow {
  return {
    id,
    itemName: "",
    product: "",
    productCode: "",
    qty: null,
    qtyUnit: "กระสอบ",
    lot: "",
    size: null,
    sizeNote: "",
    countUnit: "กก.",
    prodDate: "",
    startTime: "",
    endTime: "",
    producedQty: null,
    signer: "",
    prodDateNote: "",
    startTimeNote: "",
    endTimeNote: "",
    signerNote: "",
    carryQty: null,
    carryNote: "",
    rowTotalNote: "",
  };
}
export function blankBulkOrder(): BulkOrder {
  return {
    id: "",
    header: {
      date: "",
      docNo: "",
      planTons: null,
      producedTons: 0,
      targetBags: null,
      productionDays: "",
      payDate: "",
    },
    rows: [],
    docSigners: { issuer: "", qc: "", production: "", manager: "" },
    note: "",
    createdAt: "",
    updatedAt: "",
  };
}
export function updateBulkRow(
  doc: BulkOrder,
  id: string,
  patch: Partial<Omit<BulkRow, "id">>,
): BulkOrder {
  // carryQty is a manual note value; unlike the legacy API, never overwrite it from actual output.
  return {
    ...doc,
    rows: doc.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  };
}
export function selectBulkProduct(
  doc: BulkOrder,
  id: string,
  product: BulkProduct,
): BulkOrder {
  return updateBulkRow(doc, id, {
    product: product.name,
    productCode: product.code,
    size: product.size,
    lot: product.formulaVersion,
  });
}
export function removeBulkRow(doc: BulkOrder, id: string): BulkOrder {
  return { ...doc, rows: doc.rows.filter((r) => r.id !== id) };
}
export const remainingQty = (row: BulkRow) =>
  Math.max(0, (row.qty ?? 0) - (row.producedQty ?? 0));
export function bulkSummary(doc: BulkOrder) {
  const bags = doc.rows.filter((r) => r.qtyUnit === "กระสอบ");
  return {
    totalBags: bags.reduce((s, r) => s + (r.qty ?? 0), 0),
    targetBags: doc.header.targetBags ?? 0,
    remainingBags: bags.reduce((s, r) => s + remainingQty(r), 0),
  };
}
export function bulkProgress(
  doc: BulkOrder,
): "รอดำเนินการ" | "กำลังผลิต" | "เสร็จสิ้น" {
  // Legacy history treats a completed date/time/signer report as full output when actual quantity is zero/missing.
  const done = (r: BulkRow) =>
    (r.producedQty ?? 0) > 0
      ? Math.min(r.producedQty!, r.qty ?? 0)
      : r.prodDate && r.startTime && r.endTime && r.signer
        ? (r.qty ?? 0)
        : 0;
  if (!doc.rows.some((r) => done(r) > 0)) return "รอดำเนินการ";
  return doc.rows.every((r) => done(r) >= (r.qty ?? 0))
    ? "เสร็จสิ้น"
    : "กำลังผลิต";
}
export function validBulkDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateBulkOrder(
  doc: BulkOrder,
  records: readonly BulkOrder[],
): BulkErrors {
  const e: BulkErrors = {};
  if (!doc.header.docNo.trim()) e["header.docNo"] = "กรุณากรอกเลขที่เอกสาร";
  else if (
    records.some(
      (r) =>
        r.id !== doc.id &&
        r.header.docNo.trim().toLowerCase() ===
          doc.header.docNo.trim().toLowerCase(),
    )
  )
    e["header.docNo"] = "เลขที่เอกสารซ้ำกับข้อมูลตัวอย่าง";
  if (!validBulkDate(doc.header.date))
    e["header.date"] = "กรุณาระบุวันที่เอกสารที่ถูกต้อง";
  if (doc.header.payDate && !validBulkDate(doc.header.payDate))
    e["header.payDate"] = "วันที่จ่ายไม่ถูกต้อง";
  for (const k of ["planTons", "targetBags"] as const) {
    const n = doc.header[k];
    if (
      n !== null &&
      (!Number.isFinite(n) ||
        n < 0 ||
        (k === "targetBags" && !Number.isInteger(n)))
    )
      e[`header.${k}`] =
        k === "planTons"
          ? "จำนวนตันต้องเป็นตัวเลขไม่ติดลบ"
          : "จำนวนกระสอบต้องเป็นจำนวนเต็มไม่ติดลบ";
  }
  const days = doc.header.productionDays;
  if (
    days.trim() &&
    (!/^\d+$/.test(days) || !Number.isSafeInteger(Number(days)))
  )
    e["header.productionDays"] = "ระยะเวลาต้องเป็นจำนวนเต็มไม่ติดลบ";
  if (!doc.rows.length) e.rows = "กรุณาเพิ่มรายการสั่งผลิตอย่างน้อย 1 รายการ";
  const ids = doc.rows.map((r) => r.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    e.rows = "รหัสรายการซ้ำหรือไม่ถูกต้อง";
  for (const r of doc.rows) {
    const base = `rows.${r.id}`;
    if (!r.product.trim()) e[`${base}.product`] = "กรุณาระบุผลิตปุ๋ย";
    if (!r.lot.trim()) e[`${base}.lot`] = "กรุณากรอก Lot";
    for (const k of ["qty", "size", "producedQty", "carryQty"] as const) {
      const n = r[k];
      const required = k === "qty" || k === "size";
      if (
        (required && n === null) ||
        (n !== null &&
          (!Number.isFinite(n) ||
            (required ? n <= 0 : n < 0) ||
            (k !== "producedQty" && !Number.isInteger(n))))
      )
        e[`${base}.${k}`] = required
          ? "กรุณาระบุจำนวนเต็มมากกว่า 0"
          : "ต้องเป็นตัวเลขไม่ติดลบ";
    }
    if (r.qtyUnit !== "กระสอบ" && r.qtyUnit !== "ตัน")
      e[`${base}.qty`] = "หน่วยเดิมไม่รองรับ กรุณาตรวจสอบรายการ";
    if (r.prodDate && !validBulkDate(r.prodDate))
      e[`${base}.prodDate`] = "วันที่ผลิตไม่ถูกต้อง";
    for (const [key, note] of [
      ["startTime", "startTimeNote"],
      ["endTime", "endTimeNote"],
      ["signer", "signerNote"],
    ] as const) {
      if (r[key].trim() && !r[note].trim())
        e[`${base}.${note}`] = "กรุณากรอกรายละเอียดคู่กับข้อมูลนี้";
      if (r[note].trim() && !r[key].trim())
        e[`${base}.${key}`] = "กรุณากรอกข้อมูลคู่กับรายละเอียด";
      if (
        key !== "signer" &&
        r[key] &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(r[key])
      )
        e[`${base}.${key}`] = "เวลาไม่ถูกต้อง";
    }
  }
  return e;
}
export function saveBulkOrder(
  records: readonly BulkOrder[],
  doc: BulkOrder,
  id: string,
  now: string,
): { records: BulkOrder[]; saved?: BulkOrder; errors: BulkErrors } {
  const errors = validateBulkOrder(doc, records);
  const original = records.find((r) => r.id === doc.id);
  if (doc.id && !original) errors.document = "ไม่พบเอกสารเดิม กรุณาเปิดใหม่";
  if (!doc.id && (!id || records.some((r) => r.id === id)))
    errors.document = "รหัสเอกสารซ้ำหรือไม่ถูกต้อง";
  if (Object.keys(errors).length) return { records: [...records], errors };
  const saved = structuredClone({
    ...doc,
    id: doc.id || id,
    header: {
      ...doc.header,
      docNo: doc.header.docNo.trim(),
      producedTons: doc.header.planTons ?? 0,
    },
    createdAt: original?.createdAt || now,
    updatedAt: now,
  });
  return {
    records: original
      ? records.map((r) => (r.id === saved.id ? saved : r))
      : [saved, ...records],
    saved,
    errors: {},
  };
}
export function deleteBulkOrder(records: readonly BulkOrder[], id: string) {
  return records.filter((r) => r.id !== id);
}
export interface BulkFilters {
  search: string;
  from: string;
  to: string;
}
export function filterBulkOrders(
  records: readonly BulkOrder[],
  filters: BulkFilters,
) {
  const q = filters.search.trim().toLowerCase();
  return records.filter(
    (r) =>
      (!filters.from || r.header.date >= filters.from) &&
      (!filters.to || r.header.date <= filters.to) &&
      (!q ||
        [
          r.header.docNo,
          r.note,
          ...r.rows.flatMap((x) => [x.product, x.productCode, x.lot]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
}
export function bulkPrintPages(rows: readonly BulkRow[]) {
  return Array.from(
    { length: Math.max(1, Math.ceil(rows.length / 7)) },
    (_, i) => rows.slice(i * 7, i * 7 + 7),
  );
}
