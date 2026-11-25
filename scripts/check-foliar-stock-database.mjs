import { pathToFileURL } from "node:url";

const database = "production";
const schema = "foliar_fertilizer";
const ownerRole = "foliar_fertilizer_owner";
const appRole = "foliar_fertilizer_app";

// Column contract: [PostgreSQL type, nullable, default, identity].
const id = { id: ["int8", false, null, "ALWAYS"] };
const active = { is_active: ["bool", false, "true"] };
const timestamps = {
  created_at: ["timestamptz", false, "now()"],
  updated_at: ["timestamptz", false, "now()"],
};

const expectedColumns = {
  m_customers: {
    ...id,
    customer_code: ["text", true],
    name: ["text", false],
    note: ["text", true],
    ...active,
    ...timestamps,
  },
  m_items: {
    ...id,
    item_code: ["text", true],
    legacy_code: ["text", true],
    item_type: ["text", false],
    name: ["text", false],
    item_group: ["text", true],
    added_date: ["date", true],
    specification: ["text", true],
    stock_unit: ["text", false],
    safety_stock_qty: ["numeric", true],
    note: ["text", true],
    ...active,
    ...timestamps,
  },
  m_stock_locations: {
    ...id,
    location_code: ["text", false],
    name: ["text", false],
    note: ["text", true],
    ...active,
    ...timestamps,
  },
  m_stock_documents: {
    ...id,
    document_type: ["text", false],
    document_no: ["text", true],
    document_date: ["date", true],
    customer_id: ["int8", true],
    reference_document_id: ["int8", true],
    source_group_code: ["text", true],
    status: ["text", false, "'DRAFT'::text"],
    note: ["text", true],
    ...timestamps,
  },
  r_stock_document_lines: {
    ...id,
    document_id: ["int8", false],
    line_no: ["int4", false],
    item_id: ["int8", true],
    source_line_id: ["int8", true],
    owner_kind: ["text", false, "'UNKNOWN'::text"],
    owner_customer_id: ["int8", true],
    from_location_id: ["int8", true],
    to_location_id: ["int8", true],
    count_location_id: ["int8", true],
    occurred_on: ["date", true],
    quantity: ["numeric", true],
    unit: ["text", true],
    reason_code: ["text", true],
    counted_qty: ["numeric", true],
    book_qty_at_count: ["numeric", true],
    unit_cost: ["numeric", true],
    cost_amount: ["numeric", true],
    packing_price: ["numeric", true],
    packing_cost: ["numeric", true],
    packing_fee: ["numeric", true],
    packing_fee_cost: ["numeric", true],
    weight_tonnes: ["numeric", true],
    source_file_name: ["text", true],
    source_sheet_name: ["text", true],
    source_cell_range: ["text", true],
    source_data: ["json", true],
    note: ["text", true],
    ...timestamps,
  },
};

const tables = Object.keys(expectedColumns);

const expectedUnique = [
  ["m_customers", ["customer_code"]],
  ["m_stock_locations", ["location_code"]],
  ["r_stock_document_lines", ["document_id", "line_no"]],
];

const expectedForeignKeys = [
  ["m_stock_documents", "customer_id", "m_customers"],
  ["m_stock_documents", "reference_document_id", "m_stock_documents"],
  ["r_stock_document_lines", "document_id", "m_stock_documents"],
  ["r_stock_document_lines", "item_id", "m_items"],
  ["r_stock_document_lines", "source_line_id", "r_stock_document_lines"],
  ["r_stock_document_lines", "owner_customer_id", "m_customers"],
  ["r_stock_document_lines", "from_location_id", "m_stock_locations"],
  ["r_stock_document_lines", "to_location_id", "m_stock_locations"],
  ["r_stock_document_lines", "count_location_id", "m_stock_locations"],
];

const expectedChecks = [
  ["m_items", ["item_type"]],
  ["m_stock_documents", ["document_type"]],
  ["m_stock_documents", ["status"]],
  ["r_stock_document_lines", ["line_no"]],
  ["r_stock_document_lines", ["owner_kind"]],
  ["r_stock_document_lines", ["quantity"]],
  ["r_stock_document_lines", ["counted_qty"]],
  ["r_stock_document_lines", ["owner_kind", "owner_customer_id"]],
  ["r_stock_document_lines", ["from_location_id", "to_location_id"]],
];

