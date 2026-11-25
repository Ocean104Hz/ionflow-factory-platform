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
  blankStockProductsDaily,
  blankStockProductsSoRow,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  stockProductsRowKey,
  type StockProductsSoRow,
  type StockProductsSoSheet,
  type StockProductsSoSheetName,
  blankStockProductsSummary,
  STOCK_PRODUCTS_DAILY_FIELDS,
  type StockProductsDailyEntry,
  type StockProductsDailyValues,
  isValidStockProductsAddedDate,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  type StockProductsStockRow,
  type StockProductsSummaryValues,
} from "@/src/features/stock_products/stock_products_domain";

import {
  withStockWriteTransaction,
  type StockWriteQueries,
} from "../_lib/stock-write-database.ts";

const headers = { "Cache-Control": "no-store" };
const maxBodyBytes = 12_000;

function invalid(): never {
  throw new FactoryAuthError("INVALID_REQUEST", 400);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid();
  }
  return value as Record<string, unknown>;
}

function onlyFields(value: Record<string, unknown>, fields: readonly string[]) {
  if (Object.keys(value).some((key) => !fields.includes(key))) invalid();
}

function text(value: unknown): string {
  if (typeof value !== "string" || value.includes("\0")) return invalid();
  return value;
}

function optionalText(value: unknown): string | null {
  return value == null ? null : text(value).trim() || null;
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

function parseBodyPeriod(value: unknown): string {
  const period = record(value);

  onlyFields(period, ["year_be", "month"]);

  const { year_be: yearBe, month } = period;

  if (
    typeof yearBe !== "number" ||
    !Number.isInteger(yearBe) ||
    yearBe < 544 ||
    yearBe > 10542 ||
    typeof month !== "number" ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return invalid();
  }

  return (
    `${String(yearBe - 543).padStart(4, "0")}-` +
    `${String(month).padStart(2, "0")}-01`
  );
}

function parseProduct(
  body: unknown,
  action: "create_product" | "update_product" = "create_product",
) {
  const input = record(body);

  const fields = ["action", "period", "item", "summary", "remark"];

  if (action === "update_product") {
    fields.push("item_id", "expected");
  }

  onlyFields(input, fields);

  if (input.action !== action) return invalid();

  const item = record(input.item);
  const itemFields = ["added_date", "code", "name", "group", "unit"];

  onlyFields(item, itemFields);

  if (
    action === "update_product" &&
    itemFields.some((key) => !Object.hasOwn(item, key))
  ) {
    return invalid();
  }

  const name = text(item.name).trim();

  const addedDate =
    action === "create_product"
      ? text(item.added_date).trim()
      : optionalText(item.added_date);

  if (
    !name ||
    (action === "create_product" && !addedDate) ||
    (addedDate !== null &&
      (addedDate.startsWith("0000-") ||
        !isValidStockProductsAddedDate(addedDate)))
  ) {
    return invalid();
  }

  const periodDate = parseBodyPeriod(input.period);

  const source = record(input.summary);

  onlyFields(source, STOCK_PRODUCTS_SUMMARY_FIELDS);

  const summary: StockProductsSummaryValues = {
    balance_quantity: text(source.balance_quantity),
    received_in: text(source.received_in),
    received_return: text(source.received_return),
    issued_customer: text(source.issued_customer),
    issued_promotion: text(source.issued_promotion),
    issued_office_sample: text(source.issued_office_sample),
    issued_other: text(source.issued_other),
    damaged: text(source.damaged),
    remaining_quantity: text(source.remaining_quantity),
    physical_count: text(source.physical_count),
    count_difference: text(source.count_difference),
  };

  return {
    periodDate,
    item: {
      code: optionalText(item.code),
      name,
      group: optionalText(item.group),
      unit: optionalText(item.unit),
      added_date: addedDate,
    },
    summary,
    remark: text(input.remark),
  };
}

function singleId(rows: Record<string, unknown>[]): string {
  const id = rows[0]?.id;
  if (rows.length !== 1 || typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    throw new Error("STOCK_PRODUCT_INSERT_FAILED");
  }
  return id;
}

export async function POST(request: NextRequest) {
  let savingDaily = false;
  let creatingSo = false;

  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);

    const body = record(await readBody(request));

    if (body.action === "save_daily") {
      savingDaily = true;
      return await saveDaily(body);
    }

    if (body.action === "create_so") {
      creatingSo = true;
      return await createSo(body);
    }

    const input = parseProduct(body);

    const row = await withStockWriteTransaction(async (db) => {
      const itemId = singleId(
        await db.query(
          `INSERT INTO foliar_fertilizer.m_items (
           item_code, name, item_group, added_date, stock_unit, item_type
         ) VALUES ($1, $2, $3, $4::date, $5, 'FG')
         RETURNING id::text AS id`,
          [
            input.item.code,
            input.item.name,
            input.item.group,
            input.item.added_date,
            input.item.unit ?? "",
          ],
        ),
      );

      const documentId = singleId(
        await db.query(
          `INSERT INTO foliar_fertilizer.m_stock_documents (
           document_type, document_date, status
         ) VALUES ('SNAPSHOT', $1::date, 'CONFIRMED')
         RETURNING id::text AS id`,
          [input.periodDate],
        ),
      );

      singleId(
        await db.query(
          `INSERT INTO foliar_fertilizer.r_stock_document_lines (
           document_id, line_no, item_id, owner_kind, source_data, note
         ) VALUES ($1::bigint, 1, $2::bigint, 'COMPANY', $3::json, $4)
         RETURNING id::text AS id`,
          [
            documentId,
            itemId,
            JSON.stringify({ ...input.summary, daily: [] }),
            input.remark,
          ],
        ),
      );

      const result: StockProductsStockRow = {
        item: { ...input.item, id: itemId, source_row: 0, no: null },
        summary: input.summary,
        remark: input.remark,
        daily: [],
      };
      return result;
    });

    return NextResponse.json({ ok: true, row }, { status: 201, headers });
  } catch (error) {
    if (error instanceof FactoryAuthError) return authErrorResponse(error);
    if (error instanceof BackendError) {
      const uncertain = error.code === "DB_TRANSACTION_FAILED";
      return NextResponse.json(
        {
          ok: false,
          code: uncertain ? "STOCK_WRITE_UNCERTAIN" : "STOCK_WRITE_UNAVAILABLE",
          message: uncertain
            ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจสอบข้อมูลก่อนบันทึกใหม่"
            : savingDaily
              ? "ไม่สามารถบันทึกรับ-จ่ายได้ในขณะนี้"
              : creatingSo
                ? "ไม่สามารถบันทึกรายการ SO ได้ในขณะนี้"
                : "ไม่สามารถบันทึกสินค้าได้ในขณะนี้",
        },
        { status: 503, headers },
      );
    }
    const code = savingDaily
      ? "STOCK_PRODUCT_DAILY_SAVE_FAILED"
      : creatingSo
        ? "STOCK_PRODUCT_SO_CREATE_FAILED"
        : "STOCK_PRODUCT_CREATE_FAILED";
    console.error(code);
    return NextResponse.json(
      {
        ok: false,
        code,
        message: savingDaily
          ? "เกิดข้อผิดพลาดในการบันทึกรับ-จ่าย กรุณาตรวจสอบก่อนบันทึกใหม่"
          : creatingSo
            ? "เกิดข้อผิดพลาดในการบันทึก SO กรุณาตรวจสอบก่อนบันทึกใหม่"
            : "เกิดข้อผิดพลาดในการบันทึกสินค้า กรุณาตรวจสอบก่อนบันทึกใหม่",
      },
      { status: 500, headers },
    );
  }
}

