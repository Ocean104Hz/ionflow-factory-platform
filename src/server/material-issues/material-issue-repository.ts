
import "server-only";

import { randomUUID } from "node:crypto";

import {
  withMaterialIssueReadTransaction,
  withMaterialIssueWriteTransaction,
  type MaterialIssueQueries,
} from "./material-issue-database";

import type {
  MaterialIssueInput,
  MaterialIssueRecord,
  MaterialIssueHeaderRow,
  MaterialIssueItemRow,
  MaterialIssueHistoryRow,
} from "./material-issue-types";

const LOCATION = "โรงงานกาญ 2";

const HEADER_COLUMNS = `
  id,
  document_number,
  document_date::text AS document_date,
  location_snapshot,
  product_name_snapshot,
  product_quantity::text AS product_quantity,
  department_snapshot,
  requested_by,
  issued_by,
  inspected_by,
  version::text AS version,
  created_at::text AS created_at,
  updated_at::text AS updated_at,
  archived_at::text AS archived_at
`;

const ITEM_COLUMNS = `
  id,
  material_issue_id,
  line_no,
  material_code_snapshot,
  material_name_snapshot,
  quantity::text AS quantity,
  unit_snapshot,
  damaged_quantity::text AS damaged_quantity,
  additional_quantity::text AS additional_quantity
`;

export interface MaterialIssueActor {
  id: string;
  displayName: string;
}

export class MaterialIssueConflictError extends Error {
  constructor() {
    super(
      "เอกสารถูกแก้ไขหรือถูกลบแล้ว กรุณาโหลดข้อมูลใหม่",
    );

    this.name = "MaterialIssueConflictError";
  }
}

function mapMaterialIssueRecord(
  header: MaterialIssueHeaderRow,
  items: MaterialIssueItemRow[],
): MaterialIssueRecord {
  return {
    id: header.id,
    documentNo: header.document_number,
    version: header.version,

    header: {
      location: header.location_snapshot,
      productName: header.product_name_snapshot,
      quantity: header.product_quantity ?? "",
      issueDate: header.document_date,
      department: header.department_snapshot,
    },

    items: items.map((item) => ({
      id: item.id,
      materialCode: item.material_code_snapshot,
      materialName: item.material_name_snapshot,
      quantity: item.quantity,
      unit: item.unit_snapshot,
      damagedQuantity: item.damaged_quantity ?? "",
      additionalQuantity:
        item.additional_quantity ?? "",
    })),

    signers: {
      requestedBy: header.requested_by,
      issuedBy: header.issued_by,
      inspectedBy: header.inspected_by,
    },
  };
}

async function findMaterialIssueItems(
  queries: MaterialIssueQueries,
  documentId: string,
): Promise<MaterialIssueItemRow[]> {
  const result = await queries.query<
    MaterialIssueItemRow & Record<string, unknown>
  >(
    `
      SELECT ${ITEM_COLUMNS}
      FROM foliar_fertilizer.r_material_issue_items
      WHERE material_issue_id = $1
      ORDER BY line_no ASC
    `,
    [documentId],
  );

  return result.rows;
}

// ==========================================
// GET: อ่านเอกสารรายใบ
// ==========================================

export async function findMaterialIssueById(
  id: string,
): Promise<MaterialIssueRecord | null> {
  return withMaterialIssueReadTransaction(
    async (queries) => {
      const result = await queries.query<
        MaterialIssueHeaderRow &
          Record<string, unknown>
      >(
        `
          SELECT ${HEADER_COLUMNS}
          FROM foliar_fertilizer.m_material_issues
          WHERE id = $1
            AND location_snapshot = $2
            AND archived_at IS NULL
          LIMIT 1
        `,
        [id, LOCATION],
      );

      const header = result.rows[0];

      if (!header) {
        return null;
      }

      const items = await findMaterialIssueItems(
        queries,
        header.id,
      );

      return mapMaterialIssueRecord(header, items);
    },
  );
}

// ==========================================
// GET: อ่านรายการเอกสาร
// ==========================================

export async function findMaterialIssues(
  limit = 100,
  offset = 0,
): Promise<MaterialIssueRecord[]> {
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error("INVALID_PAGINATION");
  }

  return withMaterialIssueReadTransaction(
    async (queries) => {
      const headers = await queries.query<
        MaterialIssueHeaderRow &
          Record<string, unknown>
      >(
        `
          SELECT ${HEADER_COLUMNS}
          FROM foliar_fertilizer.m_material_issues
          WHERE archived_at IS NULL
            AND location_snapshot = $1
          ORDER BY document_date DESC, id DESC
          LIMIT $2 OFFSET $3
        `,
        [LOCATION, limit, offset],
      );

      if (headers.rows.length === 0) {
        return [];
      }

      const ids = headers.rows.map(
        (header) => header.id,
      );

      const placeholders = ids
        .map((_, index) => `$${index + 1}`)
        .join(", ");

      const items = await queries.query<
        MaterialIssueItemRow &
          Record<string, unknown>
      >(
        `
          SELECT ${ITEM_COLUMNS}
          FROM foliar_fertilizer.r_material_issue_items
          WHERE material_issue_id IN (${placeholders})
          ORDER BY material_issue_id, line_no ASC
        `,
        ids,
      );

      const groupedItems = new Map<
        string,
        MaterialIssueItemRow[]
      >();

      for (const item of items.rows) {
        const rows =
          groupedItems.get(item.material_issue_id) ?? [];

        rows.push(item);

        groupedItems.set(
          item.material_issue_id,
          rows,
        );
      }

      return headers.rows.map((header) =>
        mapMaterialIssueRecord(
          header,
          groupedItems.get(header.id) ?? [],
        ),
      );
    },
  );
}

