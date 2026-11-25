import "server-only";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { FactoryAuthError, requireFactoryModule, requireFactoryRole, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";
import { loadMasters } from "./factory-masters.ts";
import { actionRules, copyPR, createPRRecord, deletePREvent, eventFor, newPR, savePRRecord, transitionPR, type PR, type PRAction, type PREvent } from "../features/purchase-requisitions/pr-domain.ts";
import { allowedActions, blankItem, blankPo, savePo, transitionPo, type PoAction, type PurchaseOrder } from "../features/purchase-orders/po-domain.ts";
import type { MasterRow, MasterSnapshot } from "../features/master-data/master-domain.ts";

type Kind = "pr" | "po";
type Stored = { id: string; kind: Kind; deleted: boolean; payload: PR | PurchaseOrder };
const prModule = "pr";
const poModule = "purchase_orders";
const admin = "factory_admin";

export class PurchasingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function invalid(message = "ข้อมูลเอกสารไม่ถูกต้อง"): never { throw new PurchasingError(400, message); }
function conflict(message: string): never { throw new PurchasingError(409, message); }

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function strings<T extends Record<string, string>>(template: T, input: Record<string, unknown>): T {
  return Object.fromEntries(Object.keys(template).map((key) => {
    const value = input[key];
    if (typeof value !== "string" || value.length > 2000) invalid();
    return [key, value];
  })) as T;
}

function text(value: unknown, max = 250): string {
  if (typeof value !== "string" || value.length > max) invalid();
  return value.trim();
}

function master(rows: MasterRow[], kind: MasterRow["kind"], value: string, key: "id" | "code" | "name" = "code") {
  const row = rows.find((item) => item.active && item.kind === kind && item[key] === value);
  if (!row) invalid("ไม่พบข้อมูลหลักที่เปิดใช้งาน กรุณาเลือกข้อมูลจากการตั้งค่า");
  return row;
}

function ref(row: MasterRow, value: string): MasterSnapshot {
  return { id: row.id, kind: row.kind, code: row.code, name: row.name, value };
}

async function readRows(client: PoolClient): Promise<Stored[]> {
  return (await client.query("SELECT id, kind, deleted, payload FROM foliar_fertilizer.purchasing_documents ORDER BY document_no DESC")).rows as Stored[];
}

async function saveRow(client: PoolClient, kind: Kind, document: PR | PurchaseOrder, deleted = false) {
  const number = "number" in document ? document.number : document.po_no;
  await client.query(
    `INSERT INTO foliar_fertilizer.purchasing_documents (id, kind, document_no, payload, deleted)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET document_no=EXCLUDED.document_no, payload=EXCLUDED.payload, deleted=EXCLUDED.deleted
     WHERE purchasing_documents.kind=EXCLUDED.kind`,
    [document.id, kind, number, JSON.stringify(document), deleted],
  );
}

async function audit(client: PoolClient, user: AuthenticatedFactoryUser, documentId: string, module: string, number: string, event: { id?: string; action: string; note: string; changes: PREvent["changes"] }) {
  const id = event.id ?? crypto.randomUUID();
  await client.query(
    "INSERT INTO foliar_fertilizer.purchasing_history (id,document_id,actor_id,payload) VALUES ($1,$2,$3,$4)",
    [id, documentId, user.id, JSON.stringify({
      id, occurredAt: new Date().toISOString(), user: user.displayName, email: user.email, module, reference: number,
      action: event.action === "delete" ? "DELETE" : event.action === "create" ? "CREATE" : "UPDATE",
      summary: event.note || event.action, changes: event.changes, ipAddress: "—",
    })],
  );
}

function activePR(data: Stored[]) {
  return data.filter((row) => row.kind === "pr" && !row.deleted).map((row) => row.payload as PR);
}
function activePO(data: Stored[]) {
  return data.filter((row) => row.kind === "po" && !row.deleted).map((row) => row.payload as PurchaseOrder);
}

async function snapshot(client: PoolClient, user: AuthenticatedFactoryUser) {
  const data = await readRows(client);
  const prs = activePR(data);
  const allowPR = user.modules.includes(prModule);
  const allowPO = user.modules.includes(poModule);
  const auditRows = user.modules.includes("audit_log")
    ? (await client.query("SELECT payload FROM foliar_fertilizer.purchasing_history ORDER BY occurred_at DESC LIMIT 500")).rows
    : [];
  return {
    prs: allowPR ? prs : [],
    pos: allowPO ? activePO(data) : [],
    references: allowPO ? prs.filter((pr) => ["approved", "partial_po_created", "fully_po_created"].includes(pr.status))
      .map(({ id, number, warehouseCode, neededDate, items }) => ({ id, number, warehouseCode, neededDate, items })) : [],
    audit: auditRows.map((row) => row.payload),
    canApprove: user.roles.includes(admin),
  };
}

export async function readPurchasing(user: AuthenticatedFactoryUser) {
  if (![prModule, poModule, "audit_log"].some((module) => user.modules.includes(module)))
    throw new FactoryAuthError("ACCESS_DENIED", 403);
  const client = await getFactoryDatabasePool().connect();
  try { return await snapshot(client, user); } finally { client.release(); }
}

async function parsePR(input: unknown, rows: MasterRow[], user: AuthenticatedFactoryUser, client: PoolClient): Promise<PR> {
  const raw = record(input);
  const basic = strings({
    id: "", date: "", requester: "", department: "", warehouseCode: "", category: "",
    transactionType: "", referenceNo: "", priority: "", neededDate: "", purpose: "", remarks: "", approver: "",
  }, raw);
  const approverId = record(record(raw.masterRefs ?? {}).approver ?? {}).id;
  const masterRefs: NonNullable<PR["masterRefs"]> = {
    requester: { kind: "personnel", id: user.id, code: user.id, name: user.displayName, value: user.displayName },
  };
  let approver = "";
  if (approverId && typeof approverId === "string" && /^[1-9]\d{0,17}$/.test(approverId)) {
    const response = await client.query(
      `SELECT u.display_name FROM foliar_fertilizer.app_users u
        JOIN foliar_fertilizer.app_user_roles ur ON ur.user_id=u.id
        JOIN foliar_fertilizer.app_roles r ON r.id=ur.role_id
        WHERE u.id=$1 AND u.is_active AND r.is_active AND r.code='factory_admin'`, [approverId]);
    if (!response.rowCount) invalid("กรุณาเลือกผู้อนุมัติที่เป็นแอดมินโรงงาน");
    approver = response.rows[0].display_name;
    masterRefs.approver = { kind: "personnel", id: approverId, code: approverId, name: approver, value: approver };
  }
  const warehouse = basic.warehouseCode ? master(rows, "warehouses", basic.warehouseCode) : undefined;
  if (warehouse) masterRefs.warehouse = ref(warehouse, warehouse.code);
  if (basic.department) master(rows, "departments", basic.department, "name");
  if (!Array.isArray(raw.items) || raw.items.length > 100) invalid();
  const items = raw.items.map((entry) => {
    const item = record(entry);
    const fields = strings({ id: "", code: "", supplierCode: "", specification: "", remarks: "" }, item);
    const material = fields.code ? master(rows, "materials", fields.code) : null;
    const unit = material ? master(rows, "units", material.typeId, "id") : null;
    const supplier = fields.supplierCode ? master(rows, "suppliers", fields.supplierCode) : null;
    if (material) masterRefs[`material:${fields.id}`] = ref(material, material.code);
    if (unit) masterRefs[`unit:${fields.id}`] = ref(unit, unit.name);
    if (supplier) masterRefs[`supplier:${fields.id}`] = ref(supplier, supplier.code);
    if (typeof item.quantity !== "number" || !(item.price === null || typeof item.price === "number")) invalid();
    return { ...fields, name: material?.name ?? "", unit: unit?.name ?? "", supplierName: supplier?.name ?? "", quantity: item.quantity, price: item.price, orderedQuantity: 0 };
  });
  return { ...newPR(), ...basic, requester: user.displayName, approver, warehouseName: warehouse?.name ?? "", items, masterRefs,
    revision: typeof raw.revision === "number" ? raw.revision : 0, transactionType: basic.transactionType as PR["transactionType"], priority: basic.priority as PR["priority"] };
}

function parsePO(input: unknown, rows: MasterRow[], prior: PurchaseOrder | undefined): PurchaseOrder {
  const raw = record(input);
  const fields = strings({ id: "", po_no: "", po_date: "", supplier_id: "", warehouse_code: "", currency_code: "", vat_type: "", payment_term: "",
    credit_days: "", expected_delivery_date: "", request_ref_id: "", remarks: "" }, raw);
  const supplier = master(rows, "suppliers", fields.supplier_id, "id");
  const warehouse = master(rows, "warehouses", fields.warehouse_code);
  if (!["NON_VAT", "VAT_EXCLUDED", "VAT_INCLUDED"].includes(fields.vat_type) || !/^[A-Z]{3}$/.test(fields.currency_code)) invalid();
  if (!Array.isArray(raw.items) || raw.items.length > 100) invalid();
  return {
    ...blankPo(), ...fields, vat_type: fields.vat_type as PurchaseOrder["vat_type"],
    supplier_code_snapshot: supplier.code, supplier_name_snapshot: supplier.name, warehouse_name: warehouse.name,
    items: raw.items.map((entry) => {
      const item = record(entry);
      const line = strings({ id: "", raw_material_id: "", ordered_qty: "", unit_price: "", discount_amount: "", tax_amount: "", specification: "", expected_delivery_date: "", remarks: "" }, item);
      const material = master(rows, "materials", line.raw_material_id, "id");
      const unit = master(rows, "units", material.typeId, "id");
      return { ...blankItem(line.id), ...line, material_code_snapshot: material.code, material_name_snapshot: material.name, unit: unit.name,
        request_ref_item_id: text(item.request_ref_item_id ?? ""), received_qty: prior?.items.find((previous) => previous.id === line.id)?.received_qty ?? "0" };
    }),
  };
}

function allocations(pr: PR, documents: PurchaseOrder[]): PR {
  const linked = documents.filter((doc) => doc.request_ref_id === pr.id && doc.status !== "cancelled");
  const items = pr.items.map((item) => {
    let ordered = 0;
    for (const doc of linked) {
      for (const line of doc.items.filter((row) => row.request_ref_item_id === item.id)) {
        if (line.material_code_snapshot !== item.code || line.unit !== item.unit ||
            (item.supplierCode && doc.supplier_code_snapshot !== item.supplierCode)) invalid("สินค้า หน่วย หรือผู้ขายใน PO ไม่ตรงกับ PR");
        ordered += Math.round(Number(line.ordered_qty) * 10_000);
      }
    }
    if (ordered > Math.round(item.quantity * 10_000)) conflict("จำนวนใน PO เกินยอดคงเหลือของ PR");
    return { ...item, orderedQuantity: ordered / 10_000 };
  });
  const status = pr.status === "cancelled" || pr.status === "closed" ? pr.status
    : items.every((line) => line.orderedQuantity === line.quantity) ? "fully_po_created"
    : items.some((line) => line.orderedQuantity > 0) ? "partial_po_created" : "approved";
  return { ...pr, items, status, revision: pr.revision + 1, purchaseOrders: linked.map((doc) => ({
    id: doc.id, number: doc.po_no, at: doc.created_at, actor: doc.created_by ?? "—", lines: doc.items.map((line) => ({ itemId: line.request_ref_item_id!, quantity: Number(line.ordered_qty) })),
  })) };
}

export async function mutatePurchasing(user: AuthenticatedFactoryUser, raw: unknown, connect = () => getFactoryDatabasePool().connect()) {
  const command = record(raw);
  const kind = command.kind;
  if (kind !== "pr" && kind !== "po") invalid();
  requireFactoryModule(user, kind === "pr" ? prModule : poModule);
  const action = text(command.action);
  if (["approve", "reject", "return_draft"].includes(action)) requireFactoryRole(user, admin);
  const actor = user.displayName;
  const client = await connect();
  let broken = false;
  let createdId: string | undefined;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261125, 1)");
    const data = await readRows(client);
    const prs = activePR(data);
    const pos = activePO(data);
    const now = new Date().toISOString();
    const ids = command.ids === undefined ? [] : Array.isArray(command.ids) && command.ids.length <= 100
      ? [...new Set(command.ids.map((id) => text(id)))] : invalid();
    if (kind === "pr") {
      const draftId = command.draft ? text(record(command.draft).id) : "";
      const old = prs.find((row) => row.id === draftId || row.id === ids[0]);
      if (["create", "save", "copy"].includes(action)) {
        if (action !== "create" && !old) invalid("ไม่พบใบขอซื้อ");
        const rows = (await loadMasters(client)).rows;
        const draft = await parsePR(action === "copy" ? copyPR(old!) : command.draft, rows, user, client);
        if (action === "save" && old) {
          draft.requester = old.requester;
          if (old.masterRefs?.requester) draft.masterRefs!.requester = old.masterRefs.requester;
        }
        const all = data.filter((row) => row.kind === "pr").map((row) => row.payload as PR);
        const next = action === "save" ? savePRRecord(old!, draft, actor, command.submit === true)
          : createPRRecord(draft, all, actor, command.submit === true);
        await saveRow(client, kind, next);
        for (const event of next.history.slice(action === "save" ? old!.history.length : 0))
          await audit(client, user, next.id, "ใบขอซื้อ (PR)", next.number, event);
        createdId = next.id;
      } else {
        if (!ids.length || (action !== "delete" && !Object.hasOwn(actionRules, action))) invalid();
        for (const id of ids) {
          const pr = prs.find((row) => row.id === id);
          if (!pr) invalid("ไม่พบใบขอซื้อ");
          if (action === "delete") {
            const event = deletePREvent(pr, actor);
            await saveRow(client, kind, pr, true);
            await audit(client, user, id, "ใบขอซื้อ (PR)", pr.number, event);
          } else {
            const next = transitionPR(pr, action as PRAction, actor, text(command.note ?? "", 1000), user.roles.includes(admin));
            await saveRow(client, kind, next);
            await audit(client, user, id, "ใบขอซื้อ (PR)", pr.number, next.history.at(-1)!);
          }
        }
      }
    } else {
      let updates: PurchaseOrder[];
      if (action === "save") {
        const rawDraft = record(command.draft);
        const old = pos.find((row) => row.id === rawDraft.id);
        if (old && old.updated_at !== rawDraft.updated_at) conflict("ใบสั่งซื้อถูกแก้ไขแล้ว กรุณาเปิดใหม่");
        const draft = parsePO(rawDraft, (await loadMasters(client)).rows, old);
        draft.created_by = old?.created_by ?? actor;
        if (old && old.request_ref_id !== draft.request_ref_id) invalid("เปลี่ยน PR ของใบสั่งซื้อที่บันทึกแล้วไม่ได้");
        if (draft.request_ref_id) {
          const pr = prs.find((row) => row.id === draft.request_ref_id);
          if (!pr || !["approved", "partial_po_created", "fully_po_created"].includes(pr.status)) invalid("PR ยังไม่พร้อมสร้างใบสั่งซื้อ");
          if (draft.warehouse_code !== pr.warehouseCode || draft.items.some((line) => !pr.items.some((item) => item.id === line.request_ref_item_id))) invalid("คลังหรือรายการ PO ไม่ตรงกับใบขอซื้อ");
          draft.request_ref_no = pr.number;
        } else if (draft.items.some((line) => line.request_ref_item_id)) invalid("รายการ PO ต้องอ้างอิง PR ที่เลือก");
        const result = savePo(pos, draft, crypto.randomUUID(), now, command.submit === true);
        if (!result.saved) invalid(Object.values(result.errors)[0]);
        updates = [result.saved];
      } else {
        const selected = pos.filter((row) => ids.includes(row.id));
        if (!ids.length || selected.length !== ids.length || selected.some((row) => !allowedActions(row.status).includes(action as PoAction))) invalid("สถานะใบสั่งซื้อไม่รองรับคำสั่งนี้");
        updates = action === "delete" ? selected : transitionPo(pos, ids, action as PoAction, now).filter((row) => ids.includes(row.id));
      }
      const nextPOs = [...pos.filter((row) => !updates.some((next) => next.id === row.id)), ...(action === "delete" ? [] : updates)];
      for (const next of updates) {
        await saveRow(client, kind, next, action === "delete");
        await audit(client, user, next.id, "ใบสั่งซื้อ (PO)", next.po_no, {
          action: pos.some((row) => row.id === next.id) ? action : "create",
          note: next.status === "pending_approval" ? "ส่งอนุมัติใบสั่งซื้อ" : "",
          changes: [{ field: "สถานะ", before: pos.find((row) => row.id === next.id)?.status ?? "—", after: next.status }],
        });
      }
      for (const prId of new Set(updates.map((row) => row.request_ref_id).filter(Boolean))) {
        const old = prs.find((row) => row.id === prId)!;
        const updated = allocations(old, nextPOs);
        if (updated.status === old.status && JSON.stringify(updated.purchaseOrders) === JSON.stringify(old.purchaseOrders)) continue;
        const event = eventFor(updated, "purchase_order", actor, "ปรับยอดสั่งซื้อจากใบ PO");
        await saveRow(client, "pr", { ...updated, history: [...old.history, event] });
        await audit(client, user, updated.id, "ใบขอซื้อ (PR)", updated.number, event);
      }
    }
    const result = await snapshot(client, user);
    await client.query("COMMIT");
    return { ...result, createdId };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    if (error instanceof FactoryAuthError || error instanceof PurchasingError) throw error;
    if (typeof error === "object" && error && "code" in error) {
      if (error.code === "23505") conflict("เลขเอกสารซ้ำ กรุณาใช้เลขใหม่");
      throw new PurchasingError(503, "บันทึกข้อมูลจัดซื้อไม่สำเร็จ กรุณาตรวจการเชื่อมต่อฐานข้อมูล");
    }
    invalid(error instanceof Error ? error.message : "บันทึกเอกสารไม่สำเร็จ");
  } finally { client.release(broken); }
}
