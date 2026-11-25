import {
  metrics, timeSlots, signerRoles, validateInspection,
  type Inspection, type Metric, type Reading, type Slot,
} from "./production-quality-domain";

export type QualityInput = Omit<Inspection, "id" | "createdAt" | "updatedAt" | "version">;
export type QualityRecord = Inspection & { version: string };
export const inputFields = ["profileId", "inspectionDate", "documentNumber", "productionSite", "productionLine", "recordStatus", "disposition", "formulas", "readings", "machineStart", "workStart", "workStop", "stops", "signers", "notes"] as const satisfies readonly (keyof QualityInput)[];
export const signerCodes = ["inspector", "supervisor", "production", "factory_qa"] as const;
export class QualityValidationError extends Error {
  constructor(public readonly field: string, message = "ข้อมูลไม่ถูกต้อง") {
    super(message);
    this.name = "QualityValidationError";
  }
}
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(field: string): never { throw new QualityValidationError(field); }
export function object(value: unknown, field: string): Record<string, unknown> {
  if (!isObject(value)) return invalid(field);
  return value;
}
function str(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string" || value.length > max || value.includes("\0")) return invalid(field);
  return value;
}
function key(value: unknown, field: string): string {
  const v = str(value, field, 100);
  if (!v.trim()) return invalid(field);
  return v;
}
function rows(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) return invalid(field);
  return value;
}
function slot(value: unknown, field: string): Slot {
  const found = timeSlots.find((s) => s === value);
  if (!found) return invalid(field);
  return found;
}
function optionalSlot(value: unknown, field: string): Slot | "" {
  return value === "" ? "" : slot(value, field);
}
export function readId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return invalid("id");
  return value;
}
export function readVersion(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > BigInt("9223372036854775807")) return invalid("version");
  return value;
}
function readCell(value: unknown, metric: Metric, field: string): Reading {
  const cell = object(value, field);
  if (cell.kind !== metric.kind) return invalid(field);
  const note = str(cell.note, field, 2000);
  if (metric.kind === "boolean") {
    if (cell.value !== null && typeof cell.value !== "boolean") return invalid(field);
    return { kind: "boolean", value: cell.value, note };
  }
  if (metric.kind === "temperature") {
    const points = rows(cell.value, field, metric.points);
    if (points.length !== metric.points) return invalid(field);
    return { kind: "temperature", value: points.map((v) => str(v, field, 40)), note };
  }
  return { kind: metric.kind, value: str(cell.value, field, 100), note };
}
export function parseQualityInput(value: unknown): QualityInput {
  const b = object(value, "body");
  if (b.profileId !== "ITECH" && b.profileId !== "IFOAM") return invalid("profileId");
  if (b.recordStatus !== "DRAFT" && b.recordStatus !== "RECORDED") return invalid("recordStatus");
  if (b.disposition !== "NOT_EVALUATED") return invalid("disposition");
  const readings: Inspection["readings"] = {};
  for (const [id, series] of Object.entries(object(b.readings, "readings"))) {
    const metric = metrics.find((m) => m.id === id);
    if (!metric) return invalid("readings");
    const cells: Partial<Record<Slot, Reading>> = {};
    for (const [time, raw] of Object.entries(object(series, id))) {
      const s = slot(time, id);
      cells[s] = readCell(raw, metric, `${id}.${s}`);
    }
    readings[metric.id] = cells;
  }
  const input: QualityInput = {
    profileId: b.profileId, recordStatus: b.recordStatus, disposition: b.disposition,
    inspectionDate: str(b.inspectionDate, "inspectionDate", 10),
    documentNumber: str(b.documentNumber, "documentNumber", 100).trim(),
    productionSite: str(b.productionSite, "productionSite").trim(),
    productionLine: str(b.productionLine, "productionLine", 20),
    machineStart: str(b.machineStart, "machineStart", 5),
    workStart: str(b.workStart, "workStart", 5),
    workStop: str(b.workStop, "workStop", 5),
    notes: str(b.notes, "notes", 10000), readings,
    formulas: rows(b.formulas, "formulas", 200).map((raw) => {
      const f = object(raw, "formulas");
      const extraSlots = rows(f.extraSlots, "extraSlots", timeSlots.length).map((s) => slot(s, "extraSlots"));
      if (new Set(extraSlots).size !== extraSlots.length) return invalid("extraSlots");
      return { id: key(f.id, "formulas.id"), formulaName: str(f.formulaName, "formulaName").trim(), lotCode: str(f.lotCode, "lotCode").trim(), startTime: optionalSlot(f.startTime, "startTime"), endTime: optionalSlot(f.endTime, "endTime"), extraSlots };
    }),
    stops: rows(b.stops, "stops", 200).map((raw) => {
      const s = object(raw, "stops");
      return { id: key(s.id, "stops.id"), stop: str(s.stop, "stop", 5), restart: str(s.restart, "restart", 5), reason: str(s.reason, "reason", 2000).trim() };
    }),
    signers: rows(b.signers, "signers", signerRoles.length).map((raw) => {
      const s = object(raw, "signers");
      const role = signerRoles.find((r) => r === s.role);
      if (!role) return invalid("signers.role");
      return { role, name: str(s.name, "signers.name").trim(), date: str(s.date, "signers.date", 10) };
    }),
  };
  // Fixed signer ordering regardless of incoming order.
  input.signers.sort((a, b) => signerRoles.indexOf(a.role) - signerRoles.indexOf(b.role));
  const errors = validateInspection({ ...input, id: "", createdAt: "", updatedAt: "" }, []);
  const first = Object.entries(errors)[0];
  if (first) throw new QualityValidationError(first[0], first[1]);
  return input;
}
export function toQualityInput(row: Inspection): QualityInput {
  return parseQualityInput(row);
}
export function parseQualityRecord(value: unknown): QualityRecord {
  const b = object(value, "record");
  const stamp = (v: unknown) => {
    const s = str(v, "timestamp", 50);
    if (!Number.isFinite(Date.parse(s))) return invalid("timestamp");
    return new Date(s).toISOString();
  };
  return { ...parseQualityInput(b), id: readId(b.id), version: readVersion(b.version), createdAt: stamp(b.createdAt), updatedAt: stamp(b.updatedAt) };
}
