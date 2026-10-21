// Explicit live local test only. Creates its own TEST record, never imports demo/user data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { readDatabaseConfig } from "../src/server/database/config.ts";

const required = ["FACTORY_PRODUCTION_DB_PASSWORD", "FACTORY_PRODUCTION_DB_USER", "FACTORY_PRODUCTION_ENABLED"];
const missing = required.filter((key) => !process.env[key]);
if (process.env.FACTORY_PRODUCTION_LIVE_TEST !== "true" || missing.length) {
  console.error(JSON.stringify({ status: "BLOCKED", missing: [...missing, ...(process.env.FACTORY_PRODUCTION_LIVE_TEST !== "true" ? ["FACTORY_PRODUCTION_LIVE_TEST=true"] : [])] })); process.exit(2);
}
const c = readDatabaseConfig({ ...process.env, FACTORY_DB_USER: process.env.FACTORY_PRODUCTION_DB_USER, FACTORY_DB_PASSWORD: process.env.FACTORY_PRODUCTION_DB_PASSWORD });
if (process.env.NODE_ENV !== "development" || c.host !== "localhost" || c.user !== "factory_production_writer" || process.env.FACTORY_PRODUCTION_ENABLED !== "true") throw Error("LOCAL_PRODUCTION_TARGET_REJECTED");
const origin = process.env.FACTORY_PRODUCTION_APP_ORIGIN ?? "http://localhost:3000";
const db = new pg.Client({ host: c.host, port: c.port, database: c.database, user: c.user, password: c.password, ssl: false, connectionTimeoutMillis: 5000, options: "-c search_path=pg_catalog -c statement_timeout=5000" });
let child, created = false, version;
const id = `po-live-${randomUUID()}`;
async function start() {
  child = spawn(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "scripts/production-orders-local-server.mjs"], { env: process.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  // Never relay child stderr: a driver/config failure must not expose connection details.
  child.stderr.resume();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("LOCAL_API_START_TIMEOUT")), 8000);
    child.once("error", () => { clearTimeout(timer); reject(Error("LOCAL_API_START_FAILED")); });
    child.once("exit", () => { clearTimeout(timer); reject(Error("LOCAL_API_START_FAILED")); });
    child.stdout.on("data", (chunk) => { if (chunk.toString().includes("listening on loopback port 4318")) { clearTimeout(timer); resolve(); } });
  });
}
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill(); await exited; }
  child = undefined;
}
async function api(method = "GET", body, expected = 200, requestOrigin = origin) {
  const response = await fetch("http://127.0.0.1:4318/orders", { method, headers: { Origin: requestOrigin, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
  assert.equal(response.status, expected, "API_STATUS_MISMATCH");
  const result = await response.json();
  return result.data;
}
try {
  await db.connect();
  const identity = (await db.query(`SELECT current_database() AS database,current_user AS role,
    to_regnamespace('inventory_sandbox') IS NOT NULL AS schema_exists,
    inet_server_port()=5432 AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet) AS local,
    NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls AS restricted,
    NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER')) AS no_membership,
    NOT has_schema_privilege(current_user,'inventory_sandbox','CREATE') AND NOT has_database_privilege(current_user,current_database(),'CREATE') AS no_create
    FROM pg_roles r WHERE rolname=current_user`)).rows[0];
  assert.equal(identity.database, "ionflow_inventory_dev"); assert.equal(identity.role, "factory_production_writer");
  for (const key of ["schema_exists", "local", "restricted", "no_membership", "no_create"]) assert.equal(identity[key], true, `ROLE_${key}_FAILED`);
  const permissions = (await db.query(`SELECT
    has_table_privilege(current_user,'inventory_sandbox.production_orders','SELECT') AND has_table_privilege(current_user,'inventory_sandbox.production_orders','INSERT') AND has_table_privilege(current_user,'inventory_sandbox.production_orders','UPDATE') AS orders_crud,
    has_table_privilege(current_user,'inventory_sandbox.production_order_history','SELECT') AND has_table_privilege(current_user,'inventory_sandbox.production_order_history','INSERT') AS audit_append,
    NOT has_table_privilege(current_user,'inventory_sandbox.production_orders','DELETE,TRUNCATE,TRIGGER') AND NOT has_table_privilege(current_user,'inventory_sandbox.production_order_history','UPDATE,DELETE,TRUNCATE,TRIGGER') AS denied_destructive`)).rows[0];
  assert.ok(Object.values(permissions).every((v) => v === true), "ROLE_PERMISSIONS_FAILED");
  await start();
  await api("GET", undefined, 403, "https://not-authorized.invalid");
  const at = new Date().toISOString(), day = at.slice(0,10);
  const input = { id, number: id, company: "LIVE TEST ONLY", customer: "LIVE TEST ONLY", source: "Sales Hub", salesOrder: "", customerCode: "", warehouse: "", date: day, received: at, updated: at, revision: 1, requestedDate: day, pickup: `${day}T23:00:00Z`, document: "รับข้อมูลแล้ว", material: "รอตรวจสอบวัตถุดิบ", approval: "รอการอนุมัติจากโรงงาน", production: "ยังไม่เริ่มผลิต", proposal: null, cancellation: null, note: "temporary live verification, not a real upstream order", items: [1,2].map((n) => ({ sku: `LIVE-TEST-${n}`, name: `Live test item ${n}`, type: "", quantity: n, unit: "KG", price: 0, note: `independent ${n}` })) };
  let data = await api("POST", { order: input, expectedVersion: null }); created = true; version = data.versions[id];
  assert.equal((await api()).orders.find((r) => r.id === id).items.length, 2);
  await api("POST", { order: { ...input, id: `${id}-duplicate` }, expectedVersion: null }, 409);
  await api("POST", { order: { ...input, items: [] }, expectedVersion: null }, 400);
  // A local order must not fabricate an upstream cancellation request.
  await api("POST", { order: { ...input, document: "ยกเลิกแล้ว" }, expectedVersion: version }, 400);
  data = await api("POST", { order: { ...input, note: "updated and persisted" }, expectedVersion: version });
  const oldVersion = version; version = data.versions[id];
  await api("POST", { order: input, expectedVersion: oldVersion }, 409);
  assert.equal((await api()).orders.find((r) => r.id === id).note, "updated and persisted");
  await stop(); await start();
  assert.equal((await api()).orders.find((r) => r.id === id).note, "updated and persisted");
  const stored = (await db.query("SELECT payload,version::text FROM inventory_sandbox.production_orders WHERE id=$1", [id])).rows[0];
  assert.equal(stored.payload.note, "updated and persisted"); assert.equal(stored.version, version);
  await api("DELETE", { id, expectedVersion: version }); created = false;
  const archived = (await db.query("SELECT deleted_at IS NOT NULL AS archived FROM inventory_sandbox.production_orders WHERE id=$1", [id])).rows[0];
  assert.equal(archived.archived, true);
  console.log(JSON.stringify({ status: "PASS", database: identity.database, schema: "inventory_sandbox", role: identity.role, crud: "create/read/update/archive", duplicateValidation: "PASS", staleVersionConflict: "PASS", upstreamCancellationGuard: "PASS", apiRestartPersistence: "PASS", permissions, testRecord: id, cleanup: "test record archived; audit retained" }));
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "LIVE_PRODUCTION_VERIFICATION_FAILED";
  console.error(JSON.stringify({ status: "FAIL", code, testRecord: id, cleanupRequired: created })); process.exitCode = 1;
} finally {
  if (created && child) { try { await api("DELETE", { id, expectedVersion: version }); } catch {} }
  await stop(); await db.end().catch(() => {});
}
