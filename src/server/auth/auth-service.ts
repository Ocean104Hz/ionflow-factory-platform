import "server-only";
import * as crypto from "node:crypto";
import type {
  TrustedScopeResolver,
  TrustedSiteSelector,
} from "./local-scope-resolver.ts";

const SESSION_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DUMMY_ARGON2ID_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export type LocalCredential = Readonly<{
  userId: string;
  email: string;
  displayName: string;
  userActive: boolean;
  passwordHash: string;
  hashAlgorithm: string;
  hashVersion: number;
  credentialDisabled: boolean;
  credentialRevoked: boolean;
}>;

export type ActiveMembership = Readonly<{
  id: string;
  tenantAuthority: string;
  tenantId: string;
  organizationAuthority: string;
  organizationId: string;
  sites: readonly TrustedSiteSelector[];
}>;

export type AuthenticatedFactoryUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  sessionId: string;
  sessionExpiresAt: string;
  membershipId: string;
  tenantAuthority: string;
  tenantId: string;
  organizationAuthority: string;
  organizationId: string;
  sites: readonly TrustedSiteSelector[];
  siteIds: readonly string[];
  roles: readonly string[];
  permissions: readonly string[];
}>;

export interface FactoryAuthRepository {
  findLocalCredential(emailNormalized: string): Promise<LocalCredential | null>;
  findSingleActiveMembership(
    userId: string,
    now: Date,
  ): Promise<ActiveMembership | null>;
  createSession(input: {
    id: string;
    userId: string;
    membershipId: string;
    secretHash: Buffer;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean>;
  findSession(
    secretHash: Buffer,
    now: Date,
  ): Promise<AuthenticatedFactoryUser | null>;
  revokeSession(secretHash: Buffer, now: Date): Promise<void>;
}

export type LoginResult = Readonly<{
  sessionSecret: string;
  user: AuthenticatedFactoryUser;
}>;

export class FactoryAuthError extends Error {
  readonly code:
    | "INVALID_REQUEST"
    | "INVALID_CREDENTIALS"
    | "ACCESS_DENIED"
    | "AUTH_UNAVAILABLE";
  readonly status: 400 | 401 | 403 | 503;

  constructor(
    code:
      | "INVALID_REQUEST"
      | "INVALID_CREDENTIALS"
      | "ACCESS_DENIED"
      | "AUTH_UNAVAILABLE",
    status: 400 | 401 | 403 | 503,
  ) {
    super(code);
    this.name = "FactoryAuthError";
    this.code = code;
    this.status = status;
  }
}

type ParsedArgon2id = Readonly<{
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
}>;

function decodePhcBase64(value: string): Buffer | null {
  if (value.length % 4 === 1) return null;
  const decoded = Buffer.from(value, "base64");
  if (
    decoded.length === 0 ||
    decoded.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")
  )
    return null;
  return decoded;
}

function parseArgon2id(phc: string): ParsedArgon2id | null {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+={0,2})\$([A-Za-z0-9+/]+={0,2})$/.exec(
      phc,
    );
  if (!match) return null;
  const memory = Number(match[1]);
  const passes = Number(match[2]);
  const parallelism = Number(match[3]);
  const salt = decodePhcBase64(match[4]);
  const hash = decodePhcBase64(match[5]);
  if (
    !Number.isSafeInteger(memory) ||
    memory < 19_456 ||
    memory > 1_048_576 ||
    !Number.isSafeInteger(passes) ||
    passes < 2 ||
    passes > 10 ||
    !Number.isSafeInteger(parallelism) ||
    parallelism < 1 ||
    parallelism > 16 ||
    !salt ||
    salt.length < 16 ||
    salt.length > 64 ||
    !hash ||
    hash.length < 32 ||
    hash.length > 64
  )
    return null;
  return { memory, passes, parallelism, salt, hash };
}

type Argon2Callback = (error: Error | null, derivedKey: ArrayBuffer) => void;
type Argon2Function = (
  algorithm: "argon2id",
  parameters: {
    message: Buffer;
    nonce: Buffer;
    parallelism: number;
    tagLength: number;
    memory: number;
    passes: number;
  },
  callback: Argon2Callback,
) => void;

export async function verifyArgon2idPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const parsed = parseArgon2id(encodedHash);
  const effective = parsed ?? parseArgon2id(DUMMY_ARGON2ID_HASH)!;
  const argon2 = (crypto as unknown as { argon2?: Argon2Function }).argon2;
  if (!argon2) throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const actual = await new Promise<Buffer>((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: Buffer.from(password, "utf8"),
        nonce: effective.salt,
        parallelism: effective.parallelism,
        tagLength: effective.hash.length,
        memory: effective.memory,
        passes: effective.passes,
      },
      (error, derivedKey) =>
        error ? reject(error) : resolve(Buffer.from(derivedKey)),
    );
  }).catch(() => {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  });
  return (
    parsed !== null &&
    actual.length === parsed.hash.length &&
    crypto.timingSafeEqual(actual, parsed.hash)
  );
}

