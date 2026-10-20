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
const address = await import(
  url(js(read("src/features/sample-submission-log/submission-log-address.ts")))
);
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
    "กำมะถันที่ละลายน้ำ (WS)",
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

test("five address parts round-trip, preserve unparseable text and reset dependent fields", () => {
  const raw = "  อาคารตัวอย่าง ชั้น 2\nข้อความที่แยกไม่ได้  ";
  assert.equal(address.parseRequesterAddress(raw).detail, raw);
  assert.equal(
    address.composeRequesterAddress(address.parseRequesterAddress(raw)),
    raw,
  );
  assert.equal(address.editRequesterAddress(raw, "detail", raw), raw);
  let value = raw;
  for (const [key, part] of Object.entries({
    province: "นครปฐม",
    district: "เมือง",
    subdistrict: "สนามจันทร์",
    zipcode: "73000",
  }))
    value = address.editRequesterAddress(value, key, part);
  const parts = address.parseRequesterAddress(value);
  assert.deepEqual(parts, {
    detail: raw,
    province: "นครปฐม",
    district: "เมือง",
    subdistrict: "สนามจันทร์",
    zipcode: "73000",
  });
  assert.equal(address.composeRequesterAddress(parts), value);
  assert.deepEqual(
    address.parseRequesterAddress(
      address.editRequesterAddress(value, "province", "กรุงเทพมหานคร"),
    ),
    {
      detail: raw,
      province: "กรุงเทพมหานคร",
      district: "",
      subdistrict: "",
      zipcode: "",
    },
  );
  assert.deepEqual(
    address.parseRequesterAddress(
      address.editRequesterAddress(value, "district", "ใหม่"),
    ),
    { ...parts, district: "ใหม่", subdistrict: "", zipcode: "" },
  );
  assert.equal(
    address.parseRequesterAddress(
      address.editRequesterAddress(value, "subdistrict", "ใหม่"),
    ).zipcode,
    "",
  );
  const legacy = "99 อาคาร ก ต.สนามจันทร์ อ.เมือง จ.นครปฐม 73000";
  assert.equal(address.parseRequesterAddress(legacy).detail, "99 อาคาร ก");
  assert.equal(
    address.editRequesterAddress(legacy, "province", "นครปฐม"),
    legacy,
  );
  const created = d.saveLog(
    [],
    {
      ...valid(),
      requester_address: value,
      sample_characteristics: "ข้อความ\nหลายบรรทัด",
      sample_code: "SHARED",
    },
    "address",
  );
  const updated = d.saveLog(
    created.records,
    {
      ...created.saved,
      requester_address: address.editRequesterAddress(
        created.saved.requester_address,
        "detail",
        raw + "เพิ่มเติม",
      ),
    },
    "unused",
  );
  assert.equal(updated.saved.id, "address");
  assert.equal(
    address.parseRequesterAddress(updated.saved.requester_address).detail,
    raw + "เพิ่มเติม",
  );
  assert.equal(updated.saved.sample_characteristics, "ข้อความ\nหลายบรรทัด");
  assert.equal(updated.saved.sample_code, "SHARED");
});

// Independent visible-field contract transcribed from the iCON business form.
// These are UI call sites/bindings, not the TypeScript interface being tested.
const formFields = [
  ["doc_no", "row.doc_no", "doc_no"],
  ["sample_code", "row.sample_code", "sample_code"],
  ["requester_name", "row.requester_name", "requester_name"],
  ["requester_phone", "row.requester_phone", "requester_phone"],
  ["requester_email", "row.requester_email", "requester_email"],
  ["requester_address", "address.detail", "detail", true],
  ["requester_province", "address.province", "province"],
  ["requester_district", "address.district", "district"],
  ["requester_subdistrict", "address.subdistrict", "subdistrict"],
  ["requester_zipcode", "address.zipcode", "zipcode"],
  ["sample_code_info", "row.sample_code", "sample_code"],
  ["sample_name", "row.sample_name", "sample_name"],
  [
    "sample_characteristics",
    "row.sample_characteristics",
    "sample_characteristics",
    true,
  ],
  ["sample_type_other", "row.sample_type.other_detail", "sample_type"],
  ["sample_form_other", "row.sample_form.other_detail", "sample_form"],
  ["analysis_other", "row.requested_items.other_detail", "requested_items"],
  ["quantity_amount", "q.amount", "quantity"],
  ["quantity_packaging", "q.packaging", "quantity"],
  ["sender_name", "row.sender_sign.signer_name", "sender_sign"],
  ["sender_date", "row.sender_sign.signed_date", "sender_sign"],
  [
    "abnormal_detail",
    "staff.sample_condition.abnormal_detail",
    "sample_condition",
    true,
  ],
  [
    "reject_reason",
    "staff.job_acceptance.reject_reason",
    "job_acceptance",
    true,
  ],
  ["received_by", "staff.received_by", "received_by"],
  ["received_date", "staff.received_date", "received_date"],
  ["accepted_by", "staff.accepted_by", "accepted_by"],
  ["accepted_date", "staff.accepted_date", "accepted_date"],
];

