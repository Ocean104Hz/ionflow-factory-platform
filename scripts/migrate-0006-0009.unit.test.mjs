import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, tableNames, materialTablePlan } from './migrate-0006-0009.mjs';
const names = ['material_issues', 'material_issue_items', 'material_issue_history'];
const pattern = /^(?:m_|r_)?material_issues?(?:_|$)/;
const relation = (name, owner = 'foliar_fertilizer_owner', kind = 'r') => ({ name, owner, kind });
test('extracts exactly expected table names and rejects mismatched count', () => {
  const sql = names.map(n => `CREATE TABLE foliar_fertilizer.${n} (id text);`).join('\n');
  assert.deepEqual(tableNames(sql, 3), names);
  assert.throws(() => tableNames(sql, 4));
});
test('absent tables are pending', () => assert.equal(classify(names, [], pattern).status, 'PENDING'));
test('complete owner tables are present, not an applied migration ledger', () => assert.equal(classify(names, names.map(n => relation(n)), pattern).status, 'PRESENT'));
test('partial state prevents apply', () => assert.equal(classify(names, [relation(names[0])], pattern).status, 'PARTIAL'));
test('alternate table name prevents apply even if expected names are absent', () => assert.equal(classify(names, [relation('m_material_issues')], pattern).status, 'CONFLICT'));
test('wrong owner or relation type prevents apply', () => {
  assert.equal(classify(names, [relation(names[0], 'other')], pattern).status, 'CONFLICT');
  assert.equal(classify(names, [relation(names[0], undefined, 'v')], pattern).status, 'CONFLICT');
});

const actual = ['m_material_issues', 'r_material_issue_items', 'r_material_issue_history'];
test('0007 checks canonical backend table names for legacy SQL without rewriting migration', () => {
  const plan = materialTablePlan(names);
  assert.deepEqual(plan.names, actual);
  assert.equal(plan.legacySql, true);
  assert.equal(classify(plan.names, actual.map(n => relation(n)), pattern).status, 'PRESENT');
});
test('0007 canonical SQL uses canonical names and is not legacy', () => {
  assert.deepEqual(materialTablePlan(actual), { names: actual, legacySql: false });
});
test('0007 unknown or mixed SQL names rejected', () => {
  assert.throws(() => materialTablePlan([actual[0], names[1], names[2]]));
});
test('0007 partial canonical tables and legacy duplicate tables are not accepted', () => {
  const plan = materialTablePlan(names);
  assert.equal(classify(plan.names, [relation(actual[0])], pattern).status, 'PARTIAL');
  assert.equal(classify(plan.names, [...actual, ...names].map(n => relation(n)), pattern).status, 'CONFLICT');
  assert.equal(classify(plan.names, names.map(n => relation(n)), pattern).status, 'CONFLICT');
  assert.equal(classify(plan.names, [], pattern).status, 'PENDING');
});
