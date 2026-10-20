import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(compile(source)).toString("base64")}`;
const quantityUrl = moduleUrl(
  read("src/features/inventory/inventory-quantity.ts"),
);
const domain = await import(
  moduleUrl(
    read("src/features/inventory/inventory-domain.ts").replace(
      'from "./inventory-quantity"',
      `from "${quantityUrl}"`,
    ),
  )
);
const masterUrl = moduleUrl(read("src/lib/mock-data/master-settings.ts"));
const fixtures = await import(
  moduleUrl(
    read("src/lib/mock-data/inventory.ts").replace(
      'from "./master-settings"',
      `from "${masterUrl}"`,
    ),
  )
);
const {
  inventoryItems: items,
  inventoryBalances: balances,
  inventoryWarehouses: warehouses,
  inventorySites: sites,
} = fixtures;
const defaults = domain.defaultInventoryFilters;
const scoped = (scope = {}) =>
  domain.aggregateInventory(items, balances, { ...defaults, ...scope });
const filtered = (filters = {}) =>
  domain.filterInventory(scoped(filters), { ...defaults, ...filters });
const raw = (rows) => rows.find((row) => row.item.id === "raw-a");

test("canonical classification is explicit and unknown legacy values are not OTHER or inferred from names", () => {
  assert.deepEqual(Object.keys(domain.inventoryTypes), [
    "RAW",
    "PACKAGING",
    "WIP",
    "FG",
    "MRO",
    "OTHER",
  ]);
  for (const key of Object.keys(domain.inventoryTypes))
    assert.equal(domain.classifyInventory(key), key);
  assert.equal(domain.classifyInventory(" raw "), "RAW");
  for (const value of [
    null,
    undefined,
    "",
    "LEGACY-X",
    "วัตถุดิบ",
    "constructor",
  ])
    assert.equal(domain.classifyInventory(value), "UNMAPPED");
  assert.equal(domain.classifyInventory("OTHER"), "OTHER");
  assert.deepEqual(
    filtered({ itemType: "OTHER" }).map((row) => row.item.id),
    ["other-a"],
  );
  assert.deepEqual(
    filtered({ itemType: "UNMAPPED" }).map((row) => row.item.id),
    ["unmapped-a"],
  );
});

test("fixtures cover six types, valid references, multiple sites/warehouses and optional fields", () => {
  const validation = domain.validateInventoryBalances(
    items,
    balances,
    warehouses,
  );
  assert.equal(validation.issues.length, 0);
  assert.equal(validation.valid.length, balances.length);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  assert.equal(new Set(items.map((item) => item.code)).size, items.length);
  for (const warehouse of warehouses)
    assert.ok(sites.some((site) => site.id === warehouse.siteId));
  for (const type of Object.keys(domain.inventoryTypes))
    assert.ok(filtered({ itemType: type }).length > 0);
  assert.ok(
    items.some(
      (item) => item.brand === undefined && item.specification === undefined,
    ),
  );
  assert.ok(items.some((item) => !item.active));
});

test("aggregation gives one row per item and counts shared Lots and warehouses without double counting", () => {
  const rows = scoped();
  assert.equal(rows.length, items.length);
  assert.equal(new Set(rows.map((row) => row.item.id)).size, rows.length);
  const row = raw(rows);
  assert.equal(row.totalQty, 2200);
  assert.equal(row.availableQty, 1900);
  assert.equal(row.qcHeldQty, 300);
  assert.equal(row.blockedQty, 0);
  assert.equal(row.warehouseCount, 3);
  assert.equal(row.lotCount, 3);
  assert.equal(row.balances.length, 4);
});

test("site and warehouse scope changes quantities, breakdowns, counts and does not invent unassigned stock", () => {
  const site = raw(scoped({ siteId: "site-demo" }));
  assert.equal(site.totalQty, 2000);
  assert.equal(site.warehouseCount, 2);
  assert.equal(site.lotCount, 2);
  const warehouse = raw(scoped({ warehouseId: "wh-1" }));
  assert.equal(warehouse.totalQty, 1500);
  assert.equal(warehouse.balances.length, 2);
  assert.equal(raw(scoped({ siteId: "inventory-site-east" })).totalQty, 200);
  assert.deepEqual(
    scoped({ siteId: "site-demo", warehouseId: "inventory-wh-east" }),
    [],
  );
  assert.deepEqual(scoped({ warehouseId: "missing" }), []);
});

test("text search trims and ignores case across code/name/specification/group/category and Lot", () => {
  for (const search of [
    " demo-rm001 ",
    "แร่ผสมสำหรับ",
    "ละเอียด",
    "แร่และสารผสม",
    "วัสดุการผลิต",
  ])
    assert.ok(raw(filtered({ search })));
  const row = raw(filtered({ search: " demo-lot-a " }));
  assert.equal(row.totalQty, 1700);
  assert.equal(row.balances.length, 2);
  assert.equal(row.lotCount, 1);
  assert.equal(row.warehouseCount, 2);
  assert.equal(
    raw(filtered({ search: "DEMO-LOT-A", warehouseId: "wh-2" })).totalQty,
    500,
  );
  assert.equal(filtered({ search: "does-not-exist" }).length, 0);
});

test("QC disposition is independent of type and displayed totals use the selected status", () => {
  const qc = filtered({ itemType: "RAW", inventoryStatus: "QC_HOLD" });
  assert.equal(qc.length, 2);
  assert.equal(raw(qc).totalQty, 300);
  assert.equal(raw(qc).availableQty, 0);
  assert.ok(
    qc.every((row) =>
      row.balances.every((balance) => balance.inventoryStatus === "QC_HOLD"),
    ),
  );
  const blocked = filtered({ inventoryStatus: "BLOCKED" });
  assert.deepEqual(
    blocked.map((row) => row.item.id),
    ["raw-d", "fg-a"],
  );
  assert.equal(blocked.find((row) => row.item.id === "fg-a").blockedQty, 45);
  assert.equal(
    filtered({ inventoryStatus: "BLOCKED", search: "DEMO-LOT-A" }).length,
    0,
  );
});

test("low-stock only uses configured reorder points and all statuses/Lots in the location scope", () => {
  assert.equal(
    domain.isLowStock({ ...items[0], reorderPoint: undefined }, 0),
    false,
  );
  assert.equal(
    domain.isLowStock({ ...items[0], reorderPoint: 100 }, 100),
    false,
  );
  assert.equal(domain.isLowStock({ ...items[0], reorderPoint: 100 }, 99), true);
  assert.equal(domain.isLowStock({ ...items[0], reorderPoint: NaN }, 0), false);
  assert.equal(raw(filtered({ inventoryStatus: "QC_HOLD" })).lowStock, false);
  assert.equal(
    raw(filtered({ inventoryStatus: "QC_HOLD" })).scopeOnHandQty,
    2200,
  );
  assert.equal(raw(filtered({ search: "DEMO-LOT-C" })).lowStock, false);
  assert.equal(raw(scoped({ siteId: "inventory-site-east" })).lowStock, true);
  assert.deepEqual(
    filtered({ lowStock: "LOW" }).map((row) => row.item.id),
    ["raw-b", "raw-c", "pack-b", "mro-a"],
  );
  assert.ok(filtered({ lowStock: "NOT_LOW" }).every((row) => !row.lowStock));
});

test("zero balances and items without snapshots remain browseable without creating imaginary balances", () => {
  assert.deepEqual(
    filtered({ zeroBalance: "ZERO" }).map((row) => row.item.id),
    ["raw-c", "fg-c"],
  );
  const row = scoped().find((row) => row.item.id === "fg-c");
  assert.equal(row.totalQty, 0);
  assert.equal(row.lotCount, 0);
  assert.equal(row.warehouseCount, 0);
  assert.equal(row.balances.length, 0);
  assert.equal(row.lowStock, false);
  assert.ok(
    filtered({ zeroBalance: "NONZERO" }).every((row) => row.totalQty > 0),
  );
});

test("advanced item group/category/unit/brand filters combine with type and scope", () => {
  assert.deepEqual(
    filtered({
      itemType: "PACKAGING",
      itemGroup: "ฉลาก",
      category: "บรรจุภัณฑ์",
      unit: "ใบ",
    }).map((row) => row.item.id),
    ["pack-b"],
  );
  assert.ok(
    filtered({ brand: "DEMO LAB" }).every(
      (row) => row.item.brand === "DEMO LAB",
    ),
  );
  assert.equal(filtered({ itemType: "RAW", unit: "กระสอบ" }).length, 0);
});

test("KPIs count distinct items rather than summing incompatible units", () => {
  assert.deepEqual(domain.summarizeInventory(scoped()), {
    itemCount: 16,
    lowStockCount: 4,
    qcHeldCount: 3,
  });
  assert.deepEqual(
    domain.summarizeInventory(scoped({ siteId: "inventory-site-east" })),
    { itemCount: 5, lowStockCount: 2, qcHeldCount: 0 },
  );
  const counts = domain.inventoryTypeCounts(scoped());
  assert.deepEqual(counts, {
    ALL: 16,
    RAW: 4,
    PACKAGING: 3,
    WIP: 2,
    FG: 3,
    MRO: 2,
    OTHER: 1,
    UNMAPPED: 1,
  });
  assert.ok(new Set(items.map((item) => item.baseUnit)).size > 1);
});

test("invalid negative/non-finite quantities and wrong units are flagged and never aggregated", () => {
  for (const patch of [
    { onHandQty: -1 },
    { onHandQty: NaN },
    { onHandQty: Infinity },
    { onHandQty: -Infinity },
    { unit: "ตัน" },
  ]) {
    const invalid = { ...balances[0], ...patch };
    const result = domain.validateInventoryBalances(
      items,
      [invalid],
      warehouses,
    );
    assert.equal(result.valid.length, 0);
    assert.equal(result.issues.length, 1);
    assert.throws(() => domain.aggregateInventory(items, [invalid]));
  }
  assert.throws(
    () =>
      domain.aggregateInventory(items, [
        { ...balances[0], onHandQty: Number.MAX_VALUE },
        { ...balances[1], onHandQty: Number.MAX_VALUE },
      ]),
    /ยอดรวม|ช่วงตัวเลข|ทศนิยม/,
  );
});

test("orphan references, mismatched sites, dates/statuses and duplicate snapshots are rejected", () => {
  for (const patch of [
    { itemId: "missing" },
    { warehouseId: "missing" },
    { siteId: "wrong-site" },
    { updatedAt: "bad" },
    { inventoryStatus: "PENDING" },
  ]) {
    const result = domain.validateInventoryBalances(
      items,
      [{ ...balances[0], ...patch }],
      warehouses,
    );
    assert.equal(result.valid.length, 0);
    assert.equal(result.issues.length, 1);
  }
  const duplicates = domain.validateInventoryBalances(
    items,
    [balances[0], balances[0]],
    warehouses,
  );
  assert.equal(duplicates.valid.length, 1);
  assert.equal(duplicates.issues.length, 1);
  assert.throws(
    () => domain.aggregateInventory(items, [balances[0], balances[0]]),
    /ซ้ำ/,
  );
});

test("pagination clamps stale pages, handles no records and invalid sizes", () => {
  const rows = scoped();
  assert.equal(domain.paginateInventory(rows, 2, 10).rows.length, 6);
  assert.equal(domain.paginateInventory(rows, 999, 10).page, 2);
  assert.equal(domain.paginateInventory(rows, -1, 10).page, 1);
  assert.equal(domain.paginateInventory(rows, NaN, 0).pageSize, 10);
  assert.deepEqual(domain.paginateInventory([], 99, 10), {
    page: 1,
    pageSize: 10,
    total: 0,
    rows: [],
  });
  assert.deepEqual(domain.aggregateInventory([], []), []);
  assert.deepEqual(domain.summarizeInventory([]), {
    itemCount: 0,
    lowStockCount: 0,
    qcHeldCount: 0,
  });
});

test("all calculations preserve source fixtures", () => {
  const before = structuredClone({ items, balances, warehouses });
  for (const filters of [
    {},
    { siteId: "site-demo" },
    { itemType: "RAW", inventoryStatus: "QC_HOLD" },
    { search: "DEMO-LOT-A" },
    { lowStock: "LOW" },
  ])
    filtered(filters);
  domain.validateInventoryBalances(items, balances, warehouses);
  assert.deepEqual({ items, balances, warehouses }, before);
});

test("inventory route uses shared read-only components without API, storage or added provider", () => {
  assert.match(
    read("app/(factory)/inventory/page.tsx"),
    /<InventoryExplorer\s*\/>/,
  );
  const explorer = read("src/features/inventory/inventory-explorer.tsx");
  assert.match(explorer, /<TabsContent\s+value=\{filters.itemType\}/);
  for (const token of [
    "PageHeader",
    "InventoryFilters",
    "InventoryTable",
    "InventoryDetail",
    "validateInventoryBalances",
    "inventoryTypeCounts",
  ])
    assert.ok(explorer.includes(token));
  assert.match(
    read("src/features/inventory/inventory-table.tsx"),
    /FactoryDataTable/,
  );
  assert.match(
    read("src/features/inventory/inventory-detail.tsx"),
    /DialogContent/,
  );
  for (const name of [
    "inventory-domain.ts",
    "inventory-explorer.tsx",
    "inventory-filters.tsx",
    "inventory-table.tsx",
    "inventory-detail.tsx",
  ]) {
    const source = read(`src/features/inventory/${name}`);
    assert.doesNotMatch(
      source,
      /\bany\b|fetch\(|localStorage|sessionStorage|createContext|dangerouslySetInnerHTML/,
    );
  }
  assert.doesNotMatch(read("app/(factory)/layout.tsx"), /InventoryProvider/);
});
