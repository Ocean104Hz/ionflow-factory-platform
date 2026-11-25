import "server-only";

import type { MasterReferences } from "../../features/master-data/master-domain";
import {
  FactoryAuthError,
  requireFactoryModule,
  requireFactoryRole,
  type AuthenticatedFactoryUser,
} from "../auth/auth-service";
import { readCurrentFactoryUser } from "../auth/server-auth";
import { getDevelopmentDatabase } from "../database/database";
import {
  getMixingRepository,
  type MixingActor,
  type MixingInput,
} from "./mixing-repository";

export class MixingValidationError extends Error {
  constructor(public readonly field: string, reason: string) {
    super(`${field}: ${reason}`);
    this.name = "MixingValidationError";
  }
}

const INVALID = "ข้อมูลไม่ถูกต้อง";
const REQUIRED = "กรุณาระบุข้อมูล";
const INVALID_REFERENCE = "รหัส ชื่อ หรือหน่วยนับไม่ตรงกับ Master Data ที่เปิดใช้งาน";
const DUPLICATE_ROW = "รหัสแถวซ้ำ";
const MAX_ROWS = 100;

function invalid(field: string, reason = INVALID): never {
  throw new MixingValidationError(field, reason);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readObject(value: unknown, field = "body"): Record<string, unknown> {
  return asObject(value) ?? invalid(field);
}

function readText(value: unknown, field: string, max = 500, required = true): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max || value.includes("\0")) {
    return invalid(field);
  }
  const result = value.trim();
  if (required && !result) return invalid(field, REQUIRED);
  return result;
}

function readDate(value: unknown, field: string, required = true): string {
  const result = readText(value, field, 10, required);
  if (!result && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || result.startsWith("0000-") ||
      !Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) {
    return invalid(field);
  }
  return result;
}

function readPositive(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return invalid(field);
  return value;
}

function readRows(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_ROWS) {
    return invalid(field, `1-${MAX_ROWS} rows`);
  }
  return value.map((row: unknown, index: number) => readObject(row, `${field}.${index}`));
}

function readRowId(value: unknown, field: string, seen: Set<string>): string {
  const id = readText(value, field, 200);
  if (seen.has(id)) return invalid(field, DUPLICATE_ROW);
  seen.add(id);
  return id;
}

function readRoundResult(value: unknown, field: string): boolean | null {
  if (value !== null && typeof value !== "boolean") return invalid(field);
  return value;
}

function readLoadCount(value: unknown, field: string): string {
  const count = readText(value, field, 100);
  if (count === "ครบ" || count === "ไม่ครบ") return count;
  if (!Number.isFinite(Number(count)) || Number(count) <= 0) return invalid(field);
  return count;
}

function readDocumentId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return invalid("id");
  }
  return value;
}

function readVersion(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value) ||
      BigInt(value) >= BigInt("9223372036854775807")) {
    return invalid("version");
  }
  return value;
}

/** Parse only document fields; never trust request IDs, audit fields, stock, or masterRefs. */
export function parseMixingInput(payload: unknown): MixingInput {
  const body = readObject(payload);
  const materialIds = new Set<string>();
  const roundIds = new Set<string>();
  const materials = readRows(body.materials, "materials").map((row, index) => {
    const field = `materials.${index}`;
    return {
      id: readRowId(row.id, `${field}.id`, materialIds),
      material_code: readText(row.material_code, `${field}.material_code`, 100),
      material_name: readText(row.material_name, `${field}.material_name`),
      lot_no: readText(row.lot_no, `${field}.lot_no`, 500, false),
      order_qty: readPositive(row.order_qty, `${field}.order_qty`),
      unit: readText(row.unit, `${field}.unit`, 100),
    };
  });
  const mix_rounds = readRows(body.mix_rounds, "mix_rounds").map((row, index) => {
    const field = `rounds.${index}`;
    return {
      id: readRowId(row.id, `${field}.id`, roundIds),
      round_date: readDate(row.round_date, `${field}.round_date`),
      shift: readText(row.shift, `${field}.shift`),
      loader_load_count: readLoadCount(row.loader_load_count, `${field}.loader_load_count`),
      is_pass: readRoundResult(row.is_pass, `${field}.is_pass`),
      operator_mixer: readText(row.operator_mixer, `${field}.operator_mixer`),
      supervisor: readText(row.supervisor, `${field}.supervisor`),
    };
  });
  return {
    doc_no: readText(body.doc_no, "doc_no", 100),
    report_date: readDate(body.report_date, "report_date"),
    fertilizer: readText(body.fertilizer, "fertilizer"),
    lot_no: readText(body.lot_no, "lot_no"),
    shift: readText(body.shift, "shift"),
    location: readText(body.location, "location"),
    loader_no: readText(body.loader_no, "loader_no"),
    mix_duration: body.mix_duration === null || body.mix_duration === undefined
      ? null : readPositive(body.mix_duration, "mix_duration"),
    inspector: readText(body.inspector, "inspector", 500, false),
    inspector_date: readDate(body.inspector_date, "inspector_date", false),
    production: readText(body.production, "production", 500, false),
    factory_qa: readText(body.factory_qa, "factory_qa", 500, false),
    materials,
    mix_rounds,
  };
}

type ActiveMaster = {
  id: string;
  kind: "materials" | "units";
  code: string;
  name: string;
  typeId: string;
};

