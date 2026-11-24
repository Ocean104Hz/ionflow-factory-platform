
import {
  blankEffervescentMaterialRow,
  blankEffervescentMaterialSheet,
  type EffervescentMaterialDefinition,
  type EffervescentMaterialLedgerRow,
  type EffervescentMaterialLedgerSheet,
} from "@/src/features/effervescent_material_ledger/effervescent_material_ledger_domain";

/**
 * UI MOCK ONLY
 *
 * รายการวัตถุดิบอ้างอิงจากแบบฟอร์ม Excel FR-P2-36/Rev.00
 * ข้อมูลวันที่ ผู้จัดทำ และรายการผลิตด้านล่างเป็นข้อมูลสาธิต
 * ไม่มี API, ไม่มีฐานข้อมูล และไม่มีการคำนวณยอดคงเหลือ
 */

/* ---------------- material master data ---------------- */

export const effervescentMaterialDefinitions:
  readonly EffervescentMaterialDefinition[] = [
    { no: 1, code: "WIP-PDAM-01", material_name: "ผงอะมิโน", unit: "กก." },
    { no: 2, code: "RM-1501", material_name: "21-0-0", unit: "กก." },
    { no: 3, code: "RM-4001", material_name: "มอนโตแดรกซ์ตริน", unit: "กก." },
    { no: 4, code: "RM-4003", material_name: "กรดซิตริก(กรดมะนาว)", unit: "กก." },
    { no: 5, code: "RM-4004", material_name: "โซเดียมไบคาร์บอเนต", unit: "กก." },
    { no: 6, code: "RM-4005", material_name: "แป้งข้าวโพด", unit: "กก." },
    { no: 7, code: "RM-4006", material_name: "แคป-โอ-ซิล", unit: "กก." },
    { no: 8, code: "RM-4101", material_name: "สีน้ำเงิน", unit: "กก." },
    { no: 9, code: "RM-4102", material_name: "สีม่วง", unit: "กก." },
    { no: 10, code: "RM-4103", material_name: "สีเขียว", unit: "กก." },
    { no: 11, code: "RM-4104", material_name: "สีเหลือง", unit: "กก." },
    { no: 12, code: "RM-4105", material_name: "สีส้ม", unit: "กก." },
    { no: 13, code: "RM-4106", material_name: "สีน้ำตาล", unit: "กก." },
    { no: 14, code: "RM-4107", material_name: "สีแดง", unit: "กก." },
  ];

/* ---------------- create material rows ---------------- */

export function createEffervescentMaterialLedgerRows(
  documentKey: string,
): EffervescentMaterialLedgerRow[] {
  return effervescentMaterialDefinitions.map((material) =>
    blankEffervescentMaterialRow(
      `${documentKey}-row-${String(material.no).padStart(2, "0")}`,
      material,
    ),
  );
}

/* ---------------- create blank document ---------------- */

export function createBlankEffervescentMaterialLedgerSheet(
  documentKey: string,
): EffervescentMaterialLedgerSheet {
  return blankEffervescentMaterialSheet(
    createEffervescentMaterialLedgerRows(documentKey),
  );
}

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
