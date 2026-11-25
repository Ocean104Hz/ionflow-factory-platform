import type { ProductionFormulaSheet } from "../production-flow/production-flow-domain";

export type ProductionLineV1 = {
  id: string; date: string; lineT1Qty: string; lineT1Lot: string;
  lineT2Qty: string; lineT2Lot: string; lineT4Qty: string; lineT4Lot: string;
  shift: string; producer: string;
};
export type ProductionSignersV1 = {
  preparedBy: string; qaOfficer: string; productionOfficer: string; manager: string;
};
export type ProductionOrderInputV1 = {
  date: string; location: string; formulaId: string; amount: string;
  note: string; mixingReference: string; rows: ProductionLineV1[]; signers: ProductionSignersV1;
};
export type ProductionOrderV1 = ProductionOrderInputV1 & {
  id: string; documentNumber: string; sheet: ProductionFormulaSheet; createdAt: string;
};
