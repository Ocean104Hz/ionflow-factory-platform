import fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

import { createSettingsStore } from "../src/server/settings-postgres.ts";

export const SITE_BOOTSTRAP_APPROVAL = "APPROVED_LOCAL_FIRST_ACTIVE_SITE";
export const SITE_BOOTSTRAP_LOCK = join(
  tmpdir(),
  "ionflow-factory-first-active-site-bootstrap.lock",
);

const clean = (value) => typeof value === "string" ? value.trim() : "";

export function readSiteBootstrapConfig(
  env,
  args = [],
  execArgv = process.execArgv,
) {
  if (execArgv.some((value) => value.startsWith("--env-file")))
    throw new Error("ENV_FILE_LOADING_FORBIDDEN");
  if (env.NODE_ENV !== "development")
    throw new Error("LOCAL_DEVELOPMENT_EXECUTION_REQUIRED");
  if (args.length !== 1 || args[0] !== "--execute")
    throw new Error("SITE_BOOTSTRAP_EXECUTION_NOT_REQUESTED");
  if (env.FACTORY_SETTINGS_SITE_BOOTSTRAP_APPROVED !== SITE_BOOTSTRAP_APPROVAL)
    throw new Error("EXPLICIT_SITE_BOOTSTRAP_APPROVAL_MISSING");
  if (
    env.FACTORY_DB_HOST !== "localhost" ||
    env.FACTORY_DB_PORT !== "5432" ||
    env.FACTORY_DB_NAME !== "ionflow_inventory_dev" ||
    env.FACTORY_DB_SCHEMA !== "inventory_sandbox" ||
    env.FACTORY_SETTINGS_ENABLED !== "true" ||
    env.FACTORY_SETTINGS_DB_USER !== "factory_settings_writer" ||
    !env.FACTORY_SETTINGS_DB_PASSWORD
  )
    throw new Error("LOCAL_SETTINGS_TARGET_REJECTED");

  const site = Object.freeze({
    id: clean(env.FACTORY_SETTINGS_BOOTSTRAP_SITE_ID),
    code: clean(env.FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE),
    name: clean(env.FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME),
  });
  if (
    site.id !== env.FACTORY_SETTINGS_BOOTSTRAP_SITE_ID ||
    site.code !== env.FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE ||
    site.name !== env.FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(site.id) ||
    !/^[A-Z0-9_-]{1,30}$/.test(site.code) ||
    !site.name ||
    site.name.length > 100
  )
    throw new Error("APPROVED_SITE_INPUT_INVALID");

  return Object.freeze({
    site,
    storeEnv: Object.freeze({ ...env, NODE_ENV: "development" }),
  });
}

export function acquireSiteBootstrapLock(lockPath = SITE_BOOTSTRAP_LOCK) {
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, "wx", 0o600);
    fs.writeFileSync(descriptor, `${process.pid}\n`, { encoding: "utf8" });
  } catch {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    throw new Error("SITE_BOOTSTRAP_LOCKED_REVIEW_REQUIRED");
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    fs.closeSync(descriptor);
    fs.unlinkSync(lockPath);
  };
}

const canonical = (value) => value.trim().toLocaleLowerCase("th");
const sameRow = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export async function applyInitialSiteBootstrap(store, config) {
  const before = await store.read();
  const sites = before.rows.filter((row) => row.kind === "sites");
  if (sites.some((row) => row.active))
    throw new Error("ACTIVE_SITE_ALREADY_EXISTS");
  if (before.rows.some((row) => row.id === config.site.id))
    throw new Error("SITE_ID_ALREADY_EXISTS");
  if (sites.some((row) => canonical(row.code) === canonical(config.site.code)))
    throw new Error("SITE_CODE_ALREADY_EXISTS");

  const row = Object.freeze({
    id: config.site.id,
    kind: "sites",
    code: config.site.code,
    name: config.site.name,
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

  let saved;
  try {
    saved = await store.save(row, null);
  } catch (error) {
    error.siteCommitted = false;
    throw error;
  }

  const unchanged = before.rows.every((old) =>
    saved.rows.some((current) => current.id === old.id && sameRow(current, old)),
  );
  const created = saved.rows.filter(
    (candidate) => candidate.kind === "sites" && candidate.id === row.id,
  );
  if (
    !unchanged ||
    created.length !== 1 ||
    !created[0].active ||
    created[0].code !== row.code ||
    created[0].name !== row.name ||
    typeof saved.versions[row.id] !== "string"
  ) {
    const error = new Error("SITE_BOOTSTRAP_SAVE_RESULT_REJECTED");
    error.siteCommitted = true;
    throw error;
  }

  const verified = await store.read().catch((cause) => {
    const error = new Error("SITE_BOOTSTRAP_READBACK_FAILED", { cause });
    error.siteCommitted = true;
    throw error;
  });
  const exact = verified.rows.filter(
    (candidate) => candidate.kind === "sites" && candidate.id === row.id,
  );
  if (
    exact.length !== 1 ||
    !exact[0].active ||
    exact[0].code !== row.code ||
    exact[0].name !== row.name ||
    typeof verified.versions[row.id] !== "string"
  ) {
    const error = new Error("SITE_BOOTSTRAP_READBACK_REJECTED");
    error.siteCommitted = true;
    throw error;
  }
  return Object.freeze({
    status: "PASS",
    site: Object.freeze({ id: row.id, code: row.code, name: row.name }),
    version: verified.versions[row.id],
  });
}

export async function runSiteBootstrap(
  args = process.argv.slice(2),
  processEnv = process.env,
) {
  const envPath = resolve(".env.local");
  const local = parseEnv(fs.readFileSync(envPath, "utf8"));
  const config = readSiteBootstrapConfig(
    {
      ...local,
      NODE_ENV: processEnv.NODE_ENV,
      FACTORY_SETTINGS_SITE_BOOTSTRAP_APPROVED:
        processEnv.FACTORY_SETTINGS_SITE_BOOTSTRAP_APPROVED,
      FACTORY_SETTINGS_BOOTSTRAP_SITE_ID:
        processEnv.FACTORY_SETTINGS_BOOTSTRAP_SITE_ID,
      FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE:
        processEnv.FACTORY_SETTINGS_BOOTSTRAP_SITE_CODE,
      FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME:
        processEnv.FACTORY_SETTINGS_BOOTSTRAP_SITE_NAME,
    },
    args,
  );
  const release = acquireSiteBootstrapLock();
  let store;
  try {
    store = createSettingsStore(config.storeEnv);
    return await applyInitialSiteBootstrap(store, config);
  } finally {
    await store?.close().catch(() => {});
    release();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runSiteBootstrap()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      const code = /^[A-Z0-9_]+$/.test(error?.message ?? "")
        ? error.message
        : "SITE_BOOTSTRAP_FAILED";
      console.error(JSON.stringify({
        status: "FAIL",
        code,
        siteCommitted: error?.siteCommitted === true,
      }));
      process.exitCode = 1;
    });
}
