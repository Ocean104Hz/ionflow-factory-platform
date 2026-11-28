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
  STOCK_MATERIAL_FF_DAILY_FIELDS,
  STOCK_MATERIAL_FF_MONTHS_2569,
  STOCK_MATERIAL_FF_SUMMARY_FIELDS,
  blankStockMaterialDaily,
  blankStockMaterialSheet,
  blankStockMaterialSummary,
  isStockMaterialDateInPeriod,
  isValidStockMaterialNumber,
  stockMaterialRowRef,
  stockMaterialSourceSheetName,
  validateStockMaterialSheet,
  type StockMaterialDailyEntry,
  type StockMaterialPeriod,
  type StockMaterialRow,
  type StockMaterialRowRef,
  type StockMaterialSheet,
} from "@/src/features/stock_remaining_materials_ff/stock_remaining_materials_ff_domain";
import {
  withStockWriteTransaction,
  type StockWriteQueries,
} from "../_lib/stock-write-database.ts";

// Keep this report isolated from FG, RM, WIP and other packaging reports.
const moduleKey = "stock_remaining_materials_ff";
const headers = { "Cache-Control": "no-store" };
const maxBodyBytes = 4 * 1024 * 1024;
const maxChangedRows = 2000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// GET returns { ok, sheet, revision }.
// POST accepts { action: "save_sheet", period, expected_revision, changes,
//                 delete_refs?, confirm_hard_delete? }.
// Changes contain complete StockMaterialRow values for added/edited rows only.
// Only explicit, confirmed delete_refs remove saved rows permanently.
// Omitting a row never deletes it. No totals or prices are recalculated.

function invalid(): never {
  throw new FactoryAuthError("INVALID_REQUEST", 400);
}

function invalidStored(): never {
  throw new Error("STOCK_MATERIAL_FF_SNAPSHOT_INVALID");
}

type Reject = () => never;

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
  if (typeof value !== "string" || value.includes("\0")) return reject();
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

function parsePeriod(year: unknown, month: unknown): StockMaterialPeriod {
  if (year === 2568 && month === 12) {
    return { view: "MONTH", year_be: 2568, month: 12 };
  }
  if (year === 2569) {
    const allowed = STOCK_MATERIAL_FF_MONTHS_2569.find(
      (value) => value === month,
    );
    if (allowed !== undefined)
      return { view: "MONTH", year_be: 2569, month: allowed };
  }
  return invalid();
}

function readQueryPeriod(params: URLSearchParams): StockMaterialPeriod {
  const year = params.get("year_be");
  const month = params.get("month");
  if (
    params.size !== 2 ||
    year === null ||
    month === null ||
    !/^\d{4}$/.test(year) ||
    !/^\d{1,2}$/.test(month)
  )
    return invalid();
  return parsePeriod(Number(year), Number(month));
}

function readBodyPeriod(value: unknown): StockMaterialPeriod {
  const source = record(value);
  onlyFields(source, ["view", "year_be", "month"]);
  if (source.view !== "MONTH") return invalid();
  return parsePeriod(source.year_be, source.month);
}

