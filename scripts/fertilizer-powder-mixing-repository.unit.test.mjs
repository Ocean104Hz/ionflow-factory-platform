import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/server/fertilizer-powder-mixing/mixing-repository.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "mixing-repository.ts", reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
assert.equal(compiled.diagnostics?.length ?? 0, 0);
const isolated = compiled.outputText
  .replace(/import ["']server-only["'];/, "")
  .replace(/import\s*\{\s*getDevelopmentDatabase\s*,?\s*\}\s*from\s*["']\.\.\/database\/database["'];/, "const getDevelopmentDatabase = () => { throw new Error('Unexpected real DB access'); };");
const { createMixingRepository, MixingConflictError } = await import(
  `data:text/javascript;base64,${Buffer.from(isolated).toString("base64")}`,
);
const actor = { id: "2", displayName: "Test operator" };
const id = "2c11aa33-34f2-4c68-94a7-c7ab5831c7dd";
const input = {
  doc_no: "MIX-TEST", report_date: "2026-11-25", fertilizer: "Formula A", lot_no: "LOT-1",
  shift: "Day", location: "Plant", loader_no: "L1", mix_duration: 1.5,
  inspector: "", inspector_date: "", production: "", factory_qa: "", masterRefs: {},
  materials: [{ id: "m1", material_code: "A", material_name: "Material A", lot_no: "A1", order_qty: 5, unit: "kg" }],
  mix_rounds: [{ id: "r1", round_date: "2026-11-25", shift: "Day", loader_load_count: "2", is_pass: null, operator_mixer: "Operator", supervisor: "Supervisor" }],
};
function fixture(version = "1", balance = null, recordId = id) {
  return { ...structuredClone(input), id: recordId, version, mix_duration: "1.5",
    materials: [{ ...input.materials[0], order_qty: "5", stock_balance: balance }],
    created_at: new Date("2026-11-25T00:00:00Z"), updated_at: new Date("2026-11-25T01:00:00Z"), updated_by: actor.displayName };
}
function fake(handler) {
  const calls = [], transactions = [];
  const q = { async query(sql, values = []) { calls.push({ sql, values }); return handler(sql, values); } };
  return { calls, transactions, repo: createMixingRepository({
    async readOnly(work) { transactions.push("read"); return work(q); },
    async write(work) { transactions.push("begin"); try { const value = await work(q); transactions.push("commit"); return value; } catch (error) { transactions.push("rollback"); throw error; } },
  }) };
}
const isRead = (sql) => sql.startsWith("SELECT\n");
const isHeaderInsert = (sql) => sql.startsWith("INSERT INTO foliar_fertilizer.m_");
const isMaterialInsert = (sql) => sql.startsWith("INSERT INTO foliar_fertilizer.r_fertilizer_powder_mixing_materials");
const isHistory = (sql) => sql.startsWith("INSERT INTO foliar_fertilizer.r_fertilizer_powder_mixing_history");

test("list maps nullable stock and pending result, filters archived reports and orders details", async () => {
  const f = fake(() => [fixture()]);
  const [row] = await f.repo.list();
  assert.equal(row.materials[0].stock_balance, null);
  assert.equal(row.materials[0].order_qty, 5);
  assert.equal(row.mix_rounds[0].is_pass, null);
  assert.equal(row.version, "1");
  assert.match(f.calls[0].sql, /archived_at IS NULL/);
  assert.match(f.calls[0].sql, /ORDER BY m\.line_no/);
  assert.match(f.calls[0].sql, /ORDER BY r\.line_no/);
  assert.deepEqual(f.transactions, ["read"]);
});
test("get uses a parameter and returns null for missing or archived records", async () => {
  const f = fake(() => []);
  assert.equal(await f.repo.get(id), null);
  assert.deepEqual(f.calls[0].values, [id]);
  assert.match(f.calls[0].sql, /h\.id = \$1 AND h\.archived_at IS NULL/);
});
test("create writes header and ordered children with null stock and authenticated actor in one transaction", async () => {
  let newId;
  const f = fake((sql, values) => {
    if (isHeaderInsert(sql)) newId = values[0];
    return isRead(sql) ? [fixture("1", null, newId)] : [];
  });
  const row = await f.repo.create({ ...input, materials: [{ ...input.materials[0], stock_balance: 999 }] }, actor);
  assert.equal(row.id, newId);
  assert.deepEqual(f.transactions, ["begin", "commit"]);
  assert.equal(f.calls.find(c => isMaterialInsert(c.sql)).values[8], null);
  const audit = f.calls.find(c => isHistory(c.sql));
  assert.deepEqual(audit.values.slice(2, 6), ["1", "created", actor.id, actor.displayName]);
  assert.equal(JSON.parse(audit.values[7])[0].after.id, row.id);
});
test("update checks version and preserves an unchanged stock snapshot, then records before and after", async () => {
  let reads = 0;
  const f = fake(sql => {
    if (sql.includes("FOR UPDATE")) return [{ id }];
    if (isRead(sql)) return [fixture(String(++reads), "12")];
    if (sql.startsWith("UPDATE")) return [{ id }];
    return [];
  });
  const row = await f.repo.update(id, "1", input, actor);
  assert.equal(row.version, "2");
  assert.deepEqual(f.calls[0].values, [id, "1"]);
  assert.equal(f.calls.find(c => isMaterialInsert(c.sql)).values[8], 12);
  const audit = JSON.parse(f.calls.find(c => isHistory(c.sql)).values[7])[0];
  assert.equal(audit.before.version, "1");
  assert.equal(audit.after.version, "2");
  assert.deepEqual(f.transactions, ["begin", "commit"]);
});
test("stale update and archive stop before any write", async () => {
  for (const operation of ["update", "archive"]) {
    const f = fake(() => []);
    const result = operation === "update" ? f.repo.update(id, "1", input, actor) : f.repo.archive(id, "1", actor);
    await assert.rejects(result, MixingConflictError);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.transactions, ["begin", "rollback"]);
  }
});
test("archive updates header only, keeps children and appends audit", async () => {
  const f = fake(sql => sql.includes("FOR UPDATE") ? [{ id }] : isRead(sql) ? [fixture()] : sql.startsWith("UPDATE") ? [{ version: "2" }] : []);
  await f.repo.archive(id, "1", actor);
  assert.equal(f.calls.some(c => /DELETE FROM/.test(c.sql)), false);
  assert.match(f.calls.find(c => c.sql.startsWith("UPDATE")).sql, /archived_at=CURRENT_TIMESTAMP/);
  assert.deepEqual(f.calls.find(c => isHistory(c.sql)).values.slice(2, 6), ["2", "archived", actor.id, actor.displayName]);
  assert.deepEqual(f.transactions, ["begin", "commit"]);
});
test("history failure propagates through transaction boundary without commit", async () => {
  let newId;
  const f = fake((sql, values) => {
    if (isHeaderInsert(sql)) newId = values[0];
    if (isHistory(sql)) throw new Error("audit failure");
    return isRead(sql) ? [fixture("1", null, newId)] : [];
  });
  await assert.rejects(f.repo.create(input, actor), /audit failure/);
  assert.deepEqual(f.transactions, ["begin", "rollback"]);
});
