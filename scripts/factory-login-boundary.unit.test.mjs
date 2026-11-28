import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server.js";
import { getResolveRoutes } from "next/dist/server/lib/router-utils/resolve-routes.js";
import { NextRequestAdapter } from "next/dist/server/web/spec-extension/adapters/next-request.js";
import ts from "typescript";

const browserOrigin = "https://ionflow-factory-platform-290053598029.asia-southeast3.run.app";
const attackerOrigin = "https://untrusted.example";
const csrf = "a".repeat(43);
const asModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;

function compile(path, imports = {}) {
  const result = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(result.diagnostics.length, 0, path);
  let source = result.outputText.replace(/import "server-only";/, "");
  for (const [specifier, url] of Object.entries(imports)) {
    assert.ok(source.includes(JSON.stringify(specifier)), `${path}: ${specifier}`);
    source = source.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
  }
  return asModule(source);
}

const auth = compile("src/server/auth/auth-service.ts");
const boundary = compile("src/server/auth/auth-boundary.ts", { "./auth-service.ts": auth });
const next = import.meta.resolve("next/server.js");
const http = compile("src/server/auth/auth-http.ts", {
  "next/server": next,
  "./auth-service.ts": auth,
  "./auth-boundary.ts": boundary,
});
const { assertTrustedAuthRequest, assertCsrf } = await import(http);
const doubles = asModule(`
  import { FactoryAuthError } from ${JSON.stringify(auth)};
  export const state = { calls: [] };
  export async function verifyFirebaseIdToken() {
    state.calls.push('verify');
    if (!state.verified) throw new FactoryAuthError('INVALID_CREDENTIALS', 401);
    return { uid: 'fixture-user', email: 'fixture@example.test', email_verified: true };
  }
  export async function findFactoryUserByUid(uid) {
    state.calls.push(['rbac', uid]);
    return state.user;
  }
  export async function createFirebaseSessionCookie() {
    state.calls.push('session');
    return 'synthetic-session';
  }
`);
const { state } = await import(doubles);
const { POST } = await import(compile("app/api/auth/login/route.ts", {
  "next/server": next,
  "@/src/server/auth/auth-boundary.ts": boundary,
  "@/src/server/auth/auth-service.ts": auth,
  "@/src/server/auth/auth-http.ts": http,
  "@/src/server/auth/firebase-admin.ts": doubles,
  "@/src/server/auth/access-repository.ts": doubles,
}));
const { POST: logout } = await import(compile("app/api/auth/logout/route.ts", {
  "next/server": next,
  "@/src/server/auth/auth-http.ts": http,
}));
const mutationAuth = asModule(`
  import { state } from ${JSON.stringify(doubles)};
  export async function readCurrentFactoryUser() { state.calls.push('read-session'); return state.user; }
`);
const mutationService = asModule(`
  import { state } from ${JSON.stringify(doubles)};
  export const productionModules = { fixture: 'fixture' };
  export class ProductionError extends Error {}
  export async function readProduction() { throw new Error('unexpected read'); }
  export async function saveProduction() { state.calls.push('save'); return {}; }
`);
const { POST: mutate } = await import(compile("app/api/production-v1/route.ts", {
  "next/server": next,
  "@/src/server/auth/auth-http.ts": http,
  "@/src/server/auth/auth-service.ts": auth,
  "@/src/server/auth/server-auth.ts": mutationAuth,
  "@/src/server/production-v1.ts": mutationService,
}));

const nodeEnv = process.env.NODE_ENV;
const appOriginEnv = process.env.FACTORY_APP_ORIGIN;
let warnings;
beforeEach((t) => {
  process.env.NODE_ENV = "production";
  process.env.FACTORY_APP_ORIGIN = browserOrigin;
  warnings = t.mock.method(console, "warn", () => {});
  state.calls = [];
  state.verified = true;
  state.user = null;
});
afterEach(() => {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  if (appOriginEnv === undefined) delete process.env.FACTORY_APP_ORIGIN;
  else process.env.FACTORY_APP_ORIGIN = appOriginEnv;
});

function loginRequest(origin = browserOrigin, overrides = {}, requestOrigin = "https://0.0.0.0:8080") {
  const headers = new Headers({
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
    cookie: `ionflow_factory_csrf=${csrf}`,
    "x-csrf-token": csrf,
    ...overrides,
  });
  if (origin !== null) headers.set("origin", origin);
  return new NextRequest(`${requestOrigin}/api/auth/login`, {
    method: "POST", headers, body: JSON.stringify({ idToken: "synthetic-id-token" }),
  });
}

