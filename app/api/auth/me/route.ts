import { NextResponse } from "next/server";
import { FactoryAuthError } from "@/src/server/auth/auth-service.ts";
import { authErrorResponse, publicUser } from "@/src/server/auth/auth-http.ts";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth.ts";

export async function GET() {
  try {
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    return NextResponse.json(
      { ok: true, user: publicUser(user) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
