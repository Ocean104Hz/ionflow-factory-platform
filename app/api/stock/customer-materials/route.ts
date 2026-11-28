import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import {
  FactoryAuthError,
  requireFactoryModule,
} from "@/src/server/auth/auth-service.ts";
import {
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
} from "@/src/server/auth/auth-http.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { BackendError } from "@/src/server/database/config.ts";
import {
  CUSTOMER_MATERIALS_DAILY_FIELDS,
  CUSTOMER_MATERIALS_PERIODS,
  CUSTOMER_MATERIALS_SHEET_NAMES,
  CUSTOMER_MATERIALS_SUMMARY_FIELDS,
  blankCustomerMaterialsDaily,
  blankCustomerMaterialsSummary,
  customerMaterialsDaysInPeriod,
  customerMaterialsRowKey,
  isCustomerMaterialsRow,
  validateCustomerMaterialsDailyEntry,
  validateCustomerMaterialsRow,
  type CustomerMaterialsDailyEntry,
  type CustomerMaterialsRow,
  type CustomerMaterialsSheet,
  type CustomerMaterialsSheetName,
} from "@/src/features/stock_customer_materials/stock_customer_materials_domain";
import {
  withStockWriteTransaction,
  type StockWriteQueries,
} from "../_lib/stock-write-database.ts";

const moduleKey = "stock_customer_materials";
const headers = { "Cache-Control": "no-store" };
const maxBodyBytes = 4 * 1024 * 1024;
const maxChangedRows = 2000;

// GET ?sheet_name=OCT => { ok, sheet, revision }
// POST { action: "save_sheet", sheet_name, expected_revision, changes, deleted_refs?, confirm_hard_delete? }
// Nonempty deleted_refs require explicit confirmation of permanent deletion.
// Refs are customerMaterialsRowKey(row), not product codes or customer names.
// Each row owns an independent SNAPSHOT document and one line.
// No master matching, automatic imports, inventory calculations or cross-period writes.

type Reject = () => never;

function invalid(): never {
  throw new FactoryAuthError("INVALID_REQUEST", 400);
}

function invalidStored(): never {
  throw new Error("STOCK_CUSTOMER_MATERIALS_SNAPSHOT_INVALID");
}

function record(
  value: unknown,
  reject: Reject = invalid,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return reject();
  }
  return value as Record<string, unknown>;
}

function onlyFields(
  value: Record<string, unknown>,
  fields: readonly string[],
  reject: Reject = invalid,
): void {
  if (Object.keys(value).some((key) => !fields.includes(key))) reject();
}

function text(value: unknown, reject: Reject = invalid): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    /[\uD800-\uDFFF]/u.test(value)
  ) {
    return reject();
  }
  return value;
}

function nullableText(value: unknown, reject: Reject): string | null {
  return value === null ? null : text(value, reject);
}

function databaseId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    (value.length === 19 && value > "9223372036854775807")
  ) {
    return invalidStored();
  }
  return value;
}

function returnedId(rows: Record<string, unknown>[]): string {
  if (rows.length !== 1) return invalidStored();
  return databaseId(rows[0]?.id);
}

function readSheetName(value: unknown): CustomerMaterialsSheetName {
  const sheetName = CUSTOMER_MATERIALS_SHEET_NAMES.find(
    (name) => name === value,
  );
  if (sheetName === undefined) return invalid();
  return sheetName;
}

function groupCode(sheetName: CustomerMaterialsSheetName): string {
  return `${moduleKey}:${sheetName}`;
}

function periodDate(sheetName: CustomerMaterialsSheetName): string | null {
  const period = CUSTOMER_MATERIALS_PERIODS[sheetName];
  // Historical carryover has no verified month or calendar date.
  if (period.month === null) return null;
  return `${period.year_be - 543}-${String(period.month).padStart(2, "0")}-01`;
}

