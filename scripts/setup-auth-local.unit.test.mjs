import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APPROVED_AUTH_SETUP_CHECKSUMS,
  RUNTIME_GRANTS,
  migrationBody,
  readAuthSetupConfig,
} from "./setup-auth-local.mjs";

const approvedEnv = Object.freeze({
  NODE_ENV: "test",
  FACTORY_AUTH_SETUP_APPROVED: "APPROVED_LOCAL_AUTH_SETUP",
  FACTORY_DB_HOST: "localhost",
  FACTORY_DB_PORT: "5432",
  FACTORY_DB_NAME: "ionflow_inventory_dev",
  FACTORY_DB_SCHEMA: "inventory_sandbox",
  FACTORY_SETUP_ADMIN_PASSWORD: "unit-test-placeholder",
});

test("Auth setup accepts only the exact approved local target", () => {
  assert.equal(readAuthSetupConfig(approvedEnv, ["--execute"]).database, "ionflow_inventory_dev");
  for (const [key, value] of [
    ["FACTORY_DB_HOST", "127.0.0.1"],
    ["FACTORY_DB_PORT", "55432"],
    ["FACTORY_DB_NAME", "ionflow_factory_auth_validation"],
    ["FACTORY_DB_SCHEMA", "public"],
  ]) {
    assert.throws(
      () => readAuthSetupConfig({ ...approvedEnv, [key]: value }, ["--execute"]),
      /LOCAL_AUTH_TARGET_REJECTED/,
    );
  }
  assert.throws(() => readAuthSetupConfig(approvedEnv), /AUTH_SETUP_EXECUTION_NOT_REQUESTED/);
  assert.throws(
    () => readAuthSetupConfig({ ...approvedEnv, FACTORY_AUTH_SETUP_APPROVED: "" }, ["--execute"]),
    /EXPLICIT_DATABASE_APPROVAL_MISSING/,
  );
  assert.throws(
    () => readAuthSetupConfig({ ...approvedEnv, NODE_ENV: "production" }, ["--execute"]),
    /PRODUCTION_EXECUTION_FORBIDDEN/,
  );
  assert.throws(
    () => readAuthSetupConfig(approvedEnv, ["--execute"], ["--env-file=.env.local"]),
    /ENV_FILE_LOADING_FORBIDDEN/,
  );
});

test("Auth setup strips only reviewed transaction wrappers and pins checksums", () => {
  for (const [file, checksum] of [
    ["0001_foundation.up.sql", APPROVED_AUTH_SETUP_CHECKSUMS.foundation],
    ["0005_factory_auth.up.sql", APPROVED_AUTH_SETUP_CHECKSUMS.auth],
  ]) {
    const source = readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    const body = migrationBody(source, checksum);
    assert.doesNotMatch(body, /\bBEGIN;|\bCOMMIT;\s*$/);
    assert.throws(() => migrationBody(`${source}\n-- drift`, checksum), /CHECKSUM/);
  }
});

test("runtime grants match repository needs without audit or assignment writes", () => {
  const grants = RUNTIME_GRANTS.join("\n");
  assert.match(grants, /GRANT SELECT[\s\S]*factory_local_credentials/);
  assert.match(grants, /GRANT INSERT \(id,user_id,membership_id,secret_hash,expires_at,created_at\)/);
  assert.match(grants, /GRANT UPDATE \(revoked_at,revocation_reason\)/);
  assert.doesNotMatch(grants, /factory_auth_events/);
  assert.doesNotMatch(grants, /GRANT (?:INSERT|UPDATE|DELETE)[\s\S]*factory_membership_roles/);
  assert.doesNotMatch(grants, /GRANT DELETE/);
});

test("setup preserves business tables and refuses existing Auth state", () => {
  const source = readFileSync(new URL("./setup-auth-local.mjs", import.meta.url), "utf8");
  for (const table of ["settings_masters", "production_orders", "production_order_history"])
    assert.match(source, new RegExp(`to_regclass\\('inventory_sandbox\\.${table}'\\) IS NOT NULL`));
  assert.match(source, /EXISTING_AUTH_STATE_REQUIRES_REVIEW/);
  assert.doesNotMatch(source, /DROP TABLE|TRUNCATE|DELETE FROM inventory_sandbox\.(?:settings|production)/);
  assert.doesNotMatch(source, /0002_settings|0003_production|0004_bulk/);
  assert.match(source, /FACTORY_AUTH_ENABLED: "false"/);
  assert.match(source, /FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "false"/);
});
