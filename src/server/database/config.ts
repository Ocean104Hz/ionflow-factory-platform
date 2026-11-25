import "server-only";

const messages = {
  DB_DISABLED: "ยังไม่เปิดใช้ฐานข้อมูล development",
  DB_CONFIG_INVALID: "การตั้งค่าฐานข้อมูล development ไม่ถูกต้องหรือไม่ครบ",
  DB_UNAVAILABLE: "เชื่อมต่อฐานข้อมูล development ไม่สำเร็จ",
  DB_QUERY_FAILED: "อ่านข้อมูลฐานข้อมูล development ไม่สำเร็จ",
  DB_TRANSACTION_FAILED: "จบธุรกรรมฐานข้อมูล development ไม่สำเร็จ",
  DB_VERIFICATION_FAILED:
    "ฐานข้อมูล schema หรือสิทธิ์ของ application role ไม่ตรงข้อกำหนด",
  AUTH_NOT_CONFIGURED:
    "ยังไม่เปิดใช้ persistent operations เนื่องจากยังไม่มี verified server session และ tenant scope",
} as const;
export type BackendErrorCode = keyof typeof messages;
export class BackendError extends Error {
  readonly code: BackendErrorCode;
  constructor(code: BackendErrorCode) {
    super(messages[code]);
    this.name = "BackendError";
    this.code = code;
  }
}
export interface DatabaseConfig {
  host: string;
  port: number;
  database: "production";
  schema: "foliar_fertilizer";
  user: string;
  password: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMillis: number;
}
export function readDatabaseConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DatabaseConfig {
  if (env.FACTORY_DB_ENABLED !== "true") throw new BackendError("DB_DISABLED");
  const fail = (): never => {
    throw new BackendError("DB_CONFIG_INVALID");
  };
  const production = env.NODE_ENV === "production";
  const instance = env.FACTORY_DB_INSTANCE_CONNECTION_NAME ?? "";
  const host = production ? `/cloudsql/${instance}` : env.FACTORY_DB_HOST;
  const port = production ? 5432 : Number(env.FACTORY_DB_PORT);
  if (
    (production &&
      instance !==
        "ionflow-data-prod:asia-southeast3:ionflow-central-postgres") ||
    (!production && host !== "127.0.0.1") ||
    !host
  )
    return fail();
  if (
    (!production && env.FACTORY_DB_PORT !== "5433") ||
    env.FACTORY_DB_NAME !== "production" ||
    env.FACTORY_DB_SCHEMA !== "foliar_fertilizer"
  )
    return fail();
  const user = env.FACTORY_DB_USER ?? "";
  const password = env.FACTORY_DB_PASSWORD ?? "";
  if (
    !/^[a-z_][a-z0-9_]{0,62}$/.test(user) ||
    user !== "foliar_fertilizer_app" ||
    !password ||
    password.includes("\0")
  )
    return fail();
  function integer(key: string, fallback: number, min: number, max: number) {
    const raw = env[key] ?? String(fallback);
    if (!/^\d+$/.test(raw)) return fail();
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      return fail();
    return value;
  }
  return {
    host,
    port,
    database: "production",
    schema: "foliar_fertilizer",
    user,
    password,
    max: integer("FACTORY_DB_POOL_MAX", 5, 1, 10),
    connectionTimeoutMillis: integer(
      "FACTORY_DB_CONNECT_TIMEOUT_MS",
      5000,
      100,
      30000,
    ),
    idleTimeoutMillis: integer(
      "FACTORY_DB_IDLE_TIMEOUT_MS",
      10000,
      1000,
      60000,
    ),
    statementTimeoutMillis: integer(
      "FACTORY_DB_STATEMENT_TIMEOUT_MS",
      5000,
      100,
      60000,
    ),
  };
}
