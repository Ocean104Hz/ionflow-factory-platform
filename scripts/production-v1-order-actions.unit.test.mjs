import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

// Exercise the actual server module, substituting only external dependency/DB boundaries.
const requireLocal = createRequire(import.meta.url);
const ts = requireLocal('typescript');
const source = readFileSync(resolve(process.env.NAN_ORDER_SERVER_SOURCE || 'src/server/production-v1.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.filter((item) => item.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
const authUser = { id: '42', displayName: 'Tester', modules: ['product_production_orders_v1', 'production_reports', 'production_receipts_v1'] };
const orderId = '11111111-1111-4111-8111-111111111111';
const createdAt = '2026-11-28T00:00:00.000Z';
const formulaId = 'formula-original';
const fixture = () => ({
  id: orderId, documentNumber: 'PRD-2611002', date: '2026-11-28', location: 'Plant', formulaId, amount: '75', note: '', mixingReference: '', createdAt,
  rows: [{ id: 'row-1', date: '', lineT1Qty: '', lineT1Lot: '', lineT2Qty: '', lineT2Lot: '', lineT4Qty: '', lineT4Lot: '', shift: '', producer: '' }],
  signers: { preparedBy: '', qaOfficer: '', productionOfficer: '', manager: '' },
  sheet: { id: orderId, orderId, orderNumber: 'PRD-2611002', orderDate: '2026-11-28', issuedAt: createdAt, issuedBy: 'Original', lines: [{ orderLineId: orderId, inventoryItemId: '', productCode: 'FG', productName: 'Original product', lot: '', plannedQuantity: 75, plannedUnit: 'ตัน', formulaId, formulaCode: 'F', formulaName: 'Original formula', formulaVersion: '1', batchSize: 1, batchUnit: 'ตัน', batchCount: 75, ingredients: [{ materialId: 'RM', code: 'RM', name: 'Raw', unit: 'ตัน', quantity: 30, remarks: '' }], packaging: [] }] },
});
const bom = { masters: [{ id: 'fg', code: 'NEW-FG', name: 'New product', usageType: 'ผลิต' }, { id: 'rm', code: 'RM', name: 'Raw', usageType: 'ใช้' }], formulas: [{ id: 'formula-new', masterId: 'fg', status: 'ACTIVE', unit: 'ตัน', code: 'NEW', name: 'New formula', version: '2', batchSize: 1, ingredients: [{ materialId: 'rm', quantity: 0.25, unit: 'ตัน', remarks: '' }], packaging: [] }] };
const deps = {
  'server-only': {},
  './auth/access-repository.ts': { getFactoryDatabasePool: () => { throw Error('unexpected live DB access'); } },
  './auth/auth-service.ts': { requireFactoryModule: (user, key) => { if (!user.modules.includes(key)) throw Error('ACCESS_DENIED'); } },
  './factory-masters.ts': { loadMasters: async () => ({ rows: [] }) },
  '../features/bom/bom-domain.ts': {},
  '../features/purchase-orders/po-domain.ts': { validDay: (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date },
  '../features/production-flow/production-flow-domain.ts': {},
};
const exports = {};
runInNewContext(compiled.outputText, { exports, require: (id) => { assert.ok(Object.hasOwn(deps, id), `Unexpected import ${id}`); return deps[id]; }, crypto: webcrypto, Date, JSON, Number, String, Object, Array, Set, Error }, { filename: 'production-v1.compiled.cjs' });
const { saveProduction, readProduction } = exports;

function database({ linked = false, missing = false, failWrite = false } = {}) {
  let record = missing ? null : fixture();
  let savedBefore;
  const calls = [];
  const client = {
    async query(sql, args = []) {
      const q = sql.replace(/\s+/g, ' ').trim();
      calls.push({ q, args });
      if (q === 'BEGIN' || q === 'BEGIN READ ONLY') { savedBefore = structuredClone(record); return { rows: [] }; }
      if (q === 'ROLLBACK') { record = savedBefore; return { rows: [] }; }
      if (q === 'COMMIT' || q.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (q.includes("WHERE r.id=$1") && q.includes("FOR UPDATE")) {
        assert.equal(args[1], authUser.id); assert.equal(args[2], '26'); assert.equal(args[3], '11');
        return { rows: [{ doc_no: 'PRD-2611003' }] };
      }
      if (q.startsWith('INSERT INTO foliar_fertilizer.production_v1_documents')) {
        assert.equal(args[1], 'order'); assert.equal(args[2], 'PRD-2611003');
        record = JSON.parse(args[5]); return { rowCount: 1, rows: [] };
      }
      if (q.startsWith('UPDATE foliar_fertilizer.production_order_doc_no_reservations')) {
        assert.match(q, /status='used'/); return { rowCount: 1, rows: [] };
      }
      if (q.includes('WHERE id=$1') && q.includes('FOR UPDATE')) {
        assert.match(q, /kind='order' AND NOT \(payload \? 'deletedAt'\)/);
        return { rows: record && !record.deletedAt && args[0] === record.id ? [{ payload: structuredClone(record) }] : [] };
      }
      if (q.includes('AS linked')) { assert.match(q, /order_id=\$1 AND kind IN \('report','receipt'\)/); assert.equal(args[0], orderId); return { rows: [{ linked }] }; }
      if (q.startsWith('UPDATE foliar_fertilizer.production_v1_documents')) {
        assert.match(q, /WHERE id=\$1 AND kind='order' AND NOT \(payload \? 'deletedAt'\)/);
        assert.equal(args[0], orderId); assert.equal(args[3], authUser.id);
        if (failWrite) return { rowCount: 0, rows: [] };
        record = JSON.parse(args[2]); return { rowCount: 1, rows: [] };
      }
      if (q.startsWith('SELECT payload FROM foliar_fertilizer.production_bom')) return { rows: [{ payload: structuredClone(bom) }] };
      if (q.includes('WHERE kind=$1 ORDER BY') || q.includes('WHERE kind=$1 AND')) {
        assert.match(q, /kind <> 'order' OR NOT \(payload \? 'deletedAt'\)/);
        return { rows: args[0] === 'order' && record && !record.deletedAt ? [{ payload: structuredClone(record) }] : [] };
      }
      if (q.startsWith('WITH reusable')) {
        // Verify allocator retains the soft-deleted document in its number history.
        assert.doesNotMatch(q, /deletedAt/); assert.match(q, /production_v1_documents/);
        return { rows: [{ seq: '3', reused: false }] };
      }
      throw Error(`Unexpected SQL in test: ${q}`);
    },
    release() {},
  };
  return { connect: async () => client, record: () => record, calls };
}
const edit = (row, revision = createdAt) => ({ action: 'edit', id: orderId, expectedRevision: revision, row });
const remove = (revision = createdAt) => ({ action: 'delete', id: orderId, expectedRevision: revision });

test('edit keeps number, id and original formula snapshot; no new reservation', async () => {
  const db = database();
  const result = await saveProduction(authUser, 'order', edit({ ...fixture(), note: 'changed', date: '2026-11-29' }), db.connect);
  assert.equal(result.id, orderId); assert.equal(result.documentNumber, 'PRD-2611002'); assert.equal(result.createdAt, createdAt);
  assert.equal(result.sheet.orderDate, '2026-11-29'); assert.equal(result.sheet.issuedAt, createdAt);
  assert.equal(result.sheet.lines[0].formulaVersion, '1'); assert.equal(result.sheet.lines[0].ingredients[0].quantity, 30);
  assert.equal(result.note, 'changed'); assert.ok(result.revision); assert.equal(db.record().note, 'changed');
  assert.ok(db.calls.some(({ q }) => q.includes('pg_advisory_xact_lock')));
  assert.ok(!db.calls.some(({ q }) => q.includes('doc_no_reservations') || q.includes('production_bom')));
  assert.equal(db.calls.at(-1).q, 'COMMIT');
});

test('quantity change scales existing material and batch quantities without loading live BOM', async () => {
  const db = database();
  const result = await saveProduction(authUser, 'order', edit({ ...fixture(), amount: '150' }), db.connect);
  const line = result.sheet.lines[0];
  assert.equal(line.plannedQuantity, 150); assert.equal(line.batchCount, 150); assert.equal(line.ingredients[0].quantity, 60);
  assert.ok(!db.calls.some(({ q }) => q.includes('production_bom')));
});

test('selecting a different active formula updates snapshot but not PRD or original creation date', async () => {
  const db = database();
  const result = await saveProduction(authUser, 'order', edit({ ...fixture(), formulaId: 'formula-new', amount: '80' }), db.connect);
  assert.equal(result.id, orderId); assert.equal(result.documentNumber, 'PRD-2611002'); assert.equal(result.createdAt, createdAt);
  assert.equal(result.sheet.lines[0].formulaId, 'formula-new'); assert.equal(result.sheet.lines[0].ingredients[0].quantity, 20);
  assert.ok(!db.calls.some(({ q }) => q.includes('doc_no_reservations')));
});

test('date cannot move into another PRD month; failed update rolls back', async () => {
  const db = database();
  await assert.rejects(saveProduction(authUser, 'order', edit({ ...fixture(), date: '2026-12-01' }), db.connect), (e) => e.status === 400);
  assert.equal(db.record().date, '2026-11-28'); assert.equal(db.calls.at(-1).q, 'ROLLBACK');
});

test('linked report or receipt blocks both edit and delete before any update', async () => {
  for (const command of [edit(fixture()), remove()]) {
    const db = database({ linked: true });
    await assert.rejects(saveProduction(authUser, 'order', command, db.connect), (e) => e.status === 409);
    assert.ok(!db.calls.some(({ q }) => q.startsWith('UPDATE'))); assert.equal(db.calls.at(-1).q, 'ROLLBACK');
  }
});

test('optimistic revision blocks stale edits and stale deletes', async () => {
  const db = database();
  await saveProduction(authUser, 'order', edit({ ...fixture(), note: 'first' }), db.connect);
  for (const command of [edit({ ...fixture(), note: 'stale' }), remove()]) {
    await assert.rejects(saveProduction(authUser, 'order', command, db.connect), (e) => e.status === 409);
  }
  assert.equal(db.record().note, 'first'); assert.equal(db.record().deletedAt, undefined);
});

test('soft delete preserves the PRD, order id and reservation; hides from all V1 list consumers', async () => {
  const db = database();
  const result = await saveProduction(authUser, 'order', remove(), db.connect);
  assert.equal(result.documentNumber, 'PRD-2611002'); assert.equal(db.record().id, orderId);
  assert.equal(db.record().documentNumber, 'PRD-2611002'); assert.ok(db.record().deletedAt); assert.equal(db.record().deletedBy, authUser.id);
  assert.ok(!db.calls.some(({ q }) => q.startsWith('DELETE') || q.includes('doc_no_reservations')));
  assert.equal((await readProduction(authUser, 'order', db.connect)).documents.length, 0);
  assert.equal((await readProduction(authUser, 'report', db.connect)).sheets.length, 0);
  assert.equal((await readProduction(authUser, 'receipt', db.connect)).orders.length, 0);
  await assert.rejects(saveProduction(authUser, 'order', edit(fixture()), db.connect), (e) => e.status === 404);
  const next = await saveProduction(authUser, 'order', { action: 'preview_doc_no', date: '2026-11-28' }, db.connect);
  assert.equal(next.docNo, 'PRD-2611003');
});

test('missing module permission denies management before connecting to DB', () => {
  for (const command of [edit(fixture()), remove()]) {
    assert.throws(() => saveProduction({ ...authUser, modules: [] }, 'order', command, () => { throw Error('unexpected connect'); }), /ACCESS_DENIED/);
  }
});

test('failed write and missing document return conflict/not found without data change', async () => {
  const db = database({ failWrite: true });
  await assert.rejects(saveProduction(authUser, 'order', remove(), db.connect), (e) => e.status === 409);
  assert.equal(db.record().deletedAt, undefined); assert.equal(db.calls.at(-1).q, 'ROLLBACK');
  const missing = database({ missing: true });
  await assert.rejects(saveProduction(authUser, 'order', remove(), missing.connect), (e) => e.status === 404);
});


test('original create still checks and consumes a PRD reservation in one transaction', async () => {
  const db = database();
  const result = await saveProduction(authUser, 'order', { action: 'save', row: { ...fixture(), formulaId: 'formula-new', reservationId: '22222222-2222-4222-8222-222222222222' } }, db.connect);
  assert.equal(result.documentNumber, 'PRD-2611003'); assert.notEqual(result.id, orderId);
  assert.ok(db.calls.some(({ q }) => q.includes('WHERE r.id=$1') && q.includes('FOR UPDATE')));
  assert.ok(db.calls.some(({ q }) => q.startsWith('UPDATE foliar_fertilizer.production_order_doc_no_reservations')));
  assert.equal(db.calls.at(-1).q, 'COMMIT');
});