/* ---------------- GET: list product snapshots ---------------- */

function readReportPeriod(params: URLSearchParams) {
  const year = params.get("year_be");
  const monthValue = params.get("month");

  if (
    params.size !== 2 ||
    year === null ||
    monthValue === null ||
    !/^\d{1,5}$/.test(year) ||
    !/^\d{1,2}$/.test(monthValue)
  ) {
    return invalid();
  }

  const yearBe = Number(year);
  const month = Number(monthValue);

  if (yearBe < 544 || yearBe > 10542 || month < 1 || month > 12) {
    return invalid();
  }

  return {
    period: { year_be: yearBe, month },
    periodDate:
      `${String(yearBe - 543).padStart(4, "0")}-` +
      `${String(month).padStart(2, "0")}-01`,
  };
}

function readSnapshotRow(
  row: Record<string, unknown>,
  periodDate: string,
): StockProductsStockRow {
  const { id, added_date, code, name, group, unit, remark, source_data } = row;

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id) ||
    (added_date !== null &&
      (typeof added_date !== "string" ||
        !isValidStockProductsAddedDate(added_date))) ||
    (code !== null && typeof code !== "string") ||
    typeof name !== "string" ||
    !name.trim() ||
    (group !== null && typeof group !== "string") ||
    (unit !== null && typeof unit !== "string") ||
    typeof remark !== "string" ||
    typeof source_data !== "object" ||
    source_data === null ||
    Array.isArray(source_data)
  ) {
    throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
  }

  const values = source_data as Record<string, unknown>;
  const summary = blankStockProductsSummary();

  for (const field of STOCK_PRODUCTS_SUMMARY_FIELDS) {
    const value = values[field];

    if (typeof value !== "string") {
      throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
    }

    summary[field] = value;
  }

  return {
    item: {
      id,
      added_date,
      code,
      name,
      group,
      unit,
      source_row: 0,
      no: null,
    },
    summary,
    remark,
    daily: readStoredDaily(values.daily, periodDate),
  };
}

