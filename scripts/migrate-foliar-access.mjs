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
  const exists = await client.query(
    "SELECT to_regclass('foliar_fertilizer.app_users') IS NOT NULL AS applied",
  );
  if (exists.rows[0].applied) {
    console.log("Migration 0001_foliar_fertilizer_access ถูกใช้งานแล้ว");
  } else {
    const sql = await readFile(
      resolve("migrations/0001_foliar_fertilizer_access.up.sql"),
      "utf8",
    );
    await client.query(sql);
    console.log("สร้างตารางผู้ใช้ Role และ Module สำเร็จ");
  }
} finally {
  await client.end();
}
