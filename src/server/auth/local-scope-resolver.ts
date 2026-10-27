import "server-only";
import { createSettingsStore } from "../settings-postgres.ts";
import { FactoryAuthError } from "./auth-service.ts";

export type TrustedSiteSelector = Readonly<{
  authority: string;
  id: string;
}>;

export type TrustedScopeSelector = Readonly<{
  tenantAuthority: string;
  tenantId: string;
  organizationAuthority: string;
  organizationId: string;
  sites: readonly TrustedSiteSelector[];
}>;

export type ResolvedTrustedScope = TrustedScopeSelector &
  Readonly<{ provenance: string }>;

export interface TrustedScopeResolver {
  resolve(selector: TrustedScopeSelector): Promise<ResolvedTrustedScope>;
}

export interface AuthoritativeSiteDirectory {
  findSite(id: string): Promise<Readonly<{ id: string; active: boolean }> | null>;
}

type Registry = Readonly<{
  provenance: string;
  settingsSiteAuthority: string;
  tenant: Readonly<{ authority: string; id: string; active: boolean }>;
  organization: Readonly<{
    authority: string;
    id: string;
    tenantAuthority: string;
    tenantId: string;
    active: boolean;
  }>;
  sites: readonly Readonly<{
    authority: string;
    id: string;
    organizationAuthority: string;
    organizationId: string;
    active: boolean;
  }>[];
}>;

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const identifier = (value: unknown, max = 200): value is string =>
  typeof value === "string" &&
  value.length <= max &&
  /^[A-Za-z0-9][A-Za-z0-9:._/-]*$/.test(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

function readRegistry(
  env: Readonly<Record<string, string | undefined>>,
): Registry {
  if (
    env.NODE_ENV === "production" ||
    env.FACTORY_AUTH_LOCAL_SCOPE_ENABLED !== "true" ||
    !env.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY ||
    env.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY.length > 16_384
  )
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  let raw: unknown;
  try {
    raw = JSON.parse(env.FACTORY_AUTH_LOCAL_SCOPE_REGISTRY);
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
  if (
    !object(raw) ||
    !exactKeys(raw, [
      "provenance",
      "settingsSiteAuthority",
      "tenant",
      "organization",
      "sites",
    ]) ||
    !identifier(raw.provenance) ||
    !identifier(raw.settingsSiteAuthority, 100) ||
    !object(raw.tenant) ||
    !exactKeys(raw.tenant, ["authority", "id", "active"]) ||
    !identifier(raw.tenant.authority, 100) ||
    !identifier(raw.tenant.id) ||
    typeof raw.tenant.active !== "boolean" ||
    !object(raw.organization) ||
    !exactKeys(raw.organization, [
      "authority",
      "id",
      "tenantAuthority",
      "tenantId",
      "active",
    ]) ||
    !identifier(raw.organization.authority, 100) ||
    !identifier(raw.organization.id) ||
    !identifier(raw.organization.tenantAuthority, 100) ||
    !identifier(raw.organization.tenantId) ||
    typeof raw.organization.active !== "boolean" ||
    !Array.isArray(raw.sites) ||
    raw.sites.length === 0 ||
    raw.sites.length > 100
  )
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const sites = raw.sites.map((site) => {
    if (
      !object(site) ||
      !exactKeys(site, [
        "authority",
        "id",
        "organizationAuthority",
        "organizationId",
        "active",
      ]) ||
      !identifier(site.authority, 100) ||
      !identifier(site.id) ||
      !identifier(site.organizationAuthority, 100) ||
      !identifier(site.organizationId) ||
      typeof site.active !== "boolean"
    )
      throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
    return Object.freeze({
      authority: site.authority,
      id: site.id,
      organizationAuthority: site.organizationAuthority,
      organizationId: site.organizationId,
      active: site.active,
    });
  });
  const keys = sites.map((site) => `${site.authority}\0${site.id}`);
  if (new Set(keys).size !== keys.length)
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  return Object.freeze({
    provenance: raw.provenance,
    settingsSiteAuthority: raw.settingsSiteAuthority,
    tenant: Object.freeze({
      authority: raw.tenant.authority,
      id: raw.tenant.id,
      active: raw.tenant.active,
    }),
    organization: Object.freeze({
      authority: raw.organization.authority,
      id: raw.organization.id,
      tenantAuthority: raw.organization.tenantAuthority,
      tenantId: raw.organization.tenantId,
      active: raw.organization.active,
    }),
    sites: Object.freeze(sites),
  });
}

export function createTrustedLocalScopeResolver(
  env: Readonly<Record<string, string | undefined>>,
  directory: AuthoritativeSiteDirectory,
): TrustedScopeResolver {
  return Object.freeze({
    async resolve(selector: TrustedScopeSelector) {
      const registry = readRegistry(env);
      const tenantMatches =
        registry.tenant.active &&
        selector.tenantAuthority === registry.tenant.authority &&
        selector.tenantId === registry.tenant.id;
      const organizationMatches =
        registry.organization.active &&
        registry.organization.tenantAuthority === registry.tenant.authority &&
        registry.organization.tenantId === registry.tenant.id &&
        selector.organizationAuthority === registry.organization.authority &&
        selector.organizationId === registry.organization.id;
      const requestedKeys = selector.sites.map(
        (site) => `${site.authority}\0${site.id}`,
      );
      if (
        !tenantMatches ||
        !organizationMatches ||
        selector.sites.length === 0 ||
        new Set(requestedKeys).size !== requestedKeys.length
      )
        throw new FactoryAuthError("ACCESS_DENIED", 403);
      for (const requested of selector.sites) {
        const mapped = registry.sites.filter(
          (site) =>
            site.authority === requested.authority && site.id === requested.id,
        );
        if (
          mapped.length !== 1 ||
          mapped[0].authority !== registry.settingsSiteAuthority ||
          mapped[0].organizationAuthority !== registry.organization.authority ||
          mapped[0].organizationId !== registry.organization.id ||
          !mapped[0].active
        )
          throw new FactoryAuthError("ACCESS_DENIED", 403);
        let site: Awaited<ReturnType<AuthoritativeSiteDirectory["findSite"]>>;
        try {
          site = await directory.findSite(requested.id);
        } catch {
          throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
        }
        if (!site || site.id !== requested.id || !site.active)
          throw new FactoryAuthError("ACCESS_DENIED", 403);
      }
      return Object.freeze({
        provenance: registry.provenance,
        tenantAuthority: registry.tenant.authority,
        tenantId: registry.tenant.id,
        organizationAuthority: registry.organization.authority,
        organizationId: registry.organization.id,
        sites: Object.freeze(
          selector.sites.map((site) => Object.freeze({ ...site })),
        ),
      });
    },
  });
}

const settingsDirectory: AuthoritativeSiteDirectory = Object.freeze({
  async findSite(id: string) {
    let store: ReturnType<typeof createSettingsStore> | undefined;
    try {
      store = createSettingsStore();
      const snapshot = await store.read();
      const matches = snapshot.rows.filter(
        (row) => row.kind === "sites" && row.id === id,
      );
      if (matches.length !== 1) return null;
      return { id: matches[0].id, active: matches[0].active };
    } catch {
      throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
    } finally {
      await store?.close().catch(() => {});
    }
  },
});

export function getTrustedLocalScopeResolver(): TrustedScopeResolver {
  return createTrustedLocalScopeResolver(process.env, settingsDirectory);
}