/* ---------------- GET ---------------- */

export async function GET(request: NextRequest) {
  try {
    const user = await readCurrentFactoryUser();

    if (!user) {
      throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    }

    requireFactoryModule(user, "stock_products");

    const { period, periodDate } = readReportPeriod(
      request.nextUrl.searchParams,
    );

    const { rows, so_sheets } = await withStockWriteTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );

      const records = await db.query(
        `SELECT
           i.id::text AS id,
           to_char(i.added_date, 'YYYY-MM-DD') AS added_date,
           i.item_code AS code,
           i.name,
           i.item_group AS "group",
           NULLIF(i.stock_unit, '') AS unit,
           COALESCE(l.note, '') AS remark,
           l.source_data

         FROM foliar_fertilizer.m_items i

         JOIN foliar_fertilizer.r_stock_document_lines l
           ON l.item_id = i.id

         JOIN foliar_fertilizer.m_stock_documents d
           ON d.id = l.document_id

         WHERE i.item_type = 'FG'
           AND i.is_active = true
           AND l.owner_kind = 'COMPANY'
           AND d.document_type = 'SNAPSHOT'
           AND d.status = 'CONFIRMED'
           AND d.document_date = $1::date

         ORDER BY i.id, l.id`,
        [periodDate],
      );

      const seen = new Set<string>();

      const rows = records.map((record) => {
        const row = readSnapshotRow(record, periodDate);
        const id = row.item.id;

        if (!id || seen.has(id)) {
          throw new Error("STOCK_PRODUCT_SNAPSHOT_DUPLICATE");
        }

        seen.add(id);

        return row;
      });

      const so_sheets = await readSoSheets(db);

      return { rows, so_sheets };
    });

    return NextResponse.json(
      { ok: true, period, rows, so_sheets },
      { headers },
    );
  } catch (error) {
    if (error instanceof FactoryAuthError) {
      return authErrorResponse(error);
    }

    if (error instanceof BackendError) {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_READ_UNAVAILABLE",
          message: "ไม่สามารถอ่านข้อมูลสต็อกได้ในขณะนี้",
        },
        { status: 503, headers },
      );
    }

    console.error("STOCK_PRODUCT_READ_FAILED");

    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_READ_FAILED",
        message: "เกิดข้อผิดพลาดในการอ่านข้อมูลสินค้า",
      },
      { status: 500, headers },
    );
  }
}

/* ---------------- PATCH helpers ---------------- */

function parseItemId(value: unknown): string {
  const id = text(value);

  if (
    !/^[1-9]\d{0,18}$/.test(id) ||
    (id.length === 19 && id > "9223372036854775807")
  ) {
    return invalid();
  }

  return id;
}

function productSignature(value: unknown, itemId: string): string {
  const row = record(value);
  const item = record(row.item);
  const summary = record(row.summary);

  if (item.id !== itemId) return invalid();

  const nullable = (field: unknown) => (field === null ? null : text(field));

  return JSON.stringify([
    nullable(item.code),
    text(item.name),
    nullable(item.group),
    nullable(item.unit),
    nullable(item.added_date),
    ...STOCK_PRODUCTS_SUMMARY_FIELDS.map((field) => text(summary[field])),
    text(row.remark),
  ]);
}

/* ---------------- PATCH: update product ---------------- */

