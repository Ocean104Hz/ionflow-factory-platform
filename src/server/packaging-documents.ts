import "server-only";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { requireFactoryModule, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";
import { saveReport, validDate, validDecimal, type PackagingReport } from "../features/packaging-reports/packaging-domain.ts";
import type { PackingReportOption, PackingSummary, PackingSummaryData } from "../features/packing-summary/packing-summary-domain.ts";

export type PackagingKind = "packaging_report" | "packing_summary";
type Database = Pick<PoolClient, "query">;
export class PackagingError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function bad(message = "ข้อมูลเอกสารไม่ตรงกับแบบฟอร์ม"): never { throw new PackagingError(400, message); }
function conflict(message: string): never { throw new PackagingError(409, message); }
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) bad();
  return value as Record<string, unknown>;
}
function fields<K extends string>(input: Record<string, unknown>, keys: readonly K[]): Record<K, string> {
  return Object.fromEntries(keys.map((key) => {
    const value = input[key];
    if (typeof value !== "string" || value.length > 4000) bad();
    return [key, value];
  })) as Record<K, string>;
}
function rows<T>(value: unknown, read: (input: Record<string, unknown>) => T, max = 200): T[] {
  if (!Array.isArray(value) || value.length > max) bad();
  return value.map((item) => read(obj(item)));
}
function triState(value: unknown) {
  if (value !== null && typeof value !== "boolean") bad();
  return value;
}
const uuid = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);

function parseReport(input: unknown): PackagingReport {
  const raw = obj(input);
  const { profileId, status, disposition } = raw;
  if ((profileId !== "ITECH" && profileId !== "IFOAM") ||
      (status !== "DRAFT" && status !== "RECORDED") || disposition !== "NOT_EVALUATED") bad();
  return {
    ...fields(raw, ["id", "documentNumber", "location", "documentDate", "remarks", "updatedAt"]),
    profileId, status, disposition, createdAt: "",
    signers: rows(raw.signers, (row) => fields(row, ["role", "name", "date"]), 4),
    sets: rows(raw.sets, (set) => {
      const { setNo } = set;
      if (typeof setNo !== "number" || !Number.isSafeInteger(setNo)) bad();
      return {
        ...fields(set, ["id", "remarks"]), setNo,
        contexts: rows(set.contexts, (row) => fields(row, ["id", "fertilizerName", "productionDate", "packageType", "packageWeight", "packageUnit", "quantity", "lotCode"])),
        inspections: rows(set.inspections, (row) => ({
          ...fields(row, ["id", "contextId", "packingTime", "hourlySamplingTime", "bagWeight1", "bagWeight2", "moisture", "waterSolubility", "dust"]),
          physicalCondition: triState(row.physicalCondition), bagCodeMarking: triState(row.bagCodeMarking), bagSealing: triState(row.bagSealing),
        })),
        loadCells: rows(set.loadCells, (row) => fields(row, ["id", "time", "weight"])),
        comparisons: rows(set.comparisons, (row) => fields(row, ["id", "time", "qcWeight", "masterWeight"])),
      };
    }, 50),
  };
}

function parseSummary(input: unknown): PackingSummary {
  const raw = obj(input);
  const head = fields(raw, ["id", "documentNo", "location", "date", "updatedAt"]);
  const location = head.location.trim();
  if (!location || !validDate(head.date) || !/^IT-\d{1,24}$/.test(head.documentNo)) {
    bad("กรุณาระบุสถานที่ วันที่ และเลขที่เอกสาร IT ตามด้วยตัวเลข");
  }
  const items = rows(raw.items, (row) => fields(row, ["id", "productName", "sizeKg", "quantity", "unit", "remark"]));
  if (!items.length || new Set(items.map((row) => row.id)).size !== items.length) bad("กรุณาเพิ่มรายการสินค้า");
  items.forEach((row, index) => {
    if (!row.id || !row.productName.trim() || !row.unit.trim() || !validDecimal(row.quantity, true) ||
        (row.sizeKg && !validDecimal(row.sizeKg))) {
      bad(`รายการที่ ${index + 1} ต้องมีชื่อสินค้า จำนวนมากกว่า 0 และหน่วยนับ ขนาดต้องเป็นตัวเลขที่ไม่ติดลบ`);
    }
  });
  if (!Array.isArray(raw.reportIds) || raw.reportIds.length > 200 || !raw.reportIds.every(uuid) ||
      new Set(raw.reportIds).size !== raw.reportIds.length) bad("ข้อมูลรายงานอ้างอิงไม่ถูกต้อง");
  return {
    ...head, location, items, reportIds: raw.reportIds,
    signers: fields(obj(raw.signers), ["packer", "supervisor", "packingHead", "approver"]),
    createdAt: "",
  };
}

