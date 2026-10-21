import "server-only";
import type { InventoryBalanceSnapshot, InventoryItem, InventoryWarehouse } from "../../features/inventory/inventory-domain.ts";
import type { StockLedgerEvent } from "../../features/inventory/inventory-ledger-domain.ts";
import { quantityDecimal, quantityUnits } from "../../features/inventory/inventory-quantity.ts";
import { requirePersistentAccess } from "../persistent-access.ts";
import { assertFactoryAccess, type AuthorizedFactoryContext } from "../factory-authorization.ts";

export type PersistedBalance = Readonly<Omit<InventoryBalanceSnapshot, "onHandQty"> & { onHandQty: string }>;
export type InventoryReadScope = Readonly<{ tenantId: string; organizationId: string; siteIds: readonly string[] }>;
export type InventoryReadSnapshot = Readonly<{
  revision: string;
  balances: readonly PersistedBalance[];
  events: readonly StockLedgerEvent[];
}>;
/** Return balances and events from one consistent database snapshot/revision. */
export interface InventoryReadRepository {
  readSnapshot(context: AuthorizedFactoryContext): Promise<InventoryReadSnapshot>;
}
/** Future repository implementations must validate this capability before querying. */
export function authorizedInventoryScope(context: AuthorizedFactoryContext): InventoryReadScope {
  assertFactoryAccess(context, "inventory.read");
  return Object.freeze({ tenantId: context.tenantId, organizationId: context.organizationId, siteIds: context.siteIds });
}
export class InventoryMappingError extends Error {
  constructor() {
    super("ข้อมูลคงคลังหรือขอบเขตอ้างอิงไม่ถูกต้อง");
    this.name = "InventoryMappingError";
  }
}
function invalid(): never { throw new InventoryMappingError(); }
export function exactInventoryQuantity(value: unknown): string {
  if (typeof value !== "string") return invalid();
  try { return quantityDecimal(quantityUnits(value)); }
  catch { return invalid(); }
}

/** Proposed row DTO, not existing SQL columns. References must be authorized in scope. */
export function mapInventoryBalance(
  input: Readonly<Record<string, unknown>>,
  scope: InventoryReadScope,
  references: Readonly<{ items: readonly InventoryItem[]; warehouses: readonly InventoryWarehouse[] }>,
): PersistedBalance {
  if (!scope.tenantId.trim() || !scope.organizationId.trim() || !scope.siteIds.length ||
      scope.siteIds.some((id) => !id.trim()) || input.tenant_id !== scope.tenantId ||
      input.organization_id !== scope.organizationId || typeof input.site_id !== "string" ||
      !scope.siteIds.includes(input.site_id)) return invalid();
  const text = (key: string, allowEmpty = false): string => {
    const value = input[key];
    if (typeof value !== "string" || (!allowEmpty && !value.trim())) return invalid();
    return value;
  };
  const itemId = text("item_id"), warehouseId = text("warehouse_id"), unit = text("unit");
  const item = references.items.find((row) => row.id === itemId);
  const warehouse = references.warehouses.find((row) => row.id === warehouseId);
  if (!item || !warehouse || warehouse.siteId !== input.site_id || item.baseUnit !== unit) return invalid();
  const status = text("inventory_status");
  if (status !== "AVAILABLE" && status !== "QC_HOLD" && status !== "BLOCKED") return invalid();
  const onHandQty = exactInventoryQuantity(input.on_hand_qty);
  if (quantityUnits(onHandQty) < BigInt(0)) return invalid();
  if (input.updated_at instanceof Date && !Number.isFinite(input.updated_at.getTime())) return invalid();
  const updatedAt = input.updated_at instanceof Date ? input.updated_at.toISOString() : text("updated_at");
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) return invalid();
  const day = updatedAt.slice(0, 10);
  if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return invalid();
  return { id: text("id"), itemId, siteId: input.site_id, warehouseId,
    locationLabel: text("location_label", true), lotCode: text("lot_code", true),
    inventoryStatus: status, onHandQty, unit, updatedAt };
}

/** Caller-supplied scope is never proof of authenticated membership. */
export async function readPersistentInventory(repository: InventoryReadRepository): Promise<InventoryReadSnapshot> {
  await requirePersistentAccess();
  // Site authorization and approved storage remain prerequisites after auth is implemented.
  void repository;
  throw new Error("INVENTORY_PERSISTENCE_NOT_ENABLED");
}
