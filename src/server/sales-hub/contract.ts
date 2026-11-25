import { createHash } from "node:crypto";
import { HubIntegrationError } from "./errors.ts";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MAX_QUANTITY = 999_999_999_999.999;
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(field);
  return value as Record<string, unknown>;
}

function keys(
  body: Record<string, unknown>,
  allowed: readonly string[],
  required = allowed,
): void {
  if (
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    required.some((key) => !(key in body))
  ) {
    invalid("request fields");
  }
}

function invalid(field: string): never {
  throw new HubIntegrationError("INVALID_REQUEST", `${field} is invalid`, 400);
}

function text(value: unknown, field: string, maximum: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  )
    invalid(field);
  return value.trim();
}

function nullable(
  value: unknown,
  field: string,
  maximum: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.trim().length > maximum)
    invalid(field);
  return value.trim() || null;
}

function uuid(value: unknown, field: string): string {
  const result = text(value, field, 36);
  if (!UUID.test(result)) invalid(field);
  return result.toLowerCase();
}

function integer(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 2147483647) invalid(field);
  return Number(value);
}

function date(value: unknown, field: string): string {
  const result = text(value, field, 10);
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (
    !DATE.test(result) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  )
    invalid(field);
  return result;
}

function timestamp(value: unknown, field: string): string {
  const result = text(value, field, 64);
  const parsed = new Date(result);
  if (Number.isNaN(parsed.getTime())) invalid(field);
  return parsed.toISOString();
}

function quantity(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_QUANTITY
  )
    invalid(field);
  const scaled = value * 1000;
  if (
    !Number.isSafeInteger(Math.round(scaled)) ||
    Math.abs(scaled - Math.round(scaled)) > 0.000001
  )
    invalid(field);
  return Number((Math.round(scaled) / 1000).toFixed(3));
}

