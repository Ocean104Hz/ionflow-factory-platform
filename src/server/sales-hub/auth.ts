import "server-only";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { HubIntegrationError } from "./errors.ts";

const verifier = new OAuth2Client();
export function setting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new HubIntegrationError("CONFIGURATION_ERROR", `Missing ${name}`, 503);
  return value;
}

export async function authenticateHub(request: Request, scheduler = false) {
  if (process.env.CENTRAL_HUB_INTEGRATION_ENABLED !== "true")
    throw new HubIntegrationError("CONFIGURATION_ERROR", "Sales Hub integration is disabled", 503);
  const audience = setting("CENTRAL_HUB_INBOUND_AUDIENCE");
  const email = setting(scheduler ? "CENTRAL_HUB_SCHEDULER_CALLER_EMAIL" : "CENTRAL_HUB_ALLOWED_CALLER_EMAIL").toLowerCase();
  const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new HubIntegrationError("INVALID_AUTH", "Authentication required", 401);
  const claims = await verifier.verifyIdToken({ idToken: token, audience }).then((ticket) => ticket.getPayload()).catch(() => null);
  if (!claims) throw new HubIntegrationError("INVALID_AUTH", "Authentication required", 401);
  if (claims.aud !== audience || !claims.email_verified || claims.email?.toLowerCase() !== email)
    throw new HubIntegrationError("FORBIDDEN_CALLER", "Access denied", 403);
  return email;
}

export async function deliverToHub(envelope: { event_id: string }) {
  const url = new URL(setting("CENTRAL_HUB_EVENT_CALLBACK_URL"));
  const audience = setting("CENTRAL_HUB_EVENT_CALLBACK_AUDIENCE");
  if (url.protocol !== "https:" || url.origin !== audience || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/api/internal/v1/factory-events")
    throw new HubIntegrationError("CONFIGURATION_ERROR", "Invalid callback URL", 503);
  const client = await new GoogleAuth().getIdTokenClient(audience);
  const token = await client.idTokenProvider.fetchIdToken(audience);
  return fetch(url, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "idempotency-key": envelope.event_id },
    body: JSON.stringify(envelope),
  });
}
