import "server-only";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { requireFactoryModule, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";
import { loadMasters } from "./factory-masters.ts";
import { blankMaster, deleteFormula, deleteMaster, saveFormula, saveMaster, selectDefault, type BOMState, type Formula, type Master } from "../features/bom/bom-domain.ts";
import { validDay } from "../features/purchase-orders/po-domain.ts";
import type { ProductionOrderV1 } from "../features/product-production-orders-v1/types";
import { newProductionReport, saveProductionReport, type ProductionFormulaSheet, type ProductionReport } from "../features/production-flow/production-flow-domain.ts";
import type { ReceiptDocumentV1 } from "../features/production-receipts-v1/production-receipt-v1-types";

export const productionModules = {
  bom: "bom", order: "product_production_orders_v1", report: "production_reports", receipt: "production_receipts_v1",
} as const;
export type ProductionArea = keyof typeof productionModules;

export class ProductionError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function invalid(message = "ข้อมูลการผลิตไม่ถูกต้อง"): never { throw new ProductionError(400, message); }
function stale(): never { throw new ProductionError(409, "ข้อมูลถูกแก้ไขแล้ว กรุณาเปิดรายการใหม่"); }
function obj(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) invalid();
  return input as Record<string, unknown>;
}
function str(input: unknown, max = 1000): string {
  if (typeof input !== "string" || input.length > max) invalid();
  return input.trim();
}
function fields<K extends string>(input: Record<string, unknown>, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => [key, str(input[key] ?? "")])) as Record<K, string>;
}

async function storedBOM(client: PoolClient): Promise<BOMState> {
  const result = await client.query("SELECT payload FROM foliar_fertilizer.production_bom WHERE id");
  return result.rows[0]?.payload ?? { masters: [], formulas: [] };
}

async function productionBOM(client: PoolClient) {
  const [state, { rows }] = await Promise.all([storedBOM(client), loadMasters(client)]);
  const materials = rows.filter((row) => row.kind === "materials").flatMap((row) => {
    const unit = rows.find((item) => item.kind === "units" && item.id === row.typeId);
    return unit ? [{
      ...blankMaster(), id: "settings-" + row.id, code: row.code, name: row.name,
      type: "RAW_MATERIAL" as const, unit: unit.name, usageType: row.active && unit.active ? "ทะเบียนวัตถุดิบ" : "ปิดใช้งาน",
    }] : [];
  });
  return { masters: [...state.masters, ...materials], formulas: state.formulas };
}

export async function withProduction<T>(write: boolean, work: (client: PoolClient) => Promise<T>, connect = () => getFactoryDatabasePool().connect()) {
  const client = await connect();
  let broken = false;
  try {
    await client.query(write ? "BEGIN" : "BEGIN READ ONLY");
    if (write) await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261125, 1)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}

function ensureEditorTimestamp(old: { updatedAt: string } | undefined, incoming: unknown) {
  if (old && old.updatedAt !== incoming) stale();
}

