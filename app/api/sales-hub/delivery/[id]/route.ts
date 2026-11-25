import { type NextRequest, NextResponse } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { FactoryAuthError, requireFactoryModule } from "@/src/server/auth/auth-service";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { submitHubDelivery, submissionLimit } from "@/src/server/sales-hub/delivery";
import { HubIntegrationError } from "@/src/server/sales-hub/errors";

async function readSubmission(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const reader = request.body?.getReader();
  if (!reader || !contentType.startsWith("multipart/form-data;"))
    throw new HubIntegrationError("INVALID_SUBMISSION", "ข้อมูลและไฟล์แนบไม่ถูกต้อง", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > submissionLimit) {
        await reader.cancel();
        throw new HubIntegrationError("FILE_TOO_LARGE", "ขนาดไฟล์รวมเกินกำหนด", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData().catch(() => {
    throw new HubIntegrationError("INVALID_SUBMISSION", "ไม่สามารถอ่านข้อมูลและไฟล์แนบ", 400);
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  try {
    assertTrustedAuthRequest(request, submissionLimit);
    assertCsrf(request);
    const user = await readCurrentFactoryUser();
    if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    requireFactoryModule(user, "delivery_orders");
    const { id } = await context.params;
    const pickup = request.nextUrl.searchParams.get("action") === "pickup";
    await submitHubDelivery(id, pickup ? null : await readSubmission(request), user.email);
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof FactoryAuthError) return authErrorResponse(error);
    const known = error instanceof HubIntegrationError;
    if (!known) console.error("Could not update W1-FF delivery", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ ok: false, message: known ? error.message : "บันทึกใบส่งสินค้าไม่สำเร็จ" }, { headers, status: known ? error.status : 503 });
  }
}
