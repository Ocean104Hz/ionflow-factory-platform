import { NextResponse, type NextRequest } from "next/server";
import {
  FactoryAuthError,
  createCsrfToken,
  loginWithLocalPassword,
} from "@/src/server/auth/auth-service.ts";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  assertTrustedAuthRequest,
  authErrorResponse,
  csrfCookieOptions,
  publicUser,
  sessionCookieOptions,
} from "@/src/server/auth/auth-http.ts";
import { getFactoryAuthRepository } from "@/src/server/auth/postgres-auth-repository.ts";
import { getTrustedLocalScopeResolver } from "@/src/server/auth/local-scope-resolver.ts";
import {
  developmentAuthEnabled,
  loginWithDevelopmentPassword,
} from "@/src/server/auth/development-auth.ts";

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new FactoryAuthError("INVALID_REQUEST", 400);
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 4096)
      throw new FactoryAuthError("INVALID_REQUEST", 400);
    const body = (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return null;
      }
    })();
    const input = { email: body?.email, password: body?.password };
    const result = developmentAuthEnabled()
      ? loginWithDevelopmentPassword(input)
      : await loginWithLocalPassword(getFactoryAuthRepository(), input, {
          scopeResolver: getTrustedLocalScopeResolver(),
        });
    const csrfToken = createCsrfToken();
    const response = NextResponse.json(
      { ok: true, user: publicUser(result.user) },
      { headers: { "Cache-Control": "no-store" } },
    );
    const expires = new Date(result.user.sessionExpiresAt);
    response.cookies.set(SESSION_COOKIE, result.sessionSecret, {
      ...sessionCookieOptions,
      expires,
    });
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      ...csrfCookieOptions,
      expires,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