async function lockProductSnapshot(
  db: StockWriteQueries,
  itemId: string,
  periodDate: string,
): Promise<Record<string, unknown>[]> {
  return db.query(
    `SELECT
       i.id::text AS id,
       l.id::text AS line_id,
       d.id::text AS document_id,
       to_char(i.added_date, 'YYYY-MM-DD') AS added_date,
       i.item_code AS code,
       i.name,
       i.item_group AS "group",
       NULLIF(i.stock_unit, '') AS unit,
       COALESCE(l.note, '') AS remark,
       l.source_data
     FROM foliar_fertilizer.m_items i
     JOIN foliar_fertilizer.r_stock_document_lines l
       ON l.item_id = i.id
     JOIN foliar_fertilizer.m_stock_documents d
       ON d.id = l.document_id
     WHERE i.id = $1::bigint
       AND i.item_type = 'FG'
       AND i.is_active = true
       AND l.owner_kind = 'COMPANY'
       AND d.document_type = 'SNAPSHOT'
       AND d.status = 'CONFIRMED'
       AND d.document_date = $2::date
     FOR UPDATE OF i, l, d`,
    [itemId, periodDate],
  );
}

export async function PATCH(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);

    const user = await readCurrentFactoryUser();

    if (!user) {
      throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    }

    const body = record(await readBody(request));

    const itemId = parseItemId(body.item_id);
    const input = parseProduct(body, "update_product");
    const expected = productSignature(body.expected, itemId);

    const result = await withStockWriteTransaction(async (db) => {
      /* 1. Find and lock existing product */

      const matches = await lockProductSnapshot(db, itemId, input.periodDate);

      if (matches.length === 0) {
        return { kind: "not_found" } as const;
      }

      if (matches.length !== 1) {
        return { kind: "duplicate" } as const;
      }

      const existing = matches[0];

      if (!existing) {
        throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
      }

      const current = readSnapshotRow(existing, input.periodDate);

      /* 2. Verify previous data */

      if (productSignature(current, itemId) !== expected) {
        return { kind: "stale" } as const;
      }

      const lineId = singleId([{ id: existing.line_id }]);

      /* 3. Update product master */

      singleId(
        await db.query(
          `UPDATE foliar_fertilizer.m_items
             SET item_code = $2,
                 name = $3,
                 item_group = $4,
                 added_date = $5::date,
                 stock_unit = $6,
                 updated_at = now()

             WHERE id = $1::bigint
               AND item_type = 'FG'
               AND is_active = true

             RETURNING id::text AS id`,
          [
            itemId,
            input.item.code,
            input.item.name,
            input.item.group,
            input.item.added_date,
            input.item.unit ?? "",
          ],
        ),
      );

      /* 4. Update monthly snapshot */

      singleId(
        await db.query(
          `UPDATE foliar_fertilizer.r_stock_document_lines
             SET source_data = $2::json,
                 note = $3,
                 updated_at = now()

             WHERE id = $1::bigint

             RETURNING id::text AS id`,
          [
            lineId,
            JSON.stringify({
              ...record(existing.source_data),
              ...input.summary,
              daily: current.daily,
            }),
            input.remark,
          ],
        ),
      );

      /* 5. Return updated product */

      const row: StockProductsStockRow = {
        item: {
          ...input.item,
          id: itemId,
          source_row: 0,
          no: null,
        },
        summary: input.summary,
        remark: input.remark,
        daily: current.daily,
      };

      return { kind: "updated", row } as const;
    });

    /* ---------------- response ---------------- */

    if (result.kind === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_PRODUCT_NOT_FOUND",
          message: "ไม่พบสินค้าในเดือนรายงานที่เลือก",
        },
        { status: 404, headers },
      );
    }

    if (result.kind === "duplicate" || result.kind === "stale") {
      return NextResponse.json(
        {
          ok: false,
          code:
            result.kind === "duplicate"
              ? "STOCK_PRODUCT_SNAPSHOT_DUPLICATE"
              : "STOCK_PRODUCT_CHANGED",
          message:
            result.kind === "duplicate"
              ? "พบยอดสรุปซ้ำ กรุณาตรวจสอบข้อมูลก่อนแก้ไข"
              : "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่ก่อนบันทึก",
        },
        { status: 409, headers },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        row: result.row,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof FactoryAuthError) {
      return authErrorResponse(error);
    }

    if (error instanceof BackendError) {
      const uncertain = error.code === "DB_TRANSACTION_FAILED";

      return NextResponse.json(
        {
          ok: false,
          code: uncertain ? "STOCK_WRITE_UNCERTAIN" : "STOCK_WRITE_UNAVAILABLE",
          message: uncertain
            ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจสอบข้อมูลก่อนบันทึกใหม่"
            : "ไม่สามารถแก้ไขสินค้าได้ในขณะนี้",
        },
        { status: 503, headers },
      );
    }

    console.error("STOCK_PRODUCT_UPDATE_FAILED");

    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_UPDATE_FAILED",
        message: "เกิดข้อผิดพลาดในการแก้ไขสินค้า",
      },
      { status: 500, headers },
    );
  }
}

