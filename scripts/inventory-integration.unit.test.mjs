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
const qUrl = url("src/features/inventory/inventory-quantity.ts");
const q = await import(qUrl);
const domainUrl = url("src/features/inventory/inventory-domain.ts", {
  "./inventory-quantity": qUrl,
});
const fixturesUrl = url("src/lib/mock-data/inventory.ts", {
  "./master-settings": url("src/lib/mock-data/master-settings.ts"),
});
const f = await import(fixturesUrl);
const ledgerUrl = url("src/features/inventory/inventory-ledger-domain.ts", {
  "./inventory-domain": domainUrl,
  "./inventory-quantity": qUrl,
});
const ledger = await import(ledgerUrl);
const historyUrl = url("src/lib/mock-data/inventory-ledger.ts", {
  "./inventory": fixturesUrl,
  "@/src/features/inventory/inventory-quantity": qUrl,
  "@/src/features/inventory/inventory-ledger-domain": ledgerUrl,
});
const history = await import(historyUrl);
const operationsUrl = url(
  "src/features/inventory/inventory-operations-domain.ts",
  {
    "./inventory-domain": domainUrl,
    "./inventory-quantity": qUrl,
    "./inventory-ledger-domain": ledgerUrl,
  },
);
const operations = await import(operationsUrl);
const contractsUrl = url(
  "src/features/inventory/inventory-integration-contracts.ts",
);
const contracts = await import(contractsUrl);
const previewUrl = url(
  "src/features/inventory/inventory-integration-preview-domain.ts",
  {
    "./inventory-domain": domainUrl,
    "./inventory-ledger-domain": ledgerUrl,
    "./inventory-quantity": qUrl,
    "./inventory-operations-domain": operationsUrl,
    "./inventory-integration-contracts": contractsUrl,
  },
);
const preview = await import(previewUrl);
const mock = await import(
  url("src/lib/mock-data/inventory-integration-scenarios.ts", {
    "./inventory": fixturesUrl,
    "@/src/features/inventory/inventory-integration-contracts": contractsUrl,
    "@/src/features/inventory/inventory-integration-preview-domain": previewUrl,
  })
);
const events = history.inventoryLedger;
const context = {
  items: f.inventoryItems,
  sites: f.inventorySites,
  warehouses: f.inventoryWarehouses,
  positions: history.inventoryPositions,
};
const scenario = (id) =>
  structuredClone(
    mock.inventoryIntegrationScenarios.find((row) => row.id === id),
  );
const run = (row, known = [], currentEvents = events) =>
  preview.previewInventoryIntegration(row, currentEvents, context, known);
const resultFor = (id) => run(scenario(id), mock.scenarioKnownActions(id));
const ready = (result) => {
  assert.equal(result.state, "READY_TO_PREVIEW", JSON.stringify(result));
  assert.equal(result.postingSupported, false);
  return result;
};
const blocked = (row, pattern) => {
  const result = run(row);
  assert.equal(result.state, "BLOCKED");
  assert.match(result.blockingReasons.join(" "), pattern);
  assert.deepEqual(result.proposedPostings, []);
  assert.deepEqual(result.positions, []);
};

