import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { AUTH_SQL_VALIDATION_CASES, CASE_IDS } from "./auth-sql-validation-cases.mjs";
import {
  APPROVED_AUTH_MIGRATION_CHECKSUMS,
  buildValidationPlan,
  deriveValidationMigration,
  loadValidationSources,
  readValidationTarget,
  runCli,
  sha256,
  validateServerIdentity,
} from "./auth-sql-validation-harness.mjs";

const approvedEnv = Object.freeze({
  NODE_ENV: "test",
  FACTORY_AUTH_VALIDATION_HOST: "127.0.0.1",
  FACTORY_AUTH_VALIDATION_PORT: "55432",
  FACTORY_AUTH_VALIDATION_DATABASE: "ionflow_factory_auth_validation",
  FACTORY_AUTH_VALIDATION_SCHEMA: "inventory_sandbox",
  FACTORY_AUTH_VALIDATION_USER: "factory_auth_validation_owner",
  FACTORY_AUTH_VALIDATION_PASSWORD: "unit-test-placeholder-not-a-real-secret",
  FACTORY_AUTH_VALIDATION_RUN_ID: "validation-run-001",
  FACTORY_AUTH_VALIDATION_MARKER:
    "IONFLOW_FACTORY_AUTH_VALIDATION_ONLY:validation-run-001",
  FACTORY_AUTH_VALIDATION_SCENARIO: "constraints",
  FACTORY_AUTH_VALIDATION_APPROVED: "APPROVED_DISPOSABLE_SQL_EXECUTION",
});

const migrationText = (name) =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");

test("approved migration bytes and checksums remain unchanged", () => {
  const foundation = migrationText("0001_foundation.up.sql");
  const up = migrationText("0005_factory_auth.up.sql");
  const down = migrationText("0005_factory_auth.down.sql");

  assert.equal(sha256(foundation), APPROVED_AUTH_MIGRATION_CHECKSUMS.foundation.sha256);
  assert.equal(sha256(up), APPROVED_AUTH_MIGRATION_CHECKSUMS.up.sha256);
  assert.equal(sha256(down), APPROVED_AUTH_MIGRATION_CHECKSUMS.down.sha256);
  const sources = loadValidationSources();
  assert.equal(
    sources.up.derivedSha256,
    "8af3e7793f79f0f40f53e7c2f452f364818ac0250982ccb4110e899e1af7f4c2",
  );
  assert.equal(
    sources.down.derivedSha256,
    "99666b67673a631d0db98203f7ade840eb0ee561d728b211c88e3afb80291248",
  );
});

test("validation derivation replaces exactly the approved database and port guards", () => {
  const source = migrationText("0005_factory_auth.up.sql");
  const result = deriveValidationMigration(
    source,
    APPROVED_AUTH_MIGRATION_CHECKSUMS.up.sha256,
  );

  assert.equal(result.replacementCount, 2);
  assert.equal(
    result.derived.split("current_database() <> 'ionflow_factory_auth_validation'")
      .length - 1,
    1,
  );
  assert.equal(
    result.derived.split("inet_server_port() <> 55432").length - 1,
    1,
  );
  assert.equal(
    result.derived.replace(
      "current_database() <> 'ionflow_factory_auth_validation'",
      "current_database() <> 'ionflow_inventory_dev'",
    ).replace("inet_server_port() <> 55432", "inet_server_port() <> 5432"),
    source,
  );
  assert.equal(sha256(migrationText("0005_factory_auth.up.sql")), result.sourceSha256);
});

test("down migration receives the same two narrow in-memory guard changes", () => {
  const source = migrationText("0005_factory_auth.down.sql");
  const result = deriveValidationMigration(
    source,
    APPROVED_AUTH_MIGRATION_CHECKSUMS.down.sha256,
  );

  assert.equal(result.replacementCount, 2);
  assert.equal(
    result.derived
      .replace(
        "current_database() <> 'ionflow_factory_auth_validation'",
        "current_database() <> 'ionflow_inventory_dev'",
      )
      .replace("inet_server_port() <> 55432", "inet_server_port() <> 5432"),
    source,
  );
  assert.equal(sha256(migrationText("0005_factory_auth.down.sql")), result.sourceSha256);
});

test("validation derivation fails closed on checksum and guard drift", () => {
  const source = migrationText("0005_factory_auth.up.sql");
  assert.throws(
    () => deriveValidationMigration(`${source}\n-- drift`, sha256(source)),
    /APPROVED_SOURCE_CHECKSUM_MISMATCH/,
  );
  for (const guard of [
    "current_database() <> 'ionflow_inventory_dev'",
    "inet_server_port() <> 5432",
  ]) {
    const missing = source.replace(guard, "guard_removed_for_unit_test");
    assert.throws(
      () => deriveValidationMigration(missing, sha256(missing)),
      /PRODUCTION_GUARD_MATCH_COUNT_INVALID/,
      `missing ${guard}`,
    );
    const duplicate = `${source}\n-- ${guard}`;
    assert.throws(
      () => deriveValidationMigration(duplicate, sha256(duplicate)),
      /PRODUCTION_GUARD_MATCH_COUNT_INVALID/,
      `duplicate ${guard}`,
    );
  }
});

