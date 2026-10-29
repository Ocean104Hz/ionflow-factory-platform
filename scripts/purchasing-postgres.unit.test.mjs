import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PurchasingError,
  createPurchasingStore,
  derivePurchasingSnapshot,
  parsePurchasingPO,
  parsePurchasingPR,
  preparePOTransition,
  preparePOSave,
  preparePRCopy,
  preparePRCreate,
  preparePRTransition,
  preparePRUpdate,
  validatePOAllocations,
} from "../src/server/purchasing-postgres.ts";
import {
  materialItem,
  newPR,
} from "../src/features/purchase-requisitions/pr-domain.ts";
import {
  blankItem,
  blankPo,
} from "../src/features/purchase-orders/po-domain.ts";

const now = new Date("2026-10-27T03:00:00.000Z");
const writer = Object.freeze({
  id: "verified-writer",
  displayName: "Verified Writer",
  verified: true,
  permissions: ["purchasing.write"],
});
const approver = Object.freeze({
  id: "verified-approver",
  displayName: "Verified Approver",
  verified: true,
  permissions: ["purchasing.write", "purchasing.approve"],
});
const draftPR = () => {
  const item = materialItem("RM-001", "pr-line-1");
  return {
    ...newPR(),
    date: "2026-10-27",
    requester: "พนักงานฝ่ายผลิต",
    department: "ฝ่ายผลิต",
    warehouseCode: "WH01",
    warehouseName: "คลังหลัก",
    category: "วัตถุดิบ",
    neededDate: "2026-10-28",
    purpose: "ทดสอบ persistence",
    approver: "หัวหน้าแผนก",
    items: [{ ...item, quantity: 100 }],
    masterRefs: {
      warehouse: { id: "settings-warehouse", kind: "warehouses", code: "WH01", name: "คลังหลัก", value: "WH01" },
      [`supplier:${item.id}`]: { id: "settings-supplier", kind: "suppliers", code: item.supplierCode, name: item.supplierName, value: item.supplierCode },
      [`unit:${item.id}`]: { id: "settings-unit", kind: "units", code: "KG", name: item.unit, value: item.unit },
    },
  };
};
const snapshot = (prs = [], pos = [], allocations = []) => ({
  prs,
  pos,
  allocations,
  prVersions: {},
  poVersions: {},
  poHistory: {},
});
function linkedPO(pr, quantity = "40.00") {
  return {
    ...blankPo("2026-10-27"),
    po_no: "PO-IT2610001",
    supplier_id: "settings-supplier",
    supplier_code_snapshot: pr.items[0].supplierCode,
    supplier_name_snapshot: pr.items[0].supplierName,
    warehouse_code: pr.warehouseCode,
    warehouse_name: pr.warehouseName,
    request_ref_id: pr.id,
    request_ref_no: pr.number,
    expected_delivery_date: "2026-10-28",
    items: [{
      ...blankItem("po-line-1"),
      request_ref_item_id: pr.items[0].id,
      material_code_snapshot: pr.items[0].code,
      material_name_snapshot: pr.items[0].name,
      ordered_qty: quantity,
      unit: pr.items[0].unit,
      unit_price: "25.00",
    }],
  };
}

test("PR create, update and existing status transitions preserve numbering and history", () => {
  const created = preparePRCreate(snapshot(), draftPR(), writer, false, now);
  assert.match(created.id, /^pr-/);
  assert.equal(created.number, "PR-20261027-0001");
  assert.equal(created.status, "draft");
  assert.equal(created.history.length, 1);
  const updated = preparePRUpdate(
    created,
    { ...created, remarks: "แก้ไข" },
    writer,
    true,
    now,
  );
  assert.equal(updated.status, "pending_approval");
  assert.equal(updated.history.length, 3);
  const approved = preparePRTransition(updated, "approve", approver, "", now);
  assert.equal(approved.status, "approved");
  assert.equal(approved.history.at(-1).actor, approver.displayName);
  assert.throws(
    () => preparePRTransition(updated, "approve", writer, "", now),
    (error) => error instanceof PurchasingError && error.status === 403,
  );
  assert.throws(
    () => preparePRUpdate(created, { ...created, revision: 99 }, writer, false, now),
    (error) => error instanceof PurchasingError && error.status === 409,
  );
});

test("PR copy creates a new draft and remaps item master references", () => {
  const source = preparePRCreate(snapshot(), draftPR(), writer, false, now);
  const copied = preparePRCopy(snapshot([source]), source, writer, now);
  assert.notEqual(copied.id, source.id);
  assert.notEqual(copied.items[0].id, source.items[0].id);
  assert.equal(copied.referenceNo, source.number);
  assert.equal(copied.status, "draft");
  assert.equal(
    copied.masterRefs[`unit:${copied.items[0].id}`].id,
    source.masterRefs[`unit:${source.items[0].id}`].id,
  );
});

