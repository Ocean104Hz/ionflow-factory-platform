import "server-only";

import {
  withMaterialIssueReadTransaction,
  type MaterialIssueQueries,
} from "./material-issue-database";

import type {
  MaterialIssueRecord,
  MaterialIssueHeaderRow,
  MaterialIssueItemRow,
  MaterialIssueHistoryRow,
} from "./material-issue-types";


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


// ==========================================
// แปลงข้อมูล Database เป็นข้อมูล Frontend
// ==========================================

function mapMaterialIssueRecord(
  header: MaterialIssueHeaderRow,
  items: MaterialIssueItemRow[],
): MaterialIssueRecord {
  return {
    id: header.id,

    documentNo: header.document_number,

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


// ==========================================
// อ่านรายการวัสดุตาม ID เอกสาร
// ==========================================

async function findMaterialIssueItems(
  queries: MaterialIssueQueries,
  materialIssueId: string,
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
    [materialIssueId],
  );

  return result.rows;
}


// ==========================================
// อ่านเอกสารตาม ID
// ==========================================

export async function findMaterialIssueById(
  id: string,
): Promise<MaterialIssueRecord | null> {
  return withMaterialIssueReadTransaction(
    async (queries) => {
      const result = await queries.query<
        MaterialIssueHeaderRow & Record<string, unknown>
      >(
        `
          SELECT ${HEADER_COLUMNS}
          FROM foliar_fertilizer.m_material_issues
          WHERE id = $1
            AND archived_at IS NULL
          LIMIT 1
        `,
        [id],
      );

      const header = result.rows[0];

      if (!header) {
        return null;
      }

      const items = await findMaterialIssueItems(
        queries,
        header.id,
      );

      return mapMaterialIssueRecord(
        header,
        items,
      );
    },
  );
}


// ==========================================
// อ่านประวัติเอกสาร
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
        MaterialIssueHeaderRow & Record<string, unknown>
      >(
        `
          SELECT ${HEADER_COLUMNS}
          FROM foliar_fertilizer.m_material_issues
          WHERE archived_at IS NULL
          ORDER BY document_date DESC, id DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset],
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
        MaterialIssueItemRow & Record<string, unknown>
      >(
        `
          SELECT ${ITEM_COLUMNS}
          FROM foliar_fertilizer.r_material_issue_items
          WHERE material_issue_id IN (${placeholders})
          ORDER BY material_issue_id, line_no ASC
        `,
        ids,
      );

      const itemsByDocument = new Map<
        string,
        MaterialIssueItemRow[]
      >();

      for (const item of items.rows) {
        const rows =
          itemsByDocument.get(
            item.material_issue_id,
          ) ?? [];

        rows.push(item);

        itemsByDocument.set(
          item.material_issue_id,
          rows,
        );
      }

      return headers.rows.map((header) =>
        mapMaterialIssueRecord(
          header,
          itemsByDocument.get(header.id) ?? [],
        ),
      );
    },
  );
}


// ==========================================
// อ่านประวัติการเปลี่ยนแปลงเอกสาร
// ==========================================

export async function findMaterialIssueHistory(
  materialIssueId: string,
): Promise<MaterialIssueHistoryRow[]> {
  return withMaterialIssueReadTransaction(
    async (queries) => {
      const result = await queries.query<
        MaterialIssueHistoryRow & Record<string, unknown>
      >(
        `
          SELECT
            id::text AS id,
            material_issue_id,
            record_version::text AS record_version,
            action,
            actor_id,
            actor_display_name,
            occurred_at::text AS occurred_at,
            note,
            changes,
            request_id::text AS request_id
          FROM foliar_fertilizer.r_material_issue_history
          WHERE material_issue_id = $1
          ORDER BY record_version DESC
          LIMIT 100
        `,
        [materialIssueId],
      );

      return result.rows;
    },
  );
}