export function normalizeLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return null;
  return email;
}

function validPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 1024 &&
    !value.includes("\0")
  );
}

function sessionHash(secret: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) return null;
  const raw = Buffer.from(secret, "base64url");
  if (raw.length !== SESSION_BYTES) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export async function loginWithLocalPassword(
  repository: FactoryAuthRepository,
  input: Readonly<{ email: unknown; password: unknown }>,
  options: Readonly<{
    now?: Date;
    sessionTtlMs?: number;
    scopeResolver?: TrustedScopeResolver;
  }> = {},
): Promise<LoginResult> {
  const email = normalizeLoginEmail(input.email);
  if (!email || !validPassword(input.password))
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  const credential = await repository.findLocalCredential(email);
  const passwordValid = await verifyArgon2idPassword(
    input.password,
    credential?.passwordHash ?? DUMMY_ARGON2ID_HASH,
  );
  if (
    !credential ||
    !passwordValid ||
    !credential.userActive ||
    credential.credentialDisabled ||
    credential.credentialRevoked ||
    credential.hashAlgorithm !== "argon2id" ||
    credential.hashVersion !== 19
  )
    throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const now = options.now ?? new Date();
  const membership = await repository.findSingleActiveMembership(
    credential.userId,
    now,
  );
  if (!membership) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  if (!options.scopeResolver)
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  try {
    await options.scopeResolver.resolve(membership);
  } catch (error) {
    if (error instanceof FactoryAuthError && error.code === "ACCESS_DENIED")
      throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    throw error;
  }
  const ttl = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  if (!Number.isSafeInteger(ttl) || ttl < 60_000 || ttl > 24 * 60 * 60 * 1000)
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const sessionSecret = crypto.randomBytes(SESSION_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + ttl);
  const created = await repository.createSession({
    id: crypto.randomUUID(),
    userId: credential.userId,
    membershipId: membership.id,
    secretHash: sessionHash(sessionSecret)!,
    expiresAt,
    now,
  });
  if (!created) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const user = await repository.findSession(sessionHash(sessionSecret)!, now);
  if (!user) throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  return { sessionSecret, user };
}

export async function getCurrentFactoryUser(
  repository: FactoryAuthRepository,
  sessionSecret: string | undefined,
  scopeResolver: TrustedScopeResolver,
  now = new Date(),
): Promise<AuthenticatedFactoryUser | null> {
  if (!sessionSecret) return null;
  const hash = sessionHash(sessionSecret);
  const user = hash ? await repository.findSession(hash, now) : null;
  if (!user) return null;
  try {
    await scopeResolver.resolve(user);
    return user;
  } catch (error) {
    if (error instanceof FactoryAuthError && error.code === "ACCESS_DENIED")
      return null;
    throw error;
  }
}

export async function logoutFactorySession(
  repository: FactoryAuthRepository,
  sessionSecret: string | undefined,
  now = new Date(),
): Promise<void> {
  if (!sessionSecret) return;
  const hash = sessionHash(sessionSecret);
  if (hash) await repository.revokeSession(hash, now);
}

export function requireFactoryPermission(
  user: AuthenticatedFactoryUser,
  permission: string,
  siteId?: string,
): void {
  if (
    !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(permission) ||
    !user.permissions.includes(permission) ||
    (siteId !== undefined && !user.siteIds.includes(siteId))
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}

export function createCsrfToken(): string {
  return crypto.randomBytes(SESSION_BYTES).toString("base64url");
}

export function csrfTokensMatch(cookieToken: string, headerToken: string): boolean {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(cookieToken) ||
    !/^[A-Za-z0-9_-]{43}$/.test(headerToken)
  )
    return false;
  return crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken),
  );
}
