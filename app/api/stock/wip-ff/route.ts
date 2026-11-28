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
  STOCK_WIP_MONTHS,
  STOCK_WIP_MOVEMENT_FIELDS,
  STOCK_WIP_SUMMARY_FIELDS,
  blankStockWipMovement,
  blankStockWipSheet,
  blankStockWipSummary,
  isStockWipDateInMonth,
  isValidStockWipQuantity,
  stockWipSourceSheetName,
  stockWipSupportsBioTransfer,
  validateStockWipSheet,
  type StockWipDailyEntry,
  type StockWipMovementValues,
  type StockWipPeriod,
  type StockWipRow,
  type StockWipSheet,
} from "@/src/features/stock_wip_ff/stock_wip_ff_domain";
import {
  withStockWriteTransaction,
  type StockWriteQueries,
} from "../_lib/stock-write-database.ts";

const moduleKey = "stock_wip_ff";
const headers = { "Cache-Control": "no-store" };
const maxBodyBytes = 4 * 1024 * 1024;
const maxChangedRows = 2000;

// GET: { ok, sheet, revision } for one MONTH or YEAR snapshot.
// POST: { action: "save_sheet", period, expected_revision, changes, deleted_refs?, confirm_hard_delete? }.
// A ref is the exact Code New in that period, never a cross-period master lookup.
// Only MONTH allows new rows. YEAR preserves existing annual snapshots independently.
// Nonempty deleted_refs require confirm_hard_delete: true. Omitted rows are not deleted.
// Numeric text is kept as entered. No inventory or price formulas are applied.

function invalid(): never {
  throw new FactoryAuthError("INVALID_REQUEST", 400);
}