export async function readPackaging(user: AuthenticatedFactoryUser, kind: PackagingKind, db: Database = getFactoryDatabasePool()) {
  requireFactoryModule(user, kind);
  if (kind === "packaging_report") {
    const { rows } = await db.query<{ payload: PackagingReport }>(
      "SELECT payload FROM foliar_fertilizer.packaging_reports WHERE deleted_at IS NULL ORDER BY payload->>'updatedAt' DESC",
    );
    return { records: rows.map((row) => row.payload) };
  }
  // Summary lookup exposes only the report identity and display fields.
  const { rows: [data] } = await db.query<PackingSummaryData>(
    `SELECT
       (SELECT COALESCE(jsonb_agg(payload ORDER BY payload->>'updatedAt' DESC), '[]') FROM foliar_fertilizer.packing_summaries) AS records,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object(
         'id', r.id, 'documentNumber', r.document_no, 'documentDate', r.payload->>'documentDate',
         'status', r.payload->>'status', 'linkedSummaryId', ref.summary_id
       ) ORDER BY r.document_no), '[]')
        FROM foliar_fertilizer.packaging_reports r LEFT JOIN foliar_fertilizer.packing_summary_reports ref ON ref.report_id=r.id
        WHERE r.profile_id='ITECH' AND r.document_no<>'' AND r.deleted_at IS NULL) AS reports`,
  );
  return data;
}

function versioned<T extends { id: string; updatedAt: string }>(input: { id: string; updatedAt: string }, records: readonly T[]) {
  const old = records.find((row) => row.id === input.id);
  if (input.id && !uuid(input.id)) bad();
  if (input.id && (!old || old.updatedAt !== input.updatedAt)) conflict("เอกสารถูกแก้ไขหรือลบแล้ว กรุณาโหลดประวัติใหม่");
  return old;
}

async function savePackagingReport(client: PoolClient, actor: string, command: Record<string, unknown>) {
  if (command.action === "delete") {
    const { id, updatedAt } = fields(command, ["id", "updatedAt"]);
    if (!uuid(id)) bad();
    const { rows } = await client.query<{ payload: PackagingReport }>(
      "SELECT payload FROM foliar_fertilizer.packaging_reports WHERE id=$1 AND deleted_at IS NULL", [id],
    );
    versioned({ id, updatedAt }, rows.map((row) => row.payload));
    const linked = await client.query("SELECT 1 FROM foliar_fertilizer.packing_summary_reports WHERE report_id=$1", [id]);
    if (linked.rowCount) conflict("รายงานนี้ผูกกับใบแจ้งสั่งแพ็คแล้ว กรุณายกเลิกการผูกก่อนลบ");
    await client.query("UPDATE foliar_fertilizer.packaging_reports SET deleted_at=now(), actor_id=$2 WHERE id=$1", [id, actor]);
    return null;
  }
  const input = parseReport(command.document);
  if (input.id && !uuid(input.id)) bad();
  const { rows } = await client.query<{ payload: PackagingReport }>(
    `SELECT payload FROM foliar_fertilizer.packaging_reports WHERE deleted_at IS NULL
     AND (id=$1 OR (profile_id=$2 AND document_no<>'' AND lower(document_no)=lower($3)))`,
    [input.id || null, input.profileId, input.documentNumber.trim()],
  );
  const records = rows.map((row) => row.payload);
  const old = versioned(input, records);
  if (old && !input.documentNumber.trim()) {
    const linked = await client.query("SELECT 1 FROM foliar_fertilizer.packing_summary_reports WHERE report_id=$1", [old.id]);
    if (linked.rowCount) conflict("กรุณาคงเลขที่รายงานไว้ระหว่างที่มีใบแจ้งสั่งแพ็คอ้างอิง");
  }
  const updatedAt = new Date(Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0)).toISOString();
  let saved: PackagingReport;
  try { saved = saveReport(records, input, crypto.randomUUID(), updatedAt).record; }
  catch (error) { bad(error instanceof Error ? error.message : "บันทึกรายงานไม่สำเร็จ"); }
  await client.query(
    `INSERT INTO foliar_fertilizer.packaging_reports (id,profile_id,document_no,payload,actor_id)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE
     SET document_no=EXCLUDED.document_no,payload=EXCLUDED.payload,actor_id=EXCLUDED.actor_id`,
    [saved.id, saved.profileId, saved.documentNumber, JSON.stringify(saved), actor],
  );
  return saved;
}