/* ---------------- Daily snapshot values ---------------- */

function invalidStoredDaily(): never {
  throw new Error("STOCK_PRODUCT_DAILY_INVALID");
}

function dateInPeriod(date: string, periodDate: string): boolean {
  return (
    isValidStockProductsAddedDate(date) &&
    date.slice(0, 7) === periodDate.slice(0, 7)
  );
}

function readDailyValues(
  value: unknown,
  onInvalid: () => never,
): StockProductsDailyValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return onInvalid();
  }

  const source = value as Record<string, unknown>;
  if (Object.keys(source).length !== STOCK_PRODUCTS_DAILY_FIELDS.length) {
    return onInvalid();
  }

  const values = blankStockProductsDaily();

  for (const field of STOCK_PRODUCTS_DAILY_FIELDS) {
    const raw = source[field];

    if (
      typeof raw !== "string" ||
      raw.includes("\0") ||
      (raw.trim() !== "" && !Number.isFinite(Number(raw)))
    ) {
      return onInvalid();
    }

    values[field] = raw;
  }

  return values;
}

function readStoredDaily(
  value: unknown,
  periodDate: string,
  onInvalid: () => never = invalidStoredDaily,
): StockProductsDailyEntry[] {
  // Older snapshots contain only the eleven summary fields.
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 31) return onInvalid();

  const seen = new Set<string>();
  const entries: StockProductsDailyEntry[] = [];

  for (const raw of value as unknown[]) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return onInvalid();
    }

    const entry = raw as Record<string, unknown>;
    const date = entry.date;

    if (
      Object.keys(entry).length !== 2 ||
      typeof date !== "string" ||
      !dateInPeriod(date, periodDate) ||
      seen.has(date)
    ) {
      return onInvalid();
    }

    seen.add(date);
    entries.push({ date, values: readDailyValues(entry.values, onInvalid) });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------------- POST action: save_daily ---------------- */

async function saveDaily(body: Record<string, unknown>) {
  onlyFields(body, [
    "action",
    "item_id",
    "period",
    "date",
    "values",
    "expected",
  ]);

  const itemId = parseItemId(body.item_id);
  const periodDate = parseBodyPeriod(body.period);
  const date = text(body.date);

  if (!dateInPeriod(date, periodDate)) return invalid();

  const values = readDailyValues(body.values, invalid);
  const expected = readDailyValues(body.expected, invalid);

  const result = await withStockWriteTransaction(async (db) => {
    const matches = await lockProductSnapshot(db, itemId, periodDate);

    if (matches.length === 0) return { kind: "not_found" } as const;
    if (matches.length !== 1) return { kind: "duplicate" } as const;

    const existing = matches[0];
    if (!existing) throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");

    const current = readSnapshotRow(existing, periodDate);
    const previous =
      current.daily.find((entry) => entry.date === date)?.values ??
      blankStockProductsDaily();

    // Compare only the selected day; other days and summaries may change.
    if (
      STOCK_PRODUCTS_DAILY_FIELDS.some(
        (field) => previous[field] !== expected[field],
      )
    ) {
      return { kind: "stale" } as const;
    }

    const daily = current.daily.filter((entry) => entry.date !== date);

    // Same behavior as the UI: all blank removes the day; zero is a value.
    if (
      STOCK_PRODUCTS_DAILY_FIELDS.some((field) => values[field].trim() !== "")
    ) {
      daily.push({ date, values });
    }

    daily.sort((a, b) => a.date.localeCompare(b.date));

    const lineId = singleId([{ id: existing.line_id }]);
    const sourceData = { ...record(existing.source_data), daily };

    singleId(
      await db.query(
        `UPDATE foliar_fertilizer.r_stock_document_lines
       SET source_data = $2::json,
           updated_at = now()
       WHERE id = $1::bigint
       RETURNING id::text AS id`,
        [lineId, JSON.stringify(sourceData)],
      ),
    );

    const row: StockProductsStockRow = { ...current, daily };
    return { kind: "updated", row } as const;
  });

  if (result.kind === "not_found") {
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าในเดือนรายงานที่เลือก",
      },
      { status: 404, headers },
    );
  }

  if (result.kind === "duplicate" || result.kind === "stale") {
    return NextResponse.json(
      {
        ok: false,
        code:
          result.kind === "duplicate"
            ? "STOCK_PRODUCT_SNAPSHOT_DUPLICATE"
            : "STOCK_PRODUCT_DAILY_CHANGED",
        message:
          result.kind === "duplicate"
            ? "พบยอดสรุปซ้ำ กรุณาตรวจสอบข้อมูลก่อนบันทึก"
            : "ข้อมูลรับ-จ่ายของวันที่เลือกมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่ก่อนบันทึก",
      },
      { status: 409, headers },
    );
  }

  return NextResponse.json({ ok: true, row: result.row }, { headers });
}

