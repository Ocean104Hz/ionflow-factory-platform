import { NextResponse, type NextRequest } from "next/server";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
  csrfCookieOptions,
  sessionCookieOptions,
} from "@/src/server/auth/auth-http.ts";

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    response.cookies.set(CSRF_COOKIE, "", { ...csrfCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
