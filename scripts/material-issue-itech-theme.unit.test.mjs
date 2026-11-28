import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const base = new URL("../src/features/material-issues/", import.meta.url);
const names = ["workspace", "header", "items", "history", "signers", "detail-modal", "product-picker-modal", "stock-picker-modal"];
const source = Object.fromEntries(names.map(name => [name, readFileSync(new URL("material-issue-" + name + ".tsx", base), "utf8")]));

test("material issue components parse as TSX", () => {
  for (const [name, code] of Object.entries(source)) {
    assert.deepEqual(ts.createSourceFile(name + ".tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics, [], name);
  }
});

test("iTech styles are opt-in on the workspace and its form/modal tables", () => {
  assert.match(source.workspace, /className="factory-itech-theme min-w-0 space-y-5"/);
  assert.match(source.workspace, /<TabsList[^>]*className="factory-itech-tabs"/);
  for (const name of ["items", "detail-modal", "product-picker-modal", "stock-picker-modal"]) {
    assert.match(source[name], /<Table className="factory-itech-form-table /, name);
  }
  assert.match(source.history, /<FactoryDataTable variant="history"/);
  assert.match(source.history, /<RowActionMenu appearance="itech" containsDialog>/);
  assert.equal((source.history.match(/className="factory-itech-date-filter min-w-0"/g) ?? []).length, 2);
  assert.match(source.header, /className="factory-itech-date-filter min-w-0"/);
});

test("tabs use form-first behavior and preserve the separate create and save actions", () => {
  assert.match(source.workspace, /useState\("form"\)/);
  assert.match(source.workspace, /<Tabs[^>]*value=\{tab\}/);
  assert.match(source.workspace, /<TabsTrigger value="form" disabled=\{saving\}/);
  assert.match(source.workspace, /<TabsTrigger value="history" disabled=\{saving\}/);
  assert.match(source.workspace, /<TabsContent value="form"/);
  assert.match(source.workspace, /<TabsContent value="history"/);
  assert.match(source.workspace, /onCancel=\{requestNewDocument\}/);
  assert.match(source.workspace, /onClick=\{handleSave\}/);
  assert.match(source.workspace, /open=\{pendingAction !== null\}/);
  assert.match(source.workspace, /onDocumentNoChange=\{/);
  assert.match(source.workspace, /onChange=\{handleItemChange\}/);
  assert.match(source.workspace, /onAdd=\{handleAddItem\}/);
  assert.match(source.workspace, /onRemove=\{handleRemoveItem\}/);
  assert.match(source.workspace, /onView=\{handleViewRecord\}/);
  assert.match(source.workspace, /onEdit=\{handleEditRecord\}/);
  assert.match(source.workspace, /onDelete=\{handleDeleteRecord\}/);
  assert.match(source.history, /onConfirm=\{\(\) => onDelete\(record\)\}/);
});
