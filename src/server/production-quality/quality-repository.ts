import "server-only";
import { randomUUID } from "node:crypto";
import {
  getDevelopmentDatabase, type DevelopmentDatabase, type DatabaseRow,
  type ReadOnlyQueries, type WriteQueries, type SqlValue,
} from "../database/database";
import { metrics, timeSlots, signerRoles, parseNumeric, parseDuration, formatDuration, type Inspection, type Reading } from "../../features/production-quality/production-quality-domain";
import { inputFields, signerCodes, parseQualityRecord, type QualityInput, type QualityRecord } from "../../features/production-quality/production-quality-contract";

export type QualityActor = Readonly<{ id: string; displayName: string }>;
export class QualityConflictError extends Error {
  constructor(message = "เอกสารมีการเปลี่ยนแปลงหรือถูกลบแล้ว กรุณาโหลดข้อมูลใหม่") { super(message); this.name = "QualityConflictError"; }
}
const H = "foliar_fertilizer.m_production_quality";
const F = "foliar_fertilizer.r_production_quality_formulas";
const R = "foliar_fertilizer.r_production_quality_readings";
const S = "foliar_fertilizer.r_production_quality_machine_stops";
const G = "foliar_fertilizer.r_production_quality_signers";
const A = "foliar_fertilizer.r_production_quality_history";
const SELECT = `SELECT h.id::text, h.version::text, h.document_number AS "documentNumber",
  h.profile_id AS "profileId", COALESCE(h.inspection_date::text, '') AS "inspectionDate",
  h.production_site AS "productionSite", h.production_line AS "productionLine",
  h.record_status AS "recordStatus", h.disposition,
  COALESCE(left(h.machine_start::text,5),'') AS "machineStart",
  COALESCE(left(h.work_start::text,5),'') AS "workStart",
  COALESCE(left(h.work_stop::text,5),'') AS "workStop", h.notes,
  h.created_at AS "createdAt", h.updated_at AS "updatedAt",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'formulaName', f.formula_name,
    'lotCode', f.lot_code, 'startTime', COALESCE(left(f.start_time::text,5),''),
    'endTime', COALESCE(left(f.end_time::text,5),''), 'extraSlots',
    ARRAY(SELECT left(u.t::text,5) FROM unnest(f.extra_slots) WITH ORDINALITY AS u(t,n) ORDER BY u.n)) ORDER BY f.line_no)
    FROM ${F} f WHERE f.inspection_id=h.id),'[]'::jsonb) AS formulas,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'stop',COALESCE(left(s.stop_time::text,5),''),
    'restart',COALESCE(left(s.restart_time::text,5),''),'reason',s.reason) ORDER BY s.line_no)
    FROM ${S} s WHERE s.inspection_id=h.id),'[]'::jsonb) AS stops,
  COALESCE((SELECT jsonb_agg(to_jsonb(g) - 'inspection_id') FROM ${G} g WHERE g.inspection_id=h.id),'[]'::jsonb) AS signers,
  COALESCE((SELECT jsonb_agg(to_jsonb(r) - 'inspection_id' ORDER BY r.metric_code, r.sample_time)
    FROM ${R} r WHERE r.inspection_id=h.id),'[]'::jsonb) AS readings
  FROM ${H} h`;
