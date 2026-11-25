import { authenticateHub } from "@/src/server/sales-hub/auth";
import { readHubDeliveryEvidence } from "@/src/server/sales-hub/delivery";
import { HubIntegrationError } from "@/src/server/sales-hub/errors";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ id: string; attachment: string }> }) {
  try {
    await authenticateHub(request);
    const { id, attachment } = await context.params;
    const params = new URL(request.url).searchParams;
    const file = await readHubDeliveryEvidence(id, attachment, params.get("hubOrderId"), params.get("routeId"), params.get("factoryCode"));
    if (!file) return new Response(null, { headers, status: 404 });
    return new Response(Uint8Array.from(file.content), { headers: {
      ...headers, "Content-Type": file.mime_type, "Content-Length": String(file.content.length),
      "Content-Disposition": "attachment", "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    return new Response(null, { headers, status: error instanceof HubIntegrationError ? error.status : 503 });
  }
}