// ==========================================
// GET: อ่านประวัติการเปลี่ยนแปลง
// ==========================================

export async function findMaterialIssueHistory(
  documentId: string,
): Promise<MaterialIssueHistoryRow[]> {
  return withMaterialIssueReadTransaction(
    async (queries) => {
      const result = await queries.query<
        MaterialIssueHistoryRow &
          Record<string, unknown>
      >(
        `
          SELECT
            h.id::text AS id,
            h.material_issue_id,
            h.record_version::text AS record_version,
            h.action,
            h.actor_id,
            h.actor_display_name,
            h.occurred_at::text AS occurred_at,
            h.note,
            h.changes,
            h.request_id::text AS request_id

          FROM foliar_fertilizer.r_material_issue_history h

          INNER JOIN foliar_fertilizer.m_material_issues m
            ON m.id = h.material_issue_id

          WHERE h.material_issue_id = $1
            AND m.location_snapshot = $2

          ORDER BY h.record_version DESC
          LIMIT 100
        `,
        [documentId, LOCATION],
      );

      return result.rows;
    },
  );
}

// ==========================================
// INSERT: รายการวัสดุ
// ==========================================

async function insertMaterialIssueItems(
  queries: MaterialIssueQueries,
  documentId: string,
  items: MaterialIssueInput["items"],
): Promise<void> {
  for (const [index, item] of items.entries()) {
    await queries.query(
      `
        INSERT INTO foliar_fertilizer.r_material_issue_items (
          id,
          material_issue_id,
          line_no,
          material_code_snapshot,
          material_name_snapshot,
          quantity,
          unit_snapshot,
          damaged_quantity,
          additional_quantity
        )

        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9
        )
      `,
      [
        randomUUID(),
        documentId,
        index + 1,
        item.materialCode,
        item.materialName,
        item.quantity,
        item.unit,
        item.damagedQuantity || null,
        item.additionalQuantity || null,
      ],
    );
  }
}

// ==========================================
// INSERT: ประวัติเอกสาร
// ==========================================

async function insertMaterialIssueHistory(
  queries: MaterialIssueQueries,
  documentId: string,
  version: string,
  action: "created" | "updated" | "archived",
  actor: MaterialIssueActor,
  before: MaterialIssueRecord | null,
  after: MaterialIssueRecord | null,
): Promise<void> {
  const notes = {
    created: "สร้างใบเบิกจ่ายวัสดุ",
    updated: "แก้ไขใบเบิกจ่ายวัสดุ",
    archived: "ลบใบเบิกจ่ายวัสดุ",
  } as const;

  await queries.query(
    `
      INSERT INTO foliar_fertilizer.r_material_issue_history (
        id,
        material_issue_id,
        record_version,
        action,
        actor_id,
        actor_display_name,
        note,
        changes
      )

      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8::jsonb
      )
    `,
    [
      randomUUID(),
      documentId,
      version,
      action,
      actor.id,
      actor.displayName,
      notes[action],
      JSON.stringify([{ before, after }]),
    ],
  );
}

// ==========================================
// POST: สร้างเอกสาร
// ==========================================

export async function createMaterialIssue(
  input: MaterialIssueInput,
  documentNo: string,
  actor: MaterialIssueActor,
): Promise<MaterialIssueRecord> {
  if (input.header.location !== LOCATION) {
    throw new Error("INVALID_MATERIAL_ISSUE_LOCATION");
  }

  return withMaterialIssueWriteTransaction(
    async (queries) => {
      const documentId = `mi-${randomUUID()}`;

      const result = await queries.query<
        MaterialIssueHeaderRow &
          Record<string, unknown>
      >(
        `
          INSERT INTO foliar_fertilizer.m_material_issues (
            id,
            document_number,
            document_date,
            location_snapshot,
            product_name_snapshot,
            product_quantity,
            department_snapshot,
            requested_by,
            issued_by,
            inspected_by
          )

          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10
          )

          RETURNING ${HEADER_COLUMNS}
        `,
        [
          documentId,
          documentNo,
          input.header.issueDate,
          input.header.location,
          input.header.productName,
          input.header.quantity,
          input.header.department,
          input.signers.requestedBy,
          input.signers.issuedBy,
          input.signers.inspectedBy,
        ],
      );

      const header = result.rows[0];

      if (!header) {
        throw new Error("CREATE_MATERIAL_ISSUE_FAILED");
      }

      await insertMaterialIssueItems(
        queries,
        documentId,
        input.items,
      );

      const items = await findMaterialIssueItems(
        queries,
        documentId,
      );

      const record = mapMaterialIssueRecord(
        header,
        items,
      );

      await insertMaterialIssueHistory(
        queries,
        documentId,
        header.version,
        "created",
        actor,
        null,
        record,
      );

      return record;
    },
  );
}

