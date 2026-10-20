import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
// Render actual installed controls and feature TSX, without adding a test framework.
function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
  });
  assert.equal(
    output.diagnostics?.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
    file,
  );
  const code = output.outputText.replace(
    /(from\s+|import\s*)(["'])([^"']+)\2/g,
    (full, start, quote, spec) => {
      if (!spec.startsWith(".") && !spec.startsWith("@/")) {
        let resolved = import.meta.resolve(spec);
        if (
          resolved.startsWith("file:") &&
          !existsSync(fileURLToPath(resolved)) &&
          existsSync(fileURLToPath(resolved) + ".js")
        )
          resolved += ".js";
        return `${start}${quote}${resolved}${quote}`;
      }
      let base = spec.startsWith("@/")
        ? path.join(root, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const target = [
        base,
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ].find((p) => existsSync(p) && /\.(ts|tsx)$/.test(p));
      assert.ok(target, base);
      return `${start}${quote}${moduleURL(target)}${quote}`;
    },
  );
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  cache.set(file, url);
  return url;
}
const d = await import(
  moduleURL(
    path.join(root, "src/features/qc-organic-fertilizer/qc-organic-domain.ts"),
  )
);
const { organicReports: fixtures } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/qc-organic-fertilizer.ts"))
);
const valid = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  doc_no: "NEW-DEMO",
});
// Independent reference manifest from the iTech/iFoam business forms (not generated from the implementation).
const referenceMetrics = [
  ["moisture_content", "numeric"],
  ["water_solubility", "duration"],
  ["bulk_density", "numeric"],
  ["percent_retained_5mm", "numeric"],
  ["percent_retained_2mm", "numeric"],
  ["percent_tray", "numeric"],
  ["inverter_status", "numeric"],
  ["dryer_temp_s2_test_1_3_2_4", "temperature"],
  ["dryer_temp_s5_test_1_2_3_4_5_6", "temperature"],
  ["granule_hardness", "numeric"],
  ["dust_environment", "dust"],
  ["bigbag_code_marking", "boolean"],
  ["amino_drop_at_disc", "boolean"],
  ["imo_spraying", "boolean"],
  ["granule_coating", "boolean"],
  ["operator_presence", "boolean"],
];
const referenceFields = [
  "date",
  "doc_no",
  "location",
  "machine_start_time",
  "work_start_time",
  "work_stop_time",
  "inspector",
  "inspector_date",
  "supervisor",
  "production",
  "production_date",
  "factory_qa",
];
test("two explicit factory profiles preserve production lines, Lot and document adapters", () => {
  assert.deepEqual(d.profiles.itech.lines, ["T1", "T2", "T4"]);
  assert.deepEqual(d.profiles.ifoam.lines, ["F1", "F2", "F3"]);
  assert.equal(d.profiles.itech.location, "โรงงานกาญ 1");
  assert.equal(d.profiles.ifoam.location, "โรงงานกาญ 3");
  const f = fixtures[0].fertilizer[0];
  assert.deepEqual(d.legacyFormula("itech", f), { name: f.name, lot: f.lot });
  assert.deepEqual(d.legacyFormula("ifoam", f), {
    name: f.name,
    lot_no: f.lot,
  });
  assert.deepEqual(d.legacyDocument(fixtures[0]), { doc: fixtures[0].doc_no });
  assert.deepEqual(d.legacyDocument(fixtures[3]), {
    doc_no: fixtures[3].doc_no,
  });
  assert.equal(d.temperatureCount("dryer_temp_s2_test_1_3_2_4"), 4);
  assert.equal(d.temperatureCount("dryer_temp_s5_test_1_2_3_4_5_6"), 6);
  assert.match(d.metricLabel("itech", "dryer_temp_s2_test_1_3_2_4"), /S2/);
  assert.match(
    d.metricLabel("ifoam", "dryer_temp_s5_test_1_2_3_4_5_6"),
    /ท่ออบ 5\/6/,
  );
});
test("all sixteen inspection series, time slots and notes retain independent values", () => {
  assert.deepEqual(
    d.metrics.map(([key, , kind]) => [key, kind]),
    referenceMetrics,
  );
  assert.equal(d.timeSlots.length, 21);
  assert.deepEqual(d.timeSlots, [
    "09:00",
    "10:00",
    "11:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
    "23:00",
    "01:00",
    "02:00",
    "03:00",
    "04:00",
    "05:00",
    "06:00",
    "07:00",
  ]);
  const r = valid();
  r.measurements.moisture_content["09:00"] = "99";
  assert.equal(r.measurements.moisture_content["10:00"], "14");
  assert.equal(fixtures[0].measurements.moisture_content["09:00"], "12");
  assert.equal(d.blankReport().measurements.bigbag_code_marking["09:00"], "");
  assert.equal(fixtures[1].measurements.bigbag_code_marking["09:00"], "false");
});
test("verified summary uses averages, duration seconds, dash-as-zero and cross-midnight union", () => {
  const r = valid(),
    f = r.fertilizer[0];
  r.measurements.water_solubility["10:00"] = "11.30";
  r.measurements.percent_retained_5mm["09:00"] = "-";
  r.measurements.percent_retained_5mm["10:00"] = "10";
  const c = d.calculation(r, f);
  assert.equal(c.moisture_sum, 13);
  assert.equal(c.dissolution_sum, 660);
  assert.equal(c.sieve_5_sum, 5);
  assert.equal(c.hardness_sum, null);
  assert.equal(c.fertilizer_testing, 2);
  assert.equal(d.durationSeconds("10.5"), 650);
  assert.equal(d.durationSeconds("10.90"), 690);
  assert.equal(d.durationSeconds("bad"), null);
  assert.deepEqual(
    d.selectedTimes({
      ...f,
      from_time: "23:00",
      to_time: "02:00",
      extra_times: ["01:00", "09:00"],
    }),
    ["23:00", "01:00", "02:00", "09:00"],
  );
  assert.equal(d.minutesBetween("23:30", "00:30"), 60);
  assert.equal(d.minutesBetween("09:00", "07:00"), 1320);
  assert.equal(d.minutesBetween("bad", "07:00"), null);
  assert.equal(
    d.calculation(r, { ...f, from_time: "", to_time: "", extra_times: [] })
      .moisture_sum,
    null,
  );
});
test("validation covers missing fields, partial temperature acceptance, missing dust and numeric errors", () => {
  for (const f of fixtures) assert.deepEqual(d.validateReport(f, fixtures), {});
  for (const key of ["date", "doc_no", "line"])
    assert.ok(d.validateReport(d.blankReport(), [])[key]);
  const r = valid();
  r.measurements.dryer_temp_s2_test_1_3_2_4["09:00"] = "10///";
  assert.deepEqual(d.validateReport(r, []), {});
  r.measurements.dust_environment["09:00"] = "";
  assert.ok(d.validateReport(r, [])["cell-dust_environment-09:00"]);
  r.measurements.moisture_content["09:00"] = "NaN";
  assert.ok(d.validateReport(r, [])["cell-moisture_content-09:00"]);
  r.date = "2026-02-30";
  r.line = "F1";
  assert.ok(d.validateReport(r, []).date);
  assert.ok(d.validateReport(r, []).line);
  r.fertilizer[0].to_time = "";
  assert.ok(d.validateReport(r, [])[`formula-${r.fertilizer[0].id}-range`]);
  const stop = valid();
  stop.stop_start[0].machine_run_time = "";
  assert.deepEqual(d.validateReport(stop, []), {});
  stop.stop_start[0].machine_stop_reason = "";
  assert.ok(d.validateReport(stop, [])[`stop-${stop.stop_start[0].id}`]);
});
test("mock CRUD preserves identity, every section and factory ownership without mutating fixtures", () => {
  const before = JSON.stringify(fixtures),
    r = valid();
  r.fertilizer.push({
    ...d.blankFormula("second"),
    name: "สูตรเพิ่ม",
    lot: "LOT-2",
  });
  r.stop_start.push({
    id: "second",
    machine_stop_time: "01:00",
    machine_run_time: "02:00",
    machine_stop_reason: "ทดสอบ",
  });
  r.fertilizer[0].volume_sum = "5";
  const created = d.saveReport(fixtures, r, "new"),
    edit = structuredClone(created.saved);
  edit.remark = "แก้ไข";
  edit.measurements.moisture_content["09:00"] = "22";
  const updated = d.saveReport(created.records, edit, "unused");
  assert.equal(updated.saved.id, "new");
  assert.equal(updated.records.length, 7);
  assert.equal(updated.saved.fertilizer.length, 2);
  assert.equal(updated.saved.stop_start.length, 2);
  assert.deepEqual(updated.saved, edit);
  assert.throws(() =>
    d.saveReport(
      updated.records,
      { ...updated.saved, profile: "ifoam", line: "F1" },
      "unused",
    ),
  );
  assert.throws(() =>
    d.saveReport(fixtures, { ...valid(), doc_no: fixtures[0].doc_no }, "dup"),
  );
  assert.equal(d.deleteReport(updated.records, "new").length, 6);
  assert.equal(d.deleteReport(fixtures, "missing").length, 6);
  assert.equal(JSON.stringify(fixtures), before);
  assert.equal(
    d.filterReports(fixtures, {
      search: " lot-demo-2-1 ",
      profile: "ifoam",
      from: "2026-10-20",
      to: "2026-10-20",
    }).length,
    1,
  );
});
test("actual rendered form parity for both profiles: every source field, 16×21 cells, summary and stop controls", async () => {
  const { OrganicFormSections } = await import(
    moduleURL(
      path.join(root, "src/features/qc-organic-fertilizer/qc-organic-form.tsx"),
    )
  );
  for (const profile of ["itech", "ifoam"]) {
    const r = structuredClone(fixtures.find((f) => f.profile === profile));
    r.id = "";
    const html = renderToStaticMarkup(
      React.createElement(OrganicFormSections, {
        row: r,
        onChange: () => {},
        onProfile: () => {},
      }),
    );
    for (const key of referenceFields)
      assert.match(
        html,
        new RegExp(`<input[^>]*id="organic-${key}"`),
        profile + key,
      );
    assert.match(html, /<textarea[^>]*id="organic-remark"/);
    assert.equal((html.match(/data-metric=/g) || []).length, 16);
    for (const [key, kind] of referenceMetrics)
      for (const time of d.timeSlots) {
        const label = d.metricLabel(profile, key) + " " + time;
        assert.ok(html.includes(`aria-label="${label}"`), profile + key + time);
      }
    assert.equal((html.match(/aria-label="หมายเหตุ /g) || []).length, 16);
    for (const key of ["name", "lot", "volume_sum"])
      assert.ok(
        html.includes(`id="organic-formula-${r.fertilizer[0].id}-${key}"`),
      );
    for (const key of [
      "machine_stop_time",
      "machine_run_time",
      "machine_stop_reason",
    ])
      assert.ok(
        html.includes(`id="organic-stop-${r.stop_start[0].id}-${key}"`),
      );
    assert.equal(
      (html.match(/aria-label="เวลาเพิ่มเติม สูตร/g) || []).length,
      21,
    );
    for (const key of [
      "moisture_sum",
      "dissolution_sum",
      "density_sum",
      "sieve_5_sum",
      "sieve_2_sum",
      "draining_tray_sum",
      "hardness_sum",
    ])
      assert.ok(html.includes(`data-summary-field="${key}"`));
    const detail = renderToStaticMarkup(
      React.createElement(OrganicFormSections, { row: r, print: true }),
    );
    assert.equal((detail.match(/data-cell=/g) || []).length, 336);
    assert.ok(detail.includes("จุด 4: 120"));
    assert.ok(detail.includes("จุด 6: 150"));
    assert.ok(detail.includes(r.fertilizer[0].lot));
    assert.ok(detail.includes(r.factory_qa));
  }
});
