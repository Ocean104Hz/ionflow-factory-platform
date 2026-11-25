import "server-only";
import { FactoryAuthError } from "./auth-service.ts";

export function assertTrustedAuthRequest(request: Request): void {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const contentLength = request.headers.get("content-length");
  if (
    !origin ||
    origin !== url.origin ||
    (request.headers.get("sec-fetch-site") !== null &&
      request.headers.get("sec-fetch-site") !== "same-origin") ||
    (contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > 12_000))
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}
