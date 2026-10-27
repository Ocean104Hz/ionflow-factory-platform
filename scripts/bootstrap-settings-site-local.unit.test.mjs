import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  acquireSiteBootstrapLock,
  applyInitialSiteBootstrap,
  readSiteBootstrapConfig,
  SITE_BOOTSTRAP_APPROVAL,
} from "./bootstrap-settings-site-local.mjs";

const approvedEnv = Object.freeze({
  NODE_ENV: "development",
  FACTORY_SETTINGS_SITE_BOOTSTRAP_APPROVED: SITE_BOOTSTRAP_APPROVAL,
  FACTORY_DB_HOST: "localhost",
  FACTORY_DB_PORT: "5432",
  FACTORY_DB_NAME: "ionflow_inventory_dev",
  FACTORY_DB_SCHEMA: "inventory_sandbox",
  FACTORY_SETTINGS_ENABLED: "true",
  FACTORY_SETTINGS_DB_USER: "factory_settings_writer",
  FACTORY_SETTINGS_DB_PASSWORD: "unit-test-placeholder",
  FACTORY_SETTINGS_BOOTSTRAP_SITE_ID: "ionflow-factory-local",
  FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE: "DEV-FACTORY-01",
  FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME: "IonFlow Factory Local",
});

const inactiveTestSite = Object.freeze({
  id: "settings-live-existing-sites",
  kind: "sites",
  code: "ST-EXISTING-SITES",
  name: "LOCAL CRUD TEST sites UPDATED",
  active: false,
  type: "",
  parentId: "",
  typeId: "",
  start: "",
  end: "",
  contact: "",
  phone: "",
  aliases: [],
});

function fakeStore(initialRows = [inactiveTestSite], options = {}) {
  let rows = structuredClone(initialRows);
  const versions = Object.fromEntries(rows.map((row) => [row.id, "1"]));
  let reads = 0;
  return {
    rows: () => structuredClone(rows),
    async read() {
      reads += 1;
      if (options.failReadback && reads > 1) throw new Error("READ_FAILED");
      return { rows: structuredClone(rows), versions: { ...versions } };
    },
    async save(row, expectedVersion) {
      assert.equal(expectedVersion, null);
      if (options.failSave) throw new Error("SAVE_ROLLED_BACK");
      rows.push(structuredClone(row));
      versions[row.id] = "1";
      return { rows: structuredClone(rows), versions: { ...versions } };
    },
  };
}

test("configuration accepts only the exact approved local Settings target and inputs", () => {
  const config = readSiteBootstrapConfig(approvedEnv, ["--execute"], []);
  assert.deepEqual(config.site, {
    id: "ionflow-factory-local",
    code: "DEV-FACTORY-01",
    name: "IonFlow Factory Local",
  });
  for (const [patch, error] of [
    [{ NODE_ENV: "production" }, "LOCAL_DEVELOPMENT_EXECUTION_REQUIRED"],
    [{ FACTORY_SETTINGS_SITE_BOOTSTRAP_APPROVED: "" }, "EXPLICIT_SITE_BOOTSTRAP_APPROVAL_MISSING"],
    [{ FACTORY_DB_PORT: "55432" }, "LOCAL_SETTINGS_TARGET_REJECTED"],
    [{ FACTORY_DB_NAME: "ionflow_factory_auth_validation" }, "LOCAL_SETTINGS_TARGET_REJECTED"],
    [{ FACTORY_DB_SCHEMA: "public" }, "LOCAL_SETTINGS_TARGET_REJECTED"],
    [{ FACTORY_SETTINGS_DB_USER: "postgres" }, "LOCAL_SETTINGS_TARGET_REJECTED"],
    [{ FACTORY_SETTINGS_BOOTSTRAP_SITE_ID: "" }, "APPROVED_SITE_INPUT_INVALID"],
    [{ FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE: "dev-factory-01" }, "APPROVED_SITE_INPUT_INVALID"],
    [{ FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME: " IonFlow Factory Local" }, "APPROVED_SITE_INPUT_INVALID"],
  ])
    assert.throws(
      () => readSiteBootstrapConfig({ ...approvedEnv, ...patch }, ["--execute"], []),
      new RegExp(error),
    );
  assert.throws(
    () => readSiteBootstrapConfig(approvedEnv, [], []),
    /SITE_BOOTSTRAP_EXECUTION_NOT_REQUESTED/,
  );
  assert.throws(
    () => readSiteBootstrapConfig(approvedEnv, ["--execute"], ["--env-file=.env.local"]),
    /ENV_FILE_LOADING_FORBIDDEN/,
  );
});

