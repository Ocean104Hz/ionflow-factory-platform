import "server-only";
import * as crypto from "node:crypto";

export type AuthenticatedFactoryUser = Readonly<{
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  roles: readonly string[];
  modules: readonly string[];
}>;

export class FactoryAuthError extends Error {
  readonly code:
    | "INVALID_REQUEST"
    | "INVALID_CREDENTIALS"
    | "ACCESS_DENIED"
    | "AUTH_UNAVAILABLE";
  readonly status: 400 | 401 | 403 | 503;

  constructor(
    code: FactoryAuthError["code"],
    status: FactoryAuthError["status"],
  ) {
    super(code);
    this.name = "FactoryAuthError";
    this.code = code;
    this.status = status;
  }
}

export function createCsrfToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function csrfTokenFailure(cookieToken: string, headerToken: string) {
  if (!cookieToken || !headerToken) return "csrf_missing";
  if (
    cookieToken.length !== 43 || headerToken.length !== 43 ||
    !/^[A-Za-z0-9_-]{43}$/.test(cookieToken) ||
    !/^[A-Za-z0-9_-]{43}$/.test(headerToken)
  )
    return "csrf_invalid";
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken)))
    return "csrf_mismatch";
}

export function requireFactoryModule(
  user: AuthenticatedFactoryUser,
  moduleKey: string,
): void {
  if (
    !/^[a-z][a-z0-9_]{1,99}$/.test(moduleKey) ||
    !user.modules.includes(moduleKey)
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}

export function requireFactoryRole(
  user: AuthenticatedFactoryUser,
  roleCode: string,
): void {
  if (!user.roles.includes(roleCode))
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}