function invalidStored(): never {
  throw new Error("STOCK_WIP_FF_SNAPSHOT_INVALID");
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

function parsePeriod(
  view: unknown,
  year: unknown,
  month?: unknown,
): StockWipPeriod {
  if (
    view === "YEAR" &&
    (year === 2568 || year === 2569) &&
    month === undefined
  ) {
    return { view: "YEAR", year_be: year };
  }
  if (view === "MONTH" && year === 2569) {
    const allowed = STOCK_WIP_MONTHS.find((value) => value === month);
    if (allowed !== undefined)
      return { view: "MONTH", year_be: 2569, month: allowed };
  }
  return invalid();
}

function readQueryPeriod(params: URLSearchParams): StockWipPeriod {
  const view = params.get("view");
  const year = params.get("year_be");
  const month = params.get("month");
  if (year === null || !/^\d{4}$/.test(year)) return invalid();
  if (view === "YEAR" && params.size === 2 && month === null) {
    return parsePeriod(view, Number(year));
  }
  if (
    view === "MONTH" &&
    params.size === 3 &&
    month !== null &&
    /^\d{1,2}$/.test(month)
  ) {
    return parsePeriod(view, Number(year), Number(month));
  }
  return invalid();
}

function readBodyPeriod(value: unknown): StockWipPeriod {
  const source = record(value);
  if (source.view === "YEAR") {
    onlyFields(source, ["view", "year_be"]);
    return parsePeriod(source.view, source.year_be);
  }
  onlyFields(source, ["view", "year_be", "month"]);
  return parsePeriod(source.view, source.year_be, source.month);
}

function groupCode(period: StockWipPeriod): string {
  return period.view === "YEAR" ? "stock_wip_ff_year" : "stock_wip_ff_month";
}

function periodDate(period: StockWipPeriod): string {
  const month = period.view === "YEAR" ? 1 : period.month;
  return `${period.year_be - 543}-${String(month).padStart(2, "0")}-01`;
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
  if (!isValidStockWipQuantity(raw)) return reject();
  return raw;
}

function readMovement(
  value: unknown,
  period: StockWipPeriod,
  reject: Reject,
): StockWipMovementValues {
  const source = record(value, reject);
  onlyFields(source, STOCK_WIP_MOVEMENT_FIELDS, reject);
  const supportsBio = stockWipSupportsBioTransfer(period);
  const movement = blankStockWipMovement(supportsBio);
  for (const field of STOCK_WIP_MOVEMENT_FIELDS) {
    if (field === "transfer_bio" && !supportsBio) {
      if (source[field] !== null) return reject();
    } else {
      movement[field] = numericText(source[field], reject);
    }
  }
  return movement;
}

function readCode(value: unknown, reject: Reject = invalid): string {
  const code = text(value, reject);
  if (!code.trim()) return reject();
  return code;
}

function readRow(
  value: unknown,
  period: StockWipPeriod,
  reject: Reject = invalid,
): StockWipRow {
  const row = record(value, reject);
  onlyFields(row, ["item", "summary", "daily"], reject);
  const item = record(row.item, reject);
  onlyFields(item, ["no", "code_new", "code_old", "name"], reject);
  const no = item.no;
  if (typeof no !== "number" || !Number.isSafeInteger(no) || no < 1)
    return reject();
  const codeNew = readCode(item.code_new, reject);
  const codeOld = nullableText(item.code_old, reject);
  const name = text(item.name, reject);
  if (!name.trim() || (codeOld !== null && !codeOld.trim())) return reject();

  const source = record(row.summary, reject);
  onlyFields(source, STOCK_WIP_SUMMARY_FIELDS, reject);
  const supportsBio = stockWipSupportsBioTransfer(period);
  const summary = blankStockWipSummary(supportsBio);
  for (const field of STOCK_WIP_SUMMARY_FIELDS) {
    if (field === "transfer_bio" && !supportsBio) {
      if (source[field] !== null) return reject();
    } else {
      summary[field] = numericText(source[field], reject);
    }
  }

  if (
    !Array.isArray(row.daily) ||
    row.daily.length > 31 ||
    (period.view === "YEAR" && row.daily.length !== 0)
  )
    return reject();
  const daily: StockWipDailyEntry[] = [];
  const dates = new Set<string>();
  for (const raw of row.daily as unknown[]) {
    const entry = record(raw, reject);
    onlyFields(entry, ["date", "values"], reject);
    const date = text(entry.date, reject);
    if (!isStockWipDateInMonth(date, period) || dates.has(date))
      return reject();
    dates.add(date);
    daily.push({ date, values: readMovement(entry.values, period, reject) });
  }
  daily.sort((left, right) => left.date.localeCompare(right.date));

  return {
    item: { no, code_new: codeNew, code_old: codeOld, name },
    summary,
    daily,
  };
}

function assertValidSheet(sheet: StockWipSheet, reject: Reject): void {
  if (Object.keys(validateStockWipSheet(sheet)).length > 0) reject();
  // Creation in the existing domain rejects duplicates after trimming.
  // Preserve original codes but reject ambiguous codes in a single period.
  const codes = new Set<string>();
  for (const row of sheet.rows) {
    const code = row.item.code_new.trim();
    if (codes.has(code)) reject();
    codes.add(code);
  }
}

function parseSave(value: unknown) {
  const body = record(value);
  onlyFields(body, [
    "action",
    "period",
    "expected_revision",
    "changes",
    "deleted_refs",
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
  assertValidSheet({ ...blankStockWipSheet(period), rows: changes }, invalid);

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
  const seen = new Set(changes.map((row) => row.item.code_new.trim()));
  for (const value of rawDeleted as unknown[]) {
    const ref = readCode(value);
    if (seen.has(ref.trim())) return invalid();
    seen.add(ref.trim());
    deletedRefs.push(ref);
  }
  return { period, expectedRevision, changes, deletedRefs };
}

type StoredRow = {
  itemId: string;
  documentId: string;
  lineId: string;
  row: StockWipRow;
  sourceData: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function readStoredRow(
  raw: Record<string, unknown>,
  period: StockWipPeriod,
): StoredRow {
  const sourceData = record(raw.source_data, invalidStored);
  if (raw.source_sheet_name !== stockWipSourceSheetName(period))
    return invalidStored();
  // Preserve the source name independently of master edits.
  const row = readRow(
    {
      item: {
        no: sourceData.no,
        code_new: raw.code_new,
        code_old: raw.code_old,
        name: sourceData.item_name,
      },
      summary: sourceData.summary,
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

async function readPeriod(
  db: StockWriteQueries,
  period: StockWipPeriod,
  lock: boolean,
): Promise<StoredRow[]> {
  const rows = await db.query(
    `SELECT
       i.id::text AS item_id,
       d.id::text AS document_id,
       l.id::text AS line_id,
       i.item_code AS code_new,
       i.legacy_code AS code_old,
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
       AND i.item_type = 'WIP'
       AND i.is_active = true
       AND l.owner_kind = 'COMPANY'
     ORDER BY l.id${lock ? " FOR UPDATE OF d, l, i" : ""}`,
    [groupCode(period), periodDate(period)],
  );
  const records = rows.map((row) => readStoredRow(row, period));
  const itemIds = new Set<string>();
  const documentIds = new Set<string>();
  const lineIds = new Set<string>();
  for (const entry of records) {
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
  // Stable within each period. Equal No. values retain the database line order.
  return records.sort((left, right) => left.row.item.no - right.row.item.no);
}

function periodResponse(period: StockWipPeriod, records: StoredRow[]) {
  const sheet: StockWipSheet = {
    ...blankStockWipSheet(period),
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
  const revision = createHash("sha256")
    .update(
      JSON.stringify([
        groupCode(period),
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

function sourceDataFor(row: StockWipRow) {
  return {
    no: row.item.no,
    item_name: row.item.name,
    summary: row.summary,
    daily: row.daily,
  };
}

async function insertWip(
  db: StockWriteQueries,
  period: StockWipPeriod,
  row: StockWipRow,
) {
  // Deliberately create a new master for this period. No matching by code
  // across months/years. The workbook provides no verified stock unit.
  const itemId = returnedId(
    await db.query(
      ` INSERT INTO foliar_fertilizer.m_stock_items (
       item_type, item_code, legacy_code, name, stock_unit
     ) VALUES ('WIP', $1, $2, $3, $4)
     RETURNING id::text AS id`,
      [row.item.code_new, row.item.code_old, row.item.name, ""],
    ),
  );
  const documentId = returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_documents (
       document_type, document_date, source_group_code, status
     ) VALUES ('SNAPSHOT', $1::date, $2, 'CONFIRMED')
     RETURNING id::text AS id`,
      [periodDate(period), groupCode(period)],
    ),
  );
  returnedId(
    await db.query(
      `INSERT INTO foliar_fertilizer.r_stock_document_lines (
       document_id, line_no, item_id, owner_kind, source_sheet_name, source_data
     ) VALUES ($1::bigint, 1, $2::bigint, 'COMPANY', $3, $4::json)
     RETURNING id::text AS id`,
      [
        documentId,
        itemId,
        stockWipSourceSheetName(period),
        JSON.stringify(sourceDataFor(row)),
      ],
    ),
  );
}

async function updateWip(
  db: StockWriteQueries,
  entry: StoredRow,
  row: StockWipRow,
) {
  // Never change a master, code, or row number through a snapshot edit.
  const id = returnedId(
    await db.query(
      `UPDATE foliar_fertilizer.r_stock_document_lines
     SET source_data = $2::json, updated_at = clock_timestamp()
     WHERE id = $1::bigint AND document_id = $3::bigint AND item_id = $4::bigint
       AND owner_kind = 'COMPANY'
     RETURNING id::text AS id`,
      [
        entry.lineId,
        JSON.stringify({ ...entry.sourceData, ...sourceDataFor(row) }),
        entry.documentId,
        entry.itemId,
      ],
    ),
  );
  if (id !== entry.lineId) return invalidStored();
}

class WipDeleteConflict extends Error {
  constructor() {
    super("STOCK_WIP_FF_DELETE_CONFLICT");
    this.name = "WipDeleteConflict";
  }
}

function assertWipDeletedId(
  rows: Record<string, unknown>[],
  expectedId: string,
): void {
  if (rows.length !== 1 || rows[0]?.id !== expectedId) {
    // Throw inside the transaction to roll back every change in this draft.
    throw new WipDeleteConflict();
  }
}

async function deleteWip(
  db: StockWriteQueries,
  period: StockWipPeriod,
  entry: StoredRow,
): Promise<void> {
  // readPeriod(..., true) has locked the document, line and item master.
  // A master belongs to one period only. Never follow a code across periods,
  // delete a shared document/master, or cascade into referenced records.
  const lines = await db.query(
    `DELETE FROM foliar_fertilizer.r_stock_document_lines AS l
     USING foliar_fertilizer.m_stock_documents AS d,
           foliar_fertilizer.m_stock_items AS i
     WHERE l.id = $1::bigint
       AND l.document_id = $2::bigint AND d.id = l.document_id
       AND l.item_id = $3::bigint AND i.id = l.item_id
       AND d.document_type = 'SNAPSHOT'
       AND d.source_group_code = $4
       AND d.document_date = $5::date
       AND d.status = 'CONFIRMED'
       AND i.item_type = 'WIP' AND i.is_active = true
       AND l.owner_kind = 'COMPANY'
       AND l.source_sheet_name = $6
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS other
         WHERE other.id <> l.id
           AND (other.document_id = d.id OR other.item_id = i.id)
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS child
         WHERE child.source_line_id = l.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.m_stock_documents AS child
         WHERE child.reference_document_id = d.id
       )
     RETURNING l.id::text AS id`,
    [
      entry.lineId,
      entry.documentId,
      entry.itemId,
      groupCode(period),
      periodDate(period),
      stockWipSourceSheetName(period),
    ],
  );
  assertWipDeletedId(lines, entry.lineId);

  const documents = await db.query(
    `DELETE FROM foliar_fertilizer.m_stock_documents AS d
     WHERE d.id = $1::bigint
       AND d.document_type = 'SNAPSHOT'
       AND d.source_group_code = $2
       AND d.document_date = $3::date
       AND d.status = 'CONFIRMED'
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS l
         WHERE l.document_id = d.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.m_stock_documents AS child
         WHERE child.reference_document_id = d.id
       )
     RETURNING d.id::text AS id`,
    [entry.documentId, groupCode(period), periodDate(period)],
  );
  assertWipDeletedId(documents, entry.documentId);

  const items = await db.query(
    `DELETE FROM foliar_fertilizer.m_stock_items AS i
     WHERE i.id = $1::bigint
       AND i.item_type = 'WIP' AND i.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM foliar_fertilizer.r_stock_document_lines AS l
         WHERE l.item_id = i.id
       )
     RETURNING i.id::text AS id`,
    [entry.itemId],
  );
  assertWipDeletedId(items, entry.itemId);
}

async function authorize() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  requireFactoryModule(user, moduleKey);
}

function errorResponse(error: unknown, writing: boolean) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof WipDeleteConflict) {
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_WIP_FF_DELETE_CONFLICT",
        message:
          "ไม่สามารถลบสินค้า WIP แบบถาวรได้ อาจมีรายการอื่นเชื่อมโยงอยู่ กรุณาตรวจสอบและโหลดข้อมูลใหม่",
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
          ? "STOCK_WIP_FF_WRITE_UNCERTAIN"
          : "STOCK_WIP_FF_UNAVAILABLE",
        message: uncertain
          ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาโหลดข้อมูลใหม่และตรวจสอบก่อนบันทึกซ้ำ"
          : writing
            ? "ไม่สามารถบันทึกสต็อกสินค้า WIPได้ในขณะนี้"
            : "ไม่สามารถอ่านข้อมูลสต็อกสินค้า WIPได้ในขณะนี้",
      },
      { status: 503, headers },
    );
  }
  const code = writing
    ? "STOCK_WIP_FF_SAVE_FAILED"
    : "STOCK_WIP_FF_READ_FAILED";
  console.error(code);
  return NextResponse.json(
    {
      ok: false,
      code,
      message: writing
        ? "เกิดข้อผิดพลาดในการบันทึกสต็อกสินค้า WIP"
        : "เกิดข้อผิดพลาดในการอ่านสต็อกสินค้า WIP",
    },
    { status: 500, headers },
  );
}

/* ---------------- GET: read a monthly or annual snapshot ---------------- */

export async function GET(request: NextRequest) {
  try {
    await authorize();
    const period = readQueryPeriod(request.nextUrl.searchParams);
    const result = await withStockWriteTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      return periodResponse(period, await readPeriod(db, period, false));
    });
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    return errorResponse(error, false);
  }
}

/* ---------------- POST: save additions, edits and hard deletions atomically ---------------- */

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBodyBytes);
    assertCsrf(request);
    await authorize();
    const { period, changes, deletedRefs, expectedRevision } = parseSave(
      await readBody(request),
    );

    const result = await withStockWriteTransaction(async (db) => {
      // The next SELECT must see the latest committed rows even when this
      // request waits behind another writer's advisory lock.
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtext($1::text), $2::integer)",
        [
          groupCode(period),
          period.year_be * 100 + (period.view === "MONTH" ? period.month : 0),
        ],
      );
      const records = await readPeriod(db, period, true);
      const current = periodResponse(period, records);
      if (current.revision !== expectedRevision)
        return { kind: "stale" } as const;

      const byCode = new Map(
        records.map((entry) => [entry.row.item.code_new, entry]),
      );
      const existingTrimmedCodes = new Set(
        records.map((entry) => entry.row.item.code_new.trim()),
      );
      const inserts: StockWipRow[] = [];
      const updates: { entry: StoredRow; row: StockWipRow }[] = [];
      const deletions: StoredRow[] = [];

      for (const ref of deletedRefs) {
        const existing = byCode.get(ref);
        if (!existing) return invalid();
        deletions.push(existing);
      }

      // Validate the entire batch before writes. A missing row never implies
      // deletion, and annual snapshots cannot receive newly created rows.
      for (const row of changes) {
        const existing = byCode.get(row.item.code_new);
        if (!existing) {
          if (
            period.view !== "MONTH" ||
            row.item.code_new !== row.item.code_new.trim() ||
            existingTrimmedCodes.has(row.item.code_new) ||
            row.item.name !== row.item.name.trim() ||
            (row.item.code_old !== null &&
              row.item.code_old !== row.item.code_old.trim())
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

      for (const entry of updates) await updateWip(db, entry.entry, entry.row);
      for (const row of inserts) await insertWip(db, period, row);
      for (const entry of deletions) await deleteWip(db, period, entry);

      const saved =
        inserts.length || updates.length || deletions.length
          ? periodResponse(period, await readPeriod(db, period, false))
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
          code: "STOCK_WIP_FF_CHANGED",
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
