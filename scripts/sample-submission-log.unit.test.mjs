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
const thaiDateURL = url(js(read("src/lib/date/thai-date.ts")));
const domainURL = url(
  js(read("src/features/sample_submission_log/submission_log_domain.ts")).replace(
    'from "../../lib/date/thai-date.ts"',
    'from "' + thaiDateURL + '"',
  ),
);
const d = await import(domainURL);
const address = await import(
  url(js(read("src/features/sample_submission_log/submission_log_address.ts")))
);
const fixtures = (
  await import(
    url(
      js(read("src/lib/mock-data/sample-submission-log.ts")).replace(
        /from ["']@\/src\/features\/sample_submission_log\/submission_log_domain["']/g,
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
  ["doc_date", 'row.doc_date ?? ""', "doc_date"],
  ["requester_name", "row.requester_name", "requester_name"],
  ["requester_phone", "row.requester_phone", "requester_phone"],
  ["requester_email", "row.requester_email", "requester_email"],
  ["requester_address", "address.detail", "detail", true],
  ["requester_province", "address.province", "province"],
  ["requester_district", "address.district", "district"],
  ["requester_subdistrict", "address.subdistrict", "subdistrict"],
  ["requester_zipcode", "address.zipcode", "zipcode"],
  ["sample_name", "row.sample_name", "sample_name", true],
  [
    "sample_characteristics",
    "row.sample_characteristics",
    "sample_characteristics",
    true,
  ],
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

test("visible UI contract: 24 direct fields, 6 choice groups, conditional controls and shared detail/print mapping", () => {
  const source = read(
    "src/features/sample_submission_log/submission_log_form.tsx",
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
      ["field", "choice", "sampleChoice"].includes(node.expression.getText(ast))
    )
      calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const fields = calls.filter((n) => n.expression.getText(ast) === "field");
  assert.equal(fields.length, 24);
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
      .filter((n) => ["choice", "sampleChoice"].includes(n.expression.getText(ast)))
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
  for (const key of ["sample_type", "sample_form"]) {
    const call = calls.find(node => node.expression.getText(ast) === "sampleChoice" && node.arguments[0].text === key);
    assert.equal(call.arguments[5].getText(ast), `row.${key}.other_detail`);
    assert.ok(call.arguments[6].getText(ast).includes(`${key}: { ...row.${key}, other_detail }`));
  }
  assert.match(source, /option === "other" &&\s*value === "other"/);
  assert.match(source, /setOtherDetail\(event.target.value\)/);
  for (const [key, condition] of [
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
    read("src/features/sample_submission_log/submission_log_detail.tsx"),
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

// NAN_SUBMISSION_LOG_ICON_FORM_V1
test("iCon sample log form uses capsule tabs and preserves draft on save failure", async () => {
  const source = read("src/features/sample_submission_log/submission_log_workspace.tsx");
  const form = read("src/features/sample_submission_log/submission_log_form.tsx");
  assert.match(source, /useState\("form"\)/);
  assert.match(source, /<TabsList[^>]*rounded-full/);
  assert.match(source, /<Tabs value=\{tab\} onValueChange=\{changeTab\}/);
  assert.match(form, /grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3/);
  assert.match(form, /checked=\{row.requested_items\[key\]\}/);
  assert.match(form, /rounded-none/);
  assert.match(form, /id="log-sample-code-display" value=\{row.sample_code\} readOnly/);
  const ast = ts.createSourceFile("workspace.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  let saveNode;
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "save") saveNode = node;
    ts.forEachChild(node, find);
  }
  find(ast);
  assert.ok(saveNode);
  const moduleSource = "export function makeSave(deps) { const { row, records, validateLog, setErrors, setMessage, summary, persist, newLogDraft, setRow, setBaseline, setTab } = deps; " + saveNode.getText(ast) + "; return save; }";
  const { makeSave } = await import(url(js(moduleSource)));
  for (const scenario of ["success", "failure", "invalid"]) {
    const events = [];
    const row = { id: "existing", doc_no: "SA-1" };
    const next = { id: "", doc_no: "" };
    const save = makeSave({
      row, records: [row], newLogDraft: () => next,
      validateLog: () => scenario === "invalid" ? { doc_no: "required" } : {},
      setErrors: (value) => events.push(["errors", value]),
      setMessage: (value) => events.push(["message", value]),
      summary: { current: { focus: () => events.push(["focus"]) } },
      persist: async (value) => { events.push(["persist", value]); if (scenario === "failure") throw new Error("save failed"); },
      setRow: (value) => events.push(["row", value]),
      setBaseline: (value) => events.push(["baseline", value]),
      setTab: (value) => events.push(["tab", value]),
    });
    await save();
    assert.equal(events.filter(([name]) => name === "persist").length, scenario === "invalid" ? 0 : 1);
    if (scenario === "success") {
      assert.ok(events.some(([name, value]) => name === "row" && value === next));
      assert.ok(events.some(([name, value]) => name === "baseline" && value === JSON.stringify(next)));
      assert.ok(events.some(([name, value]) => name === "tab" && value === "history"));
    } else {
      assert.ok(!events.some(([name]) => ["row", "baseline", "tab"].includes(name)));
    }
  }
});

// NAN_SUBMISSION_LOG_CSS_FIX_V1_1
test("staff signature order uses direct field classes without invalid CSS selectors", () => {
  const form = read("src/features/sample_submission_log/submission_log_form.tsx");
  const ast = ts.createSourceFile("form.tsx", form, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const fields = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText(ast) === "data-log-field")) fields.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(fields.length, 1);
  const classes = fields[0].attributes.properties.find((prop) => ts.isJsxAttribute(prop) && prop.name.getText(ast) === "className").getText(ast);
  assert.ok(classes.includes('!readOnly && (key === "received_by" || key === "received_date") && "order-2"'));
  assert.ok(classes.includes('!readOnly && (key === "accepted_by" || key === "accepted_date") && "order-4"'));
  assert.ok(!form.includes(["[&>", "[data-log-field="].join("")));
  assert.ok(form.includes('"mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "contents"'));
});

// NAN_SAMPLE_SUBMISSION_LOG_HISTORY_V2
test("iCon history card retains search, date filters, paging, row actions and confirmed delete", () => {
  const source = read("src/features/sample_submission_log/submission_log_history.tsx");
  const ast = ts.createSourceFile("history.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.match(source, /useState\(10\)/);
  assert.match(source, /<CardTitle[\s\S]*?ข้อมูลที่บันทึก/);
  assert.match(source, /bg-\[#173b63\]/);
  assert.match(source, /filterLogs\(records, filters\)/);
  assert.match(source, /pageLogs\(filtered, page, size\)/);
  assert.match(source, /logFilterError\(filters\)/);
  assert.match(source, /setPage\(1\)/);
  for (const key of ["search", "from", "to"]) assert.ok(source.includes(`updateFilter("${key}",`));
  assert.match(source, /selectedAnalysis\(r\)/);
  assert.match(source, /r\.sender_sign\.signed_date/);
  assert.match(source, /r\.sample_code/);
  assert.match(source, /r\.sample_name/);
  assert.match(source, /onView\(r\)/);
  assert.match(source, /onEdit\(r\)/);
  assert.match(source, /onPrint\(r\)/);
  assert.match(source, /setDeleteTarget\(r\)/);
  assert.match(source, /<AlertDialogAction[^>]*onClick=\{\(\) => \{ if \(deleteTarget\) onDelete\(deleteTarget\)/);
  assert.doesNotMatch(source, /FactoryDataTable|RowActionMenu/);
  const heads = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "TableHead") heads.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(heads.length, 6);
});

// NAN_SAMPLE_LOG_MANAGE_MENU_V3
test("sample log management menu matches the reference labels and keeps existing actions", () => {
  const source = read("src/features/sample_submission_log/submission_log_history.tsx");
  const ast = ts.createSourceFile("history.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const menu = source.slice(source.indexOf("<DropdownMenuContent"), source.indexOf("</DropdownMenuContent>"));
  const labels = ["ดูรายงาน", "พิมพ์เอกสาร", "แก้ไข", "นำออก Excel", "ลบเอกสาร"];
  let previous = -1;
  for (const label of labels) {
    const at = menu.indexOf(label);
    assert.ok(at > previous, label);
    previous = at;
  }
  assert.match(menu, /onSelect=\{\(\) => onView\(r\)\}/);
  assert.match(menu, /onSelect=\{\(\) => onPrint\(r\)\}/);
  assert.match(menu, /onSelect=\{\(\) => onEdit\(r\)\}/);
  assert.match(menu, /<DropdownMenuItem[^>]* disabled [^>]*><Download[^>]*\/>นำออก Excel/);
  assert.match(menu, /setDeleteTarget\(r\)/);
  assert.match(source, /if \(deleteTarget\) onDelete\(deleteTarget\)/);
  assert.match(source, /hover:text-\[#173b63\]!/);
  assert.match(menu, /w-52/);
});

// NAN_SAMPLE_LOG_CHECKBOX_V4
test("editable sample log single-choice controls show square checkmarks without changing selection semantics", () => {
  const source = read("src/features/sample_submission_log/submission_log_form.tsx");
  const ast = ts.createSourceFile("form.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const items = [], groups = [], checkboxes = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      if (tag === "RadioGroupItem") items.push(node.getText(ast));
      if (tag === "RadioGroup") groups.push(node.getText(ast));
      if (tag === "Checkbox") checkboxes.push(node.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(items.length, 2);
  for (const item of items) assert.ok(item.includes("!readOnly && squareChoiceClass"));
  assert.equal(groups.length, 2);
  for (const group of groups) {
    assert.ok(group.includes("value={value}"));
    assert.ok(group.includes("onValueChange={set}"));
    assert.ok(group.includes("disabled={readOnly}"));
  }
  for (const token of ["rounded-none", "[&_svg]:hidden", "data-[state=checked]:bg-[#173b63]", "after:hidden", "data-[state=checked]:after:block", "after:border-r-2", "after:border-b-2", "after:border-white", "after:rotate-45"]) {
    assert.ok(source.includes(token), token);
  }
  assert.equal(checkboxes.length, 1);
  assert.ok(checkboxes[0].includes("checked={row.requested_items[key]}"));
  assert.ok(checkboxes[0].includes("[key]: v === true"));
});

// NAN_SAMPLE_LOG_THAI_DATE_V5
test("all sample log dates use the shared Thai picker and formatter without changing ISO data", async () => {
  const shared = await import(thaiDateURL);
  for (const value of ["2026-11-27", "2024-02-29", "2000-01-01"]) {
    assert.equal(d.logDate(value), shared.formatThaiDate(value));
    assert.equal(d.validLogDate(value), true);
  }
  assert.equal(d.logDate("2026-11-27"), "27/11/2569");
  for (const value of ["", "2026-02-30", "27/11/2569", "2026-11-27T00:00:00Z"]) {
    assert.equal(d.logDate(value), "—");
    assert.equal(d.validLogDate(value), false);
  }
  const row = valid();
  row.sender_sign.signed_date = "2026-11-27";
  row.staff_section.received_date = "2026-11-27";
  row.staff_section.accepted_date = "2026-11-28";
  const saved = d.saveLog([], row, "thai-date-test").saved;
  assert.equal(saved.sender_sign.signed_date, row.sender_sign.signed_date);
  assert.equal(saved.staff_section.received_date, row.staff_section.received_date);
  assert.equal(saved.staff_section.accepted_date, row.staff_section.accepted_date);
  assert.equal(d.filterLogs([saved], { search: "", from: "2026-11-27", to: "2026-11-27" }).length, 1);
  assert.equal(d.filterLogs([saved], { search: "", from: "2026-11-28", to: "" }).length, 0);
  const form = read("src/features/sample_submission_log/submission_log_form.tsx");
  const ast = ts.createSourceFile("form.tsx", form, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  const dateFields = [], pickers = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "field" && node.arguments[5]?.text === "date") dateFields.push(node.arguments[0].text);
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ThaiBuddhistDatePicker") pickers.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(dateFields, ["doc_date", "sender_date", "received_date", "accepted_date"]);
  assert.equal(pickers.length, 1);
  for (const token of ["value={value}", "if (!disabled) set(nextValue)", "error={issue}", "disabled={disabled}"]) assert.ok(pickers[0].includes(token));
  assert.match(form, /type === "date" \? logDate\(value\)/);
  assert.match(form, /type === "date" \? \(\s*<ThaiBuddhistDatePicker/);
  assert.match(form, /id=\{!readOnly && type === "date" \? id : undefined\}/);
  const workspace = read("src/features/sample_submission_log/submission_log_workspace.tsx");
  assert.match(workspace, /<SubmissionLogSections\s+row=\{row\}\s+errors=\{errors\}\s+disabled=\{busy\}/);
  const history = read("src/features/sample_submission_log/submission_log_history.tsx");
  assert.equal((history.match(/<ThaiBuddhistDatePicker\b/g) || []).length, 2);
  assert.match(history, /formatThaiDate\(r\.sender_sign\.signed_date\)/);
  assert.match(read("src/features/sample_submission_log/submission_log_detail.tsx"), /<SubmissionLogSections row=\{row\} \/>/);
});

// NAN_SAMPLE_LOG_DEFAULT_DATES_V6
test("new sample log dates use Bangkok today and saved dates are never refreshed", async () => {
  const shared = await import(thaiDateURL);
  assert.equal(shared.todayInBangkok(new Date("2026-11-27T17:00:00Z")), "2026-11-28");
  const before = shared.todayInBangkok();
  const current = d.newLogDraft();
  const after = shared.todayInBangkok();
  assert.ok([before, after].includes(current.doc_date));
  const first = d.newLogDraft("2026-11-27");
  const dates = row => [row.doc_date, row.sender_sign.signed_date, row.staff_section.received_date, row.staff_section.accepted_date];
  assert.deepEqual(dates(first), Array(4).fill("2026-11-27"));
  assert.deepEqual(dates(d.blankLog()), Array(4).fill(""));
  assert.deepEqual(dates(current), Array(4).fill(current.doc_date));
  const row = valid();
  row.doc_date = "2026-11-25";
  row.sender_sign.signed_date = "2026-11-26";
  row.staff_section.received_date = "";
  row.staff_section.accepted_date = "2026-11-27";
  const saved = d.saveLog([], row, "date-regression").saved;
  const later = d.newLogDraft("2026-11-28");
  assert.deepEqual(dates(later), Array(4).fill("2026-11-28"));
  assert.deepEqual(dates(saved), dates(row));
  const changed = { ...saved, doc_date: "2026-11-29" };
  const edited = d.saveLog([saved], changed, "unused").saved;
  assert.deepEqual(dates(edited), dates(changed));
  assert.equal(d.validateLog({ ...row, doc_date: "2026-02-30" }, []).doc_date, "วันที่เอกสารไม่ถูกต้อง");
  const legacy = { ...saved };
  delete legacy.doc_date;
  assert.equal(d.withLogDocumentDate(legacy, saved).doc_date, saved.doc_date);
  assert.equal(d.withLogDocumentDate(legacy, legacy).doc_date, "");
  assert.equal(d.withLogDocumentDate({ ...legacy, doc_date: "" }, saved).doc_date, "");
  assert.equal(d.withLogDocumentDate({ ...legacy, doc_date: "2026-11-29" }, saved).doc_date, "2026-11-29");
  assert.equal(d.withLogDocumentDate({ ...legacy, doc_date: null }, saved).doc_date, null);
  assert.equal(legacy.doc_date, undefined);
  const workspace = read("src/features/sample_submission_log/submission_log_workspace.tsx");
  const ast = ts.createSourceFile("workspace.tsx", workspace, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length, 0);
  assert.match(workspace, /useState\(newLogDraft\)/);
  assert.match(workspace, /JSON.stringify\(row\)\)/);
  assert.match(workspace, /setRow\(structuredClone\(r\)\)/);
  assert.match(workspace, /setBaseline\(JSON.stringify\(r\)\)/);
  let tabNode;
  function find(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "changeTab") tabNode = node;
    ts.forEachChild(node, find);
  }
  find(ast);
  assert.ok(tabNode);
  const moduleSource = "export function makeTab(deps) { const { busy, loading, loadError, tab, row, baseline, newLogDraft, setRow, setBaseline, setTab } = deps; " + tabNode.getText(ast) + "; return changeTab; }";
  const { makeTab } = await import(url(js(moduleSource)));
  for (const scenario of ["new", "dirty", "saved", "busy", "history"]) {
    const original = scenario === "saved" ? saved : first;
    const events = [];
    const changeTab = makeTab({
      row: original, tab: "history", busy: scenario === "busy", loading: false, loadError: "",
      baseline: scenario === "dirty" ? "dirty" : JSON.stringify(original),
      newLogDraft: () => later,
      setRow: value => events.push(["row", value]),
      setBaseline: value => events.push(["baseline", value]),
      setTab: value => events.push(["tab", value]),
    });
    changeTab(scenario === "history" ? "history" : "form");
    assert.equal(events.some(([name]) => name === "row"), scenario === "new");
    if (scenario === "new") assert.deepEqual(events[0], ["row", later]);
    if (scenario === "busy") assert.deepEqual(events, []);
  }
  const server = read("src/server/qc-documents.ts");
  assert.match(server, /const sampleLogDefinition = define\([^\n]*blankLog\(\), validateLog, saveLog\)/);
  assert.match(server, /sampleLogDefinition\.save\(withLogDocumentDate\(raw, previous \? object\(previous\) : undefined\), records, at\)/);
});
