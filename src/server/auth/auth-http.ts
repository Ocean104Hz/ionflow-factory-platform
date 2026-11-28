import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import {
  FactoryAuthError,
  csrfTokenFailure,
  type AuthenticatedFactoryUser,
} from "./auth-service.ts";
import { FactoryAuthBoundaryError } from "./auth-boundary.ts";
export { assertTrustedAuthRequest } from "./auth-boundary.ts";

export const SESSION_COOKIE = "ionflow_factory_session";
export const CSRF_COOKIE = "ionflow_factory_csrf";

export function assertCsrf(request: NextRequest): void {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  const headerToken = request.headers.get("x-csrf-token") ?? "";
  const reason = csrfTokenFailure(cookieToken, headerToken);
  if (reason) throw new FactoryAuthBoundaryError(reason);
}

export function publicUser(user: AuthenticatedFactoryUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    modules: user.modules,
  };
}

export function authErrorResponse(error: unknown): NextResponse {
  const authError =
    error instanceof FactoryAuthError
      ? error
      : new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const message =
    authError.status === 401
      ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่ได้รับสิทธิ์"
      : authError.status === 400
        ? "ข้อมูลที่ส่งมาไม่ถูกต้อง"
        : authError.status === 403
          ? "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ"
          : "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน";
  return NextResponse.json(
    { ok: false, code: authError.code, message },
    { status: authError.status, headers: { "Cache-Control": "no-store" } },
  );
}

const secure = process.env.NODE_ENV === "production";
export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  sameSite: "strict" as const,
  secure,
  path: "/",
});
export const csrfCookieOptions = Object.freeze({
  httpOnly: false,
  sameSite: "strict" as const,
  secure,
  path: "/",
});
