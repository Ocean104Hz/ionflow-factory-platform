import { NextResponse, type NextRequest } from "next/server";
import { getFactoryDatabasePool } from "@/src/server/auth/access-repository.ts";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http.ts";
import { FactoryAuthError, requireFactoryRole } from "@/src/server/auth/auth-service.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import { defaultBranding, isLogoDataUrl, logoFileLimit, parseBranding } from "@/src/lib/branding";

const headers = { "Cache-Control": "no-store" };
function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  return NextResponse.json({ ok: false, message: "โหลดหรือบันทึกหน้าตาโรงงานไม่สำเร็จ" }, { status: 503, headers });
}

export async function GET() {
  try {
    const result = await getFactoryDatabasePool().query("SELECT payload, version::text FROM foliar_fertilizer.factory_branding WHERE id");
    const row = result.rows[0];
    return NextResponse.json({ ok: true, branding: parseBranding(row?.payload ?? defaultBranding), version: row?.version ?? null }, { headers });
  } catch (error) {
    return failure(error);
  }
}

function validImage(value: unknown) {
  if (value === null) return true;
  if (!isLogoDataUrl(value)) return false;
  const [type, base64] = value.split(",");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > logoFileLimit) return false;
  if (type.includes("/png")) return bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (type.includes("/jpeg")) return bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, 1_501_000);
    assertCsrf(request);
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    requireFactoryRole(user, "factory_admin");
    const raw = await request.text();
    const body = raw.length <= 1_501_000 ? JSON.parse(raw) : null;
    const { branding, version } = body ?? {};
    if (!branding || typeof branding.factoryName !== "string" || !branding.factoryName.trim() ||
        typeof branding.shortName !== "string" || !branding.shortName.trim() ||
        typeof branding.primaryColor !== "string" || !/^#[0-9a-f]{6}$/i.test(branding.primaryColor) ||
        !validImage(branding.logoDataUrl) || !validImage(branding.loginImageDataUrl) ||
        !(version === null || typeof version === "string" && /^[1-9]\d{0,18}$/.test(version))) {
      throw new FactoryAuthError("INVALID_REQUEST", 400);
    }
    const value = parseBranding(branding);
    const result = await getFactoryDatabasePool().query(
      `INSERT INTO foliar_fertilizer.factory_branding (id, payload)
       SELECT true, $1::jsonb WHERE $2::text IS NULL OR EXISTS (SELECT 1 FROM foliar_fertilizer.factory_branding WHERE id)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, version = factory_branding.version + 1
       WHERE factory_branding.version::text = $2
       RETURNING version::text`,
      [JSON.stringify(value), version],
    );
    if (!result.rowCount) return NextResponse.json({ ok: false, message: "หน้าตาโรงงานถูกแก้ไขแล้ว กรุณาโหลดหน้าใหม่" }, { status: 409, headers });
    return NextResponse.json({ ok: true, branding: value, version: result.rows[0].version }, { headers });
  } catch (error) {
    return failure(error instanceof SyntaxError ? new FactoryAuthError("INVALID_REQUEST", 400) : error);
  }
}
