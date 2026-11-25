import { NextResponse, type NextRequest } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { PackagingError, readPackaging, writePackaging, type PackagingKind } from "@/src/server/packaging-documents.ts";

const headers = { "Cache-Control": "no-store" };
const maxBody = 512_000;

async function access(request: NextRequest): Promise<{ user: NonNullable<Awaited<ReturnType<typeof readCurrentFactoryUser>>>; kind: PackagingKind }> {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "packaging_report" && kind !== "packing_summary") throw new PackagingError(400, "ไม่พบประเภทเอกสารบรรจุ");
  return { user, kind };
}

function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  const known = error instanceof PackagingError;
  if (!known) console.error("Packaging document request failed", error);
  return NextResponse.json({ ok: false, message: known ? error.message : "เชื่อมต่อข้อมูลบรรจุสินค้าไม่สำเร็จ" },
    { status: known ? error.status : 503, headers });
}

export async function GET(request: NextRequest) {
  try {
    const { user, kind } = await access(request);
    return NextResponse.json({ ok: true, data: await readPackaging(user, kind) }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBody);
    assertCsrf(request);
    const { user, kind } = await access(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBody) throw new PackagingError(413, "เอกสารมีขนาดเกินกำหนด");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new PackagingError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    return NextResponse.json({ ok: true, data: await writePackaging(user, kind, body) }, { headers });
  } catch (error) { return failure(error); }
}