/* ---------------- SO: raw order rows, not stock movements ---------------- */

function findSoSheetName(value: unknown): StockProductsSoSheetName | undefined {
  return STOCK_PRODUCTS_SO_SHEET_NAMES.find((name) => name === value);
}

function parseSo(body: Record<string, unknown>) {
  onlyFields(body, [
    "action",
    "item_id",
    "period",
    "sheet_name",
    "date_raw",
    "customer_name",
    "so_number",
    "quantity",
    "unit",
  ]);

  const itemId = parseItemId(body.item_id);
  const periodDate = parseBodyPeriod(body.period);
  const sheetName = findSoSheetName(body.sheet_name);
  const date = text(body.date_raw).trim();
  const customerName = text(body.customer_name).trim();
  const soNumber = text(body.so_number).trim();
  const quantity = text(body.quantity).trim();
  const unit = text(body.unit).trim();

  if (
    !sheetName ||
    date.startsWith("0000-") ||
    !isValidStockProductsAddedDate(date) ||
    !customerName ||
    !soNumber ||
    !quantity ||
    !Number.isFinite(Number(quantity))
  ) {
    return invalid();
  }

  // The UI accepts zero, signed values, and other finite numeric strings.
  // Keep the original trimmed string in source_data in every case.
  // Only a positive quantity is permitted in the SQL numeric column.
  const numericQuantity =
    Number(quantity) > 0
      ? /^[+]?([0-9]+(\.[0-9]*)?|\.[0-9]+)([eE][+-]?[0-9]+)?$/.test(quantity)
        ? quantity
        : BigInt(quantity).toString()
      : null;

  return {
    itemId,
    periodDate,
    sheetName,
    date,
    customerName,
    soNumber,
    quantity,
    numericQuantity,
    unit,
  };
}

function invalidStoredSo(): never {
  throw new Error("STOCK_PRODUCT_SO_INVALID");
}

function readSoRow(row: Record<string, unknown>): StockProductsSoRow {
  const { id, item_id, sheet_name, date_raw, so_number, unit, source_data } =
    row;
  const sheetName = findSoSheetName(sheet_name);

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id) ||
    typeof item_id !== "string" ||
    !/^[1-9]\d*$/.test(item_id) ||
    !sheetName ||
    typeof date_raw !== "string" ||
    date_raw.startsWith("0000-") ||
    !isValidStockProductsAddedDate(date_raw) ||
    typeof so_number !== "string" ||
    !so_number.trim() ||
    (unit !== null && typeof unit !== "string") ||
    typeof source_data !== "object" ||
    source_data === null ||
    Array.isArray(source_data)
  ) {
    return invalidStoredSo();
  }

  const { customer_name, product_name, quantity } = source_data as Record<
    string,
    unknown
  >;

  if (
    typeof customer_name !== "string" ||
    !customer_name.trim() ||
    typeof product_name !== "string" ||
    !product_name.trim() ||
    typeof quantity !== "string" ||
    !quantity.trim() ||
    !Number.isFinite(Number(quantity))
  ) {
    return invalidStoredSo();
  }

  return {
    ...blankStockProductsSoRow(id, sheetName),
    stock_row_key: `stock:local:${item_id}`,
    date_raw,
    so_number,
    customer_name,
    product_name,
    quantity,
    unit: unit ?? "",
  };
}

