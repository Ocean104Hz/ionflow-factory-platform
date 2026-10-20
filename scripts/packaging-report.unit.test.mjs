import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
const root = "src/features/packaging-reports/",
  read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const url = (s) =>
  `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const profilesUrl = url(compile(read(root + "packaging-profiles.ts")));
const domainUrl = url(
  compile(read(root + "packaging-domain.ts")).replace(
    /from ["']\.\/packaging-profiles["']/g,
    `from "${profilesUrl}"`,
  ),
);
const p = await import(profilesUrl),
  d = await import(domainUrl);
const replace = (s) =>
  s
    .replace(
      /from ["'](?:\.\/|@\/src\/features\/packaging-reports\/)packaging-domain["']/g,
      `from "${domainUrl}"`,
    )
    .replace(
      /from ["'](?:\.\/|@\/src\/features\/packaging-reports\/)packaging-profiles["']/g,
      `from "${profilesUrl}"`,
    );
const fixtures = (
  await import(
    url(replace(compile(read("src/lib/mock-data/packaging-reports.ts"))))
  )
).demoPackagingReports;
const print = await import(
  url(replace(compile(read(root + "packaging-print.ts"))))
);
const clone = () => structuredClone(fixtures),
  draft = (profile = "ITECH") => d.newReport(profile),
  at = "2026-10-20T03:00:00Z";
const valid = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  documentNumber: "NEW-PACK",
});
function freeze(o) {
  if (o && typeof o === "object") {
    Object.freeze(o);
    Object.values(o).forEach(freeze);
  }
  return o;
}

test("new Packaging sources parse and satisfy scoped strict TypeScript without backend/inventory dependencies", () => {
  const files = readdirSync(new URL(`../${root}`, import.meta.url)).filter(
    (f) => /\.tsx?$/.test(f),
  );
  for (const file of files) {
    const source = read(root + file);
    assert.doesNotMatch(
      source,
      /\bany\b|\bfetch\s*\(|localStorage|sessionStorage|from ["'][^"']*(?:inventory|production-quality|purchase-requisitions|master-data|firebase|\bpg\b)/,
      file,
    );
    const result = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2017,
      },
    });
    assert.deepEqual(result.diagnostics, [], file);
  }
  const base = fileURLToPath(new URL("../", import.meta.url)),
    config = ts.parseJsonConfigFileContent(
      JSON.parse(read("tsconfig.json")),
      ts.sys,
      base,
    );
  const paths = [
    ...files.map((f) =>
      fileURLToPath(new URL(`../${root}${f}`, import.meta.url)),
    ),
    fileURLToPath(
      new URL("../src/lib/mock-data/packaging-reports.ts", import.meta.url),
    ),
  ];
  const program = ts.createProgram(paths, {
    ...config.options,
    noEmit: true,
    incremental: false,
  });
  const errors = paths.flatMap((f) =>
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
test("both factory fixtures validate and profile distinctions match actual legacy form", () => {
  assert.equal(p.packagingProfiles.ITECH.multiSet, false);
  assert.equal(p.packagingProfiles.IFOAM.multiSet, true);
  assert.equal(p.packagingProfiles.ITECH.signers.length, 3);
  assert.equal(p.packagingProfiles.IFOAM.signers.length, 4);
  assert.equal(p.packagingProfiles.IFOAM.hourlySampling, true);
  assert.equal(p.packagingTimes.length, 96);
  assert.ok(p.packagingTimes.includes("23:45"));
  assert.ok(p.packagingTimes.includes("00:15"));
  for (const f of fixtures)
    assert.deepEqual(d.validateReport(f, fixtures), {}, f.id);
});
test("recorded headers require number/date/location and reject incorrect profile mapping", () => {
  const r = draft();
  assert.deepEqual(d.validateReport(r, []), {});
  r.status = "RECORDED";
  const e = d.validateReport(r, []);
  for (const key of ["documentNumber", "documentDate", "location"])
    assert.ok(e[key]);
  const bad = valid();
  bad.profileId = "unknown";
  assert.ok(d.validateReport(bad, []).profileId);
  bad.profileId = "ITECH";
  bad.location = "โรงงานกาญ 3";
  assert.ok(d.validateReport(bad, []).location);
  for (const date of ["2026-99-01", "2026-02-30", "2025-02-29", "x"]) {
    bad.documentDate = date;
    assert.ok(d.validateReport(bad, []).documentDate);
  }
  assert.equal(d.validDate("2024-02-29"), true);
});
test("number uniqueness is factory scoped, trimmed and case insensitive", () => {
  const r = valid();
  r.documentNumber = ` ${fixtures[0].documentNumber.toLowerCase()} `;
  assert.ok(d.validateReport(r, fixtures).documentNumber);
  const another = structuredClone(fixtures[2]);
  another.id = "";
  another.documentNumber = r.documentNumber;
  assert.equal(d.validateReport(another, fixtures).documentNumber, undefined);
  assert.equal(
    d.validateReport(fixtures[0], fixtures).documentNumber,
    undefined,
  );
});
test("context required fields, positive decimals, valid units and context references are enforced", () => {
  for (const field of [
    "fertilizerName",
    "productionDate",
    "packageType",
    "packageWeight",
    "packageUnit",
    "quantity",
    "lotCode",
  ]) {
    const r = valid();
    const c = r.sets[0].contexts[0];
    c[field] = "";
    assert.ok(
      d.validateReport(r, [])[`sets.${r.sets[0].id}.contexts.${c.id}.${field}`],
      field,
    );
  }
  const r = valid();
  r.sets[0].contexts[0].packageUnit = "invalid";
  assert.ok(
    Object.keys(d.validateReport(r, [])).some((k) => k.endsWith("packageUnit")),
  );
  r.sets[0].inspections[0].contextId = "missing";
  assert.ok(
    Object.keys(d.validateReport(r, [])).some((k) => k.endsWith("contextId")),
  );
});
test("iTech typed flat-row mapping never merges different formula/Lot/date contexts", () => {
  const legacy = [1, 2].map((i) => ({
    id: String(i),
    fertilizer: `Formula ${i}`,
    date: `2026-10-0${i}`,
    package: "bag",
    package_weight: "25.0000",
    package_unit: "kg",
    qty: "10",
    lot_no: `LOT-${i}`,
    packing_time: "09:00",
    bag_weight_1: "25.00001",
    bag_weight_2: "25.002",
    physical_condition: null,
    bag_code_marking: true,
    bag_sealing: false,
    moisture_percent: "0",
    water_solubility: "1.30",
    dust_percent: "0",
  }));
  const mapped = d.mapITechRows(freeze(legacy), "legacy");
  assert.equal(mapped.contexts.length, 2);
  assert.notEqual(
    mapped.inspections[0].contextId,
    mapped.inspections[1].contextId,
  );
  assert.deepEqual(
    mapped.contexts.map((c) => c.lotCode),
    ["LOT-1", "LOT-2"],
  );
  assert.deepEqual(
    mapped.contexts.map((c) => c.productionDate),
    ["2026-10-01", "2026-10-02"],
  );
  assert.equal(mapped.inspections[0].waterSolubility, "1.30");
  assert.equal(mapped.inspections[0].bagWeight1, "25.00001");
});
test("multiple iFoam SETs preserve identities, measurements and independent remarks after add/remove", () => {
  const original = freeze(structuredClone(fixtures[2])),
    second = structuredClone(original.sets[1]);
  const added = d.addSet(original, "new-set");
  assert.equal(added.sets.length, 3);
  assert.equal(original.sets.length, 2);
  const edited = d.updateSet(added, "new-set", (s) => ({
    ...s,
    remarks: "independent",
  }));
  assert.equal(added.sets[2].remarks, "");
  assert.equal(edited.sets[1].remarks, second.remarks);
  const deleted = d.removeSet(edited, original.sets[0].id);
  assert.equal(deleted.sets[0].setNo, 1);
  assert.equal(deleted.sets[0].id, second.id);
  assert.deepEqual(deleted.sets[0].inspections, second.inspections);
  assert.equal(deleted.sets[1].remarks, "independent");
  assert.throws(() => d.removeSet(draft("IFOAM"), "initial-set"), /อย่างน้อย/);
  assert.throws(() => d.addSet(draft(), "extra"), /SET เดียว/);
  assert.throws(() => d.removeSet(original, "missing"), /ไม่พบ/);
  assert.throws(() => d.addSet(original, original.sets[0].id), /ซ้ำ/);
});
test("referenced context deletion is blocked, and iFoam requires one primary context", () => {
  const r = valid();
  assert.throws(
    () => d.removeContext(r, r.sets[0].id, r.sets[0].contexts[1].id),
    /อ้างอิง/,
  );
  const free = {
    ...r,
    sets: r.sets.map((s) => ({ ...s, inspections: s.inspections.slice(0, 1) })),
  };
  assert.equal(
    d.removeContext(free, free.sets[0].id, free.sets[0].contexts[1].id).sets[0]
      .contexts.length,
    1,
  );
  const f = structuredClone(fixtures[2]);
  f.sets[0].contexts.push(d.newContext("extra"));
  assert.ok(
    Object.values(d.validateReport(f, [])).some((m) => m.includes("บริบท")),
  );
});
test("weights and numeric values distinguish empty, zero, finite decimals and preserved precision", () => {
  for (const v of ["", "NaN", "Infinity", "-1", "1e3", "1..2"]) {
    assert.equal(d.validDecimal(v, true), false, v);
  }
  assert.equal(d.validDecimal("0", true), false);
  assert.equal(d.validDecimal("0"), true);
  assert.equal(d.validDecimal("25.123456789", true), true);
  assert.equal(d.validDecimal("100.01", false, true), false);
  const r = valid();
  r.sets[0].inspections[0].bagWeight1 = "";
  assert.ok(
    Object.keys(d.validateReport(r, [])).some((k) => k.endsWith("bagWeight1")),
  );
  r.status = "DRAFT";
  assert.equal(
    Object.keys(d.validateReport(r, [])).filter((k) => k.endsWith("bagWeight1"))
      .length,
    0,
  );
});
test("tri-state checks never invent document approval or treat null as false", () => {
  assert.deepEqual([null, true, false].map(d.booleanLabel), [
    "ยังไม่ตรวจ",
    "ผ่าน",
    "ไม่ผ่าน",
  ]);
  const r = valid();
  for (const v of [null, true, false]) {
    r.sets[0].inspections[0].physicalCondition = v;
    assert.deepEqual(d.validateReport(r, []), {});
    assert.equal(r.disposition, "NOT_EVALUATED");
  }
  r.disposition = "APPROVED";
  assert.ok(d.validateReport(r, []).status);
});
test("inspection times, sampling time and duplicate row identities are checked without shifting dates", () => {
  const r = structuredClone(fixtures[2]),
    o = r.sets[0].inspections[0];
  o.packingTime = "09:07";
  o.hourlySamplingTime = "";
  let e = d.validateReport(r, []);
  assert.ok(Object.keys(e).some((k) => k.endsWith("packingTime")));
  assert.ok(Object.keys(e).some((k) => k.endsWith("hourlySamplingTime")));
  o.packingTime = "23:45";
  o.hourlySamplingTime = "00:15";
  assert.deepEqual(d.validateReport(r, []), {});
  assert.equal(r.documentDate, fixtures[2].documentDate);
  r.sets[0].inspections.push({ ...o, id: "duplicate-time" });
  assert.ok(
    Object.keys(d.validateReport(r, [])).some((k) =>
      k.endsWith("duplicate-time.packingTime"),
    ),
  );
  r.sets[0].inspections[1].id = o.id;
  assert.ok(
    Object.values(d.validateReport(r, [])).some((m) => m.includes("รหัสภายใน")),
  );
});
test("recording requires meaningful contexts and an inspection per SET; empty tests are not fabricated", () => {
  const r = valid();
  r.sets[0].inspections = [];
  assert.ok(
    Object.keys(d.validateReport(r, [])).some((k) => k.endsWith("inspections")),
  );
  r.status = "DRAFT";
  assert.equal(
    Object.keys(d.validateReport(r, [])).filter((k) =>
      k.endsWith("inspections"),
    ).length,
    0,
  );
});
test("Load Cell and Master reject partial recorded rows, invalid weights and duplicate times per SET", () => {
  const r = valid(),
    s = r.sets[0];
  s.loadCells = [{ id: "lc", time: "09:00", weight: "" }];
  s.comparisons = [
    { id: "master", time: "", qcWeight: "25", masterWeight: "" },
  ];
  let e = d.validateReport(r, []);
  assert.ok(e[`sets.${s.id}.loadCells.lc`]);
  assert.ok(e[`sets.${s.id}.comparisons.master`]);
  s.loadCells[0].weight = "-1";
  s.comparisons[0].qcWeight = "Infinity";
  e = d.validateReport(r, []);
  assert.ok(e[`sets.${s.id}.loadCells.lc.weight`]);
  assert.ok(e[`sets.${s.id}.comparisons.master.qcWeight`]);
  s.loadCells = [
    { id: "a", time: "09:00", weight: "25" },
    { id: "b", time: "09:00", weight: "25" },
  ];
  s.comparisons = [
    { id: "c", time: "10:00", qcWeight: "25", masterWeight: "25" },
    { id: "d", time: "10:00", qcWeight: "25", masterWeight: "25" },
  ];
  e = d.validateReport(r, []);
  assert.ok(e[`sets.${s.id}.loadCells.b.time`]);
  assert.ok(e[`sets.${s.id}.comparisons.d.time`]);
  r.status = "DRAFT";
  s.loadCells = [{ id: "lc", time: "09:00", weight: "" }];
  s.comparisons = [];
  assert.deepEqual(d.validateReport(r, []), {});
});
test("immutable CRUD preserves stable IDs, entered decimals and timestamps without duplicate saves", () => {
  const originals = freeze(clone()),
    input = freeze(valid());
  const created = d.saveReport(originals, input, "new", at);
  assert.equal(created.records.length, 5);
  assert.equal(input.id, "");
  assert.equal(created.record.sets[0].contexts[0].packageWeight, "25.000");
  const updated = d.saveReport(
    freeze(created.records),
    { ...created.record, remarks: "edited" },
    "unused",
    "2026-10-21T00:00:00Z",
  );
  assert.equal(updated.records.length, 5);
  assert.equal(updated.record.id, "new");
  assert.equal(updated.record.createdAt, at);
  assert.notEqual(updated.record.updatedAt, at);
  assert.equal(created.record.remarks, input.remarks);
  assert.equal(d.deleteReport(updated.records, "new").length, 4);
  assert.throws(
    () => d.saveReport(originals, { ...input, id: "missing" }, "x", at),
    /ไม่พบ/,
  );
  assert.throws(() => d.deleteReport(originals, "missing"), /ไม่พบ/);
  assert.throws(
    () => d.saveReport(originals, { ...fixtures[0], status: "DRAFT" }, "x", at),
    /แบบร่าง/,
  );
  assert.throws(
    () =>
      d.saveReport(originals, { ...fixtures[0], profileId: "IFOAM" }, "x", at),
    /โรงงาน/,
  );
});
test("failed saves never mutate records or nested SET data", () => {
  const original = freeze(clone()),
    before = JSON.stringify(original),
    r = valid();
  r.sets[0].inspections[0].bagWeight1 = "NaN";
  assert.throws(() => d.saveReport(original, r, "new", at));
  assert.equal(JSON.stringify(original), before);
});
test("history searches across SETs and clamps pagination after deletion", () => {
  const source = freeze(clone());
  for (const search of [
    "pack-demo-001",
    "สูตรสาธิตต่างบริบท",
    "LOT-DEMO-001-B",
    "โรงงานกาญ 1",
  ])
    assert.ok(
      d
        .filterReports(source, {
          ...d.emptyHistoryFilters,
          search: ` ${search} `,
        })
        .some((r) => r.id === "001"),
    );
  assert.equal(
    d.filterReports(source, {
      ...d.emptyHistoryFilters,
      profile: "IFOAM",
      from: "2026-10-01",
      to: "2026-10-31",
      status: "RECORDED",
    }).length,
    1,
  );
  assert.equal(
    d.filterReports(source, { ...d.emptyHistoryFilters, search: "no-match" })
      .length,
    0,
  );
  assert.equal(d.paginateReports(source, 99, 2).page, 2);
  assert.equal(d.paginateReports(source.slice(0, 2), 2, 2).page, 1);
  assert.deepEqual(d.paginateReports([], 1, 10), { rows: [], page: 1 });
  assert.equal(source.length, 4);
});
test("multi-SET A4 printing preserves every observation exactly once with contextual continuation headers", () => {
  const r = structuredClone(fixtures[2]);
  for (const s of r.sets)
    s.inspections = Array.from({ length: 15 }, (_, i) => ({
      ...s.inspections[0],
      id: `${s.id}-print-${i}`,
      packingTime: p.packagingTimes[i],
    }));
  const html = print.buildPackagingPrintHtml(r, {
    factoryName: "Demo",
    shortName: "IF",
    logoDataUrl: null,
  });
  assert.match(html, /size:A4 landscape/);
  assert.match(html, /display:table-header-group/);
  assert.equal((html.match(/data-observation-id=/g) || []).length, 30);
  for (const s of r.sets)
    for (const o of s.inspections)
      assert.equal(html.split(`data-observation-id="${o.id}"`).length - 1, 1);
  for (const s of r.sets) {
    assert.ok(html.includes(`SET ${s.setNo}`));
    assert.ok(html.includes(s.contexts[0].lotCode));
    assert.ok(html.includes(s.remarks));
  }
  assert.ok(html.includes("25.125"));
  assert.ok(html.includes("1.30"));
  assert.ok(html.includes("ยังไม่มีการประเมินผลอนุมัติรวม"));
});
test("print escapes user-entered fields and rejects unsafe logo URLs", () => {
  const r = valid(),
    attack = '<script>alert("x")</script>';
  r.documentNumber = attack;
  r.remarks = attack;
  r.sets[0].contexts[0].fertilizerName = attack;
  r.signers[0].name = attack;
  const html = print.buildPackagingPrintHtml(r, {
    factoryName: attack,
    shortName: attack,
    logoDataUrl: "javascript:alert(1)",
  });
  assert.doesNotMatch(html, /<script|javascript:|<img/);
  assert.ok(html.includes("&lt;script&gt;"));
});
test("one stable provider, existing route activation, no per-SET vertical scroll and no stock posting", () => {
  const workspace = read(root + "packaging-workspace.tsx");
  assert.match(workspace, /key=\{editorSession\}/);
  assert.doesNotMatch(workspace, /key=\{report\.id/);
  const layout = read("app/(factory)/layout.tsx");
  assert.equal((layout.match(/<PackagingProvider>/g) || []).length, 1);
  for (const provider of [
    "ProductionQualityProvider",
    "InventoryOperationsProvider",
    "BOMProvider",
    "PRProvider",
    "DemoProvider",
    "MixingProvider",
    "MasterDataProvider",
  ])
    assert.ok(layout.includes(`<${provider}>`));
  const nav = read("src/lib/constants/navigation.ts");
  assert.match(nav, /title: "รายงานการบรรจุ",\s+href: "\/packaging-report"/);
  assert.doesNotMatch(
    read("app/(factory)/packaging-report/page.tsx"),
    /Provider/,
  );
  assert.doesNotMatch(
    read(root + "packaging-form.tsx"),
    /overflow-y-auto|max-h-|h-\[|commitOperation|useInventory/,
  );
  for (const file of readdirSync(new URL(`../${root}`, import.meta.url)))
    assert.doesNotMatch(
      read(root + file),
      /useInventoryOperations|commitOperation|InventoryLedger|inventory-integration/,
    );
});
