import type { ProductionOrder } from "../../lib/mock-data/index.ts";
import { materialStatuses, approvalStatuses, productionStatuses } from "../../lib/constants/status.ts";

export class ProductionOrderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
const fail = (message = "ข้อมูลคำสั่งการผลิตไม่ถูกต้อง"): never => { throw new ProductionOrderError(400, message); };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
};
const text = (value: unknown, required = false): string => {
  if (typeof value !== "string" || value.length > 10000 || (required && !value.trim())) return fail();
  return value;
};
const day = (value: unknown) => {
  const v = text(value, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) return fail("วันที่ไม่ถูกต้อง");
  return v;
};
const timestamp = (value: unknown) => {
  const v = text(value, true);
  day(v.slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(v) || !Number.isFinite(Date.parse(v))) return fail("วันเวลาต้องระบุ timezone ให้ถูกต้อง");
  return v;
};
export function parseProductionOrder(value: unknown): ProductionOrder {
  const v = record(value);
  const stringFields = ["id", "number", "salesOrder", "company", "customer", "customerCode", "warehouse", "note"] as const;
  const fields = Object.fromEntries(stringFields.map((key) => [key, text(v[key], ["id", "number", "company", "customer"].includes(key))])) as Pick<ProductionOrder, typeof stringFields[number]>;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(fields.id) || fields.number.length > 100 || fields.company.length > 200) return fail();
  if (v.source !== "Sales Hub" && v.source !== "Datalink") return fail("ต้นทางไม่ถูกต้อง");
  if (v.document !== "รับข้อมูลแล้ว" && v.document !== "ยกเลิกแล้ว") return fail("สถานะเอกสารไม่ถูกต้อง");
  if (!materialStatuses.includes(v.material as ProductionOrder["material"]) || !approvalStatuses.includes(v.approval as ProductionOrder["approval"]) || !productionStatuses.includes(v.production as ProductionOrder["production"])) return fail("สถานะไม่ถูกต้อง");
  if (!Number.isSafeInteger(v.revision) || Number(v.revision) < 1 || !Array.isArray(v.items) || !v.items.length || v.items.length > 200) return fail("Revision หรือรายการสินค้าไม่ถูกต้อง");
  const items = v.items.map((input) => {
    const row = record(input);
    if (typeof row.quantity !== "number" || !Number.isFinite(row.quantity) || row.quantity <= 0 || typeof row.price !== "number" || !Number.isFinite(row.price) || row.price < 0) return fail("จำนวนต้องมากกว่า 0 และราคาไม่ติดลบ");
    return { sku: text(row.sku, true), name: text(row.name, true), type: text(row.type), quantity: row.quantity, unit: text(row.unit, true), price: row.price, note: text(row.note) };
  });
  const proposal = v.proposal === null ? null : (() => {
    const p = record(v.proposal);
    const result = { completion: day(p.completion), pickup: timestamp(p.pickup), reason: text(p.reason, true), at: timestamp(p.at) };
    if (result.pickup.slice(0, 10) < result.completion) return fail("วันรับสินค้าต้องไม่ก่อนวันผลิตเสร็จ");
    return result;
  })();
  const cancellation = v.cancellation === null ? null : (() => {
    const c = record(v.cancellation);
    if (!["รอพิจารณา", "ยกเลิกแล้ว", "โรงงานปฏิเสธ"].includes(text(c.status))) return fail("สถานะคำขอยกเลิกไม่ถูกต้อง");
    return { reason: text(c.reason, true), requester: text(c.requester, true), at: timestamp(c.at), status: text(c.status), decision: text(c.decision), by: text(c.by), decidedAt: c.decidedAt === "" ? "" : timestamp(c.decidedAt) };
  })();
  const date = day(v.date), requestedDate = day(v.requestedDate), pickup = timestamp(v.pickup);
  if (pickup.slice(0, 10) < requestedDate) return fail("วันรับสินค้าต้องไม่ก่อนกำหนดผลิต");
  return { ...fields, source: v.source, document: v.document, material: v.material as ProductionOrder["material"], approval: v.approval as ProductionOrder["approval"], production: v.production as ProductionOrder["production"], date, requestedDate, pickup, received: timestamp(v.received), updated: timestamp(v.updated), revision: v.revision as number, items, proposal, cancellation };
}
export function validateProductionUpdate(previous: ProductionOrder | undefined, next: ProductionOrder): void {
  if (!previous) {
    if (next.document !== "รับข้อมูลแล้ว" || next.production !== "ยังไม่เริ่มผลิต" || next.approval !== "รอการอนุมัติจากโรงงาน" || next.material !== "รอตรวจสอบวัตถุดิบ" || next.cancellation || next.proposal) fail("เอกสารใหม่ต้องเริ่มจากสถานะรอตรวจสอบ");
    return;
  }
  for (const key of ["id", "source", "number", "company", "salesOrder", "customerCode", "received"] as const)
    if (previous[key] !== next[key]) fail("เปลี่ยน identity หรืออ้างอิงต้นทางเดิมไม่ได้");
  if (next.revision !== previous.revision) fail("Revision ต้นทางเปลี่ยนได้ผ่าน integration ที่อนุมัติเท่านั้น");
  if (!previous.cancellation && next.cancellation) fail("สร้างคำขอยกเลิกแทนต้นทางไม่ได้");
  if (previous.cancellation) {
    const old = previous.cancellation, current = next.cancellation;
    if (!current) return fail("ลบคำขอยกเลิกเดิมไม่ได้");
    if ((["reason", "requester", "at"] as const).some((key) => old[key] !== current[key])) fail("เปลี่ยนข้อมูลคำขอยกเลิกเดิมไม่ได้");
    if (old.status !== current.status && (old.status !== "รอพิจารณา" || !current.decision || current.by !== "LOCAL_DEVELOPMENT" || !current.decidedAt)) fail("ผลพิจารณาคำขอยกเลิกไม่ถูกต้อง");
  }
  if (previous.document === "ยกเลิกแล้ว" && JSON.stringify({ ...previous, updated: next.updated }) !== JSON.stringify(next)) fail("เอกสารยกเลิกแล้วแก้ไขไม่ได้");
  if (previous.production !== "ยังไม่เริ่มผลิต" && (previous.material !== next.material || previous.approval !== next.approval || JSON.stringify(previous.items) !== JSON.stringify(next.items))) fail("เริ่มผลิตแล้วแก้วัตถุดิบ การอนุมัติ หรือรายการไม่ได้");
  if (previous.approval !== next.approval && (previous.approval !== "รอการอนุมัติจากโรงงาน" || (next.approval === "โรงงานอนุมัติ" && next.material !== "วัตถุดิบพร้อม"))) fail("เงื่อนไขอนุมัติไม่ถูกต้อง");
  if (previous.production !== next.production) {
    const from = productionStatuses.indexOf(previous.production), to = productionStatuses.indexOf(next.production);
    if (to !== from + 1 || next.approval !== "โรงงานอนุมัติ" || next.material !== "วัตถุดิบพร้อม") fail("ลำดับการผลิตหรือเงื่อนไขเริ่มผลิตไม่ถูกต้อง");
  }
  if (next.document === "ยกเลิกแล้ว" && (previous.cancellation?.status !== "รอพิจารณา" || next.cancellation?.status !== "ยกเลิกแล้ว" || !next.cancellation.decision || !next.cancellation.by || !next.cancellation.decidedAt)) fail("ต้องมีคำขอยกเลิกและผลพิจารณาที่ครบก่อน");
}
