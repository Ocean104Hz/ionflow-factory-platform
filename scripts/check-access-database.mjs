import pg from "pg";

const client = new pg.Client({
  host: process.env.FACTORY_DB_HOST,
  port: Number(process.env.FACTORY_DB_PORT),
  database: process.env.FACTORY_DB_NAME,
  user: process.env.FACTORY_DB_USER,
  password: process.env.FACTORY_DB_PASSWORD,
  application_name: "foliar-access-check",
  ssl: false,
});

try {
  await client.connect();
  const result = await client.query(`SELECT
    current_database() AS database,
    current_user AS role,
    to_regnamespace('foliar_fertilizer') IS NOT NULL AS schema_ok,
    to_regclass('foliar_fertilizer.app_users') IS NOT NULL AS access_tables`);
  console.log(JSON.stringify(result.rows[0]));
} catch (error) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  console.error(`ตรวจฐานข้อมูลไม่สำเร็จ (${code}) โปรดตรวจ Proxy และค่าการเชื่อมต่อ`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
