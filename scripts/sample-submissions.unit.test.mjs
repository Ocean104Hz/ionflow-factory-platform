import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const js = (s) =>
  ts.transpileModule(s, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const url = (s) =>
  `data:text/javascript;base64,${Buffer.from(s).toString("base64")}`;
const domainURL = url(
  js(read("src/features/sample-submissions/sample-submission-domain.ts")),
);
const d = await import(domainURL);
const fixtures = (
  await import(
    url(
      js(read("src/lib/mock-data/sample-submissions.ts")).replace(
        /from ["']@\/src\/features\/sample-submissions\/sample-submission-domain["']/g,
        `from "${domainURL}"`,
      ),
    )
  )
).demoSampleSubmissions;
const valid = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  doc_no: "SAMPLE-NEW",
});

test("required fields, real calendar dates, duplicate numbers and sample identities", () => {
  const r = d.newSubmission(),
    errors = d.validateSubmission(r, []);
  for (const key of [
    "doc_no",
    "doc_date",
    "initial-sample.product_name",
    "initial-sample.lot_no",
  ])
    assert.ok(errors[key]);
  assert.ok(d.validateSubmission({ ...valid(), rows: [] }, []).rows);
  assert.ok(
    d.validateSubmission({ ...valid(), doc_date: "2026-02-30" }, []).doc_date,
  );
  assert.ok(
    d.validateSubmission({ ...valid(), doc_no: " sample-demo-0001 " }, fixtures)
      .doc_no,
  );
  const duplicate = valid();
  duplicate.rows.push(structuredClone(duplicate.rows[0]));
  assert.ok(d.validateSubmission(duplicate, []).rows);
  for (const f of fixtures)
    assert.deepEqual(d.validateSubmission(f, fixtures), {});
});
test("add, edit and remove rows preserve stable identities and all remaining values", () => {
  const original = valid(),
    before = JSON.stringify(original);
  const added = d.addSample(original, "new-row");
  assert.equal(added.rows.length, 2);
  const edited = d.updateSample(added, {
    ...added.rows[1],
    product_name: "Second",
    lot_no: "LOT-2",
    remark: "preserve",
  });
  const removed = d.removeSample(edited, edited.rows[0].id);
  assert.equal(removed.rows[0].id, "new-row");
  assert.equal(removed.rows[0].remark, "preserve");
  assert.equal(JSON.stringify(original), before);
  assert.throws(() => d.addSample(original, original.rows[0].id));
});
test("mock create/update/delete preserve document identity without mutating fixtures", () => {
  const before = JSON.stringify(fixtures),
    created = d.saveSubmission(fixtures, valid(), "created");
  assert.equal(created.records.length, fixtures.length + 1);
  const edited = { ...created.saved, doc_no: "SAMPLE-EDIT" },
    updated = d.saveSubmission(created.records, edited, "unused");
  assert.equal(updated.saved.id, "created");
  assert.equal(updated.records.length, created.records.length);
  assert.equal(
    d.deleteSubmission(updated.records, "created").length,
    fixtures.length,
  );
  assert.equal(d.deleteSubmission(fixtures, "missing").length, fixtures.length);
  assert.throws(() =>
    d.saveSubmission(fixtures, { ...valid(), id: "missing" }, "unused"),
  );
  assert.equal(JSON.stringify(fixtures), before);
});
test("search, date range and pagination return correct records", () => {
  for (const query of [
    fixtures[0].doc_no,
    fixtures[0].rows[0].product_name,
    fixtures[0].rows[0].lot_no,
  ])
    assert.ok(
      d
        .filterSubmissions(fixtures, {
          ...d.emptySubmissionFilters,
          search: ` ${query.toUpperCase()} `,
        })
        .some((r) => r.id === fixtures[0].id),
    );
  assert.equal(
    d.filterSubmissions(fixtures, {
      search: "",
      from: "2026-10-20",
      to: "2026-10-20",
    }).length,
    1,
  );
  assert.equal(
    d.filterSubmissions(fixtures, {
      ...d.emptySubmissionFilters,
      search: "not-found",
    }).length,
    0,
  );
  assert.ok(
    d.submissionFilterError({
      search: "",
      from: "2026-10-20",
      to: "2026-10-10",
    }),
  );
  assert.equal(d.pageSubmissions(fixtures.slice(0, 5), 2, 5).page, 1);
});
test("missing analysis remains null and distinct from failed; result fields are optional", () => {
  const r = valid();
  r.rows[0].analysis_result_status = null;
  r.rows[0].analysis_receiver = "";
  r.rows[0].analysis_result_sender = "";
  r.rows[0].analysis_result_receiver = "";
  const saved = d.saveSubmission([], r, "missing").saved;
  assert.equal(saved.rows[0].analysis_result_status, null);
  assert.equal(d.resultLabel(null), "ยังไม่ระบุ");
  r.rows[0].analysis_result_status = "ไม่ผ่าน";
  assert.equal(
    d.saveSubmission([], r, "failed").saved.rows[0].analysis_result_status,
    "ไม่ผ่าน",
  );
  assert.notEqual(d.resultLabel(null), d.resultLabel("ไม่ผ่าน"));
});
