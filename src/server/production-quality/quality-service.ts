import "server-only";
import { FactoryAuthError, requireFactoryModule, requireFactoryRole, type AuthenticatedFactoryUser } from "../auth/auth-service";
import { readCurrentFactoryUser } from "../auth/server-auth";
import { object, parseQualityInput, readId, readVersion, type QualityRecord } from "../../features/production-quality/production-quality-contract";
import { getQualityRepository, type QualityRepository, type QualityActor } from "./quality-repository";

export function createQualityService(deps: { readUser(): Promise<AuthenticatedFactoryUser | null>; getRepository(): QualityRepository }) {
  async function actor(): Promise<QualityActor> {
    const user = await deps.readUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS",401);
    requireFactoryModule(user,"production_quality");
    requireFactoryRole(user,"factory_admin");
    return { id:user.id, displayName:user.displayName };
  }
  return {
    async list(): Promise<QualityRecord[]> { await actor(); return deps.getRepository().list(); },
    async get(id: unknown) { await actor(); return deps.getRepository().get(readId(id)); },
    async create(payload: unknown) { const who = await actor(); const input = parseQualityInput(payload); return deps.getRepository().create(input,who); },
    async update(id: unknown,payload: unknown) { const who = await actor(); const documentId = readId(id); const b = object(payload,"body"); const version = readVersion(b.version); const input = parseQualityInput(b); return deps.getRepository().update(documentId,version,input,who); },
    async archive(id: unknown,payload: unknown) { const who = await actor(); const documentId = readId(id); const version = readVersion(object(payload,"body").version); await deps.getRepository().archive(documentId,version,who); },
  };
}
export const qualityService = createQualityService({readUser:readCurrentFactoryUser,getRepository:getQualityRepository});
