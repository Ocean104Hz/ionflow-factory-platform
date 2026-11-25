import "server-only";

import {
    FactoryAuthError,
    requireFactoryModule,
    requireFactoryRole,
} from "../auth/auth-service";

import { readCurrentFactoryUser } from "../auth/server-auth";
import {
    validateMaterialIssueInput,
    MaterialIssueValidationError,
} from "./material-issue-validation";
import {
    createMaterialIssue,
    findMaterialIssues,
    findMaterialIssueById,
    updateMaterialIssue,
    deleteMaterialIssue,
} from "./material-issue-repository";
import type { MaterialIssueRecord } from "./material-issue-types";

async function requireMaterialIssueUser() {
    const user = await readCurrentFactoryUser();
    if (!user) {
        throw new FactoryAuthError("INVALID_CREDENTIALS", 401);
    }
    requireFactoryModule(user, "material_issues");
    requireFactoryRole(user, "factory_admin");
    return user;
}

function validateDocumentId(id: string): void {
    if (!/^mi-[A-Za-z0-9_-]{1,100}$/.test(id)) {
        throw new MaterialIssueValidationError("รหัสเอกสารไม่ถูกต้อง");
    }
}

function readVersion(value: unknown): string {
    if (
        typeof value !== "string" ||
        !/^[1-9]\d{0,18}$/.test(value) ||
        BigInt(value) > BigInt("9223372036854775807")
    ) {
        throw new MaterialIssueValidationError(
            "Version ของเอกสารไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่",
        );
    }
    return value;
}

function readPayload(payload: unknown): Record<string, unknown> {
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new MaterialIssueValidationError("ข้อมูลเอกสารไม่ถูกต้อง");
    }
    return payload as Record<string, unknown>;
}

function readDocumentNo(value: unknown): string {
    if (
        typeof value !== "string" ||
        !/^[0-9]{1,100}$/.test(value)
    ) {
        throw new MaterialIssueValidationError(
            "เลขที่เอกสารต้องเป็นตัวเลขเท่านั้น และไม่เกิน 100 หลัก",
        );
    }

    return value;
}

function validateScopedInput(payload: unknown) {
    const input = validateMaterialIssueInput(payload);
    if (input.header.location !== "โรงงานกาญ 2") {
        throw new MaterialIssueValidationError("สถานที่ไม่อยู่ในขอบเขตที่รองรับ");
    }
    return input;
}

// CREATE
export async function saveMaterialIssue(payload: unknown): Promise<MaterialIssueRecord> {
    const user = await requireMaterialIssueUser();
    const body = readPayload(payload);
    const documentNo = readDocumentNo(body.documentNo);
    const input = validateScopedInput(body);
    return createMaterialIssue(input, documentNo, { id: user.id, displayName: user.displayName });
}

// READ ALL
export async function listMaterialIssues(limit = 100, offset = 0): Promise<MaterialIssueRecord[]> {
    await requireMaterialIssueUser();
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0) {
        throw new MaterialIssueValidationError("ข้อมูล Pagination ไม่ถูกต้อง");
    }
    return findMaterialIssues(limit, offset);
}

// READ BY ID
export async function getMaterialIssue(id: string): Promise<MaterialIssueRecord | null> {
    await requireMaterialIssueUser();
    validateDocumentId(id);
    return findMaterialIssueById(id);
}

// UPDATE
export async function editMaterialIssue(id: string, payload: unknown): Promise<MaterialIssueRecord> {
    const user = await requireMaterialIssueUser();
    validateDocumentId(id);
    const body = readPayload(payload);
    const version = readVersion(body.version);
    const documentNo = readDocumentNo(body.documentNo);
    const input = validateScopedInput(body);
    return updateMaterialIssue(id, version, input, { id: user.id, displayName: user.displayName }, documentNo);
}

// DELETE
export async function removeMaterialIssue(id: string, payload: unknown): Promise<void> {
    const user = await requireMaterialIssueUser();
    validateDocumentId(id);
    const body = readPayload(payload);
    const version = readVersion(body.version);
    await deleteMaterialIssue(id, version, { id: user.id, displayName: user.displayName });
}
