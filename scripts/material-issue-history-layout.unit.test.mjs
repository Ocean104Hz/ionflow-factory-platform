import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/material-issues/material-issue-history.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("material-issue-history.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findElements(node, name) {
  const found = [];
  function walk(child) {
    if (ts.isJsxElement(child) && child.openingElement.tagName.getText(ast) === name) found.push(child);
    if (ts.isJsxSelfClosingElement(child) && child.tagName.getText(ast) === name) found.push(child);
    ts.forEachChild(child, walk);
  }
  walk(node);
  return found;
}
test("history uses one card for filters, page size and the original table", () => {
  assert.deepEqual(ast.parseDiagnostics, []);
  const cards = findElements(ast, "SectionCard");
  assert.equal(cards.length, 1);
  const card = cards[0];
  assert.match(card.openingElement.getText(ast), /title="ข้อมูลที่บันทึก"/);
  const forms = findElements(card, "form");
  assert.equal(forms.length, 1);
  const form = forms[0];
  assert.equal(findElements(form, "SelectField").length, 1);
  assert.equal(findElements(form, "ThaiBuddhistDatePicker").length, 2);
  assert.equal(findElements(card, "FactoryDataTable").length, 1);
  assert.equal(findElements(form, "FactoryDataTable").length, 0);
  assert.match(form.getText(ast), /xl:grid-cols-\[minmax\(0,1\.35fr\)_minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,\.65fr\)\]/);
});
test("search, date filtering, pagination and all existing table actions are retained", () => {
  assert.doesNotMatch(source, /handleSearch|handleClearFilters|setFilters/);
  assert.match(source, /filterMaterialIssueRecords\(records, draft\)/);
  assert.match(source, /const filteredRecords = error\s*\? \[\]/);
  assert.match(source, /draft\.dateFrom > draft\.dateTo/);
  for (const [field, value] of [["search", "event\\.target\\.value"], ["dateFrom", "value"], ["dateTo", "value"]]) {
    assert.match(source, new RegExp(field + ": " + value + ",\\s*\\}\\)\\);\\s*setPage\\(1\\);"));
  }
  const form = findElements(ast, "form")[0];
  assert.equal(findElements(form, "Button").length, 0);
  assert.match(source, /value=\{draft\.search\}/);
  assert.match(source, /value=\{draft\.dateFrom\}/);
  assert.match(source, /value=\{draft\.dateTo\}/);
  assert.match(source, /options=\{\[5, 10, 20\]\.map/);
  assert.match(source, /setPageSize\(Number\(value\)\)/);
  const table = findElements(ast, "FactoryDataTable")[0].getText(ast);
  assert.match(table, /variant="history"/);
  assert.match(table, /rows=\{visibleRecords\}/);
  assert.deepEqual([...table.matchAll(/key: "([^"]+)"/g)].map(match => match[1]), ["documentNo", "issueDate", "location", "productName", "quantity", "department", "requestedBy", "actions"]);
  assert.match(table, /onClick=\{\(\) => onView\(record\)\}/);
  assert.match(table, /onClick=\{\(\) => onEdit\(record\)\}/);
  assert.match(table, /onConfirm=\{\(\) => onDelete\(record\)\}/);
  assert.match(table, /<Pagination[\s\S]*?onChange=\{setPage\}/);
});
