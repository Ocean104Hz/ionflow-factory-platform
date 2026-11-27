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
    ...d.legacyReviewerFields,
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
    "legacyReviewerFields",
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
test("workspace opens form first, switches via capsule tabs and confirms reset", () => {
  const workspace = read(root + "nc-report-workspace.tsx");
  assert.match(workspace, /\[tab, setTab\] = useState\("form"\)/);
  assert.match(workspace, /<Tabs value=\{tab\} onValueChange=\{changeTab\} activationMode="manual"/);
  assert.match(workspace, /<TabsTrigger value="form" disabled=\{busy \|\| loading \|\| !!loadError\}/);
  assert.match(workspace, /<TabsTrigger value="history" disabled=\{busy \|\| loading \|\| !!loadError\}/);
  assert.match(workspace, /if \(value === "form" && tab !== "form"\) request\(blankNC\(\)\)/);
  assert.match(workspace, /else if \(value === "history"\) setTab\("history"\)/);
  assert.match(workspace, /if \(dirty\) setPending/);
  assert.match(workspace, /useQcDocuments<NCReport>\("nc_reports"\)/);
  assert.match(workspace, /await persist\(report\)/);
  assert.match(workspace, /await remove\(r.id\)/);
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

test("iCon-style NC form retains controlled fields and decisions, without a reset button", () => {
  const form = read(root + "nc-report-form.tsx");
  for (const group of ["headerFields", "productFields", "descriptionFields", "reviewerFields", "ncDecisions"])
    assert.ok(form.includes(`${group}.map`), group);
  assert.equal((form.match(/<NCFormCard\b/g) || []).length, 3);
  assert.match(form, /value: report\[key\]/);
  assert.match(form, /onChange\(\{ \.\.\.report, \[key\]: e\.target\.value \}\)/);
  assert.match(form, /if \(key === "doc_date" \|\| key === "production_date"\)/);
  assert.match(form, /<ThaiBuddhistDatePicker[\s\S]*?value=\{report\[key\]\}[\s\S]*?onChange=\{\(value\) => onChange\(\{ \.\.\.report, \[key\]: value \}\)\}[\s\S]*?error=\{error\}[\s\S]*?disabled=\{disabled\}/);
  assert.match(form, /inputMode=\{key === "quantity" \? "decimal" : undefined\}/);
  assert.match(form, /field\(k, l, false, true\)/);
  assert.match(form, /checked=\{report\.decisions\[key\]\}/);
  assert.match(form, /decisions: \{ \.\.\.report\.decisions, \[key\]: v === true \}/);
  assert.match(form, /onSave\(\)/);
  assert.doesNotMatch(form, /\bonReset\b/);
  assert.match(form, /onClick=\{onCancel\}/);
  assert.match(form, /aria-describedby=\{errors.decisions/);
  const workspace = read(root + "nc-report-workspace.tsx");
  assert.match(workspace, /if \(busy \|\| loading \|\| loadError\) return;/);
  assert.match(workspace, /const nextErrors = validateNC\(report, records\)/);
  assert.match(workspace, /onSave=\{save\}/);
  assert.doesNotMatch(workspace, /\bonReset\b/);
  assert.match(workspace, /onCancel=\{\(\) => request\(blankNC\(\)\)\}/);
  assert.match(workspace, /if \(pending\) open\(pending\)/);
});

test("reference NC layout preserves date values, text entry, decision labels and scoped header", () => {
  const form = read(root + "nc-report-form.tsx");
  for (const title of ["ส่วนหัวเอกสาร", "รายละเอียดข้อบกพร่อง", "รายชื่อผู้ลงนาม"])
    assert.ok(form.includes(`<NCFormCard title="${title}">`), title);
  assert.match(form, /placeholder: placeholders\[key\]/);
  assert.match(form, /onSelect=\{\(\) => onChange\(\{ \.\.\.report, \[key\]: value \}\)\}/);
  assert.match(form, /<Button type="submit"[\s\S]*?>\s*บันทึก\s*<\/Button>/);
  assert.match(form, /ไม่ใช่การลงนามหรือผลอนุมัติ QA/);
  const workspace = read(root + "nc-report-workspace.tsx");
  assert.doesNotMatch(workspace, /<PageHeader/);
  assert.match(workspace, /<NCReportForm[\s\S]*?disabled=\{busy \|\| loading \|\| !!loadError\}/);
  const shell = read("src/components/factory/app-shell.tsx");
  assert.match(shell, /standaloneTitle=\{pathname === "\/qc_raw_material" \|\| pathname === "\/nc-reports"\}/);
  assert.match(shell, /pathname === "\/nc-reports"\s*\? "รายงานข้อบกพร่อง"/);
});

test("iCon-style history keeps NC filters, all decisions, paging and confirmed actions", () => {
  const history = read(root + "nc-report-history.tsx");
  assert.match(history, /useState\(10\)/);
  assert.match(history, /filterNC\(records, filters\)/);
  assert.match(history, /paginateNC\(rows, page, size\)/);
  assert.match(history, /ncFilterError\(filters\)/);
  for (const key of ["search", "department", "from", "to"])
    assert.ok(history.includes(`updateFilter("${key}",`), key);
  assert.match(history, /setFilters\(\{ \.\.\.emptyNCFilters \}\)/);
  assert.equal((history.match(/<TableHead className=/g) || []).length, 6);
  assert.match(history, /ncDecisions\.filter\(\(\[k\]\) => r\.decisions\[k\]\)/);
  assert.match(history, /selected\.map\(\(\[k, label\]\)/);
  assert.match(history, /formatThaiDate\(r\.doc_date\)/);
  assert.match(history, /\[r\.product_name, r\.problem_defect\]/);
  assert.match(history, /\[r\.quantity, r\.unit\]/);
  for (const action of ["onView", "onPrint", "onEdit"])
    assert.ok(history.includes(`onSelect={() => ${action}(r)}`), action);
  assert.match(history, /setDeleteTarget\(r\)/);
  assert.match(history, /<AlertDialogAction onClick=\{\(\) => \{ if \(deleteTarget\) onDelete\(deleteTarget\)/);
  assert.equal((history.match(/onDelete\(deleteTarget\)/g) || []).length, 1);
  assert.match(history, /disabled=\{paged\.page <= 1\}/);
  assert.match(history, /disabled=\{paged\.page >= pages\}/);
  assert.match(history, /!paged\.rows\.length/);
});


test("NC signer order, payload compatibility and legacy preservation", () => {
  assert.deepEqual(d.reviewerFields, [
    ["discoverer_signer_name", "ผู้พบข้อบกพร่อง"],
    ["responsible_reviewer_name", "ผู้รับผิดชอบ/ผู้ทบทวน"],
    ["approver_name", "ผู้อนุมัติ"],
  ]);
  const { discoverer_signer_name, responsible_reviewer_name, ...legacy } = valid();
  assert.equal(discoverer_signer_name, "");
  assert.equal(responsible_reviewer_name, "");
  const before = JSON.stringify(legacy);
  const migrated = d.withNCSignerFields(legacy);
  assert.equal(migrated.discoverer_signer_name, "");
  assert.equal(migrated.responsible_reviewer_name, "");
  assert.equal(migrated.reviewer_name_1, legacy.reviewer_name_1);
  assert.equal(migrated.reviewer_name_2, legacy.reviewer_name_2);
  assert.equal(JSON.stringify(legacy), before);
  const names = { discoverer_signer_name: "ผู้พบ", responsible_reviewer_name: "ผู้รับผิดชอบ", approver_name: "ผู้อนุมัติ" };
  const created = d.saveNC([], { ...migrated, ...names }, "new").saved;
  const { discoverer_signer_name: a, responsible_reviewer_name: b, ...oldClient } = created;
  assert.equal(a, names.discoverer_signer_name);
  assert.equal(b, names.responsible_reviewer_name);
  const compatible = d.withNCSignerFields(oldClient, created);
  const edited = d.saveNC([created], compatible, "unused").saved;
  for (const [key, value] of Object.entries(names)) assert.equal(edited[key], value);
  assert.equal(edited.reviewer_name_2, legacy.reviewer_name_2);
  assert.equal(d.withNCSignerFields({ ...oldClient, responsible_reviewer_name: "" }, created).responsible_reviewer_name, "");
  assert.equal(d.withNCSignerFields({ ...oldClient, discoverer_signer_name: 123 }, created).discoverer_signer_name, 123);
  const server = read("src/server/qc-documents.ts");
  assert.match(server, /ncDefinition = define\("ใบ NC", blankNC\(\), validateNC, saveNC\)/);
  assert.match(server, /ncDefinition\.save\(withNCSignerFields\(raw, previous\), records, at\)/);
  assert.match(server, /kind === "nc_reports" \? withNCSignerFields\(row\.payload\) : row\.payload/);
  for (const path of ["nc-report-form.tsx", "nc-report-detail.tsx"]) {
    const content = read(root + path);
    assert.match(content, /reviewerFields\.map/);
    assert.match(content, /legacyReviewerFields\.some/);
    assert.match(content, /legacyReviewerFields\.map/);
  }
});

test("NC successful create and edit reset editor and switch to history; failed saves retain draft", async () => {
  // Exercise the actual save handler with deterministic persistence at its boundary.
  const workspace = read(root + "nc-report-workspace.tsx");
  const parsed = ts.createSourceFile("workspace.tsx", workspace, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "NCReportWorkspace");
  const handler = component?.body?.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "save");
  assert.ok(handler);
  const js = compile(handler.getText(parsed));
  async function run(draft, failure) {
    const state = { report: draft, baseline: JSON.stringify(draft), tab: "form", errors: {}, message: "", calls: 0 };
    const execute = new Function("report", "records", "validateNC", "blankNC", "persist", "setReport", "setBaseline", "setErrors", "setTab", "setMessage", `${js}\nreturn save();`);
    await execute(draft, [], () => ({}), d.blankNC, async () => {
      state.calls++;
      if (failure) throw new Error("DB unavailable");
      return { ...draft, id: draft.id || "saved" };
    }, v => { state.report = v; }, v => { state.baseline = v; }, v => { state.errors = v; }, v => { state.tab = v; }, v => { state.message = v; });
    return state;
  }
  for (const id of ["", "existing"]) {
    const draft = { ...valid(), id };
    const saved = await run(draft, false);
    assert.equal(saved.calls, 1);
    assert.deepEqual(saved.report, d.blankNC());
    assert.equal(saved.baseline, JSON.stringify(saved.report));
    assert.equal(saved.tab, "history");
    assert.equal(saved.message, "บันทึกเอกสารแล้ว");
    const failed = await run(draft, true);
    assert.equal(failed.calls, 1);
    assert.deepEqual(failed.report, draft);
    assert.equal(failed.baseline, JSON.stringify(draft));
    assert.equal(failed.tab, "form");
    assert.equal(failed.message, "DB unavailable");
  }
});

test("NC server parser persists new role keys and rejects invalid signer values", () => {
  const source = read("src/server/qc-documents.ts");
  const parsed = ts.createSourceFile("server.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = (name) => {
    const node = parsed.statements.find(n =>
      ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === name) ||
      (ts.isVariableStatement(n) && n.declarationList.declarations.some(v => v.name.getText(parsed) === name)));
    assert.ok(node, name);
    return node;
  };
  const kinds = declaration("qcKinds").declarationList.declarations[0].initializer;
  const nc = kinds.properties.find(p => p.name?.getText(parsed) === "nc_reports");
  assert.ok(nc);
  const isolated = ["QcError", "object", "parseFields", "define", "ncDefinition"]
    .map(name => declaration(name).getText(parsed).replace(/^export /, "")).join("\n") + `\nconst ncKind = { ${nc.getText(parsed)} }.nc_reports;`;
  const instantiate = new Function("blankNC", "validateNC", "saveNC", "withNCSignerFields", "randomUUID", `${compile(isolated)}\nreturn ncKind;`);
  const kind = instantiate(d.blankNC, d.validateNC, d.saveNC, d.withNCSignerFields, () => "new-uuid");
  const names = { discoverer_signer_name: "A", responsible_reviewer_name: "B", approver_name: "C" };
  const created = kind.save({ ...valid(), ...names }, [], "at");
  for (const [field, value] of Object.entries(names)) assert.equal(created[field], value);
  const { discoverer_signer_name, responsible_reviewer_name, ...oldClient } = created;
  const edited = kind.save(oldClient, [created], "at");
  assert.equal(edited.discoverer_signer_name, discoverer_signer_name);
  assert.equal(edited.responsible_reviewer_name, responsible_reviewer_name);
  assert.equal(edited.reviewer_name_1, created.reviewer_name_1);
  assert.throws(() => kind.save({ ...created, discoverer_signer_name: 123 }, [created], "at"), { status: 400 });
  assert.throws(() => kind.save({ ...created, responsible_reviewer_name: "x".repeat(10001) }, [created], "at"), { status: 400 });
});
