import { NextResponse, type NextRequest } from "next/server";
import { FactoryAuthError } from "@/src/server/auth/auth-service";
import {
  assertCsrf,
  assertTrustedAuthRequest,
  authErrorResponse,
} from "@/src/server/auth/auth-http";
import { BackendError } from "@/src/server/database/config";
import { MixingConflictError } from "@/src/server/fertilizer-powder-mixing/mixing-repository";
import {
  mixingService,
  MixingValidationError,
} from "@/src/server/fertilizer-powder-mixing/mixing-service";

const MAX_BODY_BYTES = 12_000;
const INVALID = "ข้อมูลไม่ถูกต้อง";
const NOT_FOUND = "ไม่พบรายงาน";
const DUPLICATE = "พบข้อมูลซ้ำ กรุณาตรวจสอบเลขที่เอกสาร";
const UNAVAILABLE = "ระบบฐานข้อมูลไม่พร้อมใช้งาน";
const FAILED = "ไม่สามารถดำเนินการได้";

function success(data: unknown, status = 200): NextResponse {
  return NextResponse.json(
    { ok: true, data },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function failure(
  message: string,
  status: number,
  field?: string,
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      message,
      ...(field ? { field } : {}),
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function handleError(error: unknown): NextResponse {
  if (error instanceof FactoryAuthError) {
    return authErrorResponse(error);
  }

  if (error instanceof MixingValidationError) {
    return failure(error.message, 400, error.field);
  }

  if (error instanceof MixingConflictError) {
    return failure(error.message, 409);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return failure(DUPLICATE, 409);
  }

  if (error instanceof BackendError) {
    console.error(
      "FERTILIZER_POWDER_MIXING_DB_FAILED",
      error.code,
    );

    return failure(UNAVAILABLE, 503);
  }

  console.error("FERTILIZER_POWDER_MIXING_REQUEST_FAILED");

  return failure(FAILED, 500);
}

function readId(request: NextRequest): string {
  const values = request.nextUrl.searchParams.getAll("id");

  if (values.length !== 1) {
    throw new MixingValidationError("id", INVALID);
  }

  return values[0];
}

async function readBody(
  request: NextRequest,
): Promise<unknown> {
  assertTrustedAuthRequest(request);
  assertCsrf(request);

  const type = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (type !== "application/json" || !request.body) {
    throw new MixingValidationError("body", INVALID);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];

  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);

        throw new MixingValidationError(
          "body",
          `Maximum ${MAX_BODY_BYTES} bytes`,
        );
      }

      chunks.push(value);
    }

    const raw = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(Buffer.concat(chunks, size));

    const payload: unknown = JSON.parse(raw);

    return payload;
  } catch (error: unknown) {
    if (error instanceof MixingValidationError) {
      throw error;
    }

    throw new MixingValidationError("body", INVALID);
  } finally {
    reader.releaseLock();
  }
}

// READ
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    if (params.has("catalog")) {
      if (
        params.getAll("catalog").length !== 1 ||
        params.get("catalog") !== "1" ||
        params.has("id")
      ) {
        throw new MixingValidationError("catalog", INVALID);
      }

      return success(await mixingService.catalog());
    }

    if (params.has("id")) {
      const record = await mixingService.get(readId(request));

      if (!record) {
        return failure(NOT_FOUND, 404);
      }

      return success(record);
    }

    return success(await mixingService.list());
  } catch (error: unknown) {
    return handleError(error);
  }
}

// CREATE
export async function POST(request: NextRequest) {
  try {
    return success(
      await mixingService.create(await readBody(request)),
      201,
    );
  } catch (error: unknown) {
    return handleError(error);
  }
}

// UPDATE
export async function PUT(request: NextRequest) {
  try {
    const payload = await readBody(request);

    return success(
      await mixingService.update(
        readId(request),
        payload,
      ),
    );
  } catch (error: unknown) {
    return handleError(error);
  }
}

// SOFT DELETE
export async function DELETE(request: NextRequest) {
  try {
    const payload = await readBody(request);
    const id = readId(request);

    await mixingService.archive(id, payload);

    return success({ id });
  } catch (error: unknown) {
    return handleError(error);
  }
}