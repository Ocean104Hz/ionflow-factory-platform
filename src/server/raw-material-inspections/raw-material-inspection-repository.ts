
import "server-only";

import { randomUUID } from "node:crypto";
import {
  getDevelopmentDatabase,
  type DatabaseRow,
  type WriteQueries,
} from "../database/database";

import {
  blankInspection,
  inspectionChecks,
  type Inspection,
} from "@/src/features/raw-material-inspections/inspection-domain";

export type InspectionRecord = Inspection & {
  version: string;
};

type Actor = {
  id: string;
  displayName: string;
};

export class InspectionConflictError extends Error {}

const TABLE = "foliar_fertilizer.m_qc_raw_material";
const CHECKS = "foliar_fertilizer.r_qc_raw_material_checks";
const HISTORY = "foliar_fertilizer.r_qc_raw_material_history";

const selectColumns = `
  id::text,
  document_number AS number,
  document_date::text AS date,
  location_snapshot AS location,
  lot_number AS lot,
  COALESCE(trip_number::text, '') AS trip,
  sender_snapshot AS sender,
  material_snapshot AS material,
  reference_document AS reference,
  inspector,
  COALESCE(inspector_date::text, '') AS "inspectorDate",
  approver,
  COALESCE(approver_date::text, '') AS "approverDate",
  finalized,
  master_refs AS "masterRefs",
  version::text
`;

function mapRecord(
  row: DatabaseRow,
  checkRows: DatabaseRow[],
): InspectionRecord {
  const record = blankInspection();

  const fields = [
    "id",
    "number",
    "date",
    "location",
    "lot",
    "trip",
    "sender",
    "material",
    "reference",
    "inspector",
    "inspectorDate",
    "approver",
    "approverDate",
  ] as const;

  for (const key of fields) {
    record[key] = String(row[key] ?? "");
  }

  record.finalized = row.finalized === true;

  record.masterRefs =
    (row.masterRefs ?? {}) as Inspection["masterRefs"];

  if (checkRows.length !== inspectionChecks.length) {
    throw new Error("QC_CHECK_DATA_INCOMPLETE");
  }

  for (const { key } of inspectionChecks) {
    const check = checkRows.find(
      (item) => item.check_key === key,
    );

    if (!check) {
      throw new Error("QC_CHECK_DATA_MISSING");
    }

    const result = check.result;

    if (
      result !== "pending" &&
      result !== "pass" &&
      result !== "fail" &&
      result !== "na"
    ) {
      throw new Error("QC_CHECK_RESULT_INVALID");
    }

    record.checks[key] = {
      result,
      note: String(check.note ?? ""),
    };
  }

  return {
    ...record,
    version: String(row.version),
  };
}

export async function listInspections(): Promise<InspectionRecord[]> {
  const db = getDevelopmentDatabase();

  return db.readOnly(async (tx) => {
    const rows = await tx.query(`
      SELECT
        ${selectColumns},
        (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'check_key', c.check_key,
                'result', c.result,
                'note', c.note
              )
            ),
            '[]'::jsonb
          )
          FROM ${CHECKS} c
          WHERE c.inspection_id = h.id
        ) AS checks
      FROM ${TABLE} h
      WHERE h.archived_at IS NULL
      ORDER BY h.document_date DESC, h.id DESC
    `);

    return rows.map((row) => {
      if (!Array.isArray(row.checks)) {
        throw new Error("QC_CHECK_DATA_INVALID");
      }

      return mapRecord(
        row,
        row.checks as DatabaseRow[],
      );
    });
  });
}

async function saveChecks(
  tx: WriteQueries,
  id: string,
  input: Inspection,
): Promise<void> {
  for (const { key } of inspectionChecks) {
    const check = input.checks[key];

    await tx.query(
      `
      INSERT INTO ${CHECKS} (
        inspection_id,
        check_key,
        result,
        note
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (inspection_id, check_key)
      DO UPDATE SET
        result = EXCLUDED.result,
        note = EXCLUDED.note
      `,
      [id, key, check.result, check.note],
    );
  }
}

async function writeHistory(
  tx: WriteQueries,
  id: string,
  version: string,
  action: "created" | "updated",
  actor: Actor,
  before: InspectionRecord | null,
  after: InspectionRecord,
): Promise<void> {
  await tx.query(
    `
    INSERT INTO ${HISTORY} (
      id,
      inspection_id,
      record_version,
      action,
      actor_id,
      actor_display_name,
      note,
      changes
    )
    VALUES (
      $1, $2, $3::bigint,
      $4, $5, $6, $7, $8::jsonb
    )
    `,
    [
      randomUUID(),
      id,
      version,
      action,
      actor.id,
      actor.displayName,
      action === "created"
        ? "สร้างใบตรวจสอบคุณภาพวัตถุดิบ"
        : "แก้ไขใบตรวจสอบคุณภาพวัตถุดิบ",
      JSON.stringify([{ before, after }]),
    ],
  );
}

