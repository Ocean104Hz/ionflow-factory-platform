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
        let target = import.meta.resolve(spec);
        if (
          target.startsWith("file:") &&
          !existsSync(fileURLToPath(target)) &&
          existsSync(fileURLToPath(target) + ".js")
        )
          target += ".js";
        return `${start}${quote}${target}${quote}`;
      }
      const base = spec.startsWith("@/")
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
    path.join(
      root,
      "src/features/material-requisitions/material-requisition-domain.ts",
    ),
  )
);
const { materialRequisitions: fixtures } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/material-requisitions.ts"))
);
const { MaterialRequisitionForm: Form } = await import(
  moduleURL(
    path.join(
      root,
      "src/features/material-requisitions/material-requisition-form.tsx",
    ),
  )
);
const { RequisitionDocument: Document } = await import(
  moduleURL(
    path.join(
      root,
      "src/features/material-requisitions/material-requisition-detail.tsx",
    ),
  )
);
const draft = (profile = "itech") => ({
  ...structuredClone(fixtures.find((r) => r.profile === profile)),
  id: "",
  doc_no: "NEW-TEST",
});
const save = (records, row, id = "new-id") =>
  d.saveRequisition(records, row, id, "2026-10-21T03:00:00.000Z");

// Independent checklist transcribed from both legacy forms; not generated from feature constants.
const header = ["location", "date", "doc_no"];
const material = ["m_item_name", "m_size", "m_qty", "m_unit", "m_desc"];
const wip = ["w_item_name", "w_size", "w_qty", "w_unit", "w_desc"];
const signers = [
  "bag_dispenser_bag_warehouse_staff",
  "requisitioner_production_supervisor",
  "inventory_auditor",
];

