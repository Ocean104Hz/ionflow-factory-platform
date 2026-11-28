import "server-only";
import { FactoryAuthError } from "./auth-service.ts";

export class FactoryAuthBoundaryError extends FactoryAuthError {
  constructor(readonly reason:
    | "origin_missing"
    | "origin_mismatch"
    | "origin_config_invalid"
    | "fetch_site_invalid"
    | "content_length_invalid"
    | "csrf_missing"
    | "csrf_invalid"
    | "csrf_mismatch",
  ) {
    super("ACCESS_DENIED", 403);
  }
}

function readProductionOrigin(): string {
  const value = process.env.FACTORY_APP_ORIGIN?.trim() ?? "";
  // Check the raw form as URL parsing can erase an empty query or dot segments.
  if (/^https:\/\/[^/?#\\@\s*%]+\/?$/i.test(value)) {
    const url = URL.parse(value);
    if (url?.protocol === "https:") return url.origin;
  }
  throw new FactoryAuthBoundaryError("origin_config_invalid");
}

export function assertTrustedAuthRequest(request: Request, maxBytes = 12_000): void {
  // Next standalone can derive request.url from the container's bind address.
  const trustedOrigin = process.env.NODE_ENV === "production"
    ? readProductionOrigin()
    : new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin) throw new FactoryAuthBoundaryError("origin_missing");
  if (origin !== trustedOrigin) throw new FactoryAuthBoundaryError("origin_mismatch");

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin")
    throw new FactoryAuthBoundaryError("fetch_site_invalid");

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > maxBytes))
    throw new FactoryAuthBoundaryError("content_length_invalid");
}