function periodDate(period: StockMaterialPeriod): string {
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

function numericText(value: unknown, reject: Reject): string {
  const raw = text(value, reject);
  if (!isValidStockMaterialNumber(raw)) return reject();
  return raw;
}

function readRow(
  value: unknown,
  period: StockMaterialPeriod,
  reject: Reject = invalid,
): StockMaterialRow {
  const row = record(value, reject);
  onlyFields(
    row,
    ["item", "summary", "remark", "safety_stock", "daily"],
    reject,
  );
  const item = record(row.item, reject);
  onlyFields(
    item,
    ["source_row", "client_id", "no", "category", "code", "name", "unit"],
    reject,
  );
  const { source_row, client_id, no } = item;

  if (
    typeof source_row !== "number" ||
    !Number.isSafeInteger(source_row) ||
    (no !== null &&
      (typeof no !== "number" || !Number.isSafeInteger(no) || no < 1))
  )
    return reject();

  if (client_id === undefined) {
    if (source_row < 6) return reject();
  } else if (
    typeof client_id !== "string" ||
    !uuidPattern.test(client_id) ||
    source_row !== 0 ||
    no !== null
  )
    return reject();

  const name = text(item.name, reject);
  if (!name.trim()) return reject();

  const source = record(row.summary, reject);
  onlyFields(source, STOCK_MATERIAL_FF_SUMMARY_FIELDS, reject);
  const summary = blankStockMaterialSummary();
  for (const field of STOCK_MATERIAL_FF_SUMMARY_FIELDS) {
    summary[field] = numericText(source[field], reject);
  }

  if (!Array.isArray(row.daily) || row.daily.length > 31) return reject();
  const daily: StockMaterialDailyEntry[] = [];
  const dates = new Set<string>();
  for (const raw of row.daily as unknown[]) {
    const entry = record(raw, reject);
    onlyFields(entry, ["date", "values"], reject);
    const date = text(entry.date, reject);
    if (!isStockMaterialDateInPeriod(date, period) || dates.has(date))
      return reject();
    dates.add(date);
    const rawValues = record(entry.values, reject);
    onlyFields(rawValues, STOCK_MATERIAL_FF_DAILY_FIELDS, reject);
    const values = blankStockMaterialDaily();
    for (const field of STOCK_MATERIAL_FF_DAILY_FIELDS) {
      values[field] = numericText(rawValues[field], reject);
    }
    daily.push({ date, values });
  }
  daily.sort((left, right) => left.date.localeCompare(right.date));

  return {
    item: {
      source_row,
      ...(client_id === undefined ? {} : { client_id }),
      no,
      category: nullableText(item.category, reject),
      code: nullableText(item.code, reject),
      name,
      unit: nullableText(item.unit, reject),
    },
    summary,
    remark: text(row.remark, reject),
    safety_stock: text(row.safety_stock, reject),
    daily,
  };
}

function assertValidSheet(sheet: StockMaterialSheet, reject: Reject): void {
  if (Object.keys(validateStockMaterialSheet(sheet)).length > 0) reject();
}

function readDeleteRefs(value: unknown): StockMaterialRowRef[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxChangedRows) return invalid();

  const refs: StockMaterialRowRef[] = [];
  const seen = new Set<StockMaterialRowRef>();

  for (const ref of value as unknown[]) {
    if (
      !(
        (typeof ref === "number" && Number.isSafeInteger(ref) && ref >= 6) ||
        (typeof ref === "string" && uuidPattern.test(ref))
      )
    )
      return invalid();
    if (seen.has(ref)) return invalid();
    seen.add(ref);
    refs.push(ref);
  }

  return refs;
}

function parseSave(value: unknown) {
  const body = record(value);
  onlyFields(body, [
    "action",
    "period",
    "expected_revision",
    "changes",
    "delete_refs",
    "confirm_hard_delete",
  ]);
  if (body.action !== "save_sheet") return invalid();
  const period = readBodyPeriod(body.period);
  const expectedRevision = text(body.expected_revision);
  if (!/^[a-f0-9]{64}$/.test(expectedRevision)) return invalid();
  if (!Array.isArray(body.changes) || body.changes.length > maxChangedRows)
    return invalid();

  const changes = (body.changes as unknown[]).map((row) =>
    readRow(row, period),
  );
  const sheet = { ...blankStockMaterialSheet(period), rows: changes };
  assertValidSheet(sheet, invalid);

  const deleteRefs = readDeleteRefs(body.delete_refs);
  if (
    changes.length + deleteRefs.length > maxChangedRows ||
    (body.confirm_hard_delete !== undefined &&
      body.confirm_hard_delete !== true) ||
    (deleteRefs.length > 0 && body.confirm_hard_delete !== true)
  )
    return invalid();

  const deleting = new Set(deleteRefs);
  if (changes.some((row) => deleting.has(stockMaterialRowRef(row))))
    return invalid();

  return { period, expectedRevision, changes, deleteRefs };
}

