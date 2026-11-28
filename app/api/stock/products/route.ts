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
  validateStockProductsImportedSoRow,
  validateStockProductsSoSheetCoverage,
  type StockProductsRawCell,
} from "@/src/features/stock_products/stock_products_domain";

import {
  withStockWriteTransaction,
  type StockWriteQueries,
} from "../_lib/stock-write-database.ts";

import {
  parseStockProductsWorkbookExcel,
  StockProductsExcelError,
  type StockProductsImportedSoRow,
} from "../_lib/stock-products-import-parser.ts";

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

/* ---------------- Shared product persistence ---------------- */

type StockProductInsertInput = ReturnType<typeof parseProduct> & {
  daily: StockProductsDailyEntry[];
  source?: {
    file_name: string;
    sheet_name: string;
    cell_range: string;
  };
};

async function lockProductPeriod(
  db: StockWriteQueries,
  periodDate: string,
): Promise<void> {
  const periodKey = Number(periodDate.slice(0, 7).replace("-", ""));

  await db.query(
    `SELECT pg_advisory_xact_lock(hashtext($1::text), $2::integer)`,
    ["stock_products", periodKey],
  );
}

async function insertProduct(
  db: StockWriteQueries,
  input: StockProductInsertInput,
): Promise<StockProductsStockRow> {
  const daily = readStoredDaily(input.daily, input.periodDate, invalid);

  const itemId = singleId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_items (
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
         document_id, line_no, item_id, owner_kind, source_data, note,
         source_file_name, source_sheet_name, source_cell_range
       ) VALUES ($1::bigint, 1, $2::bigint, 'COMPANY', $3::json, $4, $5, $6, $7)
       RETURNING id::text AS id`,
      [
        documentId,
        itemId,
        JSON.stringify({ ...input.summary, daily }),
        input.remark,
        input.source?.file_name ?? null,
        input.source?.sheet_name ?? null,
        input.source?.cell_range ?? null,
      ],
    ),
  );

  return {
    item: { ...input.item, id: itemId, source_row: 0, no: null },
    summary: input.summary,
    remark: input.remark,
    daily,
  };
}

/* ---------------- Excel import ---------------- */

const maxImportRequestBytes = 4 * 1024 * 1024;
const importScope = "replace_stock_and_all_so";
const importedSoKind = "FF_EXCEL_SO";

// A2 replaces SO across all report periods. Take this lock before a period
// lock whenever a transaction can create, cancel or delete SO records.
async function lockSoScope(db: StockWriteQueries): Promise<void> {
  await db.query(
    `SELECT pg_advisory_xact_lock(hashtext($1::text), $2::integer)`,
    ["stock_products_all_so", 0],
  );
}

function importError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status, headers });
}

// Bound the actual stream, not only the Content-Length header.
async function readImportForm(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType || !request.body) return invalid();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxImportRequestBytes) {
        throw new StockProductsExcelError(
          "FILE_TOO_LARGE",
          "ขนาดคำขอนำเข้า Excel ต้องไม่เกิน 4 MiB",
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: bytes.buffer,
    }).formData();
  } catch {
    return invalid();
  }
}

async function readImportRequest(request: NextRequest) {
  const form = await readImportForm(request);
  const action = form.get("action");
  if (action !== "import_preview" && action !== "import_confirm")
    return invalid();

  // An older Stock-only dialog promises to preserve SO. It must never be
  // permitted to use this new destructive import contract.
  if (form.get("import_scope") !== importScope) {
    throw new StockProductsExcelError(
      "IMPORT_SCOPE_REQUIRED",
      "กรุณาใช้หน้าต่างนำเข้า Excel รุ่นที่รองรับการแทนที่ Stock และ SO ทั้งหมด",
    );
  }
  const allowed = ["action", "year_be", "month", "file", "import_scope"];
  if (action === "import_confirm") allowed.push("preview_token");
  for (const key of form.keys()) {
    if (!allowed.includes(key) || form.getAll(key).length !== 1)
      return invalid();
  }

  const year = form.get("year_be");
  const month = form.get("month");
  const file = form.get("file");
  if (
    typeof year !== "string" ||
    !/^\d{1,5}$/.test(year) ||
    typeof month !== "string" ||
    !/^\d{1,2}$/.test(month) ||
    file === null ||
    typeof file === "string" ||
    !file.name.toLowerCase().endsWith(".xlsx") ||
    file.name.includes("\0") ||
    file.name.length > 255 ||
    file.size === 0 ||
    file.size > maxImportRequestBytes
  ) {
    return invalid();
  }

  const period = { year_be: Number(year), month: Number(month) };
  const periodDate = parseBodyPeriod(period);
  const token = form.get("preview_token");
  if (
    action === "import_confirm" &&
    (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
  ) {
    return invalid();
  }

  return {
    action,
    period,
    periodDate,
    file,
    previewToken: typeof token === "string" ? token : null,
  };
}

type StockProductsReplaceState = {
  documentIds: string[];
  rowCount: number;
  shared: boolean;
  fingerprint: string;
};

async function readProductReplaceState(
  db: StockWriteQueries,
  periodDate: string,
  lock: boolean,
): Promise<StockProductsReplaceState> {
  // Only confirmed company FG snapshots can be replaced. Keep older
  // cancelled snapshots, item masters, SO and other document types intact.
  const rows = await db.query(
    `SELECT
       d.id::text AS document_id,
       l.id::text AS line_id,
       md5(jsonb_build_array(to_jsonb(d), to_jsonb(l), to_jsonb(i))::text)
         AS fingerprint,
       EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines other_line
         LEFT JOIN foliar_fertilizer.m_stock_items other_item
           ON other_item.id = other_line.item_id
         WHERE other_line.document_id = d.id
           AND (
             other_line.owner_kind IS DISTINCT FROM 'COMPANY'
             OR other_item.item_type IS DISTINCT FROM 'FG'
           )
       ) AS shared
     FROM foliar_fertilizer.m_stock_documents d
     JOIN foliar_fertilizer.r_stock_document_lines l ON l.document_id = d.id
     JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
     WHERE d.document_type = 'SNAPSHOT'
       AND d.document_date = $1::date
       AND d.status = 'CONFIRMED'
       AND i.item_type = 'FG'
       AND l.owner_kind = 'COMPANY'
     ORDER BY d.id, l.id
     ${lock ? "FOR UPDATE OF d, l, i" : ""}`,
    [periodDate],
  );

  return replaceStateFromRows(rows);
}

function replaceStateFromRows(
  rows: readonly Record<string, unknown>[],
): StockProductsReplaceState {
  const documentIds = new Set<string>();
  const lineIds = new Set<string>();
  let shared = false;
  const signatures = rows.map((row) => {
    const documentId = singleId([{ id: row.document_id }]);
    const lineId = singleId([{ id: row.line_id }]);
    const fingerprint = row.fingerprint;

    if (
      lineIds.has(lineId) ||
      typeof fingerprint !== "string" ||
      !/^[a-f0-9]{32}$/.test(fingerprint) ||
      typeof row.shared !== "boolean"
    ) {
      throw new Error("STOCK_PRODUCTS_REPLACE_STATE_INVALID");
    }

    documentIds.add(documentId);
    lineIds.add(lineId);
    shared ||= row.shared;
    return [documentId, lineId, fingerprint, row.shared];
  });

  return {
    documentIds: [...documentIds],
    rowCount: rows.length,
    shared,
    fingerprint: createHash("sha256")
      .update(JSON.stringify(signatures))
      .digest("hex"),
  };
}

async function cancelProductSnapshots(
  db: StockWriteQueries,
  periodDate: string,
  state: StockProductsReplaceState,
): Promise<void> {
  if (state.shared) {
    throw new Error("STOCK_PRODUCTS_REPLACE_SCOPE_INVALID");
  }
  if (state.documentIds.length === 0) return;

  // Cancel only the locked stock documents; do not delete or update items,
  // stock lines, SO documents, or links used by historical orders.
  const rows = await db.query(
    `UPDATE foliar_fertilizer.m_stock_documents d
     SET status = 'CANCELLED', updated_at = now()
     WHERE d.id = ANY(string_to_array($1, ',')::bigint[])
       AND d.document_type = 'SNAPSHOT'
       AND d.document_date = $2::date
       AND d.status = 'CONFIRMED'
       AND EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines l
         JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
         WHERE l.document_id = d.id
           AND l.owner_kind = 'COMPANY'
           AND i.item_type = 'FG'
       )
       AND NOT EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines l
         LEFT JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
         WHERE l.document_id = d.id
           AND (
             l.owner_kind IS DISTINCT FROM 'COMPANY'
             OR i.item_type IS DISTINCT FROM 'FG'
           )
       )
     RETURNING d.id::text AS id`,
    [state.documentIds.join(","), periodDate],
  );

  const actualIds = new Set(rows.map((row) => singleId([row])));
  if (
    rows.length !== state.documentIds.length ||
    actualIds.size !== state.documentIds.length ||
    state.documentIds.some((id) => !actualIds.has(id))
  ) {
    // Throw after any write mismatch so the whole transaction rolls back.
    throw new Error("STOCK_PRODUCTS_REPLACE_CANCEL_FAILED");
  }
}

// Only previously visible company FG SOs and explicitly tagged independent
// FF Excel SOs belong to this module. Never cancel unrelated orders simply
// because another module uses the same group code.
function soLineScope(
  line: "l" | "other_line",
  item: "i" | "other_item",
): string {
  return `${line}.owner_kind = 'COMPANY' AND (
    ${item}.item_type = 'FG' OR (
      ${line}.item_id IS NULL
      AND ${line}.source_data->>'import_kind' = '${importedSoKind}'
    )
  )`;
}

async function supportsIndependentSo(db: StockWriteQueries): Promise<boolean> {
  // The repository migration allows NULL. Check the actual target rather
  // than assuming its schema matches the older migration.
  const rows = await db.query(
    `SELECT count(*) = 2 AND bool_and(is_nullable = 'YES') AS supported
     FROM information_schema.columns
     WHERE table_schema = 'foliar_fertilizer'
       AND (
         (table_name = 'm_stock_documents' AND column_name = 'document_date')
         OR (table_name = 'r_stock_document_lines' AND column_name = 'item_id')
       )`,
  );
  if (rows.length !== 1 || typeof rows[0]?.supported !== "boolean") {
    throw new Error("STOCK_SO_SCHEMA_CHECK_INVALID");
  }
  return rows[0].supported;
}

async function readSoReplaceState(
  db: StockWriteQueries,
  lock: boolean,
): Promise<StockProductsReplaceState> {
  const rows = await db.query(
    `SELECT
       d.id::text AS document_id,
       l.id::text AS line_id,
       md5(jsonb_build_array(to_jsonb(d), to_jsonb(l), i.item_type)::text)
         AS fingerprint,
       EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines other_line
         LEFT JOIN foliar_fertilizer.m_stock_items other_item
           ON other_item.id = other_line.item_id
         WHERE other_line.document_id = d.id
           AND (${soLineScope("other_line", "other_item")}) IS NOT TRUE
       ) AS shared
     FROM foliar_fertilizer.m_stock_documents d
     JOIN foliar_fertilizer.r_stock_document_lines l ON l.document_id = d.id
     LEFT JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
     WHERE d.document_type = 'SO'
       AND d.status = 'CONFIRMED'
       AND d.source_group_code = ANY(string_to_array($1, ','))
       AND (${soLineScope("l", "i")})
     ORDER BY d.id, l.id
     ${lock ? "FOR UPDATE OF d, l" : ""}`,
    [STOCK_PRODUCTS_SO_SHEET_NAMES.join(",")],
  );
  return replaceStateFromRows(rows);
}

async function cancelSoDocuments(
  db: StockWriteQueries,
  state: StockProductsReplaceState,
): Promise<void> {
  if (state.shared) throw new Error("STOCK_SO_REPLACE_SCOPE_INVALID");
  if (state.documentIds.length === 0) return;

  const rows = await db.query(
    `UPDATE foliar_fertilizer.m_stock_documents d
     SET status = 'CANCELLED', updated_at = now()
     WHERE d.id = ANY(string_to_array($1, ',')::bigint[])
       AND d.document_type = 'SO'
       AND d.status = 'CONFIRMED'
       AND d.source_group_code = ANY(string_to_array($2, ','))
       AND EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines l
         LEFT JOIN foliar_fertilizer.m_stock_items i ON i.id = l.item_id
         WHERE l.document_id = d.id
           AND (${soLineScope("l", "i")})
       )
       AND NOT EXISTS (
         SELECT 1
         FROM foliar_fertilizer.r_stock_document_lines other_line
         LEFT JOIN foliar_fertilizer.m_stock_items other_item
           ON other_item.id = other_line.item_id
         WHERE other_line.document_id = d.id
           AND (${soLineScope("other_line", "other_item")}) IS NOT TRUE
       )
     RETURNING d.id::text AS id`,
    [state.documentIds.join(","), STOCK_PRODUCTS_SO_SHEET_NAMES.join(",")],
  );
  // A cancellation mismatch must throw so the entire import rolls back.
  assertDeletedIds(rows, state.documentIds);
}

async function readWorkbookReplaceState(
  db: StockWriteQueries,
  periodDate: string,
  lock: boolean,
) {
  const supportsSo = await supportsIndependentSo(db);
  const stock = await readProductReplaceState(db, periodDate, lock);
  const so = await readSoReplaceState(db, lock);
  return { supportsSo, stock, so };
}

type StockProductsWorkbookReplaceState = Awaited<
  ReturnType<typeof readWorkbookReplaceState>
>;

async function insertImportedSo(
  db: StockWriteQueries,
  row: StockProductsImportedSoRow,
  fileName: string,
): Promise<void> {
  const documentId = singleId(
    await db.query(
      `INSERT INTO foliar_fertilizer.m_stock_documents (
         document_type, document_no, document_date, source_group_code, status
       ) VALUES ('SO', $1, $2::date, $3, 'CONFIRMED')
       RETURNING id::text AS id`,
      [row.so_number, row.document_date, row.sheet_name],
    ),
  );

  // Preserve zero/negative quantity in JSON, without violating the positive
  // SQL quantity constraint. Do not create a master or infer an item link.
  const numericQuantity = Number(row.quantity) > 0 ? row.quantity : null;
  const sourceData = {
    import_kind: importedSoKind,
    source_row: row.source_row,
    date_raw: row.date_raw,
    source_date_text: row.source_date_text,
    customer_name: row.customer_name,
    product_name: row.product_name,
    quantity: row.quantity,
    supplementary_cells: row.supplementary_cells,
  };
  singleId(
    await db.query(
      `INSERT INTO foliar_fertilizer.r_stock_document_lines (
         document_id, line_no, item_id, owner_kind, quantity, unit, source_data,
         source_file_name, source_sheet_name, source_cell_range
       ) VALUES ($1::bigint, 1, NULL, 'COMPANY', $2::numeric, $3, $4::json,
                 $5, $6, $7)
       RETURNING id::text AS id`,
      [
        documentId,
        numericQuantity,
        row.unit || null,
        JSON.stringify(sourceData),
        fileName,
        row.sheet_name,
        `A${row.source_row}:N${row.source_row}`,
      ],
    ),
  );
}

function importWarnings(rows: readonly StockProductsStockRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = row.item.code;
    if (code !== null) counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  return rows.flatMap((row) => {
    const code = row.item.code;
    if (code === null) {
      return [
        {
          severity: "warning" as const,
          code: "MISSING_ITEM_CODE",
          message: "รหัสสินค้าว่าง ระบบจะบันทึกเป็น NULL",
          source_row: row.item.source_row,
        },
      ];
    }
    if ((counts.get(code) ?? 0) > 1) {
      return [
        {
          severity: "warning" as const,
          code: "DUPLICATE_ITEM_CODE",
          message: "พบรหัสสินค้าซ้ำใน Excel ระบบจะรักษารายการต้นฉบับแยกกัน",
          source_row: row.item.source_row,
        },
      ];
    }
    return [];
  });
}

async function importProducts(request: NextRequest, userId: string) {
  const input = await readImportRequest(request);
  const bytes = await input.file.arrayBuffer();
  const workbook = await parseStockProductsWorkbookExcel(bytes, input.period);
  const sheet = workbook.stock;
  const soRows = workbook.so_sheets.flatMap((soSheet) => soSheet.rows);
  const fileSha256 = createHash("sha256")
    .update(new Uint8Array(bytes))
    .digest("hex");

  if (sheet.rows.length === 0) {
    return importError(
      "EMPTY_STOCK_IMPORT",
      "ไม่พบรายการสินค้าใน Excel ระบบจะไม่แทนที่ข้อมูลเดิมด้วยไฟล์ว่าง",
    );
  }

  const coverage = validateStockProductsSoSheetCoverage(workbook.so_sheets);
  if (coverage.length > 0) {
    throw new StockProductsExcelError("INVALID_SO_SHEETS", coverage.join("; "));
  }
  for (const soSheet of workbook.so_sheets) {
    const seen = new Set<number>();
    for (const row of soSheet.rows) {
      const errors = validateStockProductsImportedSoRow(row);
      if (
        row.sheet_name !== soSheet.name ||
        seen.has(row.source_row) ||
        Object.keys(errors).length > 0
      ) {
        throw new StockProductsExcelError(
          "INVALID_SO_ROW",
          `${soSheet.name} แถว ${row.source_row}: ${Object.values(errors).join("; ") || "ข้อมูลแถว SO ไม่ถูกต้อง"}`,
          `A${row.source_row}`,
          soSheet.name,
        );
      }
      seen.add(row.source_row);
    }
  }

  // Bind preview to both replacement scopes, file and user. The token is
  // not an authorization secret. Any changed Stock or SO requires re-preview.
  const createPreviewToken = (state: StockProductsWorkbookReplaceState) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          "replace-stock-all-so-v2",
          userId,
          input.periodDate,
          input.file.name,
          fileSha256,
          sheet.source_sheet_name,
          state.stock.fingerprint,
          state.so.fingerprint,
          state.supportsSo,
        ]),
      )
      .digest("hex");

  if (input.action === "import_preview") {
    const state = await withStockWriteTransaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY",
      );
      return readWorkbookReplaceState(db, input.periodDate, false);
    });
    const issues = [
      ...importWarnings(sheet.rows).map((issue) => ({
        ...issue,
        sheet_name: sheet.source_sheet_name,
      })),
      ...workbook.issues,
      ...(state.stock.rowCount > 0
        ? [
            {
              severity: "warning" as const,
              code: "PERIOD_WILL_BE_REPLACED",
              message: `การยืนยันจะแทนที่ Stock เดิม ${state.stock.rowCount} รายการในงวดนี้ด้วย Excel ล่าสุด ${sheet.rows.length} รายการ`,
            },
          ]
        : []),
      {
        severity: "warning" as const,
        code: "ALL_SO_WILL_BE_REPLACED",
        message: `การยืนยันจะแทนที่ SO เดิม ${state.so.rowCount} รายการทุกเดือนและทุกปี รวมถึงรายการที่เพิ่มด้วยตนเอง ด้วย SO จาก Excel ล่าสุด ${soRows.length} รายการ ทั้ง 16 ชีต`,
      },
      ...(state.stock.shared
        ? [
            {
              severity: "error" as const,
              code: "STOCK_IMPORT_SHARED_DOCUMENT",
              message:
                "พบเอกสาร Stock ที่มีข้อมูลประเภทอื่นร่วมอยู่ จึงไม่สามารถแทนที่โดยอัตโนมัติได้",
            },
          ]
        : []),
      ...(state.so.shared
        ? [
            {
              severity: "error" as const,
              code: "SO_IMPORT_SHARED_DOCUMENT",
              message:
                "พบเอกสาร SO ที่มีข้อมูลนอกขอบเขต FF ร่วมอยู่ จึงไม่สามารถแทนที่โดยอัตโนมัติได้",
            },
          ]
        : []),
      ...(!state.supportsSo
        ? [
            {
              severity: "error" as const,
              code: "SO_SCHEMA_NOT_SUPPORTED",
              message:
                "ฐานข้อมูลยังไม่รองรับ SO ที่ไม่มี Stock ID หรือวันที่จริง กรุณาตรวจสอบโครงสร้างฐานข้อมูล",
            },
          ]
        : []),
    ];
    const warningCount = issues.filter(
      (issue) => issue.severity === "warning",
    ).length;
    const errorCount = issues.filter(
      (issue) => issue.severity === "error",
    ).length;
    const canConfirm = errorCount === 0;
    return NextResponse.json(
      {
        ok: true,
        action: "preview",
        preview: {
          import_scope: importScope,
          source: {
            file_name: input.file.name,
            sheet_name: sheet.source_sheet_name,
            file_sha256: fileSha256,
          },
          period: input.period,
          summary: {
            total_rows: sheet.rows.length,
            valid_rows: sheet.rows.length,
            invalid_rows: 0,
            warning_count: warningCount,
            error_count: errorCount,
          },
          so_summary: {
            total_rows: soRows.length,
            valid_rows: soRows.length,
            invalid_rows: 0,
            sheet_count: workbook.so_sheets.length,
            invalid_date_count: soRows.filter(
              (row) => row.document_date === null,
            ).length,
          },
          replacement: {
            existing_stock_rows: state.stock.rowCount,
            existing_so_rows: state.so.rowCount,
            so_scope: "ALL_PERIODS",
          },
          rows: sheet.rows.map((row) => ({
            source_row: row.item.source_row,
            source_no: String(row.item.no ?? ""),
            item: {
              code: row.item.code,
              name: row.item.name,
              group: row.item.group,
              unit: row.item.unit,
              added_date: null,
            },
            summary: row.summary,
            remark: row.remark,
            daily_count: row.daily.length,
          })),
          so_sheets: workbook.so_sheets,
          issues,
          can_confirm: canConfirm,
          preview_token: canConfirm ? createPreviewToken(state) : null,
        },
      },
      { headers },
    );
  }

  const result = await withStockWriteTransaction(async (db) => {
    await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await lockSoScope(db);
    await lockProductPeriod(db, input.periodDate);

    const state = await readWorkbookReplaceState(db, input.periodDate, true);
    if (!state.supportsSo) return { kind: "schema" } as const;
    if (state.stock.shared) return { kind: "stock_shared" } as const;
    if (state.so.shared) return { kind: "so_shared" } as const;
    if (input.previewToken !== createPreviewToken(state)) {
      return { kind: "stale" } as const;
    }

    // No writes before validation. Cancel both scopes and insert the full
    // workbook atomically. Never return a failure result after writes begin.
    await cancelProductSnapshots(db, input.periodDate, state.stock);
    await cancelSoDocuments(db, state.so);

    for (const row of sheet.rows) {
      await insertProduct(db, {
        periodDate: input.periodDate,
        item: {
          code: row.item.code,
          name: row.item.name,
          group: row.item.group,
          unit: row.item.unit,
          added_date: null,
        },
        summary: row.summary,
        remark: row.remark,
        daily: row.daily,
        source: {
          file_name: input.file.name,
          sheet_name: sheet.source_sheet_name,
          cell_range: `A${row.item.source_row}:IB${row.item.source_row}`,
        },
      });
    }
    for (const row of soRows) {
      await insertImportedSo(db, row, input.file.name);
    }
    return {
      kind: "inserted",
      count: sheet.rows.length,
      soCount: soRows.length,
    } as const;
  });

  if (result.kind === "schema") {
    return importError(
      "SO_SCHEMA_NOT_SUPPORTED",
      "ฐานข้อมูลยังไม่รองรับ SO ที่ไม่มี Stock ID หรือวันที่จริง",
      409,
    );
  }
  if (result.kind === "stock_shared") {
    return importError(
      "STOCK_IMPORT_SHARED_DOCUMENT",
      "พบเอกสาร Stock ที่มีข้อมูลประเภทอื่นร่วมอยู่ จึงไม่สามารถแทนที่โดยอัตโนมัติได้",
      409,
    );
  }
  if (result.kind === "so_shared") {
    return importError(
      "SO_IMPORT_SHARED_DOCUMENT",
      "พบเอกสาร SO ที่มีข้อมูลนอกขอบเขต FF ร่วมอยู่ จึงไม่สามารถแทนที่โดยอัตโนมัติได้",
      409,
    );
  }
  if (result.kind === "stale") {
    return importError(
      "STALE_PREVIEW",
      "ไฟล์ งวดรายงาน หรือข้อมูล Stock/SO เปลี่ยนไป กรุณาตรวจสอบ Excel ใหม่",
      409,
    );
  }

  return NextResponse.json(
    {
      ok: true,
      action: "confirm",
      import_scope: importScope,
      period: input.period,
      inserted: result.count,
      inserted_so: result.soCount,
    },
    { status: 201, headers },
  );
}

function importErrorResponse(error: unknown) {
  if (error instanceof StockProductsExcelError) {
    return NextResponse.json(
      {
        ok: false,
        code: error.code,
        message: error.message,
        issues: [
          {
            severity: "error",
            code: error.code,
            message: error.message,
            ...(error.cell ? { cell: error.cell } : {}),
            ...(error.sheet_name ? { sheet_name: error.sheet_name } : {}),
          },
        ],
      },
      { status: 400, headers },
    );
  }
  if (error instanceof BackendError) {
    const uncertain = error.code === "DB_TRANSACTION_FAILED";
    return importError(
      uncertain ? "STOCK_WRITE_UNCERTAIN" : "STOCK_IMPORT_UNAVAILABLE",
      uncertain
        ? "ไม่สามารถยืนยันผลการทำงานได้ กรุณาโหลดข้อมูลล่าสุดก่อนนำเข้าใหม่"
        : "ไม่สามารถตรวจสอบหรือบันทึก Excel ได้ในขณะนี้",
      503,
    );
  }
  console.error("STOCK_PRODUCTS_IMPORT_FAILED");
  return importError(
    "STOCK_PRODUCTS_IMPORT_FAILED",
    "เกิดข้อผิดพลาดในการนำเข้า Excel กรุณาตรวจสอบก่อนนำเข้าใหม่",
    500,
  );
}

export async function POST(request: NextRequest) {
  let savingDaily = false;
  let creatingSo = false;
  const importing =
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ===
    "multipart/form-data";

  try {
    assertTrustedAuthRequest(
      request,
      importing ? maxImportRequestBytes : maxBodyBytes,
    );
    assertCsrf(request);
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);

    requireFactoryModule(user, "stock_products");

    if (importing) {
      return await importProducts(request, String(user.id));
    }

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
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await lockProductPeriod(db, input.periodDate);
      return insertProduct(db, { ...input, daily: [] });
    });

    return NextResponse.json({ ok: true, row }, { status: 201, headers });
  } catch (error) {
    if (error instanceof FactoryAuthError) return authErrorResponse(error);
    if (importing) return importErrorResponse(error);
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

         FROM foliar_fertilizer.m_stock_items i

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
     FROM foliar_fertilizer.m_stock_items i
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

    requireFactoryModule(user, "stock_products");

    const body = record(await readBody(request));

    const itemId = parseItemId(body.item_id);
    const input = parseProduct(body, "update_product");
    const expected = productSignature(body.expected, itemId);

    const result = await withStockWriteTransaction(async (db) => {
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await lockProductPeriod(db, input.periodDate);

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
          `UPDATE foliar_fertilizer.m_stock_items
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
    await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await lockProductPeriod(db, periodDate);

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

