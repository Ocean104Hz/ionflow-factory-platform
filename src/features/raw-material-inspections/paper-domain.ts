export const paperChecks = [
  { key: "weight", label: "น้ำหนัก" },
  { key: "contamination", label: "สิ่งปนเปื้อน" },
  { key: "physical", label: "กายภาพ" },
  { key: "color", label: "สี" },
] as const;

export const paperResults = [
  { value: "pass", symbol: "/", label: "ผ่าน" },
  { value: "acceptable", symbol: "O", label: "ยอมรับได้" },
  { value: "fail", symbol: "X", label: "ไม่ผ่าน" },
] as const;

export type PaperResult = "" | (typeof paperResults)[number]["value"];
export type PaperCheck = (typeof paperChecks)[number]["key"];
export type PaperField = "materialCode" | "supplierCode" | "quantity" | "unit" | "note";
export type PaperRow = Record<PaperField, string> & Record<PaperCheck, PaperResult>;

export function blankPaperRows(): PaperRow[] {
  return Array.from({ length: 10 }, () => ({
    materialCode: "", supplierCode: "", quantity: "", unit: "", note: "",
    weight: "", contamination: "", physical: "", color: "",
  }));
}

export function isPaperResult(value: string): value is PaperResult {
  return value === "" || paperResults.some((result) => result.value === value);
}

export function updatePaperRow<K extends keyof PaperRow>(
  rows: PaperRow[], index: number, key: K, value: PaperRow[K],
): PaperRow[] {
  return rows.map((row, i) => i === index ? { ...row, [key]: value } : row);
}

export type PaperLine = PaperRow & { lineNo: number };
export type PaperInput = { date: string; number: string; lines: PaperLine[] };
export type PaperRecord = PaperInput & { id: string; version: string };
export class PaperValidationError extends Error {}
export class PaperConflictError extends Error {}
const textFields = ["materialCode", "supplierCode", "quantity", "unit", "note"] as const;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PaperValidationError("รูปแบบข้อมูลไม่ถูกต้อง");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || value.length > max || value.includes("\0")) throw new PaperValidationError(`${label} ไม่ถูกต้อง`);
  return value.trim();
}
function dateString(value: unknown): string {
  const v = text(value, 10, "วันที่");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v.startsWith("0000")) throw new PaperValidationError("วันที่ไม่ถูกต้อง");
  const date = new Date(`${v}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== v) throw new PaperValidationError("วันที่ไม่ถูกต้อง");
  return v;
}
export function validatePaperInput(payload: unknown): PaperInput {
  const body = object(payload);
  const number = text(body.number, 100, "เอกสารเลขที่");
  if (!number) throw new PaperValidationError("กรุณาระบุเอกสารเลขที่");
  const date = dateString(body.date);
  if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 10) throw new PaperValidationError("กรุณาระบุวัตถุดิบ 1–10 รายการ");
  const seen = new Set<number>();
  const lines = body.lines.map((value: unknown): PaperLine => {
    const r = object(value);
    const lineNo = r.lineNo;
    if (typeof lineNo !== "number" || !Number.isInteger(lineNo) || lineNo < 1 || lineNo > 10 || seen.has(lineNo)) throw new PaperValidationError("ลำดับรายการไม่ถูกต้องหรือซ้ำ");
    seen.add(lineNo);
    const label = `แถว ${lineNo}`;
    const row = blankPaperRows()[0];
    for (const key of textFields) row[key] = text(r[key], key === "note" ? 1000 : key === "unit" ? 50 : key === "quantity" ? 19 : 100, label);
    if (!row.materialCode || !row.supplierCode || !row.unit) throw new PaperValidationError(`${label}: กรุณาระบุรหัสวัตถุดิบ รหัส Supplier และหน่วย`);
    if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(row.quantity) || Number(row.quantity) <= 0) throw new PaperValidationError(`${label}: จำนวนต้องมากกว่า 0 (ทศนิยมไม่เกิน 6 ตำแหน่ง)`);
    for (const { key, label: checkLabel } of paperChecks) {
      const result = r[key];
      if (typeof result !== "string" || !isPaperResult(result) || result === "") throw new PaperValidationError(`${label}: กรุณาเลือกผลตรวจ ${checkLabel}`);
      row[key] = result;
    }
    return { ...row, lineNo };
  });
  return { date, number, lines: lines.sort((a,b) => a.lineNo-b.lineNo) };
}
export function buildPaperInput(date: string, number: string, rows: PaperRow[]): PaperInput {
  if (rows.length !== 10) throw new PaperValidationError("จำนวนแถวไม่ถูกต้อง");
  return validatePaperInput({ date, number, lines: rows.map((row,i) => ({...row,lineNo:i+1})).filter(row => [...textFields,...paperChecks.map(c=>c.key)].some(key => row[key].trim() !== "")) });
}
export function rowsFromPaper(record: PaperRecord): PaperRow[] {
  const rows = blankPaperRows();
  for (const { lineNo, ...row } of record.lines) rows[lineNo-1] = row;
  return rows;
}
export function paperStatus(lines: PaperLine[]): string {
  const results = lines.flatMap(row => paperChecks.map(({key}) => row[key]));
  return results.includes("fail") ? "ไม่ผ่าน" : results.includes("acceptable") ? "ยอมรับได้" : "ผ่าน";
}
export function validatePaperIdentity(id: unknown, version: unknown): { id: string; version: string } {
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || typeof version !== "string" || !/^[1-9]\d{0,18}$/.test(version) || BigInt(version) >= BigInt("9223372036854775807")) throw new PaperValidationError("รหัสหรือ Version เอกสารไม่ถูกต้อง");
  return {id,version};
}
