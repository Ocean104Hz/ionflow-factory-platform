import "server-only";
import type { PoolClient } from "pg";
import { getFactoryDatabasePool } from "./auth/access-repository.ts";
import { requireFactoryModule, type AuthenticatedFactoryUser } from "./auth/auth-service.ts";
import { blankWipSheet, saveWipSheet, validateWipSheet } from "../features/wip_receiving_issuing/wip_receiving_issuing_domain.ts";
import { blankOrganicRawMaterialSheet, saveOrganicRawMaterialSheet, validateOrganicRawMaterialSheet } from "../features/organic_raw_material_receiving/organic_raw_material_receiving_domain.ts";
import { blankOrganicExtractionSheet, saveOrganicExtractionSheet, validateOrganicExtractionSheet } from "../features/organic_extraction_temperature/organic_extraction_temperature_domain.ts";
import { blankOrganicExtractionMaterialLedgerSheet, saveOrganicExtractionMaterialLedgerSheet, validateOrganicExtractionMaterialLedgerSheet } from "../features/organic_extraction_material_ledger/organic_extraction_material_ledger_domain.ts";
import { EFFERVESCENT_MATERIAL_QUANTITY_FIELDS, type EffervescentMaterialLedgerSheet } from "../features/effervescent_material_ledger/effervescent_material_ledger_domain.ts";
import { createBlankEffervescentMaterialLedgerSheet } from "../features/effervescent_material_ledger/effervescent_material_ledger_domain.ts";
import { validDay } from "../features/purchase-orders/po-domain.ts";

export class OrganicDocumentError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type SheetIdentity = { id: string; created_at: string; updated_at: string };
type SaveSheet<T> = (records: T[], draft: T, id: string, savedAt: string) => { saved: T };

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OrganicDocumentError(400, "โครงสร้างเอกสารไม่ถูกต้อง");
  }
  return input as Record<string, unknown>;
}

function parseFields(template: unknown, input: unknown): unknown {
  if (Array.isArray(template)) {
    if (Array.isArray(input) && input.length === template.length)
      return template.map((item, index) => parseFields(item, input[index]));
  } else if (template !== null && typeof template === "object") {
    const data = object(input);
    return Object.fromEntries(Object.entries(template).map(([key, value]) => [key, parseFields(value, data[key])]));
  } else if (typeof template === "string" && typeof input === "string" && input.length <= 2000) {
    return input;
  } else if (typeof template === "number" && typeof input === "number" && Number.isSafeInteger(input)) {
    return input;
  }
  throw new OrganicDocumentError(400, "ช่องข้อมูลหรือตารางในเอกสารไม่ตรงกับแบบฟอร์ม");
}

function defineSheet<T extends SheetIdentity>(
  blank: () => T,
  validate: (draft: T) => Record<string, string>,
  save: SaveSheet<T>,
) {
  return {
    parse(input: unknown): T { return parseFields(blank(), input) as T; },
    save(records: SheetIdentity[], draft: SheetIdentity, id: string, savedAt: string): T {
      const errors = Object.values(validate(draft as T));
      if (errors.length) throw new OrganicDocumentError(400, errors[0]);
      try { return save(records as T[], draft as T, id, savedAt).saved; }
      catch (error) {
        throw new OrganicDocumentError(409, error instanceof Error ? error.message : "ไม่สามารถบันทึกเอกสารได้");
      }
    },
  };
}

const blankEffervescent = () => createBlankEffervescentMaterialLedgerSheet("template");
function validateEffervescent(draft: EffervescentMaterialLedgerSheet): Record<string, string> {
  if (!validDay(draft.record_date)) return { date: "กรุณาระบุวันที่บันทึกให้ถูกต้อง" };
  const { rows } = blankEffervescent();
  for (const [index, row] of draft.rows.entries()) {
    const fixed = rows[index];
    if (row.no !== fixed.no || row.code !== fixed.code || row.material_name !== fixed.material_name || row.unit !== fixed.unit) {
      return { rows: "รายการวัตถุดิบไม่ตรงกับแบบฟอร์มเม็ดฟู่" };
    }
    for (const field of EFFERVESCENT_MATERIAL_QUANTITY_FIELDS) {
      const value = row[field].trim();
      const number = Number(value);
      if (value && (!/^-?\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(number) || (number < 0 && field !== "adjustment"))) {
        return { quantity: `ตรวจสอบยอดวัตถุดิบแถวที่ ${row.no} ช่องปรับค่าใช้จำนวนติดลบได้` };
      }
    }
  }
  return {};
}