async function readBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json" || !request.body) return invalid();

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let raw = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) return invalid();
      raw += decoder.decode(value, { stream: true });
    }
    return JSON.parse(raw + decoder.decode()) as unknown;
  } catch {
    await reader.cancel().catch(() => undefined);
    return invalid();
  } finally {
    reader.releaseLock();
  }
}

// Structural validation preserves literal historical cells. Business validation
// for changed fields is performed against the locked database row below.
function readRow(
  value: unknown,
  sheetName: CustomerMaterialsSheetName,
  reject: Reject = invalid,
): CustomerMaterialsRow {
  const source = record(value, reject);
  onlyFields(
    source,
    ["sheet_name", "item", "summary", "remark", "daily"],
    reject,
  );
  if (!isCustomerMaterialsRow(value) || value.sheet_name !== sheetName)
    return reject();

  const item = record(value.item, reject);
  onlyFields(
    item,
    [
      "id",
      "added_date",
      "so_sheet",
      "source_row",
      "sales_customer",
      "material_type",
      "code",
      "no",
      "description",
      "unit",
    ],
    reject,
  );
  if (!Number.isSafeInteger(value.item.source_row)) return reject();
  const cleanItem: CustomerMaterialsRow["item"] = {
    ...(value.item.id !== undefined ? { id: text(value.item.id, reject) } : {}),
    ...(value.item.added_date !== undefined
      ? { added_date: nullableText(value.item.added_date, reject) }
      : {}),
    ...(value.item.so_sheet !== undefined
      ? { so_sheet: value.item.so_sheet }
      : {}),
    source_row: value.item.source_row,
    sales_customer: nullableText(value.item.sales_customer, reject),
    material_type: nullableText(value.item.material_type, reject),
    code: nullableText(value.item.code, reject),
    no: nullableText(value.item.no, reject),
    description: text(value.item.description, reject),
    unit: nullableText(value.item.unit, reject),
  };
  if (cleanItem.id !== undefined && cleanItem.id !== cleanItem.id.trim())
    return reject();

  const summary = blankCustomerMaterialsSummary();
  onlyFields(
    record(value.summary, reject),
    CUSTOMER_MATERIALS_SUMMARY_FIELDS,
    reject,
  );
  for (const field of CUSTOMER_MATERIALS_SUMMARY_FIELDS) {
    summary[field] = text(value.summary[field], reject);
  }

  if (value.daily.length > 31) return reject();
  const daily: CustomerMaterialsDailyEntry[] = value.daily.map((entry) => {
    onlyFields(record(entry, reject), ["day", "values"], reject);
    onlyFields(
      record(entry.values, reject),
      CUSTOMER_MATERIALS_DAILY_FIELDS,
      reject,
    );
    const values = blankCustomerMaterialsDaily();
    for (const field of CUSTOMER_MATERIALS_DAILY_FIELDS) {
      values[field] = text(entry.values[field], reject);
    }
    return { day: entry.day, values };
  });
  daily.sort((left, right) => left.day - right.day);

  return {
    sheet_name: sheetName,
    item: cleanItem,
    summary,
    remark: text(value.remark, reject),
    daily,
  };
}

function parseSave(value: unknown) {
  const body = record(value);
  onlyFields(body, [
    "action",
    "sheet_name",
    "expected_revision",
    "changes",
    "deleted_refs",
    "confirm_hard_delete",
  ]);
  if (body.action !== "save_sheet") return invalid();
  const sheetName = readSheetName(body.sheet_name);
  const expectedRevision = text(body.expected_revision);
  if (!/^[a-f0-9]{64}$/.test(expectedRevision)) return invalid();
  if (!Array.isArray(body.changes) || body.changes.length > maxChangedRows)
    return invalid();
  const changes = (body.changes as unknown[]).map((row) =>
    readRow(row, sheetName),
  );
  const seen = new Set<string>();
  for (const row of changes) {
    const key = customerMaterialsRowKey(row);
    if (seen.has(key)) return invalid();
    seen.add(key);
  }

  const rawDeleted: unknown = Object.hasOwn(body, "deleted_refs")
    ? body.deleted_refs
    : [];
  if (
    !Array.isArray(rawDeleted) ||
    changes.length + rawDeleted.length > maxChangedRows
  ) {
    return invalid();
  }
  if (
    (Object.hasOwn(body, "confirm_hard_delete") &&
      typeof body.confirm_hard_delete !== "boolean") ||
    (rawDeleted.length > 0 && body.confirm_hard_delete !== true)
  ) {
    return invalid();
  }
  const deletedRefs: string[] = [];
  const prefix = `customer-materials:${sheetName}:`;
  for (const value of rawDeleted as unknown[]) {
    const ref = text(value);
    if (!ref.startsWith(prefix) || seen.has(ref)) return invalid();
    seen.add(ref);
    deletedRefs.push(ref);
  }
  return { sheetName, expectedRevision, changes, deletedRefs };
}

