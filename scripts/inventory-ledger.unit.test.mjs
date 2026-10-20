import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const url = (file, replacements = {}) => {
  let code = ts.transpileModule(read(file), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements))
    code = code.replaceAll(`"${specifier}"`, `"${replacement}"`);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
};
const quantityUrl = url("src/features/inventory/inventory-quantity.ts");
const q = await import(quantityUrl);
const domainUrl = url("src/features/inventory/inventory-domain.ts", {
  "./inventory-quantity": quantityUrl,
});
const d = await import(domainUrl);
const masterUrl = url("src/lib/mock-data/master-settings.ts");
const fixturesUrl = url("src/lib/mock-data/inventory.ts", {
  "./master-settings": masterUrl,
});
const f = await import(fixturesUrl);
const ledgerUrl = url("src/features/inventory/inventory-ledger-domain.ts", {
  "./inventory-domain": domainUrl,
  "./inventory-quantity": quantityUrl,
});
const l = await import(ledgerUrl);
const historyUrl = url("src/lib/mock-data/inventory-ledger.ts", {
  "./inventory": fixturesUrl,
  "@/src/features/inventory/inventory-quantity": quantityUrl,
  "@/src/features/inventory/inventory-ledger-domain": ledgerUrl,
});
const h = await import(historyUrl);
const context = {
  items: f.inventoryItems,
  sites: f.inventorySites,
  warehouses: f.inventoryWarehouses,
  positions: h.inventoryPositions,
};
const events = h.inventoryLedger;
const replay = (rows = events, date) => l.replayLedger(rows, context, date);
const requireSuccess = (result) => {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
const itemTotal = (result, id) =>
  d
    .aggregateInventory(f.inventoryItems, requireSuccess(result).balances)
    .find((row) => row.item.id === id).totalQty;
const patchEvent = (id, change) =>
  events.map((event) =>
    event.id === id ? change(structuredClone(event)) : event,
  );
const assertInvalid = (rows, pattern) => {
  const result = replay(rows);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "INVALID");
  assert.match(result.errors.map((error) => error.message).join(" "), pattern);
  assert.equal("balances" in result, false);
};
const extraEvent = (id, type, quantity, patch = {}) => ({
  id,
  eventType: type,
  postedAt: "2026-10-17T01:00:00Z",
  order: 20,
  documentNo: `DEMO-${id}`,
  reason: "ทดสอบเท่านั้น",
  postings: [
    { ...events[0].postings[0], id: `p-${id}`, quantityDelta: quantity },
  ],
  ...patch,
});

