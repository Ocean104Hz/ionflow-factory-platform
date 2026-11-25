import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getFactoryDatabasePool } from "../src/server/auth/access-repository.ts";
import { saveFactoryMaster } from "../src/server/factory-masters.ts";
import { mutatePurchasing } from "../src/server/purchasing.ts";
import { blankMaster } from "../src/features/master-data/master-domain.ts";
import { newPR, newPRItem } from "../src/features/purchase-requisitions/pr-domain.ts";
import { blankItem, blankPo } from "../src/features/purchase-orders/po-domain.ts";

test("factory settings, PR approval and PO allocation persist together in PostgreSQL", {
  skip: process.env.FACTORY_PURCHASING_ROLLBACK_CHECK !== "1",
}, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  await client.query("BEGIN");
  // Run the actual repository commands inside one outer transaction and always discard the fixtures.
  const connect = async () => ({
    query: (sql, values) => client.query(
      ({ BEGIN: "SAVEPOINT purchasing_check", COMMIT: "RELEASE SAVEPOINT purchasing_check", ROLLBACK: "ROLLBACK TO SAVEPOINT purchasing_check" })[sql] ?? sql,
      values,
    ),
    release: () => {},
  });
  const prefix = "CHECK-" + randomUUID().slice(0, 12).toUpperCase();
  try {
    const admins = await client.query(`SELECT u.id::text, u.display_name, u.email
        FROM foliar_fertilizer.app_users u
        JOIN foliar_fertilizer.app_user_roles ur ON ur.user_id=u.id
        JOIN foliar_fertilizer.app_roles r ON r.id=ur.role_id
        WHERE u.is_active AND r.is_active AND r.code='factory_admin' ORDER BY u.id LIMIT 1`);
    assert.ok(admins.rows.length, "A factory admin is required for the rollback check");
    const row = admins.rows[0];
    const admin = { id: row.id, displayName: row.display_name, email: row.email, roles: ["factory_admin"], modules: ["pr", "purchase_orders", "audit_log"] };
    const member = { ...admin, roles: [] };
    const make = (kind, suffix, fields = {}) => ({
      ...blankMaster(kind, randomUUID()), code: `${prefix}-${suffix}`, name: `${prefix}-${suffix}`, ...fields,
    });
    const unit = make("units", "U");
    const material = make("materials", "M", { typeId: unit.id });
    const department = make("departments", "D");
    const warehouse = make("warehouses", "W");
    const supplier = make("suppliers", "S");
    for (const value of [unit, material, department, warehouse, supplier]) {
      const saved = await saveFactoryMaster(value, null, connect);
      assert.equal(saved.versions[value.id], "1");
    }
    await assert.rejects(saveFactoryMaster(unit, null, connect), { status: 409 });
    const line = { ...newPRItem(randomUUID()), code: material.code, name: "untrusted snapshot",
      supplierCode: supplier.code, supplierName: supplier.name, unit: unit.name, quantity: 3.5001, price: 20 };
    let result = await mutatePurchasing(member, { kind: "pr", action: "create", submit: true, draft: {
      ...newPR(), warehouseCode: warehouse.code, department: department.name, category: "วัตถุดิบ",
      neededDate: "2099-01-02", date: "2099-01-01", purpose: "Rollback check", approver: admin.displayName,
      masterRefs: { approver: { id: admin.id } }, items: [line],
    } }, connect);
    const prId = result.createdId;
    assert.ok(prId);
    assert.equal(result.prs.find((doc) => doc.id === prId).items[0].name, material.name);
    await assert.rejects(mutatePurchasing(member, { kind: "pr", action: "approve", ids: [prId] }, connect), { status: 403 });
    await mutatePurchasing(admin, { kind: "pr", action: "approve", ids: [prId] }, connect);
    const po = {
      ...blankPo("2099-01-01"), po_no: prefix, supplier_id: supplier.id, warehouse_code: warehouse.code, request_ref_id: prId,
      items: [{ ...blankItem(randomUUID()), raw_material_id: material.id, request_ref_item_id: line.id, ordered_qty: "2.5001", unit_price: "20" }],
    };
    result = await mutatePurchasing(member, { kind: "po", action: "save", draft: po, submit: true }, connect);
    const poId = result.pos.find((doc) => doc.po_no === prefix).id;
    assert.equal(result.prs.find((doc) => doc.id === prId).items[0].orderedQuantity, 2.5001);
    await assert.rejects(mutatePurchasing(member, { kind: "po", action: "approve", ids: [poId] }, connect), { status: 403 });
    result = await mutatePurchasing(admin, { kind: "po", action: "approve", ids: [poId] }, connect);
    assert.equal(result.pos.find((doc) => doc.id === poId).status, "approved");
    assert.ok(result.audit.some((entry) => entry.reference === prefix));
    await assert.rejects(mutatePurchasing(member, { kind: "po", action: "save", draft: { ...po, po_no: prefix + "-2" } }, connect), { status: 409 });
    assert.equal((await client.query("SELECT count(*)::int n FROM foliar_fertilizer.purchasing_documents WHERE document_no=$1", [prefix + "-2"])).rows[0].n, 0);
    await mutatePurchasing(admin, { kind: "po", action: "cancel", ids: [poId] }, connect);
    const data = await client.query("SELECT payload FROM foliar_fertilizer.purchasing_documents WHERE id=$1", [prId]);
    assert.equal(data.rows[0].payload.items[0].orderedQuantity, 0);
    assert.equal(data.rows[0].payload.status, "approved");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
