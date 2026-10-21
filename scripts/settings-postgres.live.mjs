// Explicit real PostgreSQL/API check. Never loads demo fixtures or injects a fake pool.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSettingsStore } from "../src/server/settings-postgres.ts";
import { settingsLocalOrigin } from "../src/server/settings-local-access.ts";
import { blankMaster, masterKinds, parentKinds } from "../src/features/master-data/master-domain.ts";

const required = ["FACTORY_SETTINGS_ENABLED", "FACTORY_SETTINGS_DB_USER", "FACTORY_SETTINGS_DB_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (process.env.NODE_ENV !== "development" || process.env.FACTORY_SETTINGS_LIVE_TEST !== "true" || missing.length) {
  console.error(JSON.stringify({ status: "BLOCKED", requiredMode: "development + FACTORY_SETTINGS_LIVE_TEST=true", missing }));
  process.exit(2);
}
// createSettingsStore revalidates the exact local target, opt-in and dedicated writer identity.
const store = createSettingsStore();
const origin = settingsLocalOrigin();
const root = fileURLToPath(new URL("../", import.meta.url));
const endpoint = "http://127.0.0.1:4317/masters";
const run = randomUUID();
const created = new Set();
const checks = [];
let child;
let exitPromise;

async function api(method = "GET", body, expected = 200, headers = {}) {
  const response = await fetch(endpoint, { method, signal: AbortSignal.timeout(10000),
    headers: { Origin: origin, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.status, expected, "Unexpected local Settings API status");
  const result = await response.json();
  assert.equal(result.ok, expected === 200);
  return result.data;
}
async function start() {
  // Do not attach to, kill, or accidentally test an unrelated process on this port.
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(4317, "127.0.0.1", resolve); });
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  child = spawn(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "scripts/settings-local-server.mjs"], {
    cwd: root, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  exitPromise = new Promise((resolve) => { child.once("exit", resolve); child.once("error", resolve); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("Settings API startup timed out")), 10000);
    let output = "";
    child.stdout.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-500);
      if (output.includes("Local Settings API listening on loopback port 4317")) { clearTimeout(timeout); resolve(); }
    });
    child.stderr.resume(); // Do not echo driver/child details into the test report.
    child.once("error", () => { clearTimeout(timeout); reject(Error("Settings API process failed")); });
    child.once("exit", () => { clearTimeout(timeout); reject(Error("Settings API exited before verification")); });
  });
}
async function stop() {
  if (!child) return;
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  await exitPromise;
  child = undefined;
}
const findOwn = (snapshot, id) => snapshot.rows.find((row) => row.id === id);
const records = Object.keys(masterKinds).map((kind) => ({
  ...blankMaster(kind, `settings-live-${run}-${kind}`),
  code: `ST-${run.slice(0, 8)}-${kind}`.toUpperCase(), name: `LOCAL CRUD TEST ${run.slice(0, 8)} ${kind}`,
}));
const siteId = records.find((row) => row.kind === "sites").id;
const typeId = records.find((row) => row.kind === "vehicleTypes").id;
for (const row of records) {
  if (parentKinds[row.kind]?.includes("sites")) row.parentId = siteId;
  if (row.kind === "departments") row.type = "ฝ่าย";
  if (row.kind === "warehouses") row.type = "คลังสินค้า";
  if (row.kind === "vehicleTypes") row.type = "รถยก";
  if (row.kind === "vehicles") row.typeId = typeId;
  if (row.kind === "shifts") { row.start = "08:00"; row.end = "17:00"; }
}
try {
  await store.read(); // Fail before HTTP startup if the real schema/role is not ready.
  await start();
  for (const row of records) {
    const next = await api("POST", { row, expectedVersion: null });
    created.add(row.id);
    assert.equal(findOwn(next, row.id)?.name, row.name);
  }
  checks.push("CREATE and READ all 14 categories");
  const row = records[0];
  let snapshot = await api();
  const version = snapshot.versions[row.id];
  snapshot = await api("POST", { row: { ...findOwn(snapshot, row.id), name: `${row.name} UPDATED` }, expectedVersion: version });
  assert.equal(findOwn(await api(), row.id)?.name, `${row.name} UPDATED`);
  checks.push("UPDATE + independent HTTP reread");
  const duplicate = { ...row, id: `settings-live-${run}-duplicate` };
  await api("POST", { row: duplicate, expectedVersion: null }, 400);
  await api("POST", { row, expectedVersion: version }, 409);
  await api("POST", { row: { ...row, id: "bad id" }, expectedVersion: null }, 400);
  await api("POST", { row: { ...row, name: "" }, expectedVersion: snapshot.versions[row.id] }, 400);
  await api("GET", undefined, 403, { Origin: "https://untrusted.invalid" });
  await api("DELETE", undefined, 409);
  checks.push("duplicate / stale / invalid / origin / physical-delete rejection");
  await stop();
  await start();
  snapshot = await api();
  assert.equal(findOwn(snapshot, row.id)?.name, `${row.name} UPDATED`);
  for (const own of records) assert.ok(findOwn(snapshot, own.id));
  checks.push("persistence after owned API process restart");
} catch (error) {
  process.exitCode = 1;
  console.error(JSON.stringify({ status: "FAIL", check: "real Settings CRUD", code: typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "VERIFICATION_FAILED" }));
} finally {
  // Cleanup is supported deactivation only. Never grant DELETE or remove historical references.
  try {
    for (const id of created) {
      const snapshot = await store.read();
      const row = findOwn(snapshot, id);
      if (row?.active) await store.save({ ...row, active: false }, snapshot.versions[id]);
    }
    if (created.size) {
      const final = await store.read();
      for (const id of created) assert.equal(findOwn(final, id)?.active, false);
      checks.push("direct PostgreSQL reread: test records deactivated and retained");
    }
  } catch {
    process.exitCode = 1;
    console.error("FAIL: test-record deactivation could not be verified; no deletion attempted");
  }
  await stop();
  await store.close();
}
if (!process.exitCode) console.log(JSON.stringify({ status: "PASS", checks, retainedInactiveTestIds: [...created] }));
