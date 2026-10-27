import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertDevelopmentRequestHost,
  developmentAuthEnabled,
  loginWithDevelopmentPassword,
  readDevelopmentAuthConfig,
  readDevelopmentSession,
} from "../src/server/auth/development-auth.ts";
import { requireFactoryPermission } from "../src/server/auth/auth-service.ts";

const env = Object.freeze({
  NODE_ENV: "development",
  FACTORY_DEV_AUTH_ENABLED: "true",
  FACTORY_DEV_AUTH_EMAIL: "admin@example.test",
  FACTORY_DEV_AUTH_PASSWORD: "correct horse battery staple",
  FACTORY_DEV_AUTH_SESSION_SECRET:
    "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  FACTORY_AUTH_APP_ORIGIN: "http://localhost:3000",
});

test("development login creates a signed expiring session for the configured user", () => {
  const now = new Date("2026-10-27T02:00:00.000Z");
  const result = loginWithDevelopmentPassword(
    { email: " ADMIN@example.test ", password: "correct horse battery staple" },
    env,
    now,
  );
  assert.equal(result.user.email, "admin@example.test");
  assert.equal(result.user.permissions.length, 0);
  assert.equal(result.user.siteIds.length, 0);
  assert.equal(
    readDevelopmentSession(result.sessionSecret, env, now)?.sessionId,
    result.user.sessionId,
  );
  assert.equal(
    readDevelopmentSession(
      result.sessionSecret,
      env,
      new Date(now.getTime() + 8 * 60 * 60 * 1000),
    ),
    null,
  );
});

test("development login rejects an incorrect password and a modified cookie", () => {
  assert.throws(
    () =>
      loginWithDevelopmentPassword(
        { email: "admin@example.test", password: "incorrect password" },
        env,
      ),
    /INVALID_CREDENTIALS/,
  );
  const result = loginWithDevelopmentPassword(
    { email: "admin@example.test", password: "correct horse battery staple" },
    env,
  );
  assert.equal(readDevelopmentSession(`${result.sessionSecret}x`, env), null);
});

test("development mode rejects production and non-loopback request hosts", () => {
  assert.equal(developmentAuthEnabled(env), true);
  assert.equal(developmentAuthEnabled({ ...env, NODE_ENV: "production" }), false);
  assert.throws(
    () => readDevelopmentAuthConfig({ ...env, NODE_ENV: "production" }),
    /AUTH_UNAVAILABLE/,
  );
  assert.doesNotThrow(() =>
    assertDevelopmentRequestHost(new Headers({ host: "localhost:3000" }), env),
  );
  assert.throws(() =>
    assertDevelopmentRequestHost(new Headers({ host: "192.168.1.10:3000" }), env),
  );
  assert.throws(() =>
    assertDevelopmentRequestHost(
      new Headers({ host: "localhost:3000", forwarded: "for=127.0.0.1" }),
      env,
    ),
  );
});

test("Next.js 16 synthesized forwarding is accepted only for exact loopback development", () => {
  const nextDevelopmentHeaders = new Headers({
    host: "localhost:3000",
    "x-forwarded-host": "localhost:3000",
    "x-forwarded-proto": "http",
    "x-forwarded-for": "::1",
  });
  assert.doesNotThrow(() =>
    assertDevelopmentRequestHost(nextDevelopmentHeaders, env),
  );
  for (const headers of [
    { ...Object.fromEntries(nextDevelopmentHeaders), "x-forwarded-host": "evil.test" },
    { ...Object.fromEntries(nextDevelopmentHeaders), "x-forwarded-proto": "https" },
    { ...Object.fromEntries(nextDevelopmentHeaders), "x-forwarded-for": "192.168.1.10" },
  ])
    assert.throws(() =>
      assertDevelopmentRequestHost(new Headers(headers), env),
    );
  assert.throws(() =>
    assertDevelopmentRequestHost(nextDevelopmentHeaders, {
      ...env,
      FACTORY_DEV_AUTH_ENABLED: "false",
    }),
  );
});

test("development Dashboard identity cannot authorize business operations", () => {
  const user = loginWithDevelopmentPassword(
    { email: "admin@example.test", password: "correct horse battery staple" },
    env,
  ).user;
  assert.throws(() => requireFactoryPermission(user, "inventory.read"));
  assert.throws(() => requireFactoryPermission(user, "inventory.post"));
  const persistentAccess = readFileSync(
    new URL("../src/server/persistent-access.ts", import.meta.url),
    "utf8",
  );
  assert.match(persistentAccess, /throw new BackendError\("AUTH_NOT_CONFIGURED"\)/);
});

test("route integration keeps HttpOnly expiry, CSRF logout and Cache Components boundary", () => {
  const read = (path) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const login = read("app/api/auth/login/route.ts");
  const logout = read("app/api/auth/logout/route.ts");
  const layout = read("app/(factory)/layout.tsx");
  const http = read("src/server/auth/auth-http.ts");
  assert.match(login, /loginWithDevelopmentPassword/);
  assert.match(login, /expires/);
  assert.match(http, /httpOnly: true/);
  assert.match(logout, /assertCsrf\(request\)/);
  assert.match(logout, /maxAge: 0/);
  assert.match(layout, /<Suspense[\s\S]*<AuthenticatedFactory>/);
  assert.match(read("src/server/auth/server-auth.ts"), /await headers\(\)/);
});
