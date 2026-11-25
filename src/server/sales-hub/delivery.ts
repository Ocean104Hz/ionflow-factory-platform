import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "../auth/access-repository.ts";
import { isUuid } from "./documents.ts";
import { HubIntegrationError } from "./errors.ts";
import { enqueueHubEvent, hubTransaction, type HubOrderRow } from "./repository.ts";

export const evidenceLimit = 5 * 1024 * 1024;
export const submissionLimit = 3 * evidenceLimit + 32_768;
const categories = ["DRIVER_ID_DOCUMENT", "DRIVER_PHOTO", "VEHICLE_PHOTO"] as const;
const invalid = (message: string, status = 422) => new HubIntegrationError("DELIVERY_UPDATE_FAILED", message, status);

function field(form: FormData, key: string, label: string, max: number, required = true) {
  const input = form.get(key);
  const value = typeof input === "string" ? input.trim() : "";
  if ((required && !value) || value.length > max || /[\x00-\x1F\x7F]/.test(value)) throw invalid(`ตรวจสอบช่อง ${label}`);
  return value || null;
}

async function readEvidence(form: FormData) {
  return Promise.all(categories.map(async category => {
    const file = form.get(category);
    if (!(file instanceof File) || file.size === 0 || file.size > evidenceLimit) throw invalid("กรุณาแนบหลักฐานครบ 3 ไฟล์ ไฟล์ละไม่เกิน 5 MiB");
    const data = Buffer.from(await file.arrayBuffer());
    const jpeg = file.type === "image/jpeg" && data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png = file.type === "image/png" && data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
    const webp = file.type === "image/webp" && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    const pdf = category === "DRIVER_ID_DOCUMENT" && file.type === "application/pdf" && data.toString("ascii", 0, 5) === "%PDF-";
    const displayName = file.name.trim();
    if ((!jpeg && !png && !webp && !pdf) || !displayName || displayName.length > 255 || /[\x00-\x1F\x7F]/.test(displayName))
      throw invalid("ชนิดไฟล์หรือชื่อไฟล์หลักฐานไม่ถูกต้อง");
    return { data, metadata: { id: randomUUID(), category, displayName, mimeType: file.type, sizeBytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex") } };
  }));
}

export async function submitHubDelivery(id: unknown, input: FormData | null, actorInput: string, connect?: () => Promise<PoolClient>) {
  if (!isUuid(id)) throw invalid("รหัสใบส่งสินค้าไม่ถูกต้อง");
  const actor = actorInput.trim().toLowerCase();
  const files = input ? await readEvidence(input) : [];
  const driver = input ? { name: field(input, "driverName", "ชื่อคนขับ", 200), phone: field(input, "driverPhone", "เบอร์คนขับ", 50),
    nationalId: field(input, "nationalId", "เลขบัตรประชาชนคนขับ", 13) } : null;
  if (driver && !/^\d{13}$/.test(driver.nationalId ?? "")) throw invalid("เลขบัตรประชาชนคนขับต้องมี 13 หลัก");
  const carrier = input ? { company: field(input, "carrier", "บริษัทขนส่ง", 200) } : null;
  const vehicle = input ? { registration: field(input, "plate", "ทะเบียนรถ", 100), type: field(input, "vehicleType", "ประเภทรถ", 100, false) } : null;
  const pickupInput = input ? field(input, "pickup", "กำหนดรับสินค้า", 20) : null;
  const pickup = pickupInput ? new Date(`${pickupInput}:00+07:00`) : null;
  if (input && (!pickupInput || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(pickupInput) || !pickup || !Number.isFinite(pickup.getTime()) ||
      new Date(pickup.getTime() + 7 * 3600_000).toISOString().slice(0, 16) !== pickupInput)) throw invalid("วันเวลารับสินค้าไม่ถูกต้อง");

  return hubTransaction(async client => {
    const { rows: [delivery] } = await client.query<{ number: string; status: string; order_id: string }>(
      "SELECT number,status,order_id FROM foliar_fertilizer.hub_documents WHERE id=$1 AND kind='DELIVERY_ORDER' FOR UPDATE", [id],
    );
    if (!delivery) throw invalid("ไม่พบใบส่งสินค้า", 404);
    const status = input ? "SUBMITTED" : "PICKED_UP";
    if (delivery.status !== (input ? "DRAFT" : "SUBMITTED")) throw invalid("สถานะใบส่งสินค้าเปลี่ยนแล้ว กรุณารีเฟรช", 409);
    const { rows: [order] } = await client.query<HubOrderRow>("SELECT * FROM foliar_fertilizer.hub_orders WHERE id=$1", [delivery.order_id]);
    const at = new Date().toISOString();
    const productionOrder = { hubOrderId: order.hub_order_id, iconFactoryOrderId: order.id };
    const common = { iconDeliveryOrderId: id, deliveryOrderNumber: delivery.number, status, productionOrder, purpose: "INITIAL",
      reason: null, replacesDeliveryOrderId: null };
    const payload = input ? {
      ...common, submissionRevision: 1, scheduledPickupAt: pickup!.toISOString(), carrier, driver, vehicle,
      attachments: files.map(file => file.metadata), submittedAt: at, submittedBy: actor,
    } : { ...common, pickedUpAt: at, pickedUpBy: actor };
    for (const file of files) {
      await client.query(`INSERT INTO foliar_fertilizer.hub_delivery_evidence (id,delivery_id,category,mime_type,content)
        VALUES ($1,$2,$3,$4,$5)`, [file.metadata.id, id, file.metadata.category, file.metadata.mimeType, file.data]);
    }
    await client.query("UPDATE foliar_fertilizer.hub_documents SET status=$2 WHERE id=$1", [id, status]);
    await enqueueHubEvent(client, order.id, {
      event_id: randomUUID(), event_type: input ? "DELIVERY_ORDER_SUBMITTED" : "DELIVERY_ORDER_PICKED_UP",
      event_version: 2, occurred_at: at, recorded_at: at, aggregate_type: "DELIVERY_ORDER", aggregate_id: id, aggregate_version: input ? 2 : 3,
      hub_order_id: order.hub_order_id, factory_order_id: order.id, delivery_order_id: id, route_id: order.route_id,
      factory_code: "W1-FF", source: "foliar", actor_type: "USER", actor_id: actor, correlation_id: order.command.correlationId,
      causation_id: null, payload,
    });
  }, connect);
}

export async function readHubDeliveryEvidence(id: string, attachment: string, order: string | null, route: string | null, factory: string | null) {
  if (!isUuid(id) || !isUuid(attachment) || !isUuid(order) || !route || factory !== "W1-FF") return null;
  const { rows: [file] } = await getFactoryDatabasePool().query<{ content: Buffer; mime_type: string }>(`
    SELECT a.content,a.mime_type FROM foliar_fertilizer.hub_delivery_evidence a
    JOIN foliar_fertilizer.hub_documents d ON d.id=a.delivery_id
    JOIN foliar_fertilizer.hub_orders o ON o.id=d.order_id
    WHERE d.id=$1 AND a.id=$2 AND o.hub_order_id=$3 AND o.route_id=$4 AND d.kind='DELIVERY_ORDER' AND d.status IN ('SUBMITTED','PICKED_UP')`,
  [id, attachment, order, route]);
  return file ?? null;
}
