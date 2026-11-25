import { NextResponse } from "next/server";
import { authenticateHub } from "@/src/server/sales-hub/auth";
import { parseHubProduct, parseHubProductionOrderCommand, readHubJson } from "@/src/server/sales-hub/contract";
import { HubIntegrationError } from "@/src/server/sales-hub/errors";
import { flushHubOutbox } from "@/src/server/sales-hub/outbox";
import { acceptHubOrder, saveHubProduct } from "@/src/server/sales-hub/repository";

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await context.params;
    const caller = await authenticateHub(request, action === "outbox:deliver");
    if (action === "outbox:deliver") return NextResponse.json(await flushHubOutbox());
    if (action === "products:upsert") {
      return NextResponse.json(await saveHubProduct(parseHubProduct(await readHubJson(request, 65_536))));
    }
    if (action === "factory-orders:upsert" || action === "production-orders:upsert") {
      return NextResponse.json(await acceptHubOrder(parseHubProductionOrderCommand(await readHubJson(request)), caller));
    }
    throw new HubIntegrationError("NOT_FOUND", "The integration route does not exist", 404);
  } catch (error) {
    if (error instanceof HubIntegrationError)
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    console.error("Sales Hub inbound request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: { code: "TEMPORARY_FAILURE", message: "Factory request failed" } }, { status: 503 });
  }
}
