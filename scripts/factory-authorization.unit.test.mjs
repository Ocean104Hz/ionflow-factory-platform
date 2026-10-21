import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createFactoryAuthorizer, assertFactoryAccess } from "../src/server/factory-authorization.ts";
import { authorizedInventoryScope, readPersistentInventory } from "../src/server/inventory/inventory-repository.ts";
import { requirePersistentAccess } from "../src/server/persistent-access.ts";

// Test doubles only; no actual token verification, provider registration or persistent access.
const identity = { subject: "user-a", issuer: "test-issuer", audience: "factory-test", sessionId: "session-a", expiresAt: "2099-01-01T00:00:00Z", revoked: false };
const membership = { subject: "user-a", issuer: "test-issuer", tenantId: "tenant-a", organizationId: "org-a", active: true, validUntil: "2098-01-01T00:00:00Z", siteIds: ["site-a", "site-b"], roles: ["reader"], permissions: ["inventory.read"] };
const request = { credential: "fictional-token", tenantId: "tenant-a", organizationId: "org-a", siteIds: ["site-a"], permission: "inventory.read" };
const trust = { issuer: "test-issuer", audience: "factory-test" };
function fixture(session = identity, member = membership) {
  const calls = [];
  const authorize = createFactoryAuthorizer({
    async verifySession() { calls.push("verify"); return structuredClone(session); },
    async resolveMembership(user, tenant, org) { calls.push(["membership", user.subject, tenant, org]); return structuredClone(member); },
  }, trust);
  return { authorize, calls };
}
const denied = (error) => error.code === "ACCESS_DENIED" && error.cause === undefined;
test("missing identity and invalid/expired/revoked sessions deny before membership resolution", async () => {
  const empty = fixture();
  await assert.rejects(empty.authorize({ ...request, credential: "" }), denied);
  assert.deepEqual(empty.calls, []);
  for (const session of [null, {}, { ...identity, issuer: "other" }, { ...identity, audience: "other" },
    { ...identity, revoked: true }, { ...identity, expiresAt: "2000-01-01T00:00:00Z" },
    { ...identity, expiresAt: "bad" }, { ...identity, subject: "" }]) {
    const f = fixture(session);
    await assert.rejects(f.authorize(request), denied);
    assert.deepEqual(f.calls, ["verify"]);
  }
});
test("missing, inactive, expired or mismatched trusted membership denies", async () => {
  for (const member of [null, { ...membership, active: false }, { ...membership, subject: "other" },
    { ...membership, issuer: "other" }, { ...membership, tenantId: "other" },
    { ...membership, organizationId: "other" }, { ...membership, validUntil: "bad" },
    { ...membership, validUntil: "2000-01-01T00:00:00Z" }])
    await assert.rejects(fixture(identity, member).authorize(request), denied);
});
test("browser tenant/org/site selectors never grant access", async () => {
  for (const patch of [{ tenantId: "other" }, { organizationId: "other" }, { siteIds: ["other"] },
    { siteIds: ["site-a", "other"] }, { siteIds: [] }, { siteIds: [""] }])
    await assert.rejects(fixture().authorize({ ...request, ...patch }), denied);
});
test("roles do not confer write permission or permit wildcard/unknown permissions", async () => {
  await assert.rejects(fixture().authorize({ ...request, permission: "inventory.post" }), denied);
  await assert.rejects(fixture(identity, { ...membership, roles: ["Admin"], permissions: [] }).authorize(request), denied);
  await assert.rejects(fixture(identity, { ...membership, permissions: ["*"] }).authorize(request), denied);
  await assert.rejects(fixture().authorize({ ...request, permission: "*" }), denied);
});
test("verified scope propagates immutably in verify-membership-permission order", async () => {
  const f = fixture();
  const context = await f.authorize(request);
  assert.deepEqual(f.calls, ["verify", ["membership", "user-a", "tenant-a", "org-a"]]);
  assert.equal(context.subject, identity.subject);
  assert.equal(context.sessionId, identity.sessionId);
  assert.equal(context.sessionExpiresAt, new Date(membership.validUntil).toISOString());
  assert.deepEqual(authorizedInventoryScope(context), { tenantId: "tenant-a", organizationId: "org-a", siteIds: ["site-a"] });
  assert.ok(Object.isFrozen(context) && Object.isFrozen(context.siteIds) && Object.isFrozen(context.roles));
  assert.throws(() => assertFactoryAccess({ ...context }, "inventory.read"), denied);
  assert.throws(() => assertFactoryAccess(context, "inventory.post"), denied);
  const write = await fixture(identity, { ...membership, permissions: ["inventory.post"] }).authorize({ ...request, permission: "inventory.post" });
  assert.doesNotThrow(() => assertFactoryAccess(write, "inventory.post"));
  assert.throws(() => authorizedInventoryScope(write), denied);
});
test("mutable request selectors cannot change scope while identity verification awaits", async () => {
  const mutable = structuredClone(request);
  const authorize = createFactoryAuthorizer({
    async verifySession() {
      mutable.tenantId = "other";
      mutable.siteIds.push("other");
      mutable.permission = "inventory.post";
      return identity;
    },
    async resolveMembership() { return membership; },
  }, trust);
  const context = await authorize(mutable);
  assert.equal(context.tenantId, "tenant-a");
  assert.equal(context.permission, "inventory.read");
  assert.deepEqual(authorizedInventoryScope(context).siteIds, ["site-a"]);
});
test("invalid trust and provider failures deny without exposing credentials", async () => {
  const secret = "fictional-secret-should-not-leak";
  const adapters = { async verifySession() { throw new Error(secret); }, async resolveMembership() { throw new Error(secret); } };
  for (const config of [trust, { issuer: "", audience: "" }]) {
    await assert.rejects(createFactoryAuthorizer(adapters, config)(request), (error) => {
      assert.ok(denied(error));
      assert.ok(!`${error.stack} ${JSON.stringify(error)}`.includes(secret));
      return true;
    });
  }
  await assert.rejects(createFactoryAuthorizer({ async verifySession() { return identity; }, async resolveMembership() { throw Error(secret); } }, trust)(request), denied);
});
test("production identity entry and persistent repository remain disabled", async () => {
  await assert.rejects(requirePersistentAccess(), (e) => e.code === "AUTH_NOT_CONFIGURED");
  let calls = 0;
  await assert.rejects(readPersistentInventory({ readSnapshot() { calls++; throw Error("not permitted"); } }), (e) => e.code === "AUTH_NOT_CONFIGURED");
  assert.equal(calls, 0);
});
test("changed authorization and repository contracts pass scoped strict semantic checks", () => {
  const program = ts.createProgram([fileURLToPath(new URL("../src/server/factory-authorization.ts", import.meta.url)), fileURLToPath(new URL("../src/server/inventory/inventory-repository.ts", import.meta.url))], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true, skipLibCheck: true, esModuleInterop: true, noEmit: true, allowImportingTsExtensions: true, types: ["node"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, { getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (f) => f, getNewLine: () => "\n" }));
});
