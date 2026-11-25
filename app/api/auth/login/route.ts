import { NextResponse, type NextRequest } from "next/server";
import { FactoryAuthError, createCsrfToken } from "@/src/server/auth/auth-service.ts";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
  csrfCookieOptions,
  publicUser,
  sessionCookieOptions,
} from "@/src/server/auth/auth-http.ts";
import {
  createFirebaseSessionCookie,
  verifyFirebaseIdToken,
} from "@/src/server/auth/firebase-admin.ts";
import { findFactoryUserByUid } from "@/src/server/auth/access-repository.ts";

const EIGHT_HOURS = 8 * 60 * 60 * 1000;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new FactoryAuthError("INVALID_REQUEST", 400);
    const body = await request.json().catch(() => null);
    const idToken = body?.idToken;
    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded.email || !decoded.email_verified)
      throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    const user = await findFactoryUserByUid(decoded.uid, {
      email: decoded.email,
      name: decoded.name,
    });
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    const expiresIn = body?.remember === true ? FOURTEEN_DAYS : EIGHT_HOURS;
    const sessionCookie = await createFirebaseSessionCookie(idToken, expiresIn);
    const csrfToken = createCsrfToken();
    const response = NextResponse.json(
      { ok: true, user: publicUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      ...sessionCookieOptions,
      expires: new Date(Date.now() + expiresIn),
    });
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      ...csrfCookieOptions,
      expires: new Date(Date.now() + expiresIn),
    });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