test("PO create/update validation supports direct PO and approved PR references", () => {
  const approved = preparePRTransition(
    preparePRCreate(snapshot(), draftPR(), writer, true, now),
    "approve",
    approver,
    "",
    now,
  );
  const linked = preparePOSave(
    snapshot([approved]),
    linkedPO(approved),
    writer,
    false,
    now,
    "po-linked-1",
  );
  assert.equal(linked.request_ref_id, approved.id);
  assert.equal(linked.status, "draft");
  const direct = linkedPO(approved);
  direct.po_no = "PO-IT2610002";
  direct.request_ref_id = "";
  direct.request_ref_no = "";
  direct.items[0].request_ref_item_id = "";
  assert.equal(
    preparePOSave(snapshot([approved], [linked]), direct, writer, true, now, "po-direct-1").status,
    "pending_approval",
  );
  const pending = { ...linked, status: "pending_approval" };
  assert.equal(
    preparePOTransition(snapshot([approved], [pending]), pending.id, "approve", approver, now).status,
    "approved",
  );
});

test("actual PO allocations are the only source of PR ordered quantity and status", () => {
  const approved = preparePRTransition(
    preparePRCreate(snapshot(), draftPR(), writer, true, now),
    "approve",
    approver,
    "",
    now,
  );
  const po = preparePOSave(snapshot([approved]), linkedPO(approved), writer, false, now, "po-linked-1");
  const allocation = {
    id: "allocation-1", prId: approved.id, prItemId: approved.items[0].id,
    poId: po.id, poItemId: po.items[0].id, quantity: 40, released: false,
    at: now.toISOString(), actor: writer.displayName,
  };
  let derived = derivePurchasingSnapshot([approved], [po], [allocation]);
  assert.equal(derived.prs[0].items[0].orderedQuantity, 40);
  assert.equal(derived.prs[0].status, "partial_po_created");
  assert.equal(derived.prs[0].purchaseOrders[0].id, po.id);
  derived = derivePurchasingSnapshot([approved], [po], [
    { ...allocation, quantity: 100 },
  ]);
  assert.equal(derived.prs[0].status, "fully_po_created");
  derived = derivePurchasingSnapshot([approved], [po], [
    { ...allocation, released: true },
  ]);
  assert.equal(derived.prs[0].status, "approved");
  assert.equal(derived.prs[0].purchaseOrders.length, 0);
});

test("multiple POs cannot exceed remaining approved PR quantity", () => {
  const approved = preparePRTransition(
    preparePRCreate(snapshot(), draftPR(), writer, true, now),
    "approve",
    approver,
    "",
    now,
  );
  const used = {
    id: "allocation-existing", prId: approved.id, prItemId: approved.items[0].id,
    poId: "po-existing", poItemId: "po-existing-line", quantity: 60,
    released: false, at: now.toISOString(), actor: writer.displayName,
  };
  assert.doesNotThrow(() =>
    validatePOAllocations(snapshot([approved], [], [used]), linkedPO(approved, "40.00")),
  );
  assert.throws(
    () => validatePOAllocations(snapshot([approved], [], [used]), linkedPO(approved, "40.01")),
    (error) => error instanceof PurchasingError && error.status === 409,
  );
});

test("server parsers reject malformed documents and browser-supplied authority", () => {
  assert.throws(() => parsePurchasingPR({}));
  assert.throws(() => parsePurchasingPO({}));
  const unverified = { ...writer, verified: false };
  assert.throws(
    () => preparePRCreate(snapshot(), draftPR(), unverified, false, now),
    (error) => error instanceof PurchasingError && error.status === 403,
  );
});