// ==========================================
// LOCK: ป้องกันแก้ไขเอกสารทับกัน
// ==========================================

async function lockMaterialIssue(
  queries: MaterialIssueQueries,
  id: string,
  version: string,
): Promise<MaterialIssueHeaderRow> {
  const result = await queries.query<
    MaterialIssueHeaderRow &
      Record<string, unknown>
  >(
    `
      SELECT ${HEADER_COLUMNS}
      FROM foliar_fertilizer.m_material_issues

      WHERE id = $1
        AND version = $2::bigint
        AND location_snapshot = $3
        AND archived_at IS NULL

      FOR UPDATE
    `,
    [id, version, LOCATION],
  );

  const header = result.rows[0];

  if (!header) {
    throw new MaterialIssueConflictError();
  }

  return header;
}

// ==========================================
// PUT: แก้ไขเอกสาร
// ==========================================

export async function updateMaterialIssue(
  id: string,
  version: string,
  input: MaterialIssueInput,
  actor: MaterialIssueActor,
  documentNo: string,
): Promise<MaterialIssueRecord> {
  if (input.header.location !== LOCATION) {
    throw new Error("INVALID_MATERIAL_ISSUE_LOCATION");
  }

  return withMaterialIssueWriteTransaction(
    async (queries) => {
      const previousHeader =
        await lockMaterialIssue(
          queries,
          id,
          version,
        );

      const previousItems =
        await findMaterialIssueItems(
          queries,
          id,
        );

      const before = mapMaterialIssueRecord(
        previousHeader,
        previousItems,
      );

      const result = await queries.query<
        MaterialIssueHeaderRow &
          Record<string, unknown>
      >(
        `
          UPDATE foliar_fertilizer.m_material_issues

          SET
            document_number = $12,
            document_date = $2,
            location_snapshot = $3,
            product_name_snapshot = $4,
            product_quantity = $5,
            department_snapshot = $6,
            requested_by = $7,
            issued_by = $8,
            inspected_by = $9,

            version = version + 1,
            updated_at = CURRENT_TIMESTAMP

          WHERE id = $1
            AND version = $10::bigint
            AND location_snapshot = $11
            AND archived_at IS NULL

          RETURNING ${HEADER_COLUMNS}
        `,
        [
          id,
          input.header.issueDate,
          input.header.location,
          input.header.productName,
          input.header.quantity,
          input.header.department,
          input.signers.requestedBy,
          input.signers.issuedBy,
          input.signers.inspectedBy,
          version,
          LOCATION,
          documentNo,
        ],
      );

      const header = result.rows[0];

      if (!header) {
        throw new MaterialIssueConflictError();
      }

      await queries.query(
        `
          DELETE FROM foliar_fertilizer.r_material_issue_items
          WHERE material_issue_id = $1
        `,
        [id],
      );

      await insertMaterialIssueItems(
        queries,
        id,
        input.items,
      );

      const items = await findMaterialIssueItems(
        queries,
        id,
      );

      const after = mapMaterialIssueRecord(
        header,
        items,
      );

      await insertMaterialIssueHistory(
        queries,
        id,
        header.version,
        "updated",
        actor,
        before,
        after,
      );

      return after;
    },
  );
}

// ==========================================
// DELETE: Soft Delete
// ==========================================

export async function deleteMaterialIssue(
  id: string,
  version: string,
  actor: MaterialIssueActor,
): Promise<void> {
  await withMaterialIssueWriteTransaction(
    async (queries) => {
      const previousHeader =
        await lockMaterialIssue(
          queries,
          id,
          version,
        );

      const previousItems =
        await findMaterialIssueItems(
          queries,
          id,
        );

      const before = mapMaterialIssueRecord(
        previousHeader,
        previousItems,
      );

      const result = await queries.query<{
        version: string;
      }>(
        `
          UPDATE foliar_fertilizer.m_material_issues

          SET
            archived_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP,
            version = version + 1

          WHERE id = $1
            AND version = $2::bigint
            AND location_snapshot = $3
            AND archived_at IS NULL

          RETURNING version::text AS version
        `,
        [id, version, LOCATION],
      );

      const row = result.rows[0];

      if (!row) {
        throw new MaterialIssueConflictError();
      }

      await insertMaterialIssueHistory(
        queries,
        id,
        row.version,
        "archived",
        actor,
        before,
        null,
      );
    },
  );
}
