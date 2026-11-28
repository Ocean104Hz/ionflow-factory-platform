import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dataUrl = (source) => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
const timeUrl = dataUrl(compile(read("src/lib/date/thai-time.ts")));
const helperSource = read("src/lib/date/thai-time-15.ts");
const helper = await import(dataUrl(compile(helperSource).replace('"./thai-time"', JSON.stringify(timeUrl))));
const picker = read("src/components/ui/thai-time-15-picker.tsx");
const form = read("src/features/qc_product_weight_check/qc_product_weight_check_form.tsx");

test("quarter-hour options contain all 96 ordered slots", () => {
  const options = helper.getThaiTime15Options();
  assert.equal(options.length, 96);
  assert.equal(new Set(options).size, 96);
  assert.equal(options[0], "00:00");
  assert.equal(options.at(-1), "23:45");
  assert.deepEqual(options, [...options].sort());
  for (const [i, value] of options.entries()) {
    const [hour, minute] = value.split(":").map(Number);
    assert.equal(hour * 60 + minute, i * 15);
  }
});

test("preserve old off-grid values without rounding or duplicates", () => {
  const options = helper.getThaiTime15Options("10:32");
  assert.equal(options.length, 97);
  const index = options.indexOf("10:32");
  assert.equal(options[index - 1], "10:30");
  assert.equal(options[index + 1], "10:45");
  assert.equal(helper.getThaiTime15Options("23:59").at(-1), "23:59");
  for (const value of ["", "24:00", "10:60", "invalid", "08:15"]) {
    assert.equal(helper.getThaiTime15Options(value).length, 96);
  }
  assert.equal(helper.THAI_TIME_15_OPTIONS.length, 96);
});

test("single shared dropdown retains empty option, errors, and user-driven updates", () => {
  assert.equal((picker.match(/<Select\b/g) ?? []).length, 1);
  assert.equal((picker.match(/<SelectTrigger\b/g) ?? []).length, 1);
  assert.match(picker, /getThaiTime15Options\(value\)/);
  assert.match(picker, /if \(disabled\) return/);
  assert.match(picker, /next === EMPTY_OPTION && allowEmpty\) onChange\(""\)/);
  assert.match(picker, /else if \(options.includes\(next\)\) onChange\(next\)/);
  assert.match(picker, /aria-label=\{label\}/);
  assert.match(picker, /aria-invalid=\{Boolean\(error\)\}/);
  assert.doesNotMatch(picker, /useEffect/);
});

test("QC form uses the new picker for both range endpoints and row time", () => {
  assert.match(form, /import ThaiTime15Picker from "@\/src\/components\/ui\/thai-time-15-picker"/);
  assert.equal((form.match(/<ThaiTime15Picker\b/g) ?? []).length, 3);
  assert.doesNotMatch(form, /<ThaiTimePicker\b/);
  for (const part of ["start", "end"]) {
    assert.ok(form.includes("value={document.group_times[group]." + part + "}"));
    assert.ok(form.includes('updateQcWeightGroupTime(document, group, "' + part + '", value)'));
  }
  assert.match(form, /value=\{row\.time\}[\s\S]*?updateRow\(row\.id, \{\s*time: value/);
  assert.match(form, /value=\{row\.average\}[\s\S]*?readOnly/);
  assert.match(form, /w-\[2290px\] min-w-\[2290px\]/);
  for (const [name, source, kind] of [["helper.ts", helperSource, ts.ScriptKind.TS], ["picker.tsx", picker, ts.ScriptKind.TSX], ["form.tsx", form, ts.ScriptKind.TSX]]) {
    assert.deepEqual(ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind).parseDiagnostics, []);
  }
});
