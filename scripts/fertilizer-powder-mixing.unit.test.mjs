import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const domainUrl = url(
  compile(read("src/features/fertilizer-powder-mixing/mixing-domain.ts")),
);
const d = await import(domainUrl);
const fixtures = await import(
  url(
    compile(read("src/lib/mock-data/fertilizer-powder-mixing.ts")).replace(
      /from ["']@\/src\/features\/fertilizer-powder-mixing\/mixing-domain["']/,
      `from "${domainUrl}"`,
    ),
  )
);
const print = await import(
  url(compile(read("src/features/fertilizer-powder-mixing/mixing-print.ts")))
);
const state = () => structuredClone(fixtures.demoMixingReports);
const catalog = fixtures.mixingCatalog;
const at = "2026-10-16T08:00:00Z";
const draft = () => ({
  ...structuredClone(state()[0]),
  id: "",
  doc_no: "MIX-NEW-DEMO",
});

test("every mixing TypeScript/TSX source parses without syntax errors", () => {
  const folder = "src/features/fertilizer-powder-mixing";
  for (const file of readdirSync(new URL(`../${folder}`, import.meta.url))) {
    if (!/\.tsx?$/.test(file)) continue;
    const result = ts.transpileModule(read(`${folder}/${file}`), {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
    });
    assert.equal((result.diagnostics ?? []).length, 0, file);
  }
});

test("create and update are immutable, preserve identity and metadata, never consume catalog stock", () => {
  const records = state();
  const before = structuredClone(records);
  const stock = structuredClone(catalog);
  const row = draft();
  row.materials[0].stock_balance = -999;
  const created = d.saveReport(records, row, "new-id", at, catalog);
  assert.equal(created.length, records.length + 1);
  assert.equal(created[0].id, "new-id");
  assert.equal(created[0].created_at, at);
  assert.equal(created[0].materials[0].stock_balance, catalog[0].stock_balance);
  const edited = d.saveReport(
    created,
    { ...created[0], lot_no: "EDITED-DEMO" },
    "unused",
    "2026-10-17T08:00:00Z",
    catalog,
  );
  assert.equal(edited.length, created.length);
  assert.equal(edited[0].created_at, at);
  assert.equal(edited[0].lot_no, "EDITED-DEMO");
  assert.deepEqual(records, before);
  assert.deepEqual(catalog, stock);
  row.materials[0].order_qty = 999;
  assert.notEqual(created[0].materials[0].order_qty, 999);
});
test("normalized document uniqueness and stale or duplicate identities are rejected", () => {
  const records = state();
  const before = structuredClone(records);
  assert.throws(
    () =>
      d.saveReport(
        records,
        { ...draft(), doc_no: ` ${records[0].doc_no.toLowerCase()} ` },
        "new",
        at,
        catalog,
      ),
    /ซ้ำ/,
  );
  assert.throws(
    () =>
      d.saveReport(records, { ...draft(), id: "deleted" }, "new", at, catalog),
    /ไม่พบ/,
  );
  assert.throws(
    () => d.saveReport(records, draft(), records[0].id, at, catalog),
    /ซ้ำ/,
  );
  assert.deepEqual(records, before);
});
test("required headers, calendar dates, optional positive finite duration and signer date", () => {
  const row = draft();
  assert.equal(d.validDate("2026-02-30"), false);
  assert.equal(d.validDate("2028-02-29"), true);
  assert.equal(d.validDate("oops"), false);
  for (const key of [
    "report_date",
    "doc_no",
    "fertilizer",
    "lot_no",
    "shift",
    "location",
    "loader_no",
  ]) {
    assert.ok(d.validateReport({ ...row, [key]: "" }, [], catalog)[key], key);
  }
  for (const value of [0, -1, NaN, Infinity])
    assert.ok(
      d.validateReport({ ...row, mix_duration: value }, [], catalog)
        .mix_duration,
    );
  assert.equal(
    d.validateReport({ ...row, mix_duration: null }, [], catalog).mix_duration,
    undefined,
  );
  assert.ok(
    d.validateReport({ ...row, inspector_date: "invalid" }, [], catalog)
      .inspector_date,
  );
});
test("materials require a valid catalog reference and finite positive planned quantities", () => {
  const row = draft();
  assert.ok(d.validateReport({ ...row, materials: [] }, [], catalog).materials);
  for (const quantity of [0, -1, NaN, Infinity]) {
    const invalid = structuredClone(row);
    invalid.materials[0].order_qty = quantity;
    assert.ok(d.validateReport(invalid, [], catalog)["materials.0.order_qty"]);
  }
  const missing = structuredClone(row);
  missing.materials[0].material_code = "MISSING";
  assert.ok(
    d.validateReport(missing, [], catalog)["materials.0.material_code"],
  );
  const unit = structuredClone(row);
  unit.materials[0].unit = "invented";
  assert.ok(d.validateReport(unit, [], catalog)["materials.0.material_code"]);
  const duplicate = structuredClone(row);
  duplicate.materials.push(duplicate.materials[0]);
  assert.ok(d.validateReport(duplicate, [], catalog).materials);
});
test("round validation preserves one Boolean result, allows pending, validates date/count/people", () => {
  const row = draft();
  assert.ok(
    d.validateReport({ ...row, mix_rounds: [] }, [], catalog).mix_rounds,
  );
  for (const field of [
    "round_date",
    "shift",
    "loader_load_count",
    "operator_mixer",
    "supervisor",
  ]) {
    const invalid = structuredClone(row);
    invalid.mix_rounds[0][field] = "";
    assert.ok(d.validateReport(invalid, [], catalog)[`rounds.0.${field}`]);
  }
  for (const value of ["-1", "0", "Infinity", "not-a-count"]) {
    const invalid = structuredClone(row);
    invalid.mix_rounds[0].loader_load_count = value;
    assert.ok(
      d.validateReport(invalid, [], catalog)["rounds.0.loader_load_count"],
    );
  }
  for (const value of ["ครบ", "ไม่ครบ", "4"]) {
    const valid = structuredClone(row);
    valid.mix_rounds[0].loader_load_count = value;
    valid.mix_rounds[0].is_pass = null;
    assert.deepEqual(d.validateReport(valid, [], catalog), {});
  }
  const invalid = structuredClone(row);
  invalid.mix_rounds[0].is_pass = "pass";
  assert.ok(d.validateReport(invalid, [], catalog)["rounds.0.is_pass"]);
});
test("summaries distinguish all-pass, failed rounds and incomplete data without document approval", () => {
  const rows = state();
  assert.equal(d.summarizeReport(rows[0]).allPass, true);
  assert.equal(d.summarizeReport(rows[1]).failed, 1);
  assert.equal(d.summarizeReport(rows[2]).pending, 1);
  assert.equal(
    d.summarizeReport({ ...rows[0], mix_rounds: [] }).allPass,
    false,
  );
  assert.equal("status" in rows[1], false);
});
test("copy creates a unique independent report with pending results and no inherited signatures", () => {
  const records = state();
  const first = d.copyReport(records, records[0].id, "copy-1", at, catalog);
  const second = d.copyReport(first, records[0].id, "copy-2", at, catalog);
  assert.notEqual(second[0].doc_no, second[1].doc_no);
  assert.equal(second[0].inspector, "");
  assert.equal(second[0].production, "");
  assert.equal(second[0].factory_qa, "");
  assert.ok(second[0].mix_rounds.every((r) => r.is_pass === null));
  assert.equal(records[0].mix_rounds[0].is_pass, true);
  assert.throws(
    () => d.copyReport(records, "missing", "new", at, catalog),
    /ไม่พบ/,
  );
});
test("delete removes only the requested report and rejects stale references", () => {
  const records = state();
  const next = d.deleteReport(records, records[0].id);
  assert.equal(next.length, records.length - 1);
  assert.deepEqual(next, records.slice(1));
  assert.throws(() => d.deleteReport(next, records[0].id), /ไม่พบ/);
});
test("search, dates, shift and inspection summary filters combine", () => {
  const records = state();
  assert.equal(
    d.filterReports(records, { ...d.emptyFilters, search: "no such report" })
      .length,
    0,
  );
  assert.deepEqual(
    d.filterReports(records, {
      ...d.emptyFilters,
      search: records[0].doc_no.toLowerCase(),
      from: "2026-10-16",
      to: "2026-10-16",
      shift: "เช้า",
      result: "pass",
    }),
    [records[0]],
  );
  assert.equal(
    d.filterReports(records, { ...d.emptyFilters, result: "review" }).length,
    2,
  );
});
test("import previews real validation; only confirmed sample rows update state atomically", () => {
  const records = state();
  const samples = fixtures.mixingImportSamples();
  assert.deepEqual(
    d.previewImport(samples, records, catalog).map((p) => p.valid),
    [true, false, false],
  );
  const next = d.importReports(
    records,
    [samples[0]],
    ["import-1"],
    at,
    catalog,
  );
  assert.equal(next.length, records.length + 1);
  assert.equal(next[0].doc_no, samples[0].doc_no);
  assert.equal(d.previewImport(samples, next, catalog)[0].valid, false);
  const before = structuredClone(records);
  assert.throws(
    () => d.importReports(records, samples, ["i1", "i2", "i3"], at, catalog),
    /ซ้ำ/,
  );
  assert.deepEqual(records, before);
  assert.throws(() => d.importReports(records, [], [], at, catalog), /เลือก/);
  assert.throws(
    () => d.importReports(records, [samples[0]], [], at, catalog),
    /ไม่ครบ/,
  );
});
test("print HTML escapes every report/brand string and excludes executable or external logo sources", () => {
  const row = draft();
  row.doc_no = '<script>alert("x")</script>';
  row.materials[0].material_name = '<img src=x onerror="bad">';
  row.mix_rounds[0].supervisor = "</td><script>bad</script>";
  const html = print.buildMixingPrintHtml([row], {
    factoryName: "<svg onload=bad>",
    logoDataUrl: 'https://example.invalid/logo.png" onerror="bad',
  });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.includes("&lt;svg"));
  assert.doesNotMatch(html, /<script|<svg|src="https:/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /size:A4 portrait/);
  assert.match(html, /ผู้ตรวจสอบคุณภาพ/);
  assert.match(html, /ผลตรวจ 6 จุด/);
});
test("route and sole stable layout provider preserve existing provider order and shadcn patterns", () => {
  const layout = read("app/(factory)/layout.tsx");
  const route = read("app/(factory)/fertilizer-powder-mixing/page.tsx");
  assert.match(route, /<MixingList\s*\/>/);
  assert.doesNotMatch(route, /MixingProvider/);
  assert.equal((layout.match(/<MixingProvider>/g) ?? []).length, 1);
  assert.match(
    layout,
    /<MixingProvider>\s*<DemoProvider>\s*<PRProvider>\s*<BOMProvider>/,
  );
  const nav = read("src/lib/constants/navigation.ts");
  assert.match(
    nav,
    /title: "รายงานผสมปุ๋ยผง",\s*href: "\/fertilizer-powder-mixing"/,
  );
  const list = read("src/features/fertilizer-powder-mixing/mixing-list.tsx");
  for (const token of [
    "FactoryDataTable",
    "Pagination",
    "Checkbox",
    "DialogHeader",
    "DialogFooter",
    'form="mixing-editor"',
    "overflow-y-auto",
    "MixingPrintPreview",
    "MixingExportPreview",
  ])
    assert.ok(list.includes(token), token);
  const provider = read(
    "src/features/fertilizer-powder-mixing/mixing-provider.tsx",
  );
  assert.match(provider, /structuredClone\(demoMixingReports\)/);
  assert.match(provider, /current\.current = next/);
  for (const file of [
    "mixing-provider.tsx",
    "mixing-domain.ts",
    "mixing-list.tsx",
    "mixing-import-preview.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/fertilizer-powder-mixing/${file}`),
      /fetch\(|localStorage|sessionStorage/,
    );
});
