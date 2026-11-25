import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "../auth/access-repository.ts";
import { hubHash, type HubProductionOrderCommand, type parseHubProduct } from "./contract.ts";
import { HubIntegrationError } from "./errors.ts";
import type { ProductionOrder } from "../../lib/mock-data/index.ts";

export type HubOrderRow = {
  id: string;
  hub_order_id: string;
  route_id: string;
  company_id: string;
  revision: number;
  command: HubProductionOrderCommand;
  document: ProductionOrder;
  received_at: Date;
  updated_at: Date;
};

export async function hubTransaction<T>(work: (client: PoolClient) => Promise<T>, connect = () => getFactoryDatabasePool().connect()) {
  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261128, 1)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}

const conflict = (message: string): never => { throw new HubIntegrationError("CONFLICT", message, 409); };

export async function enqueueHubEvent(client: PoolClient, orderId: string, event: { event_id: string } & Record<string, unknown>) {
  await client.query(`INSERT INTO foliar_fertilizer.hub_events (id,order_id,sequence,envelope)
    SELECT $1,$2,coalesce(max(sequence),0)+1,$3 FROM foliar_fertilizer.hub_events WHERE order_id=$2`,
  [event.event_id, orderId, JSON.stringify(event)]);
}

export async function appendOrderEvent(client: PoolClient, command: HubProductionOrderCommand, orderId: string,
  type: string, at: string, actor: string, actorType: "USER" | "SERVICE", payload: object, causationId: string | null = null) {
  const { rows: [order] } = await client.query<{ event_sequence: number }>(
    "UPDATE foliar_fertilizer.hub_orders SET event_sequence=event_sequence+1 WHERE id=$1 RETURNING event_sequence", [orderId],
  );
  const id = randomUUID();
  const event = {
    event_id: id, event_type: type, event_version: 1, occurred_at: at, recorded_at: at,
    aggregate_type: "FACTORY_ORDER", aggregate_id: orderId, aggregate_version: order.event_sequence,
    hub_order_id: command.order.hubOrderId, factory_order_id: orderId, factory_order_item_id: null,
    route_id: command.routeId, factory_code: "W1-FF", source: "foliar", actor_type: actorType, actor_id: actor.toLowerCase(),
    correlation_id: command.correlationId, causation_id: causationId, payload,
  };
  await enqueueHubEvent(client, orderId, event);
}

type Product = ReturnType<typeof parseHubProduct>;
export async function saveHubProduct(input: Product, connect?: () => Promise<PoolClient>) {
  return hubTransaction(async (client) => {
    const { rows: [prior] } = await client.query<{ version: number; payload: Product }>(
      "SELECT version,payload FROM foliar_fertilizer.hub_products WHERE company_id=$1 AND hub_product_id=$2",
      [input.sourceCompanyId, input.hubProductId],
    );
    let status = prior ? "UPDATED" : "CREATED";
    if (prior && prior.payload.sourceFactoryId !== input.sourceFactoryId) conflict("Product factory identity cannot change");
    if (prior && prior.version > input.hubRecordVersion)
      return { status: "STALE", hubProductId: input.hubProductId, hubRecordVersion: prior.version };
    if (prior?.version === input.hubRecordVersion) {
      if (hubHash(prior.payload) !== hubHash(input)) conflict("Product changed without a new revision");
      status = "IDEMPOTENT";
    } else {
      await client.query(
        `INSERT INTO foliar_fertilizer.hub_products (company_id,hub_product_id,version,payload)
         VALUES ($1,$2,$3,$4) ON CONFLICT (company_id,hub_product_id)
         DO UPDATE SET version=EXCLUDED.version,payload=EXCLUDED.payload`,
        [input.sourceCompanyId, input.hubProductId, input.hubRecordVersion, JSON.stringify(input)],
      );
    }
    return { status, hubProductId: input.hubProductId, hubRecordVersion: input.hubRecordVersion };
  }, connect);
}

function projectOrder(command: HubProductionOrderCommand, id: string, at: string): ProductionOrder {
  const { payload: p } = command;
  return {
    id, number: command.order.hubOrderNumber, salesOrder: command.order.hubOrderNumber,
    company: command.sourceCompany.nameSnapshot, customer: p.customer.name, customerCode: p.customer.code ?? "",
    source: "Sales Hub", date: p.orderDate, received: at, updated: at, revision: command.order.documentRevision,
    warehouse: "", document: "รับข้อมูลแล้ว", material: "รอตรวจสอบวัตถุดิบ",
    approval: "รอการอนุมัติจากโรงงาน", production: "ยังไม่เริ่มผลิต",
    requestedDate: p.requestedProductionCompletionDate, pickup: p.scheduledPickupAt, proposal: null, cancellation: null,
    items: p.items.map((item) => ({
      sku: item.sku ?? "", name: item.productName, type: item.productType ?? "", quantity: item.quantity,
      unit: item.unitName ?? "", price: 0, note: item.remark ?? "",
    })), note: p.note ?? "",
  };
}

