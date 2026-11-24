import {
  blankOrganicExtractionMaterialLedgerSheet,
  type OrganicExtractionMaterialLedgerRow,
  type OrganicExtractionMaterialLedgerSheet,
} from "@/src/features/organic_extraction_material_ledger/organic_extraction_material_ledger_domain";

/**
 * UI MOCK ONLY. All quantities, people, dates and remarks below are fictional.
 * The 23 material codes and row order come from the verified domain model.
 * Material names are deliberately blank until the factory confirms them.
 *
 * Opening balances are independent example inputs for EACH document.
 * They are not derived from an earlier document's closing balances.
 * Nothing here reads or writes an API, database or browser storage.
 */

const DEMO_DOCUMENT_DATES = [
  "2026-11-18",
  "2026-11-16",
  "2026-11-14",
  "2026-11-12",
  "2026-11-10",
  "2026-11-08",
] as const;

/** Populate just a few rows, leaving the remaining printed rows empty. */
function createDemoMaterialRow(
  row: OrganicExtractionMaterialLedgerRow,
  documentNumber: number,
): OrganicExtractionMaterialLedgerRow {
  switch (row.row_number) {
    case 1:
      return {
        ...row,
        opening_balance: `${410 + documentNumber * 20}.50`,
        received: documentNumber % 2 === 0 ? "15" : "",
        issued_for_production: String(documentNumber * 4),
        remark: "ข้อมูลสาธิต",
      };
    case 2:
      return {
        ...row,
        opening_balance: String(300 + documentNumber * 9),
        issued_for_production: String(documentNumber * 2),
      };
    case 3:
      return {
        ...row,
        opening_balance: String(1_020 + documentNumber * 23),
        received: documentNumber % 3 === 0 ? "45" : "",
      };
    case 7:
      return {
        ...row,
        opening_balance: String(660 + documentNumber * 16),
        received: "35.25",
        issued_for_production: "20",
        issued_adjustment: documentNumber % 2 === 0 ? "1.25" : "",
        issued_waste: documentNumber % 3 === 0 ? "0.50" : "",
        remark: "ตรวจนับสต็อก (ข้อมูลสาธิต)",
      };
    case 11:
      return {
        ...row,
        opening_balance: "0",
        received: String(60 + documentNumber * 5),
        issued_for_production: String(20 + documentNumber),
      };
    case 13:
      return {
        ...row,
        opening_balance: `${155 + documentNumber}.88`,
        issued_adjustment: "0.50",
      };
    case 23:
      return {
        ...row,
        opening_balance: String(90 + documentNumber * 2),
        issued_for_production: String(documentNumber),
      };
    default:
      return row;
  }
}

function createDemoMaterialLedgerSheet(
  documentDate: string,
  documentNumber: number,
): OrganicExtractionMaterialLedgerSheet {
  const empty = blankOrganicExtractionMaterialLedgerSheet();
  const code = String(documentNumber).padStart(3, "0");
  const savedAt = `${documentDate}T16:30:00+07:00`;

  return {
    ...empty,
    id: `organic-material-ledger-demo-${code}`,
    document_date: documentDate,
    prepared_by: "ผู้จัดทำสาธิต",
    inspected_by: "ผู้ตรวจสอบสาธิต",
    created_at: savedAt,
    updated_at: savedAt,
    rows: empty.rows.map((row) => createDemoMaterialRow(row, documentNumber)),
  };
}

/**
 * Pass this array to
 * <OrganicExtractionMaterialLedgerWorkspace initialRecords={...} />.
 * Its in-memory records are independent of other production forms.
 */
export const demoOrganicExtractionMaterialLedgerSheets:
  OrganicExtractionMaterialLedgerSheet[] = DEMO_DOCUMENT_DATES.map(
    (documentDate, index) =>
      createDemoMaterialLedgerSheet(documentDate, index + 1),
  );
