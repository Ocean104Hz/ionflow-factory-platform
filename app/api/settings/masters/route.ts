import { NextResponse, type NextRequest } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError, requireFactoryRole } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { readFactoryMasters, readFactoryPersonnel, saveFactoryMaster } from "@/src/server/factory-masters.ts";
import { SettingsError } from "@/src/server/settings-postgres.ts";

const headers = { "Cache-Control": "no-store" };

async function requireUser() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  return user;
}

function settingsFailure(error: unknown) {
  if (error instanceof FactoryAuthError && error.status < 500) return authErrorResponse(error);
  return NextResponse.json(
    { ok: false, error: error instanceof SettingsError ? error.message : "เปิดข้อมูลหลักไม่สำเร็จ กรุณาตรวจการเชื่อมต่อและ migration" },
    { status: error instanceof SettingsError ? error.status : 503, headers },
  );
}

export async function GET() {
  try {
    await requireUser();
    const [data, personnel] = await Promise.all([readFactoryMasters(), readFactoryPersonnel()]);
    return NextResponse.json({ ok: true, data: { ...data, personnel } }, { headers });
  } catch (error) {
    return settingsFailure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    requireFactoryRole(await requireUser(), "factory_admin");
    const input = await request.json().catch(() => null);
    const data = await saveFactoryMaster(input?.row, input?.expectedVersion);
    return NextResponse.json({ ok: true, data: { ...data, personnel: await readFactoryPersonnel() } }, { headers });
  } catch (error) {
    return settingsFailure(error);
  }
}
