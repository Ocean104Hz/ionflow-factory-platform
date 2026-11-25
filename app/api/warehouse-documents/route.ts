import { type NextRequest, NextResponse } from "next/server";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { FactoryAuthError } from "@/src/server/auth/auth-service";
import { readCurrentFactoryUser } from "@/src/server/auth/server-auth";
import { listReceipts, listRequisitions, previewReceipt, reserveReceipt, saveReceipt, WarehouseDocumentError, writeRequisition } from "@/src/server/warehouse-documents";

const headers = { "Cache-Control": "no-store" };
const maxBytes = 512 * 1024;

function ok(data: unknown) {
  return NextResponse.json({ ok: true, data }, { headers });
}
function failure(error: unknown) {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof WarehouseDocumentError) return NextResponse.json({ ok: false, message: error.message }, { headers, status: error.status });
  if (typeof error === "object" && error && "code" in error && error.code === "23505")
    return NextResponse.json({ ok: false, message: "เลขที่เอกสารนี้มีอยู่แล้ว" }, { headers, status: 409 });
  console.error("Warehouse document request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ ok: false, message: "เชื่อมฐานข้อมูลคลังสินค้าไม่สำเร็จ กรุณาลองใหม่" }, { headers, status: 503 });
}
async function context(request: NextRequest) {
  const user = await readCurrentFactoryUser();
  if (!user) throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind !== "receiving" && kind !== "requisition") throw new WarehouseDocumentError(404, "ไม่พบประเภทเอกสารคลังสินค้า");
  return { user, kind };
}
export async function GET(request: NextRequest) {
  try {
    const { user, kind } = await context(request);
    const date = request.nextUrl.searchParams.get("date");
    return ok(kind === "requisition" ? await listRequisitions(user) : date !== null ? await previewReceipt(user, date) : await listReceipts(user));
  } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertTrustedAuthRequest(request, maxBytes);
    assertCsrf(request);
    const { user, kind } = await context(request);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > maxBytes) throw new WarehouseDocumentError(413, "เอกสารมีขนาดเกินกำหนด");
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new WarehouseDocumentError(400, "ข้อมูลเอกสารไม่ถูกต้อง"); }
    if (kind === "requisition") return ok(await writeRequisition(user, body));
    if (body && typeof body === "object" && "action" in body) {
      if (body.action === "reserve" && "date" in body && "expected" in body) return ok(await reserveReceipt(user, body.date, body.expected));
      if (body.action === "save") return ok(await saveReceipt(user, body));
    }
    throw new WarehouseDocumentError(400, "คำสั่งใบรับไม่ถูกต้อง");
  } catch (error) { return failure(error); }
}