const denied = (error) => error.status === 403 && error.code === "ACCESS_DENIED";
const deniedFor = (reason) => (error) => denied(error) && error.reason === reason;

test("Cloud Run standalone NextRequest uses internal origin, but the public production origin passes both gates", async () => {
  const hostname = new URL(browserOrigin).hostname;
  const req = Object.assign(new PassThrough(), {
    method: "POST", url: "/api/auth/login", socket: {},
    headers: Object.fromEntries(loginRequest(browserOrigin, {
      host: hostname, "x-forwarded-host": hostname, "x-forwarded-proto": "https", "content-length": "991",
    }).headers),
  });
  const resolve = getResolveRoutes({
    buildId: "auth-test", headers: [], redirects: [], rewrites: { beforeFiles: [], afterFiles: [], fallback: [] },
    getMiddlewareMatchers: () => null, getItem: async () => ({ type: "appFile" }), onMatchHeaders: [],
  }, { experimental: { trustHostHeader: false }, useFileSystemPublicRoutes: true }, () => "", {
    hostname: "0.0.0.0", port: 8080,
  });
  await resolve({ req, isUpgradeReq: false });
  const request = NextRequestAdapter.fromNodeNextRequest(req, new AbortController().signal);
  assert.equal(new URL(request.url).origin, "https://0.0.0.0:8080");
  assert.doesNotThrow(() => assertCsrf(request));
  assert.doesNotThrow(() => assertTrustedAuthRequest(request));
});

test("production rejects external or missing origins and ignores spoofed Host and forwarding headers", () => {
  for (const origin of [null, attackerOrigin, "https://0.0.0.0:8080", `${browserOrigin}.untrusted.example`]) {
    const request = loginRequest(origin, {
      host: new URL(attackerOrigin).host,
      forwarded: "host=untrusted.example;proto=https",
      "x-forwarded-host": "untrusted.example",
      "x-forwarded-proto": "https",
    }, attackerOrigin);
    assert.throws(() => assertTrustedAuthRequest(request), deniedFor(origin === null ? "origin_missing" : "origin_mismatch"));
  }
  assert.throws(() => assertTrustedAuthRequest(loginRequest(browserOrigin, { "sec-fetch-site": "cross-site" })), deniedFor("fetch_site_invalid"));
  for (const length of ["12001", "invalid"])
    assert.throws(() => assertTrustedAuthRequest(loginRequest(browserOrigin, { "content-length": length })), deniedFor("content_length_invalid"));
});

test("production origin normalizes only root HTTPS URLs and fails closed on absent or invalid config", () => {
  process.env.FACTORY_APP_ORIGIN = ` ${browserOrigin.toUpperCase()}:443/ `;
  assert.doesNotThrow(() => assertTrustedAuthRequest(loginRequest()));
  for (const value of [undefined, "", "http://example.com", "https://", "*", "https://*.example.com", "https://%2a.example.com", "https://user:pass@example.test", "https://@example.test", `${browserOrigin}/path`, `${browserOrigin}/a/..`, `${browserOrigin}/%2e`, `${browserOrigin}?`, `${browserOrigin}#`, `${browserOrigin}?x=1`, `${browserOrigin}#fragment`, `${browserOrigin}\\`]) {
    if (value === undefined) delete process.env.FACTORY_APP_ORIGIN;
    else process.env.FACTORY_APP_ORIGIN = value;
    const request = loginRequest(browserOrigin, { host: new URL(browserOrigin).host }, browserOrigin);
    assert.throws(() => assertTrustedAuthRequest(request), deniedFor("origin_config_invalid"), JSON.stringify(value));
  }
});

test("CSRF requires both matching tokens even when production origin is valid", async () => {
  assert.doesNotThrow(() => assertTrustedAuthRequest(loginRequest()));
  assert.doesNotThrow(() => assertCsrf(loginRequest()));
  for (const [headers, reason] of [
    [{ cookie: "" }, "csrf_missing"],
    [{ "x-csrf-token": "" }, "csrf_missing"],
    [{ "x-csrf-token": "malformed" }, "csrf_invalid"],
    [{ cookie: `ionflow_factory_csrf=${csrf}%0A` }, "csrf_invalid"],
    [{ "x-csrf-token": "b".repeat(43) }, "csrf_mismatch"],
  ]) {
    const request = loginRequest(browserOrigin, headers);
    assert.throws(() => assertCsrf(request), deniedFor(reason));
    assert.equal((await POST(request)).status, 403);
  }
  assert.deepEqual(state.calls, []);
});

