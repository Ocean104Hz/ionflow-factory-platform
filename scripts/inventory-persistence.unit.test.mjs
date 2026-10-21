import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { exactInventoryQuantity, mapInventoryBalance, readPersistentInventory, InventoryMappingError } from "../src/server/inventory/inventory-repository.ts";
const scope = { tenantId: "tenant-a", organizationId: "org-a", siteIds: ["site-a"] };
const references = { items: [{ id: "item-a", code: "A", name: "Demo", itemType: "RAW", itemGroup: "demo", category: "demo", baseUnit: "kg", active: true }], warehouses: [{ id: "wh-a", siteId: "site-a", code: "A", name: "Demo" }] };
const row = { id: "position-a", tenant_id: "tenant-a", organization_id: "org-a", item_id: "item-a", site_id: "site-a", warehouse_id: "wh-a", location_label: "A", lot_code: "L1", inventory_status: "QC_HOLD", on_hand_qty: "90071992547409.123456", unit: "kg", updated_at: new Date("2026-10-21T00:00:00Z") };
test("NUMERIC mapping is exact without coercion or rounding", () => {
  assert.equal(exactInventoryQuantity(row.on_hand_qty), row.on_hand_qty);
  assert.equal(exactInventoryQuantity("0001.230000"), "1.23");
  for (const value of [1.23, NaN, Infinity, null, "1e3", "0.0000001", "100000000000000", "invalid"])
    assert.throws(() => exactInventoryQuantity(value), InventoryMappingError);
});
test("all balance dimensions map without mutation, including zero positions", () => {
  const before = structuredClone(row);
  assert.deepEqual(mapInventoryBalance(row, scope, references), { id: row.id, itemId: row.item_id, siteId: row.site_id, warehouseId: row.warehouse_id, locationLabel: row.location_label, lotCode: row.lot_code, inventoryStatus: row.inventory_status, onHandQty: row.on_hand_qty, unit: row.unit, updatedAt: row.updated_at.toISOString() });
  assert.deepEqual(row, before);
  assert.equal(mapInventoryBalance({ ...row, on_hand_qty: "0", lot_code: "" }, scope, references).onHandQty, "0");
});
test("invalid ownership, references, units, status, quantity and dates fail closed", () => {
  for (const patch of [{ tenant_id: "other" }, { organization_id: "other" }, { site_id: "other" }, { warehouse_id: "missing" }, { item_id: "missing" }, { inventory_status: "RAW" }, { unit: "ton" }, { on_hand_qty: "-1" }, { updated_at: "bad" }, { updated_at: "2026-02-31T00:00:00Z" }, { updated_at: new Date(NaN) }, { id: "" }])
    assert.throws(() => mapInventoryBalance({ ...row, ...patch }, scope, references), InventoryMappingError);
  assert.throws(() => mapInventoryBalance(row, { ...scope, siteIds: [] }, references), InventoryMappingError);
  assert.throws(() => mapInventoryBalance(row, scope, { ...references, warehouses: [{ ...references.warehouses[0], siteId: "wrong" }] }), InventoryMappingError);
});
test("new persistence contract passes scoped strict semantic checks", () => {
  const file = fileURLToPath(new URL("../src/server/inventory/inventory-repository.ts", import.meta.url));
  const program = ts.createProgram([file], {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true,
    skipLibCheck: true, esModuleInterop: true, noEmit: true,
    allowImportingTsExtensions: true, types: ["node"],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(diagnostics.length, 0, ts.formatDiagnostics(diagnostics, {
    getCurrentDirectory: () => process.cwd(), getCanonicalFileName: (f) => f, getNewLine: () => "\n",
  }));
});
test("unverified identity cannot invoke persistent repository", async () => {
  let calls = 0;
  await assert.rejects(readPersistentInventory({ readSnapshot() { calls++; throw Error("must not run"); } }), (error) => error.code === "AUTH_NOT_CONFIGURED");
  assert.equal(calls, 0);
});
test("boundary is server-only and Demo provider remains active", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/server/inventory/inventory-repository.ts"), /import "server-only"/);
  const provider = read("src/features/inventory/inventory-operations-provider.tsx");
  assert.match(provider, /createStockSession\(inventoryLedger, ledgerContext\)/);
  assert.doesNotMatch(provider, /server\/inventory|readPersistentInventory/);
});
