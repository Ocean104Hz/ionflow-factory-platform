import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { getFactoryDatabasePool } from "../src/server/auth/access-repository.ts";
import { parseHubProduct, parseHubProductionOrderCommand } from "../src/server/sales-hub/contract.ts";
import { acceptHubOrder, saveHubProduct } from "../src/server/sales-hub/repository.ts";
import { submitHubDelivery } from "../src/server/sales-hub/delivery.ts";
import { changeHubProduction } from "../src/server/sales-hub/production.ts";
import { createHubDocument, saveHubPrice } from "../src/server/sales-hub/documents.ts";

test("W1-FF records ordered events and invoices only at registered prices", async () => {
  const pool = getFactoryDatabasePool();
  const client = await pool.connect();
  const caller = "foliar-test@example.invalid";
  try {
    await client.query("BEGIN");
    const connect = async () => ({
      query(sql, args) {
        const statements = { BEGIN: "SAVEPOINT hub_check", COMMIT: "RELEASE SAVEPOINT hub_check", ROLLBACK: "ROLLBACK TO SAVEPOINT hub_check" };
        return client.query(statements[sql] ?? sql, args);
      },
      release() {},
    });
    const company = randomUUID();
    const product = randomUUID();
    const order = randomUUID();
    const now = new Date().toISOString();
    const productInput = parseHubProduct({
      hubProductId: product, sourceCompanyId: company, sourceCompanyCode: "TEST", sourceFactoryId: randomUUID(),
      factoryCode: "W1-FF", productCode: "QA-FF", productName: "W1-FF rollback test", productType: "TEST",
      baseUnit: "kg", specification: null, hubStatus: "ACTIVE", hubRecordVersion: 1, sourceUpdatedAt: now,
    });
    await saveHubProduct(productInput, connect);
    const wire = {
      contractVersion: "5", commandId: randomUUID(), commandType: "FACTORY_ORDER_UPSERT", idempotencyKey: randomUUID(),
      factory: { code: "W1-FF" }, sourceCompany: { id: company, code: "TEST", nameSnapshot: "W1-FF rollback" },
      routeId: randomUUID(), order: { hubOrderId: order, hubOrderNumber: "PDO-TEST", documentRevision: 1 },
      requestedAt: now, requestedBy: { hubUserId: randomUUID(), nameSnapshot: "Test", emailSnapshot: caller },
      correlationId: randomUUID(), payload: {
        orderDate: "2026-11-24", requestedProductionCompletionDate: "2026-11-25", scheduledPickupAt: "2026-11-25T12:00:00.000Z",
        customer: { code: "TEST", name: "Test buyer", phone: null }, recipient: { name: null, address: null, phone: null },
        driver: null, note: null, items: [{
          hubOrderLineId: randomUUID(), lineNo: 1, factoryProductId: null, hubProductId: product, sku: "QA-FF",
          productName: "W1-FF rollback test", productType: "TEST", unitName: "kg", quantity: 2.25,
          productionDepartment: null, lotNo: null, remark: null,
        }],
      },
    };
    assert.throws(() => parseHubProductionOrderCommand({ ...wire, factory: { code: "W1-IT" } }), { status: 400 });
    const command = parseHubProductionOrderCommand(wire);
    const ack = await acceptHubOrder(command, caller, connect);
    const id = ack.factoryOrderId;
    assert.equal(ack.status, "APPLIED");
    assert.equal((await acceptHubOrder(command, caller, connect)).status, "IDEMPOTENT_REPLAY");
    assert.equal((await acceptHubOrder({ ...command, commandId: randomUUID(), idempotencyKey: randomUUID() }, caller, connect)).factoryOrderId, id);
    await assert.rejects(acceptHubOrder({ ...command, sourceCompany: { ...command.sourceCompany, id: randomUUID() } }, caller, connect), { status: 409 });

    const state = async () => (await client.query("SELECT document FROM foliar_fertilizer.hub_orders WHERE id=$1", [id])).rows[0].document;
    const change = async (status, version) => changeHubProduction({ id, status, expectedVersion: "hub:" + (version ?? (await state()).updated) }, caller, connect);
    const initial = await state();
    await assert.rejects(change("กำลังผลิต"), { status: 422 });
    await assert.rejects(createHubDocument("DELIVERY_ORDER", id, caller, connect), { status: 409 });
    await change("วัตถุดิบพร้อม");
    await assert.rejects(change("โรงงานอนุมัติ", initial.updated), { status: 409 });
    await change("โรงงานอนุมัติ");
    await change("กำลังผลิต");
    const delivery = await createHubDocument("DELIVERY_ORDER", id, caller, connect);
    assert.match(delivery.number, /^DO-W1-FF\d{8}$/);
    assert.deepEqual(await createHubDocument("DELIVERY_ORDER", id, caller, connect), delivery);
    assert.equal((await state()).production, "ผลิตเสร็จแล้ว");
    await assert.rejects(createHubDocument("INVOICE", id, caller, connect), { status: 409 });
    await assert.rejects(saveHubPrice({ companyId: company, productId: product, price: "125.55", unit: "g" }, caller, connect), { status: 409 });
    await saveHubPrice({ companyId: company, productId: product, price: "125.55", unit: "kg" }, caller, connect);

    const invoice = await createHubDocument("INVOICE", id, caller, connect);
    assert.match(invoice.number, /^INV-W1-FF\d{8}$/);
    assert.deepEqual(await createHubDocument("INVOICE", id, caller, connect), invoice);
    await saveHubPrice({ companyId: company, productId: product, price: "140", unit: "kg" }, caller, connect);
    const shipping = new FormData();
    for (const [name, value] of Object.entries({ carrier: "Test Carrier", driverName: "Test Driver", driverPhone: "0800000000",
      nationalId: "1000000000000", plate: "TEST", pickup: "2026-11-25T19:00" })) shipping.set(name, value);
    const sample = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/+n0AAAAASUVORK5CYII=", "base64");
    for (const field of ["DRIVER_ID_DOCUMENT", "DRIVER_PHOTO", "VEHICLE_PHOTO"]) {
      shipping.set(field, new File([sample], field + ".png", { type: "image/png" }));
    }
    await assert.rejects(submitHubDelivery(delivery.id, null, caller, connect), { status: 409 });
    await submitHubDelivery(delivery.id, shipping, caller, connect);
    await assert.rejects(submitHubDelivery(delivery.id, shipping, caller, connect), { status: 409 });
    await submitHubDelivery(delivery.id, null, caller, connect);
    const evidence = await client.query("SELECT content FROM foliar_fertilizer.hub_delivery_evidence WHERE delivery_id=$1", [delivery.id]);
    assert.equal(evidence.rowCount, 3);
    assert.ok(evidence.rows.every(row => row.content.equals(sample)));
    const { rows } = await client.query("SELECT envelope FROM foliar_fertilizer.hub_events WHERE order_id=$1 ORDER BY sequence", [id]);
    assert.deepEqual(rows.map(r => [r.envelope.event_type, r.envelope.aggregate_version]), [
      ["FACTORY_ORDER_RECEIVED", 1], ["MATERIAL_READY", 2], ["FACTORY_ORDER_APPROVED", 3], ["PRODUCTION_STARTED", 4],
      ["DELIVERY_ORDER_CREATED", 1], ["INVOICE_ISSUED", 1], ["DELIVERY_ORDER_SUBMITTED", 2], ["DELIVERY_ORDER_PICKED_UP", 3],
    ]);
    assert.equal(rows[5].envelope.payload.items[0].unitPriceSnapshot, "125.5500");
    assert.equal(rows[5].envelope.payload.grandTotal, "282.4875");
    if (process.env.W1_FF_TEST_ENVELOPE_FILE) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(process.env.W1_FF_TEST_ENVELOPE_FILE, JSON.stringify(rows.map(row => row.envelope)));
    }
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