async function updateBOM(client: PoolClient, user: AuthenticatedFactoryUser, command: Record<string, unknown>) {
  const state = await productionBOM(client);
  const at = new Date().toISOString();
  const id = crypto.randomUUID();
  let next: BOMState;
  let savedId: string | undefined;
  const action = str(command.action);
  try {
    if (action === "master") {
      const raw = obj(command.row);
      const input = fields(raw, ["id", "code", "name", "type", "unit", "usageType", "notes", "company", "process", "category", "brand", "department"]);
      if (input.id.startsWith("settings-") || input.type === "RAW_MATERIAL") invalid("จัดการวัตถุดิบในตั้งค่าระบบ");
      const old = state.masters.find((row) => row.id === input.id);
      ensureEditorTimestamp(old, raw.updatedAt);
      savedId = input.id || id;
      next = saveMaster(state, { ...blankMaster(), ...input, type: input.type as Master["type"], defaultFormulaId: old?.defaultFormulaId ?? null }, savedId, at);
    } else if (action === "formula") {
      const raw = obj(command.row);
      const input = fields(raw, ["id", "masterId", "code", "name", "version", "status", "unit", "effectiveDate", "notes"]);
      const old = state.formulas.find((row) => row.id === input.id);
      ensureEditorTimestamp(old, raw.updatedAt);
      function components(value: unknown) {
        if (!Array.isArray(value) || value.length > 200) invalid();
        return value.map((entry) => {
          const row = obj(entry);
          const data = fields(row, ["materialId", "unit", "remarks"]);
          if (typeof row.quantity !== "number") invalid();
          const material = state.masters.find((item) => item.id === data.materialId);
          if (material?.usageType === "ปิดใช้งาน" &&
              ![...(old?.ingredients ?? []), ...(old?.packaging ?? [])].some((item) => item.materialId === material.id)) invalid("เลือกวัตถุดิบที่เปิดใช้งาน");
          return { ...data, quantity: row.quantity };
        });
      }
      if (typeof raw.batchSize !== "number") invalid();
      savedId = input.id || id;
      next = saveFormula(state, {
        ...input, status: input.status as Formula["status"], batchSize: raw.batchSize, createdAt: "", updatedAt: "", history: [],
        ingredients: components(raw.ingredients), packaging: components(raw.packaging),
      }, command.default === true, savedId, at);
    } else if (action === "default") {
      next = selectDefault(state, str(command.masterId), command.formulaId === null ? null : str(command.formulaId), at);
    } else if (action === "delete-master") {
      const masterId = str(command.id);
      if (masterId.startsWith("settings-")) invalid("จัดการวัตถุดิบในตั้งค่าระบบ");
      next = deleteMaster(state, masterId);
    } else if (action === "delete-formula") {
      next = deleteFormula(state, str(command.id), at);
    } else invalid();
  } catch (error) {
    if (error instanceof ProductionError) throw error;
    invalid(error instanceof Error ? error.message : "แก้ไขสูตรไม่สำเร็จ");
  }
  const stored = {
    masters: next.masters.filter((row) => !row.id.startsWith("settings-")).map((row) => row.updatedAt === at ? { ...row, updatedBy: user.displayName } : row),
    formulas: next.formulas.map((row) => ({
      ...row, history: row.history.map((event) => event.at === at ? { ...event, actor: user.displayName } : event),
    })),
  };
  await client.query(
    "INSERT INTO foliar_fertilizer.production_bom (id,payload) VALUES (true,$1) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload",
    [JSON.stringify(stored)],
  );
  return { state: { ...stored, masters: [...stored.masters, ...next.masters.filter((row) => row.id.startsWith("settings-"))] }, savedId };
}

async function listDocuments<T>(client: PoolClient, kind: Exclude<ProductionArea, "bom">): Promise<T[]> {
  const result = await client.query(
    "SELECT payload FROM foliar_fertilizer.production_v1_documents WHERE kind=$1 ORDER BY document_date DESC, document_no DESC",
    [kind],
  );
  return result.rows.map((row) => row.payload as T);
}

async function numberFor(client: PoolClient, kind: Exclude<ProductionArea, "bom">, prefix: string, date: string) {
  const monthly = `${prefix}-${date.slice(2, 4)}${date.slice(5, 7)}`;
  const result = await client.query(
    `SELECT coalesce(max(substring(document_no from $3::int)::int),0)+1 AS next
       FROM foliar_fertilizer.production_v1_documents WHERE kind=$1 AND document_no LIKE $2`,
    [kind, monthly + "%", monthly.length + 1],
  );
  return monthly + String(result.rows[0].next).padStart(3, "0");
}

