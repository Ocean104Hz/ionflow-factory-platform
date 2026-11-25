import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const password = process.env.FACTORY_DB_OWNER_PASSWORD;
if (!password) throw new Error("กรุณาตั้ง FACTORY_DB_OWNER_PASSWORD ใน .env.local");
if (process.env.NODE_ENV === "production")
  throw new Error("สคริปต์นี้รองรับเฉพาะการรันผ่าน Cloud SQL Proxy ในเครื่อง");

const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  database: "production",
  user: "foliar_fertilizer_owner",
  password,
  application_name: "foliar-access-migration",
  ssl: false,
});

try {
  await client.connect();
  const migration = process.argv[2] === "--organic"
    ? ["organic_documents", "0004_factory_organic"]
    : process.argv[2] === "--production-v1"
    ? ["production_v1_documents", "0003_factory_production_v1"]
    : process.argv[2] === "--settings"
      ? ["settings_masters", "0002_factory_settings"]
      : ["app_users", "0001_foliar_fertilizer_access"];
  const exists = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS applied",
    [`foliar_fertilizer.${migration[0]}`],
  );
  if (exists.rows[0].applied) {
    console.log(`Migration ${migration[1]} ถูกใช้งานแล้ว`);
  } else {
    const sql = await readFile(
      resolve(`migrations/${migration[1]}.up.sql`),
      "utf8",
    );
    await client.query(sql);
    console.log(`ลง migration ${migration[1]} สำเร็จ`);
  }
} finally {
  await client.end();
}