type StoredRow = {
  itemId: string;
  documentId: string;
  lineId: string;
  row: StockMaterialRow;
  sourceData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function readStoredRow(
  raw: Record<string, unknown>,
  period: StockMaterialPeriod,
): StoredRow {
  const sourceData = record(raw.source_data, invalidStored);
  if (raw.source_sheet_name !== stockMaterialSourceSheetName(period))
    return invalidStored();
  const row = readRow(
    {
      item: {
        source_row: sourceData.source_row,
        ...(sourceData.client_id === undefined
          ? {}
          : { client_id: sourceData.client_id }),
        no: sourceData.no,
        category: raw.category,
        code: raw.code,
        name: raw.name,
        unit: raw.unit,
      },
      summary: sourceData.summary,
      remark: raw.remark,
      safety_stock: sourceData.safety_stock,
      daily: sourceData.daily,
    },
    period,
    invalidStored,
  );
  const createdAt = text(raw.created_at, invalidStored);
  const updatedAt = text(raw.updated_at, invalidStored);
  if (
    !Number.isFinite(Date.parse(createdAt)) ||
    !Number.isFinite(Date.parse(updatedAt))
  ) {
    return invalidStored();
  }
  return {
    itemId: databaseId(raw.item_id),
    documentId: databaseId(raw.document_id),
    lineId: databaseId(raw.line_id),
    row,
    sourceData,
    createdAt,
    updatedAt,
  };
}

async function readMonth(
  db: StockWriteQueries,
  period: StockMaterialPeriod,
  lock: boolean,
): Promise<StoredRow[]> {
  const rows = await db.query(
    `SELECT
       i.id::text AS item_id,
       d.id::text AS document_id,
       l.id::text AS line_id,
       i.item_group AS category,
       i.item_code AS code,
       i.name,
       NULLIF(i.stock_unit, '') AS unit,
       COALESCE(l.note, '') AS remark,
       l.source_sheet_name,
       l.source_data,
       to_char(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
       to_char(l.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
     FROM foliar_fertilizer.m_stock_documents d
     JOIN foliar_fertilizer.r_stock_document_lines l ON l.document_id = d.id
     JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
     WHERE d.document_type = 'SNAPSHOT'
       AND d.source_group_code = $1
       AND d.document_date = $2::date
       AND d.status = 'CONFIRMED'
       AND i.item_type = 'PACKAGING'
       AND i.is_active = true
       AND l.owner_kind = 'COMPANY'
     ORDER BY l.id${lock ? " FOR UPDATE OF d, l, i" : ""}`,
    [moduleKey, periodDate(period)],
  );
  const records = rows.map((row) => readStoredRow(row, period));
  const itemIds = new Set<string>();
  const documentIds = new Set<string>();
  const lineIds = new Set<string>();
  for (const entry of records) {
    // Each material snapshot belongs to one document in this report/month.
    if (
      itemIds.has(entry.itemId) ||
      documentIds.has(entry.documentId) ||
      lineIds.has(entry.lineId)
    ) {
      return invalidStored();
    }
    itemIds.add(entry.itemId);
    documentIds.add(entry.documentId);
    lineIds.add(entry.lineId);
  }
  return records;
}

function monthResponse(period: StockMaterialPeriod, records: StoredRow[]) {
  const sheet: StockMaterialSheet = {
    ...blankStockMaterialSheet(period),
    rows: records.map((entry) => entry.row),
    created_at: records.reduce(
      (earliest, entry) =>
        !earliest || entry.createdAt < earliest ? entry.createdAt : earliest,
      "",
    ),
    updated_at: records.reduce(
      (latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest),
      "",
    ),
  };
  assertValidSheet(sheet, invalidStored);

  // Stable order, exact text and database IDs detect a stale monthly draft.
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        moduleKey,
        period,
        records.map((entry) => [
          entry.itemId,
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

function sourceDataFor(row: StockMaterialRow) {
  return {
    source_row: row.item.source_row,
    ...(row.item.client_id === undefined
      ? {}
      : { client_id: row.item.client_id }),
    no: row.item.no,
    summary: row.summary,
    safety_stock: row.safety_stock,
    daily: row.daily,
  };
}

async function insertMaterial(
  db: StockWriteQueries,
  period: StockMaterialPeriod,
  row: StockMaterialRow,
) {
  const itemId = returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_items (
       item_type, item_code, item_group, name, stock_unit
     ) VALUES ('PACKAGING', $1, $2, $3, $4)
     RETURNING id::text AS id`,
      [row.item.code, row.item.category, row.item.name, row.item.unit ?? ""],
    ),
  );
  const documentId = returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_documents (
       document_type, document_date, source_group_code, status
     ) VALUES ('SNAPSHOT', $1::date, $2, 'CONFIRMED')
     RETURNING id::text AS id`,
      [periodDate(period), moduleKey],
    ),
  );
  returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.r_stock_document_lines (
       document_id, line_no, item_id, owner_kind, source_sheet_name, source_data, note
     ) VALUES ($1::bigint, 1, $2::bigint, 'COMPANY', $3, $4::json, $5)
     RETURNING id::text AS id`,
      [
        documentId,
        itemId,
        stockMaterialSourceSheetName(period),
        JSON.stringify(sourceDataFor(row)),
        row.remark,
      ],
    ),
  );
}

async function updateMaterial(
  db: StockWriteQueries,
  entry: StoredRow,
  row: StockMaterialRow,
) {
  // Master fields are not editable in the existing monthly workspace.
  // Preserve source metadata and write only the monthly snapshot fields.
  returnedId(
    await db.query(
      `UPDATE foliar_fertilizer.r_stock_document_lines
     SET source_data = $2::json, note = $3, updated_at = clock_timestamp()
     WHERE id = $1::bigint
     RETURNING id::text AS id`,
      [
        entry.lineId,
        JSON.stringify({ ...entry.sourceData, ...sourceDataFor(row) }),
        row.remark,
      ],
    ),
  );
}

/* ---------------- Hard delete: explicit monthly material rows ---------------- */

function materialDeleteTargets(entries: readonly StoredRow[]): string {
  // StockWriteQueries accepts scalar SQL parameters. Encode verified server IDs
  // as JSON, rather than interpolating a list into SQL or accepting client IDs.
  return JSON.stringify(
    entries.map((entry) => ({
      item_id: entry.itemId,
      document_id: entry.documentId,
      line_id: entry.lineId,
    })),
  );
}

async function hasMaterialDeleteReferences(
  db: StockWriteQueries,
  targets: string,
): Promise<boolean> {
  const rows = await db.query(
    `WITH targets AS (
       SELECT * FROM jsonb_to_recordset($1::jsonb)
       AS t(item_id bigint, document_id bigint, line_id bigint)
     )
     SELECT EXISTS (
       SELECT 1
       FROM targets t
       JOIN foliar_fertilizer.r_stock_document_lines l
         ON (l.item_id = t.item_id OR l.document_id = t.document_id)
        AND l.id <> t.line_id
       UNION ALL
       SELECT 1
       FROM targets t
       JOIN foliar_fertilizer.m_stock_documents d
         ON d.reference_document_id = t.document_id
       UNION ALL
       SELECT 1
       FROM targets t
       JOIN foliar_fertilizer.r_stock_document_lines l
         ON l.source_line_id = t.line_id
     ) AS blocked`,
    [targets],
  );
  const blocked = rows[0]?.blocked;
  if (rows.length !== 1 || typeof blocked !== "boolean") return invalidStored();
  return blocked;
}

function assertMaterialDeletedIds(
  rows: Record<string, unknown>[],
  expected: readonly string[],
): void {
  const actual = new Set(rows.map((row) => databaseId(row.id)));
  if (
    rows.length !== expected.length ||
    actual.size !== expected.length ||
    expected.some((id) => !actual.has(id))
  )
    return invalidStored();
}

async function deleteMaterials(
  db: StockWriteQueries,
  period: StockMaterialPeriod,
  entries: readonly StoredRow[],
  targets: string,
): Promise<void> {
  // readMonth(..., true) already locks these rows, documents and item masters.
  // Each target is exactly one verified PACKAGING snapshot in this report/month.
  // Any unexpected foreign key, SQL error or affected-ID mismatch must throw so
  // the transaction rolls back every deletion, insertion and update in the save.
  const deletedLines = await db.query(
    `DELETE FROM foliar_fertilizer.r_stock_document_lines l
     USING jsonb_to_recordset($1::jsonb)
       AS t(item_id bigint, document_id bigint, line_id bigint)
     WHERE l.id = t.line_id
       AND l.document_id = t.document_id
       AND l.item_id = t.item_id
       AND l.owner_kind = 'COMPANY'
     RETURNING l.id::text AS id`,
    [targets],
  );
  assertMaterialDeletedIds(
    deletedLines,
    entries.map((entry) => entry.lineId),
  );

  const deletedDocuments = await db.query(
    `DELETE FROM foliar_fertilizer.m_stock_documents d
     USING jsonb_to_recordset($1::jsonb)
       AS t(item_id bigint, document_id bigint, line_id bigint)
     WHERE d.id = t.document_id
       AND d.document_type = 'SNAPSHOT'
       AND d.source_group_code = $2
       AND d.document_date = $3::date
       AND d.status = 'CONFIRMED'
     RETURNING d.id::text AS id`,
    [targets, moduleKey, periodDate(period)],
  );
  assertMaterialDeletedIds(
    deletedDocuments,
    entries.map((entry) => entry.documentId),
  );

  const deletedItems = await db.query(
    `DELETE FROM foliar_fertilizer.m_stock_items i
     USING jsonb_to_recordset($1::jsonb)
       AS t(item_id bigint, document_id bigint, line_id bigint)
     WHERE i.id = t.item_id
       AND i.item_type = 'PACKAGING'
       AND i.is_active = true
     RETURNING i.id::text AS id`,
    [targets],
  );
  assertMaterialDeletedIds(
    deletedItems,
    entries.map((entry) => entry.itemId),
  );
}

async function authorize() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  requireFactoryModule(user, moduleKey);
}

function errorResponse(error: unknown, writing: boolean) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof BackendError) {
    const uncertain = writing && error.code === "DB_TRANSACTION_FAILED";
    return NextResponse.json(
      {
        ok: false,
        code: uncertain
          ? "STOCK_MATERIAL_FF_WRITE_UNCERTAIN"
          : "STOCK_MATERIAL_FF_UNAVAILABLE",
        message: uncertain
          ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ"
          : writing
            ? "ไม่สามารถบันทึกวัสดุคงเหลือได้ในขณะนี้"
            : "ไม่สามารถอ่านข้อมูลวัสดุคงเหลือได้ในขณะนี้",
      },
      { status: 503, headers },
    );
  }
  const code = writing
    ? "STOCK_MATERIAL_FF_SAVE_FAILED"
    : "STOCK_MATERIAL_FF_READ_FAILED";
  console.error(code);
  return NextResponse.json(
    {
      ok: false,
      code,
      message: writing
        ? "เกิดข้อผิดพลาดในการบันทึกวัสดุคงเหลือ"
        : "เกิดข้อผิดพลาดในการอ่านวัสดุคงเหลือ",
    },
    { status: 500, headers },
  );
}

/* ---------------- GET: read a monthly snapshot ---------------- */

export async function GET(request: NextRequest) {
  try {
    await authorize();
    const period = readQueryPeriod(request.nextUrl.searchParams);
    const result = await withStockWriteTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      return monthResponse(period, await readMonth(db, period, false));
    });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return errorResponse(error, false);
  }
}

/* ---------------- POST: save changes and hard deletions atomically ---------------- */

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBodyBytes);
    assertCsrf(request);
    await authorize();
    const input = parseSave(await readBody(request));
    const { period, changes, expectedRevision, deleteRefs } = input;

    const result = await withStockWriteTransaction(async (db) => {
      // A concurrent save may finish while waiting for this month's lock.
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      // Serialize saves for the same report/month, including an empty month.
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext($1::text), $2::integer)",
        [moduleKey, period.year_be * 100 + period.month],
      );
      const records = await readMonth(db, period, true);
      const current = monthResponse(period, records);
      if (current.revision !== expectedRevision)
        return { kind: "stale" } as const;

      const byRef = new Map<StockMaterialRowRef, StoredRow>(
        records.map((entry) => [stockMaterialRowRef(entry.row), entry]),
      );
      const inserts: StockMaterialRow[] = [];
      const updates: { entry: StoredRow; row: StockMaterialRow }[] = [];
      const deletions: StoredRow[] = [];

      // Resolve row references only against locked rows of this report/month.
      for (const ref of deleteRefs) {
        const entry = byRef.get(ref);
        if (!entry) return { kind: "delete_not_found" } as const;
        deletions.push(entry);
      }

      // Validate the entire batch before issuing any DELETE, INSERT or UPDATE.
      for (const row of changes) {
        const existing = byRef.get(stockMaterialRowRef(row));
        if (!existing) {
          // A UI-created row has a UUID and no Excel row. Never create a
          // purported Excel row or match by a possibly duplicated code/name.
          if (row.item.client_id === undefined || row.item.source_row !== 0)
            return invalid();
          if (
            row.item.name !== row.item.name.trim() ||
            [row.item.code, row.item.category, row.item.unit].some(
              (value) =>
                value !== null && (!value.trim() || value !== value.trim()),
            )
          )
            return invalid();
          inserts.push(row);
          continue;
        }
        if (JSON.stringify(existing.row.item) !== JSON.stringify(row.item))
          return invalid();
        if (JSON.stringify(existing.row) !== JSON.stringify(row))
          updates.push({ entry: existing, row });
      }

      if (deletions.length > 0) {
        const targets = materialDeleteTargets(deletions);
        if (await hasMaterialDeleteReferences(db, targets)) {
          return { kind: "delete_referenced" } as const;
        }
        await deleteMaterials(db, period, deletions, targets);
      }

      for (const entry of updates)
        await updateMaterial(db, entry.entry, entry.row);
      for (const row of inserts) await insertMaterial(db, period, row);

      const saved =
        inserts.length || updates.length || deletions.length
          ? monthResponse(period, await readMonth(db, period, false))
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
          code: "STOCK_MATERIAL_FF_CHANGED",
          message:
            "ข้อมูลของเดือนนี้มีการเปลี่ยนแปลง กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง",
        },
        { status: 409, headers },
      );
    }
    if (
      result.kind === "delete_not_found" ||
      result.kind === "delete_referenced"
    ) {
      return NextResponse.json(
        {
          ok: false,
          code:
            result.kind === "delete_not_found"
              ? "STOCK_MATERIAL_FF_DELETE_NOT_FOUND"
              : "STOCK_MATERIAL_FF_DELETE_REFERENCED",
          message:
            result.kind === "delete_not_found"
              ? "ไม่พบวัสดุที่ต้องการลบในเดือนรายงานนี้ กรุณาโหลดข้อมูลล่าสุด"
              : "วัสดุหรือเอกสารนี้มีข้อมูลอื่นอ้างอิงอยู่ ไม่สามารถลบถาวรได้",
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