test("immutable opening and history replay reconcile all 21 original positions exactly", () => {
  const result = requireSuccess(replay());
  const reconciliation = l.reconcileInventory(
    result.balances,
    f.inventoryBalances,
  );
  assert.equal(result.balances.length, 21);
  assert.equal(reconciliation.ok, true);
  assert.equal(reconciliation.matching.length, 21);
  assert.deepEqual(reconciliation.missing, []);
  assert.deepEqual(reconciliation.unexpected, []);
  assert.deepEqual(reconciliation.differences, []);
  assert.equal(itemTotal(result, "raw-a"), 2200);
  assert.equal(events.length, 12);
  assert.equal(
    events.filter((event) => event.eventType === "OPENING").length,
    1,
  );
  assert.ok(Object.isFrozen(events));
  assert.ok(
    events.every(
      (event) =>
        Object.isFrozen(event) &&
        Object.isFrozen(event.postings) &&
        event.postings.every(Object.isFrozen),
    ),
  );
});
test("initialization/replay never append or double count opening events and zero identities are retained", () => {
  const before = structuredClone(events);
  assert.deepEqual(replay(), replay());
  assert.deepEqual(events, before);
  assertInvalid([...events, ...events], /ซ้ำ|ตั้งต้น/);
  assertInvalid(
    [
      ...events,
      {
        ...events[0],
        id: "other-opening",
        postings: events[0].postings.map((posting) => ({
          ...posting,
          id: `other-${posting.id}`,
        })),
      },
    ],
    /ตั้งต้น/,
  );
  const zero = requireSuccess(replay()).balances.find(
    (row) => row.id === "b07",
  );
  assert.equal(zero.onHandQty, 0);
  assert.ok(
    events.every((event) =>
      event.postings.every((posting) => posting.quantityDelta !== "0"),
    ),
  );
});
test("fixed point arithmetic is exact, preserves six decimals, rejects extra precision and lossy adapters", () => {
  assert.equal(
    q.quantityDecimal(q.quantityUnits("0.1") + q.quantityUnits("0.2")),
    "0.3",
  );
  assert.equal(q.inventoryQuantity("1234.123456"), "1,234.123456");
  for (const value of ["0.0000001", "NaN", "Infinity", "1e3", NaN, Infinity])
    assert.throws(() => q.quantityUnits(value));
  assert.throws(() => q.quantityUnits("100000000000000"), /ช่วงตัวเลข/);
  assert.throws(
    () => q.quantityNumber(q.quantityUnits("99999999999999.999999")),
    /แม่นยำ|ช่วงตัวเลข/,
  );
  const base = f.inventoryBalances[0];
  const rows = [
    { ...base, id: "decimal-a", onHandQty: 0.1 },
    { ...base, id: "decimal-b", onHandQty: 0.2 },
  ];
  assert.equal(
    d
      .aggregateInventory(f.inventoryItems, rows)
      .find((row) => row.item.id === base.itemId).totalQty,
    0.3,
  );
});
test("stock keys include every dimension, retain location and status distinctions", () => {
  const position = h.inventoryPositions[0];
  const key = l.stockKey(position);
  for (const field of [
    "itemId",
    "siteId",
    "warehouseId",
    "locationLabel",
    "lotCode",
    "inventoryStatus",
  ])
    assert.notEqual(
      l.stockKey({ ...position, [field]: `${position[field]}-different` }),
      key,
    );
  assert.equal(l.stockKey({ ...position, id: "unrelated-id" }), key);
  const balance = f.inventoryBalances[0];
  const cases = [
    balance,
    {
      ...balance,
      id: "case-sensitive",
      lotCode: balance.lotCode.toLowerCase(),
    },
  ];
  assert.equal(
    d
      .aggregateInventory(f.inventoryItems, cases)
      .find((row) => row.item.id === balance.itemId).lotCount,
    2,
  );
});
test("transfers conserve quantities per item/Lot/status, not just a global mixed-unit total", () => {
  const transfer = events.find((event) => event.id === "transfer-raw");
  assert.equal(transfer.postings.length, 2);
  assert.equal(
    transfer.postings.reduce(
      (sum, posting) => sum + q.quantityUnits(posting.quantityDelta),
      BigInt(0),
    ),
    BigInt(0),
  );
  assertInvalid(
    patchEvent("transfer-raw", (event) => ({
      ...event,
      postings: event.postings.map((posting, index) =>
        index === 1 ? { ...posting, quantityDelta: "49" } : posting,
      ),
    })),
    /รักษายอด/,
  );
  assertInvalid(
    patchEvent("transfer-raw", (event) => ({
      ...event,
      postings: event.postings.map((posting, index) =>
        index === 1 ? { ...posting, lotCode: "different" } : posting,
      ),
    })),
    /รักษายอด/,
  );
});
test("QC changes conserve stock and cannot silently change location, Lot or item", () => {
  assert.equal(itemTotal(replay(events, "2026-10-06"), "raw-a"), 2200);
  const balance = requireSuccess(replay(events, "2026-10-06")).balances.filter(
    (row) => row.itemId === "raw-a" && row.lotCode === "DEMO-LOT-A",
  );
  assert.equal(balance.length, 3);
  assert.equal(new Set(balance.map((row) => row.inventoryStatus)).size, 2);
  for (const field of ["locationLabel", "lotCode"])
    assertInvalid(
      patchEvent("qc-hold", (event) => ({
        ...event,
        postings: event.postings.map((posting, index) =>
          index === 1 ? { ...posting, [field]: "different" } : posting,
        ),
      })),
      /รักษายอด/,
    );
});
test("event postings are atomic and negative projected stock fails without partial balances", () => {
  assertInvalid(
    [...events, extraEvent("negative", "ISSUE", "-999999")],
    /ติดลบ/,
  );
  const atomic = extraEvent("atomic", "ADJUSTMENT", "-9999");
  atomic.postings.push({
    ...atomic.postings[0],
    id: "atomic-credit",
    quantityDelta: "9999",
  });
  assert.equal(itemTotal(replay([...events, atomic]), "raw-a"), 2200);
});
test("duplicate event and posting IDs are rejected", () => {
  assertInvalid([...events, events[1]], /เหตุการณ์ซ้ำ/);
  assertInvalid(
    patchEvent("issue-raw", (event) => ({
      ...event,
      postings: [{ ...event.postings[0], id: events[1].postings[0].id }],
    })),
    /posting ซ้ำ/,
  );
});
test("invalid quantities, units, item/site/warehouse/status references are rejected explicitly", () => {
  for (const patch of [
    { quantityDelta: "0" },
    { quantityDelta: "NaN" },
    { quantityDelta: "0.0000001" },
    { unit: "ตัน" },
    { itemId: "missing" },
    { warehouseId: "missing" },
    { siteId: "wrong" },
    { inventoryStatus: "UNKNOWN" },
  ]) {
    assertInvalid(
      patchEvent("receipt-raw", (event) => ({
        ...event,
        postings: [{ ...event.postings[0], ...patch }],
      })),
      /ศูนย์|จำนวน|หน่วย|อ้างอิง|สถานะ/,
    );
  }
  assertInvalid(
    patchEvent("receipt-raw", (event) => ({
      ...event,
      postings: [{ ...event.postings[0], quantityDelta: "-1" }],
    })),
    /เป็นบวก/,
  );
  assertInvalid(
    patchEvent("issue-raw", (event) => ({
      ...event,
      postings: [{ ...event.postings[0], quantityDelta: "1" }],
    })),
    /เป็นลบ/,
  );
});
test("missing documents, reasons, malformed dates/order and unreconciled opening data are not hidden", () => {
  for (const patch of [
    { documentNo: " " },
    { postedAt: "2026-02-30T02:00:00Z" },
    { postedAt: "2026-10-03" },
    { postedAt: "2026-10-03T02:00:00" },
    { order: 1.5 },
  ])
    assertInvalid(
      patchEvent("receipt-raw", (event) => ({ ...event, ...patch })),
      /เอกสาร|เวลา|ลำดับ/,
    );
  assertInvalid(
    patchEvent("adjust-label", (event) => ({ ...event, reason: "" })),
    /เหตุผล/,
  );
  assertInvalid(
    events.filter((event) => event.eventType !== "OPENING"),
    /ตั้งต้น/,
  );
  const changed = patchEvent("opening-20261001", (event) => ({
    ...event,
    postings: event.postings.map((posting, index) =>
      index === 0 ? { ...posting, quantityDelta: "1131" } : posting,
    ),
  }));
  assert.equal(
    l.reconcileInventory(
      requireSuccess(replay(changed)).balances,
      f.inventoryBalances,
    ).ok,
    false,
  );
});
test("same timestamp replay is deterministic by order then stable event ID", () => {
  assert.deepEqual(replay([...events].reverse()), replay());
  const source = h.inventoryPositions.find((row) => row.id === "b07");
  const event = (id, type, quantity) => ({
    ...extraEvent(id, type, quantity),
    postedAt: "2026-10-17T01:00:00Z",
    postings: [{ ...source, id: `tie-${id}`, quantityDelta: quantity }],
  });
  const credit = event("a", "RECEIPT", "1");
  const debit = event("b", "ISSUE", "-1");
  assert.deepEqual(
    replay([...events, debit, credit]),
    replay([...events, credit, debit]),
  );
  assert.equal(
    requireSuccess(replay([...events, debit, credit])).balances.find(
      (row) => row.id === "b07",
    ).onHandQty,
    0,
  );
});
test("historical replay uses postings by inclusive Bangkok end-of-day and current fixtures are not used", () => {
  assert.equal(itemTotal(replay(events, "2026-10-01"), "raw-a"), 2080);
  assert.equal(itemTotal(replay(events, "2026-10-02"), "raw-a"), 2280);
  assert.equal(itemTotal(replay(events, "2026-10-03"), "raw-a"), 2200);
  const late = extraEvent("late", "RECEIPT", "1", {
    postedAt: "2026-10-16T16:59:59.999Z",
  });
  const next = extraEvent("next", "RECEIPT", "2", {
    postedAt: "2026-10-16T17:00:00Z",
  });
  assert.equal(
    itemTotal(replay([...events, late, next], "2026-10-16"), "raw-a"),
    2201,
  );
  assert.equal(
    itemTotal(replay([...events, late, next], "2026-10-17"), "raw-a"),
    2203,
  );
  assert.equal(replay(events, "2026-09-30").kind, "BEFORE_OPENING");
  assert.equal(replay(events, "not-a-date").kind, "INVALID");
  assert.equal(l.ledgerBusinessDate("2026-10-16T17:00:00Z"), "2026-10-17");
});
test("empty ledger has no fabricated balances and invalid position registries fail", () => {
  const empty = requireSuccess(replay([]));
  assert.deepEqual(empty.balances, []);
  assert.equal(empty.supportedFrom, null);
  const invalid = l.replayLedger(events, {
    ...context,
    positions: [...context.positions, context.positions[0]],
  });
  assert.equal(invalid.ok, false);
});
test("reconciliation reports missing, unexpected and changed positions separately", () => {
  const balances = requireSuccess(replay()).balances;
  const changed = balances.map((row, index) =>
    index === 0 ? { ...row, onHandQty: row.onHandQty + 1 } : row,
  );
  assert.equal(
    l.reconcileInventory(changed, f.inventoryBalances).differences.length,
    1,
  );
  assert.equal(
    l.reconcileInventory(balances.slice(1), f.inventoryBalances).missing.length,
    1,
  );
  assert.equal(
    l.reconcileInventory(
      [...balances, { ...balances[0], locationLabel: "unexpected" }],
      f.inventoryBalances,
    ).unexpected.length,
    1,
  );
  assert.throws(
    () => l.reconcileInventory([...balances, balances[0]], f.inventoryBalances),
    /ซ้ำ/,
  );
});
test("movement queries keep paired postings together and find either source or destination warehouse", () => {
  for (const warehouseId of ["wh-1", "wh-2"]) {
    const results = l.filterMovements(
      events,
      {
        ...l.defaultMovementFilters,
        eventType: "TRANSFER",
        search: "DEMO-TR-001",
        warehouseId,
      },
      context,
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].postings.length, 2);
  }
  for (const search of [
    " demo-tr-001 ",
    "DEMO-RM001",
    "แร่ผสม",
    "WH02",
    "คลังรองสาธิต",
    "DEMO-LOT-A",
  ])
    assert.ok(
      l.filterMovements(
        events,
        { ...l.defaultMovementFilters, search },
        context,
      ).length > 0,
    );
  assert.equal(
    l.filterMovements(
      events,
      { ...l.defaultMovementFilters, search: "no-match" },
      context,
    ).length,
    0,
  );
  assert.ok(
    l
      .filterMovements(
        events,
        {
          ...l.defaultMovementFilters,
          itemId: "wip-a",
          lot: "demo-mix-a",
          from: "2026-10-08",
          to: "2026-10-08",
        },
        context,
      )
      .every((event) => event.id === "transfer-wip"),
  );
  assert.equal(
    l.filterMovements(
      events,
      {
        ...l.defaultMovementFilters,
        siteId: "inventory-site-east",
        warehouseId: "wh-1",
      },
      context,
    ).length,
    0,
  );
  assert.throws(
    () =>
      l.filterMovements(
        events,
        { ...l.defaultMovementFilters, from: "2026-10-10", to: "2026-10-01" },
        context,
      ),
    /วันที่/,
  );
});
test("Lot summary is separate from full storage positions and never mixes items or units", () => {
  const rows = requireSuccess(replay()).balances;
  const lot = l
    .summarizeLots(rows.filter((row) => row.itemId === "raw-a"))
    .find((row) => row.lotCode === "DEMO-LOT-A");
  assert.equal(lot.quantity, "1700");
  assert.equal(lot.positions, 2);
  const historical = requireSuccess(replay(events, "2026-10-06")).balances;
  assert.equal(
    l
      .summarizeLots(historical.filter((row) => row.itemId === "raw-a"))
      .find((row) => row.lotCode === "DEMO-LOT-A").positions,
    3,
  );
});

