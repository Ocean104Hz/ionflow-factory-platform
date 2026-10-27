import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { verifyArgon2idPassword } from "../src/server/auth/auth-service.ts";
import {
  FIRST_ADMIN_ROLE,
  applyFirstAdminBootstrap,
  hashAdminPassword,
  readBootstrapConfig,
  verifyApprovedMigrationFiles,
} from "./bootstrap-auth-admin-local.mjs";

const registry = Object.freeze({
  provenance: "approved:test-bootstrap",
  settingsSiteAuthority: "settings:test",
  tenant: { authority: "tenant:test", id: "tenant-a", active: true },
  organization: {
    authority: "organization:test",
    id: "org-a",
    tenantAuthority: "tenant:test",
    tenantId: "tenant-a",
    active: true,
  },
  sites: [
    {
      authority: "settings:test",
      id: "site-a",
      organizationAuthority: "organization:test",
      organizationId: "org-a",
      active: true,
    },
  ],
});
const approvedEnv = Object.freeze({
  NODE_ENV: "test",
  FACTORY_AUTH_BOOTSTRAP_APPROVED:
    "APPROVED_LOCAL_FIRST_ADMIN_BOOTSTRAP",
  FACTORY_DB_HOST: "localhost",
  FACTORY_DB_PORT: "5432",
  FACTORY_DB_NAME: "ionflow_inventory_dev",
  FACTORY_DB_SCHEMA: "inventory_sandbox",
  FACTORY_AUTH_ENABLED: "false",
  FACTORY_AUTH_DB_USER: "factory_auth_runtime",
  FACTORY_AUTH_DB_PASSWORD: "unit-test-runtime-placeholder",
  FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "true",
  FACTORY_AUTH_LOCAL_SCOPE_REGISTRY: JSON.stringify(registry),
  FACTORY_SETUP_ADMIN_PASSWORD: "unit-test-admin-placeholder",
});

function fakeClient(state = {}) {
  const calls = [];
  return {
    calls,
    async query(text, values = []) {
      calls.push({ text, values });
      if (text.includes("current_database()='ionflow_inventory_dev'"))
        return {
          rows: [
            {
              safe: true,
              foundation_ok: true,
              auth_migration_ok: true,
              runtime_ok: true,
              completed: state.completed ?? false,
              auth_rows: state.authRows ?? "0",
            },
          ],
        };
      if (text.includes("FROM inventory_sandbox.settings_masters"))
        return {
          rows:
            state.siteActive === false
              ? [{ id: "site-a", active: false }]
              : [{ id: "site-a", active: true }],
        };
      return { rows: [] };
    },
  };
}

test("bootstrap configuration accepts only the approved disabled local Auth target", () => {
  assert.equal(
    readBootstrapConfig(approvedEnv, ["--execute"]).database,
    "ionflow_inventory_dev",
  );
  for (const [patch, error] of [
    [{ FACTORY_AUTH_BOOTSTRAP_APPROVED: "" }, "EXPLICIT_ADMIN_BOOTSTRAP_APPROVAL_MISSING"],
    [{ FACTORY_DB_PORT: "55432" }, "LOCAL_AUTH_TARGET_REJECTED"],
    [{ FACTORY_AUTH_ENABLED: "true" }, "AUTH_RUNTIME_SETUP_INCOMPLETE"],
    [{ FACTORY_AUTH_DB_USER: "postgres" }, "AUTH_RUNTIME_SETUP_INCOMPLETE"],
    [{ FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "false" }, "TRUSTED_SCOPE_CONFIGURATION_REQUIRED"],
    [{ FACTORY_SETUP_ADMIN_PASSWORD: "" }, "LOCAL_ADMIN_CREDENTIAL_MISSING"],
  ])
    assert.throws(
      () => readBootstrapConfig({ ...approvedEnv, ...patch }, ["--execute"]),
      new RegExp(error),
    );
  assert.throws(
    () => readBootstrapConfig(approvedEnv, []),
    /ADMIN_BOOTSTRAP_EXECUTION_NOT_REQUESTED/,
  );
  assert.throws(
    () => readBootstrapConfig(approvedEnv, ["--execute"], ["--env-file=.env.local"]),
    /ENV_FILE_LOADING_FORBIDDEN/,
  );
});

test("bootstrap password hash is compatible Argon2id PHC", async () => {
  const password = "correct horse battery staple";
  const hash = await hashAdminPassword(password);
  assert.match(hash, /^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  assert.equal(await verifyArgon2idPassword(password, hash), true);
  assert.equal(await verifyArgon2idPassword("wrong password", hash), false);
});

test("bootstrap pins the reviewed 0001 and 0005 migration bytes", () => {
  assert.doesNotThrow(() => verifyApprovedMigrationFiles());
});

test("first Admin bootstrap creates audited explicit grants atomically", async () => {
  const client = fakeClient();
  await applyFirstAdminBootstrap(
    client,
    readBootstrapConfig(approvedEnv, ["--execute"]),
    { email: "admin@example.test", password: "correct horse battery staple" },
  );
  const sql = client.calls.map((call) => call.text).join("\n");
  assert.equal(client.calls[0].text, "BEGIN");
  assert.match(client.calls[1].text, /pg_advisory_xact_lock\(20261021,7\)/);
  assert.match(sql, /factory_users/);
  assert.match(sql, /factory_local_credentials/);
  assert.match(sql, /factory_memberships/);
  assert.match(sql, /factory_role_permissions/);
  assert.match(sql, /factory_membership_roles/);
  assert.match(sql, /factory_membership_sites/);
  assert.match(sql, /DEVELOPMENT_BOOTSTRAP_ASSIGNMENTS/);
  assert.match(sql, /DEVELOPMENT_BOOTSTRAP_COMPLETED/);
  assert.equal(client.calls.at(-1).text, "COMMIT");
  assert.deepEqual(
    FIRST_ADMIN_ROLE.permissions.map(({ code }) => code),
    ["inventory.read", "inventory.post"],
  );
  assert.equal(sql.includes("factory_auth_runtime"), true);
  assert.doesNotMatch(sql, /GRANT |ALTER ROLE|CREATE ROLE/);
});

test("bootstrap rejects replay, partial Auth state and inactive Settings Site", async () => {
  for (const [state, error] of [
    [{ completed: true }, "ADMIN_BOOTSTRAP_ALREADY_COMPLETED"],
    [{ authRows: "1" }, "EXISTING_AUTH_DATA_REQUIRES_REVIEW"],
    [{ siteActive: false }, "ACCESS_DENIED"],
  ]) {
    const client = fakeClient(state);
    await assert.rejects(
      applyFirstAdminBootstrap(
        client,
        readBootstrapConfig(approvedEnv, ["--execute"]),
        { email: "admin@example.test", password: "correct horse battery staple" },
      ),
      new RegExp(error),
    );
    assert.equal(client.calls.at(-1).text, "ROLLBACK");
    assert.equal(
      client.calls.some((call) => call.text.includes("INSERT INTO inventory_sandbox.factory_users")),
      false,
    );
  }
});

test("source requires non-echoed TTY input and never accepts Admin credentials from flags", () => {
  const source = readFileSync(
    new URL("./bootstrap-auth-admin-local.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /input\.setRawMode\(true\)/);
  assert.match(source, /input\.setRawMode\(false\)/);
  assert.match(source, /INTERACTIVE_TTY_REQUIRED/);
  assert.doesNotMatch(source, /FACTORY_AUTH_ADMIN_EMAIL|FACTORY_AUTH_ADMIN_PASSWORD/);
  assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:password|passwordHash)/i);
});