async function readSoSheets(
  db: StockWriteQueries,
): Promise<StockProductsSoSheet[]> {
  // The SO tab has a group/search filter, independent of the stock report month.
  const records = await db.query(
    `SELECT
       l.id::text AS id,
       l.item_id::text AS item_id,
       d.source_group_code AS sheet_name,
       to_char(d.document_date, 'YYYY-MM-DD') AS date_raw,
       d.document_no AS so_number,
       l.unit,
       l.source_data
     FROM foliar_fertilizer.m_stock_documents d
     JOIN foliar_fertilizer.r_stock_document_lines l
       ON l.document_id = d.id
     JOIN foliar_fertilizer.m_items i
       ON i.id = l.item_id
     WHERE d.document_type = 'SO'
       AND d.status = 'CONFIRMED'
       AND i.item_type = 'FG'
       AND l.owner_kind = 'COMPANY'
       AND d.source_group_code = ANY(string_to_array($1, ','))
     ORDER BY d.document_date NULLS LAST, d.id, l.line_no`,
    [STOCK_PRODUCTS_SO_SHEET_NAMES.join(",")],
  );

  const sheets: StockProductsSoSheet[] = STOCK_PRODUCTS_SO_SHEET_NAMES.map(
    (name) => ({ name, rows: [] }),
  );

  for (const record of records) {
    const row = readSoRow(record);
    const sheet = sheets.find((candidate) => candidate.name === row.sheet_name);
    if (!sheet) return invalidStoredSo();
    sheet.rows.push(row);
  }

  return sheets;
}

/* ---------------- POST action: create_so ---------------- */

async function createSo(body: Record<string, unknown>) {
  const input = parseSo(body);

  const result = await withStockWriteTransaction(async (db) => {
    // Validate the actual selected FG snapshot. Never match by name or SO number.
    const matches = await lockProductSnapshot(
      db,
      input.itemId,
      input.periodDate,
    );

    if (matches.length === 0) return { kind: "not_found" } as const;
    if (matches.length !== 1) return { kind: "duplicate" } as const;

    const existing = matches[0];
    if (!existing) throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
    const current = readSnapshotRow(existing, input.periodDate);

    const documentId = singleId(
      await db.query(
        `INSERT INTO foliar_fertilizer.m_stock_documents (
         document_type, document_no, document_date, source_group_code, status
       ) VALUES ('SO', $1, $2::date, $3, 'CONFIRMED')
       RETURNING id::text AS id`,
        [input.soNumber, input.date, input.sheetName],
      ),
    );

    const productName = current.item.name.trim();
    const sourceData = {
      customer_name: input.customerName,
      product_name: productName,
      quantity: input.quantity,
    };

    const lineId = singleId(
      await db.query(
        `INSERT INTO foliar_fertilizer.r_stock_document_lines (
         document_id, line_no, item_id, owner_kind, quantity, unit, source_data
       ) VALUES ($1::bigint, 1, $2::bigint, 'COMPANY', $3::numeric, $4, $5::json)
       RETURNING id::text AS id`,
        [
          documentId,
          input.itemId,
          input.numericQuantity,
          input.unit || null,
          JSON.stringify(sourceData),
        ],
      ),
    );

    // No item/snapshot UPDATE, inventory movements, or customer INSERT.
    const row: StockProductsSoRow = {
      ...blankStockProductsSoRow(lineId, input.sheetName),
      stock_row_key: stockProductsRowKey(current),
      date_raw: input.date,
      customer_name: input.customerName,
      so_number: input.soNumber,
      product_name: productName,
      quantity: input.quantity,
      unit: input.unit,
    };

    return { kind: "created", row } as const;
  });

  if (result.kind === "not_found") {
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_NOT_FOUND",
        message: "ไม่พบสินค้าในเดือนรายงานที่เลือก",
      },
      { status: 404, headers },
    );
  }

  if (result.kind === "duplicate") {
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_SNAPSHOT_DUPLICATE",
        message: "พบยอดสรุปซ้ำ กรุณาตรวจสอบข้อมูลก่อนเพิ่ม SO",
      },
      { status: 409, headers },
    );
  }

  return NextResponse.json(
    { ok: true, row: result.row },
    { status: 201, headers },
  );
}

/* ---------------- DELETE: cancel one monthly product snapshot ---------------- */