test("warehouse/location projection groups Lots without merging QC status or units", () => {
  const rows = requireSuccess(replay()).balances;
  const base = rows.find((row) => row.id === "b01");
  const grouped = l.aggregateWarehouseLocations([
    base,
    { ...base, id: "extra", lotCode: "another-lot", onHandQty: 5 },
    { ...base, id: "qc", inventoryStatus: "QC_HOLD", onHandQty: 7 },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(
    grouped.find((row) => row.inventoryStatus === "AVAILABLE").quantity,
    "1205",
  );
  assert.equal(
    grouped.find((row) => row.inventoryStatus === "AVAILABLE").lotCount,
    2,
  );
  assert.equal(
    grouped.find((row) => row.inventoryStatus === "QC_HOLD").quantity,
    "7",
  );
});

test("historical queries cannot hide invalid future events and queries do not mutate fixtures", () => {
  const before = structuredClone({
    events,
    items: f.inventoryItems,
    balances: f.inventoryBalances,
  });
  for (const day of ["2026-10-01", "2026-10-06", "2026-10-16"])
    requireSuccess(replay(events, day));
  assert.equal(
    replay(
      [...events, extraEvent("future-negative", "ISSUE", "-999999")],
      "2026-10-01",
    ).kind,
    "INVALID",
  );
  assert.deepEqual(
    { events, items: f.inventoryItems, balances: f.inventoryBalances },
    before,
  );
});

test("Explorer consumes live ledger projection and preserves Step 1 controls and immutable history", () => {
  const explorer = read("src/features/inventory/inventory-explorer.tsx");
  assert.match(
    explorer,
    /inventoryProjection\.ok\s*\? inventoryProjection.balances : \[\]/,
  );
  assert.doesNotMatch(explorer, /\binventoryBalances\b/);
  assert.match(explorer, /useInventoryOperations/);
  assert.match(explorer, /InventoryOperationsDialog/);
  for (const token of [
    "InventoryFilters",
    "InventoryTable",
    "InventoryDetail",
    "InventoryHistory",
    "inventoryReconciliation",
  ])
    assert.ok(explorer.includes(token));
  const detail = read("src/features/inventory/inventory-detail.tsx");
  for (const value of ["overview", "lots", "history"])
    assert.match(detail, new RegExp(`<TabsTrigger value="${value}"`));
  assert.match(detail, /InventoryAsOf/);
  assert.match(detail, /onOpenHistory\(item.id\)/);
  const history = read("src/features/inventory/inventory-history.tsx");
  assert.match(history, /FactoryDataTable/);
  assert.match(history, /event.postings/);
  assert.match(history, /filterMovements/);
  for (const source of [
    history,
    read("src/features/inventory/inventory-ledger-data.ts"),
    read("src/features/inventory/inventory-as-of.tsx"),
  ])
    assert.doesNotMatch(
      source,
      /fetch\(|localStorage|sessionStorage|createContext|\bany\b/,
    );
  const schema = read("docs/inventory-ledger-schema.md");
  assert.match(schema, /PROPOSED \/ NOT APPLIED/);
  assert.match(schema, /NUMERIC\(20,6\)/);
  assert.match(schema, /Factory Settings/);
});