test("bootstrap creates one active Site and preserves every inactive record", async () => {
  const store = fakeStore();
  const result = await applyInitialSiteBootstrap(
    store,
    readSiteBootstrapConfig(approvedEnv, ["--execute"], []),
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.version, "1");
  assert.deepEqual(store.rows()[0], inactiveTestSite);
  assert.deepEqual(store.rows()[1], {
    id: "ionflow-factory-local",
    kind: "sites",
    code: "DEV-FACTORY-01",
    name: "IonFlow Factory Local",
    active: true,
    type: "",
    parentId: "",
    typeId: "",
    start: "",
    end: "",
    contact: "",
    phone: "",
    aliases: [],
  });
});

test("bootstrap rejects an active Site, duplicate ID and duplicate code", async () => {
  const config = readSiteBootstrapConfig(approvedEnv, ["--execute"], []);
  for (const [row, error] of [
    [{ ...inactiveTestSite, id: "active-site", code: "ACTIVE", active: true }, "ACTIVE_SITE_ALREADY_EXISTS"],
    [{ ...inactiveTestSite, id: config.site.id }, "SITE_ID_ALREADY_EXISTS"],
    [{ ...inactiveTestSite, code: config.site.code.toLowerCase() }, "SITE_CODE_ALREADY_EXISTS"],
  ]) {
    const store = fakeStore([row]);
    await assert.rejects(applyInitialSiteBootstrap(store, config), new RegExp(error));
    assert.deepEqual(store.rows(), [row]);
  }
});

test("exclusive lock rejects concurrent bootstrap and permits a later reviewed run", () => {
  const directory = mkdtempSync(join(tmpdir(), "factory-site-bootstrap-test-"));
  const lock = join(directory, "bootstrap.lock");
  try {
    const release = acquireSiteBootstrapLock(lock);
    assert.throws(() => acquireSiteBootstrapLock(lock), /SITE_BOOTSTRAP_LOCKED_REVIEW_REQUIRED/);
    release();
    const releaseAgain = acquireSiteBootstrapLock(lock);
    releaseAgain();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("save failure relies on repository rollback and creates no partial Site", async () => {
  const store = fakeStore([inactiveTestSite], { failSave: true });
  await assert.rejects(
    applyInitialSiteBootstrap(
      store,
      readSiteBootstrapConfig(approvedEnv, ["--execute"], []),
    ),
    (error) => error.message === "SAVE_ROLLED_BACK" && error.siteCommitted === false,
  );
  assert.deepEqual(store.rows(), [inactiveTestSite]);
});

test("post-commit readback failure is explicit and never claims rollback", async () => {
  const store = fakeStore([inactiveTestSite], { failReadback: true });
  await assert.rejects(
    applyInitialSiteBootstrap(
      store,
      readSiteBootstrapConfig(approvedEnv, ["--execute"], []),
    ),
    (error) =>
      error.message === "SITE_BOOTSTRAP_READBACK_FAILED" &&
      error.siteCommitted === true,
  );
  assert.equal(store.rows().filter((row) => row.active).length, 1);
});

test("implementation reuses repository transaction lock and contains no raw Settings write", () => {
  const repository = readFileSync(
    new URL("../src/server/settings-postgres.ts", import.meta.url),
    "utf8",
  );
  const source = readFileSync(
    new URL("./bootstrap-settings-site-local.mjs", import.meta.url),
    "utf8",
  );
  assert.match(repository, /client\.query\(write \? "BEGIN" : "BEGIN READ ONLY"\)/);
  assert.match(repository, /pg_advisory_xact_lock\(20261021, 1\)/);
  assert.match(repository, /client\.query\("ROLLBACK"\)/);
  assert.match(source, /createSettingsStore/);
  assert.match(source, /store\.save\(row, null\)/);
  assert.doesNotMatch(source, /INSERT\s+INTO|UPDATE\s+inventory_sandbox|DELETE\s+FROM/i);
});
