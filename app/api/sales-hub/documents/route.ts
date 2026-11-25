import { type NextRequest, NextResponse } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { FactoryAuthError, requireFactoryModule, requireFactoryRole } from "@/src/server/auth/auth-service";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { readHubJson } from "@/src/server/sales-hub/contract";
import { createHubDocument, saveHubPrice } from "@/src/server/sales-hub/documents";
import { HubIntegrationError } from "@/src/server/sales-hub/errors";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    assertTrustedAuthRequest(request, 8192);
    assertCsrf(request);
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    const body = await readHubJson(request, 8192);
    const { kind, orderId } = (body ?? {}) as Record<string, unknown>;
    if (kind === "PRICE") {
      requireFactoryModule(user, "products");
      requireFactoryRole(user, "factory_admin");
      await saveHubPrice(body, user.email);
      return NextResponse.json({ ok: true }, { headers });
    }
    if (kind !== "DELIVERY_ORDER" && kind !== "INVOICE") throw new HubIntegrationError("INVALID_KIND", "ประเภทเอกสารไม่ถูกต้อง", 422);
    requireFactoryModule(user, kind === "INVOICE" ? "invoices" : "delivery_orders");
    const data = await createHubDocument(kind, orderId, user.email);
    return NextResponse.json({ ok: true, data }, { headers });
  } catch (error) {
    if (error instanceof FactoryAuthError) return authErrorResponse(error);
    const known = error instanceof HubIntegrationError;
    if (!known) console.error("Could not save W1-FF document", error);
    return NextResponse.json({ ok: false, message: known ? error.message : "บันทึกข้อมูล W1-FF ไม่สำเร็จ" },
      { headers, status: known ? error.status : 503 });
  }
}