function documentValues(input: Inspection) {
  return [
    input.number,
    input.date,
    input.location,
    input.lot,
    input.trip ? Number(input.trip) : null,
    input.sender,
    input.material,
    input.reference,
    input.inspector,
    input.inspectorDate || null,
    input.approver,
    input.approverDate || null,
    input.finalized,
    JSON.stringify(input.masterRefs ?? {}),
  ];
}

export async function createInspection(
  input: Inspection,
  actor: Actor,
): Promise<InspectionRecord> {
  const db = getDevelopmentDatabase();
  const id = randomUUID();

  return db.write(async (tx) => {
    const rows = await tx.query(
      `
      INSERT INTO ${TABLE} (
        id,
        document_number,
        document_date,
        location_snapshot,
        lot_number,
        trip_number,
        sender_snapshot,
        material_snapshot,
        reference_document,
        inspector,
        inspector_date,
        approver,
        approver_date,
        finalized,
        master_refs
      )
      VALUES (
        $1, $2, $3::date, $4, $5,
        $6, $7, $8, $9, $10,
        $11::date, $12, $13::date,
        $14, $15::jsonb
      )
      RETURNING ${selectColumns}
      `,
      [id, ...documentValues(input)],
    );

    if (!rows[0]) {
      throw new Error("QC_CREATE_FAILED");
    }

    await saveChecks(tx, id, input);

    const checks = await tx.query(
      `
      SELECT check_key, result, note
      FROM ${CHECKS}
      WHERE inspection_id = $1
      `,
      [id],
    );

    const saved = mapRecord(rows[0], checks);

    await writeHistory(
      tx,
      id,
      saved.version,
      "created",
      actor,
      null,
      saved,
    );

    return saved;
  });
}

export async function updateInspection(
  id: string,
  version: string,
  input: Inspection,
  actor: Actor,
): Promise<InspectionRecord> {
  const db = getDevelopmentDatabase();

  return db.write(async (tx) => {
    const previous = await tx.query(
      `
      SELECT ${selectColumns}
      FROM ${TABLE}
      WHERE id = $1
        AND version = $2::bigint
        AND archived_at IS NULL
      FOR UPDATE
      `,
      [id, version],
    );

    if (!previous[0]) {
      throw new InspectionConflictError(
        "เอกสารมีการเปลี่ยนแปลงหรือไม่พบข้อมูล กรุณาโหลดใหม่",
      );
    }

    const previousChecks = await tx.query(
      `
      SELECT check_key, result, note
      FROM ${CHECKS}
      WHERE inspection_id = $1
      `,
      [id],
    );

    const before = mapRecord(
      previous[0],
      previousChecks,
    );

    const rows = await tx.query(
      `
      UPDATE ${TABLE}
      SET
        document_number = $1,
        document_date = $2::date,
        location_snapshot = $3,
        lot_number = $4,
        trip_number = $5,
        sender_snapshot = $6,
        material_snapshot = $7,
        reference_document = $8,
        inspector = $9,
        inspector_date = $10::date,
        approver = $11,
        approver_date = $12::date,
        finalized = $13,
        master_refs = $14::jsonb,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
        AND version = $16::bigint
        AND archived_at IS NULL
      RETURNING ${selectColumns}
      `,
      [...documentValues(input), id, version],
    );

    if (!rows[0]) {
      throw new InspectionConflictError(
        "ไม่สามารถแก้ไขเอกสาร กรุณาโหลดข้อมูลใหม่",
      );
    }

    await saveChecks(tx, id, input);

    const checks = await tx.query(
      `
      SELECT check_key, result, note
      FROM ${CHECKS}
      WHERE inspection_id = $1
      `,
      [id],
    );

    const saved = mapRecord(rows[0], checks);

    await writeHistory(
      tx,
      id,
      saved.version,
      "updated",
      actor,
      before,
      saved,
    );

    return saved;
  });
}
export async function archiveInspection(
  id: string,
  version: string,
  actor: Actor,
): Promise<void> {
  const db = getDevelopmentDatabase();

  await db.write(async (tx) => {
    const rows = await tx.query(
      `
      UPDATE ${TABLE}
      SET
        archived_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP,
        version = version + 1
      WHERE id = $1
        AND version = $2::bigint
        AND archived_at IS NULL
      RETURNING version::text
      `,
      [id, version],
    );

    if (!rows[0]) {
      throw new InspectionConflictError(
        "เอกสารมีการเปลี่ยนแปลงหรือถูกลบแล้ว กรุณาโหลดข้อมูลใหม่",
      );
    }

    await tx.query(
      `
      INSERT INTO ${HISTORY} (
        id,
        inspection_id,
        record_version,
        action,
        actor_id,
        actor_display_name,
        note,
        changes
      )
      VALUES (
        $1, $2, $3::bigint,
        'archived', $4, $5, $6, $7::jsonb
      )
      `,
      [
        randomUUID(),
        id,
        String(rows[0].version),
        actor.id,
        actor.displayName,
        "ลบใบตรวจสอบคุณภาพวัตถุดิบ",
        JSON.stringify([
          {
            field: "archived",
            before: false,
            after: true,
          },
        ]),
      ],
    );
  });
}