function assertValidChange(
  row: CustomerMaterialsRow,
  previous?: CustomerMaterialsRow,
): void {
  if (!previous && (row.item.source_row !== 0 || !row.item.id))
    return invalid();
  if (
    previous &&
    (row.item.id !== previous.item.id ||
      row.item.source_row !== previous.item.source_row)
  ) {
    return invalid();
  }
  const errors = validateCustomerMaterialsRow(
    row,
    previous ? "EDIT" : "CREATE",
    previous,
  );
  // A historical blank description must not prevent independent count/daily
  // edits. Creating or changing a description still requires a nonblank value.
  if (previous && row.item.description === previous.item.description) {
    delete errors.description;
  }
  if (Object.keys(errors).length > 0) return invalid();

  const allowedDays = new Set(customerMaterialsDaysInPeriod(row.sheet_name));
  const oldDays = new Map(previous?.daily.map((entry) => [entry.day, entry]));
  const nextDays = new Map(row.daily.map((entry) => [entry.day, entry]));

  // Retain any original out-of-calendar source slots, even when updating a
  // different field. New or changed slots must pass the existing domain rules.
  for (const [day, entry] of oldDays) {
    if (
      !allowedDays.has(day) &&
      JSON.stringify(nextDays.get(day)) !== JSON.stringify(entry)
    ) {
      return invalid();
    }
  }
  for (const entry of row.daily) {
    if (JSON.stringify(oldDays.get(entry.day)) === JSON.stringify(entry))
      continue;
    if (
      Object.keys(validateCustomerMaterialsDailyEntry(row.sheet_name, entry))
        .length > 0
    ) {
      return invalid();
    }
    if (
      CUSTOMER_MATERIALS_DAILY_FIELDS.every(
        (field) => !entry.values[field].trim(),
      )
    ) {
      // The domain represents a cleared day by removing that entry.
      return invalid();
    }
  }
}

type StoredRow = {
  documentId: string;
  lineId: string;
  row: CustomerMaterialsRow;
  updatedAt: string;
};

function sourceDataFor(row: CustomerMaterialsRow) {
  return { item: row.item, summary: row.summary, daily: row.daily };
}

function readStoredRow(
  raw: Record<string, unknown>,
  sheetName: CustomerMaterialsSheetName,
): StoredRow {
  if (
    raw.source_sheet_name !== sheetName ||
    raw.owner_kind !== "UNKNOWN" ||
    raw.item_id !== null ||
    raw.owner_customer_id !== null ||
    raw.customer_id !== null
  )
    return invalidStored();
  const source = record(raw.source_data, invalidStored);
  const row = readRow(
    {
      sheet_name: sheetName,
      item: source.item,
      summary: source.summary,
      daily: source.daily,
      remark: raw.remark,
    },
    sheetName,
    invalidStored,
  );
  const updatedAt = text(raw.updated_at, invalidStored);
  if (!Number.isFinite(Date.parse(updatedAt))) return invalidStored();
  return {
    documentId: databaseId(raw.document_id),
    lineId: databaseId(raw.line_id),
    row,
    updatedAt,
  };
}

