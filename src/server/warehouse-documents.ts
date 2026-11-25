import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { requireFactoryModule, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";
import { inboundNumberPreview, isValidIsoDate, type InboundNumberPreview, type InboundReservation } from "../features/raw-material-receiving/document-number.ts";
import { blankReceivingItem, blankReceivingSigners, calculateReceivingTotals, validateReceivingDraft, type ReceivingItem } from "../features/raw-material-receiving/receiving-domain.ts";
import type { SavedReceivingDocument } from "../features/raw-material-receiving/receiving-mock-store.ts";
import type { ReceivingHeaderValues } from "../features/raw-material-receiving/receiving-header.tsx";
import { blankRequisition, documentNumber, newMaterial, newWip, saveRequisition, type Requisition } from "../features/material-requisitions/material-requisition-domain.ts";

export class WarehouseDocumentError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
const invalid = (message: string) => new WarehouseDocumentError(422, message);
const stale = () => new WarehouseDocumentError(409, "เอกสารถูกแก้ไขแล้ว กรุณาเปิดเอกสารใหม่ก่อนบันทึก");
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
type ReadDatabase = Pick<PoolClient, "query">;
type Connect = () => Promise<PoolClient>;

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("โครงสร้างเอกสารไม่ถูกต้อง");
  return input as Record<string, unknown>;
}
function text(input: unknown) {
  if (typeof input !== "string" || input.length > 4000 || input.includes("\0")) throw invalid("ข้อความในเอกสารไม่ถูกต้องหรือยาวเกินกำหนด");
  return input;
}
function fields<T extends object>(template: T, input: unknown): T {
  const values = object(input);
  return Object.fromEntries(Object.entries(template).map(([key, seed]) => {
    const value = values[key];
    if (seed === null) {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw invalid(`ช่อง ${key} ต้องเป็นตัวเลข`);
      return [key, value];
    }
    return [key, text(value)];
  })) as T;
}
function list<T>(input: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(input) || input.length > 200) throw invalid("จำนวนรายการไม่ถูกต้อง หรือเกิน 200 รายการ");
  return input.map(parse);
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>, connect: Connect = () => getFactoryDatabasePool().connect()) {
  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}

type ReceiptRow = { payload: SavedReceivingDocument | null; receive_date: string; token: string; expires_at: Date; reserved_by: string };
type ReceiptDraft = Pick<SavedReceivingDocument, "header" | "items" | "note" | "signers">;
const headerTemplate = { location: "", receiveDate: "", poDate: "", documentNo: "", poNo: "", supplierCode: "",
  supplierName: "", prNo: "", warehouseCode: "", vendorBookNo: "", vendorDocumentNo: "" };
function parseReceipt(value: unknown): ReceiptDraft {
  const data = object(value);
  const rawHeader = object(data.header);
  const header: ReceivingHeaderValues = { ...fields(headerTemplate, rawHeader), qcDocumentNumbers: list(rawHeader.qcDocumentNumbers, text) };
  const items = list(data.items, input => {
    const item = fields(blankReceivingItem("", ""), input);
    if (item.source !== "manual") throw invalid("รายการรับเข้าต้องเป็นรายการที่กรอกเอง");
    return item as ReceivingItem;
  });
  const validation = validateReceivingDraft(header, items);
  if (!validation.valid) throw invalid(validation.general || Object.values(validation.header)[0] ||
    Object.values(Object.values(validation.items)[0] ?? {})[0] || "ตรวจสอบรายการรับเข้า");
  return { header, items, note: text(data.note), signers: fields(blankReceivingSigners(), data.signers) };
}

function receiveDate(value: unknown) {
  const iso = text(value);
  if (!isValidIsoDate(iso)) throw invalid("กรุณาระบุวันที่รับเข้าที่ถูกต้อง");
  return iso;
}
async function nextNumber(date: string, database: ReadDatabase): Promise<InboundNumberPreview> {
  const period = date.slice(0, 7);
  const { rows: [row] } = await database.query<{ sequence: number }>(`
    SELECT coalesce(min(sequence) FILTER (WHERE payload IS NULL AND expires_at<=clock_timestamp()), coalesce(max(sequence),0)+1) AS sequence
    FROM foliar_fertilizer.warehouse_receipts WHERE period=$1`, [period]);
  const result = inboundNumberPreview(date, row.sequence);
  // INB includes a two-digit year. Skip any number already allocated to a different century.
  const collision = await database.query("SELECT 1 FROM foliar_fertilizer.warehouse_receipts WHERE document_no=$1 AND period<>$2", [result.documentNo, period]);
  if (collision.rowCount) throw new WarehouseDocumentError(409, "เลขเอกสารของปีนี้ชนกับปีเดิม กรุณาตรวจสอบวันที่");
  return result;
}