export function parseHubProductionOrderCommand(value: unknown) {
  const body = record(value, "request");
  keys(body, ["contractVersion", "commandId", "commandType", "idempotencyKey", "factory", "sourceCompany", "routeId", "order", "requestedAt", "requestedBy", "correlationId", "payload"]);
  if (body.contractVersion !== "5") throw new HubIntegrationError("UNSUPPORTED_CONTRACT_VERSION", "Hub requires contract version 5", 400);
  if (body.commandType !== "FACTORY_ORDER_UPSERT") invalid("commandType");
  const factory = record(body.factory, "factory"); keys(factory, ["code"]);
  if (factory.code !== "W1-FF") invalid("factory.code");
  const company = record(body.sourceCompany, "sourceCompany"); keys(company, ["id", "code", "nameSnapshot"]);
  const companyCode = text(company.code, "sourceCompany.code", 32);
  if (companyCode !== companyCode.toUpperCase()) invalid("sourceCompany.code");
  const order = record(body.order, "order"); keys(order, ["hubOrderId", "hubOrderNumber", "documentRevision"]);
  const requestedBy = record(body.requestedBy, "requestedBy"); keys(requestedBy, ["hubUserId", "nameSnapshot", "emailSnapshot"]);
  const email = text(requestedBy.emailSnapshot, "requestedBy.emailSnapshot", 320).toLowerCase();
  const payload = record(body.payload, "payload");
  keys(payload, ["orderDate", "requestedProductionCompletionDate", "scheduledPickupAt", "customer", "recipient", "driver", "items", "note"]);
  const customer = record(payload.customer, "customer"); keys(customer, ["code", "name", "phone"]);
  const recipient = record(payload.recipient, "recipient"); keys(recipient, ["name", "address", "phone"]);
  const driver = payload.driver === null ? null : record(payload.driver, "driver");
  if (driver) keys(driver, ["name", "phone", "nationalId", "licensePlate"]);
  if (driver?.nationalId != null && driver.nationalId !== "" &&
      (typeof driver.nationalId !== "string" || !/^[0-9]{13}$/u.test(driver.nationalId.trim()))) invalid("driver.nationalId");
  if (
    !Array.isArray(payload.items) ||
    payload.items.length < 1 ||
    payload.items.length > 200
  )
    invalid("payload.items");
  const items = payload.items.map((raw, index) => {
    const item = record(raw, `payload.items[${index}]`);
    const itemFields = [
      "hubOrderLineId",
      "lineNo",
      "factoryProductId",
      "sku",
      "productName",
      "productType",
      "unitName",
      "quantity",
      "productionDepartment",
      "lotNo",
      "remark",
    ];
    keys(item, [...itemFields, "hubProductId"], itemFields.filter(field => field !== "productionDepartment"));
    return {
      hubOrderLineId: uuid(
        item.hubOrderLineId,
        `payload.items[${index}].hubOrderLineId`,
      ),
      lineNo: integer(item.lineNo, `payload.items[${index}].lineNo`),
      // Require the key: only explicit null relaxes the legacy mapping.
      factoryProductId: item.factoryProductId === null ? null : text(
        item.factoryProductId,
        `payload.items[${index}].factoryProductId`,
        128,
      ),
      ...("hubProductId" in item
        ? {
            hubProductId: item.hubProductId === null ? null : uuid(item.hubProductId, `payload.items[${index}].hubProductId`),
          }
        : {}),
      sku: nullable(item.sku, `payload.items[${index}].sku`, 100),
      productName: text(
        item.productName,
        `payload.items[${index}].productName`,
        200,
      ),
      productType: nullable(
        item.productType,
        `payload.items[${index}].productType`,
        100,
      ),
      unitName: nullable(
        item.unitName,
        `payload.items[${index}].unitName`,
        100,
      ),
      quantity: quantity(item.quantity, `payload.items[${index}].quantity`),
      productionDepartment: nullable(
        item.productionDepartment,
        `payload.items[${index}].productionDepartment`,
        200,
      ),
      lotNo: nullable(item.lotNo, `payload.items[${index}].lotNo`, 100),
      remark: nullable(item.remark, `payload.items[${index}].remark`, 1000),
    };
  });
  if (
    new Set(items.map((item) => item.hubOrderLineId)).size !== items.length ||
    new Set(items.map((item) => item.lineNo)).size !== items.length
  )
    invalid("payload.items");
  const routeId = text(body.routeId, "routeId", 128);
  if (routeId.startsWith("datalink:") || routeId.startsWith("legacy-accounting:")) invalid("routeId");
  const common = {
    commandId: uuid(body.commandId, "commandId"),
    commandType: "FACTORY_ORDER_UPSERT",
    idempotencyKey: text(body.idempotencyKey, "idempotencyKey", 200),
    factory: { code: "W1-FF" },
    sourceCompany: {
      id: uuid(company.id, "sourceCompany.id"),
      code: companyCode,
      nameSnapshot: text(
        company.nameSnapshot,
        "sourceCompany.nameSnapshot",
        200,
      ),
    },
    routeId,
    order: {
      hubOrderId: uuid(order.hubOrderId, "order.hubOrderId"),
      hubOrderNumber: text(order.hubOrderNumber, "order.hubOrderNumber", 128),
      documentRevision: integer(
        order.documentRevision,
        "order.documentRevision",
      ),
    },
    requestedAt: timestamp(body.requestedAt, "requestedAt"),
    requestedBy: {
      hubUserId: uuid(requestedBy.hubUserId, "requestedBy.hubUserId"),
      nameSnapshot: text(
        requestedBy.nameSnapshot,
        "requestedBy.nameSnapshot",
        200,
      ),
      emailSnapshot: email,
    },
    correlationId: uuid(body.correlationId, "correlationId"),
  };
    const completion = date(payload.requestedProductionCompletionDate, "payload.requestedProductionCompletionDate");
    const pickup = text(payload.scheduledPickupAt, "payload.scheduledPickupAt", 64);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(pickup)) invalid("payload.scheduledPickupAt");
    date(pickup.slice(0, 10), "payload.scheduledPickupAt");
    const scheduledPickupAt = timestamp(pickup, "payload.scheduledPickupAt");
    assertPickupFollowsCompletion(completion, scheduledPickupAt);
    return { contractVersion: "5" as const, ...common, payload: {
      orderDate: date(payload.orderDate, "payload.orderDate"), requestedProductionCompletionDate: completion, scheduledPickupAt,
      customer: { code: nullable(customer.code, "payload.customer.code", 100), name: text(customer.name, "payload.customer.name", 200), phone: nullable(customer.phone, "payload.customer.phone", 50) },
      recipient: { name: nullable(recipient.name, "payload.recipient.name", 201), address: nullable(recipient.address, "payload.recipient.address", 1000), phone: nullable(recipient.phone, "payload.recipient.phone", 50) },
      driver: driver ? { name: nullable(driver.name, "payload.driver.name", 200), phone: nullable(driver.phone, "payload.driver.phone", 50), nationalId: nullable(driver.nationalId, "payload.driver.nationalId", 100), licensePlate: nullable(driver.licensePlate, "payload.driver.licensePlate", 100) } : null,
      items, note: nullable(payload.note, "payload.note", 2000),
    } };
}
export type HubProductionOrderCommand = ReturnType<typeof parseHubProductionOrderCommand>;
export function assertPickupFollowsCompletion(completion: string, pickup: string): void {
  if (Date.parse(pickup) < Date.parse(`${completion}T00:00:00+07:00`)) invalid("Pickup cannot precede completion in Asia/Bangkok");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const data = value as Record<string, unknown>;
    return "{" + Object.keys(data).sort().map((key) => JSON.stringify(key) + ":" + canonical(data[key])).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}
