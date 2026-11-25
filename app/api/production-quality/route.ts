import { NextResponse, type NextRequest } from "next/server";
import { FactoryAuthError } from "@/src/server/auth/auth-service";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { BackendError } from "@/src/server/database/config";
import { QualityValidationError } from "@/src/features/production-quality/production-quality-contract";
import { QualityConflictError } from "@/src/server/production-quality/quality-repository";
import { qualityService } from "@/src/server/production-quality/quality-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 4_000_000;
function response(data: unknown, status = 200) { return NextResponse.json({ok:true,data},{status,headers:{"Cache-Control":"no-store"}}); }
function fail(message: string,status: number,field?: string) { return NextResponse.json({ok:false,message,...(field ? {field} : {})},{status,headers:{"Cache-Control":"no-store"}}); }
function error(e: unknown) {
  if (e instanceof FactoryAuthError) return authErrorResponse(e);
  if (e instanceof QualityValidationError) return fail(e.message,400,e.field);
  if (e instanceof QualityConflictError) return fail(e.message,409);
  if (typeof e === "object" && e !== null && "code" in e && e.code === "23505") return fail("เลขที่เอกสารซ้ำในโรงงานนี้",409,"documentNumber");
  if (e instanceof BackendError) { console.error("PRODUCTION_QUALITY_DB_FAILED",e.code); return fail("ระบบฐานข้อมูลไม่พร้อมใช้งาน",503); }
  console.error("PRODUCTION_QUALITY_REQUEST_FAILED");
  return fail("ไม่สามารถดำเนินการได้",500);
}
function id(request: NextRequest) {
  const values=request.nextUrl.searchParams.getAll("id");
  if (values.length !== 1) throw new QualityValidationError("id");
  return values[0];
}
async function body(request: NextRequest): Promise<unknown> {
  assertTrustedAuthRequest(request); assertCsrf(request);
  const type=request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (type !== "application/json" || !request.body) throw new QualityValidationError("body");
  const reader=request.body.getReader(); const chunks: Uint8Array[]=[]; let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read(); if (done) break;
      size+=value.byteLength;
      if (size>MAX_BODY_BYTES) { await reader.cancel().catch(()=>undefined); throw new QualityValidationError("body","ข้อมูลมีขนาดใหญ่เกินกำหนด"); }
      chunks.push(value);
    }
    const value: unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks,size)));
    return value;
  } catch(e) { if (e instanceof QualityValidationError) throw e; throw new QualityValidationError("body"); }
  finally { reader.releaseLock(); }
}
export async function GET(request: NextRequest) {
  try {
    if (!request.nextUrl.searchParams.has("id")) return response(await qualityService.list());
    const record=await qualityService.get(id(request));
    return record ? response(record) : fail("ไม่พบเอกสาร",404);
  } catch(e) { return error(e); }
}
export async function POST(request: NextRequest) {
  try { return response(await qualityService.create(await body(request)),201); } catch(e) { return error(e); }
}
export async function PUT(request: NextRequest) {
  try { return response(await qualityService.update(id(request),await body(request))); } catch(e) { return error(e); }
}
export async function DELETE(request: NextRequest) {
  try { const documentId=id(request); await qualityService.archive(documentId,await body(request)); return response({id:documentId}); } catch(e) { return error(e); }
}
