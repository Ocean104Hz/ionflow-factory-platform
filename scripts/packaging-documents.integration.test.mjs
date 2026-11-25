import assert from "node:assert/strict";
import { test } from "node:test";
import { getFactoryDatabasePool } from "../src/server/auth/access-repository.ts";
import { readPackaging, writePackaging } from "../src/server/packaging-documents.ts";
import { newReport } from "../src/features/packaging-reports/packaging-domain.ts";

test("packing documents persist and report ownership is exclusive", {
  skip: process.env.FACTORY_PACKAGING_ROLLBACK_CHECK !== "1",
}, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actor = await client.query("SELECT id::text FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1");
    assert.ok(actor.rowCount);
    const user = { id: actor.rows[0].id, modules: ["packaging_report", "packing_summary"] };
    const connect = async () => ({
      query(sql, params) {
        const statements = { BEGIN: "SAVEPOINT pack_check", COMMIT: "RELEASE SAVEPOINT pack_check", ROLLBACK: "ROLLBACK TO SAVEPOINT pack_check" };
        return client.query(statements[sql] ?? sql, params);
      },
      release() {},
    });
    const reports = (document) => writePackaging(user, "packaging_report", { action: "save", document }, connect);
    const summaries = (document) => writePackaging(user, "packing_summary", { action: "save", document }, connect);
    const key = crypto.randomUUID().slice(0, 8);
    const report = { ...newReport(), documentNumber: `PACK-${key}`, documentDate: "2026-11-25", location: "โรงงานกาญ 1", status: "RECORDED" };
    Object.assign(report.sets[0].contexts[0], { fertilizerName: "TEST", productionDate: report.documentDate, packageType: "กระสอบ", packageWeight: "25.000", packageUnit: "kg", quantity: "3", lotCode: "TEST-LOT" });
    Object.assign(report.sets[0].inspections[0], { packingTime: "08:15", bagWeight1: "25.100", bagWeight2: "25.020", physicalCondition: false });
    const first = await reports(report);
    const second = await reports({ ...newReport(), documentNumber: `PACK2-${key}` });
    const otherFactory = await reports({ ...newReport("IFOAM"), documentNumber: `FOAM-${key}` });
    assert.deepEqual((await readPackaging(user, "packaging_report", client)).records.find((row) => row.id === first.id).sets, report.sets);

    const number = Date.now();
    const form = {
      id: "", updatedAt: "", date: "2026-11-25", documentNo: `IT-${number}`, location: "โรงงานกาญ 1",
      reportIds: [first.id, second.id],
      items: [{ id: "item-1", productName: "TEST", quantity: "3.00", unit: "กระสอบ", sizeKg: "25", remark: "ทดสอบ" }],
      signers: { packer: "ทดสอบ", supervisor: "", packingHead: "", approver: "" },
    };
    await assert.rejects(summaries({ ...form, reportIds: [otherFactory.id] }), { status: 409 });
    const saved = await summaries(form);
    assert.deepEqual((await readPackaging(user, "packing_summary", client)).records.find((row) => row.id === saved.id), saved);
    assert.equal((await readPackaging(user, "packing_summary", client)).reports.find((row) => row.id === first.id).linkedSummaryId, saved.id);
    await assert.rejects(summaries({ ...form, documentNo: `IT-${number + 1}`, reportIds: [first.id] }), { status: 409 });
    await assert.rejects(writePackaging(user, "packaging_report", { action: "delete", id: first.id, updatedAt: first.updatedAt }, connect), { status: 409 });
    const next = await summaries({ ...saved, reportIds: [] });
    assert.equal(next.id, saved.id);
    await assert.rejects(summaries(saved), { status: 409 });
    assert.equal((await readPackaging(user, "packing_summary", client)).reports.find((row) => row.id === first.id).linkedSummaryId, null);
    const nextSummary = await summaries({ ...form, documentNo: `IT-${number + 1}`, reportIds: [first.id] });
    assert.ok(nextSummary.id);
    await assert.rejects(writePackaging({ ...user, modules: [] }, "packing_summary", { action: "save", document: form }, connect), { status: 403 });
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
