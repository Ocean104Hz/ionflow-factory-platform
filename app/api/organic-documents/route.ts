import { NextResponse, type NextRequest } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { OrganicDocumentError, organicSheets, readOrganicDocuments, writeOrganicDocument, type OrganicKind } from "@/src/server/organic-documents.ts";

const headers = { "Cache-Control": "no-store" };
const maxBody = 256_000;

async function access(request: NextRequest) {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (!kind || !Object.hasOwn(organicSheets, kind)) throw new OrganicDocumentError(400, "ไม่พบประเภทเอกสารชุดอินทรีย์");
  return { user, kind: kind as OrganicKind };
}

function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  const known = error instanceof OrganicDocumentError;
  if (!known) console.error("Organic document request failed", error);
  return NextResponse.json({ ok: false, message: known ? error.message : "เชื่อมต่อข้อมูลชุดอินทรีย์ไม่สำเร็จ" },
    { status: known ? error.status : 503, headers });
}

export async function GET(request: NextRequest) {
  try {
    const { user, kind } = await access(request);
    const data = await readOrganicDocuments(user, kind);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBody);
    assertCsrf(request);
    const { user, kind } = await access(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBody) throw new OrganicDocumentError(413, "เอกสารมีขนาดเกินกำหนด");
    let command: unknown;
    try { command = JSON.parse(raw); } catch { throw new OrganicDocumentError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    const data = await writeOrganicDocument(user, kind, command);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) { return failure(error); }
}
