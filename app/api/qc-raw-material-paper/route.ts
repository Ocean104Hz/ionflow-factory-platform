import { NextResponse, type NextRequest } from "next/server";
import { FactoryAuthError, requireFactoryModule, requireFactoryRole } from "@/src/server/auth/auth-service";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { BackendError } from "@/src/server/database/config";
import { PaperValidationError, PaperConflictError, validatePaperInput, validatePaperIdentity } from "@/src/features/raw-material-inspections/paper-domain";
import { listPaperRecords, createPaperRecord, updatePaperRecord, archivePaperRecord } from "@/src/server/raw-material-inspections/paper-repository";

function reply(data: unknown,status=200) { return NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}}); }
async function authorized() {
  const user=await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS",401);
  requireFactoryModule(user,"qc_raw_material");
  requireFactoryRole(user,"factory_admin");
  return {id:user.id,displayName:user.displayName};
}
function errorResponse(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof PaperValidationError) return reply({ok:false,message:error.message},400);
  if (error instanceof PaperConflictError) return reply({ok:false,message:error.message},409);
  if (typeof error==="object" && error!==null && "code" in error && error.code==="23505") return reply({ok:false,message:"เลขที่เอกสารซ้ำ กรุณาตรวจสอบ"},409);
  if (error instanceof BackendError) return reply({ok:false,message:"ฐานข้อมูลยังไม่พร้อม กรุณาตรวจสอบ Migration"},503);
  console.error("QC_RECEIVING_SHEET_REQUEST_FAILED");
  return reply({ok:false,message:"ไม่สามารถดำเนินการกับเอกสารได้"},500);
}
async function readBody(request: NextRequest): Promise<Record<string,unknown>> {
  assertTrustedAuthRequest(request);
  assertCsrf(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json") throw new PaperValidationError("รูปแบบข้อมูลไม่ถูกต้อง");
  const limit=80_000;
  if (Number(request.headers.get("content-length"))>limit || !request.body) throw new PaperValidationError("ข้อมูลมีขนาดเกินกำหนดหรือไม่ถูกต้อง");
  const reader=request.body.getReader();
  const decoder=new TextDecoder("utf-8",{fatal:true});
  let bytes=0,raw="";
  try {
    while(true) {
      const {done,value}=await reader.read();
      if (done) break;
      bytes+=value.byteLength;
      if(bytes>limit) { await reader.cancel(); throw new PaperValidationError("ข้อมูลมีขนาดเกินกำหนด"); }
      raw+=decoder.decode(value,{stream:true});
    }
    raw+=decoder.decode();
    const value: unknown=JSON.parse(raw);
    if(!value || typeof value!=="object" || Array.isArray(value)) throw new Error("Invalid object");
    return value as Record<string,unknown>;
  } catch(error) {
    if(error instanceof PaperValidationError) throw error;
    throw new PaperValidationError("รูปแบบข้อมูลไม่ถูกต้อง");
  } finally { reader.releaseLock(); }
}
export async function GET() {
  try { await authorized(); return reply({ok:true,data:await listPaperRecords()}); } catch(error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const actor=await authorized(); const input=validatePaperInput(await readBody(request)); return reply({ok:true,data:await createPaperRecord(input,actor)},201); } catch(error) { return errorResponse(error); }
}
export async function PUT(request: NextRequest) {
  try { const actor=await authorized(); const body=await readBody(request); const {id,version}=validatePaperIdentity(request.nextUrl.searchParams.get("id"),body.version); return reply({ok:true,data:await updatePaperRecord(id,version,validatePaperInput(body),actor)}); } catch(error) { return errorResponse(error); }
}
export async function DELETE(request: NextRequest) {
  try { const actor=await authorized(); const body=await readBody(request); const {id,version}=validatePaperIdentity(request.nextUrl.searchParams.get("id"),body.version); await archivePaperRecord(id,version,actor); return reply({ok:true,data:{id}}); } catch(error) { return errorResponse(error); }
}
