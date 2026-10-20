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
const fixtureUrl = url("src/lib/mock-data/inventory.ts", {
  "./master-settings": url("src/lib/mock-data/master-settings.ts"),
});
const f = await import(fixtureUrl);
const ledgerUrl = url("src/features/inventory/inventory-ledger-domain.ts", {
  "./inventory-domain": domainUrl,
  "./inventory-quantity": quantityUrl,
});
const l = await import(ledgerUrl);
const h = await import(
  url("src/lib/mock-data/inventory-ledger.ts", {
    "./inventory": fixtureUrl,
    "@/src/features/inventory/inventory-quantity": quantityUrl,
    "@/src/features/inventory/inventory-ledger-domain": ledgerUrl,
  })
);
const o = await import(
  url("src/features/inventory/inventory-operations-domain.ts", {
    "./inventory-domain": domainUrl,
    "./inventory-quantity": quantityUrl,
    "./inventory-ledger-domain": ledgerUrl,
  })
);
const context = {
  items: f.inventoryItems,
  sites: f.inventorySites,
  warehouses: f.inventoryWarehouses,
  positions: h.inventoryPositions,
};
const initial = h.inventoryLedger;
const base = f.inventoryBalances.find((p) => p.id === "b01");
const key = l.stockKey(base);
const position = (events, stockKey = key) =>
  l
    .replayLedger(events, context)
    .balances.find((p) => l.stockKey(p) === stockKey);
const success = (result) => {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result;
};
const metadata = (type, id = type, events = initial) => ({
  operationId: id,
  documentNo: o.nextOperationDocument(events, type),
  postedAt: "2026-10-17T01:00:00Z",
  actor: "เจ้าหน้าที่สาธิต",
  note: "บันทึกทดสอบ",
});
const receive = (patch = {}, events = initial, id = "receipt") => ({
  ...metadata("RECEIVE", id, events),
  type: "RECEIVE",
  destination: { ...base },
  quantity: "10",
  ...patch,
});
const issue = (patch = {}, events = initial, id = "issue") => ({
  ...metadata("ISSUE", id, events),
  type: "ISSUE",
  sourceKey: key,
  quantity: "10",
  ...patch,
});
const transfer = (patch = {}) => ({
  ...metadata("TRANSFER"),
  type: "TRANSFER",
  sourceKey: key,
  warehouseId: "wh-2",
  locationLabel: base.locationLabel,
  quantity: "10",
  ...patch,
});
const adjust = (patch = {}) => ({
  ...metadata("ADJUST"),
  type: "ADJUST",
  sourceKey: key,
  countedQuantity: "1180",
  reviewedQuantity: "1200",
  reason: "ตรวจนับพบส่วนต่าง",
  ...patch,
});
const commit = (command) => o.commitStockOperation(initial, command, context);
function rejected(command, field, pattern) {
  const session = o.createStockSession(initial, context);
  const before = session.getEvents();
  const quantities = l.replayLedger(before, context);
  const result = session.commit(command);
  assert.equal(result.ok, false);
  assert.match(result.errors[field] ?? "", pattern);
  assert.equal(session.getEvents(), before);
  assert.deepEqual(l.replayLedger(session.getEvents(), context), quantities);
}

