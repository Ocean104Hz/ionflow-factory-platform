import assert from "node:assert/strict";
import { argon2, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FactoryAuthError,
  createCsrfToken,
  csrfTokensMatch,
  getCurrentFactoryUser,
  loginWithLocalPassword,
  logoutFactorySession,
  requireFactoryPermission,
  verifyArgon2idPassword,
} from "../src/server/auth/auth-service.ts";
import {
  assertTrustedAuthRequest,
  readAuthAppOrigin,
} from "../src/server/auth/auth-boundary.ts";
import { readAuthRuntimeConfig } from "../src/server/auth/postgres-auth-repository.ts";

const password = "correct horse battery staple";
const scopeResolver = Object.freeze({
  async resolve(value) {
    return Object.freeze({ ...value, provenance: "unit-test" });
  },
});

const deriveArgon2idHash = async (value) => {
  const salt = Buffer.from("0123456789abcdef", "utf8");
  const hash = await new Promise((resolve, reject) => {
    argon2(
      "argon2id",
      {
        message: Buffer.from(value, "utf8"),
        nonce: salt,
        parallelism: 1,
        tagLength: 32,
        memory: 19_456,
        passes: 2,
      },
      (error, key) => (error ? reject(error) : resolve(Buffer.from(key))),
    );
  });
  return `$argon2id$v=19$m=19456,t=2,p=1$${salt.toString("base64")}$${hash.toString("base64")}`;
};

const credential = (passwordHash) => ({
  userId: "11111111-1111-4111-8111-111111111111",
  email: "operator@example.test",
  displayName: "Factory Operator",
  userActive: true,
  passwordHash,
  hashAlgorithm: "argon2id",
  hashVersion: 19,
  credentialDisabled: false,
  credentialRevoked: false,
});

function memoryRepository(passwordHash) {
  let storedHash = null;
  let revoked = false;
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "operator@example.test",
    displayName: "Factory Operator",
    sessionId: "22222222-2222-4222-8222-222222222222",
    sessionExpiresAt: "2026-10-27T10:00:00.000Z",
    membershipId: "33333333-3333-4333-8333-333333333333",
    tenantAuthority: "tenant:test",
    tenantId: "tenant-a",
    organizationAuthority: "organization:test",
    organizationId: "org-a",
    sites: [{ authority: "settings:test", id: "site-a" }],
    siteIds: ["site-a"],
    roles: ["operator"],
    permissions: ["inventory.read"],
  };
  return {
    async findLocalCredential(email) {
      return email === "operator@example.test" ? credential(passwordHash) : null;
    },
    async findSingleActiveMembership() {
      return {
        id: user.membershipId,
        tenantAuthority: user.tenantAuthority,
        tenantId: user.tenantId,
        organizationAuthority: user.organizationAuthority,
        organizationId: user.organizationId,
        sites: user.sites,
      };
    },
    async createSession(input) {
      storedHash = Buffer.from(input.secretHash);
      user.sessionId = input.id;
      user.sessionExpiresAt = input.expiresAt.toISOString();
      return true;
    },
    async findSession(secretHash) {
      return !revoked && storedHash?.equals(secretHash) ? Object.freeze(user) : null;
    },
    async revokeSession(secretHash) {
      if (storedHash?.equals(secretHash)) revoked = true;
    },
    snapshot() {
      return { storedHash, revoked };
    },
  };
}

test("Argon2id verifier accepts the right password and rejects malformed or wrong hashes", async () => {
  const hash = await deriveArgon2idHash(password);
  assert.equal(await verifyArgon2idPassword(password, hash), true);
  assert.equal(await verifyArgon2idPassword("wrong password", hash), false);
  assert.equal(await verifyArgon2idPassword(password, "$argon2i$bad"), false);
});

