import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const mode = process.argv[2];
if (!['--check', '--apply'].includes(mode)) throw new Error('Use --check or --apply');
const base = 'src/features/qc_product_weight_check/qc_product_weight_check_';
const paths = { domain: base + 'domain.tsx', form: base + 'form.tsx', workspace: base + 'workspace.tsx', formTest: 'scripts/qc-product-weight-check.form.test.mjs', timeTest: 'scripts/qc-product-weight-time15.unit.test.mjs', groupTest: 'scripts/qc-product-weight-group-times.unit.test.mjs', pairTest: 'scripts/qc-product-weight-round-pairs.unit.test.mjs' };
const files = Object.fromEntries(Object.entries(paths).filter(([key]) => key !== 'pairTest').map(([key, path]) => [key, readFileSync(resolve(path), 'utf8')]));
if (existsSync(paths.pairTest)) throw new Error('Pair test already exists; stop to avoid overwriting. No files written.');
const next = Object.fromEntries(Object.entries(files).map(([key, value]) => [key, value.replace(/\r\n/g, '\n')]));
function edit(key, before, after) {
  const count = next[key].split(before).length - 1;
  if (count !== 1) throw new Error(`${paths[key]}: expected exactly one match, found ${count}: ${before.slice(0,100)}. No files written.`);
  next[key] = next[key].replace(before, () => after);
}
function lineEdit(key, predicate, replacement) {
  const lines = next[key].split('\n');
  const found = lines.filter(predicate);
  if (found.length !== 1) throw new Error(`${paths[key]}: expected one test assertion, found ${found.length}. No files written.`);
  edit(key, found[0], replacement);
}
const helper = `// A new form displays two readings, but the API template must retain one row.
export function blankQcWeightPair(rowId: string): QcProductWeightCheckRow[] {
  return [blankQcWeightRow(rowId), blankQcWeightRow(\u0060\u0024{rowId}-second\u0060)];
}

export function blankQcWeightEntryDocument(rowId: string): QcProductWeightCheckDocument {
  return { ...blankQcWeightDocument(rowId), rows: blankQcWeightPair(rowId) };
}

// Positional pairs. Do not hide or overwrite different times in older documents.
export function qcWeightTimeSpan(
  rows: readonly QcProductWeightCheckRow[],
  index: number,
): 0 | 1 | 2 {
  if (!Number.isInteger(index) || index < 0 || index >= rows.length) return 0;
  const firstIndex = index - (index % 2);
  const first = rows[firstIndex];
  const second = rows[firstIndex + 1];
  if (!second || first.time !== second.time) return 1;
  return index === firstIndex ? 2 : 0;
}

export function updateQcWeightRoundTime(
  document: QcProductWeightCheckDocument,
  index: number,
  value: string,
): QcProductWeightCheckDocument {
  if (!Number.isInteger(index) || index < 0 || index >= document.rows.length) return document;
  const span = qcWeightTimeSpan(document.rows, index);
  const first = span === 0 ? index - 1 : index;
  const count = span === 1 ? 1 : 2;
  return {
    ...document,
    rows: document.rows.map((row, rowIndex) =>
      rowIndex >= first && rowIndex < first + count ? { ...row, time: value } : row,
    ),
  };
}

export function appendQcWeightRound(
  rows: readonly QcProductWeightCheckRow[],
  firstId: string,
  secondId: string,
): QcProductWeightCheckRow[] {
  // An incomplete last pair can be completed without changing existing data.
  if (rows.length % 2 === 1) {
    return [...rows, { ...blankQcWeightRow(firstId), time: rows[rows.length - 1].time }];
  }
  return [...rows, blankQcWeightRow(firstId), blankQcWeightRow(secondId)];
}

`;
edit('domain', '/* ---------------- update readings ---------------- */', helper + '/* ---------------- update readings ---------------- */');
if (!next.domain.includes('rows: [blankQcWeightRow(rowId)]')) throw new Error('API one-row template is not as expected. No files written.');
// The API template is deliberately untouched. Only the workspace creates the paired UI draft.
const workspaceMatches = next.workspace.match(/\bblankQcWeightDocument\b/g) ?? [];
if (workspaceMatches.length !== 3) throw new Error('Unexpected workspace draft creation sites. No files written.');
next.workspace = next.workspace.replace(/\bblankQcWeightDocument\b/g, 'blankQcWeightEntryDocument');
edit('form', 'import { Plus, Trash2 } from "lucide-react";', 'import { Fragment } from "react";\nimport { Plus, Trash2 } from "lucide-react";');
edit('form', '  blankQcWeightRow,', '  blankQcWeightPair,\n  appendQcWeightRound,\n  qcWeightTimeSpan,\n  updateQcWeightRoundTime,');
edit('form', `      rows: [
        ...document.rows,
        blankQcWeightRow(crypto.randomUUID()),
      ],`, `      rows: appendQcWeightRound(
        document.rows,
        crypto.randomUUID(),
        crypto.randomUUID(),
      ),`);
edit('form', `          : [
            blankQcWeightRow(
              crypto.randomUUID(),
            ),
          ],`, `          : blankQcWeightPair(crypto.randomUUID()),`);
edit('form', `                    const timeError =
                      errors[
                      \u0060rows.\u0024{rowIndex}.time\u0060
                      ];`, `                    const timeSpan = qcWeightTimeSpan(document.rows, rowIndex);
                    const timeError =
                      errors[\u0060rows.\u0024{rowIndex}.time\u0060] ||
                      (timeSpan === 2 ? errors[\u0060rows.\u0024{rowIndex + 1}.time\u0060] : undefined);`);
