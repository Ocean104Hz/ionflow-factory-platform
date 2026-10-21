import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import pg from "pg";
import {
  BackendError,
  readDatabaseConfig,
} from "../src/server/database/config.ts";
import {
  createDevelopmentDatabase,
  getDevelopmentDatabase,
  closeDevelopmentDatabase,
} from "../src/server/database/database.ts";
import { verifyDevelopmentDatabase } from "../src/server/database/diagnostic.ts";
import { requirePersistentAccess } from "../src/server/persistent-access.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const env = {
  NODE_ENV: "test",
  FACTORY_DB_ENABLED: "true",
  FACTORY_DB_HOST: "localhost",
  FACTORY_DB_PORT: "5432",
  FACTORY_DB_NAME: "ionflow_inventory_dev",
  FACTORY_DB_SCHEMA: "inventory_sandbox",
  FACTORY_DB_USER: "factory_test_app",
  FACTORY_DB_PASSWORD: "fictional-test-password-not-a-credential",
};
const safeError = (code) => (error) => {
  assert.ok(error instanceof BackendError);
  assert.equal(error.code, code);
  const exposed = `${error.stack} ${JSON.stringify(error)}`;
  for (const sensitive of [
    env.FACTORY_DB_PASSWORD,
    "postgres://",
    "SELECT private",
    "secret-connection-metadata",
  ])
    assert.ok(!exposed.includes(sensitive));
  assert.equal(error.cause, undefined);
  return true;
};
function fixture({
  failConnect = false,
  failSql = "",
  failRollback = false,
  rows = [{ value: "ok" }],
  failRelease = false,
} = {}) {
  const calls = [];
  const released = [];
  let options;
  let idle;
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql === failSql || (failRollback && sql === "ROLLBACK"))
        throw new Error(
          `SELECT private ${env.FACTORY_DB_PASSWORD} secret-connection-metadata`,
        );
      return { rows };
    },
    release(destroy) {
      released.push(destroy);
      if (failRelease) throw new Error(env.FACTORY_DB_PASSWORD);
    },
  };
  const pool = {
    async connect() {
      if (failConnect) throw new Error(`postgres://${env.FACTORY_DB_PASSWORD}`);
      return client;
    },
    async end() {
      calls.push({ sql: "END_POOL" });
    },
    on(event, listener) {
      assert.equal(event, "error");
      idle = listener;
    },
  };
  const db = createDevelopmentDatabase(readDatabaseConfig(env), (config) => {
    options = config;
    return pool;
  });
  return { db, calls, released, options, idle: () => idle() };
}
async function withEnvironment(work, patch = env) {
  const saved = Object.fromEntries(
    Object.keys(patch).map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, patch);
  try {
    return await work();
  } finally {
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
}

test("configuration is explicit, disabled by default and rejects missing credentials/unsafe targets/admin users", () => {
  assert.throws(() => readDatabaseConfig({}), safeError("DB_DISABLED"));
  const config = readDatabaseConfig(env);
  assert.equal(config.schema, "inventory_sandbox");
  assert.equal(config.connectionTimeoutMillis, 5000);
  assert.equal(config.max, 5);
  for (const key of [
    "FACTORY_DB_HOST",
    "FACTORY_DB_PORT",
    "FACTORY_DB_NAME",
    "FACTORY_DB_SCHEMA",
    "FACTORY_DB_USER",
    "FACTORY_DB_PASSWORD",
  ]) {
    const missing = { ...env };
    delete missing[key];
    assert.throws(
      () => readDatabaseConfig(missing),
      safeError("DB_CONFIG_INVALID"),
      key,
    );
  }
  for (const patch of [
    { NODE_ENV: "production" },
    { FACTORY_DB_HOST: "example.com" },
    { FACTORY_DB_PORT: "5433" },
    { FACTORY_DB_NAME: "production" },
    { FACTORY_DB_SCHEMA: "public; DROP SCHEMA public" },
    { FACTORY_DB_USER: "postgres" },
    { FACTORY_DB_USER: "pg_admin" },
    { FACTORY_DB_POOL_MAX: "0" },
    { FACTORY_DB_CONNECT_TIMEOUT_MS: "Infinity" },
    { FACTORY_DB_IDLE_TIMEOUT_MS: "1" },
    { FACTORY_DB_STATEMENT_TIMEOUT_MS: "999999" },
  ])
    assert.throws(
      () => readDatabaseConfig({ ...env, ...patch }),
      safeError("DB_CONFIG_INVALID"),
    );
});
test("pool is bounded/lazy, pg NUMERIC remains a string, values are parameterized and transaction is read-only", async () => {
  const f = fixture();
  assert.deepEqual(f.calls, []);
  assert.equal(f.options.ssl, false);
  assert.equal(f.options.max, 5);
  assert.equal(f.options.connectionTimeoutMillis, 5000);
  assert.match(f.options.options, /default_transaction_read_only=on/);
  assert.equal(
    pg.types.getTypeParser(1700)("123.000000000001"),
    "123.000000000001",
  );
  const payload = "'; DROP TABLE anything; --";
  assert.deepEqual(await f.db.query("SELECT $1::text AS value", [payload]), [
    { value: "ok" },
  ]);
  assert.deepEqual(
    f.calls.map((c) => c.sql),
    [
      "BEGIN READ ONLY",
      "SET LOCAL search_path TO pg_catalog, inventory_sandbox",
      "SELECT $1::text AS value",
      "COMMIT",
    ],
  );
  assert.deepEqual(f.calls[2].values, [payload]);
  assert.deepEqual(f.released, [false]);
  await f.db.close();
  assert.equal(f.calls.at(-1).sql, "END_POOL");
});
test("connect and constructor failures return sanitized errors without creating query work", async () => {
  const f = fixture({ failConnect: true });
  await assert.rejects(f.db.query("SELECT 1"), safeError("DB_UNAVAILABLE"));
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.released, []);
  assert.throws(
    () =>
      createDevelopmentDatabase(readDatabaseConfig(env), () => {
        throw new Error(env.FACTORY_DB_PASSWORD);
      }),
    safeError("DB_UNAVAILABLE"),
  );
});
test("query/callback failures rollback and release exactly once without leaking driver errors", async () => {
  const f = fixture({ failSql: "SELECT private" });
  await assert.rejects(
    f.db.query("SELECT private"),
    safeError("DB_QUERY_FAILED"),
  );
  assert.equal(f.calls.at(-1).sql, "ROLLBACK");
  assert.deepEqual(f.released, [false]);
  const callback = fixture();
  await assert.rejects(
    callback.db.readOnly(async () => {
      throw new Error(env.FACTORY_DB_PASSWORD);
    }),
    safeError("DB_QUERY_FAILED"),
  );
  assert.equal(callback.calls.at(-1).sql, "ROLLBACK");
});
test("commit/rollback/release failures are sanitized and broken connections are destroyed", async () => {
  const commit = fixture({ failSql: "COMMIT" });
  await assert.rejects(
    commit.db.query("SELECT 1"),
    safeError("DB_TRANSACTION_FAILED"),
  );
  assert.equal(commit.calls.at(-1).sql, "ROLLBACK");
  const broken = fixture({ failSql: "SELECT private", failRollback: true });
  await assert.rejects(
    broken.db.query("SELECT private"),
    safeError("DB_QUERY_FAILED"),
  );
  assert.deepEqual(broken.released, [true]);
  const released = fixture({ failRelease: true });
  await assert.rejects(
    released.db.query("SELECT 1"),
    safeError("DB_UNAVAILABLE"),
  );
});
test("transaction query handles cannot be reused after commit and idle error logging is sanitized", async () => {
  const f = fixture();
  let escaped;
  await f.db.readOnly(async (tx) => {
    escaped = tx;
    await tx.query("SELECT 1");
  });
  await assert.rejects(
    escaped.query("SELECT private"),
    safeError("DB_QUERY_FAILED"),
  );
  assert.equal(f.calls.filter((c) => c.sql === "SELECT private").length, 0);
  const previous = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    f.idle();
  } finally {
    console.error = previous;
  }
  assert.deepEqual(logs, [["FACTORY_DB_IDLE_CONNECTION_FAILED"]]);
});
test("diagnostic verifies expected database/schema/usage/role using only a parameterized read-only SELECT", async () => {
  await withEnvironment(async () => {
    const row = {
      database_ok: true,
      schema_ok: true,
      schema_usage_ok: true,
      role_ok: true,
    };
    const f = fixture({ rows: [row] });
    assert.deepEqual(await verifyDevelopmentDatabase(f.db), { ok: true });
    const query = f.calls.find((c) => c.sql.includes("current_database()"));
    assert.deepEqual(query.values, [
      env.FACTORY_DB_NAME,
      env.FACTORY_DB_SCHEMA,
    ]);
    assert.match(query.sql, /NOT r.rolsuper/);
    assert.match(query.sql, /NOT r.rolbypassrls/);
    assert.match(query.sql, /has_schema_privilege.*'CREATE'/);
    assert.match(query.sql, /has_database_privilege.*'CREATE'/);
    assert.equal(f.calls[0].sql, "BEGIN READ ONLY");
    for (const key of Object.keys(row)) {
      const invalid = fixture({ rows: [{ ...row, [key]: false }] });
      await assert.rejects(
        verifyDevelopmentDatabase(invalid.db),
        safeError("DB_VERIFICATION_FAILED"),
      );
      assert.equal(invalid.calls.at(-1).sql, "ROLLBACK");
    }
  });
});
test("access contract fails closed regardless of supplied client-like claims and no endpoint is added", async () => {
  await assert.rejects(
    requirePersistentAccess(),
    safeError("AUTH_NOT_CONFIGURED"),
  );
  await assert.rejects(
    requirePersistentAccess({
      role: "admin",
      tenantId: "fake",
      authenticated: true,
    }),
    safeError("AUTH_NOT_CONFIGURED"),
  );
  assert.doesNotMatch(
    read("src/server/persistent-access.ts"),
    /cookies\(|headers\(|use server|localStorage/,
  );
});
test("server-only modules refuse an ordinary Node/client import and existing Demo entry points do not import them", () => {
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      "await import('./src/server/database/config.ts')",
    ],
    { cwd: root, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } },
  );
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /cannot be imported from a Client Component/);
  for (const file of [
    "src/server/database/config.ts",
    "src/server/database/database.ts",
    "src/server/database/diagnostic.ts",
    "src/server/persistent-access.ts",
  ])
    assert.match(read(file), /^import "server-only";/);
  for (const file of [
    "app/(factory)/layout.tsx",
    "src/components/factory/demo-provider.tsx",
    "src/features/bom/bom-provider.tsx",
    "src/features/material-requisitions/material-requisition-workspace.tsx",
    "src/features/bulk-production-orders/bulk-production-workspace.tsx",
  ])
    assert.doesNotMatch(
      read(file),
      /src\/server\/|getDevelopmentDatabase|FACTORY_DB_/,
    );
});
test("CLI cannot execute SQL when disabled or in production and never prints raw metadata", () => {
  for (const override of [
    { FACTORY_DB_ENABLED: "false", NODE_ENV: "test" },
    { FACTORY_DB_ENABLED: "true", NODE_ENV: "production" },
  ]) {
    const child = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--experimental-strip-types",
        "scripts/check-factory-database.mjs",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ...env, ...override },
      },
    );
    assert.equal(child.status, 1);
    const output = child.stdout + child.stderr;
    assert.match(output, /DB_DISABLED|disabled in production/);
    for (const value of [
      env.FACTORY_DB_PASSWORD,
      env.FACTORY_DB_NAME,
      env.FACTORY_DB_USER,
    ])
      assert.ok(!output.includes(value));
  }
});
test("configuration example is opt-in and prepared migrations only bootstrap tracking, never identity/business tables", () => {
  const example = read(".env.example");
  assert.match(example, /FACTORY_DB_ENABLED=false/);
  assert.match(example, /^FACTORY_DB_PASSWORD=$/m);
  assert.doesNotMatch(example, /NEXT_PUBLIC_FACTORY_DB|postgres:\/\//);
  assert.match(read(".gitignore"), /!\.env\.example/);
  const up = read("migrations/0001_foundation.up.sql");
  assert.equal((up.match(/CREATE TABLE /g) || []).length, 1);
  assert.match(up, /inventory_sandbox.schema_migrations/);
  assert.doesNotMatch(up, /CREATE ROLE|GRANT |CREATE SCHEMA|CASCADE/);
  assert.match(read("migrations/0001_foundation.down.sql"), /Rollback refused/);
});
test("new server modules pass strict TypeScript semantic checks only within the Phase 1 boundary", () => {
  const files = [
    "src/server/database/config.ts",
    "src/server/database/database.ts",
    "src/server/database/diagnostic.ts",
    "src/server/persistent-access.ts",
  ].map((f) => fileURLToPath(new URL(`../${f}`, import.meta.url)));
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    types: ["node"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root,
      getCanonicalFileName: (f) => f,
      getNewLine: () => "\n",
    }),
  );
});