export const organicSheets = {
  wip_receiving_issuing: defineSheet(blankWipSheet, validateWipSheet, saveWipSheet),
  organic_raw_material_receiving: defineSheet(blankOrganicRawMaterialSheet, validateOrganicRawMaterialSheet, saveOrganicRawMaterialSheet),
  organic_extraction_temperature: defineSheet(blankOrganicExtractionSheet, validateOrganicExtractionSheet, saveOrganicExtractionSheet),
  organic_extraction_material_ledger: defineSheet(blankOrganicExtractionMaterialLedgerSheet, validateOrganicExtractionMaterialLedgerSheet, saveOrganicExtractionMaterialLedgerSheet),
  effervescent_material_ledger: defineSheet(blankEffervescent, validateEffervescent, (records, draft, id, savedAt) => ({
    saved: {
      ...draft,
      id: draft.id || id,
      created_at: records.find((row) => row.id === draft.id)?.created_at || savedAt,
      updated_at: savedAt,
    },
  })),
};
export type OrganicKind = keyof typeof organicSheets;

const validId = (value: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const stale = () => new OrganicDocumentError(409, "เอกสารถูกแก้ไขหรือลบแล้ว กรุณาเปิดประวัติอีกครั้ง");

export async function readOrganicDocuments(user: AuthenticatedFactoryUser, kind: OrganicKind, database = getFactoryDatabasePool()) {
  requireFactoryModule(user, kind);
  const result = await database.query(
    `SELECT payload FROM foliar_fertilizer.organic_documents
     WHERE kind=$1 AND deleted_at IS NULL ORDER BY document_date DESC, updated_at DESC, id`,
    [kind],
  );
  return result.rows.map((row) => row.payload);
}

export async function writeOrganicDocument(
  user: AuthenticatedFactoryUser,
  kind: OrganicKind,
  input: unknown,
  connect: () => Promise<PoolClient> = () => getFactoryDatabasePool().connect(),
) {
  requireFactoryModule(user, kind);
  const command = object(input);
  const definition = organicSheets[kind];
  const draft = command.action === "save" ? definition.parse(command.document) : null;
  const id = draft?.id ?? command.id;
  const version = draft?.updated_at ?? command.updated_at;
  if ((command.action !== "save" && command.action !== "delete") ||
      typeof id !== "string" || ((command.action === "delete" || id) && !validId(id)) ||
      typeof version !== "string") {
    throw new OrganicDocumentError(400, "รหัสหรือรุ่นของเอกสารไม่ถูกต้อง");
  }
  const client = await connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_catalog.pg_advisory_xact_lock(20261126, hashtext($1))", [kind]);
    const documentDate = draft ? ("document_date" in draft ? draft.document_date : draft.record_date).trim() : "";
    if (draft && !validDay(documentDate)) throw new OrganicDocumentError(400, "กรุณาระบุวันที่เอกสารให้ถูกต้อง");
    const result = await client.query<{ payload: SheetIdentity }>(
      `SELECT payload FROM foliar_fertilizer.organic_documents
       WHERE kind=$1 AND deleted_at IS NULL AND (id=$2 OR document_date=$3)`,
      [kind, id || null, documentDate || null],
    );
    const records = result.rows.map((row) => row.payload);
    const previous = records.find((row) => row.id === id);
    if (id && (!previous || previous.updated_at !== version)) throw stale();
    if (!draft) {
      await client.query(
        "UPDATE foliar_fertilizer.organic_documents SET deleted_at=clock_timestamp(), actor_id=$2 WHERE id=$1",
        [id, user.id],
      );
      await client.query("COMMIT");
      return null;
    }
    const savedAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.updated_at) + 1 : 0)).toISOString();
    const saved = definition.save(records, draft, crypto.randomUUID(), savedAt);
    await client.query(
      `INSERT INTO foliar_fertilizer.organic_documents (id,kind,document_date,payload,actor_id,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET document_date=EXCLUDED.document_date, payload=EXCLUDED.payload,
         actor_id=EXCLUDED.actor_id, updated_at=EXCLUDED.updated_at`,
      [saved.id, kind, documentDate, JSON.stringify(saved), user.id, savedAt],
    );
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}