async function writeDocument(
  client: PoolClient, user: AuthenticatedFactoryUser, kind: Exclude<ProductionArea, "bom">,
  id: string, number: string, date: string, orderId: string | null, payload: object,
) {
  await client.query(
    `INSERT INTO foliar_fertilizer.production_v1_documents (id,kind,document_no,document_date,order_id,payload,actor_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET document_date=EXCLUDED.document_date,payload=EXCLUDED.payload,
        actor_id=EXCLUDED.actor_id,saved_at=now() WHERE production_v1_documents.kind=EXCLUDED.kind`,
    [id, kind, number, date, orderId, JSON.stringify(payload), user.id],
  );
}

function decimal(value: string) {
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(value)) invalid("จำนวนต้องเป็นตัวเลขและมีทศนิยมไม่เกิน 3 ตำแหน่ง");
  return Number(value);
}

async function createOrder(client: PoolClient, user: AuthenticatedFactoryUser, input: unknown): Promise<ProductionOrderV1> {
  const raw = obj(input);
  const head = fields(raw, ["date", "location", "formulaId", "amount", "note", "mixingReference"]);
  if (!validDay(head.date) || !head.location) invalid("กรุณาระบุวันที่และสถานที่ผลิต");
  const amount = decimal(head.amount);
  if (amount <= 0) invalid("จำนวนที่สั่งผลิตต้องมากกว่า 0");
  const signers = fields(obj(raw.signers), ["preparedBy", "qaOfficer", "productionOfficer", "manager"]);
  if (!Array.isArray(raw.rows) || raw.rows.length > 100) invalid();
  const rows = raw.rows.map((item) => {
    const row = fields(obj(item), ["id", "date", "lineT1Qty", "lineT1Lot", "lineT2Qty", "lineT2Lot", "lineT4Qty", "lineT4Lot", "shift", "producer"]);
    if (!row.id || (row.date && !validDay(row.date))) invalid("วันที่หรือรหัสแถวผลิตไม่ถูกต้อง");
    for (const value of [row.lineT1Qty, row.lineT2Qty, row.lineT4Qty]) if (value) decimal(value);
    return row;
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) invalid("รหัสแถวผลิตซ้ำ");
  const bom = await productionBOM(client);
  const formula = bom.formulas.find((item) => item.id === head.formulaId && item.status === "ACTIVE");
  const product = bom.masters.find((item) => item.id === formula?.masterId);
  if (!formula || !product) invalid("กรุณาเลือกสูตร BOM ที่เปิดใช้งาน");
  const unit = formula.unit.trim().toLowerCase();
  const kilograms = ["kg", "กก.", "กก", "กิโลกรัม"].includes(unit);
  if (!kilograms && !["t", "ton", "tonne", "ตัน"].includes(unit)) invalid("สูตร BOM ต้องใช้หน่วยกิโลกรัมหรือตัน");
  const batchCount = (kilograms ? amount * 1000 : amount) / formula.batchSize;
  const snapshot = (items: Formula["ingredients"]) => items.map((item) => {
    const material = bom.masters.find((row) => row.id === item.materialId);
    if (!material || material.usageType === "ปิดใช้งาน") invalid("สูตรมีวัตถุดิบที่ยังไม่เปิดใช้งาน");
    const quantity = item.quantity * batchCount;
    if (!Number.isFinite(quantity)) invalid("ปริมาณวัตถุดิบตามสูตรสูงเกินขอบเขตที่รองรับ");
    return { ...item, code: material.code, name: material.name, quantity };
  });
  const id = crypto.randomUUID();
  const number = await numberFor(client, "order", "PRD", head.date);
  const at = new Date().toISOString();
  const sheet: ProductionFormulaSheet = {
    id, orderId: id, orderNumber: number, orderDate: head.date, issuedAt: at, issuedBy: user.displayName,
    lines: [{
      orderLineId: id, inventoryItemId: "", productCode: product.code, productName: product.name, lot: "",
      plannedQuantity: amount, plannedUnit: "ตัน", formulaId: formula.id, formulaCode: formula.code,
      formulaName: formula.name, formulaVersion: formula.version, batchSize: formula.batchSize,
      batchUnit: formula.unit, batchCount, ingredients: snapshot(formula.ingredients), packaging: snapshot(formula.packaging),
    }],
  };
  const order = { ...head, id, documentNumber: number, sheet, rows, signers, createdAt: at };
  await writeDocument(client, user, "order", id, number, head.date, null, order);
  return order;
}

type SavedReceipt = ReceiptDocumentV1 & { id: string; orderId: string; createdAt: string };
type OrderOption = Pick<ProductionOrderV1, "id" | "documentNumber" | "location">;

async function createReceipt(client: PoolClient, user: AuthenticatedFactoryUser, input: unknown): Promise<SavedReceipt> {
  const raw = obj(input);
  const header = fields(raw, ["location", "documentDate", "productionOrderNumber", "warehouseOfficer", "inspector", "note"]);
  if (!header.location || !validDay(header.documentDate)) invalid("กรุณาระบุสถานที่และวันที่ใบรับยอดผลิต");
  const orders = await listDocuments<ProductionOrderV1>(client, "order");
  const order = orders.find((row) => row.id === raw.orderId);
  if (!order) invalid("กรุณาเลือกใบสั่งผลิต V1");
  const { rows } = await loadMasters(client);
  const units = new Set(rows.filter((row) => row.kind === "units" && row.active).map((row) => row.name));
  function items(key: string) {
    const entries = raw[key];
    if (!Array.isArray(entries) || entries.length > 100) invalid();
    return entries.map((entry) => fields(obj(entry), ["id", "name", "sizeKg", "quantity", "unit", "lot", "note"]))
      .filter((row) => row.name || row.sizeKg || row.quantity || row.lot || row.note)
      .map((row) => {
        if (!row.id || !row.name || !units.has(row.unit) || decimal(row.quantity) <= 0)
          invalid("กรุณาระบุชื่อ จำนวน และหน่วยนับที่เปิดใช้งานในใบรับยอดผลิต");
        if (row.sizeKg && decimal(row.sizeKg) <= 0) invalid("ขนาดต้องมากกว่า 0");
        return row;
      });
  }
  const p1Items = items("p1Items"), p2Items = items("p2Items"), moldingItems = items("moldingItems");
  const all = [...p1Items, ...p2Items, ...moldingItems];
  if (!all.length || new Set(all.map((row) => row.id)).size !== all.length) invalid("กรุณาเพิ่มรายการรับยอดผลิตอย่างน้อย 1 รายการ");
  const documentNumber = await numberFor(client, "receipt", "PRV", header.documentDate);
  const doc = {
    ...header, id: crypto.randomUUID(), orderId: order.id, productionOrderNumber: order.documentNumber,
    documentNumber, p1Items, p2Items, moldingItems, createdAt: new Date().toISOString(),
  };
  await writeDocument(client, user, "receipt", doc.id, documentNumber, doc.documentDate, order.id, doc);
  return doc;
}

async function updateReport(client: PoolClient, user: AuthenticatedFactoryUser, input: unknown) {
  const raw = obj(input);
  const fieldsToSave = fields(raw, ["id", "orderId", "reportDate", "shift", "productionLine", "startTime", "endTime", "operator", "note"]);
  const orders = await listDocuments<ProductionOrderV1>(client, "order");
  const order = orders.find((row) => row.id === fieldsToSave.orderId);
  if (!order) invalid("ไม่พบใบสั่งผลิต V1 ที่อ้างอิง");
  const reports = await listDocuments<ProductionReport>(client, "report");
  const previous = reports.find((row) => row.id === fieldsToSave.id);
  if (fieldsToSave.id && (!previous || previous.orderId !== order.id)) invalid("เปลี่ยนใบสั่งผลิตต้นทางของรายงานเดิมไม่ได้");
  ensureEditorTimestamp(previous, raw.updatedAt);
  if (previous?.status === "RECORDED" && (await listDocuments<SavedReceipt>(client, "receipt")).some((row) => row.orderId === order.id))
    invalid("แก้รายงานไม่ได้ เนื่องจากมีใบรับยอดผลิตแล้ว");
  const status = raw.status;
  if (status !== "DRAFT" && status !== "RECORDED") invalid();
  if (previous?.status === "RECORDED" && status === "DRAFT") invalid("รายงานที่บันทึกแล้วกลับเป็นฉบับร่างไม่ได้");
  if (fieldsToSave.reportDate && !validDay(fieldsToSave.reportDate)) invalid("วันที่รายงานไม่ถูกต้อง");
  if (!(raw.goodQuantity === null || typeof raw.goodQuantity === "number") ||
      !(raw.wasteQuantity === null || typeof raw.wasteQuantity === "number") || !Array.isArray(raw.materials)) invalid();
  const submitted = raw.materials.map(obj);
  const day = fieldsToSave.reportDate || order.date;
  const number = previous?.documentNumber ?? await numberFor(client, "report", "RP", day);
  const report = newProductionReport(order.sheet, order.id, number);
  if (submitted.length !== report.materials.length) invalid("รายการวัตถุดิบไม่ตรงกับสูตร");
  const materials = report.materials.map((row) => {
    const amount = submitted.find((item) => item.materialId === row.materialId)?.actualQuantity;
    if (!(amount === null || typeof amount === "number")) invalid("รายการวัตถุดิบไม่ตรงกับสูตร");
    return { ...row, actualQuantity: amount };
  });
  const result = saveProductionReport(reports, [], {
    ...report, ...fieldsToSave, materials, status, goodQuantity: raw.goodQuantity, wasteQuantity: raw.wasteQuantity,
  }, [order.sheet], crypto.randomUUID(), new Date().toISOString());
  if (result.saved) await writeDocument(client, user, "report", result.saved.id, number, day, order.id, result.saved);
  return result;
}

export function readProduction(user: AuthenticatedFactoryUser, area: ProductionArea, connect?: () => Promise<PoolClient>) {
  if (area !== "bom" || !user.modules.includes(productionModules.order)) requireFactoryModule(user, productionModules[area]);
  return withProduction(false, async (client) => {
    if (area === "bom") {
      const state = await productionBOM(client);
      if (!user.modules.includes(productionModules.bom)) {
        const formulas = state.formulas.filter((row) => row.status === "ACTIVE");
        return { state: { formulas, masters: state.masters.filter((row) => formulas.some((formula) => formula.masterId === row.id)) } };
      }
      return { state };
    }
    const orders = await listDocuments<ProductionOrderV1>(client, "order");
    if (area === "report") {
      const lockedOrderIds = (await listDocuments<SavedReceipt>(client, "receipt")).map((row) => row.orderId);
      return { documents: await listDocuments<ProductionReport>(client, "report"), sheets: orders.map((row) => row.sheet), lockedOrderIds };
    }
    if (area === "receipt") {
      const orderOptions: OrderOption[] = orders.map(({ id, documentNumber, location }) => ({ id, documentNumber, location }));
      return { documents: await listDocuments<SavedReceipt>(client, "receipt"), orders: orderOptions };
    }
    const produced = Object.fromEntries((await listDocuments<ProductionReport>(client, "report"))
      .filter((row) => row.status === "RECORDED").map((row) => [row.orderId, row.goodQuantity ?? 0]));
    return { documents: orders, produced };
  }, connect);
}

export function saveProduction(user: AuthenticatedFactoryUser, area: ProductionArea, input: unknown, connect?: () => Promise<PoolClient>) {
  requireFactoryModule(user, productionModules[area]);
  const command = obj(input);
  return withProduction(true, async (client) => {
    if (area === "bom") return updateBOM(client, user, command);
    if (command.action !== "save") invalid();
    if (area === "order") return createOrder(client, user, command.row);
    if (area === "report") return updateReport(client, user, command.row);
    return createReceipt(client, user, command.row);
  }, connect);
}
