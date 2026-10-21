import "server-only";
import { Pool, type PoolConfig } from "pg";
import { readDatabaseConfig } from "./database/config.ts";
import { masterKinds, saveMaster, type MasterRow, type MasterState } from "../features/master-data/master-domain.ts";

export class SettingsError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function parseSettingsMaster(input: unknown): MasterRow {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SettingsError(400, "ข้อมูลไม่ถูกต้อง");
  const v = input as Record<string, unknown>;
  const strings = ["id", "kind", "code", "name", "type", "parentId", "typeId", "start", "end", "contact", "phone"] as const;
  if (strings.some((k) => typeof v[k] !== "string" || (v[k] as string).length > 500) ||
    typeof v.active !== "boolean" || !Array.isArray(v.aliases) || v.aliases.length > 100 ||
    v.aliases.some((a) => typeof a !== "string" || a.length > 100) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(v.id as string) || !Object.hasOwn(masterKinds, v.kind as string))
    throw new SettingsError(400, "รูปแบบข้อมูลหลักไม่ถูกต้อง");
  return Object.fromEntries([...strings.map((key) => [key, v[key]]), ["active", v.active], ["aliases", [...v.aliases]]]) as MasterRow;
}
export type SettingsSnapshot = { rows: MasterRow[]; versions: Record<string, string> };
export function createSettingsStore(
  env = process.env,
  makePool: (options: PoolConfig) => Pick<Pool, "connect" | "on" | "end"> = (options) => new Pool(options),
) {
  if (env.NODE_ENV !== "development" || env.FACTORY_SETTINGS_ENABLED !== "true")
    throw new SettingsError(503, "ยังไม่เปิด Settings PostgreSQL สำหรับ local development");
  if (env.FACTORY_SETTINGS_DB_USER !== "factory_settings_writer" || !env.FACTORY_SETTINGS_DB_PASSWORD)
    throw new SettingsError(503, "ต้องตั้งค่า dedicated Settings write role");
  // Separate identity/pool; the shared read-only database utility is never made writable.
  const c = readDatabaseConfig({ ...env, FACTORY_DB_USER: env.FACTORY_SETTINGS_DB_USER, FACTORY_DB_PASSWORD: env.FACTORY_SETTINGS_DB_PASSWORD });
  if (c.host !== "localhost") throw new SettingsError(503, "ฐานข้อมูลต้องเป็น localhost");
  const pool = makePool({ host: c.host, port: c.port, database: c.database, user: c.user, password: c.password,
    max: c.max, connectionTimeoutMillis: c.connectionTimeoutMillis, idleTimeoutMillis: c.idleTimeoutMillis,
    statement_timeout: c.statementTimeoutMillis, query_timeout: c.statementTimeoutMillis + 1000,
    ssl: false, options: "-c search_path=pg_catalog", application_name: "factory-local-settings" });
  pool.on("error", () => console.error("SETTINGS_IDLE_CONNECTION_FAILED"));
  async function transaction<T>(write: boolean, work: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect().catch(() => { throw new SettingsError(503, "เชื่อมต่อ Settings PostgreSQL ไม่สำเร็จ"); });
    let broken = false;
    try {
      await client.query(write ? "BEGIN" : "BEGIN READ ONLY");
      const identity = await client.query(`SELECT current_database() = $1 AND current_user = $2
        AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
        AND NOT r.rolbypassrls AND NOT r.rolinherit
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles p WHERE p.oid<>r.oid AND pg_catalog.pg_has_role(r.oid,p.oid,'MEMBER'))
        AND NOT pg_catalog.has_schema_privilege(current_user,$3,'CREATE')
        AND NOT pg_catalog.has_database_privilege(current_user,current_database(),'CREATE')
        AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class t JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
          WHERE n.nspname=$3 AND t.relowner=r.oid) AS safe
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`, [c.database, c.user, c.schema]);
      if (identity.rows[0]?.safe !== true) throw new SettingsError(503, "สิทธิ์ Settings runtime role ไม่ปลอดภัย");
      if (write) await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261021, 1)");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { broken = true; }
      if (error instanceof SettingsError) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === "23505") throw new SettingsError(409, "รหัสหรือชื่อซ้ำ");
      if (code === "23503") throw new SettingsError(409, "ข้อมูลอ้างอิงไม่ถูกต้องหรือยังถูกใช้งาน");
      throw new SettingsError(503, "อ่านหรือบันทึก Settings ไม่สำเร็จ โปรดตรวจ schema และสิทธิ์");
    } finally { client.release(broken); }
  }
  async function load(client: import("pg").PoolClient): Promise<SettingsSnapshot> {
    const result = await client.query("SELECT payload, version::text AS version FROM inventory_sandbox.settings_masters ORDER BY kind, code");
    const rows = result.rows.map((r) => parseSettingsMaster(r.payload));
    return { rows, versions: Object.fromEntries(rows.map((row, index) => [row.id, result.rows[index].version])) };
  }
  return {
    read: () => transaction(false, load),
    save: (input: unknown, expectedVersion: unknown) => transaction(true, async (client) => {
      const row = parseSettingsMaster(input);
      if (expectedVersion !== null && (typeof expectedVersion !== "string" || !/^[1-9]\d*$/.test(expectedVersion)))
        throw new SettingsError(400, "เวอร์ชันข้อมูลไม่ถูกต้อง");
      const current = await load(client);
      if ((current.versions[row.id] ?? null) !== expectedVersion) throw new SettingsError(409, "ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่ก่อนบันทึก");
      const state: MasterState = { rows: current.rows, personnel: [], used: [] };
      let next: MasterState;
      try { next = saveMaster(state, row); } catch (error) {
        throw new SettingsError(400, error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง");
      }
      const saved = next.rows.find((r) => r.id === row.id)!;
      await client.query(`INSERT INTO inventory_sandbox.settings_masters (id, kind, code, name, parent_id, type_id, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,parent_id=EXCLUDED.parent_id,
        type_id=EXCLUDED.type_id,payload=EXCLUDED.payload,version=settings_masters.version+1,updated_at=clock_timestamp()`,
        [saved.id, saved.kind, saved.code, saved.name, saved.parentId || null, saved.typeId || null, JSON.stringify(saved)]);
      return load(client);
    }),
    // Other modules still retain demo snapshots; absence of a DB FK is not evidence of no usage.
    remove: async () => { throw new SettingsError(409, "ยังตรวจการอ้างอิงจากโมดูลเดิมไม่ได้ กรุณาปิดใช้งานแทนการลบ"); },
    close: () => pool.end(),
  };
}
