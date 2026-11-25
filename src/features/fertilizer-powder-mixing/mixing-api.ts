/** Client contract for app/api/fertilizer-powder-mixing/route.ts (branch nan). */
export type MixingMaterialInput = {
  id: string;
  material_code: string;
  material_name: string;
  lot_no: string;
  order_qty: number;
  unit: string;
};
export type MixingRoundInput = {
  id: string;
  round_date: string;
  shift: string;
  loader_load_count: string;
  is_pass: boolean | null;
  operator_mixer: string;
  supervisor: string;
};
export type MixingInput = {
  doc_no: string;
  report_date: string;
  fertilizer: string;
  lot_no: string;
  shift: string;
  location: string;
  loader_no: string;
  mix_duration: number | null;
  inspector: string;
  inspector_date: string;
  production: string;
  factory_qa: string;
  materials: MixingMaterialInput[];
  mix_rounds: MixingRoundInput[];
};
export type MixingApiRecord = Omit<MixingInput, "materials"> & {
  id: string;
  version: string;
  created_at: string;
  updated_at: string;
  updated_by: string;
  masterRefs: Record<string, unknown>;
  materials: (MixingMaterialInput & { stock_balance: number | null })[];
};
export type MixingCatalogItem = {
  material_id: string;
  material_code: string;
  material_name: string;
  unit_id: string;
  unit_code: string;
  unit: string;
  stock_balance: null;
};
export class MixingApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly field?: string) {
    super(message);
    this.name = "MixingApiError";
  }
}
const endpoint = "/api/fertilizer-powder-mixing";
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function strings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === "string");
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function nullableNumber(value: unknown): boolean {
  return value === null || finite(value);
}
function validVersion(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
}
function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function isRecord(value: unknown): value is MixingApiRecord {
  return isObject(value) && validId(value.id) && validVersion(value.version) &&
    strings(value, ["doc_no", "report_date", "fertilizer", "lot_no", "shift", "location", "loader_no", "inspector", "inspector_date", "production", "factory_qa", "created_at", "updated_at", "updated_by"]) &&
    nullableNumber(value.mix_duration) && isObject(value.masterRefs) &&
    Array.isArray(value.materials) && value.materials.every((row: unknown) =>
      isObject(row) && strings(row, ["id", "material_code", "material_name", "lot_no", "unit"]) && finite(row.order_qty) && nullableNumber(row.stock_balance)) &&
    Array.isArray(value.mix_rounds) && value.mix_rounds.every((row: unknown) =>
      isObject(row) && strings(row, ["id", "round_date", "shift", "loader_load_count", "operator_mixer", "supervisor"]) && (row.is_pass === null || typeof row.is_pass === "boolean"));
}
function isCatalog(value: unknown): value is MixingCatalogItem {
  return isObject(value) && strings(value, ["material_id", "material_code", "material_name", "unit_id", "unit_code", "unit"]) && value.stock_balance === null;
}
function isRecordList(value: unknown): value is MixingApiRecord[] {
  return Array.isArray(value) && value.every(isRecord);
}
function isCatalogList(value: unknown): value is MixingCatalogItem[] {
  return Array.isArray(value) && value.every(isCatalog);
}
function failResponse(response: Response, body: unknown): never {
  const message = isObject(body) && typeof body.message === "string" && body.message.trim()
    ? body.message : `API request failed (${response.status})`;
  const field = isObject(body) && typeof body.field === "string" ? body.field : undefined;
  throw new MixingApiError(message, response.status, field);
}
async function readJson(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    throw new MixingApiError("Invalid API response", response.status);
  }
}
async function request<T>(url: string, guard: (value: unknown) => value is T, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isObject(body) || body.ok !== true) failResponse(response, body);
  if (!guard(body.data)) throw new MixingApiError("Invalid mixing data", response.status);
  return body.data;
}
async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  const body = await readJson(response);
  if (!response.ok || !isObject(body) || body.ok !== true || typeof body.csrfToken !== "string" || !body.csrfToken) failResponse(response, body);
  return body.csrfToken;
}
// Serializes writes within this client instance so issuing a new CSRF cookie
// cannot invalidate another in-flight write from this module.
let writeTail: Promise<void> = Promise.resolve();
function write<T>(url: string, method: "POST" | "PUT" | "DELETE", payload: object, guard: (value: unknown) => value is T): Promise<T> {
  const job = writeTail.then(async () => {
    const csrfToken = await getCsrfToken();
    return request(url, guard, {
      method,
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(payload),
    });
  });
  writeTail = job.then(() => undefined, () => undefined);
  return job;
}
function idUrl(id: string): string {
  if (!validId(id)) throw new MixingApiError("Invalid report ID", 400, "id");
  return `${endpoint}?id=${encodeURIComponent(id)}`;
}
function requireVersion(version: string): void {
  if (!validVersion(version)) throw new MixingApiError("Invalid report version", 400, "version");
}
/** Explicit allowlist: never send stock balances, IDs for the header, or audit fields. */
export function toMixingInput(row: MixingInput): MixingInput {
  return {
    doc_no: row.doc_no, report_date: row.report_date, fertilizer: row.fertilizer,
    lot_no: row.lot_no, shift: row.shift, location: row.location, loader_no: row.loader_no,
    mix_duration: row.mix_duration, inspector: row.inspector, inspector_date: row.inspector_date,
    production: row.production, factory_qa: row.factory_qa,
    materials: row.materials.map(({ id, material_code, material_name, lot_no, order_qty, unit }) => ({ id, material_code, material_name, lot_no, order_qty, unit })),
    mix_rounds: row.mix_rounds.map(({ id, round_date, shift, loader_load_count, is_pass, operator_mixer, supervisor }) => ({ id, round_date, shift, loader_load_count, is_pass, operator_mixer, supervisor })),
  };
}
export const mixingApi = {
  list(signal?: AbortSignal): Promise<MixingApiRecord[]> {
    return request(endpoint, isRecordList, { signal });
  },
  get(id: string, signal?: AbortSignal): Promise<MixingApiRecord> {
    return request(idUrl(id), isRecord, { signal });
  },
  catalog(signal?: AbortSignal): Promise<MixingCatalogItem[]> {
    return request(`${endpoint}?catalog=1`, isCatalogList, { signal });
  },
  create(row: MixingInput): Promise<MixingApiRecord> {
    return write(endpoint, "POST", toMixingInput(row), isRecord);
  },
  update(id: string, version: string, row: MixingInput): Promise<MixingApiRecord> {
    requireVersion(version);
    return write(idUrl(id), "PUT", { ...toMixingInput(row), version }, isRecord);
  },
  archive(id: string, version: string): Promise<{ id: string }> {
    requireVersion(version);
    return write(idUrl(id), "DELETE", { version }, (value): value is { id: string } => isObject(value) && value.id === id);
  },
};
