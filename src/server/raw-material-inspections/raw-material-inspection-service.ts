
import "server-only";

import {
  FactoryAuthError,
  requireFactoryModule,
  requireFactoryRole,
} from "../auth/auth-service";

import { readCurrentFactoryUser } from "../auth/server-auth";

import {
  blankInspection,
  inspectionChecks,
  validateInspection,
  type Inspection,
} from "@/src/features/raw-material-inspections/inspection-domain";

import {
  masterKinds,
  type MasterReferences,
  type MasterSnapshot,
} from "@/src/features/master-data/master-domain";

import { parseISODateString } from "@/src/lib/date/thai-date";

import {
  listInspections,
  createInspection,
  updateInspection,
  archiveInspection,
} from "./raw-material-inspection-repository";

export class InspectionValidationError extends Error {}

async function requireInspectionUser() {
  const user = await readCurrentFactoryUser();

  if (!user) {
    throw new FactoryAuthError(
      "INVALID_CREDENTIALS",
      401,
    );
  }

  requireFactoryModule(user, "qc_raw_material");
  requireFactoryRole(user, "factory_admin");

  return user;
}

function readObject(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new InspectionValidationError(
      "รูปแบบข้อมูลไม่ถูกต้อง",
    );
  }

  return value as Record<string, unknown>;
}

function readText(
  value: unknown,
  label: string,
  maxLength = 500,
): string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    value.includes("\0")
  ) {
    throw new InspectionValidationError(
      `${label} ไม่ถูกต้องหรือยาวเกินกำหนด`,
    );
  }

  return value.trim();
}

function readDate(
  value: unknown,
  label: string,
  required = false,
): string {
  const date = readText(value, label, 10);

  if (!date && !required) return "";

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !parseISODateString(date)
  ) {
    throw new InspectionValidationError(
      `${label} ไม่ถูกต้อง`,
    );
  }

  return date;
}

function readMasterRefs(
  value: unknown,
): MasterReferences {
  if (value === undefined) return {};

  const raw = readObject(value);
  const refs: MasterReferences = {};

  if (Object.keys(raw).length > 20) {
    throw new InspectionValidationError(
      "ข้อมูลอ้างอิงมีจำนวนมากเกินกำหนด",
    );
  }

  for (const [key, item] of Object.entries(raw)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,50}$/.test(key) ||
      ["constructor", "prototype"].includes(key)
    ) {
      throw new InspectionValidationError(
        "รหัสข้อมูลอ้างอิงไม่ถูกต้อง",
      );
    }

    const ref = readObject(item);
    const kind = ref.kind;

    if (
      typeof kind !== "string" ||
      (
        kind !== "personnel" &&
        !Object.hasOwn(masterKinds, kind)
      )
    ) {
      throw new InspectionValidationError(
        "ประเภทข้อมูลอ้างอิงไม่ถูกต้อง",
      );
    }

    refs[key] = {
      id: readText(ref.id, "รหัสอ้างอิง", 200),
      kind: kind as MasterSnapshot["kind"],
      code: readText(ref.code, "รหัสข้อมูลหลัก", 100),
      name: readText(ref.name, "ชื่อข้อมูลหลัก", 500),
      value: readText(ref.value, "ข้อมูลอ้างอิง", 500),
    };
  }

  return refs;
}

export function validateInspectionInput(
  payload: unknown,
): Inspection {
  const body = readObject(payload);
  const row = blankInspection();

  row.number = readText(
    body.number,
    "เลขที่เอกสาร",
    100,
  );

  row.date = readDate(
    body.date,
    "วันที่เอกสาร",
    true,
  );

  row.location = readText(
    body.location,
    "โรงงาน / สถานที่ตรวจ",
  );

  row.lot = readText(body.lot, "Lot No.");
  row.trip = readText(body.trip, "เที่ยวรถ", 10);
  row.sender = readText(body.sender, "ผู้จำหน่าย");
  row.material = readText(body.material, "วัตถุดิบ");

  row.reference = readText(
    body.reference,
    "เอกสารอ้างอิง",
  );

  row.inspector = readText(
    body.inspector,
    "ผู้ตรวจสอบ",
  );

  row.inspectorDate = readDate(
    body.inspectorDate,
    "วันที่ตรวจสอบ",
  );

  row.approver = readText(
    body.approver,
    "ผู้อนุมัติ",
  );

  row.approverDate = readDate(
    body.approverDate,
    "วันที่อนุมัติ",
  );

  if (
    row.trip &&
    (
      !/^\d+$/.test(row.trip) ||
      !Number.isSafeInteger(Number(row.trip)) ||
      Number(row.trip) < 1 ||
      Number(row.trip) > 2147483647
    )
  ) {
    throw new InspectionValidationError(
      "เที่ยวรถต้องเป็นจำนวนเต็มที่ถูกต้อง",
    );
  }

  if (typeof body.finalized !== "boolean") {
    throw new InspectionValidationError(
      "สถานะผลตรวจไม่ถูกต้อง",
    );
  }

  row.finalized = body.finalized;
  row.masterRefs = readMasterRefs(body.masterRefs);

  const checks = readObject(body.checks);

  if (
    Object.keys(checks).length !== inspectionChecks.length
  ) {
    throw new InspectionValidationError(
      "กรุณาระบุรายการตรวจให้ครบ 7 หัวข้อ",
    );
  }

  for (const { key } of inspectionChecks) {
    const check = readObject(checks[key]);

    const result = check.result;

    if (
      result !== "pending" &&
      result !== "pass" &&
      result !== "fail" &&
      result !== "na"
    ) {
      throw new InspectionValidationError(
        "ผลการตรวจไม่ถูกต้อง",
      );
    }

    row.checks[key] = {
      result,
      note: readText(
        check.note,
        "หมายเหตุผลตรวจ",
        1000,
      ),
    };
  }

  const issue = validateInspection(row, []);

  if (issue) {
    throw new InspectionValidationError(issue);
  }

  return row;
}

function readId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new InspectionValidationError(
      "รหัสเอกสารไม่ถูกต้อง",
    );
  }

  return value;
}

function readVersion(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,18}$/.test(value) ||
    BigInt(value) >= BigInt("9223372036854775807")
  ) {
    throw new InspectionValidationError(
      "Version ไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่",
    );
  }

  return value;
}

export async function getRawMaterialInspections() {
  await requireInspectionUser();

  return listInspections();
}

export async function saveRawMaterialInspection(
  payload: unknown,
) {
  const user = await requireInspectionUser();

  const input = validateInspectionInput(payload);

  return createInspection(input, {
    id: user.id,
    displayName: user.displayName,
  });
}

export async function editRawMaterialInspection(
  id: string,
  payload: unknown,
) {
  const user = await requireInspectionUser();

  const body = readObject(payload);
  const documentId = readId(id);
  const version = readVersion(body.version);
  const input = validateInspectionInput(body);

  return updateInspection(
    documentId,
    version,
    input,
    {
      id: user.id,
      displayName: user.displayName,
    },
  );
}
export async function removeRawMaterialInspection(
  id: string,
  payload: unknown,
): Promise<void> {
  const user = await requireInspectionUser();

  const documentId = readId(id);
  const body = readObject(payload);
  const version = readVersion(body.version);

  await archiveInspection(documentId, version, {
    id: user.id,
    displayName: user.displayName,
  });
}