export function hubHash(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export async function readHubJson(request: Request, maximum = 2 * 1024 * 1024): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new HubIntegrationError("UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json", 415);
  if (!request.body) invalid("body");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.length; if (size > maximum) { await reader.cancel(); throw new HubIntegrationError("PAYLOAD_TOO_LARGE", "Body is too large", 413); } chunks.push(chunk.value);
  } } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return invalid("JSON"); }
}

const HUB_PRODUCT_STATUSES = ["PENDING_FACTORY_CONFIRMATION", "ACTIVE", "INACTIVE"] as const;

export function parseHubProduct(input: unknown) {
  const invalid = (): never => { throw new HubIntegrationError("INVALID_REQUEST", "Invalid Product Master payload", 400); };
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalid();
  const row = input as Record<string, unknown>;
  const requiredFields = ["hubProductId", "sourceCompanyId", "sourceCompanyCode", "sourceFactoryId", "factoryCode", "productCode", "productName", "productType", "baseUnit", "specification", "hubStatus", "hubRecordVersion", "sourceUpdatedAt"];
  const allowedFields = [...requiredFields, "unitWeightKg"];
  const keys = Object.keys(row);
  if (requiredFields.some(key => !(key in row)) || keys.some(key => !allowedFields.includes(key))) return invalid();
  const text = (key: string, max: number, empty = false): string => {
    const value = row[key];
    if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) return invalid();
    return value;
  };
  const id = (key: string) => {
    const value = text(key, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) return invalid();
    return value;
  };
  const status = HUB_PRODUCT_STATUSES.find(status => status === row.hubStatus);
  const unitWeightRaw = row.unitWeightKg;
  const unitWeightKg =
    unitWeightRaw === null || unitWeightRaw === undefined
      ? null
      : typeof unitWeightRaw === "number" &&
          Number.isFinite(unitWeightRaw) &&
          unitWeightRaw > 0 &&
          unitWeightRaw <= 1_000_000
        ? Number(unitWeightRaw.toFixed(4))
        : invalid();
  const version = row.hubRecordVersion;
  const timestamp = text("sourceUpdatedAt", 64);
  if (!status || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || version > 2147483647 || !/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(Date.parse(timestamp)) || row.factoryCode !== "W1-FF") return invalid();
  return {
    hubProductId: id("hubProductId"), sourceCompanyId: id("sourceCompanyId"), sourceFactoryId: id("sourceFactoryId"),
    sourceCompanyCode: text("sourceCompanyCode", 32), factoryCode: "W1-FF",
    productCode: text("productCode", 100), productName: text("productName", 200),
    productType: text("productType", 100, true), baseUnit: text("baseUnit", 100),
    unitWeightKg,
    specification: row.specification === null ? null : text("specification", 10000, true),
    hubStatus: status, hubRecordVersion: version, sourceUpdatedAt: timestamp,
  };
}


