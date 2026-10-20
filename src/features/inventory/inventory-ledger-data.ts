import {
  inventoryBalances,
  inventoryItems,
  inventorySites,
  inventoryWarehouses,
} from "@/src/lib/mock-data/inventory";
import {
  inventoryLedger,
  inventoryPositions,
} from "@/src/lib/mock-data/inventory-ledger";
import {
  reconcileInventory,
  replayLedger,
  type LedgerContext,
} from "./inventory-ledger-domain";

export const ledgerContext: LedgerContext = {
  items: inventoryItems,
  sites: inventorySites,
  warehouses: inventoryWarehouses,
  positions: inventoryPositions,
};
export const inventoryProjection = replayLedger(inventoryLedger, ledgerContext);
export const inventoryReconciliation = inventoryProjection.ok
  ? reconcileInventory(inventoryProjection.balances, inventoryBalances)
  : null;
