import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getFactoryDatabasePool } from "../src/server/auth/access-repository.ts";
import { saveFactoryMaster } from "../src/server/factory-masters.ts";
import { readProduction, saveProduction } from "../src/server/production-v1.ts";
import { blankMaster as blankSetting } from "../src/features/master-data/master-domain.ts";
import { blankFormula, blankMaster } from "../src/features/bom/bom-domain.ts";
import { newProductionReport } from "../src/features/production-flow/production-flow-domain.ts";

test("production V1 keeps the BOM version, report and receipt linked in PostgreSQL", {
  skip: process.env.FACTORY_PRODUCTION_V1_ROLLBACK_CHECK !== "1",
}, async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  await client.query("BEGIN");
  const connect = async () => ({
    query: (sql, values) => client.query(({
      BEGIN: "SAVEPOINT production_check", "BEGIN READ ONLY": "SAVEPOINT production_check",
      COMMIT: "RELEASE SAVEPOINT production_check", ROLLBACK: "ROLLBACK TO SAVEPOINT production_check",
    })[sql] ?? sql, values),
    release: () => {},
  });
  try {
    const actors = await client.query("SELECT id::text, display_name FROM foliar_fertilizer.app_users WHERE is_active ORDER BY id LIMIT 1");
    assert.ok(actors.rowCount, "A factory account is needed for the rollback check");
    const user = { id: actors.rows[0].id, displayName: actors.rows[0].display_name,
      modules: ["bom", "product_production_orders_v1", "production_reports", "production_receipts_v1"] };
    const tag = "CHECK-" + randomUUID().slice(0, 8).toUpperCase();
    const settings = await client.query("SELECT payload FROM foliar_fertilizer.settings_masters WHERE kind='units'");
    let unit = settings.rows.map((item) => item.payload).find((row) => row.active && ["kg", "กก.", "กก", "กิโลกรัม"].includes(row.name.toLowerCase()));
    if (!unit) {
      unit = { ...blankSetting("units", randomUUID()), code: tag + "-U", name: "กิโลกรัม" };
      await saveFactoryMaster(unit, null, connect);
    }
    const material = { ...blankSetting("materials", randomUUID()), code: tag + "-M", name: tag + " raw", typeId: unit.id };
    await saveFactoryMaster(material, null, connect);
    const master = await saveProduction(user, "bom", {
      action: "master", row: { ...blankMaster(), code: tag + "-P", name: tag + " product", unit: unit.name },
    }, connect);
    const product = master.state.masters.find((row) => row.id === master.savedId);
    const formulaResult = await saveProduction(user, "bom", {
      action: "formula", default: true, row: { ...blankFormula(product), code: tag + "-F", name: tag,
        version: "1", status: "ACTIVE", effectiveDate: "2099-01-01",
        ingredients: [{ materialId: "settings-" + material.id, unit: unit.name, quantity: 200, remarks: "" }],
      },
    }, connect);
    const draft = { date: "2099-01-01", location: "Test Site", formulaId: formulaResult.savedId, amount: "2.5", note: tag, rows: [], signers: {} };
    const order = await saveProduction(user, "order", { action: "save", row: draft }, connect);
    assert.match(order.documentNumber, /^PRD-9901\d{3,}$/);
    assert.equal(order.sheet.lines[0].ingredients[0].quantity, 500);
    const next = await saveProduction(user, "order", { action: "save", row: draft }, connect);
    assert.notEqual(next.documentNumber, order.documentNumber);
    const chosen = formulaResult.state.formulas.find((row) => row.id === formulaResult.savedId);
    await saveProduction(user, "bom", {
      action: "formula", default: true, row: { ...chosen, ingredients: chosen.ingredients.map((row) => ({ ...row, quantity: 300 })) },
    }, connect);
    const source = await readProduction(user, "report", connect);
    const snapshot = source.sheets.find((sheet) => sheet.orderId === order.id);
    assert.equal(snapshot.lines[0].ingredients[0].quantity, 500);
    const report = { ...newProductionReport(snapshot, order.id, ""), status: "RECORDED", reportDate: draft.date,
      shift: "A", productionLine: "T1", startTime: "08:00", endTime: "09:00", operator: user.displayName,
      goodQuantity: 2, wasteQuantity: 0, note: tag };
    const reports = await saveProduction(user, "report", { action: "save", row: report }, connect);
    assert.equal(reports.saved.goodQuantity, 2);
    const rejected = await saveProduction(user, "report", { action: "save", row: { ...reports.saved, goodQuantity: 3 } }, connect);
    assert.ok(rejected.errors.goodQuantity);
    const receipt = await saveProduction(user, "receipt", { action: "save", row: {
      ...draft, documentDate: draft.date, orderId: order.id, p2Items: [], moldingItems: [],
      p1Items: [{ id: randomUUID(), name: product.name, quantity: "100", unit: unit.name }],
    } }, connect);
    assert.equal(receipt.productionOrderNumber, order.documentNumber);
    const history = await readProduction(user, "receipt", connect);
    assert.ok(history.documents.some((row) => row.id === receipt.id));
    await assert.rejects(saveProduction(user, "report", { action: "save", row: reports.saved }, connect), { status: 400 });
    const hidden = await client.query("SELECT count(*)::int AS n FROM foliar_fertilizer.app_modules WHERE is_active AND module_key IN ('bulk_production_orders','production_receipts')");
    assert.equal(hidden.rows[0].n, 0);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
