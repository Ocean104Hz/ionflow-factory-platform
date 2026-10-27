import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  FactoryAuthError,
  csrfTokensMatch,
  type AuthenticatedFactoryUser,
} from "./auth-service.ts";
export {
  assertTrustedAuthRequest,
  readAuthAppOrigin,
} from "./auth-boundary.ts";

export const SESSION_COOKIE = "ionflow_factory_session";
export const CSRF_COOKIE = "ionflow_factory_csrf";

export function assertCsrf(request: NextRequest): void {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  const headerToken = request.headers.get("x-csrf-token") ?? "";
  if (!csrfTokensMatch(cookieToken, headerToken))
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}

export function publicUser(user: AuthenticatedFactoryUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    tenantId: user.tenantId,
    organizationId: user.organizationId,
    siteIds: user.siteIds,
    roles: user.roles,
    permissions: user.permissions,
    sessionExpiresAt: user.sessionExpiresAt,
  };
}

export function authErrorResponse(error: unknown): NextResponse {
  const authError =
    error instanceof FactoryAuthError
      ? error
      : new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const message =
    authError.status === 401
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
      : authError.status === 400
        ? "ข้อมูลเข้าสู่ระบบไม่ถูกต้อง"
        : authError.status === 403
          ? "ไม่อนุญาตให้ดำเนินการ"
          : "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน";
  return NextResponse.json(
    { ok: false, code: authError.code, message },
    { status: authError.status, headers: { "Cache-Control": "no-store" } },
  );
}

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  secure: false,
  path: "/",
});

export const csrfCookieOptions = Object.freeze({
  httpOnly: false,
  sameSite: "strict" as const,
  secure: false,
  path: "/",
});
