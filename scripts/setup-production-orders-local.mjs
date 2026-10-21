// Narrow local provisioning. Never logs credentials or resets an existing role.
import pg from "pg";
import fs from "node:fs";
import { randomBytes, pbkdf2Sync, createHmac, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const envPath = resolve(".env.local");
const original = fs.readFileSync(envPath, "utf8");
const local = parseEnv(original);
const target = { FACTORY_DB_HOST: "localhost", FACTORY_DB_PORT: "5432", FACTORY_DB_NAME: "ionflow_inventory_dev", FACTORY_DB_SCHEMA: "inventory_sandbox" };
if (Object.entries(target).some(([key, value]) => local[key] !== value)) throw Error("LOCAL_PRODUCTION_TARGET_REJECTED");
if (!local.FACTORY_SETUP_ADMIN_PASSWORD) { console.error("BLOCKED: FACTORY_SETUP_ADMIN_PASSWORD missing from approved .env.local"); process.exit(2); }
if (process.platform !== "win32") throw Error("PROTECTED_WINDOWS_SETUP_REQUIRED");
const migration = fs.readFileSync("migrations/0003_production_orders.up.sql", "utf8");
if (!/^--[\s\S]*?\bBEGIN;[\s\S]*\bCOMMIT;\s*$/.test(migration) || (migration.match(/CREATE TABLE /g) || []).length !== 2 || /\b(?:DROP|DELETE|TRUNCATE|CASCADE|GRANT|REVOKE|ALTER ROLE)\b/.test(migration.replaceAll("ON DELETE RESTRICT", ""))) throw Error("MIGRATION_REVIEW_REQUIRED");
const body = migration.replace(/^([\s\S]*?)\bBEGIN;/, "$1").replace(/\bCOMMIT;\s*$/, "");
const client = new pg.Client({ host: "localhost", port: 5432, database: "ionflow_inventory_dev", user: "postgres", password: local.FACTORY_SETUP_ADMIN_PASSWORD, connectionTimeoutMillis: 5000, ssl: false, options: "-c search_path=pg_catalog -c statement_timeout=15000" });
let staged, committed = false;
try {
  await client.connect(); await client.query("BEGIN");
  await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261021,3)");
  const check = (await client.query(`SELECT current_database()='ionflow_inventory_dev' AND current_user='postgres' AND r.rolsuper
    AND inet_server_port()=5432 AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
    AND to_regnamespace('inventory_sandbox') IS NOT NULL AS safe,
    to_regclass('inventory_sandbox.production_orders') IS NOT NULL OR to_regclass('inventory_sandbox.production_order_history') IS NOT NULL AS objects_exist,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname='factory_production_writer') AS role_exists
    FROM pg_roles r WHERE rolname=current_user`)).rows[0];
  if (check?.safe !== true) throw Error("LOCAL_ADMIN_TARGET_REJECTED");
  if (check.objects_exist || check.role_exists) throw Error("EXISTING_PRODUCTION_OBJECTS_REQUIRE_REVIEW_NO_PASSWORD_RESET");
  const password = randomBytes(36).toString("base64url"), salt = randomBytes(16);
  const salted = pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const hmac = (text) => createHmac("sha256", salted).update(text).digest();
  const verifier = `SCRAM-SHA-256$4096:${salt.toString("base64")}$${createHash("sha256").update(hmac("Client Key")).digest("base64")}:${hmac("Server Key").toString("base64")}`;
  await client.query("SELECT pg_catalog.set_config('factory.setup_verifier',$1,true)", [verifier]);
  await client.query(`DO $$ BEGIN EXECUTE format('CREATE ROLE factory_production_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS PASSWORD %L',current_setting('factory.setup_verifier')); END $$`);
  await client.query(body);
  await client.query("GRANT CONNECT ON DATABASE ionflow_inventory_dev TO factory_production_writer");
  await client.query("GRANT USAGE ON SCHEMA inventory_sandbox TO factory_production_writer");
  await client.query("GRANT SELECT, INSERT, UPDATE ON inventory_sandbox.production_orders TO factory_production_writer");
  await client.query("GRANT SELECT, INSERT ON inventory_sandbox.production_order_history TO factory_production_writer");
  const permissions = (await client.query(`SELECT
    has_table_privilege('factory_production_writer','inventory_sandbox.production_orders','SELECT,INSERT,UPDATE')
    AND has_table_privilege('factory_production_writer','inventory_sandbox.production_order_history','SELECT,INSERT')
    AND NOT has_table_privilege('factory_production_writer','inventory_sandbox.production_orders','DELETE,TRUNCATE,TRIGGER')
    AND NOT has_table_privilege('factory_production_writer','inventory_sandbox.production_order_history','UPDATE,DELETE,TRUNCATE,TRIGGER')
    AND NOT has_schema_privilege('factory_production_writer','inventory_sandbox','CREATE')
    AND NOT has_database_privilege('factory_production_writer','ionflow_inventory_dev','CREATE') AS safe`)).rows[0];
  if (permissions?.safe !== true) throw Error("EFFECTIVE_PRODUCTION_PRIVILEGES_REJECTED");
  const updates = { FACTORY_PRODUCTION_ENABLED: "true", FACTORY_PRODUCTION_DB_USER: "factory_production_writer", FACTORY_PRODUCTION_DB_PASSWORD: password, FACTORY_PRODUCTION_APP_ORIGIN: "http://localhost:3000" };
  const lines = original.split(/\r?\n/).filter((line) => !/^\s*(?:export\s+)?FACTORY_SETUP_ADMIN_PASSWORD\s*=/.test(line));
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`);
    const indexes = lines.flatMap((line, index) => pattern.test(line) ? [index] : []);
    if (indexes.length > 1) throw Error("DUPLICATE_LOCAL_CONFIGURATION_REQUIRES_REVIEW");
    if (indexes.length) lines[indexes[0]] = `${key}=${value}`; else lines.push(`${key}=${value}`);
  }
  // Set the restrictive ACL before writing secret bytes; never overwrite concurrent editor changes.
  const sid = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true }).match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw Error("LOCAL_SECRET_ACL_IDENTITY_UNAVAILABLE");
  staged = `${envPath}.production-${randomBytes(8).toString("hex")}.tmp`;
  fs.closeSync(fs.openSync(staged, "wx", 0o600));
  execFileSync("icacls.exe", [staged, "/inheritance:r", "/grant:r", `*${sid}:F`, "*S-1-5-18:F", "*S-1-5-32-544:F"], { stdio: "ignore", windowsHide: true });
  fs.writeFileSync(staged, lines.join("\r\n"));
  if (fs.readFileSync(envPath, "utf8") !== original) throw Error("LOCAL_CONFIGURATION_CHANGED_RETRY_REQUIRED");
  await client.query("COMMIT"); committed = true;
  fs.renameSync(staged, envPath); staged = undefined;
  console.log(JSON.stringify({ status: "PASS", role: "factory_production_writer", migration: "0003_production_orders", environmentConfigured: true, setupAdminSecretRemoved: true }));
} catch (error) {
  if (!committed) { try { await client.query("ROLLBACK"); } catch {} }
  const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : typeof error?.message === "string" && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "PRODUCTION_SETUP_FAILED";
  console.error(JSON.stringify({ status: "FAIL", code, committed, protectedRecoveryFile: committed ? staged : undefined })); process.exitCode = 1;
} finally { if (staged && !committed) fs.unlinkSync(staged); await client.end().catch(() => {}); }