export async function previewReceipt(user: AuthenticatedFactoryUser, date: unknown, database: ReadDatabase = getFactoryDatabasePool()) {
  requireFactoryModule(user, "raw_material_receiving");
  return nextNumber(receiveDate(date), database);
}
export async function listReceipts(user: AuthenticatedFactoryUser, database: ReadDatabase = getFactoryDatabasePool()) {
  requireFactoryModule(user, "raw_material_receiving");
  const { rows } = await database.query<{ payload: SavedReceivingDocument }>(
    "SELECT payload FROM foliar_fertilizer.warehouse_receipts WHERE payload IS NOT NULL ORDER BY updated_at DESC, document_no",
  );
  return rows.map(row => row.payload);
}

export async function reserveReceipt(user: AuthenticatedFactoryUser, date: unknown, expected: unknown, connect?: Connect) {
  requireFactoryModule(user, "raw_material_receiving");
  const iso = receiveDate(date);
  return transaction(async client => {
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261127, pg_catalog.hashtext($1))", [iso.slice(0, 7)]);
    const preview = await nextNumber(iso, client);
    if (expected !== preview.documentNo) return { ok: false as const, preview, message: "มีผู้ใช้จองเลขนี้แล้ว กรุณายืนยันเลขล่าสุด" };
    const token = randomUUID();
    const saved = await client.query<{ reserved_at: Date; expires_at: Date }>(`
      INSERT INTO foliar_fertilizer.warehouse_receipts (document_no, period, sequence, receive_date, token, reserved_by, reserved_at, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,now(),now()+interval '24 hours')
      ON CONFLICT (document_no) DO UPDATE SET receive_date=EXCLUDED.receive_date,token=EXCLUDED.token,
        reserved_by=EXCLUDED.reserved_by,reserved_at=EXCLUDED.reserved_at,expires_at=EXCLUDED.expires_at
      WHERE warehouse_receipts.payload IS NULL AND warehouse_receipts.expires_at<=clock_timestamp() AND warehouse_receipts.period=$2
      RETURNING reserved_at,expires_at`, [preview.documentNo, preview.period, preview.sequence, iso, token, user.id]);
    if (!saved.rowCount) return { ok: false as const, preview: await nextNumber(iso, client), message: "หมายเลขถูกใช้แล้ว กรุณายืนยันเลขล่าสุด" };
    const [row] = saved.rows;
    const reservation: InboundReservation = { ...preview, token, reservedAt: row.reserved_at.toISOString(), expiresAt: row.expires_at.toISOString(), status: "reserved" };
    return { ok: true as const, reservation };
  }, connect);
}

export async function saveReceipt(user: AuthenticatedFactoryUser, input: unknown, connect?: Connect) {
  requireFactoryModule(user, "raw_material_receiving");
  const command = object(input);
  const draft = parseReceipt(command.document);
  const { documentNo, receiveDate: date } = draft.header;
  return transaction(async client => {
    const { rows: [stored] } = await client.query<ReceiptRow>(`
      SELECT payload, receive_date::text, token, expires_at, reserved_by::text
      FROM foliar_fertilizer.warehouse_receipts WHERE document_no=$1 FOR UPDATE`, [documentNo]);
    if (!stored || stored.receive_date !== date) throw invalid("กรุณายืนยันเลข INB สำหรับวันที่รับเข้านี้ก่อนบันทึก");
    const previous = stored.payload;
    if (command.version != null) {
      if (!previous || previous.savedAt !== command.version) throw stale();
    } else {
      if (!uuid(command.token) || stored.token !== command.token || stored.reserved_by !== user.id) throw invalid("เลข INB นี้ไม่ได้จองด้วยบัญชีนี้");
      if (previous) {
        if (isDeepStrictEqual(draft, { header: previous.header, items: previous.items, note: previous.note, signers: previous.signers })) return previous;
        throw stale();
      }
      if (stored.expires_at.getTime() <= Date.now()) throw new WarehouseDocumentError(409, "เลขจองหมดอายุ กรุณายืนยันเลข INB ใหม่");
    }
    const at = new Date(Math.max(Date.now(), previous ? Date.parse(previous.savedAt) + 1 : 0)).toISOString();
    const totals = calculateReceivingTotals(draft.items);
    const saved: SavedReceivingDocument = { ...draft, savedAt: at, amountTotal: totals.amountDisplay, quantityByUnit: totals.quantities };
    await client.query("UPDATE foliar_fertilizer.warehouse_receipts SET payload=$2,updated_at=$3,updated_by=$4 WHERE document_no=$1",
      [documentNo, JSON.stringify(saved), at, user.id]);
    return saved;
  }, connect);
}