function obj(v: unknown): DatabaseRow {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("INVALID_QUALITY_DB_ROW");
  return v as DatabaseRow;
}
function array(v: unknown): DatabaseRow[] {
  if (!Array.isArray(v)) throw new Error("INVALID_QUALITY_DB_ARRAY");
  return v.map(obj);
}
function text(v: unknown): string { if (typeof v !== "string") throw new Error("INVALID_QUALITY_DB_TEXT"); return v; }
function stamp(v: unknown): string { return v instanceof Date ? v.toISOString() : text(v); }
function number(v: unknown): number {
  if (typeof v !== "number" && typeof v !== "string") throw new Error("INVALID_QUALITY_DB_NUMBER");
  const n = Number(v); if (!Number.isFinite(n)) throw new Error("INVALID_QUALITY_DB_NUMBER"); return n;
}
export function mapQualityRecord(row: DatabaseRow): QualityRecord {
  const readings: Inspection["readings"] = {};
  for (const r of array(row.readings)) {
    const metric = metrics.find((m) => m.id === r.metric_code);
    const slot = timeSlots.find((s) => s === text(r.sample_time).slice(0,5));
    if (!metric || !slot || metric.kind !== r.value_type) throw new Error("INVALID_QUALITY_DB_CELL");
    const note = text(r.note);
    let cell: Reading;
    if (metric.kind === "numeric") {
      const n = r.numeric_value === null ? null : number(r.numeric_value);
      const raw = r.raw_value === null ? null : text(r.raw_value);
      cell = { kind: "numeric", value: n === null ? "" : raw !== null && parseNumeric(raw,metric) === n ? raw : String(n), note };
    } else if (metric.kind === "duration") {
      const n = r.duration_seconds === null ? null : number(r.duration_seconds);
      const raw = r.raw_value === null ? null : text(r.raw_value);
      cell = { kind: "duration", value: n === null ? "" : raw !== null && parseDuration(raw) === n ? raw : formatDuration(n), note };
    } else if (metric.kind === "boolean") {
      if (r.boolean_value !== null && typeof r.boolean_value !== "boolean") throw new Error("INVALID_QUALITY_DB_BOOLEAN");
      cell = { kind: "boolean", value: r.boolean_value, note };
    } else if (metric.kind === "temperature") {
      if (r.temperature_values !== null && !Array.isArray(r.temperature_values)) throw new Error("INVALID_QUALITY_DB_TEMPERATURE");
      const values = r.temperature_values === null ? Array<string>(metric.points).fill("") : r.temperature_values.map((v: unknown) => v === null ? "" : String(number(v)));
      cell = { kind: "temperature", value: values, note };
    } else {
      cell = { kind: "text", value: r.text_value === null ? "" : text(r.text_value), note };
    }
    (readings[metric.id] ??= {})[slot] = cell;
  }
  const signers = array(row.signers).map((s) => {
    const i = signerCodes.findIndex((code) => code === s.role_code);
    if (i < 0) throw new Error("INVALID_QUALITY_DB_SIGNER");
    return { role: signerRoles[i], name: text(s.signer_name), date: s.signed_date === null ? "" : text(s.signed_date) };
  });
  return parseQualityRecord({ ...row, createdAt: stamp(row.createdAt), updatedAt: stamp(row.updatedAt), readings, signers });
}
export function readingRows(input: QualityInput) {
  return metrics.flatMap((metric) => timeSlots.flatMap((sample_time) => {
    const r = input.readings[metric.id]?.[sample_time];
    if (!r) return [];
    return [{ metric_code: metric.id, sample_time, value_type: r.kind,
      numeric_value: r.kind === "numeric" ? parseNumeric(r.value, metric) : null,
      duration_seconds: r.kind === "duration" ? parseDuration(r.value) : null,
      text_value: r.kind === "text" && r.value.trim() ? r.value : null,
      boolean_value: r.kind === "boolean" ? r.value : null,
      temperature_values: r.kind === "temperature" ? r.value.map((v) => parseNumeric(v,metric)) : null,
      raw_value: (r.kind === "numeric" || r.kind === "duration") && r.value.trim() ? r.value : null,
      note: r.note }];
  }));
}
function header(input: QualityInput, actor: QualityActor): SqlValue[] {
  return [input.documentNumber,input.profileId,input.inspectionDate || null,input.productionSite,input.productionLine,
    input.recordStatus,input.disposition,input.machineStart || null,input.workStart || null,input.workStop || null,input.notes,actor.id];
}
async function readOne(q: ReadOnlyQueries, id: string): Promise<QualityRecord | null> {
  const rows = await q.query(`${SELECT} WHERE h.id=$1 AND h.archived_at IS NULL`,[id]);
  return rows[0] ? mapQualityRecord(rows[0]) : null;
}
async function required(q: ReadOnlyQueries,id: string): Promise<QualityRecord> {
  const record = await readOne(q,id); if (!record) throw new QualityConflictError(); return record;
}
async function lock(q: WriteQueries,id: string,version: string) {
  const rows = await q.query(`SELECT version::text FROM ${H} WHERE id=$1 AND archived_at IS NULL FOR UPDATE`,[id]);
  if (rows[0]?.version !== version) throw new QualityConflictError();
  return required(q,id);
}
async function details(q: WriteQueries,id: string,input: QualityInput) {
  const formulas = input.formulas.map((f,i) => ({ id:f.id,line_no:i+1,formula_name:f.formulaName,lot_code:f.lotCode,start_time:f.startTime||null,end_time:f.endTime||null,extra_slots:f.extraSlots }));
  const stops = input.stops.map((s,i) => ({ id:s.id,line_no:i+1,stop_time:s.stop||null,restart_time:s.restart||null,reason:s.reason }));
  const signers = input.signers.map((s) => ({ role_code:signerCodes[signerRoles.indexOf(s.role)],signer_name:s.name,signed_date:s.date||null }));
  await q.query(`INSERT INTO ${F}(inspection_id,id,line_no,formula_name,lot_code,start_time,end_time,extra_slots)
    SELECT $1::uuid,x.* FROM jsonb_to_recordset($2::jsonb) AS x(id text,line_no integer,formula_name text,lot_code text,start_time time,end_time time,extra_slots time[])`,[id,JSON.stringify(formulas)]);
  await q.query(`INSERT INTO ${R}(inspection_id,metric_code,sample_time,value_type,numeric_value,duration_seconds,text_value,boolean_value,temperature_values,raw_value,note)
    SELECT $1::uuid,x.* FROM jsonb_to_recordset($2::jsonb) AS x(metric_code text,sample_time time,value_type text,numeric_value numeric,duration_seconds integer,text_value text,boolean_value boolean,temperature_values numeric[],raw_value text,note text)`,[id,JSON.stringify(readingRows(input))]);
  await q.query(`INSERT INTO ${S}(inspection_id,id,line_no,stop_time,restart_time,reason)
    SELECT $1::uuid,x.* FROM jsonb_to_recordset($2::jsonb) AS x(id text,line_no integer,stop_time time,restart_time time,reason text)`,[id,JSON.stringify(stops)]);
  await q.query(`INSERT INTO ${G}(inspection_id,role_code,signer_name,signed_date)
    SELECT $1::uuid,x.* FROM jsonb_to_recordset($2::jsonb) AS x(role_code text,signer_name text,signed_date date)`,[id,JSON.stringify(signers)]);
}
function changes(before: QualityRecord | null, after: QualityRecord) {
  return inputFields.filter((k) => !before || JSON.stringify(before[k]) !== JSON.stringify(after[k])).map((field) => ({ field, before: before?.[field] ?? null, after: after[field] }));
}
async function audit(q: WriteQueries,id: string,version: string,action: "created"|"updated"|"archived",actor: QualityActor,changes: unknown[]) {
  await q.query(`INSERT INTO ${A}(id,inspection_id,record_version,action,actor_id,actor_display_name,changes) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[randomUUID(),id,version,action,actor.id,actor.displayName,JSON.stringify(changes)]);
}
export function createQualityRepository(db: DevelopmentDatabase) {
  return {
    list: () => db.readOnly(async (q) => (await q.query(`${SELECT} WHERE h.archived_at IS NULL ORDER BY h.inspection_date DESC NULLS LAST,h.id`)).map(mapQualityRecord)),
    get: (id: string) => db.readOnly((q) => readOne(q,id)),
    create: (input: QualityInput,actor: QualityActor) => db.write(async (q) => {
      const id = randomUUID();
      await q.query(`INSERT INTO ${H}(id,document_number,profile_id,inspection_date,production_site,production_line,record_status,disposition,machine_start,work_start,work_stop,notes,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)`,[id,...header(input,actor)]);
      await details(q,id,input);
      const saved = await required(q,id);
      await audit(q,id,saved.version,"created",actor,changes(null,saved));
      return saved;
    }),
    update: (id: string,version: string,input: QualityInput,actor: QualityActor) => db.write(async (q) => {
      const old = await lock(q,id,version);
      if (old.profileId !== input.profileId) throw new QualityConflictError("ไม่สามารถเปลี่ยนโรงงานของเอกสารที่บันทึกแล้ว");
      if (old.recordStatus === "RECORDED" && input.recordStatus === "DRAFT") throw new QualityConflictError("เอกสารบันทึกผลแล้ว ไม่สามารถย้อนเป็นแบบร่าง");
      const updated = await q.query(`UPDATE ${H} SET document_number=$2,profile_id=$3,inspection_date=$4,production_site=$5,production_line=$6,record_status=$7,disposition=$8,machine_start=$9,work_start=$10,work_stop=$11,notes=$12,updated_by=$13,updated_at=GREATEST(clock_timestamp(),updated_at),version=version+1 WHERE id=$1 AND version=$14 AND archived_at IS NULL RETURNING id`,[id,...header(input,actor),version]);
      if (!updated.length) throw new QualityConflictError();
      for (const table of [F,R,S,G]) await q.query(`DELETE FROM ${table} WHERE inspection_id=$1`,[id]);
      await details(q,id,input);
      const saved = await required(q,id);
      await audit(q,id,saved.version,"updated",actor,changes(old,saved));
      return saved;
    }),
    archive: (id: string,version: string,actor: QualityActor) => db.write(async (q) => {
      await lock(q,id,version);
      const updated = await q.query(`UPDATE ${H} SET archived_at=GREATEST(clock_timestamp(),updated_at),updated_at=GREATEST(clock_timestamp(),updated_at),updated_by=$3,version=version+1 WHERE id=$1 AND version=$2 AND archived_at IS NULL RETURNING version::text`,[id,version,actor.id]);
      if (!updated[0]) throw new QualityConflictError();
      await audit(q,id,text(updated[0].version),"archived",actor,[{field:"archived",before:false,after:true}]);
    }),
  };
}
export type QualityRepository = ReturnType<typeof createQualityRepository>;
export function getQualityRepository(): QualityRepository { return createQualityRepository(getDevelopmentDatabase()); }