test("local login stores only a SHA-256 session hash and supports resolve/logout", async () => {
  const repository = memoryRepository(await deriveArgon2idHash(password));
  const now = new Date("2026-10-27T02:00:00.000Z");
  const result = await loginWithLocalPassword(
    repository,
    { email: " OPERATOR@example.test ", password },
    { now, scopeResolver },
  );
  assert.match(result.sessionSecret, /^[A-Za-z0-9_-]{43}$/);
  const expectedHash = createHash("sha256")
    .update(Buffer.from(result.sessionSecret, "base64url"))
    .digest();
  assert.deepEqual(repository.snapshot().storedHash, expectedHash);
  assert.notEqual(repository.snapshot().storedHash.toString("hex"), result.sessionSecret);
  assert.equal(
    (
      await getCurrentFactoryUser(
        repository,
        result.sessionSecret,
        scopeResolver,
        now,
      )
    )?.email,
    "operator@example.test",
  );
  await logoutFactorySession(repository, result.sessionSecret, now);
  assert.equal(
    await getCurrentFactoryUser(
      repository,
      result.sessionSecret,
      scopeResolver,
      now,
    ),
    null,
  );
});

test("local login fails closed for invalid credentials and invalid membership", async () => {
  const hash = await deriveArgon2idHash(password);
  const repository = memoryRepository(hash);
  await assert.rejects(
    loginWithLocalPassword(repository, {
      email: "unknown@example.test",
      password,
    }, { scopeResolver }),
    (error) => error instanceof FactoryAuthError && error.status === 401,
  );
  await assert.rejects(
    loginWithLocalPassword(repository, {
      email: "operator@example.test",
      password: "wrong password",
    }, { scopeResolver }),
    (error) => error instanceof FactoryAuthError && error.status === 401,
  );
  repository.findSingleActiveMembership = async () => null;
  await assert.rejects(
    loginWithLocalPassword(repository, {
      email: "operator@example.test",
      password,
    }),
    (error) => error instanceof FactoryAuthError && error.status === 401,
  );
});

test("local login cannot create a session without an approved scope resolver", async () => {
  const repository = memoryRepository(await deriveArgon2idHash(password));
  await assert.rejects(
    loginWithLocalPassword(repository, {
      email: "operator@example.test",
      password,
    }),
    (error) => error instanceof FactoryAuthError && error.status === 503,
  );
  assert.equal(repository.snapshot().storedHash, null);
});

test("permission checks require both explicit permission and assigned site", () => {
  const user = {
    permissions: ["inventory.read"],
    siteIds: ["site-a"],
  };
  assert.doesNotThrow(() => requireFactoryPermission(user, "inventory.read", "site-a"));
  assert.throws(() => requireFactoryPermission(user, "inventory.post", "site-a"));
  assert.throws(() => requireFactoryPermission(user, "inventory.read", "site-b"));
});

test("CSRF uses exact high-entropy double-submit tokens", () => {
  const token = createCsrfToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(csrfTokensMatch(token, token), true);
  assert.equal(csrfTokensMatch(token, createCsrfToken()), false);
  assert.equal(csrfTokensMatch("short", "short"), false);
});

test("auth HTTP boundary accepts only the configured local same-origin request", () => {
  const env = { NODE_ENV: "test", FACTORY_AUTH_APP_ORIGIN: "http://localhost:3000" };
  assert.equal(readAuthAppOrigin(env), "http://localhost:3000");
  const request = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "sec-fetch-site": "same-origin",
      "content-length": "40",
    },
  });
  assert.doesNotThrow(() => assertTrustedAuthRequest(request, env));
  for (const headers of [
    { origin: "http://evil.test", host: "localhost:3000" },
    { origin: "http://localhost:3000", host: "127.0.0.1:3000" },
    { origin: "http://localhost:3000", host: "localhost:3000", forwarded: "for=1.2.3.4" },
  ]) {
    assert.throws(() =>
      assertTrustedAuthRequest(
        new Request("http://localhost:3000/api/auth/login", { headers }),
        env,
      ),
    );
  }
  assert.throws(() => readAuthAppOrigin({ NODE_ENV: "production" }));
});

