import { NextResponse, type NextRequest } from "next/server";
import {
  FactoryAuthError,
  requireFactoryRole,
} from "@/src/server/auth/auth-service.ts";
import {
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
} from "@/src/server/auth/auth-http.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";
import {
  findFirebaseUserByEmail,
  sendFirebasePasswordSetupEmail,
} from "@/src/server/auth/firebase-admin.ts";
import {
  findAccessUserUid,
  listAccessAdministration,
  saveAccessRole,
  saveAccessUser,
} from "@/src/server/auth/access-repository.ts";

async function requireAdmin() {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  requireFactoryRole(user, "factory_admin");
  return user;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") throw new FactoryAuthError("INVALID_REQUEST", 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > max)
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  return normalized;
}

function ids(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 200 ||
    !value.every((item) => typeof item === "string" && /^\d+$/.test(item))
  )
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  return [...new Set(value)];
}

function moduleKeys(value: unknown): readonly string[] {
  if (
    !Array.isArray(value) ||
    value.length > 200 ||
    !value.every(
      (item) => typeof item === "string" && /^[a-z][a-z0-9_]{1,99}$/.test(item),
    )
  )
    throw new FactoryAuthError("INVALID_REQUEST", 400);
  return [...new Set(value)];
}

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(
      { ok: true, ...(await listAccessAdministration()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request);
    assertCsrf(request);
    await requireAdmin();
    const body = await request.json().catch(() => null);
    if (body?.action === "saveUser") {
      const email = text(body.email, 320).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      const identity = await findFirebaseUserByEmail(email);
      if (identity.disabled || !identity.emailVerified)
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      if (
        body.firebaseUid !== undefined &&
        body.firebaseUid !== "" &&
        body.firebaseUid !== identity.uid
      )
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      await saveAccessUser({
        firebaseUid: identity.uid,
        email,
        displayName: text(body.displayName, 120),
        active: body.active === true,
        roleIds: ids(body.roleIds),
      });
    } else if (body?.action === "sendPasswordSetup") {
      const id = text(body.id, 19);
      if (!/^[1-9]\d*$/.test(id) || BigInt(id) > BigInt("9223372036854775807"))
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      const uid = await findAccessUserUid(id);
      if (!uid) throw new FactoryAuthError("INVALID_REQUEST", 400);
      await sendFirebasePasswordSetupEmail(uid);
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } else if (body?.action === "saveRole") {
      const code = text(body.code, 63).toLowerCase();
      if (!/^[a-z][a-z0-9_]{1,62}$/.test(code))
        throw new FactoryAuthError("INVALID_REQUEST", 400);
      await saveAccessRole({
        id: body.id === undefined ? undefined : text(body.id, 20),
        code,
        name: text(body.name, 100),
        active: body.active === true,
        moduleKeys: moduleKeys(body.moduleKeys).filter((key) => key !== "settings"),
      });
    } else {
      throw new FactoryAuthError("INVALID_REQUEST", 400);
    }
    return NextResponse.json(
      { ok: true, ...(await listAccessAdministration()) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
