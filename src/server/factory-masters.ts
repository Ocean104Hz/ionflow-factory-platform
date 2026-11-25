import "server-only";
import type { PoolClient } from "pg";
import { saveMaster } from "../features/master-data/master-domain.ts";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { parseSettingsMaster, SettingsError, type SettingsSnapshot } from "./settings-postgres.ts";

export async function loadMasters(client: PoolClient): Promise<SettingsSnapshot> {
  const result = await client.query(
    "SELECT payload, version::text AS version FROM foliar_fertilizer.settings_masters ORDER BY kind, code",
  );
  return {
    rows: result.rows.map((row) => parseSettingsMaster(row.payload)),
    versions: Object.fromEntries(result.rows.map((row) => [row.payload.id, row.version])),
  };
}

export async function readFactoryMasters() {
  const client = await getFactoryDatabasePool().connect();
  try {
    return await loadMasters(client);
  } finally {
    client.release();
  }
}

export async function readFactoryPersonnel() {
  const result = await getFactoryDatabasePool().query(
    `SELECT u.id::text, u.display_name AS "displayName",
            EXISTS (SELECT 1 FROM foliar_fertilizer.app_user_roles ur
              JOIN foliar_fertilizer.app_roles r ON r.id=ur.role_id
              WHERE ur.user_id=u.id AND r.code='factory_admin' AND r.is_active) AS admin
       FROM foliar_fertilizer.app_users u WHERE u.is_active ORDER BY u.display_name, u.id`,
  );
  return result.rows.map((row) => ({
    id: String(row.id), displayName: String(row.displayName), email: "", department: "",
    role: row.admin ? "ผู้ดูแลโรงงาน" : "พนักงาน", active: true, modules: [],
  }));
}

export async function saveFactoryMaster(input: unknown, version: unknown, connect = () => getFactoryDatabasePool().connect()) {
  const row = parseSettingsMaster(input);
  if (version !== null && (typeof version !== "string" || !/^[1-9]\d*$/.test(version))) {
    throw new SettingsError(400, "เวอร์ชันข้อมูลไม่ถูกต้อง");
  }
  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261125, 1)");
    const current = await loadMasters(client);
    if ((current.versions[row.id] ?? null) !== version) {
      throw new SettingsError(409, "ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก");
    }
    const existing = current.rows.find((item) => item.id === row.id);
    if (existing && existing.kind !== row.kind) throw new SettingsError(400, "เปลี่ยนหมวดของข้อมูลเดิมไม่ได้");
    let saved;
    try {
      const state = saveMaster({ rows: current.rows, personnel: [], used: [] }, row);
      saved = state.rows.find((item) => item.id === row.id)!;
    } catch (error) {
      throw new SettingsError(400, error instanceof Error ? error.message : "ข้อมูลหลักไม่ถูกต้อง");
    }
    await client.query(
      `INSERT INTO foliar_fertilizer.settings_masters (id, kind, code, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, payload = EXCLUDED.payload,
         version = settings_masters.version + 1, updated_at = now()`,
      [saved.id, saved.kind, saved.code, JSON.stringify(saved)],
    );
    const next = await loadMasters(client);
    await client.query("COMMIT");
    return next;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}
