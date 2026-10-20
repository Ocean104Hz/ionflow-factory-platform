import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const root = "src/features/production-quality/";
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const profileUrl = url(compile(read(`${root}production-quality-profiles.ts`)));
const domainUrl = url(
  compile(read(`${root}production-quality-domain.ts`)).replace(
    /from ["']\.\/production-quality-profiles["']/g,
    `from "${profileUrl}"`,
  ),
);
const d = await import(domainUrl);
const p = await import(profileUrl);
const fixtureSource = compile(read("src/lib/mock-data/production-quality.ts"))
  .replace(
    /from ["']@\/src\/features\/production-quality\/production-quality-domain["']/g,
    `from "${domainUrl}"`,
  )
  .replace(
    /from ["']@\/src\/features\/production-quality\/production-quality-profiles["']/g,
    `from "${profileUrl}"`,
  );
const fixtures = (await import(url(fixtureSource))).demoQualityInspections;
const print = await import(
  url(
    compile(read(`${root}production-quality-print.ts`))
      .replace(
        /from ["']\.\/production-quality-domain["']/g,
        `from "${domainUrl}"`,
      )
      .replace(
        /from ["']\.\/production-quality-profiles["']/g,
        `from "${profileUrl}"`,
      ),
  )
);
const row = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  documentNumber: "QC-NEW",
});
const at = "2026-10-19T10:00:00Z";
const metric = (id) => d.metrics.find((m) => m.id === id);
const numeric = (value) => ({ kind: "numeric", value, note: "" });
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

test("all new feature files parse and have no explicit any or backend/inventory imports", () => {
  for (const file of readdirSync(new URL(`../${root}`, import.meta.url))) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = read(root + file);
    const result = ts.transpileModule(source, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2017,
      },
    });
    assert.deepEqual(result.diagnostics, [], file);
    assert.doesNotMatch(
      source,
      /\bany\b|\bfetch\s*\(|localStorage|sessionStorage|from ["'][^"']*(?:inventory|purchase-requisitions|bom|raw-material-inspections|master-data|firebase|\bpg\b)/,
      file,
    );
  }
});

test("new Production Quality sources satisfy the project's strict TypeScript options (scoped files only)", () => {
  const base = fileURLToPath(new URL("../", import.meta.url));
  const config = ts.parseJsonConfigFileContent(
    JSON.parse(read("tsconfig.json")),
    ts.sys,
    base,
  );
  const files = readdirSync(new URL(`../${root}`, import.meta.url))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => fileURLToPath(new URL(`../${root}${f}`, import.meta.url)));
  files.push(
    fileURLToPath(
      new URL("../src/lib/mock-data/production-quality.ts", import.meta.url),
    ),
  );
  const program = ts.createProgram(files, {
    ...config.options,
    noEmit: true,
    incremental: false,
  });
  const diagnostics = files.flatMap((file) =>
    program.getSemanticDiagnostics(program.getSourceFile(file)),
  );
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => base,
      getCanonicalFileName: (f) => f,
      getNewLine: () => "\n",
    }),
  );
});
test("fixture profiles, independent factory lines and dryer/dust labels match references", () => {
  assert.deepEqual(p.qualityProfiles.ITECH.lines, ["T1", "T2", "T4"]);
  assert.deepEqual(p.qualityProfiles.IFOAM.lines, ["F1", "F2", "F3"]);
  assert.match(p.qualityProfiles.ITECH.dryerA, /S2/);
  assert.match(p.qualityProfiles.IFOAM.dryerB, /5\/6/);
  assert.deepEqual(p.qualityProfiles.IFOAM.dust, [
    "ฝุ่นปานกลาง",
    "ฝุ่นเยอะ",
    "ฝุ่นเยอะมาก",
  ]);
  for (const r of fixtures)
    assert.deepEqual(d.validateInspection(r, fixtures), {}, r.id);
  assert.equal(d.metrics.length, 16);
});
test("calendar dates reject malformed/impossible dates without throwing", () => {
  for (const date of [
    "2026-02-30",
    "2026-99-01",
    "2026-13-01",
    "no",
    "2026-01-00",
    "2025-02-29",
  ])
    assert.equal(d.validDate(date), false, date);
  assert.equal(d.validDate("2024-02-29"), true);
  const r = row();
  r.inspectionDate = "2026-99-99";
  assert.ok(d.validateInspection(r, []).inspectionDate);
});
test("recorded header and profile/line combinations are validated, drafts allow missing header", () => {
  assert.deepEqual(d.validateInspection(d.blankInspection(), []), {});
  const r = d.blankInspection();
  r.recordStatus = "RECORDED";
  const errors = d.validateInspection(r, []);
  for (const key of [
    "inspectionDate",
    "documentNumber",
    "productionSite",
    "productionLine",
    "formulas",
    "readings",
  ])
    assert.ok(errors[key]);
  const bad = row();
  bad.productionLine = "F1";
  assert.ok(d.validateInspection(bad, []).productionLine);
  bad.profileId = "unknown";
  assert.ok(d.validateInspection(bad, []).profileId);
});
test("document number uniqueness trims whitespace, ignores case, and is factory scoped", () => {
  const r = row();
  r.documentNumber = ` ${fixtures[0].documentNumber.toLowerCase()} `;
  assert.ok(d.validateInspection(r, fixtures).documentNumber);
  r.profileId = "IFOAM";
  r.productionLine = "F1";
  r.readings = {};
  r.recordStatus = "DRAFT";
  assert.equal(d.validateInspection(r, fixtures).documentNumber, undefined);
  assert.equal(
    d.validateInspection(fixtures[0], fixtures).documentNumber,
    undefined,
  );
});
test("formula and Lot pairs, row identity and independent calculation deletion", () => {
  const r = row();
  r.formulas[0].lotCode = "";
  assert.ok(d.validateInspection(r, [])[`formula.${r.formulas[0].id}`]);
  r.recordStatus = "DRAFT";
  assert.ok(d.validateInspection(r, [])[`formula.${r.formulas[0].id}`]);
  const original = deepFreeze(row()),
    remaining = structuredClone(original.formulas[1]);
  const next = d.removeFormula(original, original.formulas[0].id);
  assert.deepEqual(next.formulas, [remaining]);
  assert.equal(original.formulas.length, 2);
  const duplicate = row();
  duplicate.formulas[1].id = duplicate.formulas[0].id;
  assert.ok(d.validateInspection(duplicate, []).formulas);
});
test("numeric input preserves missing versus zero and validates finite precision/ranges", () => {
  for (const value of [
    "",
    "NaN",
    "Infinity",
    "1e3",
    "-1",
    "1.0001",
    "1..2",
    "1,000",
    ".5",
  ])
    assert.equal(
      d.parseNumeric(value, metric("moisture_content")),
      null,
      value,
    );
  assert.equal(d.parseNumeric("0", metric("moisture_content")), 0);
  assert.equal(d.parseNumeric("100.001", metric("moisture_content")), null);
  assert.equal(d.parseNumeric("750.125", metric("bulk_density")), 750.125);
  assert.equal(d.parseNumeric("-", metric("percent_retained_5mm")), 0);
  for (const id of ["percent_retained_2mm", "percent_tray", "moisture_content"])
    assert.equal(d.parseNumeric("-", metric(id)), null);
  let r = d.blankInspection();
  r = d.changeReading(r, "moisture_content", "09:00", numeric(""));
  assert.equal(d.averageFor(r, "moisture_content", ["09:00"]), null);
  r = d.changeReading(r, "moisture_content", "09:00", numeric("0"));
  assert.equal(d.averageFor(r, "moisture_content", ["09:00"]), 0);
  r = d.changeReading(r, "moisture_content", "09:00", numeric("oops"));
  assert.ok(d.validateInspection(r, [])["moisture_content.09:00"]);
});
test("solubility averages seconds, never decimal minutes; empty samples remain missing", () => {
  assert.equal(d.parseDuration("01:30"), 90);
  assert.equal(d.parseDuration("01:60"), null);
  assert.equal(d.parseDuration("1.30"), null);
  let r = d.blankInspection();
  r = d.changeReading(r, "water_solubility", "09:00", {
    kind: "duration",
    value: "01:30",
    note: "",
  });
  r = d.changeReading(r, "water_solubility", "10:00", {
    kind: "duration",
    value: "02:00",
    note: "",
  });
  assert.equal(
    d.averageFor(r, "water_solubility", ["09:00", "10:00", "11:00"]),
    105,
  );
  assert.equal(d.formatDuration(105), "01:45");
  assert.equal(d.formatDuration(null), "—");
});
test("Boolean null/true/false remain distinct and individual failures never approve/reject document", () => {
  for (const value of [null, true, false]) {
    const r = d.changeReading(d.blankInspection(), "imo_spraying", "09:00", {
      kind: "boolean",
      value,
      note: "",
    });
    assert.equal(
      d.hasObservation(r.readings.imo_spraying["09:00"]),
      value !== null,
    );
    assert.equal(
      d.displayReading(r.readings.imo_spraying["09:00"]),
      value === null ? "ยังไม่ตรวจ" : value ? "ผ่าน" : "ไม่ผ่าน",
    );
    assert.equal(r.disposition, "NOT_EVALUATED");
    assert.equal(
      d.warnings(r).some((x) => x.includes("ไม่ผ่านบางรายการ")),
      value === false,
    );
  }
  const r = row();
  r.disposition = "APPROVED";
  assert.ok(d.validateInspection(r, []).recordStatus);
});
test("temperature groups retain independent values and incomplete coverage warns without approval gate", () => {
  let r = d.changeReading(
    d.blankInspection(),
    "dryer_temperature_group_a",
    "09:00",
    { kind: "temperature", value: ["70", "71", "72", "73"], note: "A" },
  );
  r = d.changeReading(r, "dryer_temperature_group_b", "09:00", {
    kind: "temperature",
    value: ["80", "81", "82", "83", "84", "85"],
    note: "B",
  });
  assert.equal(r.readings.dryer_temperature_group_a["09:00"].value[0], "70");
  r = d.changeReading(r, "dryer_temperature_group_a", "09:00", {
    kind: "temperature",
    value: ["70", "", "", ""],
    note: "",
  });
  assert.equal(
    d.warnings(r).some((w) => w.includes("อุณหภูมิ")),
    false,
  );
  r = d.changeReading(r, "dryer_temperature_group_b", "09:00", {
    kind: "temperature",
    value: ["", "", "", "", "", ""],
    note: "",
  });
  assert.ok(d.warnings(r).some((w) => w.includes("อุณหภูมิ")));
  assert.deepEqual(d.validateInspection(r, []), {});
  r = d.changeReading(r, "dryer_temperature_group_a", "09:00", {
    kind: "temperature",
    value: ["70", "x", "", ""],
    note: "",
  });
  assert.ok(d.validateInspection(r, [])["dryer_temperature_group_a.09:00"]);
});
test("overnight slots retain inspection-day order and extras are deduplicated", () => {
  const f = {
    ...d.blankFormula("f"),
    startTime: "23:00",
    endTime: "02:00",
    extraSlots: ["01:00", "03:00", "03:00"],
  };
  assert.deepEqual(d.selectedSlots(f), ["23:00", "01:00", "02:00", "03:00"]);
  assert.equal(d.timeSlots.length, 21);
  assert.equal(d.timeSlots[14], "01:00");
  const r = row();
  r.formulas[0] = { ...f, startTime: "03:00", endTime: "23:00" };
  assert.ok(d.validateInspection(r, [])["calculation.f"]);
});
test("machine stops permit overnight, reject partial, overlapping, duplicate and contradictory times", () => {
  assert.equal(d.clockMinutes("25:00"), null);
  const r = row();
  assert.deepEqual(d.validateInspection(r, []), {});
  r.stops[0].reason = "";
  assert.ok(d.validateInspection(r, [])[`stop.${r.stops[0].id}`]);
  r.stops[0].reason = "check";
  r.stops.push({ ...r.stops[0], id: "duplicate" });
  assert.ok(d.validateInspection(r, [])["stop.duplicate"]);
  r.stops = [{ id: "bad", stop: "20:00", restart: "19:00", reason: "wrong" }];
  assert.ok(d.validateInspection(r, [])["stop.bad"]);
  r.stops = [{ id: "bad", stop: "23:00", restart: "", reason: "wrong" }];
  assert.ok(d.validateInspection(r, [])["stop.bad"]);
  r.stops = [
    { id: "early", stop: "08:10", restart: "08:20", reason: "before work" },
  ];
  assert.ok(d.validateInspection(r, [])["stop.early"]);
});
test("recording requires actual observations, not notes or null checks; explicit false counts", () => {
  const r = row();
  r.readings = {};
  assert.ok(d.validateInspection(r, []).readings);
  let next = d.changeReading(r, "imo_spraying", "09:00", {
    kind: "boolean",
    value: null,
    note: "note only",
  });
  assert.ok(d.validateInspection(next, []).readings);
  next = d.changeReading(next, "imo_spraying", "09:00", {
    kind: "boolean",
    value: false,
    note: "failed",
  });
  assert.equal(d.validateInspection(next, []).readings, undefined);
});
test("immutable create/update/delete and repeated save retain metadata and stable identity", () => {
  const source = deepFreeze(structuredClone(fixtures)),
    input = deepFreeze(row());
  const created = d.saveInspection(source, input, "new-id", at);
  assert.equal(created.records.length, fixtures.length + 1);
  assert.equal(created.record.id, "new-id");
  assert.equal(input.id, "");
  const updated = d.saveInspection(
    deepFreeze(created.records),
    { ...created.record, notes: "edited" },
    "unused",
    "2026-10-20T00:00:00Z",
  );
  assert.equal(updated.records.length, created.records.length);
  assert.equal(updated.record.createdAt, at);
  assert.equal(updated.record.updatedAt, "2026-10-20T00:00:00Z");
  assert.equal(created.record.notes, input.notes);
  assert.equal(
    d.deleteInspection(updated.records, "new-id").length,
    fixtures.length,
  );
  assert.throws(
    () => d.saveInspection(source, { ...input, id: "missing" }, "new", at),
    /ไม่พบ/,
  );
  assert.throws(() => d.deleteInspection(source, "missing"), /ไม่พบ/);
  assert.throws(
    () =>
      d.saveInspection(
        source,
        { ...fixtures[0], profileId: "IFOAM" },
        "new",
        at,
      ),
    /เปลี่ยนโรงงาน/,
  );
  assert.throws(
    () =>
      d.saveInspection(
        source,
        { ...fixtures[0], recordStatus: "DRAFT" },
        "new",
        at,
      ),
    /แบบร่าง/,
  );
});
test("history supports text, date/profile/line/formula/status and safe pagination without mutation", () => {
  const frozen = deepFreeze(structuredClone(fixtures));
  for (const search of [
    " qc-demo-001 ",
    fixtures[0].formulas[0].lotCode,
    fixtures[0].productionSite,
  ])
    assert.ok(
      d
        .filterHistory(frozen, { ...d.emptyFilters, search })
        .some((r) => r.id === fixtures[0].id),
    );
  assert.equal(
    d.filterHistory(frozen, { ...d.emptyFilters, search: "no-match" }).length,
    0,
  );
  const rows = d.filterHistory(frozen, {
    ...d.emptyFilters,
    profile: "IFOAM",
    line: "F2",
    from: "2026-10-01",
    to: "2026-10-31",
    formula: "สูตรสาธิต A",
    status: "RECORDED",
  });
  assert.deepEqual(
    rows.map((r) => r.id),
    ["quality-demo-4"],
  );
  assert.equal(d.paginate(frozen, 999, 2).page, 3);
  assert.equal(d.paginate([], 1, 10).rows.length, 0);
  assert.equal(frozen.length, 6);
});
test("yearly document/slot counts deduplicate multi-formula documents and use local inspection dates", () => {
  const r = structuredClone(fixtures[0]);
  const summary = d.yearlySummary([r], "2026", "all", "all", "all");
  assert.equal(summary.documents, 1);
  assert.equal(summary.slots, 5);
  assert.equal(summary.counts.moisture_content, 5);
  const a = d.yearlySummary([r], "2026", "08", "ITECH", "สูตรสาธิต A");
  assert.equal(a.documents, 1);
  assert.equal(a.slots, 2);
  assert.equal(a.counts.moisture_content, 2);
  assert.equal(d.yearlySummary([r], "2026", "09", "all", "all").documents, 0);
  assert.equal(
    d.yearlySummary(
      [{ ...r, recordStatus: "DRAFT" }],
      "2026",
      "all",
      "all",
      "all",
    ).documents,
    0,
  );
  const empty = d.yearlySummary([], "2026", "all", "all", "all");
  assert.equal(empty.averages.moisture_content, null);
  r.inspectionDate = "2026-12-31";
  r.createdAt = "2027-01-01T00:00:00Z";
  assert.equal(d.yearlySummary([r], "2026", "12", "all", "all").documents, 1);
});
test("safe print escapes user fields/notes/signers, rejects unsafe logos and splits all 21 slots", () => {
  const r = row();
  const attack = '<script>alert("x")</script>';
  r.documentNumber = attack;
  r.notes = attack;
  r.formulas[0].formulaName = attack;
  r.signers[0].name = attack;
  r.readings.moisture_content["09:00"].note = attack;
  const html = print.buildQualityPrintHtml(r, {
    factoryName: attack,
    shortName: attack,
    logoDataUrl: "javascript:alert(1)",
  });
  assert.doesNotMatch(html, /<script|javascript:|<img/);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal((html.match(/ผลตรวจตามเวลา \(/g) || []).length, 3);
  for (const slot of d.timeSlots) assert.ok(html.includes(slot));
  for (const text of [
    "A4 landscape",
    "ยังไม่มีการประเมินผลอนุมัติรวม",
    "ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์",
  ])
    assert.ok(html.includes(text), text);
});
test("provider is mounted once at Factory layout; page/workspace has three views without a second provider", () => {
  const layout = read("app/(factory)/layout.tsx"),
    workspace = read(root + "production-quality-workspace.tsx");
  assert.equal((layout.match(/<ProductionQualityProvider>/g) || []).length, 1);
  for (const provider of [
    "DemoProvider",
    "PRProvider",
    "BOMProvider",
    "MixingProvider",
    "InventoryOperationsProvider",
    "MasterDataProvider",
  ])
    assert.ok(layout.includes(`<${provider}>`));
  assert.doesNotMatch(
    read("app/(factory)/production-quality/page.tsx"),
    /Provider/,
  );
  for (const label of ["แบบฟอร์มตรวจสอบ", "ประวัติการตรวจสอบ", "สรุปรายปี"])
    assert.ok(workspace.includes(label));
  assert.ok(workspace.includes("มีข้อมูลที่ยังไม่ได้บันทึก"));
  const provider = read(root + "production-quality-provider.tsx");
  assert.doesNotMatch(
    provider,
    /commitOperation|ledger|inventory|fetch|Storage/,
  );
});
test("QC actions never receive or mutate Ledger: frozen external stock state stays byte-identical", () => {
  const ledger = deepFreeze({
    events: [
      { id: "original", postings: [{ itemId: "item", quantity: "100.250" }] },
    ],
    balances: [{ lot: "LOT", qty: "100.250" }],
  });
  const before = JSON.stringify(ledger);
  const created = d.saveInspection(fixtures, row(), "isolated", at);
  const edited = d.saveInspection(
    created.records,
    { ...created.record, notes: "test" },
    "unused",
    at,
  );
  d.deleteInspection(edited.records, "isolated");
  print.buildQualityPrintHtml(edited.record, {
    factoryName: "Demo",
    shortName: "IF",
    logoDataUrl: null,
  });
  d.yearlySummary(edited.records, "2026", "all", "all", "all");
  assert.equal(JSON.stringify(ledger), before);
  for (const file of readdirSync(new URL(`../${root}`, import.meta.url)))
    if (/\.tsx?$/.test(file))
      assert.doesNotMatch(
        read(root + file),
        /commitOperation|useInventoryOperations|InventoryLedger|inventory-integration/,
      );
});

test("production-quality never collides with the shorter PR navigation route", async () => {
  const source = read("src/lib/constants/navigation.ts");
  const helper = source.slice(
    source.indexOf("export function isNavigationActive"),
    source.indexOf("// Business navigation"),
  );
  const { isNavigationActive } = await import(url(compile(helper)));
  assert.equal(isNavigationActive("/production-quality", "/pr"), false);
  assert.equal(isNavigationActive("/production-orders", "/pr"), false);
  assert.equal(isNavigationActive("/pr/example", "/pr"), true);
  assert.equal(
    isNavigationActive("/production-quality", "/production-quality"),
    true,
  );
  const shell = read("src/components/factory/app-shell.tsx");
  assert.equal(
    (shell.match(/isNavigationActive\(pathname, item.href\)/g) || []).length,
    3,
  );
});
