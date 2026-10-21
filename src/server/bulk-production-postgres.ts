import "server-only";
import { Pool, type PoolConfig, type PoolClient } from "pg";
import type { IncomingMessage } from "node:http";
import { readDatabaseConfig } from "./database/config.ts";
import { validateBulkOrder, type BulkOrder, type BulkErrors, type BulkRow } from "../features/bulk-production-orders/bulk-production-domain.ts";

export class BulkDatabaseError extends Error {
  readonly status: number;
  readonly fields: BulkErrors;
  constructor(status: number, message: string, fields: BulkErrors = {}) { super(message); this.status = status; this.fields = fields; }
}
const invalid = (): never => { throw new BulkDatabaseError(400, "โครงสร้างใบสั่งผลิตไม่ถูกต้อง"); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown): string { if (typeof value !== "string" || value.length > 10000) return invalid(); return value; }
function number(value: unknown, nullable = true): number | null {
  if (value === null && nullable) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) return invalid();
  return value;
}
export function parseBulkDocument(input: unknown): BulkOrder {
  const v = object(input), h = object(v.header), s = object(v.docSigners);
  const id = text(v.id);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !Array.isArray(v.rows) || !v.rows.length || v.rows.length > 200) return invalid();
  const rows = v.rows.map((value) => {
    const r = object(value);
    const fields = Object.fromEntries((["id","itemName","product","productCode","qtyUnit","lot","sizeNote","countUnit","prodDate","startTime","endTime","signer","prodDateNote","startTimeNote","endTimeNote","signerNote","carryNote","rowTotalNote"] as const).map((key) => [key, text(r[key])]));
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(fields.id))) return invalid();
    return { ...fields, qty: number(r.qty), size: number(r.size), producedQty: number(r.producedQty), carryQty: number(r.carryQty) } as BulkRow;
  });
  const doc: BulkOrder = { id, header: { date: text(h.date), docNo: text(h.docNo).trim(), planTons: number(h.planTons), producedTons: number(h.producedTons, false)!, targetBags: number(h.targetBags), productionDays: text(h.productionDays), payDate: text(h.payDate) }, rows,
    docSigners: { issuer: text(s.issuer), qc: text(s.qc), production: text(s.production), manager: text(s.manager) }, note: text(v.note), createdAt: text(v.createdAt), updatedAt: text(v.updatedAt) };
  if (doc.header.docNo.length > 200 || doc.header.producedTons < 0) return invalid();
  const fields = validateBulkOrder(doc, []);
  if (Object.keys(fields).length) throw new BulkDatabaseError(400, "กรุณาตรวจสอบข้อมูลใบสั่งผลิต", fields);
  return doc;
}
export function assertBulkLocalRequest(req: Pick<IncomingMessage,"socket" | "headers">, env = process.env) {
  const origin = env.FACTORY_BULK_APP_ORIGIN ?? "http://localhost:3000";
  let url: URL;
  try { url = new URL(origin); } catch { throw new BulkDatabaseError(403, "Local access denied"); }
  if (url.origin !== origin || url.protocol !== "http:" || !["localhost","127.0.0.1"].includes(url.hostname) || url.username || url.password || env.NODE_ENV !== "development" || env.FACTORY_BULK_ENABLED !== "true" || req.headers.host !== "127.0.0.1:4319" || req.headers.origin !== origin || !["127.0.0.1","::1","::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "") || req.headers.forwarded || req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"]) throw new BulkDatabaseError(403, "Local access denied");
}
export type BulkSnapshot = { records: BulkOrder[]; versions: Record<string, string> };
export function createBulkStore(env = process.env, makePool: (c: PoolConfig) => Pick<Pool,"on" | "connect" | "end"> = (c) => new Pool(c)) {
  if (env.NODE_ENV !== "development" || env.FACTORY_BULK_ENABLED !== "true" || env.FACTORY_BULK_DB_USER !== "factory_bulk_writer" || !env.FACTORY_BULK_DB_PASSWORD) throw new BulkDatabaseError(503, "ยังไม่เปิด Bulk PostgreSQL Local พร้อม dedicated writer");
  const c = readDatabaseConfig({ ...env, FACTORY_DB_USER: env.FACTORY_BULK_DB_USER, FACTORY_DB_PASSWORD: env.FACTORY_BULK_DB_PASSWORD });
  if (c.host !== "localhost") throw new BulkDatabaseError(503, "อนุญาตเฉพาะ localhost");
  const pool = makePool({ host: c.host, port: c.port, database: c.database, user: c.user, password: c.password, ssl: false, max: c.max, connectionTimeoutMillis: c.connectionTimeoutMillis, idleTimeoutMillis: c.idleTimeoutMillis, statement_timeout: c.statementTimeoutMillis, query_timeout: c.statementTimeoutMillis + 1000, options: "-c search_path=pg_catalog" });
  pool.on("error", () => console.error("BULK_IDLE_CONNECTION_FAILED"));
  async function transaction<T>(write: boolean, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect().catch(() => { throw new BulkDatabaseError(503, "เชื่อมต่อ Bulk PostgreSQL ไม่ได้"); });
    let broken = false;
    try {
      await client.query(write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const identity = await client.query(`SELECT current_database()=$1 AND current_user=$2
        AND inet_server_port()=5432 AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
        AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND NOT has_schema_privilege(current_user,$3,'CREATE') AND NOT has_database_privilege(current_user,current_database(),'CREATE')
        AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER'))
        AND NOT EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$3 AND t.relowner=r.oid) AS safe
        FROM pg_roles r WHERE rolname=current_user`, [c.database,c.user,c.schema]);
      if (identity.rows[0]?.safe !== true) throw new BulkDatabaseError(503, "Bulk runtime role ไม่ตรงข้อกำหนด");
      if (write) await client.query("SELECT pg_advisory_xact_lock(20261021,4)");
      const result = await fn(client); await client.query("COMMIT"); return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { broken = true; }
      if (error instanceof BulkDatabaseError) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      throw new BulkDatabaseError(code === "23505" ? 409 : 503, code === "23505" ? "เลขที่เอกสารซ้ำ รวมเอกสารที่เก็บถาวร" : "Bulk PostgreSQL ไม่พร้อมใช้งาน", code === "23505" ? { "header.docNo": "เลขที่เอกสารซ้ำ" } : {});
    } finally { client.release(broken); }
  }
  async function snapshot(client: PoolClient): Promise<BulkSnapshot> {
    const result = await client.query("SELECT payload,version::text AS version FROM inventory_sandbox.bulk_production_orders WHERE archived_at IS NULL ORDER BY updated_at DESC,id");
    const records = result.rows.map((r) => parseBulkDocument(r.payload));
    return { records, versions: Object.fromEntries(records.map((r,i) => [r.id,result.rows[i].version])) };
  }
  return {
    read: () => transaction(false,snapshot),
    save: (input: unknown, expectedVersion: unknown) => transaction(true,async (client) => {
      const doc = parseBulkDocument(input);
      if (expectedVersion !== null && (typeof expectedVersion !== "string" || !/^[1-9]\d*$/.test(expectedVersion))) throw new BulkDatabaseError(400,"Version ไม่ถูกต้อง");
      const previous = (await client.query("SELECT payload,version::text AS version,archived_at FROM inventory_sandbox.bulk_production_orders WHERE id=$1 FOR UPDATE",[doc.id])).rows[0];
      if (previous?.archived_at || (previous?.version ?? null) !== expectedVersion) throw new BulkDatabaseError(409,"เอกสารเปลี่ยนแล้วหรือถูกเก็บถาวร กรุณาโหลดใหม่ก่อนแก้ไข");
      const now = new Date().toISOString();
      doc.createdAt = previous ? parseBulkDocument(previous.payload).createdAt : now; doc.updatedAt = now;
      // Preserve the established source alias; producedTons is not actual output.
      doc.header.producedTons = doc.header.planTons ?? 0;
      await client.query(`INSERT INTO inventory_sandbox.bulk_production_orders(id,doc_no,payload) VALUES($1,$2,$3::jsonb)
        ON CONFLICT(id) DO UPDATE SET doc_no=EXCLUDED.doc_no,payload=EXCLUDED.payload,version=bulk_production_orders.version+1,updated_at=clock_timestamp()`,[doc.id,doc.header.docNo,JSON.stringify(doc)]);
      return snapshot(client);
    }),
    archive: (id: unknown, expectedVersion: unknown) => transaction(true,async (client) => {
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || typeof expectedVersion !== "string" || !/^[1-9]\d*$/.test(expectedVersion)) throw new BulkDatabaseError(400,"รหัสหรือ Version ไม่ถูกต้อง");
      const result = await client.query("UPDATE inventory_sandbox.bulk_production_orders SET archived_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 WHERE id=$1 AND version=$2::bigint AND archived_at IS NULL RETURNING id",[id,expectedVersion]);
      if (!result.rows.length) throw new BulkDatabaseError(409,"ไม่พบเอกสารปัจจุบันหรือ Version เปลี่ยนแล้ว");
      return snapshot(client);
    }),
    close: () => pool.end(),
  };
}
