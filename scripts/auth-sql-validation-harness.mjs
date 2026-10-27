import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { AUTH_SQL_VALIDATION_CASES } from "./auth-sql-validation-cases.mjs";

const approved = Object.freeze({
  foundation: {
    path: "migrations/0001_foundation.up.sql",
    sha256: "ba7c01a162e40b1221ea2a786a04200fc7fae0d87bc3da827c477666281fe0a9",
  },
  up: {
    path: "migrations/0005_factory_auth.up.sql",
    sha256: "7ef8f18c1a3fcd75625692f81788ac541741780d2754bf8d88ce560ccf4377c3",
  },
  down: {
    path: "migrations/0005_factory_auth.down.sql",
    sha256: "1651bf2922acdccb72fa039d0b28bd2b9beca2c3abb072761b59be19a7b03d1e",
  },
});
const guardReplacements = Object.freeze([
  Object.freeze({
    source: "current_database() <> 'ionflow_inventory_dev'",
    validation: "current_database() <> 'ionflow_factory_auth_validation'",
  }),
  Object.freeze({
    source: "inet_server_port() <> 5432",
    validation: "inet_server_port() <> 55432",
  }),
]);
const scenarios = new Set([
  "constraints",
  "empty-down",
  "populated-down",
  "partial-failure",
  "duplicate-version",
  "changed-checksum",
  "atomic-ledger",
  "lock-contention",
]);
const expectedTables = Object.freeze([
  "factory_auth_events",
  "factory_identity_links",
  "factory_local_credentials",
  "factory_membership_roles",
  "factory_membership_sites",
  "factory_memberships",
  "factory_permissions",
  "factory_role_permissions",
  "factory_roles",
  "factory_sessions",
  "factory_users",
]);

export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

function readApproved(entry) {
  const source = readFileSync(new URL(`../${entry.path}`, import.meta.url), "utf8");
  if (sha256(source) !== entry.sha256)
    throw new Error("APPROVED_SOURCE_CHECKSUM_MISMATCH");
  return source;
}

export function deriveValidationMigration(source, expectedChecksum) {
  if (sha256(source) !== expectedChecksum)
    throw new Error("APPROVED_SOURCE_CHECKSUM_MISMATCH");
  let derived = source;
  for (const guard of guardReplacements) {
    const sourceMatches = derived.split(guard.source).length - 1;
    const validationMatches = derived.split(guard.validation).length - 1;
    if (sourceMatches !== 1 || validationMatches !== 0)
      throw new Error("PRODUCTION_GUARD_MATCH_COUNT_INVALID");
    derived = derived.replace(guard.source, guard.validation);
  }
  let restored = derived;
  for (const guard of guardReplacements)
    restored = restored.replace(guard.validation, guard.source);
  if (restored !== source)
    throw new Error("VALIDATION_GUARD_TRANSFORMATION_INVALID");
  return Object.freeze({
    source,
    sourceSha256: expectedChecksum,
    derived,
    derivedSha256: sha256(derived),
    replacementCount: guardReplacements.length,
  });
}

export function loadValidationSources() {
  const foundation = readApproved(approved.foundation);
  const up = deriveValidationMigration(readApproved(approved.up), approved.up.sha256);
  const down = deriveValidationMigration(
    readApproved(approved.down),
    approved.down.sha256,
  );
  return Object.freeze({ foundation, up, down });
}