function parseRequisition(value: unknown): Requisition {
  const raw = object(value);
  const { material_details, wip_materials, ...template } = blankRequisition();
  void material_details;
  void wip_materials;
  const header = fields(template, raw);
  if (header.profile !== "itech" && header.profile !== "ifoam") throw invalid("กรุณาเลือกโรงงาน");
  return {
    ...header,
    material_details: list(raw.material_details, item => fields(newMaterial(""), item)),
    wip_materials: list(raw.wip_materials, item => fields(newWip(""), item)),
  };
}
export async function listRequisitions(user: AuthenticatedFactoryUser, database: ReadDatabase = getFactoryDatabasePool()) {
  requireFactoryModule(user, "material_requisitions");
  const { rows } = await database.query<{ payload: Requisition }>("SELECT payload FROM foliar_fertilizer.warehouse_requisitions WHERE deleted_at IS NULL ORDER BY updated_at DESC, id");
  return rows.map(row => row.payload);
}
export async function writeRequisition(user: AuthenticatedFactoryUser, input: unknown, connect?: Connect) {
  requireFactoryModule(user, "material_requisitions");
  const command = object(input);
  const draft = command.action === "save" ? parseRequisition(command.document) : null;
  const id = draft?.id ?? command.id;
  if ((command.action !== "save" && command.action !== "delete") || (id !== "" && !uuid(id)) || (!draft && !uuid(id)) ||
      (id && typeof command.version !== "string")) throw invalid("รหัสหรือรุ่นเอกสารไม่ถูกต้อง");
  return transaction(async client => {
    const no = draft ? documentNumber(draft.doc_no) : null;
    const found = await client.query<{ payload: Requisition }>(`
      SELECT payload FROM foliar_fertilizer.warehouse_requisitions
      WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id || null]);
    const previous = found.rows[0]?.payload;
    if (id && (!previous || previous.updatedAt !== command.version)) throw stale();
    const at = new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt) + 1 : 0)).toISOString();
    if (!draft) {
      await client.query("UPDATE foliar_fertilizer.warehouse_requisitions SET deleted_at=$2,updated_at=$2,updated_by=$3 WHERE id=$1", [id, at, user.id]);
      return null;
    }
    const duplicates = await client.query<{ payload: Requisition }>(
      "SELECT payload FROM foliar_fertilizer.warehouse_requisitions WHERE lower(document_no)=lower($1) AND deleted_at IS NULL AND id IS DISTINCT FROM $2", [no, id || null],
    );
    const result = saveRequisition([...duplicates.rows.map(row => row.payload), ...(previous ? [previous] : [])], draft, randomUUID(), at);
    if (!result.row) throw invalid(Object.values(result.errors)[0] || "ตรวจสอบข้อมูลใบเบิก");
    const saved = result.row;
    await client.query(`INSERT INTO foliar_fertilizer.warehouse_requisitions (id,document_no,payload,updated_at,updated_by)
      VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET document_no=EXCLUDED.document_no,payload=EXCLUDED.payload,
      updated_at=EXCLUDED.updated_at,updated_by=EXCLUDED.updated_by`, [saved.id, saved.doc_no, JSON.stringify(saved), at, user.id]);
    return saved;
  }, connect);
}
