import "server-only";

export type InventoryPermission = "inventory.read" | "inventory.post";
/** Output of a cryptographic/session verifier, never decoded browser claims. */
export type VerifiedFactorySession = Readonly<{
  subject: string;
  issuer: string;
  audience: string;
  sessionId: string;
  expiresAt: string;
  revoked: boolean;
}>;
/** Must come from an authoritative membership lookup keyed by issuer + subject. */
export type FactoryMembership = Readonly<{
  subject: string;
  issuer: string;
  tenantId: string;
  organizationId: string;
  active: boolean;
  validUntil: string;
  siteIds: readonly string[];
  roles: readonly string[];
  permissions: readonly InventoryPermission[];
}>;
export interface FactoryIdentityAdapters {
  verifySession(credential: string): Promise<VerifiedFactorySession | null>;
  resolveMembership(
    identity: VerifiedFactorySession,
    requestedTenant: string,
    requestedOrganization: string,
  ): Promise<FactoryMembership | null>;
}
export type FactoryAccessRequest = Readonly<{
  credential: string;
  tenantId: string;
  organizationId: string;
  siteIds: readonly string[];
  permission: InventoryPermission;
}>;
export type AuthorizedFactoryContext = Readonly<{
  subject: string;
  issuer: string;
  tenantId: string;
  organizationId: string;
  sessionId: string;
  sessionExpiresAt: string;
  roles: readonly string[];
  siteIds: readonly string[];
  permission: InventoryPermission;
}>;
export class FactoryAccessDenied extends Error {
  readonly code = "ACCESS_DENIED";
  constructor() {
    super("ไม่สามารถยืนยันตัวตนหรือสิทธิ์เข้าถึงข้อมูลโรงงาน");
    this.name = "FactoryAccessDenied";
  }
}
const issuedContexts = new WeakSet<object>();
const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(nonempty);
const permissionValid = (value: unknown): value is InventoryPermission =>
  value === "inventory.read" || value === "inventory.post";
const expiry = (value: unknown) => typeof value === "string" ? Date.parse(value) : NaN;
function deny(): never { throw new FactoryAccessDenied(); }

/** Server composition only. No production adapter is configured or registered here. */
export function createFactoryAuthorizer(
  adapters: FactoryIdentityAdapters,
  trust: Readonly<{ issuer: string; audience: string }>,
) {
  // Copy approved trust settings; later caller mutations must not change verification policy.
  const { issuer, audience } = trust;
  return async (request: FactoryAccessRequest): Promise<AuthorizedFactoryContext> => {
    try {
      if (!nonempty(issuer) || !nonempty(audience) || !nonempty(request.credential) ||
          !nonempty(request.tenantId) || !nonempty(request.organizationId) ||
          !strings(request.siteIds) || !request.siteIds.length || !permissionValid(request.permission)) return deny();
      // Snapshot selectors before awaiting a provider; the browser grants no authority.
      const { tenantId, organizationId, permission } = request;
      const siteIds = [...new Set(request.siteIds)];
      const verified = await adapters.verifySession(request.credential);
      if (!verified || !nonempty(verified.subject) || !nonempty(verified.sessionId) ||
          verified.issuer !== issuer || verified.audience !== audience || verified.revoked !== false ||
          !Number.isFinite(expiry(verified.expiresAt)) || expiry(verified.expiresAt) <= Date.now()) return deny();
      const identity = Object.freeze({ ...verified });
      const membership = await adapters.resolveMembership(identity, tenantId, organizationId);
      if (!membership || membership.active !== true || membership.subject !== identity.subject ||
          membership.issuer !== identity.issuer || membership.tenantId !== tenantId ||
          membership.organizationId !== organizationId || !strings(membership.roles) ||
          !strings(membership.siteIds) || !strings(membership.permissions) ||
          !membership.permissions.every(permissionValid) || !membership.permissions.includes(permission) ||
          !siteIds.every((id) => membership.siteIds.includes(id))) return deny();
      const expiresAt = Math.min(expiry(identity.expiresAt), expiry(membership.validUntil));
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return deny();
      const context: AuthorizedFactoryContext = Object.freeze({
        subject: identity.subject, issuer: identity.issuer, sessionId: identity.sessionId,
        sessionExpiresAt: new Date(expiresAt).toISOString(), tenantId, organizationId,
        roles: Object.freeze([...membership.roles]), siteIds: Object.freeze(siteIds), permission,
      });
      issuedContexts.add(context);
      return context;
    } catch {
      // Adapter errors may contain tokens, upstream URLs or identity-provider details.
      return deny();
    }
  };
}

/** Request-local capability: a plain object, cloned context or changed permission is denied. */
export function assertFactoryAccess(
  context: AuthorizedFactoryContext,
  permission: InventoryPermission,
): void {
  if (!context || !issuedContexts.has(context) || context.permission !== permission ||
      expiry(context.sessionExpiresAt) <= Date.now()) return deny();
}
