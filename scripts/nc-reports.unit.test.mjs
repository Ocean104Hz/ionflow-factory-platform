import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
const root = "src/features/nc-reports/";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const compile = (text, fileName = "module.ts") =>
  ts.transpileModule(text, {
    fileName,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
const url = (text) =>
  `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const typesURL = url(compile(read(root + "nc-report-types.ts")));
const helpersURL = url(
  compile(read(root + "nc-report-mock-helpers.ts")).replace(
    /from ["']\.\/nc-report-types["']/g,
    `from "${typesURL}"`,
  ),
);
const t = await import(typesURL),
  d = await import(helpersURL);
const fixtures = (
  await import(
    url(
      compile(read("src/lib/mock-data/nc-reports.ts")).replace(
        /from ["']@\/src\/features\/nc-reports\/nc-report-mock-helpers["']/g,
        `from "${helpersURL}"`,
      ),
    )
  )
).demoNCReports;
const valid = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  doc_no: "NC-NEW",
});
function freeze(o) {
  if (o && typeof o === "object") {
    Object.freeze(o);
    Object.values(o).forEach(freeze);
  }
  return o;
}

test("NC source files satisfy scoped strict TypeScript and have no persistence/inventory dependencies", () => {
  const paths = [
    ...readdirSync(new URL(`../${root}`, import.meta.url)).map((f) => root + f),
    "src/lib/mock-data/nc-reports.ts",
    "app/(factory)/nc-reports/page.tsx",
  ];
  for (const path of paths) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /\bany\b|\bfetch\s*\(|localStorage|sessionStorage|dangerouslySetInnerHTML|from ["'][^"']*(?:inventory|firebase|\bpg\b)/,
      path,
    );
    assert.deepEqual(
      ts.transpileModule(source, {
        fileName: path,
        reportDiagnostics: true,
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX },
      }).diagnostics,
      [],
      path,
    );
  }
  const base = fileURLToPath(new URL("../", import.meta.url));
  const config = ts.parseJsonConfigFileContent(
    JSON.parse(read("tsconfig.json")),
    ts.sys,
    base,
  );
  const files = paths.map((p) =>
    fileURLToPath(new URL(`../${p}`, import.meta.url)),
  );
  const program = ts.createProgram(files, {
    ...config.options,
    noEmit: true,
    incremental: false,
  });
  const errors = files.flatMap((f) =>
    program.getSemanticDiagnostics(program.getSourceFile(f)),
  );
  assert.equal(
    errors.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => base,
      getCanonicalFileName: (f) => f,
      getNewLine: () => "\n",
    }),
  );
});
test("six fictional fixtures span dates, departments, quantities and decision combinations", () => {
  assert.equal(fixtures.length, 6);
  assert.equal(new Set(fixtures.map((r) => r.id)).size, 6);
  assert.equal(new Set(fixtures.map((r) => r.department)).size, 6);
  for (const r of fixtures) assert.deepEqual(d.validateNC(r, fixtures), {});
  assert.equal(fixtures[5].decisions.accept_concession, true);
  assert.equal(fixtures[5].decisions.rework, true);
});
test("empty form retains empty quantity and rejects every required field without inventing approval", () => {
  const empty = d.blankNC(),
    errors = d.validateNC(empty, []);
  assert.equal(empty.quantity, "");
  for (const [k] of [
    ...d.headerFields,
    ...d.productFields,
    ...d.descriptionFields,
  ])
    assert.ok(errors[k], k);
  assert.ok(errors.decisions);
  assert.equal(errors.approver_name, undefined);
  assert.equal(errors.reviewer_name_1, undefined);
  assert.equal("status" in empty, false);
});
test("calendar dates and positive finite decimal quantities are validated", () => {
  for (const date of [
    "",
    "2026-02-29",
    "2026-13-01",
    "not-date",
    "2026-02-31",
  ]) {
    const r = valid();
    r.doc_date = date;
    r.production_date = date;
    assert.ok(d.validateNC(r, []).doc_date);
    assert.ok(d.validateNC(r, []).production_date);
  }
  assert.equal(d.validNCDate("2028-02-29"), true);
  for (const qty of [
    "",
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e999",
    "text",
    "1,2",
  ]) {
    const r = valid();
    r.quantity = qty;
    assert.ok(d.validateNC(r, []).quantity, qty);
  }
  const r = valid();
  r.quantity = "25.500";
  assert.equal(d.saveNC([], r, "new").saved.quantity, "25.500");
});
test("all five independent decisions survive saves and edits; at least one is required", () => {
  const r = valid();
  for (const [k] of t.ncDecisions) r.decisions[k] = false;
  assert.ok(d.validateNC(r, []).decisions);
  for (const [k] of t.ncDecisions) {
    r.decisions[k] = true;
    assert.equal(d.saveNC([], r, "new").saved.decisions[k], true);
  }
  assert.deepEqual(Object.values(d.saveNC([], r, "new").saved.decisions), [
    true,
    true,
    true,
    true,
    true,
  ]);
});
test("duplicate normalized document numbers are rejected but editing the same record is allowed", () => {
  const r = valid();
  r.doc_no = ` ${fixtures[0].doc_no.toLowerCase()} `;
  assert.ok(d.validateNC(r, fixtures).doc_no);
  assert.throws(() => d.saveNC(fixtures, r, "new"));
  assert.deepEqual(d.validateNC(structuredClone(fixtures[0]), fixtures), {});
});
test("immutable save updates stable identity and failed operations never change source records", () => {
  const records = freeze(structuredClone(fixtures));
  const before = JSON.stringify(records),
    created = d.saveNC(records, valid(), "created");
  assert.equal(created.records.length, 7);
  const edit = {
    ...structuredClone(created.saved),
    countermeasure: "แก้ไขตัวอย่าง",
    approver_name: "ข้อความไม่ใช่อนุมัติ",
  };
  const updated = d.saveNC(created.records, edit, "unused");
  assert.equal(updated.saved.id, "created");
  assert.equal(updated.records.length, 7);
  assert.equal(updated.records[0].countermeasure, edit.countermeasure);
  assert.throws(
    () => d.saveNC(records, { ...valid(), id: "missing" }, "ignored"),
    /ไม่พบ/,
  );
  assert.throws(() => d.saveNC(records, valid(), records[0].id));
  assert.equal(JSON.stringify(records), before);
  assert.equal(d.deleteNC(records, "missing").length, records.length);
  assert.equal(d.deleteNC(records, records[0].id).length, 5);
});
test("history supports search, inclusive dates, department, no matches and invalid ranges", () => {
  for (const key of [
    "doc_no",
    "product_name",
    "discoverer",
    "department",
    "problem_defect",
  ])
    assert.ok(
      d
        .filterNC(fixtures, {
          ...d.emptyNCFilters,
          search: ` ${fixtures[0][key].toLowerCase()} `,
        })
        .some((r) => r.id === fixtures[0].id),
      key,
    );
  assert.equal(
    d.filterNC(fixtures, {
      ...d.emptyNCFilters,
      from: "2026-10-20",
      to: "2026-10-20",
      department: "ผลิต",
    }).length,
    1,
  );
  assert.equal(
    d.filterNC(fixtures, { ...d.emptyNCFilters, search: "no match" }).length,
    0,
  );
  assert.ok(
    d.ncFilterError({
      ...d.emptyNCFilters,
      from: "2026-10-20",
      to: "2026-10-01",
    }),
  );
});
test("pagination safely clamps after deleting the last row, including empty history", () => {
  assert.equal(d.paginateNC(fixtures, 2, 5).rows.length, 1);
  const reduced = d.deleteNC(fixtures, fixtures[5].id);
  assert.equal(d.paginateNC(reduced, 2, 5).page, 1);
  assert.deepEqual(d.paginateNC([], 99, 5), { page: 1, rows: [] });
});
test("detail and A4 preview share every original field and all selected/unselected decisions", () => {
  const fields = [
    ...d.headerFields,
    ...d.productFields,
    ...d.descriptionFields,
    ...d.reviewerFields,
  ].map(([k]) => k);
  assert.deepEqual(
    new Set(fields),
    new Set(
      Object.keys(d.blankNC()).filter((k) => !["id", "decisions"].includes(k)),
    ),
  );
  const content = read(root + "nc-report-detail.tsx"),
    preview = read(root + "nc-report-print-preview.tsx");
  for (const name of [
    "headerFields",
    "productFields",
    "descriptionFields",
    "reviewerFields",
    "ncDecisions",
  ])
    assert.ok(content.includes(`${name}.map`), name);
  assert.match(content, /checked=\{report\.decisions\[k\]\}/);
  assert.match(preview, /<NCReportContent report=\{report\}/);
  assert.match(preview, /width: "297mm"/);
  assert.match(preview, /minHeight: "210mm"/);
  assert.doesNotMatch(
    preview,
    /dangerouslySetInnerHTML|height: "148mm"|overflow: "hidden"/,
  );
  const r = valid();
  r.problem_defect = "ข้อความยาว <script>ไม่ใช่ HTML</script> ".repeat(200);
  assert.equal(
    d.ncFieldValue(d.saveNC([], r, "long").saved, "problem_defect"),
    r.problem_defect,
  );
});
test("workspace retains editor on tab changes, confirms reset and remains page-local without a Provider", () => {
  const workspace = read(root + "nc-report-workspace.tsx");
  assert.match(workspace, /onValueChange=\{setTab\}/);
  assert.match(workspace, /if \(dirty\) setPending/);
  assert.match(
    workspace,
    /useState\(\(\) => structuredClone\(demoNCReports\)\)/,
  );
  assert.doesNotMatch(read("app/(factory)/layout.tsx"), /NCReport|NCProvider/);
  assert.doesNotMatch(
    read(root + "nc-report-form.tsx"),
    /overflow-y-auto|max-h-|h-\[/,
  );
  const nav = read("src/lib/constants/navigation.ts");
  assert.equal((nav.match(/href: "\/nc-reports"/g) || []).length, 1);
  assert.match(
    nav,
    /group: "QC", title: "ใบ NC", href: "\/nc-reports", icon: ClipboardList/,
  );
});
