import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "server-only": fileURLToPath(import.meta.resolve("server-only")) } });
const { getFactoryDatabasePool } = await jiti.import("../src/server/auth/access-repository.ts");
const { blankReceivingItem, blankReceivingSigners } = await jiti.import("../src/features/raw-material-receiving/receiving-domain.ts");
const { blankRequisition, newMaterial, newWip } = await jiti.import("../src/features/material-requisitions/material-requisition-domain.ts");
const { listReceipts, listRequisitions, previewReceipt, reserveReceipt, saveReceipt, writeRequisition } = await jiti.import("../src/server/warehouse-documents.ts");
const { createMaterialIssue, updateMaterialIssue, deleteMaterialIssue } = await jiti.import("../src/server/material-issues/material-issue-repository.ts");
const { validateMaterialIssueInput } = await jiti.import("../src/server/material-issues/material-issue-validation.ts");

test("warehouse documents persist with dates, version guards and protected reservations", { skip: process.env.FACTORY_WAREHOUSE_ROLLBACK_CHECK !== "1" }, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [actor] } = await client.query("SELECT id::text FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1");
    assert.ok(actor);
    const user = { id: actor.id, modules: ["raw_material_receiving", "material_requisitions"] };
    const connect = async () => ({
      query(sql, values) {
        const control = { BEGIN: "SAVEPOINT warehouse_check", COMMIT: "RELEASE SAVEPOINT warehouse_check", ROLLBACK: "ROLLBACK TO SAVEPOINT warehouse_check" };
        return client.query(control[sql] ?? sql, values);
      },
      release() {},
    });
    const day = "2026-11-25";
    const prefix = randomUUID().slice(0, 8);
    const snapshot = await listReceipts(user, client);
    const preview = await previewReceipt(user, day, client);
    assert.equal((await previewReceipt(user, day, client)).documentNo, preview.documentNo);
    const confirmed = await reserveReceipt(user, day, preview.documentNo, connect);
    assert.equal(confirmed.ok, true);
    assert.equal(Date.parse(confirmed.reservation.expiresAt) - Date.parse(confirmed.reservation.reservedAt), 86_400_000);
    assert.equal((await reserveReceipt(user, day, preview.documentNo, connect)).ok, false);
    assert.equal((await listReceipts(user, client)).length, snapshot.length);

    const receipt = {
      header: { location: "โรงงานกาญ 1", receiveDate: day, poDate: "", documentNo: preview.documentNo, poNo: "PO-QA", supplierCode: "QA",
        supplierName: "ทดสอบ", prNo: "PR-QA", warehouseCode: "WH-QA", vendorBookNo: "", vendorDocumentNo: "", qcDocumentNumbers: ["QC-QA"] },
      items: [{ ...blankReceivingItem("row-1", day), materialCode: "QA", description: "ทดสอบ", unit: "กก.", quantity: "2.25", unitPrice: "4.00" }],
      signers: { ...blankReceivingSigners(), inspectorName: "ผู้ตรวจทดสอบ" }, note: "ทดสอบ " + prefix,
    };
    const createReceipt = { document: receipt, token: confirmed.reservation.token };
    await assert.rejects(saveReceipt({ ...user, id: "0" }, createReceipt, connect), { status: 422 });
    const saved = await saveReceipt(user, createReceipt, connect);
    assert.deepEqual(await saveReceipt(user, createReceipt, connect), saved);
    assert.deepEqual((await listReceipts(user, client)).find(row => row.header.documentNo === preview.documentNo), saved);
    assert.equal(saved.amountTotal, "9.00");
    await assert.rejects(saveReceipt(user, { document: { ...receipt, header: { ...receipt.header, receiveDate: "2026-11-24" } }, version: saved.savedAt }, connect), { status: 422 });
    const amended = await saveReceipt(user, { document: { ...receipt, note: "แก้ไข" }, version: saved.savedAt }, connect);
    assert.equal(amended.note, "แก้ไข");
    await assert.rejects(saveReceipt(user, { document: receipt, version: saved.savedAt }, connect), { status: 409 });

    const req = { ...blankRequisition(), date: day, doc_no: prefix, material_details: [
      { ...newMaterial("m1"), m_item_name: "ถุง", m_size: 2.5, m_qty: 3, m_unit: "Bag" },
    ], wip_materials: [{ ...newWip("w1"), w_item_name: "WIP", w_size: 10, w_qty: 2, w_unit: "กิโลกรัม" }] };
    const created = await writeRequisition(user, { action: "save", document: req }, connect);
    assert.equal(created.doc_no, `ST-${prefix}`);
    assert.deepEqual((await listRequisitions(user, client)).find(row => row.id === created.id), created);
    await assert.rejects(writeRequisition(user, { action: "save", document: req }, connect), { status: 422 });
    const updated = await writeRequisition(user, { action: "save", document: { ...created, inventory_auditor: "ผู้ตรวจ" }, version: created.updatedAt }, connect);
    assert.equal(updated.inventory_auditor, "ผู้ตรวจ");
    await assert.rejects(writeRequisition(user, { action: "delete", id: created.id, version: created.updatedAt }, connect), { status: 409 });
    await writeRequisition(user, { action: "delete", id: created.id, version: updated.updatedAt }, connect);
    assert.ok(!(await listRequisitions(user, client)).some(row => row.id === created.id));
    await assert.rejects(listReceipts({ ...user, modules: [] }, client), { status: 403 });
    await assert.rejects(listRequisitions({ ...user, modules: [] }, client), { status: 403 });

    await client.query("ROLLBACK");
    assert.ok(!(await listReceipts(user, client)).some(row => row.header.documentNo === preview.documentNo));
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("existing material issue repository creates, edits and archives against the real application role", { skip: process.env.FACTORY_WAREHOUSE_ROLLBACK_CHECK !== "1" }, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [actor] } = await client.query('SELECT id::text, display_name AS "displayName" FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1');
    assert.ok(actor);
    const transaction = async work => {
      await client.query("SAVEPOINT issue_check");
      try {
        const result = await work(client);
        await client.query("RELEASE SAVEPOINT issue_check");
        return result;
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT issue_check");
        throw error;
      }
    };
    const ref = randomUUID();
    const number = BigInt("0x" + ref.replaceAll("-", "").slice(0, 16)).toString();
    const form = {
      header: { location: "โรงงานกาญ 2", productName: "ทดสอบ", quantity: "1", issueDate: "2026-11-25", department: "QC" },
      items: [{ id: "row-1", materialCode: "QA", materialName: "ทดสอบ", quantity: "2.5", unit: "Bag", damagedQuantity: "", additionalQuantity: "" }],
      signers: { requestedBy: "ผู้เบิก", issuedBy: "ผู้จ่าย", inspectedBy: "ผู้ตรวจ" },
    };
    const created = await createMaterialIssue(validateMaterialIssueInput(form), number, actor, transaction);
    assert.equal(created.items[0].materialCode, "QA");
    const edited = await updateMaterialIssue(created.id, created.version, validateMaterialIssueInput({
      ...created, header: { ...created.header, productName: "แก้ไข" },
    }), actor, number, transaction);
    assert.equal(edited.header.productName, "แก้ไข");
    await assert.rejects(deleteMaterialIssue(created.id, created.version, actor, transaction), { name: "MaterialIssueConflictError" });
    await deleteMaterialIssue(edited.id, edited.version, actor, transaction);
    const { rows } = await client.query("SELECT action FROM foliar_fertilizer.r_material_issue_history WHERE material_issue_id=$1 ORDER BY record_version", [created.id]);
    assert.deepEqual(rows.map(row => row.action), ["created", "updated", "archived"]);
    await client.query("ROLLBACK");
    const retained = await client.query("SELECT 1 FROM foliar_fertilizer.m_material_issues WHERE id=$1", [created.id]);
    assert.equal(retained.rowCount, 0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

after(async () => { if (process.env.FACTORY_WAREHOUSE_ROLLBACK_CHECK === "1") await getFactoryDatabasePool().end(); });
