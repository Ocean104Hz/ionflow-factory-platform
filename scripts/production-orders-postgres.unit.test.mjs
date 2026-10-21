import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { parseProductionOrder, validateProductionUpdate } from "../src/features/production-orders/production-order-domain.ts";
import { createProductionStore, assertLocalProductionRequest } from "../src/server/production-orders-postgres.ts";

const env = { NODE_ENV: "development", FACTORY_DB_ENABLED: "true", FACTORY_DB_HOST: "localhost", FACTORY_DB_PORT: "5432", FACTORY_DB_NAME: "ionflow_inventory_dev", FACTORY_DB_SCHEMA: "inventory_sandbox", FACTORY_PRODUCTION_ENABLED: "true", FACTORY_PRODUCTION_DB_USER: "factory_production_writer", FACTORY_PRODUCTION_DB_PASSWORD: "fictional-test-secret", FACTORY_PRODUCTION_APP_ORIGIN: "http://localhost:3000" };
const order = () => ({ id: "test-order", number: "TEST-PO-1", source: "Sales Hub", company: "Fictional test company", salesOrder: "", customer: "Fictional customer", customerCode: "", warehouse: "", date: "2026-10-21", received: "2026-10-21T00:00:00Z", updated: "2026-10-21T00:00:00Z", revision: 1, requestedDate: "2026-10-22", pickup: "2026-10-22T10:00:00+07:00", document: "รับข้อมูลแล้ว", material: "รอตรวจสอบวัตถุดิบ", approval: "รอการอนุมัติจากโรงงาน", production: "ยังไม่เริ่มผลิต", proposal: null, cancellation: null, note: "test only", items: [{ sku: "TEST-SKU", name: "Test product", type: "", quantity: 1.25, unit: "KG", price: 0, note: "row note" }] });
function fixture() {
  let state = { records: [], events: [] }, pending, failure = "";
  const calls = [];
  const client = { release() {}, async query(sql, values = []) {
    calls.push({ sql, values });
    if (sql.startsWith("BEGIN")) pending = structuredClone(state);
    if (sql === "COMMIT") state = pending;
    if (sql === "ROLLBACK") pending = undefined;
    if (sql.includes("AS safe")) return { rows: [{ safe: failure !== "identity" }] };
    if (sql.startsWith("SELECT payload")) return { rows: structuredClone(sql.includes("WHERE id=$1") ? pending.records.filter((r) => r.payload.id === values[0] && (!sql.includes("AND deleted_at IS NULL") || !r.deleted_at)) : pending.records.filter((r) => !r.deleted_at)) };
    if (sql.startsWith("SELECT order_id")) return { rows: structuredClone(pending.events) };
    if (sql.startsWith("INSERT INTO inventory_sandbox.production_orders")) {
      if (failure === "write") throw Error(env.FACTORY_PRODUCTION_DB_PASSWORD);
      const payload = JSON.parse(values[4]), old = pending.records.find((r) => r.payload.id === payload.id);
      if (!old && pending.records.some((r) => r.payload.source === payload.source && r.payload.company === payload.company && r.payload.number === payload.number)) throw Object.assign(Error("duplicate"), { code: "23505" });
      const saved = { payload, version: old ? String(BigInt(old.version) + 1n) : "1", deleted_at: null };
      if (old) Object.assign(old, saved); else pending.records.push(saved);
      return { rows: [{ version: saved.version }] };
    }
    if (sql.startsWith("UPDATE inventory_sandbox.production_orders")) {
      const saved = pending.records.find((r) => r.payload.id === values[0]);
      saved.deleted_at = new Date(); saved.version = String(BigInt(saved.version) + 1n);
      return { rows: [{ version: saved.version }] };
    }
    if (sql.startsWith("INSERT INTO inventory_sandbox.production_order_history")) {
      if (failure === "audit") throw Error("audit failed");
      pending.events.push({ order_id: values[0], title: values[2], description: values[3], recorded_at: new Date() });
    }
    return { rows: [] };
  } };
  const pool = { on() {}, async end() {}, async connect() { if (failure === "connect") throw Error(env.FACTORY_PRODUCTION_DB_PASSWORD); return client; } };
  return { store: createProductionStore(env, () => pool), calls, fail(value) { failure = value; } };
}
test("valid existing fields and optional unresolved references round-trip without invented IDs", () => {
  assert.deepEqual(parseProductionOrder(order()), order());
  validateProductionUpdate(undefined, order());
  const next = { ...order(), items: [...order().items, { ...order().items[0], sku: "TEST-2", quantity: 3, note: "independent" }] };
  assert.equal(parseProductionOrder(next).items[1].note, "independent");
  assert.equal(parseProductionOrder(next).items[0].quantity, 1.25);
});
test("invalid dates, quantities, status, malformed records and nested data are rejected", () => {
  for (const patch of [{ id: "bad id" }, { number: "" }, { customer: "" }, { date: "2026-02-30" }, { pickup: "2026-10-20T10:00:00Z" }, { pickup: "2026-10-22T24:00:00Z" }, { revision: 0 }, { source: "other" }, { items: [] }, { items: [{ ...order().items[0], quantity: -1 }] }, { items: [{ ...order().items[0], quantity: Infinity }] }, { items: [{ ...order().items[0], price: -1 }] }, { proposal: {} }, { cancellation: [] }]) assert.throws(() => parseProductionOrder({ ...order(), ...patch }));
  for (const value of [null, [], {}, "bad"]) assert.throws(() => parseProductionOrder(value));
});
test("identity/source revision, original references and production transitions are protected", () => {
  for (const key of ["id", "number", "source", "company", "salesOrder", "customerCode", "received", "revision"])
    assert.throws(() => validateProductionUpdate(order(), { ...order(), [key]: "changed" }));
  assert.throws(() => validateProductionUpdate(undefined, { ...order(), production: "กำลังผลิต" }));
  assert.throws(() => validateProductionUpdate(order(), { ...order(), approval: "โรงงานอนุมัติ" }));
  const ready = { ...order(), material: "วัตถุดิบพร้อม", approval: "โรงงานอนุมัติ" };
  const started = { ...ready, production: "กำลังผลิต" };
  assert.doesNotThrow(() => validateProductionUpdate(ready, started));
  assert.throws(() => validateProductionUpdate(started, { ...started, items: [] }));
  assert.throws(() => validateProductionUpdate(ready, { ...ready, production: "ผลิตเสร็จแล้ว" }));
  assert.throws(() => validateProductionUpdate(order(), { ...order(), document: "ยกเลิกแล้ว" }));
});
test("SQL-backed repository create/read/update/archive retains identity and audit; no mock fallback", async () => {
  const f = fixture();
  assert.deepEqual(await f.store.read(), { orders: [], versions: {}, history: {} });
  let data = await f.store.save(order(), null);
  assert.equal(data.versions[order().id], "1");
  data = await f.store.save({ ...data.orders[0], note: "changed", items: [{ ...data.orders[0].items[0], note: "retained" }] }, "1");
  assert.equal(data.versions[order().id], "2");
  assert.equal((await f.store.read()).orders[0].items[0].note, "retained");
  assert.equal(data.orders[0].revision, 1);
  assert.equal(data.history[order().id].length, 2);
  assert.equal((await f.store.remove(order().id, "2")).orders.length, 0);
  await assert.rejects(f.store.save(order(), null), (e) => e.status === 409);
  assert.ok(f.calls.some((c) => c.sql.includes("READ ONLY")));
  assert.ok(f.calls.some((c) => c.sql.includes("pg_advisory_xact_lock")));
  assert.ok(f.calls.some((c) => c.sql.includes("$5::jsonb") && c.values[4].includes("TEST-PO-1")));
});
test("stale updates, duplicates, missing records and invalid versions fail safely", async () => {
  const f = fixture(); await f.store.save(order(), null);
  await assert.rejects(f.store.save(order(), null), (e) => e.status === 409);
  await assert.rejects(f.store.save(order(), "2"), (e) => e.status === 409);
  await assert.rejects(f.store.save(order(), undefined), (e) => e.status === 400);
  await assert.rejects(f.store.save({ ...order(), id: "other" }, null), (e) => e.status === 409);
  await assert.rejects(f.store.remove("missing", "1"), (e) => e.status === 409);
  await assert.rejects(f.store.remove("test-order", null), (e) => e.status === 400);
  assert.equal((await f.store.read()).orders.length, 1);
});
test("driver and audit failures roll back and never leak credentials", async () => {
  const f = fixture(); await f.store.save(order(), null);
  for (const failure of ["write", "audit", "connect", "identity"]) {
    f.fail(failure);
    await assert.rejects(f.store.save({ ...order(), note: "not committed" }, "1"), (e) => e.status === 503 && !e.message.includes(env.FACTORY_PRODUCTION_DB_PASSWORD));
    f.fail("");
    assert.equal((await f.store.read()).orders[0].note, "test only");
  }
});
test("development opt-in, separate role, exact database and schema are required", () => {
  for (const patch of [{ NODE_ENV: "production" }, { FACTORY_PRODUCTION_ENABLED: "false" }, { FACTORY_PRODUCTION_DB_USER: "factory_settings_writer" }, { FACTORY_PRODUCTION_DB_USER: "postgres" }, { FACTORY_PRODUCTION_DB_PASSWORD: "" }, { FACTORY_DB_HOST: "remote.test" }, { FACTORY_DB_NAME: "other" }, { FACTORY_DB_SCHEMA: "public" }]) assert.throws(() => createProductionStore({ ...env, ...patch }));
});
test("local API verifies socket AND origin/host and rejects proxies", () => {
  const req = { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "127.0.0.1:4318", origin: env.FACTORY_PRODUCTION_APP_ORIGIN } };
  assert.doesNotThrow(() => assertLocalProductionRequest(req, env));
  for (const headers of [{ ...req.headers, origin: "https://evil.test" }, { ...req.headers, origin: undefined }, { ...req.headers, host: "evil.test" }, { ...req.headers, forwarded: "for=127.0.0.1" }, { ...req.headers, "x-forwarded-host": "localhost" }]) assert.throws(() => assertLocalProductionRequest({ ...req, headers }, env));
  for (const remoteAddress of [undefined, "192.168.1.1", "8.8.8.8"]) assert.throws(() => assertLocalProductionRequest({ ...req, socket: { remoteAddress } }, env));
  assert.throws(() => assertLocalProductionRequest(req, { ...env, NODE_ENV: "production" }));
});
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
test("independent existing field manifest reaches editor and saved detail; no fabricated linked data", () => {
  const editor = read("src/features/production-orders/production-order-editor.tsx");
  const detail = read("src/features/production-orders/production-order-detail.tsx");
  for (const name of ["number", "salesOrder", "company", "customer", "customerCode", "warehouse", "date", "requestedDate", "pickup", "note", "sku", "name", "type", "quantity", "unit", "price"]) assert.match(editor, new RegExp(`\\b${name}\\b`));
  assert.match(editor, /await save\(draft, expectedVersion\)/);
  assert.match(editor, /structuredClone\(existing\)/);
  assert.match(detail, /items=\{order.items\}/);
  assert.match(detail, /await updateOrder/);
  const provider = read("src/features/production-orders/production-orders-provider.tsx");
  assert.match(provider, /orders: \[\]/);
  assert.doesNotMatch(provider, /useDemo|localStorage|productionOrders\s*[,}]/);
  assert.doesNotMatch(detail, /demoDate|driverId|AttachmentGallery|useDemo/);
  assert.match(detail, /ProductionOrderConfirmDialog as ConfirmDialog/);
  const dialog = read("src/features/production-orders/production-order-form-dialog.tsx");
  assert.match(dialog, /await onSubmit\(values\)/);
  assert.match(dialog, /บันทึกเฉพาะ PostgreSQL Local/);
  assert.doesNotMatch(dialog, /เปลี่ยนเฉพาะ demo state/);
  const sql = read("migrations/0003_production_orders.up.sql");
  assert.equal((sql.match(/CREATE TABLE /g) || []).length, 2);
  assert.equal((sql.match(/REFERENCES /g) || []).length, 1);
  assert.match(sql, /REFERENCES inventory_sandbox.production_orders/);
  assert.doesNotMatch(sql, /CASCADE|GRANT|CREATE ROLE|INSERT INTO/);
  const contracts = read("src/features/production-orders/production-order-integrations.ts");
  assert.match(contracts, /UNRESOLVED/);
  assert.match(contracts, /quantity: string/);
  assert.doesNotMatch(contracts, /fetch\(|INSERT|stockMovement|bulk-production/);
});
test("focused TypeScript check for changed Production Orders only", () => {
  const files = ["src/server/production-orders-postgres.ts", "src/features/production-orders/production-order-domain.ts", "src/features/production-orders/production-order-integrations.ts", "src/features/production-orders/production-order-editor.tsx", "src/features/production-orders/production-order-form-dialog.tsx", "src/features/production-orders/production-orders-provider.tsx", "src/features/production-orders/production-order-detail.tsx", "src/features/production-orders/production-order-list.tsx", "app/(factory)/production-orders/layout.tsx", "app/(factory)/production-orders/[productionOrderId]/page.tsx"].map((f) => fileURLToPath(new URL(`../${f}`, import.meta.url)));
  const configFile = ts.readConfigFile(fileURLToPath(new URL("../tsconfig.json", import.meta.url)), ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, fileURLToPath(new URL("../", import.meta.url)));
  const program = ts.createProgram(files, { ...config.options, incremental: false, noEmit: true });
  const selected = new Set(files.map((f) => f.replaceAll("\\", "/").toLowerCase()));
  const errors = ts.getPreEmitDiagnostics(program).filter((d) => !d.file || selected.has(d.file.fileName.replaceAll("\\", "/").toLowerCase()));
  assert.equal(errors.length, 0, ts.formatDiagnostics(errors, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (f) => f, getNewLine: () => "\n" }));
});
test("real verifier blocks missing credentials without starting API or claiming success", () => {
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "scripts/production-orders-postgres.live.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8", windowsHide: true,
    env: { ...process.env, FACTORY_PRODUCTION_LIVE_TEST: "true", FACTORY_PRODUCTION_DB_PASSWORD: "", FACTORY_PRODUCTION_DB_USER: "", FACTORY_PRODUCTION_ENABLED: "" },
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /BLOCKED/);
  assert.match(result.stderr, /FACTORY_PRODUCTION_DB_PASSWORD/);
  assert.doesNotMatch(result.stdout + result.stderr, /status":"PASS|listening on loopback/);
});