test("auth HTTP boundary accepts Next.js 16 loopback forwarding only in development Auth mode", () => {
  const request = new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      "content-length": "40",
      "x-forwarded-host": "localhost:3000",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "::1",
    },
  });
  const development = {
    NODE_ENV: "development",
    FACTORY_DEV_AUTH_ENABLED: "true",
    FACTORY_AUTH_APP_ORIGIN: "http://localhost:3000",
  };
  assert.doesNotThrow(() => assertTrustedAuthRequest(request, development));
  assert.throws(() =>
    assertTrustedAuthRequest(request, {
      ...development,
      NODE_ENV: "test",
    }),
  );
});

test("runtime database configuration is exact and rejects production or shared roles", () => {
  const env = {
    NODE_ENV: "test",
    FACTORY_AUTH_ENABLED: "true",
    FACTORY_AUTH_APP_ORIGIN: "http://localhost:3000",
    FACTORY_AUTH_DB_USER: "factory_auth_runtime",
    FACTORY_AUTH_DB_PASSWORD: "unit-test-placeholder",
    FACTORY_DB_HOST: "127.0.0.1",
    FACTORY_DB_PORT: "5432",
    FACTORY_DB_NAME: "ionflow_inventory_dev",
    FACTORY_DB_SCHEMA: "inventory_sandbox",
  };
  assert.equal(readAuthRuntimeConfig(env).user, "factory_auth_runtime");
  assert.throws(() =>
    readAuthRuntimeConfig({ ...env, FACTORY_AUTH_DB_USER: "factory_production_writer" }),
  );
  assert.throws(() => readAuthRuntimeConfig({ ...env, NODE_ENV: "production" }));
});

test("route integration keeps session verification server-side and logout CSRF-protected", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(
    read("app/(factory)/layout.tsx"),
    /await requireAuthenticatedFactoryUser\(\)/,
  );
  assert.match(read("app/api/auth/login/route.ts"), /loginWithLocalPassword/);
  assert.match(read("app/api/auth/login/route.ts"), /httpOnly: true|sessionCookieOptions/);
  assert.match(read("app/api/auth/logout/route.ts"), /assertCsrf\(request\)/);
  assert.match(read("app/api/auth/logout/route.ts"), /logoutFactorySession/);
  assert.match(read("app/api/auth/me/route.ts"), /getCurrentFactoryUser/);
  assert.doesNotMatch(read("src/features/login/login.tsx"), /localStorage|sessionStorage/);
});

test("PostgreSQL repository queries match migration 0005 credential and session contracts", () => {
  const migration = readFileSync(
    new URL("../migrations/0005_factory_auth.up.sql", import.meta.url),
    "utf8",
  );
  const repository = readFileSync(
    new URL("../src/server/auth/postgres-auth-repository.ts", import.meta.url),
    "utf8",
  );
  for (const definition of [
    /factory_local_credentials[\s\S]*password_hash TEXT NOT NULL/,
    /hash_algorithm TEXT NOT NULL CHECK \(hash_algorithm = 'argon2id'\)/,
    /hash_version SMALLINT NOT NULL CHECK \(hash_version = 19\)/,
    /factory_sessions[\s\S]*secret_hash BYTEA NOT NULL UNIQUE/,
    /FOREIGN KEY \(membership_id, user_id\)[\s\S]*factory_memberships\(id, user_id\)/,
  ]) assert.match(migration, definition);
  assert.match(repository, /WHERE u\.email_normalized=\$1/);
  assert.match(repository, /m\.id=\$3 AND m\.user_id=u\.id/);
  assert.match(repository, /s\.revoked_at IS NULL AND s\.expires_at>\$2/);
  assert.match(repository, /m\.id=s\.membership_id AND m\.user_id=s\.user_id/);
  assert.match(repository, /ms\.revoked_at IS NULL/);
  assert.match(repository, /mr\.revoked_at IS NULL/);
  assert.match(repository, /rp\.revoked_at IS NULL/);
});