export type MixingCatalogItem = Readonly<{
  material_id: string;
  material_code: string;
  material_name: string;
  unit_id: string;
  unit_code: string;
  unit: string;
  stock_balance: null;
}>;

function masterText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max &&
    value === value.trim() && !value.includes("\0");
}

function activeMaster(value: unknown): ActiveMaster | null {
  const row = asObject(value);
  const p = asObject(row?.payload);
  if (!row || !p || (row.kind !== "materials" && row.kind !== "units") ||
      !masterText(row.id, 200) || !masterText(row.code, 100) ||
      p.id !== row.id || p.kind !== row.kind || p.code !== row.code || p.active !== true ||
      !masterText(p.name, 500)) return null;
  if (row.kind === "materials" && !masterText(p.typeId, 200)) return null;
  if (row.kind === "units" && p.name.length > 100) return null;
  return {
    id: row.id, kind: row.kind, code: row.code, name: p.name,
    typeId: typeof p.typeId === "string" ? p.typeId : "",
  };
}

/** Only active, internally consistent rows with an active linked unit are usable. */
export function buildMixingCatalog(rows: readonly unknown[]): MixingCatalogItem[] {
  const masters = rows.map(activeMaster).filter((row): row is ActiveMaster => row !== null);
  const units = new Map<string, ActiveMaster>();
  const codeCounts = new Map<string, number>();
  for (const row of masters) {
    if (row.kind === "units") units.set(row.id, row);
    else {
      const code = row.code.toLowerCase();
      codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1);
    }
  }
  const result: MixingCatalogItem[] = [];
  for (const row of masters) {
    if (row.kind !== "materials" || codeCounts.get(row.code.toLowerCase()) !== 1) continue;
    const unit = units.get(row.typeId);
    if (!unit) continue;
    result.push({
      material_id: row.id, material_code: row.code, material_name: row.name,
      unit_id: unit.id, unit_code: unit.code, unit: unit.name, stock_balance: null,
    });
  }
  return result;
}

async function loadMixingCatalog(): Promise<MixingCatalogItem[]> {
  return getDevelopmentDatabase().readOnly(async (queries) => {
    const rows = await queries.query(`SELECT id, kind, code, payload
      FROM foliar_fertilizer.settings_masters
      WHERE kind IN ('materials', 'units') ORDER BY kind, code, id`);
    return buildMixingCatalog(rows);
  });
}

/** Header/signers remain report text snapshots; unit references are rebuilt on the server. */
export function verifyMixingMaterials(input: MixingInput, catalog: readonly MixingCatalogItem[]): MixingInput {
  const masterRefs: MasterReferences = {};
  const materials = input.materials.map((row, index) => {
    const matches = catalog.filter((item) => item.material_code === row.material_code);
    const item = matches.length === 1 ? matches[0] : undefined;
    if (!item || row.material_name !== item.material_name ||
        (row.unit !== item.unit && row.unit !== item.unit_code)) {
      return invalid(`materials.${index}.material_code`, INVALID_REFERENCE);
    }
    masterRefs[`unit:${row.id}`] = {
      id: item.unit_id, kind: "units", code: item.unit_code,
      name: item.unit, value: item.unit,
    };
    return {
      id: row.id, material_code: item.material_code, material_name: item.material_name,
      lot_no: row.lot_no, order_qty: row.order_qty, unit: item.unit,
    };
  });
  return { ...input, materials, masterRefs };
}

type MixingServiceDependencies = {
  readUser(): Promise<AuthenticatedFactoryUser | null>;
  getRepository(): ReturnType<typeof getMixingRepository>;
  loadCatalog(): Promise<readonly MixingCatalogItem[]>;
};

export function createMixingService(deps: MixingServiceDependencies) {
  async function requireUser(): Promise<MixingActor> {
    const user = await deps.readUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    requireFactoryModule(user, "fertilizer_powder_mixing");
    requireFactoryRole(user, "factory_admin");
    return { id: user.id, displayName: user.displayName };
  }

  return {
    async list() {
      await requireUser();
      return deps.getRepository().list();
    },
    async get(id: unknown) {
      await requireUser();
      const documentId = readDocumentId(id);
      return deps.getRepository().get(documentId);
    },
    async catalog() {
      await requireUser();
      return deps.loadCatalog();
    },
    async create(payload: unknown) {
      const actor = await requireUser();
      const input = parseMixingInput(payload);
      const validated = verifyMixingMaterials(input, await deps.loadCatalog());
      return deps.getRepository().create(validated, actor);
    },
    async update(id: unknown, payload: unknown) {
      const actor = await requireUser();
      const documentId = readDocumentId(id);
      const body = readObject(payload);
      const version = readVersion(body.version);
      const input = parseMixingInput(body);
      const validated = verifyMixingMaterials(input, await deps.loadCatalog());
      return deps.getRepository().update(documentId, version, validated, actor);
    },
    async archive(id: unknown, payload: unknown) {
      const actor = await requireUser();
      const documentId = readDocumentId(id);
      const version = readVersion(readObject(payload).version);
      await deps.getRepository().archive(documentId, version, actor);
    },
  };
}

export const mixingService = createMixingService({
  readUser: readCurrentFactoryUser,
  getRepository: getMixingRepository,
  loadCatalog: loadMixingCatalog,
});