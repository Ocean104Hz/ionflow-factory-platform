import "server-only";
import { randomUUID } from "node:crypto";
import { getDevelopmentDatabase, type DatabaseRow, type ReadOnlyQueries, type WriteQueries } from "@/src/server/database/database";
import { validatePaperInput, PaperConflictError, type PaperInput, type PaperRecord } from "@/src/features/raw-material-inspections/paper-domain";

const HEADER = "foliar_fertilizer.m_qc_receiving_sheet";
const LINES = "foliar_fertilizer.r_qc_receiving_sheet_lines";
const HISTORY = "foliar_fertilizer.r_qc_receiving_sheet_history";
type Actor = { id: string; displayName: string };
const selection = `h.id::text, h.version::text, h.document_number AS number, h.document_date::text AS date,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('lineNo',l.line_no,'materialCode',l.material_code,'supplierCode',l.supplier_code,'quantity',l.quantity::text,'unit',l.unit,'weight',l.weight,'contamination',l.contamination,'physical',l.physical,'color',l.color,'note',l.note) ORDER BY l.line_no),'[]'::jsonb) FROM ${LINES} l WHERE l.sheet_id=h.id) AS lines`;
function map(row: DatabaseRow): PaperRecord {
  // Validate DB data too. Never silently drop an invalid or missing line.
  try { return { ...validatePaperInput(row), id: String(row.id), version: String(row.version) }; }
  catch { throw new Error("QC_PAPER_DATA_INVALID"); }
}
async function get(tx: ReadOnlyQueries, id: string): Promise<PaperRecord> {
  const rows = await tx.query(`SELECT ${selection} FROM ${HEADER} h WHERE h.id=$1 AND h.archived_at IS NULL`, [id]);
  if (!rows[0]) throw new PaperConflictError("ไม่พบเอกสาร กรุณาโหลดใหม่");
  return map(rows[0]);
}
export async function listPaperRecords(): Promise<PaperRecord[]> {
  return getDevelopmentDatabase().readOnly(async tx => (await tx.query(`SELECT ${selection} FROM ${HEADER} h WHERE h.archived_at IS NULL ORDER BY h.document_date DESC,h.id DESC`)).map(map));
}
async function saveLines(tx: WriteQueries, id: string, input: PaperInput) {
  for (const l of input.lines) {
    await tx.query(`INSERT INTO ${LINES}(sheet_id,line_no,material_code,supplier_code,quantity,unit,weight,contamination,physical,color,note) VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,$8,$9,$10,$11)`, [id,l.lineNo,l.materialCode,l.supplierCode,l.quantity,l.unit,l.weight,l.contamination,l.physical,l.color,l.note]);
  }
}
async function audit(tx: WriteQueries, id: string, version: string, action: "created"|"updated"|"archived", actor: Actor, before: PaperRecord|null, after: PaperRecord|null) {
  await tx.query(`INSERT INTO ${HISTORY}(id,sheet_id,record_version,action,actor_id,actor_display_name,changes) VALUES ($1,$2,$3::bigint,$4,$5,$6,$7::jsonb)`, [randomUUID(),id,version,action,actor.id,actor.displayName,JSON.stringify({before,after})]);
}
export async function createPaperRecord(input: PaperInput, actor: Actor): Promise<PaperRecord> {
  return getDevelopmentDatabase().write(async tx => {
    const id = randomUUID();
    await tx.query(`INSERT INTO ${HEADER}(id,document_number,document_date,created_by) VALUES ($1,$2,$3::date,$4)`, [id,input.number,input.date,actor.id]);
    await saveLines(tx,id,input);
    const saved=await get(tx,id);
    await audit(tx,id,saved.version,"created",actor,null,saved);
    return saved;
  });
}
async function lock(tx: WriteQueries,id: string,version: string) {
  const rows=await tx.query(`SELECT id FROM ${HEADER} WHERE id=$1 AND version=$2::bigint AND archived_at IS NULL FOR UPDATE`,[id,version]);
  if (!rows[0]) throw new PaperConflictError("เอกสารมีการเปลี่ยนแปลง กรุณาโหลดใหม่");
  return get(tx,id);
}
export async function updatePaperRecord(id: string,version: string,input: PaperInput,actor: Actor): Promise<PaperRecord> {
  return getDevelopmentDatabase().write(async tx => {
    const before=await lock(tx,id,version);
    await tx.query(`UPDATE ${HEADER} SET document_number=$1,document_date=$2::date,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$3`,[input.number,input.date,id]);
    await tx.query(`DELETE FROM ${LINES} WHERE sheet_id=$1`,[id]);
    await saveLines(tx,id,input);
    const saved=await get(tx,id);
    await audit(tx,id,saved.version,"updated",actor,before,saved);
    return saved;
  });
}
export async function archivePaperRecord(id: string,version: string,actor: Actor) {
  return getDevelopmentDatabase().write(async tx => {
    const before=await lock(tx,id,version);
    const rows=await tx.query(`UPDATE ${HEADER} SET archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,version=version+1 WHERE id=$1 RETURNING version::text`,[id]);
    if (!rows[0]) throw new PaperConflictError("ไม่พบเอกสาร");
    await audit(tx,id,String(rows[0].version),"archived",actor,before,null);
  });
}
