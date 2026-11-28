import "server-only";
import { isDeepStrictEqual } from "node:util";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { AuditEntry } from "../lib/mock-data/audit-log.ts";
import { blankReport, saveReport, timeSlots, validateReport } from "../features/qc-organic-fertilizer/qc-organic-domain.ts";
import { blankNC, saveNC, validateNC, withNCSignerFields } from "../features/nc-reports/nc-report-mock-helpers.ts";
import { newSubmission, saveSubmission, validateSubmission } from "../features/sample-submissions/sample-submission-domain.ts";
import { blankLog, saveLog, validateLog, withLogDocumentDate } from "../features/sample_submission_log/submission_log_domain.ts";
import { blankLabSheet, saveLabSheet, validateLabSheet } from "../features/lab_sample_receiving/lab_sample_receiving_domain.ts";
import { blankQcWeightDocument, saveQcWeightDocument, validateQcWeightDocument, withQcWeightGroupTimes } from "../features/qc_product_weight_check/qc_product_weight_check_domain.tsx";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { requireFactoryModule, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";

export class QcError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
type Document = { id: string; doc_no?: string };
type Stored = { payload: Document; version: number };
export type QcSnapshot<T extends Document> = { records: T[]; versions: Record<string, number> };

function object(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new QcError(400, "โครงสร้างเอกสารไม่ถูกต้อง");
  return input as Record<string, unknown>;
}

function parseFields(template: unknown, input: unknown, path = "document"): unknown {
  if (Array.isArray(template)) {
    if (Array.isArray(input) && input.length <= 250 && (template.length < 2 || input.length === template.length)) {
      return input.map((field, index) => parseFields(template.length === 1 ? template[0] : template[index], field, path + "[]"));
    }
  } else if (template !== null && typeof template === "object") {
    const raw = object(input);
    return Object.fromEntries(Object.entries(template).map(([key, value]) => [key, parseFields(value, raw[key], path + "." + key)]));
  } else if (typeof input === "string" && input.length <= 10_000 && (typeof template === "string" || template === null)) {
    return input;
  } else if ((typeof input === "boolean" && typeof template === "boolean") || (template === null && input === null)) {
    return input;
  }
  throw new QcError(400, `ช่องข้อมูลไม่ตรงกับแบบฟอร์ม (${path})`);
}

function define<T extends Document>(
  label: string,
  template: T,
  validate: (draft: T, records: readonly T[]) => Record<string, string | undefined>,
  save: (records: readonly T[], draft: T, id: string, at: string) => { saved: T },
) {
  return {
    label,
    save(input: unknown, records: Document[], at: string): Document {
      const draft = parseFields(template, input) as T;
      const errors = Object.values(validate(draft, records as T[])).filter(Boolean);
      if (errors.length) throw new QcError(422, errors[0]!);
      return save(records as T[], draft, randomUUID(), at).saved;
    },
  };
}

const organicTemplate = blankReport();
organicTemplate.fertilizer[0].extra_times = [timeSlots[0]];
organicTemplate.stop_start = [{ id: "", machine_stop_time: "", machine_run_time: "", machine_stop_reason: "" }];
const ncDefinition = define("ใบ NC", blankNC(), validateNC, saveNC);
// NAN_SAMPLE_LOG_DEFAULT_DATES_V6
const sampleLogDefinition = define("แบบบันทึกการนำเข้าส่งตัวอย่างวิเคราะห์", blankLog(), validateLog, saveLog);
const weightDefinition = define("QC ตรวจเช็คน้ำหนักผลิตภัณฑ์", blankQcWeightDocument("template"), validateQcWeightDocument, saveQcWeightDocument);
export const qcKinds = {
  qc_organic_fertilizer: define("ตรวจคุณภาพปุ๋ยอินทรีย์เคมี", organicTemplate, (draft, records) => {
    if (draft.profile !== "itech" && draft.profile !== "ifoam") return { profile: "โรงงานไม่ถูกต้อง" };
    if (draft.fertilizer.some(item => item.extra_times.some(slot => !timeSlots.includes(slot)))) return { time: "ช่วงเวลาของสูตรไม่ถูกต้อง" };
    if (records.some(row => row.id === draft.id && row.profile !== draft.profile)) return { profile: "เปลี่ยนโรงงานของเอกสารเดิมไม่ได้" };
    return validateReport(draft, records);
  }, saveReport),
  nc_reports: {
    ...ncDefinition,
    save(input: unknown, records: Document[], at: string): Document {
      const raw = object(input);
      const previous = records.find(row => row.id === raw.id);
      return ncDefinition.save(withNCSignerFields(raw, previous), records, at);
    },
  },
  sample_submissions: define("ใบส่งตัวอย่าง", newSubmission(), validateSubmission, saveSubmission),
  sample_submission_log: {
    ...sampleLogDefinition,
    save(input: unknown, records: Document[], at: string): Document {
      const raw = object(input);
      const previous = records.find(row => row.id === raw.id);
      return sampleLogDefinition.save(withLogDocumentDate(raw, previous ? object(previous) : undefined), records, at);
    },
  },
  lab_sample_receiving: define("i-Lab แบบบันทึกรับตัวอย่าง", blankLabSheet("template"), validateLabSheet, saveLabSheet),
  qc_product_weight_check: {
    ...weightDefinition,
    save(input: unknown, records: Document[], at: string): Document {
      const raw = object(input);
      const previous = records.find(row => row.id === raw.id);
      return weightDefinition.save(withQcWeightGroupTimes(raw, previous), records, at);
    },
  },
};
export type QcKind = keyof typeof qcKinds;

async function rows(kind: QcKind, database: Pick<PoolClient, "query">) {
  const result = await database.query<Stored>(
    "SELECT payload, version FROM foliar_fertilizer.qc_documents WHERE kind=$1 AND deleted_at IS NULL ORDER BY updated_at DESC, id",
    [kind],
  );
  return result.rows;
}
export async function readQcDocuments(user: AuthenticatedFactoryUser, kind: QcKind, database: Pick<PoolClient, "query"> = getFactoryDatabasePool()): Promise<QcSnapshot<Document>> {
  requireFactoryModule(user, kind);
  const stored = await rows(kind, database);
  return { records: stored.map(row => kind === "nc_reports" ? withNCSignerFields(row.payload) : kind === "qc_product_weight_check" ? withQcWeightGroupTimes(row.payload) : row.payload), versions: Object.fromEntries(stored.map(row => [row.payload.id, row.version])) };
}

function changes(before: Document | undefined, after: Document | undefined): AuditEntry["changes"] {
  const old = before ? object(before) : {};
  const next = after ? object(after) : {};
  const display = (value: unknown) => value == null || value === "" ? "—" : typeof value === "string" ? value : JSON.stringify(value);
  return [...new Set([...Object.keys(old), ...Object.keys(next)])].flatMap(field => {
    if (["id","created_at","updated_at"].includes(field) || isDeepStrictEqual(old[field], next[field])) return [];
    if (["requester_address","requester_phone","requester_email"].includes(field)) return [{ field, before: old[field] ? "ปกปิดข้อมูลส่วนบุคคล" : "—", after: next[field] ? "ปกปิดข้อมูลส่วนบุคคล" : "—" }];
    return [{ field, before: display(old[field]), after: display(next[field]) }];
  });
}

export async function writeQcDocument(
  user: AuthenticatedFactoryUser, kind: QcKind, input: unknown,
  connect = () => getFactoryDatabasePool().connect(),
) {
  requireFactoryModule(user, kind);
  const command = object(input);
  const draft = command.action === "save" ? object(command.document) : null;
  const id = draft ? draft.id : command.id;
  const version = command.version;
  if ((command.action !== "delete" && command.action !== "save") || typeof id !== "string" ||
      ((id || !draft) && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) ||
      (id ? !Number.isSafeInteger(version) : version !== null)) throw new QcError(400, "รหัสหรือรุ่นเอกสารไม่ถูกต้อง");

  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261125, pg_catalog.hashtext($1))", [kind]);
    const all = await rows(kind, client);
    const previous = all.find(row => row.payload.id === id);
    if (id && (!previous || previous.version !== version)) throw new QcError(409, "มีการแก้ไขหรือลบเอกสารแล้ว กรุณาโหลดข้อมูลใหม่");
    const at = new Date().toISOString();
    const saved = draft ? qcKinds[kind].save(draft, all.map(row => row.payload), at) : undefined;
    const nextVersion = (previous?.version ?? 0) + 1;
    if (!saved) {
      await client.query("UPDATE foliar_fertilizer.qc_documents SET deleted_at=$2, updated_at=$2, version=$3 WHERE id=$1", [id, at, nextVersion]);
    } else if (previous) {
      await client.query("UPDATE foliar_fertilizer.qc_documents SET payload=$2, updated_at=$3, version=$4 WHERE id=$1", [id, JSON.stringify(saved), at, nextVersion]);
    } else {
      await client.query("INSERT INTO foliar_fertilizer.qc_documents (id,kind,payload,updated_at) VALUES ($1,$2,$3,$4)", [saved.id, kind, JSON.stringify(saved), at]);
    }
    const reference = saved?.doc_no || previous?.payload.doc_no || saved?.id || id;
    const action = !saved ? "DELETE" : previous ? "UPDATE" : "CREATE";
    const entry: AuditEntry = {
      id: randomUUID(), occurredAt: at, user: user.displayName, email: user.email, action,
      module: qcKinds[kind].label, reference, ipAddress: "—",
      summary: `${action === "CREATE" ? "สร้าง" : action === "UPDATE" ? "แก้ไข" : "ลบ"}เอกสาร ${reference}`,
      changes: changes(previous?.payload, saved),
    };
    await client.query("INSERT INTO foliar_fertilizer.qc_audit (id,document_id,actor_id,occurred_at,payload) VALUES ($1,$2,$3,$4,$5)",
      [entry.id, saved?.id ?? id, user.id, at, JSON.stringify(entry)]);
    await client.query("COMMIT");
    return saved ? { saved, version: nextVersion } : null;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally { client.release(broken); }
}

export async function readFactoryAudit(user: AuthenticatedFactoryUser, database: Pick<PoolClient, "query"> = getFactoryDatabasePool()) {
  requireFactoryModule(user, "audit_log");
  const result = await database.query<{ payload: AuditEntry }>(`
    SELECT payload FROM (
      SELECT id, occurred_at, payload FROM foliar_fertilizer.qc_audit
      UNION ALL
      SELECT id, occurred_at, payload FROM foliar_fertilizer.purchasing_history
    ) AS entries ORDER BY occurred_at DESC, id DESC LIMIT 1000`);
  return result.rows.map(row => row.payload);
}
