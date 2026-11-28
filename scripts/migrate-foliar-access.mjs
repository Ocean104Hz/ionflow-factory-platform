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
  const prdMigration = process.argv[2] === "--production-order-doc-no";
  if (prdMigration) {
    const identity = await client.query(`SELECT current_database() AS db, current_user AS role,
      to_regclass('foliar_fertilizer.production_v1_documents') IS NOT NULL AS base,
      to_regclass('foliar_fertilizer.production_order_doc_no_counters') IS NOT NULL AS counters,
      to_regclass('foliar_fertilizer.production_order_doc_no_reservations') IS NOT NULL AS reservations`);
    const target = identity.rows[0];
    console.log("PRD migration target:", target);
    if (target.db !== "production" || target.role !== "foliar_fertilizer_owner" || !target.base || target.counters !== target.reservations) throw new Error("PRD migration preflight failed");
    if (process.argv.includes("--check")) process.exitCode = 0;
    else if (!process.argv.includes("--confirm-target")) throw new Error("Verify target and backups first; --confirm-target is required");
    if (!process.argv.includes("--check") && !target.counters) {
      const sql = await readFile(resolve("migrations/0012_production_order_doc_no.up.sql"), "utf8");
      await client.query(sql);
      const verification = await client.query(`SELECT to_regclass('foliar_fertilizer.production_order_doc_no_counters') IS NOT NULL AS counters,
        to_regclass('foliar_fertilizer.production_order_doc_no_reservations') IS NOT NULL AS reservations`);
      if (!verification.rows[0].counters || !verification.rows[0].reservations) throw new Error("PRD migration verification failed");
      console.log("PRD migration applied; both tables present.");
    }
  } else {
  const migration = process.argv[2] === "--warehouse"
    ? ["warehouse_receipts", "0010_factory_warehouse_documents"]
    : process.argv[2] === "--qc"
    ? ["qc_documents", "0009_factory_qc"]
    : process.argv[2] === "--delivery-evidence"
    ? ["hub_delivery_evidence", "0008_factory_delivery_evidence"]
    : process.argv[2] === "--sales-documents"
    ? ["hub_documents", "0007_factory_sales_documents"]
    : process.argv[2] === "--sales-hub"
    ? ["hub_orders", "0006_factory_sales_hub"]
    : process.argv[2] === "--packaging"
    ? ["packaging_reports", "0005_factory_packaging"]
    : process.argv[2] === "--organic"
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
  }
} finally {
  await client.end();
}