export function readValidationTarget(env, execArgv = process.execArgv) {
  if (execArgv.some((value) => value.startsWith("--env-file")))
    throw new Error("ENV_FILE_LOADING_FORBIDDEN");
  const config = Object.freeze({
    host: env.FACTORY_AUTH_VALIDATION_HOST,
    port: Number(env.FACTORY_AUTH_VALIDATION_PORT),
    database: env.FACTORY_AUTH_VALIDATION_DATABASE,
    schema: env.FACTORY_AUTH_VALIDATION_SCHEMA,
    user: env.FACTORY_AUTH_VALIDATION_USER,
    password: env.FACTORY_AUTH_VALIDATION_PASSWORD,
    runId: env.FACTORY_AUTH_VALIDATION_RUN_ID,
    marker: env.FACTORY_AUTH_VALIDATION_MARKER,
    scenario: env.FACTORY_AUTH_VALIDATION_SCENARIO,
    approved: env.FACTORY_AUTH_VALIDATION_APPROVED,
  });
  if (env.NODE_ENV === "production") throw new Error("PRODUCTION_EXECUTION_FORBIDDEN");
  if (config.host !== "127.0.0.1") throw new Error("VALIDATION_HOST_REJECTED");
  if (config.port !== 55432) throw new Error("VALIDATION_PORT_REJECTED");
  if (config.database !== "ionflow_factory_auth_validation")
    throw new Error("VALIDATION_DATABASE_REJECTED");
  if (config.schema !== "inventory_sandbox")
    throw new Error("VALIDATION_SCHEMA_REJECTED");
  if (config.user !== "factory_auth_validation_owner")
    throw new Error("VALIDATION_OWNER_REJECTED");
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/.test(config.runId ?? ""))
    throw new Error("VALIDATION_RUN_ID_REJECTED");
  if (config.marker !== `IONFLOW_FACTORY_AUTH_VALIDATION_ONLY:${config.runId}`)
    throw new Error("VALIDATION_MARKER_REJECTED");
  if (!config.password) throw new Error("VALIDATION_CREDENTIAL_MISSING");
  if (config.approved !== "APPROVED_DISPOSABLE_SQL_EXECUTION")
    throw new Error("EXPLICIT_EXECUTION_APPROVAL_MISSING");
  if (!scenarios.has(config.scenario))
    throw new Error("VALIDATION_SCENARIO_REJECTED");
  return config;
}

export function buildValidationPlan() {
  const sources = loadValidationSources();
  return Object.freeze({
    mode: "PLAN_ONLY",
    executable: false,
    target: {
      host: "127.0.0.1",
      port: 55432,
      database: "ionflow_factory_auth_validation",
      schema: "inventory_sandbox",
      serverAddressExpected: "127.0.0.1",
      serverPortExpected: 55432,
      postgresMajorExpected: 18,
    },
    sources: {
      foundationSha256: approved.foundation.sha256,
      upSourceSha256: sources.up.sourceSha256,
      upDerivedSha256: sources.up.derivedSha256,
      downSourceSha256: sources.down.sourceSha256,
      downDerivedSha256: sources.down.derivedSha256,
    },
    cases: AUTH_SQL_VALIDATION_CASES.map(
      ({ id, title, runner, scenario, status, prerequisite }) => ({
        id,
        title,
        runner,
        scenario,
        status,
        prerequisite,
        implementation:
          status === "BLOCKED" ? "FUTURE_PREREQUISITE" : "IMPLEMENTED_NOT_RUN",
      }),
    ),
  });
}

const body = (source) => {
  if (!/^--[\s\S]*?\bBEGIN;[\s\S]*\bCOMMIT;\s*$/.test(source))
    throw new Error("MIGRATION_TRANSACTION_SHAPE_REJECTED");
  return source
    .replace(/^([\s\S]*?)\bBEGIN;/, "$1")
    .replace(/\bCOMMIT;\s*$/, "");
};

async function queryOne(client, text, values = []) {
  return (await client.query(text, values)).rows[0];
}

export function validateServerIdentity(identity, config, roleMemberships = []) {
  const hasAdministrativeAttribute = [
    "rolsuper",
    "rolcreaterole",
    "rolcreatedb",
    "rolreplication",
    "rolbypassrls",
  ].some((attribute) => identity?.[attribute] === true);
  if (
    !identity ||
    identity.database !== config.database ||
    identity.role !== config.user ||
    identity.server_addr !== "127.0.0.1" ||
    identity.server_port !== 55432 ||
    identity.server_major !== 18 ||
    identity.marker !== config.marker ||
    identity.schema_owner !== config.user
  )
    throw new Error("SERVER_IDENTITY_REJECTED");
  if (hasAdministrativeAttribute || roleMemberships.length !== 0)
    throw new Error("VALIDATION_OWNER_ROLE_MEMBERSHIP_REJECTED");
}

