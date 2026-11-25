import { type NextRequest, NextResponse } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { FactoryAuthError, requireFactoryModule } from "@/src/server/auth/auth-service";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { readHubJson } from "@/src/server/sales-hub/contract";
import { HubIntegrationError } from "@/src/server/sales-hub/errors";
import { changeHubProduction, readHubOrders } from "@/src/server/sales-hub/production";

const headers = { "Cache-Control": "no-store" };
async function access() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  requireFactoryModule(user, "production_orders");
  return user;
}

function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  const known = error instanceof HubIntegrationError;
  if (!known) console.error("Could not load or update Hub production orders", error);
  return NextResponse.json({ ok: false, error: known ? error.message : "เชื่อมข้อมูลคำสั่งผลิตจาก Sales Hub ไม่สำเร็จ" },
    { headers, status: known ? error.status : 503 });
}

export async function GET() {
  try {
    await access();
    return NextResponse.json({ ok: true, data: await readHubOrders() }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, 8192);
    assertCsrf(request);
    const user = await access();
    await changeHubProduction(await readHubJson(request, 8192), user.email);
    return NextResponse.json({ ok: true, data: await readHubOrders() }, { headers });
  } catch (error) { return failure(error); }
}
