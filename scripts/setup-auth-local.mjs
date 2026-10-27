// Prepared executor only. Running it requires separate database approval.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

const approved = Object.freeze({
  foundation: "ba7c01a162e40b1221ea2a786a04200fc7fae0d87bc3da827c477666281fe0a9",
  auth: "7ef8f18c1a3fcd75625692f81788ac541741780d2754bf8d88ce560ccf4377c3",
});

export const RUNTIME_GRANTS = Object.freeze([
  "GRANT CONNECT ON DATABASE ionflow_inventory_dev TO factory_auth_runtime",
  "GRANT USAGE ON SCHEMA inventory_sandbox TO factory_auth_runtime",
  `GRANT SELECT ON inventory_sandbox.factory_users,
    inventory_sandbox.factory_local_credentials,
    inventory_sandbox.factory_memberships,
    inventory_sandbox.factory_roles,
    inventory_sandbox.factory_permissions,
    inventory_sandbox.factory_role_permissions,
    inventory_sandbox.factory_membership_roles,
    inventory_sandbox.factory_membership_sites,
    inventory_sandbox.factory_sessions TO factory_auth_runtime`,
  `GRANT INSERT (id,user_id,membership_id,secret_hash,expires_at,created_at)
    ON inventory_sandbox.factory_sessions TO factory_auth_runtime`,
  `GRANT UPDATE (revoked_at,revocation_reason)
    ON inventory_sandbox.factory_sessions TO factory_auth_runtime`,
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function migrationBody(source, expectedChecksum) {
  if (sha256(source) !== expectedChecksum)
    throw new Error("APPROVED_SOURCE_CHECKSUM_MISMATCH");
  if (!/^--[\s\S]*?\bBEGIN;[\s\S]*\bCOMMIT;\s*$/.test(source))
    throw new Error("MIGRATION_TRANSACTION_SHAPE_REJECTED");
  return source
    .replace(/^([\s\S]*?)\bBEGIN;/, "$1")
    .replace(/\bCOMMIT;\s*$/, "");
}

export function readAuthSetupConfig(
  env,
  args = [],
  execArgv = process.execArgv,
) {
  if (execArgv.some((value) => value.startsWith("--env-file")))
    throw new Error("ENV_FILE_LOADING_FORBIDDEN");
  if (env.NODE_ENV === "production")
    throw new Error("PRODUCTION_EXECUTION_FORBIDDEN");
  if (args.length !== 1 || args[0] !== "--execute")
    throw new Error("AUTH_SETUP_EXECUTION_NOT_REQUESTED");
  if (env.FACTORY_AUTH_SETUP_APPROVED !== "APPROVED_LOCAL_AUTH_SETUP")
    throw new Error("EXPLICIT_DATABASE_APPROVAL_MISSING");
  if (
    env.FACTORY_DB_HOST !== "localhost" ||
    env.FACTORY_DB_PORT !== "5432" ||
    env.FACTORY_DB_NAME !== "ionflow_inventory_dev" ||
    env.FACTORY_DB_SCHEMA !== "inventory_sandbox"
  )
    throw new Error("LOCAL_AUTH_TARGET_REJECTED");
  if (!env.FACTORY_SETUP_ADMIN_PASSWORD)
    throw new Error("LOCAL_ADMIN_CREDENTIAL_MISSING");
  return Object.freeze({
    host: "localhost",
    port: 5432,
    database: "ionflow_inventory_dev",
    schema: "inventory_sandbox",
    adminPassword: env.FACTORY_SETUP_ADMIN_PASSWORD,
  });
}

function scramVerifier(password) {
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const hmac = (text) => createHmac("sha256", salted).update(text).digest();
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${createHash("sha256").update(hmac("Client Key")).digest("base64")}:${hmac("Server Key").toString("base64")}`;
}

async function executeSetup(config, original, envPath) {
  const pg = (await import("pg")).default;
  const foundationSource = fs.readFileSync("migrations/0001_foundation.up.sql", "utf8");
  const authSource = fs.readFileSync("migrations/0005_factory_auth.up.sql", "utf8");
  const foundation = migrationBody(foundationSource, approved.foundation);
  const auth = migrationBody(authSource, approved.auth);
  const runtimePassword = randomBytes(36).toString("base64url");
  const verifier = scramVerifier(runtimePassword);
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: "postgres",
    password: config.adminPassword,
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    application_name: "ionflow-factory-auth-setup",
    options: "-c search_path=pg_catalog -c lock_timeout=5000",
  });
  let staged;
  let committed = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261021,5)");
    const state = (
      await client.query(`SELECT
        current_database()='ionflow_inventory_dev'
          AND current_user='postgres' AND r.rolsuper
          AND inet_server_port()=5432
          AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
          AND to_regnamespace('inventory_sandbox') IS NOT NULL AS safe,
        to_regclass('inventory_sandbox.settings_masters') IS NOT NULL
          AND to_regclass('inventory_sandbox.production_orders') IS NOT NULL
          AND to_regclass('inventory_sandbox.production_order_history') IS NOT NULL AS business_baseline,
        to_regclass('inventory_sandbox.schema_migrations') IS NOT NULL AS ledger_exists,
        EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='factory_auth_runtime') AS role_exists,
        EXISTS(
          SELECT 1 FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='inventory_sandbox' AND c.relname LIKE 'factory_%'
        ) AS auth_objects_exist
        FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`)
    ).rows[0];
    if (state?.safe !== true || state.business_baseline !== true)
      throw new Error("LOCAL_AUTH_BASELINE_REJECTED");
    if (state.ledger_exists || state.role_exists || state.auth_objects_exist)
      throw new Error("EXISTING_AUTH_STATE_REQUIRES_REVIEW");

    await client.query(foundation);
    await client.query(
      "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
      ["0001_foundation", approved.foundation],
    );
    await client.query(auth);
    await client.query("SELECT pg_catalog.set_config('factory.auth_runtime_verifier',$1,true)", [verifier]);
    await client.query(`DO $$ BEGIN EXECUTE format(
      'CREATE ROLE factory_auth_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
      current_setting('factory.auth_runtime_verifier')); END $$`);
    for (const grant of RUNTIME_GRANTS) await client.query(grant);
    await client.query(
      "INSERT INTO inventory_sandbox.schema_migrations(version,checksum_sha256) VALUES($1,$2)",
      ["0005_factory_auth", approved.auth],
    );
    const access = (
      await client.query(`SELECT
        has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_users','SELECT')
          AND has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_local_credentials','SELECT')
          AND has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_sessions','SELECT')
          AND has_column_privilege('factory_auth_runtime','inventory_sandbox.factory_sessions','id','INSERT')
          AND has_column_privilege('factory_auth_runtime','inventory_sandbox.factory_sessions','revoked_at','UPDATE') AS required,
        has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_auth_events','SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_membership_roles','INSERT,UPDATE,DELETE')
          OR has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_membership_sites','INSERT,UPDATE,DELETE')
          OR has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_role_permissions','INSERT,UPDATE,DELETE')
          OR has_table_privilege('factory_auth_runtime','inventory_sandbox.factory_sessions','DELETE') AS forbidden`)
    ).rows[0];
    if (access?.required !== true || access.forbidden !== false)
      throw new Error("AUTH_RUNTIME_GRANT_VERIFICATION_FAILED");

    const updates = {
      FACTORY_AUTH_ENABLED: "false",
      FACTORY_AUTH_DB_USER: "factory_auth_runtime",
      FACTORY_AUTH_DB_PASSWORD: runtimePassword,
      FACTORY_AUTH_APP_ORIGIN: "http://localhost:3000",
      FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "false",
    };
    const lines = original
      .split(/\r?\n/)
      .filter((line) => !/^\s*(?:export\s+)?FACTORY_SETUP_ADMIN_PASSWORD\s*=/.test(line));
    for (const [key, value] of Object.entries(updates)) {
      const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
      const indexes = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []));
      if (indexes.length > 1)
        throw new Error("DUPLICATE_LOCAL_CONFIGURATION_REQUIRES_REVIEW");
      if (indexes.length) lines[indexes[0]] = `${key}=${value}`;
      else lines.push(`${key}=${value}`);
    }
    const sid = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
      encoding: "utf8",
      windowsHide: true,
    }).match(/S-1-5-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new Error("LOCAL_SECRET_ACL_IDENTITY_UNAVAILABLE");
    staged = `${envPath}.auth-${randomBytes(8).toString("hex")}.tmp`;
    fs.closeSync(fs.openSync(staged, "wx", 0o600));
    execFileSync(
      "icacls.exe",
      [staged, "/inheritance:r", "/grant:r", `*${sid}:F`, "*S-1-5-18:F", "*S-1-5-32-544:F"],
      { stdio: "ignore", windowsHide: true },
    );
    fs.writeFileSync(staged, lines.join("\r\n"));
    if (fs.readFileSync(envPath, "utf8") !== original)
      throw new Error("LOCAL_CONFIGURATION_CHANGED_RETRY_REQUIRED");
    await client.query("COMMIT");
    committed = true;
    fs.renameSync(staged, envPath);
    staged = undefined;
    return { status: "PASS", migrations: ["0001_foundation", "0005_factory_auth"], runtimeRole: "factory_auth_runtime" };
  } catch (error) {
    if (!committed) await client.query("ROLLBACK").catch(() => {});
    if (staged && !committed) fs.unlinkSync(staged);
    error.committed = committed;
    error.protectedRecoveryFile = committed ? staged : undefined;
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

export async function runAuthSetup(args = process.argv.slice(2), processEnv = process.env) {
  const envPath = resolve(".env.local");
  const original = fs.readFileSync(envPath, "utf8");
  const local = parseEnv(original);
  const config = readAuthSetupConfig(
    {
      ...local,
      NODE_ENV: processEnv.NODE_ENV,
      FACTORY_AUTH_SETUP_APPROVED: processEnv.FACTORY_AUTH_SETUP_APPROVED,
    },
    args,
  );
  return executeSetup(config, original, envPath);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runAuthSetup()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      const code = /^[A-Z0-9_]+$/.test(error?.message ?? "")
        ? error.message
        : "AUTH_SETUP_FAILED";
      console.error(JSON.stringify({ status: "FAIL", code, committed: error?.committed === true }));
      process.exitCode = 1;
    });
}

export const APPROVED_AUTH_SETUP_CHECKSUMS = approved;