test("server identity requires validation loopback, port and isolated role", () => {
  const config = readValidationTarget(approvedEnv, []);
  const identity = {
    database: config.database,
    role: config.user,
    server_addr: "127.0.0.1",
    server_port: 55432,
    server_major: 18,
    marker: config.marker,
    schema_owner: config.user,
    rolsuper: false,
    rolcreaterole: false,
    rolcreatedb: false,
    rolreplication: false,
    rolbypassrls: false,
  };

  assert.doesNotThrow(() => validateServerIdentity(identity, config, []));
  assert.throws(
    () => validateServerIdentity({ ...identity, server_addr: "::1" }, config, []),
    /SERVER_IDENTITY_REJECTED/,
  );
  assert.throws(
    () =>
      validateServerIdentity(
        { ...identity, database: "ionflow_inventory_dev" },
        config,
        [],
      ),
    /SERVER_IDENTITY_REJECTED/,
  );
  assert.throws(
    () => validateServerIdentity({ ...identity, server_port: 5432 }, config, []),
    /SERVER_IDENTITY_REJECTED/,
  );
  assert.throws(
    () => validateServerIdentity(identity, config, ["factory_auth_runtime"]),
    /VALIDATION_OWNER_ROLE_MEMBERSHIP_REJECTED/,
  );
  assert.throws(
    () => validateServerIdentity({ ...identity, rolsuper: true }, config, []),
    /VALIDATION_OWNER_ROLE_MEMBERSHIP_REJECTED/,
  );
});

test("server preflight compares the host address without an inet netmask", () => {
  const harness = readFileSync(
    new URL("./auth-sql-validation-harness.mjs", import.meta.url),
    "utf8",
  );
  assert.match(harness, /pg_catalog\.host\(inet_server_addr\(\)\) AS server_addr/);
  assert.doesNotMatch(harness, /inet_server_addr\(\)::text AS server_addr/);
});

test("only the exact disposable target and explicit approval are accepted", () => {
  const config = readValidationTarget(approvedEnv, []);
  assert.deepEqual(
    {
      host: config.host,
      port: config.port,
      database: config.database,
      schema: config.schema,
      user: config.user,
    },
    {
      host: "127.0.0.1",
      port: 55432,
      database: "ionflow_factory_auth_validation",
      schema: "inventory_sandbox",
      user: "factory_auth_validation_owner",
    },
  );

  const rejected = [
    ["FACTORY_AUTH_VALIDATION_HOST", "localhost", "VALIDATION_HOST_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_PORT", "5432", "VALIDATION_PORT_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_DATABASE", "ionflow_inventory_dev", "VALIDATION_DATABASE_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_SCHEMA", "public", "VALIDATION_SCHEMA_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_USER", "factory_auth_runtime", "VALIDATION_OWNER_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_RUN_ID", "", "VALIDATION_RUN_ID_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_MARKER", "wrong", "VALIDATION_MARKER_REJECTED"],
    ["FACTORY_AUTH_VALIDATION_PASSWORD", "", "VALIDATION_CREDENTIAL_MISSING"],
    ["FACTORY_AUTH_VALIDATION_APPROVED", "", "EXPLICIT_EXECUTION_APPROVAL_MISSING"],
    ["FACTORY_AUTH_VALIDATION_SCENARIO", "unknown", "VALIDATION_SCENARIO_REJECTED"],
  ];

  for (const [key, value, error] of rejected) {
    assert.throws(
      () => readValidationTarget({ ...approvedEnv, [key]: value }, []),
      new RegExp(error),
      key,
    );
  }
  assert.throws(
    () => readValidationTarget({ ...approvedEnv, NODE_ENV: "production" }, []),
    /PRODUCTION_EXECUTION_FORBIDDEN/,
  );
  assert.throws(
    () => readValidationTarget(approvedEnv, ["--env-file=.env.local"]),
    /ENV_FILE_LOADING_FORBIDDEN/,
  );
});

test("plan maps ISO-001 through ISO-034 without claiming SQL execution", async () => {
  const plan = buildValidationPlan();
  assert.equal(plan.mode, "PLAN_ONLY");
  assert.equal(plan.executable, false);
  assert.equal(plan.cases.length, 34);
  assert.deepEqual(CASE_IDS, Array.from({ length: 34 }, (_, index) => `ISO-${String(index + 1).padStart(3, "0")}`));
  assert.equal(new Set(CASE_IDS).size, 34);
  assert.equal(AUTH_SQL_VALIDATION_CASES.filter((entry) => entry.status === "BLOCKED").length, 6);
  assert.ok(AUTH_SQL_VALIDATION_CASES.every((entry) => ["NOT_RUN", "BLOCKED"].includes(entry.status)));
  assert.equal(
    plan.cases.filter((entry) => entry.implementation === "IMPLEMENTED_NOT_RUN").length,
    28,
  );
  assert.equal(
    plan.cases.filter((entry) => entry.implementation === "FUTURE_PREREQUISITE").length,
    6,
  );

  const cliPlan = await runCli(["--plan"], {}, []);
  assert.equal(cliPlan.mode, "PLAN_ONLY");
});

test("execute mode rejects a dangerous target before importing or connecting", async () => {
  await assert.rejects(
    runCli(
      ["--execute"],
      {
        ...approvedEnv,
        FACTORY_AUTH_VALIDATION_DATABASE: "ionflow_inventory_dev",
      },
      [],
    ),
    /VALIDATION_DATABASE_REJECTED/,
  );
});

test("harness does not load Factory env files or provision server objects", () => {
  const harness = readFileSync(
    new URL("./auth-sql-validation-harness.mjs", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "dotenv",
    "FACTORY_DB_PASSWORD",
    "FACTORY_SETTINGS_DB",
    "FACTORY_PRODUCTION_DB",
    "CREATE DATABASE",
    "DROP DATABASE",
    "CREATE ROLE",
    "ALTER ROLE",
  ]) {
    assert.equal(harness.includes(forbidden), false, forbidden);
  }
});
