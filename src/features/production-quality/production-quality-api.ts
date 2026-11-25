import type { Inspection } from "./production-quality-domain";
import { isObject, parseQualityRecord, readId, readVersion, toQualityInput, type QualityRecord } from "./production-quality-contract";
const endpoint="/api/production-quality";
async function json(response: Response): Promise<unknown> {
  try { const b: unknown=await response.json(); return b; }
  catch { throw new Error(`ไม่สามารถอ่านข้อมูลจากระบบ (${response.status})`); }
}
function failed(response: Response, b: unknown): never {
  throw new Error(isObject(b) && typeof b.message === "string" && b.message ? b.message : `ไม่สามารถดำเนินการได้ (${response.status})`);
}
async function request(url: string,init?: RequestInit): Promise<unknown> {
  const res=await fetch(url,{...init,credentials:"same-origin",cache:"no-store"});
  const b=await json(res);
  if (!res.ok || !isObject(b) || b.ok !== true) return failed(res,b);
  return b.data;
}
async function csrf(): Promise<string> {
  const res=await fetch("/api/auth/csrf",{credentials:"same-origin",cache:"no-store"});
  const b=await json(res);
  if (!res.ok || !isObject(b) || b.ok !== true || typeof b.csrfToken !== "string" || !b.csrfToken) return failed(res,b);
  return b.csrfToken;
}
let tail: Promise<void>=Promise.resolve();
function write(url: string,method: "POST"|"PUT"|"DELETE",payload: object): Promise<unknown> {
  const job=tail.then(async()=>request(url,{method,headers:{"Content-Type":"application/json","x-csrf-token":await csrf()},body:JSON.stringify(payload)}));
  tail=job.then(()=>undefined,()=>undefined); return job;
}
function url(id: string) { return `${endpoint}?id=${encodeURIComponent(readId(id))}`; }
export const qualityApi={
  async list(signal?: AbortSignal): Promise<QualityRecord[]> {
    const result=await request(endpoint,{signal});
    if (!Array.isArray(result)) throw new Error("ข้อมูลเอกสารจากระบบไม่ถูกต้อง");
    return result.map(parseQualityRecord);
  },
  async get(id: string): Promise<QualityRecord> { return parseQualityRecord(await request(url(id))); },
  async save(row: Inspection): Promise<QualityRecord> {
    const input=toQualityInput(row);
    return parseQualityRecord(await (row.id ? write(url(row.id),"PUT",{...input,version:readVersion(row.version)}) : write(endpoint,"POST",input)));
  },
  async archive(row: Inspection): Promise<void> {
    const result=await write(url(row.id),"DELETE",{version:readVersion(row.version)});
    if (!isObject(result) || result.id !== row.id) throw new Error("ผลการลบจากระบบไม่ถูกต้อง");
  },
};
