import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const base = "src/features/qc_product_weight_check/qc_product_weight_check_";
const code = read(base + "domain.tsx");
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const domain = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const makeDoc = () => ({ ...domain.blankQcWeightEntryDocument("row-1"), doc_no: "QC-PAIR-TEST", product_name: "Test product" });
const spans = (rows) => rows.map((_, index) => domain.qcWeightTimeSpan(rows, index));

test("new UI draft has two rows, API template remains one row", () => {
  assert.equal(domain.blankQcWeightDocument("template").rows.length, 1);
  const doc = makeDoc();
  assert.equal(doc.rows.length, 2);
  assert.equal(new Set(doc.rows.map(row => row.id)).size, 2);
  assert.deepEqual(spans(doc.rows), [2, 0]);
  assert.deepEqual(domain.blankQcWeightEntryDocument("row-1"), domain.blankQcWeightEntryDocument("row-1"));
});

test("one time selection updates both readings and preserves other pairs and measurements", () => {
  const doc = makeDoc();
  doc.rows = domain.appendQcWeightRound(doc.rows, "row-3", "row-4");
  doc.rows[0].measurements.group_1[0] = "0.005";
  doc.rows[1].measurements.group_1[0] = "0.006";
  doc.rows[1].average = "0.006";
  doc.rows[1].result = "PASS";
  const next = domain.updateQcWeightRoundTime(doc, 0, "10:15");
  assert.deepEqual(next.rows.map(row => row.time), ["10:15", "10:15", "", ""]);
  assert.deepEqual(doc.rows.map(row => row.time), ["", "", "", ""]);
  assert.deepEqual(next.rows.map(({time, ...row}) => row), doc.rows.map(({time, ...row}) => row));
  assert.deepEqual(spans(next.rows), [2, 0, 2, 0]);
  const cleared = domain.updateQcWeightRoundTime(next, 0, "");
  assert.deepEqual(cleared.rows.map(row => row.time), ["", "", "", ""]);
});

test("legacy distinct times and odd row counts are not overwritten", () => {
  const doc = makeDoc();
  doc.rows[0].time = "10:32";
  doc.rows[1].time = "11:49";
  assert.deepEqual(spans(doc.rows), [1, 1]);
  const next = domain.updateQcWeightRoundTime(doc, 0, "10:45");
  assert.deepEqual(next.rows.map(row => row.time), ["10:45", "11:49"]);
  const matched = domain.updateQcWeightRoundTime(next, 1, "10:45");
  assert.deepEqual(spans(matched.rows), [2, 0]);
  const odd = [doc.rows[0]];
  assert.deepEqual(spans(odd), [1]);
  const completed = domain.appendQcWeightRound(odd, "added", "unused");
  assert.deepEqual(completed.map(row => row.time), ["10:32", "10:32"]);
  assert.deepEqual(spans(completed), [2, 0]);
  assert.equal(odd.length, 1);
  assert.equal(domain.updateQcWeightRoundTime(doc, -1, "10:00"), doc);
});

test("four rows survive save and JSON round trip; API validation still accepts legacy times", () => {
  const doc = makeDoc();
  doc.rows = domain.appendQcWeightRound(doc.rows, "row-3", "row-4");
  const next = domain.updateQcWeightRoundTime(doc, 2, "23:45");
  const saved = domain.saveQcWeightDocument([], next, "saved-1", "2026-11-28T03:00:00.000Z").saved;
  assert.deepEqual(JSON.parse(JSON.stringify(saved)).rows, next.rows);
  assert.deepEqual(domain.validateQcWeightDocument(saved), {});
});

test("UI groups only display rows, preserves twenty columns and uses the shared picker", () => {
  const form = read(base + "form.tsx");
  const workspace = read(base + "workspace.tsx");
  assert.ok(form.includes("rowIndex > 0 && rowIndex % 2 === 0"));
  assert.ok(form.includes("colSpan={20}"));
  assert.ok(form.includes("colSpan={5}"));
  assert.ok(form.includes("colSpan={3}"));
  assert.ok(form.includes("QC_WEIGHT_GROUP_KEYS.slice(1).flatMap"));
  assert.ok(form.includes("rowSpan={timeSpan}"));
  assert.ok(form.includes("timeSpan !== 0"));
  assert.ok(form.includes("className={headerClass}"));
  assert.ok(form.includes("appendQcWeightRound("));
  assert.ok(form.includes("updateQcWeightRoundTime(document, rowIndex, value)"));
  assert.ok(workspace.includes("blankQcWeightEntryDocument(rowId)"));
  assert.equal((form.match(/<ThaiTime15Picker\b/g) ?? []).length, 3);
  assert.deepEqual(ts.createSourceFile("form.tsx", form, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics, []);
});
