import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const database = "production";
const schema = "foliar_fertilizer";
const ownerRole = "foliar_fertilizer_owner";
const appRole = "foliar_fertilizer_app";

const accessTables = [
  "app_users",
  "app_roles",
  "app_modules",
  "app_user_roles",
  "app_role_modules",
];

const stockTables = [
  "m_customers",
  "m_items",
  "m_stock_locations",
  "m_stock_documents",
  "r_stock_document_lines",
];

async function getTables(client, names) {
  const { rows } = await client.query(
    `SELECT c.relname AS name,
            c.relkind AS kind,
            pg_get_userbyid(c.relowner) AS owner
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relname = ANY($2::text[])`,
    [schema, names],
  );

  return rows;
}

function verifyTables(rows, names) {
  return names.every((name) =>
    rows.some(
      (row) => row.name === name && row.kind === "r" && row.owner === ownerRole,
    ),
  );
}

async function migrate() {
  const password = process.env.FACTORY_DB_OWNER_PASSWORD;

  if (!password) {
    throw new Error("กรุณาตั้ง FACTORY_DB_OWNER_PASSWORD ใน .env.local");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("สคริปต์นี้รองรับเฉพาะการรันผ่าน Cloud SQL Proxy ในเครื่อง");
  }

  const sql = await readFile(
    resolve("migrations/0002_foliar_fertilizer_stock.up.sql"),
    "utf8",
  );

  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5433,
    database,
    user: ownerRole,
    password,
    application_name: "foliar-stock-migration",
    connectionTimeoutMillis: 5000,
    ssl: false,
  });

  try {
    await client.connect();

    const { rows: [target] } = await client.query(
      `SELECT current_database() AS database_name,
              current_user AS role_name,
              to_regnamespace($1) IS NOT NULL AS schema_exists,
              EXISTS (
                SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $2
              ) AS app_role_exists`,
      [schema, appRole],
    );

    if (
      target.database_name !== database ||
      target.role_name !== ownerRole ||
      !target.schema_exists ||
      !target.app_role_exists
    ) {
      throw new Error("Database, Schema หรือ Role ไม่ตรงกับ Migration 0002");
    }

    const access = await getTables(client, accessTables);

    if (!verifyTables(access, accessTables)) {
      throw new Error("โครงสร้าง Migration 0001 ไม่ครบหรือเจ้าของตารางไม่ตรง");
    }

    const existing = await getTables(client, stockTables);

    if (existing.length > 0) {
      if (verifyTables(existing, stockTables)) {
        console.log("SKIP: พบตาราง Stock ครบ 5 ตาราง ไม่รัน Migration ซ้ำ");
        console.log("กรุณาตรวจสอบ Constraints, INDEX และสิทธิ์ด้วยสคริปต์ตรวจสอบ");
        return;
      }

      throw new Error("พบตาราง Stock บางส่วนหรือโครงสร้างผิดประเภท กรุณาตรวจสอบก่อน");
    }

    await client.query("SET lock_timeout = '5s'");
    await client.query(sql);

    const created = await getTables(client, stockTables);

    if (!verifyTables(created, stockTables)) {
      throw new Error("Migration ส่งคำสั่งแล้ว แต่ตรวจสอบตาราง Stock หลังรันไม่ผ่าน");
    }

    console.log("Migration 0002: สร้างตาราง Stock ครบ 5 ตาราง");
    console.table(created);
    console.log("ต้องตรวจสอบ Constraints, INDEX และสิทธิ์เพิ่มเติม");
  } finally {
    await client.end();
  }
}

await migrate();