function isSoRawCell(value: unknown): value is StockProductsRawCell {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.includes("\0")) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function readSoRow(row: Record<string, unknown>): StockProductsSoRow {
  const { id, item_id, sheet_name, date_raw, so_number, unit, source_data } =
    row;
  const sheetName = findSoSheetName(sheet_name);

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id) ||
    (item_id !== null &&
      (typeof item_id !== "string" || !/^[1-9]\d*$/.test(item_id))) ||
    !sheetName ||
    (date_raw !== null &&
      (typeof date_raw !== "string" ||
        date_raw.startsWith("0000-") ||
        !isValidStockProductsAddedDate(date_raw))) ||
    typeof so_number !== "string" ||
    !so_number.trim() ||
    (unit !== null && typeof unit !== "string") ||
    typeof source_data !== "object" ||
    source_data === null ||
    Array.isArray(source_data)
  ) {
    return invalidStoredSo();
  }

  const source = source_data as Record<string, unknown>;
  const { customer_name, product_name, quantity } = source;

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

  if (source.import_kind === importedSoKind) {
    const {
      source_row,
      date_raw: displayDate,
      source_date_text,
      supplementary_cells,
    } = source;
    if (
      item_id !== null ||
      typeof source_row !== "number" ||
      typeof displayDate !== "string" ||
      typeof source_date_text !== "string" ||
      !Array.isArray(supplementary_cells) ||
      !supplementary_cells.every(isSoRawCell)
    ) {
      return invalidStoredSo();
    }
    const imported: StockProductsImportedSoRow = {
      sheet_name: sheetName,
      source_row,
      date_raw: displayDate,
      document_date: date_raw,
      source_date_text,
      so_number,
      customer_name,
      product_name,
      quantity,
      unit: unit ?? "",
      supplementary_cells,
    };
    if (Object.keys(validateStockProductsImportedSoRow(imported)).length > 0) {
      return invalidStoredSo();
    }
    return { ...imported, id };
  }

  // Old and manually created SO rows retain their original item link and
  // strict date validation. Independent rows require the import marker.
  if (item_id === null || date_raw === null) return invalidStoredSo();
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
     LEFT JOIN foliar_fertilizer.m_stock_items i
       ON i.id = l.item_id
     WHERE d.document_type = 'SO'
       AND d.status = 'CONFIRMED'
       AND (${soLineScope("l", "i")})
       AND d.source_group_code = ANY(string_to_array($1, ','))
     ORDER BY CASE WHEN l.item_id IS NULL THEN 0 ELSE 1 END,
              CASE WHEN l.item_id IS NOT NULL THEN d.document_date END NULLS LAST,
              d.id, l.line_no`,
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
    await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await lockSoScope(db);
    await lockProductPeriod(db, input.periodDate);

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

/* ---------------- DELETE: permanently delete product and related SO ---------------- */

function assertDeletedIds(
  rows: readonly Record<string, unknown>[],
  expectedIds: readonly string[],
): void {
  const actualIds = new Set(rows.map((row) => singleId([row])));
  if (
    rows.length !== expectedIds.length ||
    actualIds.size !== expectedIds.length ||
    expectedIds.some((id) => !actualIds.has(id))
  ) {
    throw new Error("STOCK_PRODUCT_DELETE_FAILED");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);

    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    requireFactoryModule(user, "stock_products");

    const body = record(await readBody(request));
    onlyFields(body, [
      "action",
      "item_id",
      "period",
      "expected",
      "confirm_hard_delete",
    ]);
    if (body.action !== "delete_product") return invalid();
    if (body.confirm_hard_delete !== true) {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_PRODUCT_HARD_DELETE_CONFIRMATION_REQUIRED",
          message: "กรุณายืนยันการลบสินค้าและ SO แบบถาวรจากหน้าจอรุ่นล่าสุด",
        },
        { status: 400, headers },
      );
    }

    const itemId = parseItemId(body.item_id);
    const periodDate = parseBodyPeriod(body.period);
    const expected = record(body.expected);
    const expectedProduct = productSignature(expected, itemId);
    if (!Array.isArray(expected.daily)) return invalid();
    const expectedDaily = readStoredDaily(expected.daily, periodDate, invalid);

    const result = await withStockWriteTransaction(async (db) => {
      await db.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
      await lockSoScope(db);
      await lockProductPeriod(db, periodDate);
      const matches = await lockProductSnapshot(db, itemId, periodDate);
      if (matches.length === 0) return "not_found" as const;
      if (matches.length !== 1) return "duplicate" as const;

      const existing = matches[0];
      if (!existing) throw new Error("STOCK_PRODUCT_SNAPSHOT_INVALID");
      const current = readSnapshotRow(existing, periodDate);

      // Verify the selected snapshot and daily data before permanent deletion.
      if (
        productSignature(current, itemId) !== expectedProduct ||
        JSON.stringify(current.daily) !== JSON.stringify(expectedDaily)
      ) {
        return "stale" as const;
      }

      const documentId = singleId([{ id: existing.document_id }]);
      const lineId = singleId([{ id: existing.line_id }]);

      // The selected item is already locked. Lock every directly related
      // document and line before checking the scope of the deletion.
      const linked = await db.query(
        `SELECT
           l.id::text AS line_id,
           d.id::text AS document_id,
           l.owner_kind,
           d.document_type
         FROM foliar_fertilizer.r_stock_document_lines l
         JOIN foliar_fertilizer.m_stock_documents d
           ON d.id = l.document_id
         WHERE l.item_id = $1::bigint
         ORDER BY d.id, l.id
         FOR UPDATE OF d, l`,
        [itemId],
      );

      if (
        !linked.some(
          (row) => row.line_id === lineId && row.document_id === documentId,
        )
      ) {
        throw new Error("STOCK_PRODUCT_DELETE_SCOPE_INVALID");
      }

      // Option C: delete only the selected snapshot and SO documents
      // directly associated with this item. Other snapshots or movement
      // documents must not be silently removed.
      for (const row of linked) {
        const selectedSnapshot =
          row.document_type === "SNAPSHOT" &&
          row.document_id === documentId &&
          row.line_id === lineId;
        if (
          row.owner_kind !== "COMPANY" ||
          (!selectedSnapshot && row.document_type !== "SO")
        ) {
          return "related" as const;
        }
      }

      const lineIds = linked.map((row) => singleId([{ id: row.line_id }]));
      const documentIds = [
        ...new Set(linked.map((row) => singleId([{ id: row.document_id }]))),
      ];
      if (new Set(lineIds).size !== lineIds.length) {
        throw new Error("STOCK_PRODUCT_DELETE_SCOPE_INVALID");
      }

      // StockWriteQueries accepts scalar SQL parameters, not arrays.
      // These lists contain only validated numeric IDs from the locked rows.
      const lineList = lineIds.join(",");
      const documentList = documentIds.join(",");

      const conflicts = await db.query(
        `SELECT
           EXISTS (
             SELECT 1
             FROM foliar_fertilizer.r_stock_document_lines l
             WHERE l.document_id = ANY(string_to_array($1, ',')::bigint[])
               AND NOT (l.id = ANY(string_to_array($2, ',')::bigint[]))
           ) AS shared,
           (
             EXISTS (
               SELECT 1 FROM foliar_fertilizer.m_stock_documents d
               WHERE d.reference_document_id = ANY(string_to_array($1, ',')::bigint[])
             ) OR EXISTS (
               SELECT 1 FROM foliar_fertilizer.r_stock_document_lines l
               WHERE l.source_line_id = ANY(string_to_array($2, ',')::bigint[])
             )
           ) AS referenced`,
        [documentList, lineList],
      );
      const conflict = conflicts[0];
      if (
        conflicts.length !== 1 ||
        typeof conflict?.shared !== "boolean" ||
        typeof conflict.referenced !== "boolean"
      ) {
        throw new Error("STOCK_PRODUCT_DELETE_SCOPE_INVALID");
      }
      if (conflict.shared) return "shared" as const;
      if (conflict.referenced) return "referenced" as const;

      // Never return a successful or partial result after writes start.
      // A mismatch throws, causing withStockWriteTransaction to roll back.
      const deletedLines = await db.query(
        `DELETE FROM foliar_fertilizer.r_stock_document_lines
         WHERE item_id = $1::bigint
           AND id = ANY(string_to_array($2, ',')::bigint[])
         RETURNING id::text AS id`,
        [itemId, lineList],
      );
      assertDeletedIds(deletedLines, lineIds);

      const deletedDocuments = await db.query(
        `DELETE FROM foliar_fertilizer.m_stock_documents d
         WHERE d.id = ANY(string_to_array($1, ',')::bigint[])
           AND d.document_type IN ('SNAPSHOT', 'SO')
           AND NOT EXISTS (
             SELECT 1 FROM foliar_fertilizer.r_stock_document_lines l
             WHERE l.document_id = d.id
           )
         RETURNING d.id::text AS id`,
        [documentList],
      );
      assertDeletedIds(deletedDocuments, documentIds);

      const deletedItem = await db.query(
        `DELETE FROM foliar_fertilizer.m_stock_items i
         WHERE i.id = $1::bigint
           AND i.item_type = 'FG'
           AND i.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM foliar_fertilizer.r_stock_document_lines l
             WHERE l.item_id = i.id
           )
         RETURNING i.id::text AS id`,
        [itemId],
      );
      assertDeletedIds(deletedItem, [itemId]);

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
    if (result === "related" || result === "referenced") {
      return NextResponse.json(
        {
          ok: false,
          code: "STOCK_PRODUCT_DELETE_REFERENCED",
          message:
            "สินค้าหรือเอกสารมีข้อมูลอ้างอิงอื่นนอกเหนือจาก Stock และ SO ที่อนุญาตให้ลบ กรุณาตรวจสอบก่อนลบ",
        },
        { status: 409, headers },
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
