import assert from "node:assert/strict";
import { test } from "node:test";
import { getFactoryDatabasePool } from "../src/server/auth/access-repository.ts";
import { readOrganicDocuments, writeOrganicDocument } from "../src/server/organic-documents.ts";
import { blankWipSheet } from "../src/features/wip_receiving_issuing/wip_receiving_issuing_domain.ts";
import { blankOrganicRawMaterialSheet } from "../src/features/organic_raw_material_receiving/organic_raw_material_receiving_domain.ts";
import { blankOrganicExtractionSheet } from "../src/features/organic_extraction_temperature/organic_extraction_temperature_domain.ts";
import { blankOrganicExtractionMaterialLedgerSheet } from "../src/features/organic_extraction_material_ledger/organic_extraction_material_ledger_domain.ts";
import { createBlankEffervescentMaterialLedgerSheet } from "../src/features/effervescent_material_ledger/effervescent_material_ledger_domain.ts";

test("all five organic forms round-trip through PostgreSQL", {
  skip: process.env.FACTORY_ORGANIC_ROLLBACK_CHECK !== "1",
}, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const actor = await client.query("SELECT id::text FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1");
    assert.ok(actor.rowCount);
    const wip = blankWipSheet();
    Object.assign(wip.rows[0], { opening_balance: "8.5", received: "3", issued_for_production: "2" });
    const raw = blankOrganicRawMaterialSheet();
    Object.assign(raw.rows[0], { material_code: "E2E-RM-2511", supplier_code: "E2E-SUP", quantity: "4", unit: "กก.", qc_weight: "/" });
    const temperature = blankOrganicExtractionSheet();
    temperature.rounds[0].temperature_rows[0].temperatures.B1 = "76.2";
    temperature.rounds[1].usage_rows[0].quantities.B6 = "13";
    const extraction = blankOrganicExtractionMaterialLedgerSheet();
    Object.assign(extraction.rows[0], { received: "12", issued_for_production: "3" });
    const effervescent = createBlankEffervescentMaterialLedgerSheet("db-check");
    Object.assign(effervescent.rows[0], { opening_balance: "15", adjustment: "-2", closing_balance: "13" });
    const fixtures = {
      wip_receiving_issuing: wip,
      organic_raw_material_receiving: raw,
      organic_extraction_temperature: temperature,
      organic_extraction_material_ledger: extraction,
      effervescent_material_ledger: effervescent,
    };
    const user = { id: actor.rows[0].id, modules: Object.keys(fixtures) };
    const modules = await client.query("SELECT module_key FROM foliar_fertilizer.app_modules WHERE is_active AND module_key=ANY($1)", [user.modules]);
    assert.equal(modules.rowCount, 5);
    const connect = async () => ({
      query(sql, params) {
        const statements = { BEGIN: "SAVEPOINT organic_check", COMMIT: "RELEASE SAVEPOINT organic_check", ROLLBACK: "ROLLBACK TO SAVEPOINT organic_check" };
        return client.query(statements[sql] ?? sql, params);
      },
      release() {},
    });

    for (const [kind, document] of Object.entries(fixtures)) {
      const dayField = "record_date" in document ? "record_date" : "document_date";
      document[dayField] = "2099-11-25";
      const save = (value) => writeOrganicDocument(user, kind, { action: "save", document: value }, connect);
      const saved = await save(document);
      const records = await readOrganicDocuments(user, kind, client);
      assert.deepEqual(records.find((row) => row.id === saved.id), { ...document, id: saved.id, created_at: saved.created_at, updated_at: saved.updated_at }, kind);
      if (kind === "wip_receiving_issuing" || kind === "organic_raw_material_receiving")
        await assert.rejects(save(document), { status: 409 });
      const updated = await save({ ...saved, [dayField]: "2099-11-26" });
      assert.equal(updated.id, saved.id);
      assert.equal(updated.created_at, saved.created_at);
      await assert.rejects(save(saved), { status: 409 });
      await writeOrganicDocument(user, kind, { action: "delete", id: saved.id, updated_at: updated.updated_at }, connect);
      assert.ok(!(await readOrganicDocuments(user, kind, client)).some((row) => row.id === saved.id));
      assert.equal((await client.query("SELECT count(*)::int AS count FROM foliar_fertilizer.organic_documents WHERE id=$1 AND deleted_at IS NOT NULL", [saved.id])).rows[0].count, 1);
      await assert.rejects(save(updated), { status: 409 });
      await assert.rejects(save({ ...document, [dayField]: "2099-02-30" }), { status: 400 });
    }
    await assert.rejects(writeOrganicDocument({ ...user, modules: [] }, "wip_receiving_issuing", { action: "save", document: wip }, connect), { status: 403 });
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
