import { NextResponse, type NextRequest } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { productionModules, ProductionError, readProduction, saveProduction, type ProductionArea } from "@/src/server/production-v1.ts";

const headers = { "Cache-Control": "no-store" };
async function input(request: NextRequest) {
  const area = request.nextUrl.searchParams.get("area");
  if (!area || !Object.hasOwn(productionModules, area)) throw new ProductionError(400, "ไม่พบประเภทเอกสาร");
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  return { user, area: area as ProductionArea };
}
function failure(error: unknown) {
  if (error instanceof FactoryAuthError && error.status < 500) return authErrorResponse(error);
  const known = error instanceof ProductionError;
  return NextResponse.json({ ok: false, message: known ? error.message : "เปิดหรือบันทึกข้อมูลการผลิตไม่สำเร็จ" },
    { status: known ? error.status : 503, headers });
}
export async function GET(request: NextRequest) {
  try {
    const { user, area } = await input(request);
    return NextResponse.json({ ok: true, data: await readProduction(user, area) }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, 512_000);
    assertCsrf(request);
    const { user, area } = await input(request);
    const raw = await request.text();
    if (raw.length > 512_000) throw new ProductionError(413, "ขนาดเอกสารเกินกำหนด");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new ProductionError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    return NextResponse.json({ ok: true, data: await saveProduction(user, area, body) }, { headers });
  } catch (error) { return failure(error); }
}
