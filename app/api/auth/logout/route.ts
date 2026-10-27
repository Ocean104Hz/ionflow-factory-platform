import { NextResponse, type NextRequest } from "next/server";
import { logoutFactorySession } from "@/src/server/auth/auth-service.ts";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
  csrfCookieOptions,
  sessionCookieOptions,
} from "@/src/server/auth/auth-http.ts";
import { getFactoryAuthRepository } from "@/src/server/auth/postgres-auth-repository.ts";
import {
  assertDevelopmentRequestHost,
  developmentAuthEnabled,
} from "@/src/server/auth/development-auth.ts";

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    if (developmentAuthEnabled()) assertDevelopmentRequestHost(request.headers);
    else
      await logoutFactorySession(
        getFactoryAuthRepository(),
        request.cookies.get(SESSION_COOKIE)?.value,
      );
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, "", {
      ...sessionCookieOptions,
      maxAge: 0,
    });
    response.cookies.set(CSRF_COOKIE, "", {
      ...csrfCookieOptions,
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