async function readPeriod(
  db: StockWriteQueries,
  sheetName: CustomerMaterialsSheetName,
  lock: boolean,
): Promise<StoredRow[]> {
  const rows = await db.query(
    `SELECT
       d.id::text AS document_id,
       l.id::text AS line_id,
       d.customer_id::text AS customer_id,
       l.item_id::text AS item_id,
       l.owner_customer_id::text AS owner_customer_id,
       l.owner_kind,
       l.source_sheet_name,
       l.source_data,
       COALESCE(l.note, '') AS remark,
       to_char(l.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
     FROM foliar_fertilizer.m_stock_documents d
     JOIN foliar_fertilizer.r_stock_document_lines l ON l.document_id = d.id
     WHERE d.document_type = 'SNAPSHOT'
       AND d.source_group_code = $1
       AND d.document_date IS NOT DISTINCT FROM $2::date
       AND d.status = 'CONFIRMED'
     ORDER BY l.id${lock ? " FOR UPDATE OF d, l" : ""}`,
    [groupCode(sheetName), periodDate(sheetName)],
  );
  const records = rows.map((row) => readStoredRow(row, sheetName));
  const documentIds = new Set<string>();
  const lineIds = new Set<string>();
  const rowKeys = new Set<string>();
  for (const entry of records) {
    const key = customerMaterialsRowKey(entry.row);
    if (
      documentIds.has(entry.documentId) ||
      lineIds.has(entry.lineId) ||
      rowKeys.has(key)
    ) {
      return invalidStored();
    }
    documentIds.add(entry.documentId);
    lineIds.add(entry.lineId);
    rowKeys.add(key);
  }
  return records;
}

function periodResponse(
  sheetName: CustomerMaterialsSheetName,
  records: StoredRow[],
) {
  const sheet: CustomerMaterialsSheet = {
    name: sheetName,
    report_caption: "วัสดุคงเหลือลูกค้า",
    // No Excel caption is invented or automatically imported.
    period_caption: "",
    rows: records.map((entry) => entry.row),
  };
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        groupCode(sheetName),
        periodDate(sheetName),
        records.map((entry) => [
          entry.documentId,
          entry.lineId,
          entry.updatedAt,
          entry.row,
        ]),
      ]),
    )
    .digest("hex");
  return { sheet, revision };
}

async function insertMaterial(
  db: StockWriteQueries,
  sheetName: CustomerMaterialsSheetName,
  row: CustomerMaterialsRow,
) {
  // A free-text sales/customer cell and SO group cannot establish ownership.
  // Both master IDs remain NULL; no fake item_type or customer is created.
  const documentId = returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_documents (
       document_type, document_date, source_group_code, status
     ) VALUES ('SNAPSHOT', $1::date, $2, 'CONFIRMED')
     RETURNING id::text AS id`,
      [periodDate(sheetName), groupCode(sheetName)],
    ),
  );
  returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.r_stock_document_lines (
       document_id, line_no, item_id, owner_kind, owner_customer_id,
       source_sheet_name, source_data, note
     ) VALUES ($1::bigint, 1, NULL, 'UNKNOWN', NULL, $2, $3::json, $4)
     RETURNING id::text AS id`,
      [documentId, sheetName, JSON.stringify(sourceDataFor(row)), row.remark],
    ),
  );
}

