import "server-only";
import { FactoryAuthError } from "./auth-service.ts";

export function assertTrustedAuthRequest(request: Request, maxBytes = 12_000): void {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const contentLength = request.headers.get("content-length");
  if (
    !origin ||
    origin !== url.origin ||
    (request.headers.get("sec-fetch-site") !== null &&
      request.headers.get("sec-fetch-site") !== "same-origin") ||
    (contentLength !== null &&
      (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes))
  )
    throw new FactoryAuthError("ACCESS_DENIED", 403);
}
