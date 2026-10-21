import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { createSettingsStore, parseSettingsMaster } from "../src/server/settings-postgres.ts";
import { assertLocalSettingsRequest } from "../src/server/settings-local-access.ts";
import { blankMaster, masterKinds } from "../src/features/master-data/master-domain.ts";

const env = { NODE_ENV: "development", FACTORY_DB_ENABLED: "true", FACTORY_DB_HOST: "localhost", FACTORY_DB_PORT: "5432", FACTORY_DB_NAME: "ionflow_inventory_dev", FACTORY_DB_SCHEMA: "inventory_sandbox", FACTORY_SETTINGS_ENABLED: "true", FACTORY_SETTINGS_DB_USER: "factory_settings_writer", FACTORY_SETTINGS_DB_PASSWORD: "fictional-test-value-not-a-real-password", FACTORY_SETTINGS_APP_ORIGIN: "http://localhost:3002" };
function fixture() {
  let saved = [];
  let pending;
  let failure = "";
  const calls = [];
  const released = [];
  const pool = {
    on() {}, async end() {}, async connect() {
      if (failure === "connect") throw Error(env.FACTORY_SETTINGS_DB_PASSWORD);
      return { release(value) { released.push(value); }, async query(sql, values = []) {
        calls.push({ sql, values });
        if (sql === "BEGIN" || sql === "BEGIN READ ONLY") pending = structuredClone(saved);
        if (sql === "COMMIT") saved = pending;
        if (sql === "ROLLBACK") pending = undefined;
        if (sql.includes("AS safe")) return { rows: [{ safe: failure !== "identity" }] };
        if (sql.startsWith("SELECT payload")) return { rows: structuredClone(pending) };
        if (sql.startsWith("INSERT INTO")) {
          if (failure === "write") throw Error(env.FACTORY_SETTINGS_DB_PASSWORD);
          const payload = JSON.parse(values[6]);
          const old = pending.find((r) => r.payload.id === payload.id);
          if (old) { old.payload = payload; old.version = String(BigInt(old.version) + 1n); }
          else pending.push({ payload, version: "1" });
        }
        return { rows: [] };
      } };
    },
  };
  return { store: createSettingsStore(env, () => pool), calls, released, fail: (kind) => { failure = kind; } };
}
const site = { ...blankMaster("sites", "site-test"), code: "SITE-T", name: "Fictional site" };
test("Settings store reads empty SQL state, creates, updates, reopens and deactivates", async () => {
  const f = fixture();
  assert.deepEqual(await f.store.read(), { rows: [], versions: {} });
  let next = await f.store.save(site, null);
  assert.equal(next.rows[0].name, site.name);
  assert.equal(next.versions[site.id], "1");
  next = await f.store.save({ ...site, name: "Renamed" }, "1");
  assert.equal(next.versions[site.id], "2");
  assert.ok(next.rows[0].aliases.includes(site.name));
  assert.equal((await f.store.read()).rows[0].name, "Renamed");
  await f.store.save({ ...next.rows[0], active: false }, "2");
  assert.equal((await f.store.read()).rows[0].active, false);
  assert.ok(f.calls.some((c) => c.sql.includes("pg_advisory_xact_lock")));
  assert.ok(f.calls.some((c) => c.sql.includes("$7::jsonb") && c.values[6].includes("site-test")));
  await assert.rejects(f.store.remove(), (e) => e.status === 409);
});
test("duplicates, stale versions, missing fields, invalid IDs, parents and changes are rejected", async () => {
  const f = fixture();
  await f.store.save(site, null);
  for (const [row, version] of [[{ ...site, id: "another" }, null], [{ ...site, code: "CHANGED" }, null],
    [{ ...site, name: "" }, "1"], [{ ...site, parentId: "missing" }, "1"], [{ ...site, kind: "units" }, "1"],
    [{ ...site, id: "bad id" }, null], [{ ...site, active: "true" }, "1"], [{ ...site, aliases: [1] }, "1"]])
    await assert.rejects(f.store.save(row, version), (e) => [400, 409].includes(e.status));
  await assert.rejects(f.store.save(site, undefined), (e) => e.status === 400);
  assert.equal((await f.store.read()).rows.length, 1);
  for (const value of [null, [], {}, { ...site, id: "" }]) assert.throws(() => parseSettingsMaster(value));
});
test("write failure rolls back, preserves prior data and redacts driver secrets", async () => {
  const f = fixture();
  await f.store.save(site, null);
  f.fail("write");
  await assert.rejects(f.store.save({ ...site, name: "Not committed" }, "1"), (e) => {
    assert.ok(!`${e.stack} ${JSON.stringify(e)}`.includes(env.FACTORY_SETTINGS_DB_PASSWORD));
    assert.equal(e.status, 503); return true;
  });
  f.fail("");
  assert.equal((await f.store.read()).rows[0].name, site.name);
  assert.ok(f.calls.some((c) => c.sql === "ROLLBACK"));
  f.fail("connect");
  await assert.rejects(f.store.read(), (e) => e.status === 503 && !e.message.includes(env.FACTORY_SETTINGS_DB_PASSWORD));
  f.fail("identity");
  await assert.rejects(f.store.read(), (e) => e.status === 503);
});
test("loopback socket, exact origin, opt-in and development are all required", () => {
  const req = { socket: { remoteAddress: "127.0.0.1" }, headers: { host: "127.0.0.1:4317", origin: env.FACTORY_SETTINGS_APP_ORIGIN } };
  assert.doesNotThrow(() => assertLocalSettingsRequest(req, env));
  for (const headers of [{ ...req.headers, origin: "https://evil.test" }, { ...req.headers, origin: undefined },
    { ...req.headers, host: "evil.test" }, { ...req.headers, "x-forwarded-for": "127.0.0.1" }])
    assert.throws(() => assertLocalSettingsRequest({ ...req, headers }, env));
  for (const remoteAddress of [undefined, "192.168.1.1", "8.8.8.8"])
    assert.throws(() => assertLocalSettingsRequest({ ...req, socket: { remoteAddress } }, env));
  for (const patch of [{ NODE_ENV: "production" }, { FACTORY_SETTINGS_ENABLED: "false" }]) {
    assert.throws(() => assertLocalSettingsRequest(req, { ...env, ...patch }));
    assert.throws(() => createSettingsStore({ ...env, ...patch }));
  }
  for (const patch of [{ FACTORY_SETTINGS_DB_USER: "factory_readonly" }, { FACTORY_SETTINGS_DB_USER: "postgres" },
    { FACTORY_SETTINGS_DB_PASSWORD: "" }, { FACTORY_DB_NAME: "other" }, { FACTORY_DB_SCHEMA: "public" }])
    assert.throws(() => createSettingsStore({ ...env, ...patch }));
});
test("all existing master kinds and visible field controls remain, without a mock fallback", () => {
  assert.equal(Object.keys(masterKinds).length, 14);
  const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const form = read("src/components/factory/master-settings.tsx");
  for (const name of ["code", "name", "type", "parentId", "typeId", "start", "end", "contact", "phone", "active"])
    assert.match(form, new RegExp(`\\b${name}\\b`));
  assert.match(form, /await save\(saved\)/);
  assert.match(form, /disabled=\{busy\}/);
  assert.doesNotMatch(form, /useMasterData/);
  const hook = read("src/components/factory/use-settings-postgres.ts");
  assert.match(hook, /rows: \[\], versions: \{\}/);
  assert.doesNotMatch(hook, /internalMasters|demoMasterSettings|localStorage/);
  const up = read("migrations/0002_settings_masters.up.sql");
  assert.match(up, /ON DELETE RESTRICT/);
  assert.doesNotMatch(up, /INSERT INTO|CASCADE|GRANT|CREATE ROLE/);
});
test("changed server and Settings UI files pass focused TypeScript checks", () => {
  const files = ["src/server/settings-postgres.ts", "src/server/settings-local-access.ts", "src/components/factory/use-settings-postgres.ts", "src/components/factory/master-settings.tsx"].map((f) => fileURLToPath(new URL(`../${f}`, import.meta.url)));
  const configFile = ts.readConfigFile(fileURLToPath(new URL("../tsconfig.json", import.meta.url)), ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, fileURLToPath(new URL("../", import.meta.url)));
  const program = ts.createProgram(files, { ...config.options, incremental: false, noEmit: true });
  const selected = new Set(files.map((f) => f.replaceAll("\\", "/").toLowerCase()));
  const errors = ts.getPreEmitDiagnostics(program).filter((d) => !d.file || selected.has(d.file.fileName.replaceAll("\\", "/").toLowerCase()));
  assert.equal(errors.length, 0, ts.formatDiagnostics(errors, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (f) => f, getNewLine: () => "\n" }));
});
test("real integration checker refuses missing credentials without starting API or exposing secrets", () => {
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--experimental-strip-types", "scripts/settings-postgres.live.mjs"], {
    cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8", windowsHide: true,
    env: { ...process.env, NODE_ENV: "development", FACTORY_SETTINGS_LIVE_TEST: "true",
      FACTORY_SETTINGS_ENABLED: "", FACTORY_SETTINGS_DB_USER: "", FACTORY_SETTINGS_DB_PASSWORD: "" },
  });
  assert.equal(result.status, 2);
  const output = result.stdout + result.stderr;
  assert.match(output, /BLOCKED/);
  assert.match(output, /FACTORY_SETTINGS_DB_PASSWORD/);
  assert.doesNotMatch(output, /Local Settings API listening|status":"PASS/);
  assert.ok(!output.includes(env.FACTORY_SETTINGS_DB_PASSWORD));
});
test("Settings migration is limited to loopback, expected database/schema and migration owner", () => {
  const sql = readFileSync(new URL("../migrations/0002_settings_masters.up.sql", import.meta.url), "utf8");
  assert.match(sql, /inet_server_port\(\) <> 5432/);
  assert.match(sql, /inet_server_addr\(\) NOT IN/);
  assert.match(sql, /current_user IN \('factory_readonly', 'factory_settings_writer'\)/);
  assert.match(sql, /current_database\(\) <> 'ionflow_inventory_dev'/);
  assert.equal((sql.match(/CREATE TABLE /g) || []).length, 1);
  assert.doesNotMatch(sql, /DROP|CASCADE|ALTER ROLE|GRANT|REVOKE/);
});
