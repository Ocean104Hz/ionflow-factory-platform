import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const js = ts.transpileModule(
  read("src/features/purchase-requisitions/pr-domain.ts"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const m = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const draft = () => structuredClone(m.demoPRs[0]);
test("PR fixed mock identity can approve without an actor switcher and retains honest audit identity", () => {
  const pending = m.transitionPR(draft(), "submit", m.demoPRUser.name);
  const approved = m.transitionPR(pending, "approve", m.demoPRUser.name);
  assert.equal(approved.status, "approved");
  assert.equal(approved.history.at(-1).actor, m.demoPRUser.name);
  assert.throws(() => m.transitionPR(pending, "approve", "พนักงานคลัง"));
  assert.throws(() => m.transitionPR(pending, "approve", "unknown"));
  for (const file of [
    "pr-list.tsx",
    "pr-detail.tsx",
    "pr-editor.tsx",
    "pr-components.tsx",
    "pr-provider.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/purchase-requisitions/${file}`),
      /PRActor|setActor|สลับผู้ใช้เพื่อทดสอบ/,
    );
});
test("PR surface hierarchy and shared motion preserve reduced-motion preferences", () => {
  const css = read("app/globals.css");
  for (const token of [
    "--table-header:",
    "--motion-fast:",
    "--motion-enter:",
    "@keyframes factory-enter",
    "prefers-reduced-motion: reduce",
    "transform: none !important",
    "--background: #eef2f6",
    "--surface: #ffffff",
  ])
    assert.ok(css.includes(token), token);
  const list = read("src/features/purchase-requisitions/pr-list.tsx");
  assert.ok(list.includes("factory-toolbar"));
  assert.match(list, /selectedRows.length > 0/);
});
test("PR drafts allow incomplete fields but reject invalid numbers, dates, master pairs and overflow", () => {
  assert.equal(m.validatePR(m.newPR(), false), null);
  assert.notEqual(m.validatePR(m.newPR(), true), null);
  for (const patch of [
    { quantity: -5 },
    { quantity: 0 },
    { quantity: NaN },
    { quantity: Infinity },
    { quantity: 0.12345 },
    { price: -1 },
    { price: Infinity },
    { price: 1.111 },
    { quantity: 1e16, price: 10 },
    { code: "RM-001", name: "wrong" },
    { supplierCode: "SUP-01", supplierName: "wrong" },
  ]) {
    const pr = draft();
    Object.assign(pr.items[0], patch);
    assert.ok(m.validatePR(pr, false), JSON.stringify(patch));
    assert.throws(() => m.createPRRecord(pr, [], "พนักงานฝ่ายผลิต"));
  }
  for (const patch of [
    { date: "2026-02-30" },
    { date: "wrong" },
    { neededDate: "2026-10-14" },
    { warehouseCode: "WH02" },
    { requester: "unknown" },
  ])
    assert.ok(m.validatePR({ ...draft(), ...patch }, false));
});
test("PR line tax rounds to satang, unknown prices stay incomplete and units never merge", () => {
  const pr = draft();
  pr.transactionType = "VAT";
  pr.items = [
    { ...pr.items[0], quantity: 3, price: 0.05 },
    { ...m.materialItem("PK-001", "other"), quantity: 2, price: 0.05 },
  ];
  assert.deepEqual(m.lineAmounts(pr.items[0], "VAT"), {
    subtotal: 0.15,
    tax: 0.01,
    total: 0.16,
  });
  assert.equal(m.prAmounts(pr).total, 0.27);
  assert.match(m.quantitySummary(pr), /3 kg/);
  assert.match(m.quantitySummary(pr), /2 ใบ/);
  pr.items[1].price = null;
  assert.equal(m.prAmounts(pr).complete, false);
  assert.equal(m.estimatedAmount(pr), null);
  assert.equal(m.prAmounts(pr).subtotal, 0.15);
  assert.equal(m.lineAmounts({ ...pr.items[0], quantity: -1 }, "VAT"), null);
});
test("PR submit, reject with reason, edit, resubmit and approve retain actors and history", () => {
  let pr = m.transitionPR(draft(), "submit", "พนักงานฝ่ายผลิต");
  assert.equal(pr.status, "pending_approval");
  assert.throws(() => m.transitionPR(pr, "approve", "พนักงานคลัง"));
  assert.throws(() => m.transitionPR(pr, "reject", "หัวหน้าแผนก", "   "));
  pr = m.transitionPR(pr, "reject", "หัวหน้าแผนก", "แก้จำนวน");
  const edited = structuredClone(pr);
  edited.items[0].quantity = 50;
  pr = m.savePRRecord(pr, edited, "พนักงานฝ่ายผลิต", true);
  assert.equal(pr.status, "pending_approval");
  assert.ok(
    pr.history.some((event) =>
      event.changes.some(
        (change) => change.before === "100" && change.after === "50",
      ),
    ),
  );
  pr = m.transitionPR(pr, "approve", "หัวหน้าแผนก", "ตรวจแล้ว");
  assert.equal(pr.status, "approved");
  assert.equal(pr.history.at(-1).actor, "หัวหน้าแผนก");
  assert.throws(() => m.transitionPR(pr, "approve", "หัวหน้าแผนก"));
});
test("PR partial PO prevents oversupply, completes then closes and keeps related POs", () => {
  const original = structuredClone(m.demoPRs[1]);
  let pr = m.createDemoPO(original, { line2: 75 }, "พนักงานคลัง");
  assert.equal(pr.status, "partial_po_created");
  assert.equal(m.remainingQuantity(pr.items[0]), 125);
  assert.equal(original.items[0].orderedQuantity, 0);
  for (const quantities of [
    { line2: 126 },
    { line2: -1 },
    { line2: NaN },
    { line2: 0 },
    { missing: 1 },
  ])
    assert.throws(() => m.createDemoPO(pr, quantities, "พนักงานคลัง"));
  assert.throws(() => m.transitionPR(pr, "close", "พนักงานคลัง"));
  pr = m.createDemoPO(pr, { line2: 125 }, "พนักงานคลัง");
  assert.equal(pr.status, "fully_po_created");
  assert.equal(pr.purchaseOrders.length, 2);
  assert.notEqual(pr.purchaseOrders[0].number, pr.purchaseOrders[1].number);
  pr = m.transitionPR(pr, "close", "ผู้จัดการ");
  assert.equal(pr.status, "closed");
  assert.throws(() => m.transitionPR(pr, "cancel", "ผู้จัดการ", "เปลี่ยนใจ"));
  assert.throws(() => m.createDemoPO(pr, { line2: 1 }, "พนักงานคลัง"));
});
test("PR cancel requires reason and preserves existing orders; closed documents cannot cancel", () => {
  let pr = m.createDemoPO(
    structuredClone(m.demoPRs[1]),
    { line2: 50 },
    "พนักงานคลัง",
  );
  assert.throws(() => m.transitionPR(pr, "cancel", "ผู้จัดการ", ""));
  pr = m.transitionPR(pr, "cancel", "ผู้จัดการ", "ไม่ซื้อส่วนที่เหลือ");
  assert.equal(pr.status, "cancelled");
  assert.equal(pr.purchaseOrders.length, 1);
  assert.throws(() => m.createDemoPO(pr, { line2: 50 }, "พนักงานคลัง"));
});
test("PR copy resets purchases/history, save refuses stale or approved records, delete is draft-only", () => {
  const approved = m.createDemoPO(
    structuredClone(m.demoPRs[1]),
    { line2: 50 },
    "พนักงานคลัง",
  );
  const copy = m.copyPR(approved);
  assert.equal(copy.status, "draft");
  assert.equal(copy.items[0].orderedQuantity, 0);
  assert.equal(copy.purchaseOrders.length, 0);
  assert.equal(copy.history.length, 0);
  assert.equal(copy.referenceNo, approved.number);
  assert.notEqual(copy.items[0].id, approved.items[0].id);
  const created = m.createPRRecord(copy, m.demoPRs, "พนักงานคลัง");
  assert.ok(created.number);
  assert.notEqual(created.number, approved.number);
  assert.throws(() => m.savePRRecord(approved, approved, "พนักงานคลัง"));
  assert.throws(() =>
    m.savePRRecord(created, { ...created, revision: 0 }, "พนักงานคลัง"),
  );
  assert.equal(m.deletePREvent(created, "พนักงานคลัง").action, "delete");
  assert.throws(() => m.deletePREvent(approved, "พนักงานคลัง"));
});
test("PR batch validates all documents before returning replacements; failed batch never mutates input", () => {
  const records = structuredClone(m.demoPRs);
  const before = JSON.stringify(records);
  assert.throws(() =>
    m.batchPRRecords(
      records,
      records.map((pr) => pr.id),
      "submit",
      "พนักงานฝ่ายผลิต",
    ),
  );
  assert.equal(JSON.stringify(records), before);
  const next = m.batchPRRecords(records, ["pr-1"], "submit", "พนักงานฝ่ายผลิต");
  assert.equal(next[0].status, "pending_approval");
  assert.equal(records[0].status, "draft");
  assert.throws(() =>
    m.batchPRRecords(records, [], "submit", "พนักงานฝ่ายผลิต"),
  );
});
test("PR inclusive filters, example import and unique document numbering", () => {
  assert.equal(
    m.filterPRs(m.demoPRs, {
      search: "  pr-20261015  ",
      status: "draft",
      from: "2026-10-15",
      to: "2026-10-15",
    }).length,
    1,
  );
  assert.equal(
    m.filterPRs(m.demoPRs, {
      search: "",
      status: "all",
      from: "2026-10-16",
      to: "2026-10-15",
    }).length,
    0,
  );
  const imported = m.createPRRecord(
    m.importExamplePR(),
    m.demoPRs,
    "พนักงานคลัง",
    false,
    true,
  );
  assert.equal(imported.history[0].action, "import");
  assert.equal(m.validatePR(imported), null);
  assert.equal(
    m.nextPRNumber([{ ...draft(), number: "PR-20261015-0009" }], "2026-10-15"),
    "PR-20261015-0010",
  );
});
test("PR presentation uses shared tables, mock-only tools, linked audit and labelled amounts", () => {
  for (const route of [
    "app/(factory)/pr/[prId]/page.tsx",
    "app/(factory)/pr/[prId]/edit/page.tsx",
  ]) {
    assert.ok(read(route).includes("<Suspense"));
    assert.match(read(route), /async function Content/);
  }
  const detail = read("src/features/purchase-requisitions/pr-detail.tsx");
  const list = read("src/features/purchase-requisitions/pr-list.tsx");
  const editor = read("src/features/purchase-requisitions/pr-editor.tsx");
  const components = read(
    "src/features/purchase-requisitions/pr-components.tsx",
  );
  assert.doesNotMatch(detail, /<table|<th>|<td/);
  for (const token of [
    "PRCreatePO",
    "purchaseOrders",
    "event.changes",
    'href="/audit_log"',
  ])
    assert.ok(detail.includes(token), token);
  for (const token of [
    "filterPRs",
    "quantitySummary",
    "batch",
    "Import Excel (สาธิต)",
    "<Checkbox",
  ])
    assert.ok(list.includes(token), token);
  for (const token of [
    "htmlFor={`${item.id}-quantity`}",
    "htmlFor={`${item.id}-price`}",
    "validatePR(form, submit)",
    "prMaterials",
    "prWarehouses",
  ])
    assert.ok(editor.includes(token), token);
  assert.ok(
    components.includes("ไม่สร้างหรือดาวน์โหลดไฟล์ Excel"),
  );
  assert.match(
    read("src/features/audit-log/audit-log.tsx"),
    /const entries = \[\.\.\.audit, \.\.\.auditEntries\]/,
  );
  const provider = read("src/features/purchase-requisitions/pr-provider.tsx");
  assert.ok(provider.includes('event.action === "DELETE"'));
  assert.ok(provider.includes("นำเข้าข้อมูลตัวอย่างนี้แล้ว"));
  assert.doesNotMatch(
    provider + list + detail + editor,
    /fetch\(|localStorage|process\.env/,
  );
});
