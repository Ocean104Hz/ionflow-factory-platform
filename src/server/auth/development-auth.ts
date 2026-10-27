import "server-only";
import * as crypto from "node:crypto";
import type { AuthenticatedFactoryUser } from "./auth-service.ts";
import { FactoryAuthError, normalizeLoginEmail } from "./auth-service.ts";
import {
  assertLocalAuthRequestHost,
  readAuthAppOrigin,
} from "./auth-boundary.ts";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type DevelopmentAuthConfig = Readonly<{
  email: string;
  password: string;
  signingKey: Buffer;
  origin: string;
}>;

export function developmentAuthEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return (
    env.NODE_ENV === "development" && env.FACTORY_DEV_AUTH_ENABLED === "true"
  );
}

export function readDevelopmentAuthConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): DevelopmentAuthConfig {
  if (!developmentAuthEnabled(env))
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const email = normalizeLoginEmail(env.FACTORY_DEV_AUTH_EMAIL);
  const password = env.FACTORY_DEV_AUTH_PASSWORD;
  const encodedKey = env.FACTORY_DEV_AUTH_SESSION_SECRET ?? "";
  const signingKey = Buffer.from(encodedKey, "base64url");
  if (
    !email ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256 ||
    password.includes("\0") ||
    !/^[A-Za-z0-9_-]{43}$/.test(encodedKey) ||
    signingKey.length !== 32
  )
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  return Object.freeze({
    email,
    password,
    signingKey,
    origin: readAuthAppOrigin(env),
  });
}

function safeTextEqual(left: string, right: string): boolean {
  const leftHash = crypto.createHash("sha256").update(left, "utf8").digest();
  const rightHash = crypto.createHash("sha256").update(right, "utf8").digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function signature(payload: string, key: Buffer): string {
  return crypto.createHmac("sha256", key).update(payload).digest("base64url");
}

function userFromSession(
  email: string,
  nonce: string,
  expiresAt: number,
): AuthenticatedFactoryUser {
  const sessionId = crypto
    .createHash("sha256")
    .update(nonce)
    .digest("hex")
    .slice(0, 32);
  return Object.freeze({
    id: "local-development-user",
    email,
    displayName: "Local Development Admin",
    sessionId: `dev-${sessionId}`,
    sessionExpiresAt: new Date(expiresAt).toISOString(),
    membershipId: "local-development-membership",
    tenantAuthority: "untrusted-development-session",
    tenantId: "untrusted-development-session",
    organizationAuthority: "untrusted-development-session",
    organizationId: "untrusted-development-session",
    sites: Object.freeze([]),
    siteIds: Object.freeze([]),
    roles: Object.freeze(["development-login"]),
    permissions: Object.freeze([]),
  });
}

export function loginWithDevelopmentPassword(
  input: Readonly<{ email: unknown; password: unknown }>,
  env: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date(),
): Readonly<{ sessionSecret: string; user: AuthenticatedFactoryUser }> {
  const config = readDevelopmentAuthConfig(env);
  const email = normalizeLoginEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (
    !email ||
    password.length > 1024 ||
    !safeTextEqual(email, config.email) ||
    !safeTextEqual(password, config.password)
  )
    throw new FactoryAuthError("INVALID_CREDENTIALS", 401);

  const issuedAt = now.getTime();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload = Buffer.from(
    JSON.stringify({
      version: 1,
      email: config.email,
      issuedAt,
      expiresAt,
      nonce: crypto.randomBytes(32).toString("base64url"),
    }),
    "utf8",
  ).toString("base64url");
  const sessionSecret = `${payload}.${signature(payload, config.signingKey)}`;
  const user = readDevelopmentSession(sessionSecret, env, now);
  if (!user) throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  return Object.freeze({ sessionSecret, user });
}

export function readDevelopmentSession(
  sessionSecret: string | undefined,
  env: Readonly<Record<string, string | undefined>> = process.env,
  now = new Date(),
): AuthenticatedFactoryUser | null {
  const config = readDevelopmentAuthConfig(env);
  if (!sessionSecret || sessionSecret.length > 2048) return null;
  const [payload, suppliedSignature, extra] = sessionSecret.split(".");
  if (
    !payload ||
    !suppliedSignature ||
    extra !== undefined ||
    !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature) ||
    !safeTextEqual(suppliedSignature, signature(payload, config.signingKey))
  )
    return null;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const session = value as Record<string, unknown>;
  if (
    Object.keys(session).sort().join("|") !==
      "email|expiresAt|issuedAt|nonce|version" ||
    session.version !== 1 ||
    session.email !== config.email ||
    !Number.isSafeInteger(session.issuedAt) ||
    !Number.isSafeInteger(session.expiresAt) ||
    (session.expiresAt as number) - (session.issuedAt as number) !==
      SESSION_TTL_MS ||
    (session.issuedAt as number) > now.getTime() + 60_000 ||
    (session.expiresAt as number) <= now.getTime() ||
    typeof session.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(session.nonce)
  )
    return null;
  return userFromSession(
    config.email,
    session.nonce,
    session.expiresAt as number,
  );
}

export function assertDevelopmentRequestHost(
  requestHeaders: Pick<Headers, "get" | "has">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  readDevelopmentAuthConfig(env);
  assertLocalAuthRequestHost(requestHeaders, env);
}
