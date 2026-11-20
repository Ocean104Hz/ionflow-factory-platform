import {
  blankWipSheet,
  type WipItemId,
  type WipReceivingIssuingRow,
  type WipReceivingIssuingSheet,
} from "@/src/features/wip_receiving_issuing/wip_receiving_issuing_domain";

/**
 * UI MOCK ONLY.
 * All dates, names, and quantities below are demonstration data.
 * The real WIP item names and order come from the domain master list.
 * No API or database calls are made here.
 */

/* ---------------- demo balances ---------------- */

const DEMO_OPENING_BALANCES: Readonly<
  Partial<Record<WipItemId, string>>
> = {
  "wip-01": "1,200.50",
  "wip-04": "650",
  "wip-06": "840",
  "wip-08": "500",
};

/* ---------------- create demo row ---------------- */

function createDemoRow(
  row: WipReceivingIssuingRow,
  sheetNumber: number,
): WipReceivingIssuingRow {
  const openingBalance = DEMO_OPENING_BALANCES[row.item_id];

  // Leave unused rows empty, just like a paper record.
  if (!openingBalance) {
    return row;
  }

  return {
    ...row,
    opening_balance: openingBalance,
    received: String(20 + sheetNumber * 5),
    issued_for_production: String(10 + sheetNumber),
    issued_as_product: row.item_id === "wip-01" ? "5.25" : "",
    transferred_out: row.item_id === "wip-04" ? "3" : "",
    remark: "ข้อมูลจำลอง",
  };
}

/* ---------------- create demo sheet ---------------- */

function createDemoSheet(
  sheetNumber: number,
): WipReceivingIssuingSheet {
  const sheetCode = String(sheetNumber).padStart(3, "0");
  const day = String(19 - sheetNumber).padStart(2, "0");
  const documentDate = `2026-11-${day}`;
  const createdAt = `${documentDate}T09:00:00+07:00`;

  const blank = blankWipSheet();

  return {
    ...blank,
    id: `wip-demo-${sheetCode}`,
    document_date: documentDate,
    prepared_by: `ผู้จัดทำสาธิต ${sheetCode}`,
    checked_by: "ผู้ตรวจสอบสาธิต",
    created_at: createdAt,
    updated_at: createdAt,
    rows: blank.rows.map((row) => createDemoRow(row, sheetNumber)),
  };
}

/* ---------------- exported mock data ---------------- */

export const demoWipReceivingIssuingSheets: WipReceivingIssuingSheet[] =
  Array.from({ length: 6 }, (_, index) => createDemoSheet(index + 1));
