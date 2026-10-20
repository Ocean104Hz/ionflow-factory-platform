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
  js(read("src/features/sample-submission-log/submission-log-domain.ts")),
);
const d = await import(domainURL);
const fixtures = (
  await import(
    url(
      js(read("src/lib/mock-data/sample-submission-log.ts")).replace(
        /from ["']@\/src\/features\/sample-submission-log\/submission-log-domain["']/g,
        `from "${domainURL}"`,
      ),
    )
  )
).demoSubmissionLogs;
const valid = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  doc_no: "LAB-NEW",
});

test("all 32 original analysis keys map uniquely to their verified labels and persist independently", () => {
  assert.deepEqual(
    d.analysisItems.map(([key]) => key),
    [
      "ph",
      "moisture",
      "specific_gravity",
      "ec",
      "humic_acid",
      "om",
      "total_n",
      "an",
      "total_p2o5",
      "avp",
      "cip",
      "total_k2o",
      "wk2o",
      "cao",
      "mgo",
      "s",
      "fe",
      "cu",
      "mn",
      "zn",
      "b",
      "wca",
      "wmg",
      "ws",
      "wfe",
      "wcu",
      "wmn",
      "wzn",
      "wb",
      "wmo",
      "gi",
      "other",
    ],
  );
  assert.equal(new Set(d.analysisItems.map(([, label]) => label)).size, 32);
  assert.equal(
    d.analysisItems.find(([key]) => key === "ws")[1],
    "กำมะถันที่ละลลายน้ำ (WS)",
  );
  const r = valid();
  for (const [key] of d.analysisItems) r.requested_items[key] = true;
  r.requested_items.other_detail = "วิเคราะห์ตัวอย่างเพิ่มเติม";
  const saved = d.saveLog([], r, "all").saved;
  assert.equal(d.selectedAnalysis(saved).length, 32);
  assert.deepEqual(saved.requested_items, r.requested_items);
});
test("required submission fields, positive finite quantity and dates; staff stays optional", () => {
  const r = d.blankLog(),
    errors = d.validateLog(r, []);
  for (const key of [
    "doc_no",
    "sample_code",
    "requester_name",
    "sample_name",
    "sample_type",
    "sample_form",
    "requested_items",
    "quantity_amount",
    "quantity_packaging",
    "sample_return",
    "result_delivery",
    "sender_name",
    "sender_date",
  ])
    assert.ok(errors[key], key);
  assert.equal(errors.sample_condition, undefined);
  assert.equal(errors.job_acceptance, undefined);
  for (const f of fixtures) assert.deepEqual(d.validateLog(f, fixtures), {});
  for (const amount of ["", "0", "-1", "NaN", "Infinity"]) {
    const x = valid();
    x.quantity.amount = amount;
    assert.ok(d.validateLog(x, []).quantity_amount);
  }
  const small = valid();
  small.quantity.amount = "0.001";
  assert.deepEqual(d.validateLog(small, []), {});
  const badDate = valid();
  badDate.sender_sign.signed_date = "2026-02-30";
  assert.ok(d.validateLog(badDate, []).sender_date);
  badDate.staff_section.received_date = "invalid";
  assert.ok(d.validateLog(badDate, []).received_date);
});
test("other fields, abnormal condition and not-ready reason are conditional requirements", () => {
  let r = d.setLogForm(d.setLogType(valid(), "other"), "other");
  r.requested_items.other = true;
  r.staff_section.sample_condition.abnormal = true;
  r.staff_section.job_acceptance.rejected = true;
  const errors = d.validateLog(r, []);
  for (const key of [
    "sample_type_other",
    "sample_form_other",
    "analysis_other",
    "abnormal_detail",
    "reject_reason",
  ])
    assert.ok(errors[key], key);
  r.sample_type.other_detail = "ประเภทสาธิต";
  r.sample_form.other_detail = "รูปแบบสาธิต";
  r.requested_items.other_detail = "การวิเคราะห์สาธิต";
  r.staff_section.sample_condition.abnormal_detail = "ตัวอย่างชำรุด";
  r.staff_section.job_acceptance.reject_reason = "รอข้อมูลเพิ่ม";
  assert.deepEqual(d.validateLog(r, []), {});
  r = d.setLogType(r, "organic_fertilizer");
  r = d.setLogForm(r, "powder");
  assert.equal(r.sample_type.other_detail, null);
  assert.equal(r.sample_form.other_detail, null);
  assert.equal(d.logTypeValue(r), "organic_fertilizer");
  assert.equal(d.logFormValue(r), "powder");
});
test("mutually exclusive choices cannot conflict and return/delivery remain independent", () => {
  const r = valid();
  r.quantity.receive_result.sample_return = true;
  r.quantity.receive_result.not_return = true;
  assert.ok(d.validateLog(r, []).sample_return);
  assert.equal(d.validateLog(r, []).result_delivery, undefined);
  r.quantity.receive_result.sample_return = false;
  assert.equal(d.validateLog(r, []).sample_return, undefined);
  r.staff_section.sample_condition.normal = true;
  r.staff_section.sample_condition.abnormal = true;
  r.staff_section.job_acceptance.accepted = true;
  r.staff_section.job_acceptance.rejected = true;
  assert.ok(d.validateLog(r, []).sample_condition);
  assert.ok(d.validateLog(r, []).job_acceptance);
  r.sample_type.chemical_fertilizer = true;
  assert.ok(d.validateLog(r, []).sample_type);
});
test("create/edit preserve identity, reject duplicates and stale edits; filters use sender date", () => {
  const before = JSON.stringify(fixtures),
    created = d.saveLog(fixtures, valid(), "created");
  assert.equal(created.records.length, fixtures.length + 1);
  const edit = structuredClone(created.saved);
  edit.requester_address = "แก้ไขที่อยู่";
  edit.requested_items.gi = true;
  const updated = d.saveLog(created.records, edit, "unused");
  assert.equal(updated.saved.id, "created");
  assert.equal(updated.records.length, created.records.length);
  assert.equal(updated.saved.requested_items.gi, true);
  assert.ok(
    d.validateLog({ ...valid(), doc_no: " lab-demo-0001 " }, fixtures).doc_no,
  );
  assert.throws(() =>
    d.saveLog(fixtures, { ...valid(), id: "missing" }, "unused"),
  );
  assert.equal(d.deleteLog(updated.records, "created").length, fixtures.length);
  assert.equal(JSON.stringify(fixtures), before);
  assert.equal(
    d.filterLogs(fixtures, { search: "", from: "2026-10-20", to: "2026-10-20" })
      .length,
    1,
  );
  assert.equal(
    d.filterLogs(fixtures, { ...d.emptyLogFilters, search: " s-demo-1 " })[0]
      .id,
    fixtures[0].id,
  );
  assert.equal(
    d.filterLogs(fixtures, { ...d.emptyLogFilters, search: "no match" }).length,
    0,
  );
  assert.equal(d.pageLogs(fixtures.slice(0, 5), 2, 5).page, 1);
});
