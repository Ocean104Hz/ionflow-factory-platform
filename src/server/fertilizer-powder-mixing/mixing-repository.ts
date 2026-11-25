import "server-only";
import { randomUUID } from "node:crypto";
import type { Material, MixingReport } from "../../features/fertilizer-powder-mixing/mixing-domain";
import {
  getDevelopmentDatabase,
  type DatabaseRow,
  type DevelopmentDatabase,
  type ReadOnlyQueries,
  type WriteQueries,
  type SqlValue,
} from "../database/database";

export type MixingMaterialRecord = Omit<Material, "stock_balance"> & {
  stock_balance: number | null;
};
export type MixingRecord = Omit<MixingReport, "materials"> & {
  materials: MixingMaterialRecord[];
  version: string;
};
// Only server-validated document snapshots may reach this repository.
// Stock balances and audit metadata are never accepted from request bodies.
export type MixingInput = Omit<MixingReport,
  "id" | "materials" | "created_at" | "updated_at" | "updated_by"
> & { materials: Omit<Material, "stock_balance">[] };
export type MixingActor = Readonly<{ id: string; displayName: string }>;
export class MixingConflictError extends Error {
  constructor() {
    super("เอกสารมีการเปลี่ยนแปลงหรือถูกลบแล้ว กรุณาโหลดข้อมูลใหม่");
    this.name = "MixingConflictError";
  }
}

const HEADER = "foliar_fertilizer.m_fertilizer_powder_mixing";
const MATERIALS = "foliar_fertilizer.r_fertilizer_powder_mixing_materials";
const ROUNDS = "foliar_fertilizer.r_fertilizer_powder_mixing_rounds";
const HISTORY = "foliar_fertilizer.r_fertilizer_powder_mixing_history";
const SELECT_REPORT = `SELECT
  h.id::text, h.document_number AS doc_no, h.report_date::text,
  h.fertilizer_snapshot AS fertilizer, h.lot_no, h.shift,
  h.location_snapshot AS location, h.loader_no, h.mix_duration::text,
  h.inspector, COALESCE(h.inspector_date::text, '') AS inspector_date,
  h.production, h.factory_qa, h.master_refs AS "masterRefs",
  h.created_at, h.updated_at, h.updated_by, h.version::text,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', m.id, 'material_code', m.material_code_snapshot,
    'material_name', m.material_name_snapshot, 'lot_no', m.lot_no,
    'order_qty', m.order_qty::text, 'unit', m.unit_snapshot,
    'stock_balance', m.stock_balance::text
  ) ORDER BY m.line_no) FROM ${MATERIALS} m WHERE m.report_id = h.id), '[]'::jsonb) AS materials,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', r.id, 'round_date', r.round_date::text, 'shift', r.shift,
    'loader_load_count', r.loader_load_count, 'is_pass', r.is_pass,
    'operator_mixer', r.operator_mixer, 'supervisor', r.supervisor
  ) ORDER BY r.line_no) FROM ${ROUNDS} r WHERE r.report_id = h.id), '[]'::jsonb) AS mix_rounds
FROM ${HEADER} h`;