async function assertServerIdentity(client, config, { requireEmpty }) {
  const identity = await queryOne(
    client,
    `SELECT current_database() AS database, current_user AS role,
      pg_catalog.host(inet_server_addr()) AS server_addr,
      inet_server_port() AS server_port,
      current_setting('server_version_num')::integer / 10000 AS server_major,
      pg_catalog.shobj_description(d.oid, 'pg_database') AS marker,
      pg_catalog.pg_get_userbyid(n.nspowner) AS schema_owner,
      r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolreplication, r.rolbypassrls
    FROM pg_catalog.pg_database d
    JOIN pg_catalog.pg_namespace n ON n.nspname = $1
    JOIN pg_catalog.pg_roles r ON r.rolname = current_user
    WHERE d.datname = current_database()`,
    [config.schema],
  );
  const roleMemberships = (
    await client.query(
      `SELECT r.rolname
       FROM pg_catalog.pg_roles r
       WHERE r.rolname <> current_user
         AND r.rolname <> 'pg_database_owner'
         AND pg_catalog.pg_has_role(current_user, r.oid, 'MEMBER')
       ORDER BY r.rolname`,
    )
  ).rows.map((row) => row.rolname);
  validateServerIdentity(identity, config, roleMemberships);
  const forbidden = await queryOne(
    client,
    `SELECT count(*)::integer AS count
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`,
    [
      config.schema,
      [
        "settings_masters",
        "production_orders",
        "production_order_history",
        "bulk_production_orders",
      ],
    ],
  );
  if (forbidden?.count !== 0) throw new Error("BUSINESS_OBJECT_FOUND");
  if (requireEmpty) {
    const objects = await queryOne(
      client,
      `SELECT count(*)::integer AS count
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1`,
      [config.schema],
    );
    if (objects?.count !== 0) throw new Error("VALIDATION_SCHEMA_NOT_EMPTY");
  }
}

async function withClient(pg, config, work) {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    application_name: `factory-auth-validation-${config.runId}`,
    options: "-c search_path=pg_catalog -c lock_timeout=5000",
  });
  try {
    await client.connect();
    return await work(client);
  } finally {
    await client.end().catch(() => {});
  }
}