const expectedIndexes = [
  ["idx_m_items_item_type", "m_items", ["item_type"], null],
  [
    "idx_m_stock_documents_type_status_date",
    "m_stock_documents",
    ["document_type", "status", "document_date"],
    null,
  ],
  [
    "idx_m_stock_documents_so_group_date",
    "m_stock_documents",
    ["source_group_code", "document_date"],
    "document_type = 'SO'::text",
  ],
  [
    "idx_r_stock_document_lines_item_date",
    "r_stock_document_lines",
    ["item_id", "occurred_on"],
    null,
  ],
  [
    "idx_r_stock_document_lines_owner_customer",
    "r_stock_document_lines",
    ["owner_customer_id"],
    null,
  ],
];

function sameColumns(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameColumnSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    sameColumns([...actual].sort(), [...expected].sort())
  );
}

function normalizePredicate(value) {
  if (value === null) return null;

  return value
    .trim()
    .replace(/^\((.*)\)$/s, "$1")
    .replace(/\s+/g, " ");
}

// The caller must supply a connected client inside a read-only transaction.
export async function verifyStockDatabase(client) {
  const results = [];

  const add = (check, passed) =>
    results.push({ check, passed: Boolean(passed) });

  const {
    rows: [target],
  } = await client.query(
    `SELECT current_database() AS database_name,
            current_user AS role_name,
            to_regnamespace($1) IS NOT NULL AS schema_exists,
            EXISTS (
              SELECT 1
              FROM pg_catalog.pg_roles
              WHERE rolname = $2
            ) AS app_role_exists`,
    [schema, appRole],
  );

  const targetOk =
    target?.database_name === database &&
    target.role_name === ownerRole &&
    target.schema_exists &&
    target.app_role_exists;

  add("Database, schema and roles", targetOk);

  if (!targetOk) {
    return { results, checkDefinitions: [] };
  }

  const {
    rows: [schemaPermissions],
  } = await client.query(
    `SELECT has_schema_privilege($1, $2, 'USAGE') AS can_use,
            has_schema_privilege($1, $2, 'CREATE') AS can_create,
            pg_has_role($1, $3, 'MEMBER') AS owner_member`,
    [appRole, schema, ownerRole],
  );

  add(
    "Application role: schema USAGE, no CREATE or owner membership",
    schemaPermissions.can_use &&
      !schemaPermissions.can_create &&
      !schemaPermissions.owner_member,
  );

  const { rows: relations } = await client.query(
    `SELECT c.relname AS table_name,
            c.relkind AS kind,
            pg_get_userbyid(c.relowner) AS owner_name,
            has_table_privilege($3, c.oid, 'SELECT') AS can_select,
            has_table_privilege($3, c.oid, 'INSERT') AS can_insert,
            has_table_privilege($3, c.oid, 'UPDATE') AS can_update,
            has_table_privilege($3, c.oid, 'DELETE') AS can_delete,
            has_table_privilege($3, c.oid, 'TRUNCATE') AS can_truncate,
            EXISTS (
              SELECT 1
              FROM aclexplode(
                coalesce(c.relacl, acldefault('r', c.relowner))
              ) a
              WHERE a.grantee = 0
            ) AS public_access
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n
       ON n.oid = c.relnamespace
     WHERE n.nspname = $1
       AND c.relname = ANY($2::text[])
       AND c.relkind = 'r'`,
    [schema, tables, appRole],
  );

  for (const table of tables) {
    const row = relations.find((entry) => entry.table_name === table);

    add(
      `${table}: table and owner`,
      row?.kind === "r" && row.owner_name === ownerRole,
    );

    add(
      `${table}: effective SELECT/INSERT/UPDATE, no DELETE/TRUNCATE/PUBLIC table grants`,
      row?.can_select &&
        row.can_insert &&
        row.can_update &&
        !row.can_delete &&
        !row.can_truncate &&
        !row.public_access,
    );
  }

  const { rows: columns } = await client.query(
    `SELECT table_name,
            column_name,
            udt_name,
            udt_schema,
            domain_name,
            is_nullable,
            column_default,
            identity_generation,
            numeric_precision,
            numeric_scale
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = ANY($2::text[])`,
    [schema, tables],
  );

  for (const [table, definitions] of Object.entries(expectedColumns)) {
    for (const [
      name,
      [type, nullable, defaultValue = null, identity = null],
    ] of Object.entries(definitions)) {
      const row = columns.find(
        (entry) => entry.table_name === table && entry.column_name === name,
      );

      add(
        `${table}.${name}: column contract`,
        row?.udt_name === type &&
          row.udt_schema === "pg_catalog" &&
          row.domain_name === null &&
          row.is_nullable === (nullable ? "YES" : "NO") &&
          row.column_default === defaultValue &&
          row.identity_generation === identity &&
          (type !== "numeric" ||
            (row.numeric_precision === null && row.numeric_scale === null)),
      );
    }
  }

  const { rows: constraints } = await client.query(
    `SELECT t.relname AS table_name,
            c.conname AS constraint_name,
            c.contype AS kind,
            c.convalidated AS validated,
            c.condeferrable AS deferrable,
            c.confdeltype AS delete_action,
            c.confupdtype AS update_action,
            c.confmatchtype AS match_type,

            ARRAY(
              SELECT a.attname::text
              FROM unnest(c.conkey)
                WITH ORDINALITY k(attnum, position)
              JOIN pg_catalog.pg_attribute a
                ON a.attrelid = c.conrelid
               AND a.attnum = k.attnum
              ORDER BY k.position
            ) AS columns,

            rn.nspname AS ref_schema,
            rt.relname AS ref_table,

            ARRAY(
              SELECT a.attname::text
              FROM unnest(c.confkey)
                WITH ORDINALITY k(attnum, position)
              JOIN pg_catalog.pg_attribute a
                ON a.attrelid = c.confrelid
               AND a.attnum = k.attnum
              ORDER BY k.position
            ) AS ref_columns,

            pg_get_constraintdef(c.oid, true) AS definition

     FROM pg_catalog.pg_constraint c
     JOIN pg_catalog.pg_class t
       ON t.oid = c.conrelid
     JOIN pg_catalog.pg_namespace n
       ON n.oid = t.relnamespace
     LEFT JOIN pg_catalog.pg_class rt
       ON rt.oid = c.confrelid
     LEFT JOIN pg_catalog.pg_namespace rn
       ON rn.oid = rt.relnamespace
     WHERE n.nspname = $1
       AND t.relname = ANY($2::text[])`,
    [schema, tables],
  );

  const valid = (row) => row.validated && !row.deferrable;

  for (const table of tables) {
    add(
      `${table}: PK (id)`,
      constraints.some(
        (row) =>
          row.table_name === table &&
          row.kind === "p" &&
          valid(row) &&
          sameColumns(row.columns, ["id"]),
      ),
    );
  }

  for (const [table, cols] of expectedUnique) {
    add(
      `${table}: UNIQUE (${cols.join(", ")})`,
      constraints.some(
        (row) =>
          row.table_name === table &&
          row.kind === "u" &&
          valid(row) &&
          sameColumns(row.columns, cols),
      ),
    );
  }

  for (const [table, column, reference] of expectedForeignKeys) {
    add(
      `${table}.${column}: FK -> ${reference}.id`,
      constraints.some(
        (row) =>
          row.table_name === table &&
          row.kind === "f" &&
          valid(row) &&
          sameColumns(row.columns, [column]) &&
          row.ref_schema === schema &&
          row.ref_table === reference &&
          sameColumns(row.ref_columns, ["id"]) &&
          row.delete_action === "r" &&
          row.update_action === "a" &&
          row.match_type === "s",
      ),
    );
  }

  for (const [table, cols] of expectedChecks) {
    add(
      `${table}: validated CHECK on (${cols.join(", ")})`,
      constraints.some(
        (row) =>
          row.table_name === table &&
          row.kind === "c" &&
          valid(row) &&
          sameColumnSet(row.columns, cols),
      ),
    );
  }

  const { rows: indexes } = await client.query(
    `SELECT ic.relname AS index_name,
            t.relname AS table_name,
            i.indisvalid AS valid,
            i.indisready AS ready,
            i.indisunique AS is_unique,
            am.amname AS method,
            i.indnatts AS total_columns,
            i.indnkeyatts AS key_columns,

            ARRAY(
              SELECT pg_get_indexdef(i.indexrelid, k, true)
              FROM generate_series(1, i.indnkeyatts) k
              ORDER BY k
            ) AS columns,

            pg_get_expr(i.indpred, i.indrelid) AS predicate

     FROM pg_catalog.pg_index i
     JOIN pg_catalog.pg_class t
       ON t.oid = i.indrelid
     JOIN pg_catalog.pg_namespace n
       ON n.oid = t.relnamespace
     JOIN pg_catalog.pg_class ic
       ON ic.oid = i.indexrelid
     JOIN pg_catalog.pg_am am
       ON am.oid = ic.relam
     WHERE n.nspname = $1
       AND t.relname = ANY($2::text[])`,
    [schema, tables],
  );

  for (const [name, table, cols, predicate] of expectedIndexes) {
    const row = indexes.find(
      (entry) => entry.index_name === name && entry.table_name === table,
    );

    add(
      `${name}: index contract`,
      row?.valid &&
        row.ready &&
        !row.is_unique &&
        row.method === "btree" &&
        Number(row.total_columns) === cols.length &&
        Number(row.key_columns) === cols.length &&
        sameColumns(row.columns, cols) &&
        normalizePredicate(row.predicate) === predicate,
    );
  }

  const { rows: sequences } = await client.query(
    `SELECT s.relname AS sequence_name,
            pg_get_userbyid(s.relowner) AS owner_name,
            t.relname AS table_name,

            pg_get_serial_sequence(
              format('%I.%I', n.nspname, t.relname),
              'id'
            )::regclass = s.oid AS linked,

            has_sequence_privilege(
              $3, s.oid, 'USAGE'
            ) AS can_use,

            has_sequence_privilege(
              $3, s.oid, 'UPDATE'
            ) AS can_update,

            EXISTS (
              SELECT 1
              FROM aclexplode(
                coalesce(s.relacl, acldefault('s', s.relowner))
              ) a
              WHERE a.grantee = 0
            ) AS public_access

     FROM pg_catalog.pg_class t
     JOIN pg_catalog.pg_namespace n
       ON n.oid = t.relnamespace
     JOIN pg_catalog.pg_class s
       ON s.relnamespace = n.oid
      AND s.relkind = 'S'
      AND s.relname = t.relname || '_id_seq'
     WHERE n.nspname = $1
       AND t.relname = ANY($2::text[])
       AND t.relkind = 'r'`,
    [schema, tables, appRole],
  );

  for (const table of tables) {
    const row = sequences.find(
      (entry) =>
        entry.table_name === table && entry.sequence_name === `${table}_id_seq`,
    );

    add(
      `${table}: identity sequence and permissions`,
      row?.linked &&
        row.owner_name === ownerRole &&
        row.can_use &&
        !row.can_update &&
        !row.public_access,
    );
  }

  // Report CHECK expressions for manual comparison.
  const checkDefinitions = constraints
    .filter((row) => row.kind === "c")
    .map((row) => ({
      table: row.table_name,
      constraint: row.constraint_name,
      definition: row.definition,
    }));

  return {
    results,
    checkDefinitions,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("NOT RUN: ใช้สคริปต์ผ่าน Cloud SQL Proxy ในเครื่องเท่านั้น");

    process.exitCode = 1;
    return;
  }

  const password = process.env.FACTORY_DB_OWNER_PASSWORD;

  if (!password) {
    console.error("NOT RUN: กรุณาตั้ง FACTORY_DB_OWNER_PASSWORD ใน .env.local");

    process.exitCode = 1;
    return;
  }

  const { default: pg } = await import("pg");

  const client = new pg.Client({
    host: "127.0.0.1",
    port: 5433,
    database,
    user: ownerRole,
    password,
    application_name: "foliar-stock-database-check",
    connectionTimeoutMillis: 5000,
    ssl: false,
  });

  try {
    await client.connect();

    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

    await client.query("SET LOCAL statement_timeout = '10s'");

    await client.query("SET LOCAL lock_timeout = '5s'");

    const { results, checkDefinitions } = await verifyStockDatabase(client);

    await client.query("COMMIT");

    const failures = results.filter((row) => !row.passed);

    console.log(
      `ตรวจสอบ Migration 0002: ${results.length - failures.length}/${results.length} ผ่าน`,
    );

    if (failures.length > 0) {
      console.table(
        failures.map((row) => ({
          check: row.check,
          status: "FAIL",
        })),
      );

      process.exitCode = 1;
    } else {
      console.log("PASS: ตรวจสอบโครงสร้างและสิทธิ์ตามรายการที่กำหนดผ่าน");
    }

    if (checkDefinitions.length > 0) {
      console.log("REVIEW: เปรียบเทียบนิพจน์ CHECK กับไฟล์ UP เพิ่มเติม");

      console.table(checkDefinitions);
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    const code =
      typeof error?.code === "string" && /^[A-Z0-9_]{1,32}$/.test(error.code)
        ? error.code
        : "DB_CHECK_FAILED";

    console.error(
      `FAIL: ${code}. ตรวจสอบ Cloud SQL Proxy และการตั้งค่าในเครื่อง`,
    );

    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main().catch(() => {
    console.error("FAIL: ไม่สามารถเริ่มหรือปิดสคริปต์ตรวจสอบฐานข้อมูลได้");

    process.exitCode = 1;
  });
}
