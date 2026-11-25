import "server-only";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "../auth/access-repository.ts";
import type { ProductionSnapshot } from "../production-orders-postgres.ts";
import { appendOrderEvent, hubTransaction, type HubOrderRow } from "./repository.ts";
import { HubIntegrationError } from "./errors.ts";

const material = { "รอตรวจสอบวัตถุดิบ": "PENDING", "วัตถุดิบพร้อม": "READY", "วัตถุดิบไม่พร้อม": "NOT_READY" } as const;
const titles: Record<string, string> = {
  FACTORY_ORDER_RECEIVED: "รับคำสั่งจาก Sales Hub",
  MATERIAL_READY: "วัตถุดิบพร้อม",
  MATERIAL_NOT_READY: "วัตถุดิบไม่พร้อม",
  FACTORY_ORDER_APPROVED: "โรงงานอนุมัติ",
  FACTORY_ORDER_REJECTED: "โรงงานปฏิเสธ",
  PRODUCTION_STARTED: "เริ่มผลิต",
  DRIVER_INFORMATION_UPDATED: "อัปเดตข้อมูลคนขับจาก Sales Hub",
};

export async function readHubOrders(): Promise<ProductionSnapshot> {
  const { rows } = await getFactoryDatabasePool().query<HubOrderRow & { events: ProductionSnapshot["history"][string] }>(
    "SELECT o.*, (SELECT jsonb_agg(jsonb_build_object('title',e.envelope->>'event_type','at',e.envelope->>'occurred_at','description',coalesce(e.envelope#>>'{payload,reason}','')) ORDER BY e.sequence DESC) FROM foliar_fertilizer.hub_events e WHERE e.order_id=o.id) AS events FROM foliar_fertilizer.hub_orders o ORDER BY o.updated_at DESC, o.id",
  );
  return {
    orders: rows.map(row => row.document),
    versions: Object.fromEntries(rows.map(row => [row.id, `hub:${row.document.updated}`])),
    history: Object.fromEntries(rows.map(row => [row.id, (row.events ?? []).map(event => ({ ...event, title: titles[event.title] ?? event.title }))])),
  };
}

export async function changeHubProduction(input: unknown, actor: string, connect?: () => Promise<PoolClient>) {
  const invalid = (message: string): never => { throw new HubIntegrationError("INVALID_TRANSITION", message, 422); };
  if (!input || typeof input !== "object") return invalid("ข้อมูลการเปลี่ยนสถานะไม่ถูกต้อง");
  const { id, expectedVersion, status, reason: rawReason } = input as Record<string, unknown>;
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return invalid("รหัสคำสั่งผลิตไม่ถูกต้อง");
  const reason = typeof rawReason === "string" ? rawReason.trim() || null : null;
  if (reason && reason.length > 1000) return invalid("เหตุผลต้องไม่เกิน 1,000 ตัวอักษร");
  return hubTransaction(async client => {
    const { rows: [row] } = await client.query<HubOrderRow>("SELECT * FROM foliar_fertilizer.hub_orders WHERE id=$1 FOR UPDATE", [id]);
    if (!row) throw new HubIntegrationError("NOT_FOUND", "ไม่พบคำสั่งผลิต", 404);
    const document = row.document;
    if (expectedVersion !== `hub:${document.updated}`) throw new HubIntegrationError("CONFLICT", "เอกสารเปลี่ยนแล้ว กรุณารีเฟรชก่อนบันทึก", 409);
    if (document.production !== "ยังไม่เริ่มผลิต" || document.approval === "โรงงานปฏิเสธ") return invalid("สถานะคำสั่งผลิตไม่อนุญาตให้ดำเนินการ");
    const at = new Date(Math.max(Date.now(), Date.parse(document.updated) + 1)).toISOString();
    let type: string;
    let payload: object;
    if (status === "วัตถุดิบพร้อม" || status === "วัตถุดิบไม่พร้อม") {
      if (document.approval !== "รอการอนุมัติจากโรงงาน" || document.material === status || (status === "วัตถุดิบไม่พร้อม" && !reason)) return invalid("ตรวจสถานะวัตถุดิบและระบุเหตุผลเมื่อวัตถุดิบไม่พร้อม");
      type = status === "วัตถุดิบพร้อม" ? "MATERIAL_READY" : "MATERIAL_NOT_READY";
      payload = { previousMaterialStatus: material[document.material], materialStatus: material[status], reason, changedAt: at };
      document.material = status;
    } else if (status === "โรงงานอนุมัติ" || status === "โรงงานปฏิเสธ") {
      if (document.approval !== "รอการอนุมัติจากโรงงาน" || (status === "โรงงานอนุมัติ" && document.material !== "วัตถุดิบพร้อม") || (status === "โรงงานปฏิเสธ" && !reason)) return invalid("ตรวจความพร้อมของวัตถุดิบหรือระบุเหตุผลการปฏิเสธ");
      type = status === "โรงงานอนุมัติ" ? "FACTORY_ORDER_APPROVED" : "FACTORY_ORDER_REJECTED";
      payload = { previousFactoryDecisionStatus: "PENDING_APPROVAL", factoryDecisionStatus: status === "โรงงานอนุมัติ" ? "APPROVED" : "REJECTED", reason, decidedAt: at };
      document.approval = status;
    } else if (status === "กำลังผลิต") {
      if (document.approval !== "โรงงานอนุมัติ" || document.material !== "วัตถุดิบพร้อม") return invalid("ต้องอนุมัติและยืนยันวัตถุดิบพร้อมก่อนเริ่มผลิต");
      type = "PRODUCTION_STARTED";
      payload = { previousProductionStatus: "NOT_STARTED", productionStatus: "IN_PRODUCTION", decidedAt: at };
      document.production = status;
    } else return invalid("เลือกสถานะการผลิตที่รองรับ");
    document.updated = at;
    await client.query("UPDATE foliar_fertilizer.hub_orders SET document=$2,updated_at=$3 WHERE id=$1", [id, JSON.stringify(document), at]);
    await appendOrderEvent(client, row.command, id, type, at, actor, "USER", payload);
    return document;
  }, connect);
}