export async function DELETE(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);

    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    requireFactoryModule(user, "stock_products");

    const body = record(await readBody(request));
    onlyFields(body, ["action", "item_id", "period", "expected"]);
    if (body.action !== "delete_product") return invalid();

    const itemId = parseItemId(body.item_id);
    const periodDate = parseBodyPeriod(body.period);
    const expected = record(body.expected);
    const expectedProduct = productSignature(expected, itemId);
    if (!Array.isArray(expected.daily)) return invalid();
    const expectedDaily = readStoredDaily(expected.daily, periodDate, invalid);

    const result = await withStockWriteTransaction(async (db) => {
      const matches = await lockProductSnapshot(db, itemId, periodDate);
      if (matches.length === 0) return "not_found" as const;
      if (matches.length !== 1) return "duplicate" as const;

      const existing = matches[0];
      if (!existing) throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
      const current = readSnapshotRow(existing, periodDate);

      // Deletion hides the entire snapshot, so check daily data as well.
      if (
        productSignature(current, itemId) !== expectedProduct ||
        JSON.stringify(current.daily) !== JSON.stringify(expectedDaily)
      ) {
        return "stale" as const;
      }

      const documentId = singleId([{ id: existing.document_id }]);
      const lineId = singleId([{ id: existing.line_id }]);

      // The header is locked by lockProductSnapshot. Do not cancel a header
      // shared by another line, even if that line is not a visible FG item.
      const updated = await db.query(
        `UPDATE foliar_fertilizer.m_stock_documents d
         SET status = 'CANCELLED', updated_at = now()
         WHERE d.id = $1::bigint
           AND d.document_type = 'SNAPSHOT'
           AND d.status = 'CONFIRMED'
           AND d.document_date = $2::date
           AND EXISTS (
             SELECT 1 FROM foliar_fertilizer.r_stock_document_lines l
             WHERE l.document_id = d.id AND l.id = $3::bigint
               AND l.item_id = $4::bigint AND l.owner_kind = 'COMPANY'
           )
           AND NOT EXISTS (
             SELECT 1 FROM foliar_fertilizer.r_stock_document_lines l
             WHERE l.document_id = d.id AND l.id <> $3::bigint
           )
         RETURNING d.id::text AS id`,
        [documentId, periodDate, lineId, itemId],
      );

      if (updated.length === 0) return "shared" as const;
      if (singleId(updated) !== documentId) {
        throw new Error("STOCK_PRODUCT_DELETE_FAILED");
      }
      return "deleted" as const;
    });

    if (result === "not_found") {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_PRODUCT_NOT_FOUND",
          message: "ไม่พบสินค้าในเดือนรายงานที่เลือก",
        },
        { status: 404, headers },
      );
    }
    if (result !== "deleted") {
      const code =
        result === "duplicate"
          ? "STOCK_PRODUCT_SNAPSHOT_DUPLICATE"
          : result === "shared"
            ? "STOCK_PRODUCT_SNAPSHOT_SHARED"
            : "STOCK_PRODUCT_CHANGED";
      const message =
        result === "duplicate"
          ? "พบยอดสรุปซ้ำ กรุณาตรวจสอบข้อมูลก่อนแก้ไข"
          : result === "shared"
            ? "เอกสารสต็อกมีสินค้าหลายรายการ กรุณาตรวจสอบก่อนลบ"
            : "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่ก่อนบันทึก";
      return NextResponse.json(
        { ok: false, code, message },
        { status: 409, headers },
      );
    }

    return NextResponse.json({ ok: true, item_id: itemId }, { headers });
  } catch (error) {
    if (error instanceof FactoryAuthError) return authErrorResponse(error);
    if (error instanceof BackendError) {
      const uncertain = error.code === "DB_TRANSACTION_FAILED";
      return NextResponse.json(
        {
          ok: false,
          code: uncertain ? "STOCK_WRITE_UNCERTAIN" : "STOCK_WRITE_UNAVAILABLE",
          message: uncertain
            ? "ไม่สามารถยืนยันผลการบันทึกได้ กรุณาตรวจสอบข้อมูลก่อนบันทึกใหม่"
            : "ไม่สามารถลบสินค้าได้ในขณะนี้",
        },
        { status: 503, headers },
      );
    }
    console.error("STOCK_PRODUCT_DELETE_FAILED");
    return NextResponse.json(
      {
        ok: false,
        code: "STOCK_PRODUCT_DELETE_FAILED",
        message: "ไม่สามารถลบสินค้าได้ในขณะนี้",
      },
      { status: 500, headers },
    );
  }
}