async function applyValidationMigrations(client, config, sources) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock($1, $2)", [
      20261021,
      5,
    ]);
    await assertServerIdentity(client, config, { requireEmpty: false });
    const ledger = await queryOne(
      client,
      `SELECT pg_catalog.to_regclass($1) IS NOT NULL AS exists`,
      [`${config.schema}.schema_migrations`],
    );
    if (ledger?.exists) {
      const existing = await migrationRow(client, "0005_factory_auth");
      if (existing?.checksum_sha256 !== undefined) {
        if (existing.checksum_sha256 !== sources.up.sourceSha256)
          throw new Error("MIGRATION_CHECKSUM_MISMATCH");
        throw new Error("MIGRATION_VERSION_ALREADY_APPLIED");
      }
    }
    await assertServerIdentity(client, config, { requireEmpty: true });
    await client.query(body(sources.foundation));
    await client.query(
      "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
      ["0001_foundation", approved.foundation.sha256],
    );
    await client.query(body(sources.up.derived));
    await client.query(
      "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
      ["0005_factory_auth", sources.up.sourceSha256],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

const baseFixture = [
  `INSERT INTO inventory_sandbox.factory_users(id,email,email_normalized,display_name) SELECT '00000000-0000-4000-8000-00000000000'||n, CASE WHEN n=1 THEN 'user-a@example.test' ELSE 'user-'||n||'@example.test' END, CASE WHEN n=1 THEN 'user-a@example.test' ELSE 'user-'||n||'@example.test' END, 'Validation user '||n FROM generate_series(1,6) n`,
  `INSERT INTO inventory_sandbox.factory_memberships(id,user_id,tenant_authority,tenant_id,organization_authority,organization_id) VALUES ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','validation-authority','tenant-a','validation-authority','org-a')`,
  `INSERT INTO inventory_sandbox.factory_roles(id,code,name) VALUES ('00000000-0000-4000-8000-000000000021','inventory_reader','Inventory reader')`,
  `INSERT INTO inventory_sandbox.factory_permissions(code,description) VALUES ('inventory.read','Validation read permission')`,
  `INSERT INTO inventory_sandbox.factory_auth_events(id,event_type,actor_kind,actor_user_id,actor_principal,outcome,reason_code,request_id) VALUES
    ('00000000-0000-4000-8000-000000000031','ROLE_ASSIGNED','FACTORY_USER','00000000-0000-4000-8000-000000000001','validation:user-a','SUCCESS','VALIDATION','00000000-0000-4000-8000-000000000031'),
    ('00000000-0000-4000-8000-000000000032','ROLE_REVOKED','FACTORY_USER','00000000-0000-4000-8000-000000000001','validation:user-a','SUCCESS','VALIDATION','00000000-0000-4000-8000-000000000032'),
    ('00000000-0000-4000-8000-000000000033','ROLE_ASSIGNED','FACTORY_USER','00000000-0000-4000-8000-000000000001','validation:user-a','SUCCESS','VALIDATION','00000000-0000-4000-8000-000000000033'),
    ('00000000-0000-4000-8000-000000000034','DEVELOPMENT_BOOTSTRAP_COMPLETED','TRUSTED_BOOTSTRAP',NULL,'validation:bootstrap:approved','SUCCESS','VALIDATION','00000000-0000-4000-8000-000000000034')`,
  `INSERT INTO inventory_sandbox.factory_identity_links(id,user_id,provider,issuer,provider_subject,linked_by_user_id) VALUES ('00000000-0000-4000-8000-000000000051','00000000-0000-4000-8000-000000000001','firebase','https://issuer.validation','subject-a','00000000-0000-4000-8000-000000000001')`,
  `INSERT INTO inventory_sandbox.factory_sessions(id,user_id,membership_id,secret_hash,expires_at) VALUES ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011',decode(repeat('22',32),'hex'),CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
  `INSERT INTO inventory_sandbox.factory_role_permissions(id,role_id,permission_code,assigned_event_id) VALUES ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000021','inventory.read','00000000-0000-4000-8000-000000000031')`,
  `INSERT INTO inventory_sandbox.factory_membership_roles(id,membership_id,role_id,assigned_event_id) VALUES ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000031')`,
  `INSERT INTO inventory_sandbox.factory_membership_sites(id,membership_id,site_authority,site_id,assigned_event_id) VALUES ('00000000-0000-4000-8000-000000000042','00000000-0000-4000-8000-000000000011','validation-authority','site-a','00000000-0000-4000-8000-000000000031')`,
];

async function expectSqlState(client, statement, expected) {
  await client.query("SAVEPOINT validation_case");
  try {
    await client.query(statement);
    throw new Error("EXPECTED_SQL_FAILURE_MISSING");
  } catch (error) {
    if (error.message === "EXPECTED_SQL_FAILURE_MISSING") throw error;
    if (error.code !== expected) throw new Error("UNEXPECTED_SQLSTATE");
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT validation_case");
    await client.query("RELEASE SAVEPOINT validation_case");
  }
}

async function runConstraintCases(client) {
  const results = [];
  await client.query("BEGIN");
  try {
    for (const statement of baseFixture) await client.query(statement);
    for (const entry of AUTH_SQL_VALIDATION_CASES) {
      if (entry.runner === "sql-negative") {
        await expectSqlState(client, entry.sql, entry.expectedSqlState);
        results.push({ id: entry.id, status: "PASS" });
      } else if (entry.runner === "sql-negative-set") {
        for (const [index, statement] of entry.sql.entries())
          await expectSqlState(client, statement, entry.expectedSqlStates[index]);
        results.push({ id: entry.id, status: "PASS" });
      } else if (entry.runner === "sql-positive") {
        await client.query("SAVEPOINT validation_case");
        await client.query(entry.sql);
        await client.query("ROLLBACK TO SAVEPOINT validation_case");
        await client.query("RELEASE SAVEPOINT validation_case");
        results.push({ id: entry.id, status: "PASS" });
      } else if (entry.id === "ISO-014") {
        await client.query("SAVEPOINT validation_case");
        const rows = (await client.query(entry.sql)).rows;
        if (rows.length !== 1 || !rows[0].revoked_at) throw new Error("REVOCATION_ASSERTION_FAILED");
        await client.query("ROLLBACK TO SAVEPOINT validation_case");
        await client.query("RELEASE SAVEPOINT validation_case");
        results.push({ id: entry.id, status: "PASS" });
      } else if (entry.id === "ISO-016") {
        await client.query("SAVEPOINT validation_case");
        await client.query(`UPDATE inventory_sandbox.factory_membership_roles SET revoked_at=CURRENT_TIMESTAMP,revoked_event_id='00000000-0000-4000-8000-000000000032' WHERE id='00000000-0000-4000-8000-000000000041'`);
        await client.query(entry.sql);
        const count = await queryOne(client, `SELECT count(*)::integer AS count FROM inventory_sandbox.factory_membership_roles WHERE membership_id='00000000-0000-4000-8000-000000000011' AND role_id='00000000-0000-4000-8000-000000000021'`);
        if (count?.count !== 2) throw new Error("REGRANT_ASSERTION_FAILED");
        await client.query("ROLLBACK TO SAVEPOINT validation_case");
        await client.query("RELEASE SAVEPOINT validation_case");
        results.push({ id: entry.id, status: "PASS" });
      }
    }
    await client.query("ROLLBACK");
    return results;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function catalogResults(client) {
  const tables = (
    await client.query(
      `SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='inventory_sandbox' AND c.relkind='r' AND c.relname LIKE 'factory_%' ORDER BY c.relname`,
    )
  ).rows.map((row) => row.relname);
  if (JSON.stringify(tables) !== JSON.stringify(expectedTables))
    throw new Error("AUTH_TABLE_MANIFEST_MISMATCH");
  const foreignKeys = await queryOne(
    client,
    `SELECT count(*)::integer AS count, bool_and(k.confdeltype='r') AS restrictive FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='inventory_sandbox' AND c.relname LIKE 'factory_%' AND k.contype='f'`,
  );
  if (foreignKeys?.count !== 18 || foreignKeys.restrictive !== true)
    throw new Error("AUTH_FOREIGN_KEY_MANIFEST_MISMATCH");
  const publicAcl = await queryOne(
    client,
    `SELECT count(*)::integer AS count FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault('r',c.relowner))) a WHERE n.nspname='inventory_sandbox' AND c.relname LIKE 'factory_%' AND a.grantee=0`,
  );
  if (publicAcl?.count !== 0) throw new Error("PUBLIC_AUTH_PRIVILEGE_FOUND");
  return ["ISO-001", "ISO-002", "ISO-022"].map((id) => ({ id, status: "PASS" }));
}

async function executeConstraints(pg, config, sources) {
  return withClient(pg, config, async (client) => {
    await client.query("BEGIN READ ONLY");
    await assertServerIdentity(client, config, { requireEmpty: true });
    await client.query("COMMIT");
    await applyValidationMigrations(client, config, sources);
    return [...(await catalogResults(client)), ...(await runConstraintCases(client))];
  });
}

async function authTableCount(client) {
  return (
    await queryOne(
      client,
      `SELECT count(*)::integer AS count
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname=$1 AND c.relkind='r' AND c.relname LIKE 'factory_%'`,
      ["inventory_sandbox"],
    )
  )?.count;
}

async function migrationRow(client, version) {
  return queryOne(
    client,
    `SELECT version,checksum_sha256
     FROM inventory_sandbox.schema_migrations
     WHERE version=$1`,
    [version],
  );
}

async function executeEmptyDown(pg, config, sources) {
  return withClient(pg, config, async (client) => {
    await applyValidationMigrations(client, config, sources);
    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_catalog.pg_advisory_xact_lock($1, $2)", [20261021, 5]);
      await assertServerIdentity(client, config, { requireEmpty: false });
      await client.query(body(sources.down.derived));
      const deleted = await client.query(
        "DELETE FROM inventory_sandbox.schema_migrations WHERE version=$1 AND checksum_sha256=$2",
        ["0005_factory_auth", sources.up.sourceSha256],
      );
      if (deleted.rowCount !== 1) throw new Error("AUTH_LEDGER_ROLLBACK_ROW_MISSING");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
    if ((await authTableCount(client)) !== 0) throw new Error("AUTH_ROLLBACK_INCOMPLETE");
    if (await migrationRow(client, "0005_factory_auth"))
      throw new Error("AUTH_LEDGER_ROLLBACK_INCOMPLETE");
    return [{ id: "ISO-028", status: "PASS" }];
  });
}

async function executePopulatedDown(pg, config, sources) {
  return withClient(pg, config, async (client) => {
    await applyValidationMigrations(client, config, sources);
    await client.query(
      `INSERT INTO inventory_sandbox.factory_users(id,email,email_normalized,display_name)
       VALUES ('00000000-0000-4000-8000-000000000001','rollback@example.test','rollback@example.test','Rollback guard')`,
    );
    await client.query("BEGIN");
    let rejected = false;
    try {
      await client.query(body(sources.down.derived));
    } catch {
      rejected = true;
    } finally {
      await client.query("ROLLBACK");
    }
    if (!rejected) throw new Error("POPULATED_ROLLBACK_NOT_REJECTED");
    if ((await authTableCount(client)) !== 11)
      throw new Error("POPULATED_ROLLBACK_CHANGED_TABLES");
    if (!(await migrationRow(client, "0005_factory_auth")))
      throw new Error("POPULATED_ROLLBACK_CHANGED_LEDGER");
    return [{ id: "ISO-029", status: "PASS" }];
  });
}

async function executeForcedFailure(pg, config, sources, { thenApply }) {
  return withClient(pg, config, async (client) => {
    await client.query("BEGIN");
    let rejected = false;
    try {
      await client.query("SELECT pg_catalog.pg_advisory_xact_lock($1, $2)", [20261021, 5]);
      await assertServerIdentity(client, config, { requireEmpty: true });
      await client.query(body(sources.foundation));
      await client.query(
        "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
        ["0001_foundation", approved.foundation.sha256],
      );
      await client.query(body(sources.up.derived));
      await client.query("SELECT 1/0 AS intentional_validation_failure");
      await client.query(
        "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
        ["0005_factory_auth", sources.up.sourceSha256],
      );
      await client.query("COMMIT");
    } catch {
      rejected = true;
      await client.query("ROLLBACK").catch(() => {});
    }
    if (!rejected) throw new Error("INTENTIONAL_FAILURE_NOT_REJECTED");
    await assertServerIdentity(client, config, { requireEmpty: true });
    if (thenApply) {
      await applyValidationMigrations(client, config, sources);
      if ((await authTableCount(client)) !== 11)
        throw new Error("ATOMIC_APPLY_TABLES_MISSING");
      const row = await migrationRow(client, "0005_factory_auth");
      if (row?.checksum_sha256 !== sources.up.sourceSha256)
        throw new Error("ATOMIC_APPLY_LEDGER_MISSING");
    }
    return [{ id: thenApply ? "ISO-033" : "ISO-030", status: "PASS" }];
  });
}

async function executeDuplicateVersion(pg, config, sources) {
  return withClient(pg, config, async (client) => {
    await applyValidationMigrations(client, config, sources);
    let rejected = false;
    try {
      await applyValidationMigrations(client, config, sources);
    } catch (error) {
      if (error.message !== "MIGRATION_VERSION_ALREADY_APPLIED") throw error;
      rejected = true;
    }
    if (!rejected) throw new Error("DUPLICATE_VERSION_NOT_REJECTED");
    return [{ id: "ISO-031", status: "PASS" }];
  });
}

async function executeChangedChecksum(pg, config, sources) {
  return withClient(pg, config, async (client) => {
    await applyValidationMigrations(client, config, sources);
    const changed = "0".repeat(64);
    let rejected = false;
    try {
      await applyValidationMigrations(client, config, {
        ...sources,
        up: { ...sources.up, sourceSha256: changed },
      });
    } catch (error) {
      if (error.message !== "MIGRATION_CHECKSUM_MISMATCH") throw error;
      rejected = true;
    }
    if (!rejected) throw new Error("CHANGED_CHECKSUM_NOT_REJECTED");
    return [{ id: "ISO-032", status: "PASS" }];
  });
}

async function executeLockContention(pg, config) {
  return withClient(pg, config, async (first) =>
    withClient(pg, config, async (second) => {
      await assertServerIdentity(first, config, { requireEmpty: true });
      await assertServerIdentity(second, config, { requireEmpty: true });
      await first.query("BEGIN");
      await second.query("BEGIN");
      try {
        await first.query("SELECT pg_catalog.pg_advisory_xact_lock($1, $2)", [20261021, 5]);
        const attempt = await queryOne(
          second,
          "SELECT pg_catalog.pg_try_advisory_xact_lock($1, $2) AS acquired",
          [20261021, 5],
        );
        if (attempt?.acquired !== false) throw new Error("ADVISORY_LOCK_NOT_EXCLUSIVE");
      } finally {
        await second.query("ROLLBACK").catch(() => {});
        await first.query("ROLLBACK").catch(() => {});
      }
      return [{ id: "ISO-034", status: "PASS" }];
    }),
  );
}

export async function executeApprovedValidation(config, { pg } = {}) {
  if (!pg) throw new Error("POSTGRES_DRIVER_REQUIRED");
  const sources = loadValidationSources();
  switch (config.scenario) {
    case "constraints":
      return executeConstraints(pg, config, sources);
    case "empty-down":
      return executeEmptyDown(pg, config, sources);
    case "populated-down":
      return executePopulatedDown(pg, config, sources);
    case "partial-failure":
      return executeForcedFailure(pg, config, sources, { thenApply: false });
    case "duplicate-version":
      return executeDuplicateVersion(pg, config, sources);
    case "changed-checksum":
      return executeChangedChecksum(pg, config, sources);
    case "atomic-ledger":
      return executeForcedFailure(pg, config, sources, { thenApply: true });
    case "lock-contention":
      return executeLockContention(pg, config);
    default:
      throw new Error("VALIDATION_SCENARIO_REJECTED");
  }
}

export async function runCli(
  args = process.argv.slice(2),
  env = process.env,
  execArgv = process.execArgv,
) {
  const mode = args[0] ?? "--plan";
  if (mode === "--plan") return buildValidationPlan();
  if (mode !== "--execute") throw new Error("VALIDATION_MODE_REJECTED");
  const config = readValidationTarget(env, execArgv);
  const pg = await import("pg");
  return executeApprovedValidation(config, { pg: pg.default });
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  runCli()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      const code = /^[A-Z0-9_]+$/.test(error?.message ?? "")
        ? error.message
        : "AUTH_SQL_VALIDATION_FAILED";
      console.error(JSON.stringify({ status: "FAIL", code }));
      process.exitCode = 1;
    });
}

export const APPROVED_AUTH_MIGRATION_CHECKSUMS = approved;
