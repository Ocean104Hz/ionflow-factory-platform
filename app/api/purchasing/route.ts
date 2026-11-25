import { NextResponse, type NextRequest } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { mutatePurchasing, PurchasingError, readPurchasing } from "@/src/server/purchasing.ts";

const headers = { "Cache-Control": "no-store" };

async function session() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  return user;
}

function failure(error: unknown) {
  if (error instanceof FactoryAuthError && error.status !== 503) return authErrorResponse(error);
  return NextResponse.json({
    ok: false,
    message: error instanceof PurchasingError ? error.message : "ระบบจัดซื้อไม่พร้อมใช้งาน กรุณาตรวจการเชื่อมต่อฐานข้อมูล",
  }, { status: error instanceof PurchasingError ? error.status : 503, headers });
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...await readPurchasing(await session()) }, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, 512_000);
    assertCsrf(request);
    const user = await session();
    const raw = await request.text();
    if (raw.length > 512_000) throw new PurchasingError(413, "ขนาดข้อมูลเอกสารเกินกำหนด");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new PurchasingError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    return NextResponse.json({ ok: true, ...await mutatePurchasing(user, body) }, { headers });
  } catch (error) {
    return failure(error);
  }
}
