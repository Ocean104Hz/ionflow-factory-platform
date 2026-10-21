import "server-only";
import { Pool, type PoolConfig, type PoolClient } from "pg";
import { readDatabaseConfig } from "./database/config.ts";
import { parseProductionOrder, validateProductionUpdate, ProductionOrderError } from "../features/production-orders/production-order-domain.ts";
import type { ProductionOrder } from "../lib/mock-data/index.ts";
import type { IncomingMessage } from "node:http";

export function assertLocalProductionRequest(req: Pick<IncomingMessage, "socket" | "headers">, env = process.env): void {
  const origin = env.FACTORY_PRODUCTION_APP_ORIGIN ?? "http://localhost:3000";
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new ProductionOrderError(403, "Local access denied"); }
  if (parsed.origin !== origin || parsed.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsed.hostname) || parsed.username || parsed.password ||
    env.NODE_ENV !== "development" || env.FACTORY_PRODUCTION_ENABLED !== "true" || req.headers.host !== "127.0.0.1:4318" || req.headers.origin !== origin ||
    !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "") || req.headers.forwarded || req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"])
    throw new ProductionOrderError(403, "Local access denied");
}

export type ProductionSnapshot = { orders: ProductionOrder[]; versions: Record<string, string>; history: Record<string, { title: string; at: string; description: string }[]> };
export function createProductionStore(env = process.env, makePool: (options: PoolConfig) => Pick<Pool, "connect" | "on" | "end"> = (options) => new Pool(options)) {
  if (env.NODE_ENV !== "development" || env.FACTORY_PRODUCTION_ENABLED !== "true" || env.FACTORY_PRODUCTION_DB_USER !== "factory_production_writer" || !env.FACTORY_PRODUCTION_DB_PASSWORD) throw new ProductionOrderError(503, "ต้องเปิด Local Production Orders พร้อม dedicated write role");
  const c = readDatabaseConfig({ ...env, FACTORY_DB_USER: env.FACTORY_PRODUCTION_DB_USER, FACTORY_DB_PASSWORD: env.FACTORY_PRODUCTION_DB_PASSWORD });
  if (c.host !== "localhost") throw new ProductionOrderError(503, "อนุญาตเฉพาะ localhost");
  const pool = makePool({ host: c.host, port: c.port, database: c.database, user: c.user, password: c.password, ssl: false,
    max: c.max, connectionTimeoutMillis: c.connectionTimeoutMillis, idleTimeoutMillis: c.idleTimeoutMillis,
    statement_timeout: c.statementTimeoutMillis, query_timeout: c.statementTimeoutMillis + 1000, options: "-c search_path=pg_catalog" });
  pool.on("error", () => console.error("PRODUCTION_IDLE_CONNECTION_FAILED"));
  async function transaction<T>(write: boolean, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect().catch(() => { throw new ProductionOrderError(503, "เชื่อมต่อ Production Orders PostgreSQL ไม่ได้"); });
    let broken = false;
    try {
      await client.query(write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const identity = await client.query(`SELECT current_database()=$1 AND current_user=$2 AND NOT r.rolsuper
        AND inet_server_port()=5432 AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
        AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND NOT has_schema_privilege(current_user,$3,'CREATE') AND NOT has_database_privilege(current_user,current_database(),'CREATE')
        AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER'))
        AND NOT EXISTS(SELECT 1 FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$3 AND t.relowner=r.oid) AS safe
        FROM pg_roles r WHERE rolname=current_user`, [c.database, c.user, c.schema]);
      if (identity.rows[0]?.safe !== true) throw new ProductionOrderError(503, "Runtime role ไม่ตรงข้อกำหนด");
      if (write) await client.query("SELECT pg_advisory_xact_lock(20261021,3)");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { broken = true; }
      if (error instanceof ProductionOrderError) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      throw new ProductionOrderError(code === "23505" ? 409 : 503, code === "23505" ? "เลขเอกสารซ้ำในต้นทางและบริษัทเดียวกัน" : "Production Orders PostgreSQL ไม่พร้อมใช้งาน");
    } finally { client.release(broken); }
  }
  async function snapshot(client: PoolClient): Promise<ProductionSnapshot> {
    const records = await client.query("SELECT payload,version::text AS version FROM inventory_sandbox.production_orders WHERE deleted_at IS NULL ORDER BY updated_at DESC,id");
    const orders = records.rows.map((r) => parseProductionOrder(r.payload));
    const history: ProductionSnapshot["history"] = {};
    const events = await client.query("SELECT order_id,title,description,recorded_at FROM inventory_sandbox.production_order_history ORDER BY order_id,record_version DESC");
    for (const r of events.rows) (history[r.order_id] ??= []).push({ title: r.title, at: r.recorded_at.toISOString(), description: r.description });
    return { orders, versions: Object.fromEntries(orders.map((row, i) => [row.id, records.rows[i].version])), history };
  }
  return {
    read: () => transaction(false, snapshot),
    save: (input: unknown, expectedVersion: unknown, description?: unknown) => transaction(true, async (client) => {
      const order = parseProductionOrder(input);
      if (description !== undefined && (typeof description !== "string" || description.length > 2000)) throw new ProductionOrderError(400, "หมายเหตุการแก้ไขไม่ถูกต้อง");
      if (expectedVersion !== null && (typeof expectedVersion !== "string" || !/^[1-9]\d*$/.test(expectedVersion))) throw new ProductionOrderError(400, "Record version ไม่ถูกต้อง");
      const found = await client.query("SELECT payload,version::text AS version,deleted_at FROM inventory_sandbox.production_orders WHERE id=$1 FOR UPDATE", [order.id]);
      const existing = found.rows[0];
      if (existing?.deleted_at || (existing?.version ?? null) !== expectedVersion) throw new ProductionOrderError(409, "เอกสารเปลี่ยนแล้วหรือถูกเก็บถาวร กรุณาโหลดใหม่");
      validateProductionUpdate(existing ? parseProductionOrder(existing.payload) : undefined, order);
      order.updated = new Date().toISOString();
      const saved = await client.query(`INSERT INTO inventory_sandbox.production_orders(id,source,number,company,payload)
        VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,
        version=production_orders.version+1,updated_at=clock_timestamp() RETURNING version::text AS version`, [order.id, order.source, order.number, order.company, JSON.stringify(order)]);
      await client.query(`INSERT INTO inventory_sandbox.production_order_history(order_id,record_version,title,description,actor)
        VALUES($1,$2,$3,$4,'LOCAL_DEVELOPMENT')`, [order.id, saved.rows[0].version, existing ? "บันทึกการแก้ไข Local" : "สร้างเอกสาร Local", `${description ?? ""}\nบันทึก PostgreSQL เท่านั้น ไม่โพสต์ stock หรือส่งไปต้นทาง`.trim()]);
      return snapshot(client);
    }),
    remove: (id: string, expectedVersion: unknown) => transaction(true, async (client) => {
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || typeof expectedVersion !== "string" || !/^[1-9]\d*$/.test(expectedVersion)) throw new ProductionOrderError(400, "รหัสหรือ version ไม่ถูกต้อง");
      const rows = await client.query("SELECT payload,version::text AS version FROM inventory_sandbox.production_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [id]);
      const row = rows.rows[0];
      if (!row || row.version !== expectedVersion) throw new ProductionOrderError(409, "ไม่พบเอกสารปัจจุบันหรือ version เปลี่ยนแล้ว");
      if (parseProductionOrder(row.payload).production !== "ยังไม่เริ่มผลิต") throw new ProductionOrderError(409, "เริ่มผลิตแล้วเก็บถาวรไม่ได้");
      const result = await client.query("UPDATE inventory_sandbox.production_orders SET deleted_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1 WHERE id=$1 RETURNING version::text AS version", [id]);
      await client.query("INSERT INTO inventory_sandbox.production_order_history(order_id,record_version,title,description,actor) VALUES($1,$2,$3,$4,'LOCAL_DEVELOPMENT')", [id, result.rows[0].version, "เก็บเอกสาร Local ถาวร", "คง identity และประวัติ ไม่ลบข้อมูลธุรกิจ"]);
      return snapshot(client);
    }),
    close: () => pool.end(),
  };
}
