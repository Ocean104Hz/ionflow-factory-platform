import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "../auth/access-repository.ts";
import { type HubOrderRow, enqueueHubEvent, hubTransaction } from "./repository.ts";
import { HubIntegrationError } from "./errors.ts";

export type DocumentKind = "DELIVERY_ORDER" | "INVOICE";
const conflict = (message: string) => new HubIntegrationError("DOCUMENT_CONFLICT", message, 409);
export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const scaled = (decimal: string) => {
  const [whole, fraction] = decimal.split(".");
  return BigInt(whole) * BigInt(10000) + BigInt((fraction ?? "0").padEnd(4, "0"));
};
const money = (value: bigint) => {
  if (value >= BigInt(10) ** BigInt(18)) throw conflict("ยอดเงินเกินขนาดที่ Sales Hub รองรับ");
  return `${value / BigInt(10000)}.${String(value % BigInt(10000)).padStart(4, "0")}`;
};

export async function listHubPrices() {
  const { rows } = await getFactoryDatabasePool().query<{
    company_id: string; hub_product_id: string; company_code: string; name: string; sku: string; unit_name: string; unit_price: string | null;
  }>(`SELECT p.company_id,p.hub_product_id,p.payload->>'sourceCompanyCode' AS company_code,p.payload->>'productName' AS name,p.payload->>'productCode' AS sku,
    p.payload->>'baseUnit' AS unit_name,
    CASE WHEN r.unit_name=p.payload->>'baseUnit' THEN r.unit_price::text END AS unit_price
    FROM foliar_fertilizer.hub_products p LEFT JOIN foliar_fertilizer.hub_product_prices r USING (company_id, hub_product_id)
    WHERE p.payload->>'hubStatus'='ACTIVE' ORDER BY sku, p.company_id`);
  return rows;
}

