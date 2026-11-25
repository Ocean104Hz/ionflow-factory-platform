import "server-only";
import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FactoryAuthError } from "./auth-service.ts";

const PROJECT_ID = "ionflow-central-identity";

function firebaseApp(): App {
  if (process.env.FIREBASE_PROJECT_ID !== PROJECT_ID)
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  try {
    return getApps().length
      ? getApp()
      : initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
}

export async function verifyFirebaseIdToken(
  idToken: unknown,
): Promise<DecodedIdToken> {
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 8192)
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  try {
    const decoded = await getAuth(firebaseApp()).verifyIdToken(idToken, true);
    const authAgeSeconds = Math.floor(Date.now() / 1000) - decoded.auth_time;
    if (authAgeSeconds < 0 || authAgeSeconds > 5 * 60)
      throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    return decoded;
  } catch (error) {
    if (error instanceof FactoryAuthError) throw error;
    throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  }
}

export async function createFirebaseSessionCookie(
  idToken: string,
  expiresIn: number,
): Promise<string> {
  try {
    return await getAuth(firebaseApp()).createSessionCookie(idToken, { expiresIn });
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
}

export async function verifyFirebaseSessionCookie(
  sessionCookie: string,
): Promise<DecodedIdToken> {
  if (!sessionCookie || sessionCookie.length > 8192)
    throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  try {
    return await getAuth(firebaseApp()).verifySessionCookie(sessionCookie, true);
  } catch {
    throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  }
}

export async function findFirebaseUserByEmail(email: string) {
  try {
    return await getAuth(firebaseApp()).getUserByEmail(email);
  } catch {
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  }
}