edit('form', `                      <TableRow key={row.id}>
                        {/* Time */}

                        <TableCell
                          className={cellClass}
                        >
                          <ThaiTime15Picker
                            label={\u0060เวลารอบตรวจที่ \u0024{rowIndex + 1}\u0060}
                            value={row.time}
                            onChange={(value) =>
                              updateRow(row.id, {
                                time: value,
                              })
                            }
                            error={timeError}
                            allowEmpty
                          />
                        </TableCell>`, `                      <Fragment key={row.id}>
                        {rowIndex > 0 && rowIndex % 2 === 0 && (
                          <>
                            <TableRow aria-hidden="true">
                              <TableCell colSpan={20} className="h-8 border border-border bg-surface p-0" />
                            </TableRow>
                            <TableRow aria-hidden="true">
                              <TableCell colSpan={5} className="border border-border bg-surface p-0" />
                              {QC_WEIGHT_GROUP_KEYS.slice(1).flatMap((group) =>
                                QC_WEIGHT_READING_INDEXES.map((index) => (
                                  <TableHead key={\u0060\u0024{group}-repeat-\u0024{index}\u0060} className={headerClass}>
                                    {index + 1}
                                  </TableHead>
                                )),
                              )}
                              <TableCell colSpan={3} className="border border-border bg-surface p-0" />
                            </TableRow>
                          </>
                        )}
                      <TableRow>
                        {/* One shared time for a compatible pair; legacy distinct times stay separate. */}
                        {timeSpan !== 0 && (
                          <TableCell rowSpan={timeSpan} className="border border-border p-2 align-middle whitespace-normal">
                            <ThaiTime15Picker
                              label={timeSpan === 2 ? \u0060เวลารอบตรวจที่ \u0024{rowIndex + 1}–\u0024{rowIndex + 2}\u0060 : \u0060เวลารอบตรวจที่ \u0024{rowIndex + 1}\u0060}
                              value={row.time}
                              onChange={(value) => onChange(updateQcWeightRoundTime(document, rowIndex, value))}
                              error={timeError}
                              allowEmpty
                            />
                          </TableCell>
                        )}`);
edit('form', `                      </TableRow>
                    );
                  },
                )}
              </TableBody>`, `                      </TableRow>
                      </Fragment>
                    );
                  },
                )}
              </TableBody>`);
// Preserve the approved navy header even if the previous UI tweak has not been applied.
const oldHeader = 'mx-auto flex min-h-20 w-full items-center justify-center rounded-md bg-surface p-2 text-foreground';
const newHeader = 'mx-auto flex min-h-20 w-full items-center justify-center bg-transparent p-2 text-white [&_[data-slot=select-trigger]]:bg-white [&_[data-slot=select-trigger]]:text-slate-900 [&_[role=alert]]:text-red-200';
if (next.form.includes(oldHeader)) edit('form', oldHeader, newHeader);
if (next.groupTest.includes(oldHeader)) edit('groupTest', oldHeader, 'mx-auto flex min-h-20 w-full items-center justify-center bg-transparent p-2 text-white[^\"]*');
const groupAssert = '  assert.ok(panel, "one equal-size panel inside each mapped group header");';
if (!next.groupTest.includes('select-trigger\\]\\]:bg-white')) edit('groupTest', groupAssert, groupAssert + '\n  assert.ok(panel[0].includes("[&_[data-slot=select-trigger]]:bg-white"));\n  assert.ok(panel[0].includes("[&_[data-slot=select-trigger]]:text-slate-900"));');
const timeAssertion = String.raw`  assert.match(source.form, /<ThaiTime15Picker[\s\S]*?value=\{row\.time\}[\s\S]*?onChange=\{\s*\(value\)\s*=>\s*onChange\(updateQcWeightRoundTime\(document,\s*rowIndex,\s*value\)\)\s*\}/);`;
lineEdit('formTest', line => line.includes('assert.match(source.form, /<ThaiTime15Picker') && line.includes('updateRow'), timeAssertion);
lineEdit('timeTest', line => line.includes('assert.match(form, /value=') && line.includes('updateRow'), String.raw`  assert.match(form, /value=\{row\.time\}[\s\S]*?updateQcWeightRoundTime\(document,\s*rowIndex,\s*value\)/);`);
next.pairTest = `import assert from "node:assert/strict";
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
  assert.equal((form.match(/<ThaiTime15Picker\\b/g) ?? []).length, 3);
  assert.deepEqual(ts.createSourceFile("form.tsx", form, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics, []);
});
`;
// All transformations complete before any write. Verify parser diagnostics for every changed source.
for (const [key, value] of Object.entries(next)) {
  const path = paths[key];
  const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JS;
  const parsed = ts.createSourceFile(path, value, ts.ScriptTarget.Latest, true, kind);
  if (parsed.parseDiagnostics.length) throw new Error(`${path}: ${parsed.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('; ')}. No files written.`);
}
const changes = Object.entries(next).filter(([key, value]) => !files[key] || files[key].replace(/\r\n/g, '\n') !== value);
for (const [key] of changes) console.log(`${mode === '--check' ? 'CHECK' : 'READY'}: ${paths[key]}`);
if (mode === '--apply') {
  for (const [key, value] of changes) writeFileSync(paths[key], files[key]?.includes('\r\n') ? value.replace(/\n/g, '\r\n') : value, 'utf8');
  console.log(`APPLIED: ${changes.length} files. No migration, commit, push or deployment.`);
} else console.log(`PASS: ${changes.length} files validated; no changes made.`);