async function savePackingSummary(client: PoolClient, actor: string, input: PackingSummary) {
  if (input.id && !uuid(input.id)) bad();
  const { rows } = await client.query<{ payload: PackingSummary }>(
    "SELECT payload FROM foliar_fertilizer.packing_summaries WHERE id=$1 OR document_no=$2",
    [input.id || null, input.documentNo],
  );
  const old = versioned(input, rows.map((row) => row.payload));
  if (rows.some(({ payload }) => payload.id !== input.id && payload.documentNo === input.documentNo)) conflict("เลขที่ใบแจ้งสั่งแพ็คซ้ำ");
  const reportRefs = await client.query<Pick<PackingReportOption, "id" | "linkedSummaryId">>(
    `SELECT r.id, ref.summary_id AS "linkedSummaryId" FROM foliar_fertilizer.packaging_reports r
     LEFT JOIN foliar_fertilizer.packing_summary_reports ref ON ref.report_id=r.id
     WHERE r.id=ANY($1::uuid[]) AND r.profile_id='ITECH' AND r.document_no<>'' AND r.deleted_at IS NULL`,
    [input.reportIds],
  );
  if (reportRefs.rowCount !== input.reportIds.length) conflict("มีรายงานที่เลือกถูกลบหรือใช้เป็นเอกสารอ้างอิงไม่ได้");
  if (reportRefs.rows.some((row) => row.linkedSummaryId && row.linkedSummaryId !== input.id)) {
    conflict("รายงานที่เลือกถูกผูกกับใบแจ้งสั่งแพ็คอื่นแล้ว");
  }
  const updatedAt = new Date(Math.max(Date.now(), old ? Date.parse(old.updatedAt) + 1 : 0)).toISOString();
  const saved = { ...input, id: old?.id ?? crypto.randomUUID(), createdAt: old?.createdAt ?? updatedAt, updatedAt };
  await client.query(
    `INSERT INTO foliar_fertilizer.packing_summaries (id,document_no,payload,actor_id)
     VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE
     SET document_no=EXCLUDED.document_no,payload=EXCLUDED.payload,actor_id=EXCLUDED.actor_id`,
    [saved.id, saved.documentNo, JSON.stringify(saved), actor],
  );
  await client.query("DELETE FROM foliar_fertilizer.packing_summary_reports WHERE summary_id=$1", [saved.id]);
  await client.query(
    "INSERT INTO foliar_fertilizer.packing_summary_reports (summary_id,report_id) SELECT $1, unnest($2::uuid[])",
    [saved.id, saved.reportIds],
  );
  return saved;
}

export async function writePackaging(
  user: AuthenticatedFactoryUser, kind: PackagingKind, body: unknown,
  connect = () => getFactoryDatabasePool().connect(),
) {
  requireFactoryModule(user, kind);
  const command = obj(body);
  if (command.action !== "save" && !(kind === "packaging_report" && command.action === "delete")) bad();
  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261127, 1)");
    const result = kind === "packaging_report"
      ? await savePackagingReport(client, user.id, command)
      : await savePackingSummary(client, user.id, parseSummary(command.document));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}