test("initial baseline remains 16 items, 12 frozen events and all 21 matching positions", () => {
  const projection = l.replayLedger(initial, context);
  assert.equal(f.inventoryItems.length, 16);
  assert.equal(initial.length, 12);
  assert.equal(
    l.reconcileInventory(projection.balances, f.inventoryBalances).matching
      .length,
    21,
  );
  assert.equal(
    l.reconcileInventory(projection.balances, f.inventoryBalances).ok,
    true,
  );
  assert.ok(
    initial.every(
      (event) => Object.isFrozen(event) && Object.isFrozen(event.postings),
    ),
  );
});
test("receipt appends exactly one immutable positive event and preserves historical objects", () => {
  const result = success(commit(receive()));
  assert.equal(result.events.length, 13);
  assert.equal(result.event.eventType, "RECEIPT");
  assert.equal(position(result.events).onHandQty, 1210);
  assert.equal(result.event.postings[0].quantityDelta, "10");
  assert.equal(result.event.operation.actor, "เจ้าหน้าที่สาธิต");
  assert.ok(
    Object.isFrozen(result.events) &&
      Object.isFrozen(result.event) &&
      Object.isFrozen(result.event.operation) &&
      Object.isFrozen(result.event.postings[0]),
  );
  initial.forEach((event, index) => assert.equal(result.events[index], event));
});
test("new Lot creates an independent QC-held position without touching existing Lots", () => {
  const destination = {
    ...base,
    lotCode: "NEW-LOT",
    inventoryStatus: "QC_HOLD",
  };
  const result = success(commit(receive({ destination })));
  assert.equal(position(result.events).onHandQty, 1200);
  assert.equal(position(result.events, l.stockKey(destination)).onHandQty, 10);
  assert.equal(l.replayLedger(result.events, context).balances.length, 22);
  assert.equal(
    l.replayLedger(result.events, context, "2026-10-16").balances.length,
    21,
  );
});
test("issue deducts only the chosen full stock key and base unit", () => {
  const result = success(commit(issue({ quantity: "300" })));
  assert.equal(position(result.events).onHandQty, 900);
  assert.equal(result.event.postings[0].quantityDelta, "-300");
  const other = f.inventoryBalances.find((p) => p.id === "b03");
  assert.equal(position(result.events, l.stockKey(other)).onHandQty, 500);
});
test("quantities reject zero, negative, nonfinite, invalid and >6 decimal inputs without side effects", () => {
  for (const quantity of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e3",
    "abc",
    "0.0000001",
    "",
    "1,000",
  ])
    rejected(issue({ quantity }), "quantity", /จำนวน|ทศนิยม/);
  for (const quantity of ["0", "-1", "0.0000001"])
    rejected(receive({ quantity }), "quantity", /จำนวน|ทศนิยม/);
});
test("exact fixed-point receipt and issue retain six decimal places", () => {
  const result = success(commit(receive({ quantity: "0.123456" })));
  assert.equal(
    q.quantityDecimal(q.quantityUnits(position(result.events).onHandQty)),
    "1200.123456",
  );
  const reduced = success(
    o.commitStockOperation(
      result.events,
      issue({ quantity: "0.123456" }, result.events),
      context,
    ),
  );
  assert.equal(position(reduced.events).onHandQty, 1200);
});
test("issue rejects shortages, unknown Lot, held and blocked positions", () => {
  rejected(
    issue({ quantity: "1200.000001" }),
    "quantity",
    /ยอดคงเหลือไม่เพียงพอสำหรับการเบิก/,
  );
  rejected(
    issue({ sourceKey: l.stockKey({ ...base, lotCode: "UNKNOWN" }) }),
    "sourceKey",
    /ไม่พบตำแหน่ง/,
  );
  for (const id of ["b02", "b08"])
    rejected(
      issue({
        sourceKey: l.stockKey(f.inventoryBalances.find((p) => p.id === id)),
      }),
      "sourceKey",
      /AVAILABLE/,
    );
});
test("receipt checks item, warehouse/site, location, unit, Lot and status", () => {
  for (const [patch, field, pattern] of [
    [{ itemId: "missing" }, "itemId", /ไม่พบสินค้า/],
    [{ warehouseId: "missing" }, "warehouseId", /คลังสินค้า/],
    [{ siteId: "inventory-site-east" }, "warehouseId", /โรงงาน/],
    [{ locationLabel: "missing" }, "locationLabel", /ตำแหน่ง/],
    [{ unit: "invalid" }, "unit", /หน่วย/],
    [{ lotCode: "" }, "lotCode", /Lot/],
    [{ inventoryStatus: "invalid" }, "inventoryStatus", /สถานะ/],
  ])
    rejected(receive({ destination: { ...base, ...patch } }), field, pattern);
});
test("transfer is one balanced atomic event preserving item, Lot, status and unit", () => {
  const result = success(commit(transfer({ quantity: "50" })));
  assert.equal(result.events.length, 13);
  assert.equal(result.event.postings.length, 2);
  assert.equal(
    result.event.postings.reduce(
      (sum, p) => sum + q.quantityUnits(p.quantityDelta),
      BigInt(0),
    ),
    BigInt(0),
  );
  assert.equal(position(result.events).onHandQty, 1150);
  assert.equal(
    position(result.events, l.stockKey({ ...base, warehouseId: "wh-2" }))
      .onHandQty,
    550,
  );
  for (const field of [
    "itemId",
    "siteId",
    "lotCode",
    "inventoryStatus",
    "unit",
  ])
    assert.equal(
      result.event.postings[0][field],
      result.event.postings[1][field],
    );
});
test("transfer supports QC_HOLD but never releases it", () => {
  const held = f.inventoryBalances.find((p) => p.id === "b02");
  const result = success(
    commit(transfer({ sourceKey: l.stockKey(held), quantity: "20" })),
  );
  assert.ok(
    result.event.postings.every((p) => p.inventoryStatus === "QC_HOLD"),
  );
});
test("transfer rejects same position, cross-site, blocked stock and shortages", () => {
  rejected(
    transfer({ warehouseId: base.warehouseId }),
    "locationLabel",
    /คนละตำแหน่ง/,
  );
  rejected(
    transfer({ warehouseId: "inventory-wh-east" }),
    "warehouseId",
    /โรงงาน/,
  );
  rejected(
    transfer({
      sourceKey: l.stockKey(f.inventoryBalances.find((p) => p.id === "b08")),
    }),
    "sourceKey",
    /ระงับ/,
  );
  rejected(transfer({ quantity: "1201" }), "quantity", /ไม่เพียงพอ/);
});
test("ledger still rejects an unbalanced transfer even outside the operation command", () => {
  const result = success(commit(transfer()));
  const broken = {
    ...result.event,
    postings: result.event.postings.map((p, i) => ({
      ...p,
      quantityDelta: i ? "9" : "-10",
    })),
  };
  assert.equal(l.replayLedger([...initial, broken], context).ok, false);
});
test("adjustment computes signed delta, records reason/count and preserves status", () => {
  for (const [countedQuantity, expected] of [
    ["1180", "-20"],
    ["1250", "50"],
    ["0", "-1200"],
  ]) {
    const result = success(commit(adjust({ countedQuantity })));
    assert.equal(result.event.postings[0].quantityDelta, expected);
    assert.equal(position(result.events).onHandQty, Number(countedQuantity));
    assert.equal(result.event.reason, "ตรวจนับพบส่วนต่าง");
    assert.equal(result.event.operation.countedQuantity, countedQuantity);
    assert.equal(result.event.postings[0].inventoryStatus, "AVAILABLE");
  }
});
test("adjustment requires reason, nonnegative exact quantity, and rejects no-op", () => {
  rejected(adjust({ reason: " " }), "reason", /เหตุผล/);
  rejected(adjust({ countedQuantity: "-1" }), "countedQuantity", /ไม่ติดลบ/);
  rejected(
    adjust({ countedQuantity: "1200" }),
    "countedQuantity",
    /ไม่มีรายการ/,
  );
  rejected(
    adjust({ countedQuantity: "1.0000001" }),
    "countedQuantity",
    /ทศนิยม/,
  );
});
test("stale adjustment requires explicit review before retry and never partially posts", () => {
  const session = o.createStockSession(initial, context);
  success(session.commit(receive()));
  const before = session.getEvents();
  const stale = session.commit(adjust());
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "STALE");
  assert.equal(stale.latestQuantity, "1210");
  assert.equal(session.getEvents(), before);
  const result = success(session.commit(adjust({ reviewedQuantity: "1210" })));
  assert.equal(result.event.postings[0].quantityDelta, "-30");
  assert.equal(position(result.events).onHandQty, 1180);
});
test("idempotent retry and double click return the same event, different payload conflicts", () => {
  const session = o.createStockSession(initial, context);
  const command = receive();
  const first = success(session.commit(command));
  const retry = success(session.commit(structuredClone(command)));
  assert.equal(retry.duplicate, true);
  assert.equal(retry.event, first.event);
  assert.equal(retry.events, first.events);
  const conflict = session.commit({ ...command, quantity: "11" });
  assert.equal(conflict.code, "CONFLICT");
  assert.equal(session.getEvents().length, 13);
});
test("duplicate document numbers, bad timestamps and metadata cannot append", () => {
  const result = success(commit(receive()));
  const duplicate = o.commitStockOperation(
    result.events,
    receive({}, initial, "another-id"),
    context,
  );
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors.documentNo, /ใช้แล้ว/);
  rejected(issue({ postedAt: "2026-02-30T01:00:00Z" }), "form", /วันที่/);
  rejected(issue({ postedAt: "2026-09-30T01:00:00Z" }), "postedAt", /ย้อนหลัง/);
  rejected(issue({ actor: "" }), "actor", /ผู้ทำรายการ/);
  rejected(issue({ operationId: "" }), "operationId", /รหัส/);
});
test("rapid competing commands use latest state; new form numbering is collision-free", () => {
  const session = o.createStockSession(initial, context);
  success(
    session.commit(issue({ quantity: "800" }, session.getEvents(), "first")),
  );
  const before = session.getEvents();
  const second = session.commit(issue({ quantity: "800" }, before, "second"));
  assert.equal(second.ok, false);
  assert.equal(session.getEvents(), before);
  assert.equal(position(before).onHandQty, 400);
  const third = success(
    session.commit(issue({ quantity: "400" }, before, "third")),
  );
  assert.equal(third.event.documentNo, "ISS-000002");
  assert.equal(position(third.events).onHandQty, 0);
});
test("older open forms append after newer events and stale adjustments still require review", () => {
  const session = o.createStockSession(initial, context);
  success(session.commit(receive({ postedAt: "2026-10-18T01:00:00Z" })));
  const stale = session.commit(adjust());
  assert.equal(stale.code, "STALE");
  const result = success(session.commit(adjust({ reviewedQuantity: "1210" })));
  assert.equal(result.event.postedAt, "2026-10-18T01:00:00.000Z");
  assert.equal(position(result.events).onHandQty, 1180);
  assert.equal(
    success(session.commit(adjust({ reviewedQuantity: "1210" }))).duplicate,
    true,
  );
});
test("failed complete event validation leaves the authoritative event array unchanged", () => {
  rejected(
    receive({ quantity: "99999999999999.999999" }),
    "form",
    /จำนวน|ช่วง|precision|NUMERIC|แม่นยำ|หน่วย|เกิน/,
  );
  const invalidEvents = [...initial, { ...initial[0], id: "bad-opening" }];
  const session = o.createStockSession(invalidEvents, context);
  const before = session.getEvents();
  assert.equal(session.commit(receive()).ok, false);
  assert.equal(session.getEvents(), before);
});
test("counting existing zero and held positions preserves their full identity/status", () => {
  for (const id of ["b07", "b02", "b08"]) {
    const source = f.inventoryBalances.find((p) => p.id === id);
    const result = success(
      commit(
        adjust({
          sourceKey: l.stockKey(source),
          reviewedQuantity: String(source.onHandQty),
          countedQuantity: "5",
        }),
      ),
    );
    assert.equal(position(result.events, l.stockKey(source)).onHandQty, 5);
    assert.equal(
      result.event.postings[0].inventoryStatus,
      source.inventoryStatus,
    );
  }
});
test("new Lot remains visible at zero after a complete issue; original baseline stays unchanged", () => {
  const command = receive({ destination: { ...base, lotCode: "NEW-EMPTY" } });
  const created = success(commit(command));
  const consumed = success(
    o.commitStockOperation(
      created.events,
      issue({ sourceKey: l.stockKey(command.destination) }, created.events),
      context,
    ),
  );
  assert.equal(
    position(consumed.events, l.stockKey(command.destination)).onHandQty,
    0,
  );
  assert.equal(initial.length, 12);
  assert.equal(
    l.reconcileInventory(
      l.replayLedger(initial, context).balances,
      f.inventoryBalances,
    ).ok,
    true,
  );
});
test("live projection updates totals, QC summaries, Lots, history and as-of balances", () => {
  const destination = {
    ...base,
    lotCode: "NEW-QC",
    inventoryStatus: "QC_HOLD",
  };
  const result = success(commit(receive({ destination, quantity: "0.5" })));
  const projection = l.replayLedger(result.events, context);
  const row = d
    .aggregateInventory(f.inventoryItems, projection.balances)
    .find((row) => row.item.id === "raw-a");
  assert.equal(row.totalQty, 2200.5);
  assert.equal(row.qcHeldQty, 300.5);
  assert.equal(row.lotCount, 4);
  assert.equal(
    l.filterMovements(
      result.events,
      { ...l.defaultMovementFilters, search: result.event.documentNo },
      context,
    ).length,
    1,
  );
  assert.equal(position(result.events, l.stockKey(destination)).onHandQty, 0.5);
  assert.equal(
    l
      .replayLedger(result.events, context, "2026-10-16")
      .balances.some((p) => p.lotCode === "NEW-QC"),
    false,
  );
  assert.equal(
    l
      .replayLedger(result.events, context, "2026-10-17")
      .balances.find((p) => p.lotCode === "NEW-QC").onHandQty,
    0.5,
  );
});
test("a fresh session resets to baseline; no API, storage or duplicate provider is introduced", () => {
  const session = o.createStockSession(initial, context);
  success(session.commit(receive()));
  assert.equal(o.createStockSession(initial, context).getEvents().length, 12);
  const layout = read("app/(factory)/layout.tsx");
  assert.equal(
    (layout.match(/<InventoryOperationsProvider>/g) ?? []).length,
    1,
  );
  for (const provider of [
    "MasterDataProvider",
    "MixingProvider",
    "DemoProvider",
    "PRProvider",
    "BOMProvider",
    "Suspense",
    "AppShell",
  ])
    assert.ok(layout.includes(`<${provider}`));
  assert.doesNotMatch(read("app/(factory)/inventory/page.tsx"), /Provider/);
  for (const file of [
    "inventory-explorer.tsx",
    "inventory-history.tsx",
    "inventory-as-of.tsx",
  ])
    assert.match(
      read(`src/features/inventory/${file}`),
      /useInventoryOperations/,
    );
  for (const file of [
    "inventory-operations-domain.ts",
    "inventory-operations-provider.tsx",
    "inventory-operations-dialog.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/inventory/${file}`),
      /fetch\(|localStorage|sessionStorage|\bany\b|dangerouslySetInnerHTML/,
    );
  const dialog = read("src/features/inventory/inventory-operations-dialog.tsx");
  for (const token of [
    "ConfirmDialog",
    "DialogFooter",
    "overflow-y-auto",
    "aria-invalid",
    "motion-reduce",
    "disabled={busy}",
    "QC_HOLD",
    "ทบทวนยอดล่าสุดแล้ว",
  ])
    assert.ok(dialog.includes(token), token);
});
