import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const base = new URL("../src/features/qc_product_weight_check/", import.meta.url);
const read = (name) => readFileSync(new URL("qc_product_weight_check_" + name + ".tsx", base), "utf8");
const code = read("domain");
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const domain = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const makeDoc = () => ({ ...domain.blankQcWeightDocument("row-1"), doc_no: "QC-TIME-TEST", product_name: "Test product" });
const at = "2026-11-27T03:00:00.000Z";

test("three independent time ranges; machine setup has none", () => {
  const doc = makeDoc();
  assert.deepEqual(Object.keys(doc.group_times), ["group_2", "group_3", "group_4"]);
  assert.equal(domain.formatQcWeightGroupHeading(doc, "group_1"), "ตั้งค่าเครื่อง");
  for (const group of domain.QC_WEIGHT_TIMED_GROUP_KEYS) assert.deepEqual(doc.group_times[group], { start: "", end: "" });
  const next = domain.updateQcWeightGroupTime(doc, "group_2", "start", "10:32");
  assert.equal(next.group_times.group_2.start, "10:32");
  assert.equal(doc.group_times.group_2.start, "");
  assert.equal(next.group_times.group_3.start, "");
  assert.deepEqual(next.rows, doc.rows);
});

test("valid ranges, incomplete ranges, invalid clock and overnight", () => {
  const doc = makeDoc();
  assert.deepEqual(domain.validateQcWeightDocument(doc), {});
  doc.group_times.group_2.start = "10:32";
  assert.ok(domain.validateQcWeightDocument(doc)["group_times.group_2.end"]);
  doc.group_times.group_2.end = "11:49";
  doc.group_times.group_3.end = "24:00";
  assert.ok(domain.validateQcWeightDocument(doc)["group_times.group_3.end"]);
  assert.ok(domain.validateQcWeightDocument(doc)["group_times.group_3.start"]);
  doc.group_times.group_3 = { start: "23:50", end: "00:10" };
  assert.deepEqual(domain.validateQcWeightDocument(doc), {});
  assert.equal(domain.formatQcWeightGroupHeading(doc, "group_2"), "10:32 - 11:49");
});

test("save and edit retain all six time fields, measurements and results", () => {
  const doc = makeDoc();
  doc.group_times = { group_2: { start: "10:32", end: "11:49" }, group_3: { start: "12:00", end: "13:00" }, group_4: { start: "14:00", end: "15:00" } };
  doc.rows[0].measurements.group_4[3] = "0.005";
  doc.rows[0].average = "0.005";
  doc.rows[0].result = "PASS";
  const { saved } = domain.saveQcWeightDocument([], doc, "saved-1", at);
  const roundTrip = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(roundTrip.group_times, doc.group_times);
  assert.deepEqual(roundTrip.rows, doc.rows);
  const edited = domain.updateQcWeightGroupTime(roundTrip, "group_4", "end", "15:30");
  const updated = domain.saveQcWeightDocument([saved], edited, "unused", at).saved;
  assert.equal(updated.group_times.group_4.end, "15:30");
  assert.deepEqual(updated.group_times.group_2, doc.group_times.group_2);
  assert.deepEqual(updated.rows, saved.rows);
});

test("legacy JSONB and older clients preserve data; explicit invalid input is not defaulted", () => {
  const { group_times: omitted, ...old } = makeDoc();
  assert.deepEqual(domain.withQcWeightGroupTimes(old).group_times, domain.blankQcWeightGroupTimes());
  const previous = { ...old, group_times: { ...omitted, group_2: { start: "10:32", end: "11:49" } } };
  assert.deepEqual(domain.withQcWeightGroupTimes(old, previous).group_times, previous.group_times);
  assert.equal(domain.withQcWeightGroupTimes({ ...old, group_times: null }, previous).group_times, null);
  assert.deepEqual(domain.withQcWeightGroupTimes({ ...old, group_times: omitted }, previous).group_times, omitted);
});

test("form, detail, preview and API wire the group ranges without removing existing weight cells", () => {
  const form = read("form");
  for (const part of ["start", "end"]) {
    assert.ok(form.includes("value={document.group_times[group]." + part + "}"));
    assert.ok(form.includes('updateQcWeightGroupTime(document, group, "' + part + '", value)'));
  }
  assert.ok(form.includes("ตั้งค่าเครื่อง"));
  assert.match(form, /QC_WEIGHT_GROUP_KEYS\.flatMap[\s\S]*?QC_WEIGHT_READING_INDEXES\.map/);
  assert.match(form, /value=\{\s*row\.average\s*\}/);
  for (const name of ["detail", "paper"]) assert.ok(read(name).includes("formatQcWeightGroupHeading(document, group)"));
  const server = readFileSync(new URL("../src/server/qc-documents.ts", import.meta.url), "utf8");
  assert.ok(server.includes("weightDefinition.save(withQcWeightGroupTimes(raw, previous), records, at)"));
  assert.ok(server.includes('kind === "qc_product_weight_check" ? withQcWeightGroupTimes(row.payload)'));
  assert.ok(server.includes("JSON.stringify(saved)"));
  for (const [name, source] of [["form.tsx", form], ["domain.tsx", code], ["detail.tsx", read("detail")], ["paper.tsx", read("paper")], ["server.ts", server]]) {
    assert.deepEqual(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS).parseDiagnostics, [], name);
  }
});

test("group headers share a panel and the timed groups use two shared time pickers", () => {
  const form = read("form");
  const panel = form.match(/<div\s+className="mx-auto flex min-h-20 w-full items-center justify-center rounded-md bg-surface p-2 text-foreground">([\s\S]*?)<\/TableHead>/);
  assert.ok(panel, "one equal-size panel inside each mapped group header");
  assert.match(panel[1], /group\s*===\s*"group_1"\s*\?/);
  assert.ok(panel[1].includes("ตั้งค่าเครื่อง"));
  assert.equal((panel[1].match(/<ThaiTime15Picker\b/g) ?? []).length, 2);
  assert.match(form, /import\s+ThaiTime15Picker\s+from\s+"@\/src\/components\/ui\/thai-time-15-picker"/);
  for (const part of ["start", "end"]) {
    assert.ok(panel[1].includes("value={document.group_times[group]." + part + "}"));
    assert.ok(panel[1].includes('updateQcWeightGroupTime(document, group, "' + part + '", value)'));
  }
});