test("only Login logs the fixed reason and a validated trace ID without altering the public error", async () => {
  const traceId = "0123456789abcdef0123456789abcdef";
  const sensitive = {
    authorization: "Bearer synthetic-auth-secret",
    cookie: "ionflow_factory_csrf=synthetic-cookie-secret",
    "x-csrf-token": "synthetic-header-secret",
    "x-cloud-trace-context": `${traceId}/42;o=1`,
  };
  const response = await POST(loginRequest(attackerOrigin, sensitive));
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { ok: false, code: "ACCESS_DENIED", message: "บัญชีนี้ไม่มีสิทธิ์ดำเนินการ" });
  assert.equal((await POST(loginRequest(browserOrigin, { ...sensitive, "x-cloud-trace-context": `${traceId}/bad-sensitive-value` }))).status, 403);
  assert.deepEqual(warnings.mock.calls.map(({ arguments: args }) => args), [
    [JSON.stringify({ reason: "origin_mismatch", traceId })],
    [JSON.stringify({ reason: "csrf_invalid" })],
  ]);
  assert.deepEqual(state.calls, []);
});

test("Logout and a shared mutation route still enforce both gates without Login diagnostics", async () => {
  const mutationRequest = (origin, headers) => new NextRequest("https://0.0.0.0:8080/api/production-v1?area=fixture", {
    method: "POST", headers: loginRequest(origin, headers).headers, body: "{}",
  });
  for (const [origin, headers] of [[attackerOrigin, {}], [browserOrigin, { "x-csrf-token": "" }]]) {
    assert.equal((await logout(loginRequest(origin, headers))).status, 403);
    assert.equal((await mutate(mutationRequest(origin, headers))).status, 403);
  }
  assert.deepEqual(state.calls, []);
  const response = await logout(loginRequest());
  assert.equal(response.status, 200);
  assert.equal(response.cookies.get("ionflow_factory_session")?.maxAge, 0);
  assert.equal(response.cookies.get("ionflow_factory_csrf")?.maxAge, 0);
  assert.equal((await mutate(mutationRequest(browserOrigin, { "content-length": "12001" }))).status, 401);
  assert.deepEqual(state.calls, ["read-session"]);
  state.user = { id: "fixture-user" };
  assert.equal((await mutate(mutationRequest(browserOrigin, { "content-length": "12001" }))).status, 200);
  assert.deepEqual(state.calls, ["read-session", "read-session", "save"]);
  assert.equal(warnings.mock.calls.length, 0);
});

test("login still requires Firebase verification and active Factory RBAC before creating a session", async () => {
  assert.equal((await POST(loginRequest(attackerOrigin))).status, 403);
  assert.deepEqual(state.calls, []);
  state.verified = false;
  assert.equal((await POST(loginRequest())).status, 401);
  assert.deepEqual(state.calls, ["verify"]);
  state.verified = true;
  state.calls = [];
  assert.equal((await POST(loginRequest())).status, 401);
  assert.deepEqual(state.calls, ["verify", ["rbac", "fixture-user"]]);
  state.calls = [];
  state.user = { id: "fixture-user", roles: ["factory_user"], modules: ["dashboard"] };
  const response = await POST(loginRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls, ["verify", ["rbac", "fixture-user"], "session"]);
  const session = response.cookies.get("ionflow_factory_session");
  assert.equal(session?.httpOnly, true);
  assert.equal(session?.sameSite, "strict");
});

test("local development retains request-origin and CSRF validation", () => {
  process.env.NODE_ENV = "development";
  delete process.env.FACTORY_APP_ORIGIN;
  const local = "http://localhost:3000";
  const request = loginRequest(local, {}, local);
  assert.doesNotThrow(() => assertTrustedAuthRequest(request));
  assert.doesNotThrow(() => assertCsrf(request));
  assert.throws(() => assertTrustedAuthRequest(loginRequest(browserOrigin, {}, local)), denied);
});
