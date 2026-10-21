import "server-only";
import { BackendError } from "./database/config.ts";

/** Contract only: populate exclusively from an approved server-verified identity/session adapter. */
export interface VerifiedFactoryActor {
  subject: string;
  issuer: string;
  tenantId: string;
  organizationId: string;
  sessionExpiresAt: string;
  permissions: readonly string[];
}
export async function requirePersistentAccess(): Promise<VerifiedFactoryActor> {
  // Fail closed until identity ownership, membership and server-side permissions are approved.
  throw new BackendError("AUTH_NOT_CONFIGURED");
}
