// Prepared one-time bootstrap only. Running it requires separate explicit approval.
import {
  argon2,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
import { createInterface, emitKeypressEvents } from "node:readline";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

import { normalizeLoginEmail } from "../src/server/auth/auth-service.ts";
import { createTrustedLocalScopeResolver } from "../src/server/auth/local-scope-resolver.ts";

const FOUNDATION_CHECKSUM =
  "ba7c01a162e40b1221ea2a786a04200fc7fae0d87bc3da827c477666281fe0a9";
const AUTH_CHECKSUM =
  "7ef8f18c1a3fcd75625692f81788ac541741780d2754bf8d88ce560ccf4377c3";
const ADMIN_ROLE = Object.freeze({
  code: "local_admin",
  name: "Local administrator",
  description: "Local development administrator with explicit permissions",
  permissions: Object.freeze([
    Object.freeze({
      code: "inventory.read",
      description: "Read authorized Factory inventory data",
    }),
    Object.freeze({
      code: "inventory.post",
      description: "Post authorized Factory inventory operations",
    }),
  ]),
});

export function verifyApprovedMigrationFiles() {
  for (const [path, checksum] of [
    ["migrations/0001_foundation.up.sql", FOUNDATION_CHECKSUM],
    ["migrations/0005_factory_auth.up.sql", AUTH_CHECKSUM],
  ]) {
    const actual = createHash("sha256")
      .update(fs.readFileSync(path))
      .digest("hex");
    if (actual !== checksum)
      throw new Error("APPROVED_SOURCE_CHECKSUM_MISMATCH");
  }
}

export function readBootstrapConfig(
  env,
  args = [],
  execArgv = process.execArgv,
) {
  if (execArgv.some((value) => value.startsWith("--env-file")))
    throw new Error("ENV_FILE_LOADING_FORBIDDEN");
  if (env.NODE_ENV === "production")
    throw new Error("PRODUCTION_EXECUTION_FORBIDDEN");
  if (args.length !== 1 || args[0] !== "--execute")
    throw new Error("ADMIN_BOOTSTRAP_EXECUTION_NOT_REQUESTED");
  if (
    env.FACTORY_AUTH_BOOTSTRAP_APPROVED !==
    "APPROVED_LOCAL_FIRST_ADMIN_BOOTSTRAP"
  )
    throw new Error("EXPLICIT_ADMIN_BOOTSTRAP_APPROVAL_MISSING");
  if (
    env.FACTORY_DB_HOST !== "localhost" ||
    env.FACTORY_DB_PORT !== "5432" ||
    env.FACTORY_DB_NAME !== "ionflow_inventory_dev" ||
    env.FACTORY_DB_SCHEMA !== "inventory_sandbox"
  )
    throw new Error("LOCAL_AUTH_TARGET_REJECTED");
  if (
    env.FACTORY_AUTH_ENABLED !== "false" ||
    env.FACTORY_AUTH_DB_USER !== "factory_auth_runtime" ||
    !env.FACTORY_AUTH_DB_PASSWORD
  )
    throw new Error("AUTH_RUNTIME_SETUP_INCOMPLETE");
  if (
    env.FACTORY_AUTH_LOCAL_SCOPE_ENABLED !== "true" ||
    !env.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY
  )
    throw new Error("TRUSTED_SCOPE_CONFIGURATION_REQUIRED");
  if (!env.FACTORY_SETUP_ADMIN_PASSWORD)
    throw new Error("LOCAL_ADMIN_CREDENTIAL_MISSING");
  return Object.freeze({
    host: "localhost",
    port: 5432,
    database: "ionflow_inventory_dev",
    schema: "inventory_sandbox",
    adminPassword: env.FACTORY_SETUP_ADMIN_PASSWORD,
    scopeEnv: Object.freeze({
      NODE_ENV: "development",
      FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "true",
      FACTORY_AUTH_LOCAL_SCOPE_REGISTRY:
        env.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY,
    }),
  });
}

function selectorFromRegistry(scopeEnv) {
  let raw;
  try {
    raw = JSON.parse(scopeEnv.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY);
  } catch {
    throw new Error("TRUSTED_SCOPE_CONFIGURATION_INVALID");
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !raw.tenant ||
    !raw.organization ||
    !Array.isArray(raw.sites)
  )
    throw new Error("TRUSTED_SCOPE_CONFIGURATION_INVALID");
  return Object.freeze({
    tenantAuthority: raw.tenant.authority,
    tenantId: raw.tenant.id,
    organizationAuthority: raw.organization.authority,
    organizationId: raw.organization.id,
    sites: Object.freeze(
      raw.sites.map((site) =>
        Object.freeze({ authority: site.authority, id: site.id }),
      ),
    ),
  });
}

export async function readSecret(
  label,
  input = process.stdin,
  output = process.stderr,
) {
  if (!input.isTTY || typeof input.setRawMode !== "function")
    throw new Error("INTERACTIVE_TTY_REQUIRED");
  output.write(label);
  emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  return new Promise((resolveSecret, reject) => {
    let secret = "";
    const finish = (error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolveSecret(secret);
    };
    const onKeypress = (text, key = {}) => {
      if (key.ctrl && key.name === "c") return finish(new Error("INPUT_CANCELLED"));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") {
        secret = [...secret].slice(0, -1).join("");
        return;
      }
      if (!key.ctrl && !key.meta && text && !/[\r\n\0]/.test(text)) {
        secret += text;
        if ([...secret].length > 256)
          finish(new Error("ADMIN_PASSWORD_INVALID"));
      }
    };
    input.on("keypress", onKeypress);
  });
}

