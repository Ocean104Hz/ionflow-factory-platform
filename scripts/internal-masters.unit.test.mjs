import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
const root = new URL("../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const cache = new Map();
function moduleUrl(path) {
  const file = resolve(fileURLToPath(root), path);
  if (cache.has(file)) return cache.get(file);
  let source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  source = source.replace(/from ["']([^"']+)["']/g, (full, name) =>
    name.startsWith("@/") || name.startsWith(".")
      ? `from "${moduleUrl(name.startsWith("@/") ? name.slice(2) + ".ts" : resolve(dirname(file), name + ".ts"))}"`
      : full,
  );
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  cache.set(file, url);
  return url;
}
const d = await import(moduleUrl("src/features/master-data/master-domain.ts"));
const a = await import(
  moduleUrl("src/features/master-data/internal-references.ts")
);
const fixtures = await import(
  moduleUrl("src/lib/mock-data/internal-masters.ts")
);
const pr = await import(
  moduleUrl("src/features/purchase-requisitions/pr-domain.ts")
);
const mixing = await import(
  moduleUrl("src/lib/mock-data/fertilizer-powder-mixing.ts")
);
const state = () => structuredClone(fixtures.internalMasters);

test("all master fixtures validate, IDs remain stable, codes/names normalize and reject duplicates", () => {
  const s = state();
  for (const row of s.rows) assert.equal(d.masterError(s, row), "", row.name);
  const row = d.blankMaster("areas", "new-area");
  for (const patch of [
    {},
    { code: "bad code", name: "Demo" },
    { code: "DEMO", name: "" },
    {
      code: s.rows.find((r) => r.kind === "areas").code.toLowerCase(),
      name: "Unique",
    },
  ])
    assert.ok(d.masterError(s, { ...row, ...patch }));
  const saved = d.saveMaster(s, {
    ...row,
    code: " demo-new ",
    name: " Demo area ",
  });
  assert.equal(saved.rows.at(-1).code, "DEMO-NEW");
  assert.equal(saved.rows.at(-1).name, "Demo area");
  assert.equal(saved.rows.at(-1).id, row.id);
  assert.equal(
    s.rows.some((r) => r.id === row.id),
    false,
  );
});
test("parent/reference types, missing references and department cycles are rejected", () => {
  const s = state();
  const area = s.rows.find((r) => r.kind === "areas");
  assert.ok(d.masterError(s, { ...area, parentId: "missing" }));
  assert.ok(d.masterError(s, { ...area, parentId: "unit-kg" }));
  const dep = s.rows.find((r) => r.kind === "departments");
  const next = d.saveMaster(s, {
    ...d.blankMaster("departments", "child"),
    code: "CHILD",
    name: "Child",
    parentId: dep.id,
  });
  assert.match(d.masterError(next, { ...dep, parentId: "child" }), /วนกลับ/);
  assert.ok(
    d.masterError(s, {
      ...s.rows.find((r) => r.kind === "vehicles"),
      typeId: "unit-kg",
    }),
  );
});
test("shifts support crossing midnight but reject malformed/equal times", () => {
  const s = state();
  const row = s.rows.find((r) => r.kind === "shifts");
  assert.equal(d.masterError(s, { ...row, start: "20:00", end: "08:00" }), "");
  assert.ok(d.masterError(s, { ...row, start: "25:00" }));
  assert.ok(d.masterError(s, { ...row, end: row.start }));
});
test("rename/disable never rewrite snapshots; new documents cannot select inactive references", () => {
  const s = state();
  const fields = { location: { kind: "areas", value: "DEMO อาคารผสม 1" } };
  const refs = d.captureReferences(s, fields);
  const before = structuredClone(refs);
  const old = s.rows.find((r) => r.id === refs.location.id);
  const next = d.saveMaster(s, {
    ...old,
    name: "ชื่อพื้นที่ใหม่",
    active: false,
  });
  assert.deepEqual(d.captureReferences(next, fields, refs), before);
  assert.deepEqual(refs, before);
  assert.equal(
    d.choices(next, "areas").some((r) => r.id === old.id),
    false,
  );
  assert.throws(() => d.captureReferences(next, fields), /เปิดใช้งาน/);
  assert.throws(
    () =>
      d.captureReferences(
        { ...s, rows: s.rows.filter((r) => r.id !== old.id) },
        fields,
        refs,
      ),
    /ไม่พบ/,
  );
});
test("deletion blocks document/parent/personnel references, unused new records can be removed", () => {
  const s = state();
  const refs = d.captureReferences(s, {
    location: { kind: "areas", value: "DEMO อาคารผสม 1" },
  });
  const retained = d.retainReferences(s, refs);
  assert.throws(() => d.deleteMaster(retained, refs.location.id), /ปิดใช้งาน/);
  assert.throws(() => d.deleteMaster(s, "site-demo"), /ปิดใช้งาน/);
  assert.throws(() => d.deleteMaster(s, "dep-1"), /ปิดใช้งาน/);
  const added = d.saveMaster(s, {
    ...d.blankMaster("brands", "unused"),
    code: "UNUSED",
    name: "Unused",
  });
  assert.equal(
    d.deleteMaster(added, "unused").rows.some((r) => r.id === "unused"),
    false,
  );
});
test("only exact explicit legacy aliases map; unmatched values survive unchanged, changed values require selection", () => {
  const s = state();
  assert.equal(
    d.captureReferences(s, { unit: { kind: "units", value: "kg" } }).unit.id,
    "unit-kg",
  );
  const oldFields = {
    location: { kind: "areas", value: "Unmapped legacy area" },
  };
  assert.deepEqual(d.captureReferences(s, oldFields, {}, true), {});
  assert.deepEqual(a.fieldsForSave(oldFields, oldFields, {}), {});
  const changed = { location: { kind: "areas", value: "Unmapped typo area" } };
  assert.throws(
    () => d.captureReferences(s, a.fieldsForSave(changed, oldFields)),
    /เปิดใช้งาน/,
  );
});
test("PR can use new internal warehouses and suppliers without changing workflow calculations", () => {
  let s = state();
  s = d.saveMaster(s, {
    ...d.blankMaster("warehouses", "wh-new"),
    code: "WH-NEW",
    name: "คลังใหม่",
  });
  const row = structuredClone(pr.demoPRs[0]);
  row.warehouseCode = "WH-NEW";
  row.warehouseName = "คลังใหม่";
  row.masterRefs = d.captureReferences(s, a.prFields(row));
  assert.equal(pr.validatePR(row, true), null);
  const updated = pr.savePRRecord(pr.demoPRs[0], row, pr.demoPRUser.name);
  assert.equal(updated.masterRefs.warehouse.id, "wh-new");
  assert.equal(updated.warehouseName, "คลังใหม่");
  assert.deepEqual(pr.prAmounts(row), pr.prAmounts(pr.demoPRs[0]));
});
test("mixing fields share active lookup catalogs; fixtures keep Boolean round semantics", () => {
  const s = state();
  const row = mixing.demoMixingReports[0];
  const refs = d.captureReferences(s, a.mixingFields(row), {}, true);
  assert.equal(refs.location.kind, "areas");
  assert.equal(refs.loader_no.kind, "vehicles");
  assert.equal(refs.shift.kind, "shifts");
  assert.equal(row.mix_rounds[0].is_pass, true);
});
test("one stable master provider wraps existing providers; external Sales Hub feature files stay isolated", () => {
  const layout = read("app/(factory)/layout.tsx");
  assert.equal((layout.match(/<MasterDataProvider>/g) ?? []).length, 1);
  assert.match(
    layout,
    /<MasterDataProvider>\s*<MixingProvider>\s*<DemoProvider>\s*<PRProvider>\s*<BOMProvider>/,
  );
  for (const file of [
    "production-orders/production-order-list.tsx",
    "production-orders/production-order-detail.tsx",
    "delivery-orders/delivery-order-detail.tsx",
    "invoices/invoice-detail.tsx",
    "products/products.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/${file}`),
      /master-data|useMasterData/,
    );
  for (const file of [
    "master-provider.tsx",
    "master-domain.ts",
    "master-select.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/master-data/${file}`),
      /fetch\(|localStorage|sessionStorage|\/api\//,
    );
  for (const file of [
    "src/features/purchase-requisitions/pr-editor.tsx",
    "src/features/bom/bom-master-form.tsx",
    "src/features/fertilizer-powder-mixing/mixing-header.tsx",
    "src/features/raw-material-inspections/raw-material-inspections.tsx",
  ])
    assert.match(read(file), /MasterSelect/);
});