test("factory defaults and source-confirmed suggestions remain explicit for both profiles", () => {
  for (const [profile, location] of [
    ["itech", "โรงงานกาญ 1"],
    ["ifoam", "โรงงานกาญ 3"],
  ]) {
    const row = d.blankRequisition(profile);
    assert.equal(row.location, location);
    assert.equal(row.doc_no, "");
    assert.deepEqual(row.material_details, []);
    assert.deepEqual(row.wip_materials, []);
    assert.deepEqual(d.profiles[profile].wipNames, [
      "วัตถุดิบ WIP",
      "ยอดเบิกวัตถุดิบ",
      "ปุ๋ยอินทรีย์ WIP",
      "สารปรับสภาพดิน WIP",
    ]);
  }
  assert.deepEqual(d.units, [
    "กระสอบ",
    "Bag",
    "กิโลกรัม",
    "ตัน",
    "ด้าย",
    "ม้วน",
    "เส้น",
  ]);
  assert.deepEqual(d.wipSizes, [10, 12, 30, 50]);
});
test("required header, real dates, duplicate number and ST prefix normalization", () => {
  const issues = d.validateRequisition(d.blankRequisition(), fixtures);
  assert.ok(issues.date && issues.doc_no && issues.items);
  for (const date of ["2026-02-30", "invalid", ""])
    assert.ok(d.validateRequisition({ ...draft(), date }, fixtures).date);
  assert.ok(
    d.validateRequisition({ ...draft(), location: " " }, fixtures).location,
  );
  assert.equal(d.documentNumber("ST-001"), "ST-001");
  assert.equal(d.documentNumber("001"), "ST-001");
  assert.equal(d.documentNumber(" ST 001 "), "ST-001");
  assert.equal(d.documentNumber("ST-"), "");
  assert.ok(
    d.validateRequisition(
      { ...draft(), doc_no: fixtures[0].doc_no.toLowerCase() },
      fixtures,
    ).doc_no,
  );
  assert.deepEqual(
    d.validateRequisition(structuredClone(fixtures[0]), fixtures),
    {},
  );
});
test("independent stable row identities, add/remove and placeholder filtering preserve remaining values", () => {
  const fixturesBefore = structuredClone(fixtures);
  const row = draft();
  const before = structuredClone(row);
  row.material_details = [...row.material_details, d.newMaterial("empty-m")];
  row.wip_materials = [...row.wip_materials, d.newWip("empty-w")];
  row.material_details = row.material_details.filter((r) => r.id !== "empty-m");
  assert.deepEqual(row.material_details, before.material_details);
  assert.deepEqual(row.wip_materials[0], before.wip_materials[0]);
  const result = save(fixtures, row);
  assert.deepEqual(result.row.material_details, before.material_details);
  assert.deepEqual(result.row.wip_materials, before.wip_materials);
  assert.deepEqual(fixtures, fixturesBefore);
});
test("both groups reject missing fields and invalid size/quantity without mutating records", () => {
  const snapshot = structuredClone(fixtures);
  for (const group of ["material_details", "wip_materials"])
    for (const invalid of [null, 0, -1, NaN, Infinity]) {
      const row = draft();
      const prefix = group === "material_details" ? "m" : "w";
      row[group][0][`${prefix}_qty`] = invalid;
      assert.ok(
        Object.keys(save(fixtures, row).errors).some((key) =>
          key.endsWith(".qty"),
        ),
      );
      row[group][0][`${prefix}_size`] = invalid;
      assert.ok(
        Object.keys(save(fixtures, row).errors).some((key) =>
          key.endsWith(".size"),
        ),
      );
      row[group][0][`${prefix}_item_name`] = " ";
      row[group][0][`${prefix}_unit`] = "";
      const issues = save(fixtures, row).errors;
      assert.ok(
        issues[`${row[group][0].id}.name`] &&
          issues[`${row[group][0].id}.unit`],
      );
    }
  assert.deepEqual(fixtures, snapshot);
});
test("mock create/edit/delete retains identity, all field mappings and optional signers for both profiles", () => {
  for (const profile of ["itech", "ifoam"]) {
    const row = draft(profile);
    row.material_details[0].m_desc = "บันทึกวัสดุ";
    row.wip_materials[0].w_desc = "บันทึก WIP";
    for (const key of signers) row[key] = `ตัวอย่าง ${key}`;
    const created = save(fixtures, row);
    assert.equal(created.records.length, fixtures.length + 1);
    for (const key of material)
      assert.equal(
        created.row.material_details[0][key],
        row.material_details[0][key],
      );
    for (const key of wip)
      assert.equal(
        created.row.wip_materials[0][key],
        row.wip_materials[0][key],
      );
    for (const key of signers) assert.equal(created.row[key], row[key]);
    const edited = save(created.records, {
      ...created.row,
      location: "พื้นที่ทดสอบ",
      inventory_auditor: "แก้ไขผู้ตรวจ",
    });
    assert.equal(edited.row.id, created.row.id);
    assert.equal(edited.records.length, created.records.length);
    assert.equal(edited.row.createdAt, created.row.createdAt);
    assert.equal(edited.row.inventory_auditor, "แก้ไขผู้ตรวจ");
    assert.ok(
      save(created.records, {
        ...created.row,
        profile: profile === "itech" ? "ifoam" : "itech",
      }).errors.profile,
    );
    assert.deepEqual(
      d.deleteRequisition(created.records, created.row.id),
      fixtures,
    );
    assert.deepEqual(d.deleteRequisition(fixtures, "missing"), fixtures);
    const optional = draft(profile);
    for (const key of signers) optional[key] = "";
    assert.deepEqual(d.validateRequisition(optional, fixtures), {});
  }
});
test("history search/date/factory filtering and summary do not combine incompatible units", () => {
  const filters = { search: "", from: "", to: "", profile: "" };
  assert.equal(
    d.filterRequisitions(fixtures, { ...filters, search: "  st-demo-101 " })
      .length,
    1,
  );
  assert.equal(
    d.filterRequisitions(fixtures, {
      ...filters,
      profile: "ifoam",
      from: "2026-10-12",
      to: "2026-10-12",
    }).length,
    1,
  );
  assert.equal(
    d.filterRequisitions(fixtures, { ...filters, search: "not-found" }).length,
    0,
  );
  assert.deepEqual(d.summarize(fixtures[0]), {
    materials: 1,
    wip: 1,
    total: 2,
    quantities: { กระสอบ: 20, ตัน: 2 },
  });
});
test("actual rendered form covers all 16 legacy field keys plus factory with usable populated controls", () => {
  for (const profile of ["itech", "ifoam"]) {
    const row = draft(profile);
    const html = renderToStaticMarkup(
      React.createElement(Form, {
        row,
        errors: {},
        onChange() {},
        onProfileChange() {},
        onSave() {},
        onReset() {},
      }),
    );
    const controls = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
    for (const key of [...header, ...signers])
      assert.ok(
        controls.some(
          (c) =>
            c.includes(`name="${key}"`) &&
            !/\s(?:disabled|readOnly)(?:=|\s|>)/i.test(c),
        ),
        key,
      );
    for (const key of material)
      assert.ok(
        controls.some((c) => c.includes(`-${key}"`)),
        key,
      );
    for (const key of wip)
      assert.ok(
        controls.some((c) => c.includes(`-${key}"`)),
        key,
      );
    assert.ok(html.includes(row.location));
    assert.ok(html.includes(row.material_details[0].m_item_name));
    assert.ok(html.includes("เพิ่มวัสดุ") && html.includes("เพิ่ม WIP"));
    assert.ok(html.includes('role="combobox"'));
    const source = readFileSync(
      path.join(
        root,
        "src/features/material-requisitions/material-requisition-form.tsx",
      ),
      "utf8",
    );
    for (const key of [...material, ...wip])
      assert.match(source, new RegExp(`\\b${key}\\b`));
    assert.match(source, /change\(e.target.value\)/);
  }
});
test("detail and print use the same safely rendered document with every saved value", () => {
  const row = draft();
  row.material_details[0].m_desc = "<script>unsafe</script>";
  const html = renderToStaticMarkup(React.createElement(Document, { row }));
  for (const value of [
    row.location,
    row.date,
    d.documentNumber(row.doc_no),
    row.wip_materials[0].w_desc,
    ...signers.map((k) => row[k]),
  ])
    assert.ok(html.includes(value), value);
  assert.ok(html.includes("&lt;script&gt;unsafe&lt;/script&gt;"));
  assert.ok(!html.includes("<script>unsafe"));
  const source = readFileSync(
    path.join(
      root,
      "src/features/material-requisitions/material-requisition-detail.tsx",
    ),
    "utf8",
  );
  assert.match(source, /cloneNode\(true\)/);
  assert.match(source, /contentWindow.print\(\)/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/);
});
test("route is the sole material and production requisition menu", () => {
  const nav = readFileSync(
    path.join(root, "src/lib/constants/navigation.ts"),
    "utf8",
  );
  assert.equal((nav.match(/href: "\/material-requisitions"/g) || []).length, 1);
  assert.doesNotMatch(nav, /title: "เบิกวัตถุดิบการผลิต"/);
  assert.ok(
    existsSync(path.join(root, "app/(factory)/material-requisitions/page.tsx")),
  );
});