export async function promptAdminCredentials(
  input = process.stdin,
  output = process.stderr,
) {
  if (!input.isTTY || !output.isTTY) throw new Error("INTERACTIVE_TTY_REQUIRED");
  const prompt = createInterface({ input, output, terminal: true });
  const emailInput = await new Promise((resolveEmail) =>
    prompt.question("Admin email: ", resolveEmail),
  );
  prompt.close();
  const email = normalizeLoginEmail(emailInput);
  if (!email) throw new Error("ADMIN_EMAIL_INVALID");
  const password = await readSecret("Admin password: ", input, output);
  const confirmation = await readSecret("Confirm password: ", input, output);
  if (
    password !== confirmation ||
    [...password].length < 12 ||
    [...password].length > 256 ||
    password.includes("\0")
  )
    throw new Error("ADMIN_PASSWORD_INVALID");
  return Object.freeze({ email, password });
}

export async function hashAdminPassword(password) {
  const salt = randomBytes(16);
  const hash = await new Promise((resolveHash, reject) => {
    argon2(
      "argon2id",
      {
        message: Buffer.from(password, "utf8"),
        nonce: salt,
        parallelism: 1,
        tagLength: 32,
        memory: 65_536,
        passes: 3,
      },
      (error, key) =>
        error ? reject(error) : resolveHash(Buffer.from(key)),
    );
  });
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const one = async (client, text, values = []) =>
  (await client.query(text, values)).rows[0];

export async function applyFirstAdminBootstrap(
  client,
  config,
  credentials,
) {
  const passwordHash = await hashAdminPassword(credentials.password);
  const selector = selectorFromRegistry(config.scopeEnv);
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_catalog.pg_advisory_xact_lock(20261021,7)",
    );
    const state = await one(
      client,
      `SELECT
        current_database()='ionflow_inventory_dev'
          AND current_user='postgres' AND r.rolsuper
          AND inet_server_port()=5432
          AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet)
          AND to_regnamespace('inventory_sandbox') IS NOT NULL AS safe,
        (SELECT checksum_sha256=$1 FROM inventory_sandbox.schema_migrations
          WHERE version='0001_foundation') AS foundation_ok,
        (SELECT checksum_sha256=$2 FROM inventory_sandbox.schema_migrations
          WHERE version='0005_factory_auth') AS auth_migration_ok,
        EXISTS(SELECT 1 FROM pg_catalog.pg_roles ar
          WHERE ar.rolname='factory_auth_runtime'
            AND NOT ar.rolsuper AND NOT ar.rolcreatedb AND NOT ar.rolcreaterole
            AND NOT ar.rolreplication AND NOT ar.rolbypassrls) AS runtime_ok,
        EXISTS(SELECT 1 FROM inventory_sandbox.factory_auth_events
          WHERE event_type='DEVELOPMENT_BOOTSTRAP_COMPLETED' AND outcome='SUCCESS') AS completed,
        (SELECT count(*) FROM inventory_sandbox.factory_users)
          + (SELECT count(*) FROM inventory_sandbox.factory_local_credentials)
          + (SELECT count(*) FROM inventory_sandbox.factory_identity_links)
          + (SELECT count(*) FROM inventory_sandbox.factory_memberships)
          + (SELECT count(*) FROM inventory_sandbox.factory_roles)
          + (SELECT count(*) FROM inventory_sandbox.factory_permissions)
          + (SELECT count(*) FROM inventory_sandbox.factory_role_permissions)
          + (SELECT count(*) FROM inventory_sandbox.factory_membership_roles)
          + (SELECT count(*) FROM inventory_sandbox.factory_membership_sites)
          + (SELECT count(*) FROM inventory_sandbox.factory_sessions)
          + (SELECT count(*) FROM inventory_sandbox.factory_auth_events) AS auth_rows
       FROM pg_catalog.pg_roles r WHERE r.rolname=current_user`,
      [FOUNDATION_CHECKSUM, AUTH_CHECKSUM],
    );
    if (
      state?.safe !== true ||
      state.foundation_ok !== true ||
      state.auth_migration_ok !== true ||
      state.runtime_ok !== true
    )
      throw new Error("AUTH_BOOTSTRAP_BASELINE_REJECTED");
    if (state.completed === true)
      throw new Error("ADMIN_BOOTSTRAP_ALREADY_COMPLETED");
    if (Number(state.auth_rows) !== 0)
      throw new Error("EXISTING_AUTH_DATA_REQUIRES_REVIEW");

    const resolver = createTrustedLocalScopeResolver(
      config.scopeEnv,
      Object.freeze({
        async findSite(id) {
          const rows = await client.query(
            `SELECT id,(payload->>'active')::boolean AS active
             FROM inventory_sandbox.settings_masters
             WHERE kind='sites' AND id=$1`,
            [id],
          );
          return rows.rows.length === 1 ? rows.rows[0] : null;
        },
      }),
    );
    const scope = await resolver.resolve(selector);

    const ids = Object.freeze({
      user: randomUUID(),
      membership: randomUUID(),
      role: randomUUID(),
      assignmentEvent: randomUUID(),
      completionEvent: randomUUID(),
      assignmentRequest: randomUUID(),
      completionRequest: randomUUID(),
    });
    await client.query(
      `INSERT INTO inventory_sandbox.factory_auth_events(
        id,event_type,actor_kind,actor_principal,outcome,reason_code,request_id
      ) VALUES($1,'DEVELOPMENT_BOOTSTRAP_ASSIGNMENTS','TRUSTED_BOOTSTRAP',
        'local-bootstrap:postgres','SUCCESS','FIRST_ADMIN_BOOTSTRAP',$2)`,
      [ids.assignmentEvent, ids.assignmentRequest],
    );
    await client.query(
      `INSERT INTO inventory_sandbox.factory_users(
        id,email,email_normalized,display_name
      ) VALUES($1,$2,$2,'Local Administrator')`,
      [ids.user, credentials.email],
    );
    await client.query(
      `INSERT INTO inventory_sandbox.factory_local_credentials(
        user_id,password_hash,hash_algorithm,hash_version
      ) VALUES($1,$2,'argon2id',19)`,
      [ids.user, passwordHash],
    );
    await client.query(
      `INSERT INTO inventory_sandbox.factory_memberships(
        id,user_id,tenant_authority,tenant_id,
        organization_authority,organization_id
      ) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        ids.membership,
        ids.user,
        scope.tenantAuthority,
        scope.tenantId,
        scope.organizationAuthority,
        scope.organizationId,
      ],
    );
    await client.query(
      `INSERT INTO inventory_sandbox.factory_roles(id,code,name,description)
       VALUES($1,$2,$3,$4)`,
      [ids.role, ADMIN_ROLE.code, ADMIN_ROLE.name, ADMIN_ROLE.description],
    );
    for (const permission of ADMIN_ROLE.permissions) {
      await client.query(
        `INSERT INTO inventory_sandbox.factory_permissions(code,description)
         VALUES($1,$2)`,
        [permission.code, permission.description],
      );
      await client.query(
        `INSERT INTO inventory_sandbox.factory_role_permissions(
          id,role_id,permission_code,assigned_event_id
        ) VALUES($1,$2,$3,$4)`,
        [randomUUID(), ids.role, permission.code, ids.assignmentEvent],
      );
    }
    await client.query(
      `INSERT INTO inventory_sandbox.factory_membership_roles(
        id,membership_id,role_id,assigned_event_id
      ) VALUES($1,$2,$3,$4)`,
      [randomUUID(), ids.membership, ids.role, ids.assignmentEvent],
    );
    for (const site of scope.sites)
      await client.query(
        `INSERT INTO inventory_sandbox.factory_membership_sites(
          id,membership_id,site_authority,site_id,assigned_event_id
        ) VALUES($1,$2,$3,$4,$5)`,
        [
          randomUUID(),
          ids.membership,
          site.authority,
          site.id,
          ids.assignmentEvent,
        ],
      );
    await client.query(
      `INSERT INTO inventory_sandbox.factory_auth_events(
        id,event_type,actor_kind,actor_principal,outcome,reason_code,request_id
      ) VALUES($1,'DEVELOPMENT_BOOTSTRAP_COMPLETED','TRUSTED_BOOTSTRAP',
        'local-bootstrap:postgres','SUCCESS','FIRST_ADMIN_BOOTSTRAP',$2)`,
      [ids.completionEvent, ids.completionRequest],
    );
    await client.query("COMMIT");
    return Object.freeze({ status: "PASS", userId: ids.user });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

function prepareSanitizedEnvironment(envPath, original) {
  const lines = original
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*(?:export\s+)?FACTORY_SETUP_ADMIN_PASSWORD\s*=/.test(line),
    );
  const sid = execFileSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  }).match(/S-1-5-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error("LOCAL_SECRET_ACL_IDENTITY_UNAVAILABLE");
  const staged = `${envPath}.bootstrap-${randomBytes(8).toString("hex")}.tmp`;
  fs.closeSync(fs.openSync(staged, "wx", 0o600));
  execFileSync(
    "icacls.exe",
    [staged, "/inheritance:r", "/grant:r", `*${sid}:F`, "*S-1-5-18:F", "*S-1-5-32-544:F"],
    { stdio: "ignore", windowsHide: true },
  );
  fs.writeFileSync(staged, lines.join("\r\n"));
  return staged;
}

export async function runAdminBootstrap(
  args = process.argv.slice(2),
  processEnv = process.env,
) {
  const envPath = resolve(".env.local");
  const original = fs.readFileSync(envPath, "utf8");
  const local = parseEnv(original);
  const config = readBootstrapConfig(
    {
      ...local,
      NODE_ENV: processEnv.NODE_ENV,
      FACTORY_AUTH_BOOTSTRAP_APPROVED:
        processEnv.FACTORY_AUTH_BOOTSTRAP_APPROVED,
    },
    args,
  );
  verifyApprovedMigrationFiles();
  const credentials = await promptAdminCredentials();
  const staged = prepareSanitizedEnvironment(envPath, original);
  const pg = (await import("pg")).default;
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: "postgres",
    password: config.adminPassword,
    ssl: false,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    application_name: "ionflow-factory-first-admin-bootstrap",
    options: "-c search_path=pg_catalog -c lock_timeout=5000",
  });
  let committed = false;
  try {
    await client.connect();
    const result = await applyFirstAdminBootstrap(client, config, credentials);
    committed = true;
    if (fs.readFileSync(envPath, "utf8") !== original)
      throw new Error("LOCAL_CONFIGURATION_CHANGED_RECOVERY_REQUIRED");
    fs.renameSync(staged, envPath);
    return result;
  } catch (error) {
    if (!committed) fs.unlinkSync(staged);
    error.committed = committed;
    error.protectedRecoveryFile = committed ? staged : undefined;
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runAdminBootstrap()
    .then(() =>
      console.log(
        JSON.stringify({
          status: "PASS",
          bootstrap: "FIRST_LOCAL_ADMIN",
          authEnabled: false,
        }),
      ),
    )
    .catch((error) => {
      const code = /^[A-Z0-9_]+$/.test(error?.message ?? "")
        ? error.message
        : "ADMIN_BOOTSTRAP_FAILED";
      console.error(
        JSON.stringify({
          status: "FAIL",
          code,
          committed: error?.committed === true,
          protectedRecoveryFile: error?.protectedRecoveryFile,
        }),
      );
      process.exitCode = 1;
    });
}

export const FIRST_ADMIN_ROLE = ADMIN_ROLE;