export async function saveHubPrice(input: unknown, actor: string, connect?: () => Promise<PoolClient>) {
  const { companyId, productId, price, unit } = (input ?? {}) as Record<string, unknown>;
  if (!isUuid(companyId) || !isUuid(productId) || typeof price !== "string" || !/^\d{1,12}(?:\.\d{1,4})?$/.test(price) || scaled(price) <= BigInt(0) || typeof unit !== "string" || !unit) {
    throw new HubIntegrationError("INVALID_PRICE", "ระบุราคามากกว่า 0 พร้อมหน่วยสินค้า ทศนิยมสูงสุด 4 ตำแหน่ง", 422);
  }
  return hubTransaction(async client => {
    const result = await client.query(`INSERT INTO foliar_fertilizer.hub_product_prices (company_id,hub_product_id,unit_price,unit_name,updated_by)
      SELECT company_id,hub_product_id,$3,$4,$5 FROM foliar_fertilizer.hub_products
      WHERE company_id=$1 AND hub_product_id=$2 AND payload->>'hubStatus'='ACTIVE' AND payload->>'baseUnit'=$4
      ON CONFLICT (company_id,hub_product_id) DO UPDATE
      SET unit_price=EXCLUDED.unit_price, unit_name=EXCLUDED.unit_name, updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [companyId, productId, price, unit, actor]);
    if (!result.rowCount) throw conflict("สินค้าไม่พร้อมใช้งานหรือหน่วยสินค้าเปลี่ยนแล้ว");
  }, connect);
}

export async function listHubDocuments(kind: DocumentKind) {
  const db = getFactoryDatabasePool();
  const { rows } = await db.query<{
    order_id: string; order_number: string; company: string; customer: string; document_id: string | null;
    number: string | null; status: string | null; created_at: Date | null; payload: Record<string, unknown> | null; sync_state: string | null;
  }>(`SELECT o.id AS order_id,o.document->>'number' AS order_number,o.document->>'company' AS company,
      o.document->>'customer' AS customer,d.id AS document_id,d.number,d.status,d.created_at,d.payload,
      (SELECT state FROM foliar_fertilizer.hub_events WHERE envelope->>'aggregate_id'=d.id::text
        AND order_id=o.id ORDER BY sequence DESC LIMIT 1) AS sync_state
    FROM foliar_fertilizer.hub_orders o LEFT JOIN foliar_fertilizer.hub_documents d ON d.order_id=o.id AND d.kind=$1
    WHERE d.id IS NOT NULL OR ($1='DELIVERY_ORDER' AND o.document->>'production'='กำลังผลิต')
      OR ($1='INVOICE' AND o.document->>'production'='ผลิตเสร็จแล้ว')
    ORDER BY coalesce(d.created_at,o.updated_at) DESC, o.id`, [kind]);
  return rows;
}

export async function createHubDocument(kind: DocumentKind, orderId: unknown, email: string, connect?: () => Promise<PoolClient>) {
  if (!isUuid(orderId)) throw new HubIntegrationError("INVALID_ORDER_ID", "เลือกคำสั่งผลิต", 422);
  const actor = email.trim().toLowerCase();
  return hubTransaction(async client => {
    const { rows: [order] } = await client.query<HubOrderRow>("SELECT * FROM foliar_fertilizer.hub_orders WHERE id=$1 FOR UPDATE", [orderId]);
    if (!order) throw new HubIntegrationError("NOT_FOUND", "ไม่พบคำสั่งผลิต", 404);
    const { rows: [previous] } = await client.query<{ id: string; number: string }>(
      "SELECT id,number FROM foliar_fertilizer.hub_documents WHERE kind=$1 AND order_id=$2", [kind, orderId],
    );
    if (previous) return previous;
    const delivery = kind === "DELIVERY_ORDER";
    if (order.document.production !== (delivery ? "กำลังผลิต" : "ผลิตเสร็จแล้ว")) {
      throw conflict(delivery ? "ต้องเริ่มผลิตก่อนสร้างใบส่งสินค้า" : "ต้องบันทึกผลผลิตและสร้างใบส่งสินค้าก่อนออกใบแจ้งหนี้");
    }
    const id = randomUUID();
    const at = new Date().toISOString();
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
    const period = date.slice(5, 7) + date.slice(2, 4);
    const { rows: [{ counter }] } = await client.query<{ counter: number }>(
      "SELECT coalesce(max(counter),0)+1 AS counter FROM foliar_fertilizer.hub_documents WHERE kind=$1 AND period=$2",
      [kind, period],
    );
    if (counter > 9999) throw conflict("เลขเอกสารเต็มสำหรับเดือนนี้");
    const number = `${delivery ? "DO" : "INV"}-W1-FF${period}${String(counter).padStart(4, "0")}`;
    const parent = { hubOrderId: order.hub_order_id };
    let payload: Record<string, unknown>;
    if (delivery) {
      payload = { iconDeliveryOrderId: id, deliveryOrderNumber: number, status: "DRAFT",
        productionOrder: { ...parent, iconFactoryOrderId: orderId, productionStatus: "COMPLETED", completedAt: at },
        purpose: "INITIAL", reason: null, replacesDeliveryOrderId: null, createdAt: at };
      const document = { ...order.document, production: "ผลิตเสร็จแล้ว", updated: at };
      await client.query("UPDATE foliar_fertilizer.hub_orders SET document=$2, updated_at=$3 WHERE id=$1", [orderId, JSON.stringify(document), at]);
    } else {
      const productIds = order.command.payload.items.map(item => item.hubProductId).filter(isUuid);
      const { rows: prices } = await client.query<{ hub_product_id: string; unit_price: string; unit_name: string }>(
        "SELECT hub_product_id, unit_price::text, unit_name FROM foliar_fertilizer.hub_product_prices WHERE company_id=$1 AND hub_product_id=ANY($2::uuid[])",
        [order.company_id, productIds],
      );
      const index = new Map(prices.map(price => [price.hub_product_id, price]));
      let subtotal = BigInt(0);
      const items = order.command.payload.items.map(item => {
        const price = item.hubProductId ? index.get(item.hubProductId) : undefined;
        if (!price || price.unit_name !== item.unitName) throw conflict(`ยังไม่มีราคากลาง W1-FF ตรงหน่วยสำหรับ ${item.sku ?? item.productName}`);
        const quantity = item.quantity.toFixed(4);
        const amount = (scaled(quantity) * scaled(price.unit_price) + BigInt(5000)) / BigInt(10000);
        subtotal += amount;
        return { id: randomUUID(), factoryOrderItemId: item.hubOrderLineId, productCodeSnapshot: item.sku,
          productNameSnapshot: item.productName, productTypeSnapshot: item.productType, quantity, quantityUom: item.unitName,
          unitPriceSnapshot: price.unit_price, lineAmount: money(amount), discountAmount: "0.0000", netAmount: money(amount) };
      });
      payload = { foliarInvoiceId: id, invoiceNumber: number, invoiceDate: date, status: "ISSUED",
        productionOrder: { ...parent, foliarFactoryOrderId: orderId }, items, subtotal: money(subtotal),
        discountAmount: "0.0000", taxAmount: "0.0000", grandTotal: money(subtotal) };
    }
    await client.query(`INSERT INTO foliar_fertilizer.hub_documents (id,order_id,kind,number,period,counter,payload,created_at,created_by,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [id, orderId, kind, number, period, counter, JSON.stringify(payload), at, actor, delivery ? "DRAFT" : "ISSUED"]);
    await enqueueHubEvent(client, orderId, {
      event_id: randomUUID(), event_type: delivery ? "DELIVERY_ORDER_CREATED" : "INVOICE_ISSUED",
      event_version: 2, occurred_at: at, recorded_at: at, aggregate_type: kind, aggregate_id: id, aggregate_version: 1,
      hub_order_id: order.hub_order_id, factory_order_id: orderId, ...(delivery ? { delivery_order_id: id } : { invoice_id: id }),
      route_id: order.route_id, factory_code: "W1-FF", source: "foliar", actor_type: "USER", actor_id: actor,
      correlation_id: order.command.correlationId, causation_id: null, payload,
    });
    return { id, number };
  }, connect);
}

export async function readHubDocument(kind: DocumentKind, id: string) {
  if (!isUuid(id)) return null;
  const { rows: [row] } = await getFactoryDatabasePool().query<{
    status: string; number: string; order_id: string; company: string; customer: string;
    order_number: string; payload: Record<string, unknown>; items: HubOrderRow["document"]["items"];
  }>(`SELECT d.number,d.status,d.order_id,d.payload,
    o.document->>'number' AS order_number,o.document->>'company' AS company,
    o.document->>'customer' AS customer,o.document->'items' AS items
    FROM foliar_fertilizer.hub_documents d JOIN foliar_fertilizer.hub_orders o ON o.id=d.order_id
    WHERE d.id=$1 AND d.kind=$2`, [id, kind]);
  return row ?? null;
}
