
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  FactoryAuthError,
} from "@/src/server/auth/auth-service";

import {
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
} from "@/src/server/auth/auth-http";

import {
  BackendError,
} from "@/src/server/database/config";

import {
  InspectionConflictError,
} from "@/src/server/raw-material-inspections/raw-material-inspection-repository";

import {
  InspectionValidationError,
  getRawMaterialInspections,
  saveRawMaterialInspection,
  editRawMaterialInspection,
  removeRawMaterialInspection,
} from "@/src/server/raw-material-inspections/raw-material-inspection-service";

function success(
  data: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function failure(
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function handleError(
  error: unknown,
): NextResponse {
  if (error instanceof FactoryAuthError) {
    return authErrorResponse(error);
  }

  if (error instanceof InspectionValidationError) {
    return failure(error.message, 400);
  }

  if (error instanceof InspectionConflictError) {
    return failure(error.message, 409);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return failure(
      "เลขที่เอกสารนี้มีอยู่แล้ว กรุณาตรวจสอบ",
      409,
    );
  }

  if (error instanceof BackendError) {
    console.error(
      "QC_RAW_MATERIAL_DATABASE_FAILED",
      error.code,
    );

    return failure(
      "ระบบฐานข้อมูลยังไม่พร้อมใช้งาน",
      503,
    );
  }

  console.error(
    "QC_RAW_MATERIAL_REQUEST_FAILED",
  );

  return failure(
    "ไม่สามารถดำเนินการกับเอกสารได้ กรุณาลองใหม่",
    500,
  );
}

async function readBody(
  request: NextRequest,
): Promise<unknown> {
  assertTrustedAuthRequest(request);
  assertCsrf(request);

  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    contentType
      .split(";")[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    throw new InspectionValidationError(
      "รูปแบบข้อมูลไม่ถูกต้อง",
    );
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > 12000) {
    throw new InspectionValidationError(
      "ข้อมูลเอกสารมีขนาดใหญ่เกินกำหนด",
    );
  }

  try {
    const payload: unknown = JSON.parse(raw);

    return payload;
  } catch {
    throw new InspectionValidationError(
      "ข้อมูลเอกสารไม่ถูกต้อง",
    );
  }
}

// อ่านเอกสารจากฐานข้อมูล
export async function GET() {
  try {
    const records =
      await getRawMaterialInspections();

    return success(records);
  } catch (error: unknown) {
    return handleError(error);
  }
}

// สร้างเอกสารใหม่
export async function POST(
  request: NextRequest,
) {
  try {
    const payload = await readBody(request);

    const saved =
      await saveRawMaterialInspection(payload);

    return success(saved, 201);
  } catch (error: unknown) {
    return handleError(error);
  }
}

// แก้ไขเอกสาร
export async function PUT(
  request: NextRequest,
) {
  try {
    const payload = await readBody(request);

    const id =
      request.nextUrl.searchParams.get("id") ?? "";

    if (!id) {
      throw new InspectionValidationError(
        "กรุณาระบุรหัสเอกสาร",
      );
    }

    const saved =
      await editRawMaterialInspection(id, payload);

    return success(saved);
  } catch (error: unknown) {
    return handleError(error);
  }
}
export async function DELETE(
  request: NextRequest,
) {
  try {
    const payload = await readBody(request);

    const id =
      request.nextUrl.searchParams.get("id") ?? "";

    if (!id) {
      throw new InspectionValidationError(
        "กรุณาระบุรหัสเอกสาร",
      );
    }

    await removeRawMaterialInspection(id, payload);

    return success({ id });
  } catch (error: unknown) {
    return handleError(error);
  }
}