test("all 21 fictional scenarios have unique IDs, immutable references and explicit unsupported posting", () => {
  assert.equal(mock.inventoryIntegrationScenarios.length, 21);
  assert.equal(
    new Set(mock.inventoryIntegrationScenarios.map((row) => row.id)).size,
    21,
  );
  for (const row of mock.inventoryIntegrationScenarios) {
    assert.ok(
      Object.isFrozen(row) &&
        Object.isFrozen(row.intent) &&
        Object.isFrozen(row.sourceReference),
    );
    assert.equal(resultFor(row.id).postingSupported, false);
  }
});
test("source identity uses scoped stable IDs, type, allocation, milestone and posting revision, not human number", () => {
  const row = scenario("material-issue");
  const source = row.sourceReference;
  const key = preview.integrationSourceKey(source);
  assert.equal(
    preview.integrationSourceKey({
      ...source,
      sourceDocumentNumber: "renumbered",
    }),
    key,
  );
  for (const field of [
    "workspaceId",
    "sourceApplication",
    "sourceDocumentId",
    "sourceLineId",
    "businessMilestone",
    "sourceRevision",
    "sourceDocumentType",
  ])
    assert.notEqual(
      preview.integrationSourceKey({ ...source, [field]: "different" }),
      key,
      field,
    );
  assert.equal(
    preview.integrationPayloadFingerprint({
      ...row,
      intent: { ...row.intent, quantity: "300.000000" },
    }),
    preview.integrationPayloadFingerprint(row),
  );
});
test("PR, PO, BOM, Mixing, Production creation, Invoice and Delivery draft propose no postings", () => {
  for (const id of [
    "pr-created",
    "po-created",
    "bom-selected",
    "mixing-saved",
    "production-created",
    "invoice-created",
    "delivery-draft",
  ]) {
    const result = resultFor(id);
    assert.equal(result.state, "NO_STOCK_EFFECT", id);
    assert.deepEqual(result.proposedPostings, []);
    assert.deepEqual(result.positions, []);
    assert.deepEqual(result.blockingReasons, []);
  }
});
test("a planning or financial module cannot request stock effect via a forged confirmed intent", () => {
  for (const sourceModule of [
    "PR",
    "PO",
    "BOM",
    "MIXING",
    "PRODUCTION_ORDER",
    "INVOICE",
  ]) {
    const row = scenario("material-issue");
    row.sourceReference.sourceModule = sourceModule;
    row.sourceReference.sourceDocumentType =
      contracts.sourceDocumentTypes[sourceModule];
    blocked(row, /ไม่มีสิทธิ์/);
  }
});
test("receipt preview computes positive new Lot quantity and does not release existing held stock", () => {
  const result = ready(resultFor("raw-receipt"));
  assert.deepEqual(
    result.positions.map((p) => [p.before, p.delta, p.after]),
    [["0", "100", "100"]],
  );
  assert.equal(result.positions[0].position.inventoryStatus, "QC_HOLD");
  assert.equal(result.proposedPostings.length, 1);
});
test("issue preview uses exact chosen position, not aggregated item quantity", () => {
  const result = ready(resultFor("material-issue"));
  assert.deepEqual(
    result.positions.map((p) => [p.before, p.delta, p.after]),
    [["1200", "-300", "900"]],
  );
  const row = scenario("material-issue");
  row.intent.quantity = "1200.000001";
  blocked(row, /ไม่เพียงพอ/);
});
test("QC release and QC rejection conserve item/Lot/location/unit and exact total", () => {
  for (const [id, target] of [
    ["qc-release", "AVAILABLE"],
    ["qc-blocked", "BLOCKED"],
  ]) {
    const result = ready(resultFor(id));
    assert.equal(result.positions.length, 2);
    assert.equal(result.positions[0].position.inventoryStatus, "QC_HOLD");
    assert.equal(result.positions[1].position.inventoryStatus, target);
    assert.equal(
      result.positions.reduce(
        (sum, row) => sum + q.quantityUnits(row.delta),
        BigInt(0),
      ),
      BigInt(0),
    );
    for (const field of [
      "itemId",
      "lotCode",
      "siteId",
      "warehouseId",
      "locationLabel",
      "unit",
    ])
      assert.equal(
        result.positions[0].position[field],
        result.positions[1].position[field],
      );
  }
});
test("production receipt proposes FG/WIP only; dispatch proposes FG issue only", () => {
  assert.equal(ready(resultFor("production-receipt")).positions[0].after, "20");
  assert.equal(ready(resultFor("delivery-dispatch")).positions[0].after, "110");
  for (const id of ["production-receipt", "delivery-dispatch"]) {
    const row = scenario(id);
    row.intent.position = scenario("material-issue").intent.position;
    blocked(row, /WIP\/FG|FG/);
  }
});
test("missing source IDs, empty required line and inconsistent source types are blocked", () => {
  for (const field of [
    "sourceDocumentId",
    "sourceDocumentNumber",
    "sourceApplication",
    "workspaceId",
    "sourceLineId",
  ]) {
    const row = scenario("material-issue");
    row.sourceReference[field] = "";
    blocked(row, /ต้นทาง|line/);
  }
  const row = scenario("material-issue");
  row.sourceReference.sourceDocumentType = "INVOICE";
  blocked(row, /ชนิดเอกสาร/);
  row.sourceReference.sourceDocumentType = "MATERIAL_ISSUE";
  row.sourceReference.sourceDocumentId = " padded ";
  blocked(row, /ช่องว่าง/);
});
test("missing item, Lot, warehouse, location and unit mismatches never fabricate mappings", () => {
  for (const [patch, pattern] of [
    [{ itemId: "" }, /mapping/],
    [{ lotCode: "" }, /Lot/],
    [{ warehouseId: "" }, /คลัง/],
    [{ locationLabel: "unknown" }, /ตำแหน่ง/],
    [{ unit: "kg" }, /base unit/],
  ]) {
    const row = scenario("raw-receipt");
    Object.assign(row.intent.position, patch);
    blocked(row, pattern);
  }
  assert.equal(resultFor("missing-item").state, "BLOCKED");
  assert.equal(resultFor("invalid-site").state, "BLOCKED");
});
test("held and blocked normal issues, missing source Lot and insufficient quantities are blocked", () => {
  assert.equal(resultFor("held-issue").state, "BLOCKED");
  assert.equal(resultFor("insufficient-stock").state, "BLOCKED");
  const row = scenario("material-issue");
  row.intent.position.inventoryStatus = "BLOCKED";
  blocked(row, /AVAILABLE/);
  row.intent.position.inventoryStatus = "AVAILABLE";
  row.intent.position.lotCode = "unknown";
  blocked(row, /ตำแหน่ง|Lot/);
});
test("duplicate action returns duplicate warning; same key with different payload is conflict", () => {
  assert.match(
    resultFor("duplicate-reference").blockingReasons.join(" "),
    /DUPLICATE_ACTION/,
  );
  assert.match(
    resultFor("duplicate-conflict").blockingReasons.join(" "),
    /IDEMPOTENCY_CONFLICT/,
  );
  const row = scenario("material-issue");
  assert.equal(run(row, mock.mockKnownSourceActions).state, "BLOCKED");
  assert.equal(mock.mockKnownSourceActions.length, 1);
});
test("different document IDs cannot double-post one shared physical movement", () => {
  const row = scenario("material-issue");
  row.sourceReference.sourceDocumentId = "another-evidence-document";
  const result = run(row, mock.mockKnownSourceActions);
  assert.equal(result.state, "BLOCKED");
  assert.match(result.blockingReasons.join(" "), /DUPLICATE_MOVEMENT/);
  delete row.physicalMovementId;
  blocked(row, /physical movement ID/);
});
test("duplicate evidence is workspace-scoped and unknown runtime lifecycle cannot imply authorization", () => {
  const row = scenario("material-issue");
  row.sourceReference.workspaceId = "different-demo-workspace";
  ready(run(row, mock.mockKnownSourceActions));
  for (const change of [{ evidence: "unrecognized" }, { sourceLifecycle: "" }])
    assert.equal(run({ ...row, ...change }).state, "DESIGN_PENDING");
  row.sourceReference.businessMilestone = "unrecognized";
  assert.equal(run(row).state, "DESIGN_PENDING");
});
test("packing conversion and unknown lifecycle/milestones remain DESIGN_PENDING with no postings", () => {
  for (const id of ["packing-conversion", "unknown-lifecycle"]) {
    const result = resultFor(id);
    assert.equal(result.state, "DESIGN_PENDING");
    assert.deepEqual(result.proposedPostings, []);
  }
  const row = scenario("material-issue");
  row.sourceReference.businessMilestone = "SAVED";
  assert.equal(run(row).state, "DESIGN_PENDING");
  row.sourceReference.businessMilestone = "UNKNOWN";
  assert.equal(run(row).state, "DESIGN_PENDING");
});
test("draft or document-only evidence cannot be promoted to a stock movement", () => {
  const row = scenario("delivery-dispatch");
  for (const evidence of ["DRAFT", "DOCUMENT_ONLY"]) {
    row.evidence = evidence;
    blocked(row, /เอกสารร่าง|บันทึกเอกสาร/);
  }
});
test("exact precision rejects zero, negative, invalid and >6 decimal quantities", () => {
  for (const quantity of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "",
    "0.0000001",
    "1e3",
  ]) {
    const row = scenario("raw-receipt");
    row.intent.quantity = quantity;
    assert.equal(run(row).state, "BLOCKED", quantity);
  }
  const row = scenario("raw-receipt");
  row.intent.quantity = "0.123456";
  assert.equal(ready(run(row)).positions[0].after, "0.123456");
});
test("stale projections are blocked; live manual operations change the preview input, never the preview itself", () => {
  const row = scenario("material-issue");
  row.expectedLedgerVersion = preview.integrationLedgerVersion(events);
  ready(run(row));
  const session = operations.createStockSession(events, context);
  const position = row.intent.position;
  const committed = session.commit({
    type: "ISSUE",
    operationId: "integration-test-manual",
    documentNo: "ISS-000001",
    postedAt: "2026-10-20T01:00:00Z",
    actor: "demo",
    note: "test",
    sourceKey: ledger.stockKey(position),
    quantity: "1000",
  });
  assert.equal(committed.ok, true);
  const before = session.getEvents();
  const stale = run(row, [], before);
  assert.match(stale.blockingReasons.join(" "), /STALE_PROJECTION/);
  delete row.expectedLedgerVersion;
  const latest = run(row, [], before);
  assert.equal(latest.state, "BLOCKED");
  assert.match(latest.blockingReasons.join(" "), /ไม่เพียงพอ/);
  assert.equal(session.getEvents(), before);
  assert.equal(session.getEvents().length, 13);
});
test("missing or invalid ledger cannot fabricate stock or before quantities", () => {
  assert.equal(run(scenario("raw-receipt"), [], []).state, "BLOCKED");
  const broken = [...events, { ...events[0], id: "another-opening" }];
  assert.equal(run(scenario("raw-receipt"), [], broken).state, "BLOCKED");
});
test("repeated previews are deterministic and leave events, balances, opening and all fixture records exactly unchanged", () => {
  const before = structuredClone({
    events,
    items: f.inventoryItems,
    snapshots: f.inventoryBalances,
    positions: history.inventoryPositions,
    scenarios: mock.inventoryIntegrationScenarios,
    known: mock.mockKnownSourceActions,
  });
  const projectionBefore = ledger.replayLedger(events, context);
  for (let round = 0; round < 3; round++)
    for (const row of mock.inventoryIntegrationScenarios)
      assert.deepEqual(resultFor(row.id), resultFor(row.id));
  assert.deepEqual(
    {
      events,
      items: f.inventoryItems,
      snapshots: f.inventoryBalances,
      positions: history.inventoryPositions,
      scenarios: mock.inventoryIntegrationScenarios,
      known: mock.mockKnownSourceActions,
    },
    before,
  );
  assert.deepEqual(ledger.replayLedger(events, context), projectionBefore);
  assert.equal(events.length, 12);
  assert.equal(projectionBefore.balances.length, 21);
  assert.equal(
    ledger.reconcileInventory(projectionBefore.balances, f.inventoryBalances)
      .ok,
    true,
  );
});
test("read-only UI is a third Inventory view without posting controls or source provider writes", () => {
  const explorer = read("src/features/inventory/inventory-explorer.tsx");
  for (const view of ["stock", "history", "integration"])
    assert.match(explorer, new RegExp(`<TabsTrigger value="${view}"`));
  assert.match(explorer, /<InventoryIntegrationPreview\s*\/>/);
  for (const component of [
    "InventoryTable",
    "InventoryHistory",
    "InventoryDetail",
    "InventoryOperationsDialog",
  ])
    assert.ok(explorer.includes(component));
  const ui = read("src/features/inventory/inventory-integration-preview.tsx");
  for (const text of [
    "MOCK PREVIEW",
    "ตัวอย่างการเชื่อมโมดูล",
    "SelectField",
    "FactoryDataTable",
    "postingSupported",
    "preview เพิ่ม 0",
  ])
    assert.ok(ui.includes(text), text);
  for (const source of [
    ui,
    read("src/features/inventory/inventory-integration-preview-domain.ts"),
    read("src/features/inventory/inventory-integration-contracts.ts"),
  ])
    assert.doesNotMatch(
      source,
      /commitStockOperation|createStockSession|\.commit\(|setEvents|fetch\(|localStorage|sessionStorage|\bany\b|useDemo|useBOM|useMasterData/,
    );
  assert.doesNotMatch(ui, /<Button|ConfirmDialog|onSubmit/);
  assert.match(read("docs/inventory-integration-matrix.md"), /MIXED STATUS/);
  assert.match(read("docs/inventory-integration-matrix.md"), /DECISION_PENDING/);
  assert.match(
    read("docs/inventory-integration-contract.md"),
    /PROPOSED \/ NOT IMPLEMENTED/,
  );
});
