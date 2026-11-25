import { type NextRequest, NextResponse } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { FactoryAuthError } from "@/src/server/auth/auth-service";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { QcError, qcKinds, readQcDocuments, writeQcDocument, type QcKind } from "@/src/server/qc-documents";

const headers = { "Cache-Control": "no-store" };
const maxBytes = 512 * 1024;

async function scopedRequest(request: NextRequest) {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (!kind || !Object.hasOwn(qcKinds, kind)) throw new QcError(404, "ไม่พบแบบฟอร์ม QC");
  return { user, kind: kind as QcKind };
}
function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  const known = error instanceof QcError;
  if (!known) console.error("QC document request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ ok: false, message: known ? error.message : "เชื่อมฐานข้อมูล QC ไม่สำเร็จ กรุณาลองใหม่" },
    { headers, status: known ? error.status : 503 });
}
export async function GET(request: NextRequest) {
  try {
    const { user, kind } = await scopedRequest(request);
    return NextResponse.json({ ok: true, data: await readQcDocuments(user, kind) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBytes);
    assertCsrf(request);
    const { user, kind } = await scopedRequest(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) throw new QcError(413, "เอกสารมีขนาดเกินกำหนด");
    let body: unknown;
    try { body = JSON.parse(raw); }
    catch { throw new QcError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    return NextResponse.json({ ok: true, data: await writeQcDocument(user, kind, body) }, { headers });
  } catch (error) { return failure(error); }
}
