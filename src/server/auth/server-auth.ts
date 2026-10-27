import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  FactoryAuthError,
  getCurrentFactoryUser,
  requireFactoryPermission,
  type AuthenticatedFactoryUser,
} from "./auth-service.ts";
import { SESSION_COOKIE } from "./auth-http.ts";
import { getFactoryAuthRepository } from "./postgres-auth-repository.ts";
import { getTrustedLocalScopeResolver } from "./local-scope-resolver.ts";
import {
  assertDevelopmentRequestHost,
  developmentAuthEnabled,
  readDevelopmentSession,
} from "./development-auth.ts";

export async function readCurrentFactoryUser(): Promise<AuthenticatedFactoryUser | null> {
  const secret = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  if (developmentAuthEnabled()) {
    assertDevelopmentRequestHost(await headers());
    return readDevelopmentSession(secret);
  }
  return getCurrentFactoryUser(
    getFactoryAuthRepository(),
    secret,
    getTrustedLocalScopeResolver(),
  );
}

export async function requireAuthenticatedFactoryUser(): Promise<AuthenticatedFactoryUser> {
  try {
    const user = await readCurrentFactoryUser();
    if (user) return user;
  } catch (error) {
    if (!(error instanceof FactoryAuthError)) throw error;
  }
  redirect("/login");
}

export async function requireAuthenticatedFactoryPermission(
  permission: string,
  siteId?: string,
): Promise<AuthenticatedFactoryUser> {
  const user = await requireAuthenticatedFactoryUser();
  requireFactoryPermission(user, permission, siteId);
  return user;
}