function object(value: unknown): DatabaseRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("MIXING_INVALID_DB_ROW");
  }
  return value as DatabaseRow;
}
function text(row: DatabaseRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error("MIXING_INVALID_DB_ROW");
  return value;
}
function decimal(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("MIXING_INVALID_DB_NUMBER");
  }
  if (typeof value === "string" && !value.trim()) throw new Error("MIXING_INVALID_DB_NUMBER");
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("MIXING_INVALID_DB_NUMBER");
  return n;
}
function nullableDecimal(value: unknown): number | null {
  return value === null ? null : decimal(value);
}
function timestamp(value: unknown): string {
  if (!(value instanceof Date) && typeof value !== "string") {
    throw new Error("MIXING_INVALID_DB_TIMESTAMP");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("MIXING_INVALID_DB_TIMESTAMP");
  return date.toISOString();
}
function array(value: unknown): DatabaseRow[] {
  if (!Array.isArray(value)) throw new Error("MIXING_INVALID_DB_ARRAY");
  return value.map(object);
}
function mapRecord(row: DatabaseRow): MixingRecord {
  const version = text(row, "version");
  if (!/^[1-9]\d*$/.test(version)) throw new Error("MIXING_INVALID_DB_VERSION");
  return {
    id: text(row, "id"), doc_no: text(row, "doc_no"),
    report_date: text(row, "report_date"), fertilizer: text(row, "fertilizer"),
    lot_no: text(row, "lot_no"), shift: text(row, "shift"),
    location: text(row, "location"), loader_no: text(row, "loader_no"),
    mix_duration: nullableDecimal(row.mix_duration),
    inspector: text(row, "inspector"), inspector_date: text(row, "inspector_date"),
    production: text(row, "production"), factory_qa: text(row, "factory_qa"),
    masterRefs: object(row.masterRefs) as NonNullable<MixingReport["masterRefs"]>,
    version, created_at: timestamp(row.created_at), updated_at: timestamp(row.updated_at),
    updated_by: text(row, "updated_by"),
    materials: array(row.materials).map((m) => ({
      id: text(m, "id"), material_code: text(m, "material_code"),
      material_name: text(m, "material_name"), lot_no: text(m, "lot_no"),
      order_qty: decimal(m.order_qty), unit: text(m, "unit"),
      stock_balance: nullableDecimal(m.stock_balance),
    })),
    mix_rounds: array(row.mix_rounds).map((r) => {
      const result = r.is_pass;
      if (result !== null && typeof result !== "boolean") throw new Error("MIXING_INVALID_DB_RESULT");
      return {
        id: text(r, "id"), round_date: text(r, "round_date"), shift: text(r, "shift"),
        loader_load_count: text(r, "loader_load_count"), is_pass: result,
        operator_mixer: text(r, "operator_mixer"), supervisor: text(r, "supervisor"),
      };
    }),
  };
}
async function readOne(q: ReadOnlyQueries, id: string): Promise<MixingRecord | null> {
  const rows = await q.query(`${SELECT_REPORT} WHERE h.id = $1 AND h.archived_at IS NULL`, [id]);
  return rows[0] ? mapRecord(rows[0]) : null;
}
async function requiredRecord(q: ReadOnlyQueries, id: string): Promise<MixingRecord> {
  const record = await readOne(q, id);
  if (!record) throw new MixingConflictError();
  return record;
}
function headerValues(row: MixingInput, actor: MixingActor): SqlValue[] {
  return [row.doc_no.trim(), row.report_date, row.fertilizer, row.lot_no,
    row.shift, row.location, row.loader_no, row.mix_duration, row.inspector,
    row.inspector_date || null, row.production, row.factory_qa,
    JSON.stringify(row.masterRefs ?? {}), actor.displayName];
}
async function insertDetails(tx: WriteQueries, id: string, row: MixingInput, previous?: MixingRecord): Promise<void> {
  for (const [i, m] of row.materials.entries()) {
    // Keep an existing reference snapshot only when its identity is unchanged.
    // No new balance is inferred from a client-supplied quantity or demo catalog.
    const old = previous?.materials.find((p) => p.id === m.id &&
      p.material_code === m.material_code && p.lot_no === m.lot_no &&
      p.unit === m.unit && p.material_name === m.material_name);
    await tx.query(`INSERT INTO ${MATERIALS} (
      report_id, id, line_no, material_code_snapshot, material_name_snapshot,
      lot_no, order_qty, unit_snapshot, stock_balance
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, m.id, i + 1, m.material_code, m.material_name, m.lot_no,
      m.order_qty, m.unit, old?.stock_balance ?? null]);
  }
  for (const [i, r] of row.mix_rounds.entries()) {
    await tx.query(`INSERT INTO ${ROUNDS} (
      report_id, id, line_no, round_date, shift, loader_load_count,
      is_pass, operator_mixer, supervisor
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, r.id, i + 1, r.round_date, r.shift, r.loader_load_count,
      r.is_pass, r.operator_mixer, r.supervisor]);
  }
}
async function history(tx: WriteQueries, id: string, version: string,
  action: "created" | "updated" | "archived", actor: MixingActor,
  before: MixingRecord | null, after: MixingRecord | null): Promise<void> {
  await tx.query(`INSERT INTO ${HISTORY} (
    id, report_id, record_version, action, actor_id, actor_display_name, note, changes
  ) VALUES ($1,$2,$3::bigint,$4,$5,$6,$7,$8::jsonb)`, [
    randomUUID(), id, version, action, actor.id, actor.displayName,
    { created: "สร้างรายงานผสมปุ๋ยผง", updated: "แก้ไขรายงานผสมปุ๋ยผง", archived: "ลบรายงานผสมปุ๋ยผง" }[action],
    JSON.stringify([{ before, after }]),
  ]);
}
async function lockRecord(tx: WriteQueries, id: string, version: string): Promise<MixingRecord> {
  const rows = await tx.query(`SELECT id FROM ${HEADER}
    WHERE id = $1 AND version = $2::bigint AND archived_at IS NULL FOR UPDATE`, [id, version]);
  if (!rows[0]) throw new MixingConflictError();
  return requiredRecord(tx, id);
}

// Injectable database boundary allows focused tests without a production connection.
export function createMixingRepository(db: Pick<DevelopmentDatabase, "readOnly" | "write">) {
  return {
    list(): Promise<MixingRecord[]> {
      return db.readOnly(async (q) => (await q.query(`${SELECT_REPORT}
        WHERE h.archived_at IS NULL ORDER BY h.report_date DESC, h.id`)).map(mapRecord));
    },
    get(id: string): Promise<MixingRecord | null> {
      return db.readOnly((q) => readOne(q, id));
    },
    create(row: MixingInput, actor: MixingActor): Promise<MixingRecord> {
      return db.write(async (tx) => {
        const id = randomUUID();
        await tx.query(`INSERT INTO ${HEADER} (
          id, document_number, report_date, fertilizer_snapshot, lot_no, shift,
          location_snapshot, loader_no, mix_duration, inspector, inspector_date,
          production, factory_qa, master_refs, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)`,
        [id, ...headerValues(row, actor)]);
        await insertDetails(tx, id, row);
        const saved = await requiredRecord(tx, id);
        await history(tx, id, saved.version, "created", actor, null, saved);
        return saved;
      });
    },
    update(id: string, version: string, row: MixingInput, actor: MixingActor): Promise<MixingRecord> {
      return db.write(async (tx) => {
        const before = await lockRecord(tx, id, version);
        const updated = await tx.query(`UPDATE ${HEADER} SET
          document_number=$1, report_date=$2, fertilizer_snapshot=$3, lot_no=$4,
          shift=$5, location_snapshot=$6, loader_no=$7, mix_duration=$8,
          inspector=$9, inspector_date=$10, production=$11, factory_qa=$12,
          master_refs=$13::jsonb, updated_by=$14, updated_at=CURRENT_TIMESTAMP,
          version=version+1 WHERE id=$15 AND version=$16::bigint AND archived_at IS NULL
          RETURNING id`, [...headerValues(row, actor), id, version]);
        if (!updated[0]) throw new MixingConflictError();
        await tx.query(`DELETE FROM ${MATERIALS} WHERE report_id=$1`, [id]);
        await tx.query(`DELETE FROM ${ROUNDS} WHERE report_id=$1`, [id]);
        await insertDetails(tx, id, row, before);
        const saved = await requiredRecord(tx, id);
        await history(tx, id, saved.version, "updated", actor, before, saved);
        return saved;
      });
    },
    archive(id: string, version: string, actor: MixingActor): Promise<void> {
      return db.write(async (tx) => {
        const before = await lockRecord(tx, id, version);
        const rows = await tx.query(`UPDATE ${HEADER} SET archived_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP, updated_by=$3, version=version+1
          WHERE id=$1 AND version=$2::bigint AND archived_at IS NULL RETURNING version::text`,
        [id, version, actor.displayName]);
        if (!rows[0]) throw new MixingConflictError();
        await history(tx, id, text(rows[0], "version"), "archived", actor, before, null);
      });
    },
  };
}
export function getMixingRepository() {
  return createMixingRepository(getDevelopmentDatabase());
}