const env = {
  NODE_ENV: "development",
  FACTORY_DB_ENABLED: "true",
  FACTORY_DB_HOST: "localhost",
  FACTORY_DB_PORT: "5432",
  FACTORY_DB_NAME: "ionflow_inventory_dev",
  FACTORY_DB_SCHEMA: "inventory_sandbox",
  FACTORY_PURCHASING_ENABLED: "true",
  FACTORY_PURCHASING_DB_USER: "factory_purchasing_writer",
  FACTORY_PURCHASING_DB_PASSWORD: "fictional-test-secret",
};
function rollbackFixture({ duplicate = false } = {}) {
  const calls = [];
  const client = {
    release() {},
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes(" AS safe")) return { rows: [{ safe: true }] };
      if (sql.includes("WHERE request_id=$1")) return { rows: duplicate ? [{ exists: 1 }] : [], rowCount: duplicate ? 1 : 0 };
      if (sql.startsWith("SELECT id,document_number") || sql.startsWith("SELECT *") || sql.startsWith("SELECT a.id::text")) return { rows: [] };
      if (sql.includes("SELECT version::text") && sql.includes("purchasing_prs")) return { rows: [] };
      if (sql.includes("SELECT warehouse.id")) return { rows: [{ id: "settings-warehouse" }] };
      if (sql.startsWith("SELECT id,kind,code,name FROM inventory_sandbox.settings_masters"))
        return { rows: values[0].map((id) => id === "settings-supplier"
          ? { id, kind: "suppliers", code: "SUP-01", name: "ผู้ขายตัวอย่าง" }
          : { id, kind: "units", code: "KG", name: "kg" }) };
      if (sql.startsWith("INSERT INTO inventory_sandbox.purchasing_prs")) throw Error("simulated write failure");
      return { rows: [], rowCount: 0 };
    },
  };
  const pool = { on() {}, async end() {}, async connect() { return client; } };
  return { store: createPurchasingStore(env, () => pool), calls };
}

test("transaction rollback is atomic and duplicate request IDs do not write twice", async () => {
  const failed = rollbackFixture();
  await assert.rejects(
    failed.store.savePR(draftPR(), null, writer, false, crypto.randomUUID()),
    (error) => error instanceof PurchasingError && error.status === 503,
  );
  assert.equal(failed.calls.at(-1).sql, "ROLLBACK");
  const duplicate = rollbackFixture({ duplicate: true });
  const result = await duplicate.store.savePR(draftPR(), null, writer, false, crypto.randomUUID());
  assert.equal(result.prs.length, 0);
  assert.equal(
    duplicate.calls.some((call) => call.sql.startsWith("INSERT INTO inventory_sandbox.purchasing_prs")),
    false,
  );
  assert.equal(duplicate.calls.at(-1).sql, "COMMIT");
});

test("migration and repository enforce concurrency, idempotency and non-destructive allocation history", () => {
  const migration = readFileSync(new URL("../migrations/0006_purchasing_pr_po.up.sql", import.meta.url), "utf8");
  const rollback = readFileSync(new URL("../migrations/0006_purchasing_pr_po.down.sql", import.meta.url), "utf8");
  const repository = readFileSync(new URL("../src/server/purchasing-postgres.ts", import.meta.url), "utf8");
  assert.equal((migration.match(/CREATE TABLE /g) ?? []).length, 7);
  assert.match(migration, /request_id UUID UNIQUE/);
  assert.match(migration, /purchasing_active_po_item_allocation[\s\S]*WHERE released_at IS NULL/);
  assert.match(migration, /released_by_event_id/);
  assert.doesNotMatch(migration, /CREATE ROLE|GRANT |INSERT INTO inventory_sandbox\.settings_masters/);
  assert.match(repository, /BEGIN ISOLATION LEVEL SERIALIZABLE/);
  assert.match(repository, /pg_advisory_xact_lock\(20261021,8\)/);
  assert.match(repository, /FOR UPDATE/);
  assert.match(repository, /WHERE request_id=\$1/);
  assert.match(repository, /PO_CANCELLED/);
  assert.match(repository, /PO_REJECTED/);
  assert.doesNotMatch(repository, /DELETE FROM inventory_sandbox\.purchasing_po/);
  assert.match(repository, /ROLLBACK/);
  assert.match(rollback, /rollback refused: retained business or audit data exists/);
});

test("existing PR and PO UI contracts remain present and no browser transport was opened", () => {
  const pr = readFileSync(new URL("../src/features/purchase-requisitions/pr-provider.tsx", import.meta.url), "utf8");
  const po = ["po-workspace.tsx", "po-form.tsx", "po-domain.ts"]
    .map((file) => readFileSync(new URL(`../src/features/purchase-orders/${file}`, import.meta.url), "utf8"))
    .join("\n");
  for (const method of ["create", "save", "act", "order", "remove", "copy", "batch"])
    assert.match(pr, new RegExp(`\\b${method}\\b`));
  for (const field of ["po_no", "supplier_name_snapshot", "warehouse_name", "currency_code", "vat_type", "items"])
    assert.match(po, new RegExp(`\\b${field}\\b`));
  assert.doesNotMatch(readFileSync(new URL("../src/server/purchasing-postgres.ts", import.meta.url), "utf8"), /createServer|listen\(/);
});