type Ack = {
  contractVersion: "1"; commandId: string; correlationId: string; status: "APPLIED" | "IDEMPOTENT_REPLAY";
  factoryOrderId: string; acceptedDocumentRevision: number; occurredAt: string;
};

export async function acceptHubOrder(command: HubProductionOrderCommand, caller: string, connect?: () => Promise<PoolClient>) {
  return hubTransaction(async (client) => {
    const hash = hubHash(command), key = hubHash(command.idempotencyKey);
    const { rows: priorCommands } = await client.query<{ id: string; key_hash: string; request_hash: string; acknowledgement: Ack }>(
      "SELECT * FROM foliar_fertilizer.hub_commands WHERE id=$1 OR key_hash=$2", [command.commandId, key],
    );
    if (priorCommands.length) {
      const [prior] = priorCommands;
      if (priorCommands.length !== 1 || prior.id !== command.commandId || prior.key_hash !== key || prior.request_hash !== hash)
        conflict("Command identity reused with different content");
      return { ...prior.acknowledgement, status: "IDEMPOTENT_REPLAY" as const };
    }
    const { rows: existing } = await client.query<HubOrderRow>(
      "SELECT * FROM foliar_fertilizer.hub_orders WHERE hub_order_id=$1 OR route_id=$2",
      [command.order.hubOrderId, command.routeId],
    );
    const old = existing[0];
    if (old && (existing.length !== 1 || old.hub_order_id !== command.order.hubOrderId ||
        old.route_id !== command.routeId || old.company_id !== command.sourceCompany.id ||
        old.command.sourceCompany.code !== command.sourceCompany.code ||
        old.command.order.hubOrderNumber !== command.order.hubOrderNumber)) conflict("Order scope cannot change");
    const revision = command.order.documentRevision;
    const replay = old?.revision === revision && hubHash(old.command.payload) === hubHash(command.payload);
    if ((!old && revision !== 1) || (old && !replay && revision !== old.revision + 1)) conflict("Order revision is invalid");
    if (old && !replay) {
      const { driver: oldDriver, recipient: oldRecipient, ...oldCore } = old.command.payload;
      const { driver: nextDriver, recipient: nextRecipient, ...core } = command.payload;
      const changed = hubHash({ driver: oldDriver, recipient: oldRecipient }) !== hubHash({ driver: nextDriver, recipient: nextRecipient });
      if (!changed || hubHash(oldCore) !== hubHash(core)) conflict("Only late recipient and driver updates are accepted");
    }
    if (!old) {
      const ids = [...new Set(command.payload.items.flatMap((row) => row.hubProductId ? [row.hubProductId] : []))];
      if (ids.length) {
        const found = await client.query(
          "SELECT 1 FROM foliar_fertilizer.hub_products WHERE company_id=$1 AND hub_product_id=ANY($2::uuid[]) AND payload->>'hubStatus'='ACTIVE'",
          [command.sourceCompany.id, ids],
        );
        if (found.rowCount !== ids.length) conflict("Required Hub products are unavailable");
      }
    }
    const id = old?.id ?? randomUUID();
    const at = new Date().toISOString();
    if (!replay) {
      const doc = old ? { ...old.document, updated: at, revision } : projectOrder(command, id, at);
      await client.query(
        `INSERT INTO foliar_fertilizer.hub_orders (id,hub_order_id,route_id,company_id,revision,command,document,received_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT (id) DO UPDATE
         SET command=EXCLUDED.command,revision=EXCLUDED.revision,document=EXCLUDED.document,updated_at=EXCLUDED.updated_at`,
        [id, command.order.hubOrderId, command.routeId, command.sourceCompany.id, revision, JSON.stringify(command), JSON.stringify(doc), at],
      );
      if (!old) {
        await appendOrderEvent(client, command, id, "FACTORY_ORDER_RECEIVED", at, caller, "SERVICE",
          { acceptedDocumentRevision: revision, payloadHash: hubHash(command.payload), receivedAt: at }, command.commandId);
      } else if (hubHash(old.command.payload.driver) !== hubHash(command.payload.driver)) {
        await appendOrderEvent(client, command, id, "DRIVER_INFORMATION_UPDATED", at, command.requestedBy.emailSnapshot, "USER",
          { driver: command.payload.driver }, command.commandId);
      }
    }
    const acknowledgement: Ack = {
      contractVersion: "1", commandId: command.commandId, correlationId: command.correlationId,
      status: replay ? "IDEMPOTENT_REPLAY" : "APPLIED", factoryOrderId: id, acceptedDocumentRevision: revision, occurredAt: at,
    };
    await client.query("INSERT INTO foliar_fertilizer.hub_commands (id,key_hash,request_hash,acknowledgement) VALUES ($1,$2,$3,$4)",
      [command.commandId, key, hash, JSON.stringify(acknowledgement)]);
    return acknowledgement;
  }, connect);
}
