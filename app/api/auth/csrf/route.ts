import { NextResponse } from "next/server";
import {
  CSRF_COOKIE,
  csrfCookieOptions,
} from "@/src/server/auth/auth-http.ts";
import { createCsrfToken } from "@/src/server/auth/auth-service.ts";

export async function GET() {
  const csrfToken = createCsrfToken();
  const response = NextResponse.json(
    { ok: true, csrfToken },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(CSRF_COOKIE, csrfToken, {
    ...csrfCookieOptions,
    maxAge: 60 * 60,
  });
  return response;
}
