import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "server-only": fileURLToPath(import.meta.resolve("server-only")) } });
const { getFactoryDatabasePool } = await jiti.import("../src/server/auth/access-repository.ts");
const { readQcDocuments, writeQcDocument, readFactoryAudit } = await jiti.import("../src/server/qc-documents.ts");
const { blankReport } = await jiti.import("../src/features/qc-organic-fertilizer/qc-organic-domain.ts");
const { blankNC } = await jiti.import("../src/features/nc-reports/nc-report-mock-helpers.ts");
const { newSubmission, newSample } = await jiti.import("../src/features/sample-submissions/sample-submission-domain.ts");
const { blankLog } = await jiti.import("../src/features/sample_submission_log/submission_log_domain.ts");
const { blankLabSheet } = await jiti.import("../src/features/lab_sample_receiving/lab_sample_receiving_domain.ts");
const { blankQcWeightDocument, blankQcWeightRow } = await jiti.import("../src/features/qc_product_weight_check/qc_product_weight_check_domain.tsx");

test("six QC document types persist and audit in the same transaction", { skip: process.env.FACTORY_QC_ROLLBACK_CHECK !== "1" }, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [actor] } = await client.query("SELECT id::text, email, display_name FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1");
    assert.ok(actor);
    const key = randomUUID().slice(0, 8);
    const day = "2026-11-25";
    const organic = { ...blankReport(), date: day, line: "T1", doc_no: `QC-${key}` };
    Object.assign(organic.fertilizer[0], { name: "QC test", lot: "LOT", extra_times: ["09:00"] });
    organic.stop_start.push({ id: "stop-test", machine_stop_time: "09:00", machine_run_time: "10:00", machine_stop_reason: "test" });
    const nc = { ...blankNC(), doc_no: `NC-${key}`, doc_date: day, discoverer: "QC test", department: "QC/QA",
      product_name: "test", quantity: "2", unit: "กก.", production_date: day, production_code: "TEST", problem_defect: "test", countermeasure: "test" };
    nc.decisions.rework = true;
    const sample = { ...newSubmission(), doc_no: `SS-${key}`, doc_date: day };
    Object.assign(sample.rows[0], { product_name: "sample", lot_no: "LOT", analysis_result_status: "ผ่าน" });
    sample.rows.push({ ...newSample("second"), product_name: "second", lot_no: "LOT" });
    const log = { ...blankLog(), doc_no: `LOG-${key}`, sample_code: "CODE", requester_name: "Test",
      requester_email: "private@example.invalid", sample_name: "Test" };
    log.sample_type.other_detail = "ประเภททดสอบ";
    log.sample_form.powder = true;
    log.requested_items.ph = true;
    log.quantity.amount = "0.50";
    log.quantity.packaging = "ถุง";
    log.quantity.receive_result.not_return = true;
    log.quantity.receive_result.pick_up = true;
    Object.assign(log.sender_sign, { signer_name: "Test", signed_date: day });
    const lab = blankLabSheet("initial");
    Object.assign(lab.rows[0], { sample_name: "QC test", lot_no: "LOT" });
    const weight = { ...blankQcWeightDocument("initial"), doc_no: `WEIGHT-${key}`, product_name: "test" };
    weight.rows[0].measurements.group_2[3] = "25.101";
    weight.rows.push({ ...blankQcWeightRow("second"), average: "25.100", result: "PASS" });
    const cases = {
      qc_organic_fertilizer: [organic, "remark"],
      nc_reports: [nc, "reviewer_name_1"],
      sample_submissions: [sample, "doc_no"],
      sample_submission_log: [log, "sample_characteristics"],
      lab_sample_receiving: [lab, "rows"],
      qc_product_weight_check: [weight, "remark"],
    };
    const user = { id: actor.id, email: actor.email, displayName: actor.display_name, modules: [...Object.keys(cases), "audit_log"] };
    const connect = async () => ({
      query(sql, params) {
        const savepoints = { BEGIN: "SAVEPOINT qc_check", COMMIT: "RELEASE SAVEPOINT qc_check", ROLLBACK: "ROLLBACK TO SAVEPOINT qc_check" };
        return client.query(savepoints[sql] ?? sql, params);
      },
      release() {},
    });
    const operation = (kind, document, version) => writeQcDocument(user, kind, { action: "save", document, version }, connect);
    const documentIds = [];
    for (const [kind, [draft, field]] of Object.entries(cases)) {
      await assert.rejects(operation(kind, { id: "" }, null), { status: 400 });
      const created = await operation(kind, draft, null);
      documentIds.push(created.saved.id);
      const snapshot = await readQcDocuments(user, kind, client);
      assert.equal(snapshot.versions[created.saved.id], 1);
      assert.deepEqual(snapshot.records.find(row => row.id === created.saved.id), created.saved);
      const changed = structuredClone(created.saved);
      if (field === "rows") changed.rows[0].remark = "QC rollback edit";
      else changed[field] = "QC rollback edit " + key;
      const updated = await operation(kind, changed, 1);
      assert.equal(updated.version, 2);
      await assert.rejects(operation(kind, changed, 1), { status: 409 });
      const deleted = await writeQcDocument(user, kind, { action: "delete", id: created.saved.id, version: 2 }, connect);
      assert.equal(deleted, null);
      assert.ok(!(await readQcDocuments(user, kind, client)).records.some(row => row.id === created.saved.id));
    }

    const { rows: [count] } = await client.query("SELECT count(*)::int AS amount FROM foliar_fertilizer.qc_audit WHERE document_id=ANY($1::uuid[])", [documentIds]);
    assert.equal(count.amount, 18);
    const mapped = (await readFactoryAudit(user, client)).filter(row => row.summary.includes(key) || row.summary.includes(documentIds[4]));
    assert.equal(mapped.length, 18);
    assert.ok(mapped.every(row => row.email === user.email));
    assert.ok(!JSON.stringify(mapped).includes("private@example.invalid"));
    await assert.rejects(readFactoryAudit({ ...user, modules: [] }, client), { status: 403 });
    await assert.rejects(readQcDocuments({ ...user, modules: ["audit_log"] }, "nc_reports", client), { status: 403 });

    await client.query("ROLLBACK");
    const { rows: [after] } = await client.query("SELECT count(*)::int AS amount FROM foliar_fertilizer.qc_documents WHERE id=ANY($1::uuid[])", [documentIds]);
    assert.equal(after.amount, 0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