async function updateMaterial(
  db: StockWriteQueries,
  sheetName: CustomerMaterialsSheetName,
  entry: StoredRow,
  row: CustomerMaterialsRow,
): Promise<void> {
  const id = returnedId(
    await db.query(
      `UPDATE foliar_fertilizer.r_stock_document_lines AS l
     SET source_data = $3::json, note = $4, updated_at = clock_timestamp()
     FROM foliar_fertilizer.m_stock_documents d
     WHERE l.id = $1::bigint AND l.document_id = $2::bigint AND d.id = l.document_id
       AND d.document_type = 'SNAPSHOT' AND d.status = 'CONFIRMED'
       AND d.source_group_code = $5 AND d.document_date IS NOT DISTINCT FROM $6::date
       AND d.customer_id IS NULL AND l.item_id IS NULL
       AND l.owner_kind = 'UNKNOWN' AND l.owner_customer_id IS NULL
       AND l.source_sheet_name = $7
     RETURNING l.id::text AS id`,
      [
        entry.lineId,
        entry.documentId,
        JSON.stringify(sourceDataFor(row)),
        row.remark,
        groupCode(sheetName),
        periodDate(sheetName),
        sheetName,
      ],
    ),
  );
  if (id !== entry.lineId) return invalidStored();
}

class MaterialDeleteConflict extends Error {
  constructor() {
    super("STOCK_CUSTOMER_MATERIALS_DELETE_CONFLICT");
    this.name = "MaterialDeleteConflict";
  }
}

// readPeriod(..., true) locks the snapshot header and line before this call.
// Keep deletion scoped to the selected sheet and its independent snapshot.
async function deleteMaterial(
  db: StockWriteQueries,
  sheetName: CustomerMaterialsSheetName,
  entry: StoredRow,
): Promise<void> {
  const deletedLines = await db.query(
    `DELETE FROM foliar_fertilizer.r_stock_document_lines AS l
     USING foliar_fertilizer.m_stock_documents AS d
     WHERE l.id = $1::bigint AND l.document_id = $2::bigint
       AND d.id = l.document_id
       AND d.document_type = 'SNAPSHOT' AND d.status = 'CONFIRMED'
       AND d.source_group_code = $3
       AND d.document_date IS NOT DISTINCT FROM $4::date
       AND d.customer_id IS NULL AND l.item_id IS NULL
       AND l.owner_kind = 'UNKNOWN' AND l.owner_customer_id IS NULL
       AND l.source_sheet_name = $5
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS other
         WHERE other.document_id = d.id AND other.id <> l.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS dependent
         WHERE dependent.source_line_id = l.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.m_stock_documents AS dependent
         WHERE dependent.reference_document_id = d.id
       )
     RETURNING l.id::text AS id`,
    [
      entry.lineId,
      entry.documentId,
      groupCode(sheetName),
      periodDate(sheetName),
      sheetName,
    ],
  );
  if (deletedLines.length !== 1 || deletedLines[0]?.id !== entry.lineId) {
    throw new MaterialDeleteConflict();
  }

  const deletedDocuments = await db.query(
    `DELETE FROM foliar_fertilizer.m_stock_documents AS d
     WHERE d.id = $1::bigint AND d.document_type = 'SNAPSHOT'
       AND d.status = 'CONFIRMED' AND d.customer_id IS NULL
       AND d.source_group_code = $2
       AND d.document_date IS NOT DISTINCT FROM $3::date
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS l
         WHERE l.document_id = d.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.m_stock_documents AS dependent
         WHERE dependent.reference_document_id = d.id
       )
     RETURNING d.id::text AS id`,
    [entry.documentId, groupCode(sheetName), periodDate(sheetName)],
  );
  if (
    deletedDocuments.length !== 1 ||
    deletedDocuments[0]?.id !== entry.documentId
  ) {
    // Throw to roll back the line deletion and every other draft write.
    throw new MaterialDeleteConflict();
  }
}

async function authorize(): Promise<void> {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  requireFactoryModule(user, moduleKey);
}

