import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const password = process.env.FACTORY_DB_OWNER_PASSWORD;

if (!password) {
  throw new Error(
    "Missing FACTORY_DB_OWNER_PASSWORD in .env.local",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Local migration only");
}

const client = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  database: "production",
  user: "foliar_fertilizer_owner",
  password,
  application_name: "nan-qc-raw-material-migration",
  connectionTimeoutMillis: 5000,
  ssl: false,
});

try {
  await client.connect();

  const identity = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS connected_user,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_namespace
        WHERE nspname = 'foliar_fertilizer'
          AND pg_get_userbyid(nspowner) = current_user
      ) AS owns_schema
  `);

  const target = identity.rows[0];

  if (
    target.database_name !== "production" ||
    target.connected_user !== "foliar_fertilizer_owner" ||
    target.owns_schema !== true
  ) {
    throw new Error("Migration target rejected");
  }

  console.log("Database: production");
  console.log("Schema: foliar_fertilizer");
  console.log("User: foliar_fertilizer_owner");

  const tables = await client.query(`
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'foliar_fertilizer'
      AND tablename IN (
        'm_qc_raw_material',
        'r_qc_raw_material_checks',
        'r_qc_raw_material_history'
      )
  `);

  if (tables.rowCount !== 0) {
    throw new Error(
      "QC tables already exist. Inspect before migrating.",
    );
  }

  const sql = await readFile(
    resolve("migrations/0008_qc_raw_material.up.sql"),
    "utf8",
  );

  await client.query(sql);

  const result = await client.query(`
    SELECT tablename, tableowner
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'foliar_fertilizer'
      AND tablename IN (
        'm_qc_raw_material',
        'r_qc_raw_material_checks',
        'r_qc_raw_material_history'
      )
    ORDER BY tablename
  `);

  console.table(result.rows);

  if (result.rowCount !== 3) {
    throw new Error("Post-migration verification failed");
  }

  console.log("PASS: Migration 0008 applied.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}