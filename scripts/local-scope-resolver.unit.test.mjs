import assert from "node:assert/strict";
import test from "node:test";

import { FactoryAuthError } from "../src/server/auth/auth-service.ts";
import { createTrustedLocalScopeResolver } from "../src/server/auth/local-scope-resolver.ts";

const registry = {
  provenance: "approved:test-fixture",
  settingsSiteAuthority: "settings:test",
  tenant: { authority: "tenant:test", id: "tenant-a", active: true },
  organization: {
    authority: "organization:test",
    id: "org-a",
    tenantAuthority: "tenant:test",
    tenantId: "tenant-a",
    active: true,
  },
  sites: [
    {
      authority: "settings:test",
      id: "site-a",
      organizationAuthority: "organization:test",
      organizationId: "org-a",
      active: true,
    },
  ],
};
const env = (value = registry) => ({
  NODE_ENV: "development",
  FACTORY_AUTH_LOCAL_SCOPE_ENABLED: "true",
  FACTORY_AUTH_LOCAL_SCOPE_REGISTRY: JSON.stringify(value),
});
const selector = {
  tenantAuthority: "tenant:test",
  tenantId: "tenant-a",
  organizationAuthority: "organization:test",
  organizationId: "org-a",
  sites: [{ authority: "settings:test", id: "site-a" }],
};
const directory = (active = true) => ({
  async findSite(id) {
    return id === "site-a" ? { id, active } : null;
  },
});
const denied = (status) => (error) =>
  error instanceof FactoryAuthError && error.status === status;

test("resolver accepts only the approved active tenant, organization and Settings site", async () => {
  const result = await createTrustedLocalScopeResolver(env(), directory()).resolve(selector);
  assert.equal(result.provenance, "approved:test-fixture");
  assert.deepEqual(result.sites, selector.sites);
});

test("resolver rejects unknown tenant, organization, site and client supplied scope", async () => {
  const resolver = createTrustedLocalScopeResolver(env(), directory());
  for (const patch of [
    { tenantId: "tenant-unknown" },
    { organizationId: "org-unknown" },
    { sites: [{ authority: "settings:test", id: "site-unknown" }] },
    { tenantId: "client-selected-tenant", sites: selector.sites },
  ]) {
    await assert.rejects(resolver.resolve({ ...selector, ...patch }), denied(403));
  }
});

test("resolver rejects cross-organization and inactive configured sites", async () => {
  const crossOrganization = structuredClone(registry);
  crossOrganization.sites[0].organizationId = "org-b";
  await assert.rejects(
    createTrustedLocalScopeResolver(env(crossOrganization), directory()).resolve(selector),
    denied(403),
  );
  const inactive = structuredClone(registry);
  inactive.sites[0].active = false;
  await assert.rejects(
    createTrustedLocalScopeResolver(env(inactive), directory()).resolve(selector),
    denied(403),
  );
  await assert.rejects(
    createTrustedLocalScopeResolver(env(), directory(false)).resolve(selector),
    denied(403),
  );
});

test("resolver fails closed for missing, malformed or ambiguous configuration", async () => {
  await assert.rejects(
    createTrustedLocalScopeResolver({}, directory()).resolve(selector),
    denied(503),
  );
  const duplicate = structuredClone(registry);
  duplicate.sites.push(structuredClone(duplicate.sites[0]));
  await assert.rejects(
    createTrustedLocalScopeResolver(env(duplicate), directory()).resolve(selector),
    denied(503),
  );
  await assert.rejects(
    createTrustedLocalScopeResolver(
      { ...env(), FACTORY_AUTH_LOCAL_SCOPE_REGISTRY: "{" },
      directory(),
    ).resolve(selector),
    denied(503),
  );
});

test("resolver converts authoritative directory failures to AUTH_UNAVAILABLE", async () => {
  await assert.rejects(
    createTrustedLocalScopeResolver(env(), {
      async findSite() {
        throw new Error("database details must not escape");
      },
    }).resolve(selector),
    denied(503),
  );
});
