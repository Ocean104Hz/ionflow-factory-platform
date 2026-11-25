import {
  createBlankEffervescentMaterialLedgerSheet,
  type EffervescentMaterialLedgerSheet,
} from "../../features/effervescent_material_ledger/effervescent_material_ledger_domain.ts";

/* ---------------- create demo documents ---------------- */

function createDemoEffervescentMaterialLedgerSheet(
  sheetNumber: number,
  recordDate: string,
): EffervescentMaterialLedgerSheet {
  const documentNumber = String(sheetNumber).padStart(3, "0");
  const id = `effervescent-demo-${documentNumber}`;
  const savedAt = `${recordDate}T09:00:00+07:00`;

  return {
    ...createBlankEffervescentMaterialLedgerSheet(id),
    id,
    record_date: recordDate,
    production_list: `รายการผลิตสาธิต ${documentNumber}`,
    prepared_by: "ผู้จัดทำ (สาธิต)",
    checked_by: "ผู้ตรวจสอบ (สาธิต)",
    created_at: savedAt,
    updated_at: savedAt,
  };
}

/* ---------------- exported demo history ---------------- */

export const demoEffervescentMaterialLedgerSheets:
  EffervescentMaterialLedgerSheet[] = [
    createDemoEffervescentMaterialLedgerSheet(1, "2026-11-18"),
    createDemoEffervescentMaterialLedgerSheet(2, "2026-11-17"),
    createDemoEffervescentMaterialLedgerSheet(3, "2026-11-16"),
  ];
