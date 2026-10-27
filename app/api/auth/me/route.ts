import { NextResponse, type NextRequest } from "next/server";
import {
  FactoryAuthError,
  getCurrentFactoryUser,
} from "@/src/server/auth/auth-service.ts";
import {
  SESSION_COOKIE,
  authErrorResponse,
  publicUser,
} from "@/src/server/auth/auth-http.ts";
import { getFactoryAuthRepository } from "@/src/server/auth/postgres-auth-repository.ts";
import { getTrustedLocalScopeResolver } from "@/src/server/auth/local-scope-resolver.ts";
import {
  assertDevelopmentRequestHost,
  developmentAuthEnabled,
  readDevelopmentSession,
} from "@/src/server/auth/development-auth.ts";

export async function GET(request: NextRequest) {
  try {
    const secret = request.cookies.get(SESSION_COOKIE)?.value;
    const development = developmentAuthEnabled();
    if (development) assertDevelopmentRequestHost(request.headers);
    const user = development
      ? readDevelopmentSession(secret)
      : secret
        ? await getCurrentFactoryUser(
            getFactoryAuthRepository(),
            secret,
            getTrustedLocalScopeResolver(),
          )
        : null;
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    return NextResponse.json(
      { ok: true, user: publicUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
