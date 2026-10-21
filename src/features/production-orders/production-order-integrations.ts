import type { ProductionOrder } from "../../lib/mock-data/index.ts";
import type { Formula } from "../bom/bom-domain.ts";
import type { InventoryItem } from "../inventory/inventory-domain.ts";
import type { MasterSnapshot } from "../master-data/master-domain.ts";

export type ReferenceResolution<T> = Readonly<{ state: "VERIFIED"; value: T }> | Readonly<{ state: "UNRESOLVED"; reason: string }>;
/** Future server-owned adapters. SKU/warehouse labels are lookup evidence, not verified IDs. */
export interface ProductionOrderIntegrationReader {
  resolveWarehouse(order: Readonly<ProductionOrder>): Promise<ReferenceResolution<MasterSnapshot>>;
  resolveItem(source: ProductionOrder["source"], sku: string): Promise<ReferenceResolution<Pick<InventoryItem, "id" | "code" | "baseUnit">>>;
  eligibleFormulas(productMasterId: string): Promise<readonly Pick<Formula, "id" | "code" | "version" | "batchSize" | "unit">[]>;
}
/** Future immutable PO-owned requirements; no stock transaction or automatic requisition command. */
export type ProductionRequirementsSnapshot = Readonly<{
  productionOrderId: string;
  orderRecordVersion: string;
  formulaId: string;
  formulaCode: string;
  formulaVersion: string;
  standardBatchQuantity: string;
  productionQuantity: string;
  productionUnit: string;
  materials: readonly Readonly<{ materialId: string; code: string; name: string; quantity: string; unit: string }>[];
}>;
export interface RequisitionRequirementsReader {
  readApprovedRequirements(productionOrderId: string, orderRecordVersion: string): Promise<ReferenceResolution<ProductionRequirementsSnapshot>>;
}
