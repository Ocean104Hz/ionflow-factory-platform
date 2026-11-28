import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const base = new URL("../src/features/qc_product_weight_check/", import.meta.url);
const source = Object.fromEntries(["workspace", "form", "history", "detail", "domain", "paper"].map((name) => [name, readFileSync(new URL("qc_product_weight_check_" + name + ".tsx", base), "utf8")]));
const compiled = ts.transpileModule(source.domain, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const domain = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));

test("QC weight files parse as TSX", () => {
  for (const [name, code] of Object.entries(source)) {
    assert.deepEqual(ts.createSourceFile(name + ".tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics, [], name);
  }
});

test("all existing document form fields are retained", () => {
  const expected = ["doc_date", "product_name", "lot_no", "pack_size", "pack_count", "weight_spec", "prepared_by", "prepared_date", "checked_by", "checked_date"];
  const actual = [...source.form.matchAll(/headerField\(\s*"([a-z_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(actual.sort(), expected.sort());
  assert.match(source.form, /value=\{document\.remark\}/);
  assert.match(source.form, /updateHeader\(\s*"remark",\s*event\s*\.\s*currentTarget\s*\.\s*value\s*,?\s*\)/);
  assert.match(source.form, /doc_no:\s*document\.doc_no\.trim\(\)\s*\|\|/);
  assert.match(source.form, /\[field\]: value/);
});

test("each round retains sixteen editable readings, time, automatic average and manual result", () => {
  assert.equal(domain.QC_WEIGHT_GROUP_KEYS.length, 4);
  assert.equal(domain.QC_WEIGHT_READING_INDEXES.length, 4);

  const row = domain.blankQcWeightRow("row-1");

  for (const group of domain.QC_WEIGHT_GROUP_KEYS) {
    assert.equal(row.measurements[group].length, 4);

    for (const index of domain.QC_WEIGHT_READING_INDEXES) {
      const next = domain.updateQcWeightReading(
        row, group, index, "0.005",
      );

      assert.equal(next.measurements[group][index], "0.005");
      assert.equal(row.measurements[group][index], "");
      assert.equal(next.average, "0.005");
      assert.equal(row.average, "");
    }
  }

  assert.match(source.form, /QC_WEIGHT_GROUP_KEYS\.flatMap\(\s*\(group,\s*groupIndex\)/);
  assert.match(source.form, /value=\{\s*row\s*\.\s*measurements\[\s*group\s*\]\[\s*index\s*\]\s*\}/);
  assert.match(source.form, /updateReading\(\s*row\.id,\s*group,\s*index,\s*event\s*\.\s*currentTarget\s*\.\s*value/);

  const averageInput = source.form.match(
    /<Input\b[^>]*\bvalue=\{\s*row\.average\s*\}[^>]*\/>/,
  )?.[0];

  assert.ok(averageInput);
  assert.match(averageInput, /\breadOnly\b/);
  assert.doesNotMatch(averageInput, /\bonChange\s*=/);

  assert.match(source.form, /QC_WEIGHT_RESULT_OPTIONS\.map/);
  assert.match(source.form, /updateRow\(row\.id,\s*\{\s*result,/);
  assert.equal([...source.form.matchAll(/onClick=\{addRow\}/g)].length, 1);
  assert.match(source.form, /onClick=\{\s*\(\)\s*=>\s*removeRow\(\s*row\.id\s*,?\s*\)\s*\}/);
  assert.doesNotMatch(source.form, /\bonReset\b/);
  assert.doesNotMatch(source.workspace, /onReset=\{handleNew\}/);
  assert.match(source.form, /onSave\(\)/);
});

test("shared Thai date and time components write the original fields", () => {
  assert.match(source.form, /options\?\.type === "date"/);
  assert.match(source.form, /<ThaiBuddhistDatePicker[\s\S]*?value=\{document\[field\]\}[\s\S]*?onChange=\{\s*\(value\)\s*=>\s*updateHeader\(\s*field,\s*value\s*,?\s*\)\s*\}/);
  assert.equal([...source.form.matchAll(/type: "date"/g)].length, 3);
  assert.match(source.form, /<ThaiTime15Picker[\s\S]*?value=\{row\.time\}[\s\S]*?onChange=\{\s*\(value\)\s*=>\s*updateRow\(\s*row\.id,\s*\{\s*time:\s*value\s*,?\s*\}\s*,?\s*\)\s*\}/);
  assert.doesNotMatch(source.form, /type="time"/);
  assert.match(source.history, /value=\{draftFilters\.from\}/);
  assert.match(source.history, /value=\{draftFilters\.to\}/);
  assert.match(source.history, /from: value/);
  assert.match(source.history, /to: value/);
  const doc = domain.blankQcWeightDocument("row-1");
  doc.doc_no = "QC-W-TEST";
  doc.product_name = "Test product";
  doc.rows[0].time = "23:59";
  assert.deepEqual(domain.validateQcWeightDocument(doc), {});
  doc.rows[0].time = "24:00";
  assert.ok(domain.validateQcWeightDocument(doc)["rows.0.time"]);
  doc.rows[0].time = "";
  assert.deepEqual(domain.validateQcWeightDocument(doc), {});
});

test("opt-in theme, form-first tabs and live document actions are preserved", () => {
  assert.match(source.workspace, /factory-itech-theme/);
  assert.match(source.workspace, /factory-itech-tabs/);
  assert.match(source.workspace, /useState<TabKey>\("form"\)/);
  assert.match(source.workspace, /<TabsContent value="form"/);
  assert.match(source.workspace, /<TabsContent value="history"/);
  assert.match(source.workspace, /useQcDocuments<QcProductWeightCheckDocument>\("qc_product_weight_check"\)/);
  assert.match(source.workspace, /validateQcWeightDocument\(draft, records\)/);
  assert.match(source.workspace, /await persist\(draft\)/);
  assert.match(source.workspace, /await remove\(deletedId\)/);
  assert.match(source.workspace, /hasUnsavedChanges/);
  assert.match(source.form, /factory-itech-form-table/);
  assert.match(source.history, /<RowActionMenu appearance="itech">/);
  for (const action of ["View", "Print", "Edit", "Delete"]) assert.ok(source.history.includes("on" + action + "(document)"));
  assert.match(source.history, /filterQcWeightDocuments\(/);
  assert.match(source.history, /paginateQcWeightDocuments\(/);
  assert.match(source.history, /<Pagination/);
  assert.match(source.detail, /factory-itech-theme/);
  assert.match(source.detail, /<QcProductWeightCheckPaper document=\{document\}/);
});

test("weight table keeps compact measurement columns within its own horizontal scroll area", () => {
  const groups = domain.QC_WEIGHT_GROUP_KEYS.length;
  const readings = domain.QC_WEIGHT_READING_INDEXES.length;

  assert.equal(groups * readings, 16);

  const colgroup = source.form.match(
    /<colgroup>([\s\S]*?)<\/colgroup>/,
  )?.[1];

  assert.ok(colgroup);

  const widths = [
    ...colgroup.matchAll(
      /className="w-(?:\[(\d+)px\]|(\d+(?:\.\d+)?))"/g,
    ),
  ].map((match) =>
    match[1] !== undefined
      ? Number(match[1])
      : Number(match[2]) * 4,
  );

  assert.deepEqual(widths, [180, 110, 120, 150, 80]);

  assert.match(
    colgroup,
    /QC_WEIGHT_GROUP_KEYS\.flatMap[\s\S]*?QC_WEIGHT_READING_INDEXES\.map[\s\S]*?className="w-(?:\[110px\]|27\.5)"/,
  );

  const totalWidth =
    widths[0] +
    groups * readings * widths[1] +
    widths[2] +
    widths[3] +
    widths[4];

  assert.equal(totalWidth, 2290);

  assert.match(
    source.form,
    /className="[^"\n]*\bw-\[2290px\][^"\n]*\bmin-w-\[2290px\][^"\n]*\btable-fixed\b/,
  );

  assert.match(
    source.form,
    /containerProps=\{\{\s*className:\s*"w-full min-w-0 max-w-full overflow-x-auto",\s*\}\}/,
  );

  assert.match(
    source.form,
    /className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border"/,
  );
});