test("visible UI contract: 26 fields, 6 choice groups, conditional controls and shared detail/print mapping", () => {
  const source = read(
    "src/features/sample-submission-log/submission-log-form.tsx",
  );
  const ast = ts.createSourceFile(
    "form.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const calls = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ["field", "choice"].includes(node.expression.getText(ast))
    )
      calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const fields = calls.filter((n) => n.expression.getText(ast) === "field");
  assert.equal(fields.length, 26);
  for (const [key, value, target, multiline = false] of formFields) {
    const matches = fields.filter((n) => n.arguments[0]?.text === key);
    assert.equal(matches.length, 1, key);
    const args = matches[0].arguments;
    assert.equal(args[2].getText(ast), value, key + " current value");
    assert.ok(args[1].text.length > 0, key + " visible label");
    assert.ok(args[3].getText(ast).includes(target), key + " state target");
    assert.match(args[3].getText(ast), /patch\(/, key + " state update");
    assert.equal(
      args[6]?.kind === ts.SyntaxKind.TrueKeyword,
      multiline,
      key + " Textarea",
    );
    if (key.startsWith("requester_") && value.startsWith("address.")) {
      assert.match(
        args[3].getText(ast),
        /editRequesterAddress\(\s*row\.requester_address/,
      );
      assert.ok(args[3].getText(ast).includes(`"${target}"`));
    }
  }
  assert.deepEqual(
    calls
      .filter((n) => n.expression.getText(ast) === "choice")
      .map((n) => n.arguments[0].text),
    [
      "sample_type",
      "sample_form",
      "sample_return",
      "result_delivery",
      "sample_condition",
      "job_acceptance",
    ],
  );
  for (const [key, condition] of [
    ["sample_type_other", "row.sample_type.other_detail !== null"],
    ["sample_form_other", "row.sample_form.other_detail !== null"],
    ["analysis_other", "row.requested_items.other"],
    ["abnormal_detail", "staff.sample_condition.abnormal"],
    ["reject_reason", "staff.job_acceptance.rejected"],
  ]) {
    let node = fields.find((n) => n.arguments[0].text === key),
      guarded = false;
    while (node.parent) {
      node = node.parent;
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        node.left.getText(ast) === condition
      )
        guarded = true;
    }
    assert.ok(guarded, key + " conditional visibility");
  }
  assert.match(
    source,
    /<Textarea[\s\S]*?value=\{value\}[\s\S]*?onChange=\{\(e\) => set\(e.target.value\)\}/,
  );
  assert.match(
    source,
    /<Input[\s\S]*?value=\{value\}[\s\S]*?onChange=\{\(e\) => set\(e.target.value\)\}/,
  );
  assert.match(
    source,
    /<RadioGroup[\s\S]*?value=\{value\}[\s\S]*?onValueChange=\{set\}/,
  );
  assert.match(source, /analysisItems.map/);
  assert.match(source, /checked=\{row.requested_items\[key\]\}/);
  assert.match(source, /\[key\]: v === true/);
  for (const note of [
    "กิโลกรัม / กรัม",
    "รายงานผลการทดสอบจัดทำเป็นฉบับภาษาไทยเท่านั้น เว้นแต่รายการวิเคราะห์เป็นภาษาอังกฤษ",
    "{labSampleNote}",
  ])
    assert.ok(source.replace(/\s+/g, " ").includes(note));
  assert.match(
    read("src/features/sample-submission-log/submission-log-detail.tsx"),
    /<SubmissionLogSections row=\{row\} \/>/,
  );
});

test("all 32 authoritative analysis labels are preserved with corrected water-soluble spelling", () => {
  const labels = [
    "ความเป็นกรด - ด่าง(pH)",
    "ความชื้น (Moisture)",
    "ความถ่วงจำเพาะ (Specific gravity)",
    "ค่าการนำไฟฟ้า (EC)",
    "ฮิวมิก แอซิด (Humic acid)",
    "อินทรียวัตถุ (OM)",
    "ไนโตรเจนทั้งหมด (Total N)",
    "แอมโมเนียมไนโตรเจน (AN)",
    "ฟอสฟอรัสทั้งหมด (Total P₂O₅)",
    "ฟอสฟอรัสที่เป็นประโยชน์ (AVP)",
    "ฟอสฟอรัสที่ไม่ละลายในสารละลายซิเตรท (CIP)",
    "โพแทสเซียมทั้งหมด (Total K₂O)",
    "โพแทสเซียมที่ละลายน้ำ (WK₂O)",
    "แคลเซียมออกไซด์ (CaO)",
    "แมกนีเซียมออกไซด์ (MgO)",
    "กำมะถันทั้งหมด (S)",
    "เหล็กทั้งหมด (Fe)",
    "ทองแดงทั้งหมด (Cu)",
    "แมงกานีสทั้งหมด (Mn)",
    "สังกะสีทั้งหมด (Zn)",
    "โบรอน (B)",
    "แคลเซียมที่ละลายน้ำ (WCa)",
    "แมกนีเซียมที่ละลายน้ำ (WMg)",
    "กำมะถันที่ละลายน้ำ (WS)",
    "เหล็กที่ละลายน้ำ (WFe)",
    "ทองแดงที่ละลายน้ำ (WCu)",
    "แมงกานีสที่ละลายน้ำ (WMn)",
    "สังกะสีที่ละลายน้ำ (WZn)",
    "โบรอนที่ละลายน้ำ (WB)",
    "โมลิบดีนัมที่ละลายน้ำ (WMo)",
    "การย่อยสลายสมบูรณ์ (GI)",
    "อื่นๆ (ระบุ)",
  ];
  assert.deepEqual(
    d.analysisItems.map(([, label]) => label),
    labels,
  );
});
