import { NextResponse, type NextRequest } from "next/server";
import { FactoryAuthError } from "@/src/server/auth/auth-service";
import { assertCsrf, assertTrustedAuthRequest, authErrorResponse } from "@/src/server/auth/auth-http";
import { MaterialIssueValidationError } from "@/src/server/material-issues/material-issue-validation";
import { MaterialIssueConflictError } from "@/src/server/material-issues/material-issue-repository";
import { listMaterialIssues, getMaterialIssue, saveMaterialIssue, editMaterialIssue, removeMaterialIssue } from "@/src/server/material-issues/material-issue-service";

function success(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function handleError(error: unknown): NextResponse {
  if (error instanceof FactoryAuthError) return authErrorResponse(error);
  if (error instanceof MaterialIssueValidationError) return failure(error.message, 400);
  if (error instanceof MaterialIssueConflictError) return failure(error.message, 409);
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return failure("พบข้อมูลซ้ำ กรุณาตรวจสอบเลขที่เอกสาร", 409);
  }
  console.error("MATERIAL_ISSUE_REQUEST_FAILED");
  return failure("ไม่สามารถดำเนินการกับเอกสารได้ กรุณาลองใหม่", 500);
}

function readDocumentId(request: NextRequest): string {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!/^mi-[A-Za-z0-9_-]{1,100}$/.test(id)) {
    throw new MaterialIssueValidationError("รหัสเอกสารไม่ถูกต้อง");
  }
  return id;
}

async function readBody(request: NextRequest): Promise<unknown> {
  assertTrustedAuthRequest(request);
  assertCsrf(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new MaterialIssueValidationError("รูปแบบข้อมูลไม่ถูกต้อง");
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > 12000) {
    throw new MaterialIssueValidationError("ข้อมูลเอกสารมีขนาดใหญ่เกินกำหนด");
  }
  try {
    const payload: unknown = JSON.parse(raw);
    return payload;
  } catch {
    throw new MaterialIssueValidationError("ข้อมูลเอกสารไม่ถูกต้อง");
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    if (searchParams.has("id")) {
      const document = await getMaterialIssue(readDocumentId(request));
      if (!document) return failure("ไม่พบใบเบิกจ่ายวัสดุ", 404);
      return success(document);
    }
    const limitRaw = searchParams.get("limit") ?? "100";
    const offsetRaw = searchParams.get("offset") ?? "0";
    if (!/^\d+$/.test(limitRaw) || !/^\d+$/.test(offsetRaw)) {
      throw new MaterialIssueValidationError("ข้อมูล Pagination ไม่ถูกต้อง");
    }
    const limit = Number(limitRaw);
    const offset = Number(offsetRaw);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) {
      throw new MaterialIssueValidationError("ข้อมูล Pagination ไม่ถูกต้อง");
    }
    return success(await listMaterialIssues(limit, offset));
  } catch (error: unknown) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await readBody(request);
    return success(await saveMaterialIssue(payload), 201);
  } catch (error: unknown) {
    return handleError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await readBody(request);
    const id = readDocumentId(request);
    return success(await editMaterialIssue(id, payload));
  } catch (error: unknown) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await readBody(request);
    const id = readDocumentId(request);
    await removeMaterialIssue(id, payload);
    return success({ id });
  } catch (error: unknown) {
    return handleError(error);
  }
}