function errorResponse(error: unknown, writing: boolean) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof MaterialDeleteConflict) {
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_CUSTOMER_MATERIALS_DELETE_CONFLICT",
        message:
          "ไม่สามารถลบวัสดุถาวรได้ กรุณาตรวจสอบข้อมูลอ้างอิงและโหลดข้อมูลใหม่",
      },
      { status: 409, headers },
    );
  }
  if (error instanceof BackendError) {
    const uncertain = writing && error.code === "DB_TRANSACTION_FAILED";
    return NextResponse.json(
      {
        ok: false,
        code: uncertain
          ? "STOCK_CUSTOMER_MATERIALS_WRITE_UNCERTAIN"
          : "STOCK_CUSTOMER_MATERIALS_UNAVAILABLE",
        message: uncertain
          ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ"
          : "ไม่สามารถเชื่อมต่อข้อมูลวัสดุคงเหลือลูกค้าได้ในขณะนี้",
      },
      { status: 503, headers },
    );
  }
  const code = writing
    ? "STOCK_CUSTOMER_MATERIALS_SAVE_FAILED"
    : "STOCK_CUSTOMER_MATERIALS_READ_FAILED";
  console.error(code);
  return NextResponse.json(
    {
      ok: false,
      code,
      message: writing
        ? "เกิดข้อผิดพลาดในการบันทึกวัสดุคงเหลือลูกค้า"
        : "เกิดข้อผิดพลาดในการอ่านวัสดุคงเหลือลูกค้า",
    },
    { status: 500, headers },
  );
}

export async function GET(request: NextRequest) {
  try {
    await authorize();
    const params = request.nextUrl.searchParams;
    if (params.size !== 1) return invalid();
    const sheetName = readSheetName(params.get("sheet_name"));
    const result = await withStockWriteTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      return periodResponse(sheetName, await readPeriod(db, sheetName, false));
    });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return errorResponse(error, false);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBodyBytes);
    assertCsrf(request);
    await authorize();
    const { sheetName, expectedRevision, changes, deletedRefs } = parseSave(
      await readBody(request),
    );

    const result = await withStockWriteTransaction(async (db) => {
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      // Serialize even the first write to a previously empty sheet.
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext($1::text), $2::integer)",
        [moduleKey, CUSTOMER_MATERIALS_SHEET_NAMES.indexOf(sheetName)],
      );
      const records = await readPeriod(db, sheetName, true);
      const current = periodResponse(sheetName, records);
      if (current.revision !== expectedRevision)
        return { kind: "stale" } as const;

      const byKey = new Map(
        records.map((entry) => [customerMaterialsRowKey(entry.row), entry]),
      );
      const inserts: CustomerMaterialsRow[] = [];
      const updates: { entry: StoredRow; row: CustomerMaterialsRow }[] = [];
      const deletions: StoredRow[] = [];
      for (const ref of deletedRefs) {
        const existing = byKey.get(ref);
        if (!existing) return invalid();
        deletions.push(existing);
      }
      // Validate the complete batch before writing. Omitted rows are not deleted.
      for (const row of changes) {
        const existing = byKey.get(customerMaterialsRowKey(row));
        if (!existing) {
          assertValidChange(row);
          inserts.push(row);
        } else if (JSON.stringify(existing.row) !== JSON.stringify(row)) {
          assertValidChange(row, existing.row);
          updates.push({ entry: existing, row });
        }
      }

      for (const { entry, row } of updates)
        await updateMaterial(db, sheetName, entry, row);
      for (const row of inserts) await insertMaterial(db, sheetName, row);
      for (const entry of deletions) await deleteMaterial(db, sheetName, entry);
      const saved =
        inserts.length || updates.length || deletions.length
          ? periodResponse(sheetName, await readPeriod(db, sheetName, false))
          : current;
      return {
        kind: "saved",
        ...saved,
        inserted: inserts.length,
        updated: updates.length,
        deleted: deletions.length,
      } as const;
    });

    if (result.kind === "stale") {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_CUSTOMER_MATERIALS_CHANGED",
          message:
            "ข้อมูลของงวดนี้มีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง",
        },
        { status: 409, headers },
      );
    }
    return NextResponse.json(
      {
        ok: true,
        sheet: result.sheet,
        revision: result.revision,
        inserted: result.inserted,
        updated: result.updated,
        deleted: result.deleted,
      },
      { headers },
    );
  } catch (error) {
    return errorResponse(error, true);
  }
}
