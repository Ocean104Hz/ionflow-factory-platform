export const poStatuses = {
  draft: "ร่าง", pending_approval: "รออนุมัติ", approved: "อนุมัติแล้ว",
  partial_received: "รับเข้าแล้ว", received: "รับเข้าแล้ว", rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก", closed: "ปิดเอกสาร",
} as const;
export type PoStatus = keyof typeof poStatuses;
export type PoAction = "submit" | "approve" | "reject" | "return_draft" | "cancel" | "close" | "delete";
export type PoItem = {
  id: string; raw_material_id: string; material_code_snapshot: string; material_name_snapshot: string;
  specification: string; ordered_qty: string; received_qty: string; unit: string;
  unit_price: string; discount_amount: string; tax_amount: string;
  expected_delivery_date: string; remarks: string;
};
export type PurchaseOrder = {
  id: string; po_no: string; po_date: string; supplier_id: string; supplier_code_snapshot: string;
  supplier_name_snapshot: string; warehouse_code: string; warehouse_name: string;
  currency_code: string; vat_type: "NON_VAT" | "VAT_EXCLUDED" | "VAT_INCLUDED";
  payment_term: string; credit_days: string; expected_delivery_date: string;
  request_ref_id: string; request_ref_no: string; remarks: string; status: PoStatus;
  items: PoItem[]; created_at: string; updated_at: string;
};
export type PoErrors = Record<string, string>;
export type MasterOption = { id: string; code: string; name: string; unit?: string; price?: string; specification?: string; contact_name?: string; phone?: string; address?: string; site_name?: string; note?: string };
export const demoSuppliers: MasterOption[] = [
  { id: "demo-supplier-a", code: "DEMO-SUP-01", name: "บริษัท ผู้ขายตัวอย่าง เอ จำกัด" },
  { id: "demo-supplier-b", code: "DEMO-SUP-02", name: "บริษัท ผู้ขายตัวอย่าง บี จำกัด" },
];
export const demoWarehouses: MasterOption[] = [
  { id: "demo-wh-a", code: "DEMO-WH-01", name: "คลังวัตถุดิบตัวอย่าง 1" },
  { id: "demo-wh-b", code: "DEMO-WH-02", name: "คลังบรรจุภัณฑ์ตัวอย่าง 2" },
];
export const demoMaterials: MasterOption[] = [
  { id: "demo-rm-a", code: "DEMO-RM-01", name: "วัตถุดิบปุ๋ยตัวอย่าง A", unit: "กก.", price: "12.50", specification: "เกรดตัวอย่าง A" },
  { id: "demo-rm-b", code: "DEMO-RM-02", name: "กระสอบตัวอย่าง B", unit: "ใบ", price: "8.00", specification: "ขนาดตัวอย่าง 50 กก." },
];
export function blankItem(id: string): PoItem {
  return { id, raw_material_id: "", material_code_snapshot: "", material_name_snapshot: "", specification: "", ordered_qty: "", received_qty: "0", unit: "", unit_price: "", discount_amount: "", tax_amount: "", expected_delivery_date: "", remarks: "" };
}
export function blankPo(date = ""): PurchaseOrder {
  return { id: "", po_no: "", po_date: date, supplier_id: "", supplier_code_snapshot: "", supplier_name_snapshot: "", warehouse_code: "", warehouse_name: "", currency_code: "THB", vat_type: "NON_VAT", payment_term: "", credit_days: "", expected_delivery_date: "", request_ref_id: "", request_ref_no: "", remarks: "", status: "draft", items: [], created_at: "", updated_at: "" };
}
export function validDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
}
// Exact two-decimal UI arithmetic. VAT classification never invents an automatic tax rate.
export function decimalCents(value: string): bigint | null {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2,"0"));
}
export function lineAmount(item: PoItem): bigint {
  const qty = decimalCents(item.ordered_qty) ?? BigInt(0), price = decimalCents(item.unit_price) ?? BigInt(0);
  const gross = (qty * price + BigInt(50)) / BigInt(100);
  const net = gross - (decimalCents(item.discount_amount) ?? BigInt(0));
  return net > BigInt(0) ? net : BigInt(0);
}
export function poTotals(doc: PurchaseOrder) {
  const subtotal = doc.items.reduce((sum,row) => sum + lineAmount(row), BigInt(0));
  const tax = doc.items.reduce((sum,row) => sum + (decimalCents(row.tax_amount) ?? BigInt(0)), BigInt(0));
  return { subtotal, tax, total: subtotal + tax };
}
export function money(cents: bigint) {
  return `${(cents / BigInt(100)).toLocaleString("th-TH")}.${(cents % BigInt(100)).toString().padStart(2,"0")}`;
}
export function validatePo(doc: PurchaseOrder, records: readonly PurchaseOrder[]): PoErrors {
  const errors: PoErrors = {};
  for (const [key,label] of [["po_no","เลขที่ PO"],["supplier_name_snapshot","ชื่อผู้ขาย"],["warehouse_name","คลังรับเข้า"]] as const)
    if (!doc[key].trim()) errors[key] = `กรุณาระบุ${label}`;
  if (records.some((r) => r.id !== doc.id && r.po_no.trim().toLowerCase() === doc.po_no.trim().toLowerCase())) errors.po_no = "เลขที่ PO ซ้ำกับเอกสารตัวอย่างที่บันทึกแล้ว";
  if (!validDay(doc.po_date)) errors.po_date = "กรุณาระบุวันที่เอกสารที่ถูกต้อง";
  if (doc.expected_delivery_date && !validDay(doc.expected_delivery_date)) errors.expected_delivery_date = "วันที่ส่งมอบไม่ถูกต้อง";
  if (doc.credit_days && (!/^\d{1,5}$/.test(doc.credit_days))) errors.credit_days = "เครดิตวันต้องเป็นจำนวนเต็มไม่ติดลบ";
  if (!doc.items.length) errors.items = "เพิ่มรายการสินค้าอย่างน้อย 1 รายการ";
  const ids = doc.items.map((r) => r.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) errors.items = "รหัสแถวซ้ำหรือไม่ถูกต้อง";
  for (const row of doc.items) {
    const base = `items.${row.id}`;
    if (!row.material_code_snapshot.trim()) errors[`${base}.material_code_snapshot`] = "กรุณาระบุรหัสสินค้า";
    if (!row.material_name_snapshot.trim()) errors[`${base}.material_name_snapshot`] = "กรุณาระบุชื่อสินค้า";
    if (!row.unit.trim()) errors[`${base}.unit`] = "กรุณาระบุหน่วย";
    for (const key of ["ordered_qty","unit_price"] as const)
      if ((decimalCents(row[key]) ?? BigInt(0)) <= BigInt(0)) errors[`${base}.${key}`] = "ต้องมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง";
    for (const key of ["tax_amount","discount_amount"] as const)
      if (row[key] && decimalCents(row[key]) === null) errors[`${base}.${key}`] = "ต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง";
    if (row.expected_delivery_date && !validDay(row.expected_delivery_date)) errors[`${base}.expected_delivery_date`] = "วันที่จัดส่งไม่ถูกต้อง";
  }
  return errors;
}
export function savePo(records: readonly PurchaseOrder[], doc: PurchaseOrder, id: string, at: string, submit = false) {
  const errors = validatePo(doc, records), old = records.find((r) => r.id === doc.id);
  if (doc.id && !old) errors.document = "ไม่พบเอกสารเดิม";
  if (old && !["draft","rejected"].includes(old.status)) errors.document = "สถานะนี้แก้ไขไม่ได้";
  if (!doc.id && (!id || records.some((r) => r.id === id))) errors.document = "รหัสเอกสารซ้ำ";
  if (Object.keys(errors).length) return { records: [...records], errors, saved: null };
  const saved: PurchaseOrder = structuredClone({ ...doc, id: old?.id ?? id, po_no: doc.po_no.trim(), status: submit ? "pending_approval" : old?.status ?? "draft", created_at: old?.created_at ?? at, updated_at: at });
  return { records: old ? records.map((r) => r.id === saved.id ? saved : r) : [saved,...records], errors: {}, saved };
}
export const allowedActions = (status: PoStatus): PoAction[] => ({
  draft: ["submit","cancel"], pending_approval: ["approve","reject","return_draft","cancel"],
  approved: ["cancel"], partial_received: [], received: ["close"], rejected: ["submit","cancel"],
  cancelled: ["delete"], closed: [],
})[status] as PoAction[];
export function transitionPo(records: readonly PurchaseOrder[], ids: readonly string[], action: PoAction, at: string): PurchaseOrder[] {
  const selected = records.filter((r) => ids.includes(r.id));
  if (!selected.length || selected.length !== new Set(ids).size || selected.some((r) => !allowedActions(r.status).includes(action))) throw Error("เอกสารที่เลือกบางรายการไม่รองรับการกระทำนี้");
  if (action === "submit" && selected.some((r) => Object.keys(validatePo(r,records)).length)) throw Error("เอกสารยังมีข้อมูลที่ไม่ถูกต้อง กรุณาแก้ไขก่อนส่งอนุมัติตัวอย่าง");
  if (action === "delete") return records.filter((r) => !ids.includes(r.id));
  const status: PoStatus = ({ submit: "pending_approval", approve: "approved", reject: "rejected", return_draft: "draft", cancel: "cancelled", close: "closed" } as const)[action];
  return records.map((r) => ids.includes(r.id) ? { ...r, status, updated_at: at } : r);
}
export function previewPoNo(date: string, department: string, records: readonly PurchaseOrder[]) {
  if (!validDay(date) || !/^[A-Z0-9]{2}$/.test(department)) throw Error("ระบุวันที่และรหัสแผนก 2 ตัวให้ถูกต้อง");
  const prefix = `PO-${department}${date.slice(2,4)}${date.slice(5,7)}`;
  let sequence = 1;
  while (records.some((r) => r.po_no.toUpperCase() === `${prefix}${String(sequence).padStart(3,"0")}`)) sequence++;
  return `${prefix}${String(sequence).padStart(3,"0")}`;
}
export function withMaterial(row: PoItem, material: MasterOption): PoItem {
  return { ...row, raw_material_id: material.id, material_code_snapshot: material.code, material_name_snapshot: material.name, specification: material.specification ?? "", unit: material.unit ?? "", unit_price: material.price ?? row.unit_price };
}
export const demoPr = { id: "demo-pr-1", number: "PR-DEMO-001", supplier: demoSuppliers[0], warehouse: demoWarehouses[0], quantity: "100.00", date: "2026-11-05" };
export function withPr(doc: PurchaseOrder, rowId: string): PurchaseOrder {
  return { ...doc, request_ref_id: demoPr.id, request_ref_no: demoPr.number, supplier_id: demoPr.supplier.id, supplier_code_snapshot: demoPr.supplier.code, supplier_name_snapshot: demoPr.supplier.name, warehouse_code: demoPr.warehouse.code, warehouse_name: demoPr.warehouse.name, expected_delivery_date: demoPr.date, items: [{ ...withMaterial(blankItem(rowId),demoMaterials[0]), ordered_qty: demoPr.quantity, expected_delivery_date: demoPr.date }] };
}
export function demoPurchaseOrders(): PurchaseOrder[] {
  const statuses: PoStatus[] = ["draft","pending_approval","approved","partial_received","received","rejected","cancelled","closed"];
  return statuses.map((status,index) => ({
    ...withPr(blankPo(`2026-10-${String(index+10).padStart(2,"0")}`),`demo-po-row-${index}`),
    id: `demo-po-${index}`, po_no: `PO-DEMO-${String(index+1).padStart(3,"0")}`, status,
    remarks: "ข้อมูลสมมติสำหรับทดสอบ UI เท่านั้น", payment_term: "เครดิตตัวอย่าง 30 วัน", credit_days: "30",
    items: [{ ...withMaterial(blankItem(`demo-po-row-${index}`),demoMaterials[index%2]), ordered_qty: "100.00", received_qty: status === "partial_received" ? "40.00" : status === "received" || status === "closed" ? "100.00" : "0", tax_amount: "0", remarks: "รายการตัวอย่าง" }],
    created_at: "2026-10-10T03:00:00.000Z", updated_at: "2026-10-10T03:00:00.000Z",
  }));
}
