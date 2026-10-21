// Authorized local setup only. Credentials are handled in memory/protected local configuration, never printed.
import pg from "pg";
import fs from "node:fs";
import { randomBytes, pbkdf2Sync, createHmac, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const envPath = resolve(".env.local");
const original = fs.readFileSync(envPath, "utf8");
const local = parseEnv(original);
for (const [key, value] of Object.entries({ FACTORY_DB_HOST: "localhost", FACTORY_DB_PORT: "5432", FACTORY_DB_NAME: "ionflow_inventory_dev", FACTORY_DB_SCHEMA: "inventory_sandbox" })) {
  if (local[key] !== value) throw Error("LOCAL_SETTINGS_TARGET_REJECTED");
}
if (!local.FACTORY_SETUP_ADMIN_PASSWORD) throw Error("LOCAL_ADMIN_CREDENTIAL_MISSING");
if (process.platform !== "win32") throw Error("PROTECTED_WINDOWS_SETUP_REQUIRED");
const migration = fs.readFileSync("migrations/0002_settings_masters.up.sql", "utf8");
// Execute the reviewed migration body inside the same atomic role/grant transaction.
if (!/^--[\s\S]*?\bBEGIN;[\s\S]*\bCOMMIT;\s*$/.test(migration) ||
    (migration.match(/CREATE TABLE /g) || []).length !== 1 || /\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b(?! RESTRICT)/.test(migration.replaceAll("ON DELETE RESTRICT", "")))
  throw Error("MIGRATION_REVIEW_REQUIRED");
const body = migration.replace(/^([\s\S]*?)\bBEGIN;/, "$1").replace(/\bCOMMIT;\s*$/, "");
const client = new pg.Client({ host: "localhost", port: 5432, database: "ionflow_inventory_dev", user: "postgres",
  password: local.FACTORY_SETUP_ADMIN_PASSWORD, connectionTimeoutMillis: 5000, ssl: false,
  options: "-c search_path=pg_catalog -c statement_timeout=15000" });
let staged;
let committed = false;
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261021, 2)");
  const check = (await client.query(`SELECT current_database()='ionflow_inventory_dev'
    AND current_user='postgres' AND r.rolsuper AND inet_server_port()=5432
    AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
    AND to_regnamespace('inventory_sandbox') IS NOT NULL AS safe,
    to_regclass('inventory_sandbox.settings_masters') IS NOT NULL AS table_exists,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname='factory_settings_writer') AS role_exists
    FROM pg_roles r WHERE rolname=current_user`)).rows[0];
  if (check?.safe !== true) throw Error("LOCAL_ADMIN_TARGET_REJECTED");
  if (check.table_exists || check.role_exists) throw Error("EXISTING_SETTINGS_OBJECTS_REQUIRE_REVIEW_NO_PASSWORD_RESET");

  const password = randomBytes(36).toString("base64url");
  const salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const hmac = (text) => createHmac("sha256", salted).update(text).digest();
  const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${createHash("sha256").update(hmac("Client Key")).digest("base64")}:${hmac("Server Key").toString("base64")}`;
  // Only a SCRAM verifier reaches SQL, never the cleartext runtime password.
  await client.query("SELECT pg_catalog.set_config('factory.setup_verifier',$1,true)", [verifier]);
  await client.query(`DO $$ BEGIN EXECUTE format(
    'CREATE ROLE factory_settings_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',
    current_setting('factory.setup_verifier')); END $$`);
  await client.query(body);
  await client.query("GRANT CONNECT ON DATABASE ionflow_inventory_dev TO factory_settings_writer");
  await client.query("GRANT USAGE ON SCHEMA inventory_sandbox TO factory_settings_writer");
  await client.query("GRANT SELECT, INSERT, UPDATE ON inventory_sandbox.settings_masters TO factory_settings_writer");

  const updates = { FACTORY_SETTINGS_ENABLED: "true", FACTORY_SETTINGS_DB_USER: "factory_settings_writer", FACTORY_SETTINGS_DB_PASSWORD: password };
  const lines = original.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?FACTORY_SETUP_ADMIN_PASSWORD\s*=/.test(line));
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
    const indexes = lines.flatMap((line, index) => pattern.test(line) ? [index] : []);
    if (indexes.length > 1) throw Error("DUPLICATE_LOCAL_CONFIGURATION_REQUIRES_REVIEW");
    if (indexes.length) lines[indexes[0]] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  // This is secret configuration provisioning, not a source-code rewrite. ACL is set BEFORE secret bytes are written.
  const sid = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true }).match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw Error("LOCAL_SECRET_ACL_IDENTITY_UNAVAILABLE");
  staged = `${envPath}.settings-${randomBytes(8).toString("hex")}.tmp`;
  fs.closeSync(fs.openSync(staged, "wx", 0o600));
  execFileSync("icacls.exe", [staged, "/inheritance:r", "/grant:r", `*${sid}:F`, "*S-1-5-18:F", "*S-1-5-32-544:F"], { stdio: "ignore", windowsHide: true });
  fs.writeFileSync(staged, lines.join("\r\n"));
  // Refuse to overwrite concurrent edits from the user's editor.
  if (fs.readFileSync(envPath, "utf8") !== original) throw Error("LOCAL_CONFIGURATION_CHANGED_RETRY_REQUIRED");
  await client.query("COMMIT");
  committed = true;
  fs.renameSync(staged, envPath);
  staged = undefined;
  console.log(JSON.stringify({ status: "PASS", role: "factory_settings_writer", migration: "0002_settings_masters", table: "inventory_sandbox.settings_masters", permissions: ["CONNECT", "USAGE", "SELECT", "INSERT", "UPDATE"], environmentConfigured: true, setupAdminSecretRemoved: true }));
} catch (error) {
  if (!committed) { try { await client.query("ROLLBACK"); } catch {} }
  const safeCode = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code :
    typeof error?.message === "string" && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "SETTINGS_SETUP_FAILED";
  console.error(JSON.stringify({ status: "FAIL", code: safeCode, committed, protectedRecoveryFile: committed ? staged : undefined }));
  process.exitCode = 1;
} finally {
  if (staged && !committed) fs.unlinkSync(staged);
  await client.end().catch(() => {});
}
