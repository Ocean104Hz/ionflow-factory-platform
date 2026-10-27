import "server-only";
import { FactoryAuthError } from "./auth-service.ts";

export function readAuthAppOrigin(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (env.NODE_ENV === "production")
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  const raw = env.FACTORY_AUTH_APP_ORIGIN ?? "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  }
  if (
    url.origin !== raw ||
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new FactoryAuthError("AUTH_UNAVAILABLE", 503);
  return url.origin;
}

export function assertLocalAuthRequestHost(
  requestHeaders: Pick<Headers, "get" | "has">,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const expected = new URL(readAuthAppOrigin(env));
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const hasForwardedHeaders =
    forwardedHost !== null ||
    forwardedProto !== null ||
    forwardedFor !== null;
  // Next.js 16 synthesizes this exact trio even for a direct loopback dev request.
  const exactNextDevelopmentForwarding =
    env.NODE_ENV === "development" &&
    env.FACTORY_DEV_AUTH_ENABLED === "true" &&
    forwardedHost === expected.host &&
    forwardedProto === expected.protocol.slice(0, -1) &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      forwardedFor ?? "",
    );
  if (
    requestHeaders.get("host") !== expected.host ||
    requestHeaders.has("forwarded") ||
    (hasForwardedHeaders && !exactNextDevelopmentForwarding)
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}

export function assertTrustedAuthRequest(
  request: Request,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const expected = new URL(readAuthAppOrigin(env));
  const requestUrl = new URL(request.url);
  const contentLength = request.headers.get("content-length");
  assertLocalAuthRequestHost(request.headers, env);
  if (
    request.headers.get("origin") !== expected.origin ||
    requestUrl.origin !== expected.origin ||
    (request.headers.get("sec-fetch-site") !== null &&
      request.headers.get("sec-fetch-site") !== "same-origin") ||
    (contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > 4096))
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}
