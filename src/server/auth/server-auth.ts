import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  FactoryAuthError,
  requireFactoryModule,
  requireFactoryRole,
  type AuthenticatedFactoryUser,
} from "./auth-service.ts";
import { SESSION_COOKIE } from "./auth-http.ts";
import { verifyFirebaseSessionCookie } from "./firebase-admin.ts";
import { findFactoryUserByUid } from "./access-repository.ts";

export async function readCurrentFactoryUser(): Promise<AuthenticatedFactoryUser | null> {
  await connection();
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  try {
    const decoded = await verifyFirebaseSessionCookie(session);
    return await findFactoryUserByUid(decoded.uid);
  } catch (error) {
    if (error instanceof FactoryAuthError) return null;
    throw error;
  }
}

export async function requireAuthenticatedFactoryUser(): Promise<AuthenticatedFactoryUser> {
  const user = await readCurrentFactoryUser();
  if (user) return user;
  redirect("/login");
}

export async function requireAuthenticatedFactoryModule(moduleKey: string) {
  const user = await requireAuthenticatedFactoryUser();
  requireFactoryModule(user, moduleKey);
  return user;
}

export async function requireAuthenticatedFactoryRole(roleCode: string) {
  const user = await requireAuthenticatedFactoryUser();
  requireFactoryRole(user, roleCode);
  return user;
}
