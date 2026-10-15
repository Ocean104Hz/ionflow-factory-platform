import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const domainUrl = url(compile(read("src/features/bom/bom-domain.ts")));
const d = await import(domainUrl);
const fixtures = await import(
  url(
    compile(read("src/lib/mock-data/bom.ts")).replace(
      /from ["']@\/src\/features\/bom\/bom-domain["']/,
      `from "${domainUrl}"`,
    ),
  )
);
const state = () => structuredClone(fixtures.demoBOM);
const at = "2026-10-15T08:00:00Z";
const freshFormula = (s) => ({
  ...d.blankFormula(s.masters[0]),
  code: "DEMO-FORMULA",
  name: "สูตรตัวอย่าง",
  version: "V9",
  ingredients: [
    { materialId: "raw-a", quantity: 1, unit: "กิโลกรัม", remarks: "" },
  ],
});

test("master required fields and normalized code uniqueness, edits retain identity", () => {
  const s = state();
  const before = structuredClone(s);
  assert.throws(() => d.saveMaster(s, d.blankMaster(), "new", at), /ระบุ/);
  assert.throws(
    () =>
      d.saveMaster(
        s,
        { ...d.blankMaster(), code: " demo-fg001 ", name: "Demo", unit: "kg" },
        "new",
        at,
      ),
    /ซ้ำ/,
  );
  const next = d.saveMaster(s, { ...s.masters[0], name: "ใหม่" }, "unused", at);
  assert.equal(next.masters.length, s.masters.length);
  assert.equal(next.masters[0].id, s.masters[0].id);
  assert.equal(next.masters[0].createdAt, s.masters[0].createdAt);
  assert.equal(next.masters[0].updatedAt, at);
  assert.deepEqual(s, before);
});

test("version uniqueness is per parent, historical versions cannot be renamed or overwritten", () => {
  const s = state();
  assert.throws(
    () =>
      d.saveFormula(
        s,
        { ...freshFormula(s), version: " v2 " },
        false,
        "new",
        at,
      ),
    /เวอร์ชันซ้ำ/,
  );
  const next = d.saveFormula(s, freshFormula(s), false, "new", at);
  assert.equal(next.formulas.length, s.formulas.length + 1);
  assert.ok(next.formulas.some((f) => f.id === "formula-a1"));
  assert.throws(
    () =>
      d.saveFormula(
        s,
        { ...s.formulas[0], version: "V20" },
        false,
        "unused",
        at,
      ),
    /เวอร์ชัน/,
  );
  const other = d.saveFormula(
    s,
    { ...freshFormula(s), masterId: "other", version: "V2" },
    false,
    "other-v2",
    at,
  );
  assert.ok(other.formulas.some((f) => f.id === "other-v2"));
});

test("default formula is exclusive, active, belongs to its parent and does not change statuses", () => {
  let s = state();
  const before = structuredClone(s);
  assert.throws(
    () => d.selectDefault(s, "fg-a", "formula-s1", at),
    /สินค้านี้/,
  );
  assert.throws(() => d.selectDefault(s, "fg-a", "missing", at), /ถูกลบ/);
  assert.throws(() => d.selectDefault(s, "fg-a", "formula-a3", at), /ACTIVE/);
  s = d.saveFormula(
    s,
    { ...freshFormula(s), status: "ACTIVE" },
    true,
    "new-default",
    at,
  );
  assert.equal(
    s.masters.find((m) => m.id === "fg-a").defaultFormulaId,
    "new-default",
  );
  assert.equal(s.formulas.find((f) => f.id === "formula-a2").status, "ACTIVE");
  assert.equal(before.masters[0].defaultFormulaId, "formula-a2");
  assert.throws(
    () =>
      d.saveFormula(
        s,
        {
          ...s.formulas.find((f) => f.id === "new-default"),
          status: "INACTIVE",
        },
        true,
        "unused",
        at,
      ),
    /ACTIVE/,
  );
  const cleared = d.selectDefault(s, "fg-a", null, at);
  assert.equal(cleared.masters[0].defaultFormulaId, null);
  assert.equal(
    cleared.formulas.find((f) => f.id === "new-default").history.at(-1).action,
    "ยกเลิกสูตรเริ่มต้น",
  );
});

test("raw ingredients and finite positive quantities are mandatory, duplicates rejected per group", () => {
  const s = state();
  const f = freshFormula(s);
  assert.throws(
    () => d.saveFormula(s, { ...f, ingredients: [] }, false, "new", at),
    /อย่างน้อย/,
  );
  for (const quantity of [0, -1, NaN, Infinity, -Infinity])
    assert.throws(
      () =>
        d.saveFormula(
          s,
          { ...f, ingredients: [{ ...f.ingredients[0], quantity }] },
          false,
          "new",
          at,
        ),
      /มากกว่า 0/,
    );
  assert.throws(
    () => d.saveFormula(s, { ...f, batchSize: Infinity }, false, "new", at),
    /มากกว่า 0/,
  );
  assert.throws(
    () =>
      d.saveFormula(
        s,
        { ...f, ingredients: [f.ingredients[0], f.ingredients[0]] },
        false,
        "new",
        at,
      ),
    /ซ้ำ/,
  );
  assert.throws(
    () =>
      d.saveFormula(
        s,
        { ...f, packaging: [{ ...f.ingredients[0], quantity: 0 }] },
        false,
        "new",
        at,
      ),
    /มากกว่า 0/,
  );
  assert.equal(
    d.saveFormula(s, f, false, "new", at).formulas[0].packaging.length,
    0,
  );
});

test("parent/material references, stock-only types, dates and statuses are checked in domain", () => {
  const s = state();
  const f = freshFormula(s);
  assert.throws(
    () => d.saveFormula(s, { ...f, masterId: "missing" }, false, "new", at),
    /ต้นทาง/,
  );
  assert.throws(
    () => d.saveFormula(s, { ...f, masterId: "raw-a" }, false, "new", at),
    /ประเภทนี้/,
  );
  assert.throws(
    () => d.saveFormula(s, { ...f, status: "APPROVED" }, false, "new", at),
    /สถานะ/,
  );
  assert.throws(
    () =>
      d.saveFormula(s, { ...f, effectiveDate: "2026-02-30" }, false, "new", at),
    /วันที่/,
  );
  for (const materialId of ["missing", "fg-a"])
    assert.throws(
      () =>
        d.saveFormula(
          s,
          { ...f, ingredients: [{ ...f.ingredients[0], materialId }] },
          false,
          "new",
          at,
        ),
      /วัตถุดิบ|ส่วนประกอบ/,
    );
  assert.throws(
    () =>
      d.saveMaster(
        s,
        { ...s.masters[0], defaultFormulaId: "formula-s1" },
        "unused",
        at,
      ),
    /คำสั่งเลือก/,
  );
});

test("deletes prevent orphaned relationships, default references and stale targets", () => {
  const s = state();
  const before = structuredClone(s);
  for (const id of ["fg-a", "raw-a", "bag"])
    assert.throws(() => d.deleteMaster(s, id), /ลบไม่ได้/);
  assert.throws(() => d.deleteFormula(s, "formula-a2", at), /สูตรเริ่มต้น/);
  assert.throws(() => d.deleteMaster(s, "missing"), /ไม่พบ/);
  assert.throws(
    () =>
      d.saveFormula(
        s,
        { ...freshFormula(s), id: "deleted" },
        false,
        "unused",
        at,
      ),
    /ไม่พบ/,
  );
  assert.equal(
    d.deleteFormula(s, "formula-a1", at).formulas.length,
    s.formulas.length - 1,
  );
  assert.equal(d.deleteFormula(s, "formula-a1", at).masters[0].updatedAt, at);
  assert.equal(d.deleteMaster(s, "fg-b").masters.length, s.masters.length - 1);
  assert.deepEqual(s, before);
});

test("mock import validates each row, changes fixtures only on commit and fails atomically", () => {
  const s = state();
  const before = structuredClone(s);
  const rows = fixtures.demoImportRows();
  const errors = d.importFeedback(s, rows);
  assert.equal(errors["row-2"], undefined);
  assert.equal(errors["row-4"], undefined);
  assert.match(errors["row-3"], /ซ้ำ/);
  assert.match(errors["row-5"], /ซ้ำ/);
  assert.ok(errors["row-6"]);
  assert.deepEqual(s, before);
  assert.throws(() => d.importRows(s, rows, at));
  assert.deepEqual(s, before);
  const valid = rows.filter((r) => !errors[r.key]);
  const next = d.importRows(s, valid, at);
  assert.equal(next.masters.length, s.masters.length + 1);
  assert.equal(next.formulas.length, s.formulas.length + 1);
  assert.throws(() => d.importRows(next, valid, at), /ซ้ำ/);
  assert.throws(() => d.importRows(s, [], at), /เลือก/);
});

test("BOM route/provider, shared controls and navigation stay isolated from backend", () => {
  const route = read("app/(factory)/bom/page.tsx");
  assert.match(route, /BOMProvider/);
  assert.match(route, /BOMList/);
  assert.match(
    read("src/lib/constants/navigation.ts"),
    /title: "สูตรผสมวัตถุดิบ",\s*href: "\/bom"/,
  );
  const list = read("src/features/bom/bom-list.tsx");
  for (const token of [
    "FactoryDataTable",
    "Pagination",
    "DialogContent",
    "PopoverContent",
    "loading",
    "empty",
    "availability",
    "department",
  ])
    assert.ok(list.includes(token), token);
  for (const file of [
    "bom-list.tsx",
    "bom-provider.tsx",
    "bom-domain.ts",
    "bom-master-form.tsx",
    "bom-formula-form.tsx",
    "bom-formula-detail.tsx",
    "bom-import-preview.tsx",
    "bom-material-picker.tsx",
  ])
    assert.doesNotMatch(
      read(`src/features/bom/${file}`),
      /:\s*any\b|as\s+any\b|fetch\(|axios|\/api\/|localStorage|from ["']pg["']/,
    );
  assert.match(
    read("src/features/bom/bom-import-preview.tsx"),
    /ไม่อ่านหรืออัปโหลดเนื้อหาไฟล์/,
  );
});
