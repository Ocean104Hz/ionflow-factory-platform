
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const feature = "src/features/lab-sample-receiving/";

const paths = {
  page: "app/(factory)/lab-sample-receiving/page.tsx",
  domain: `${feature}lab-sample-receiving-domain.ts`,
  workspace: `${feature}lab-sample-receiving-workspace.tsx`,
  form: `${feature}lab-sample-receiving-form.tsx`,
  history: `${feature}lab-sample-receiving-history.tsx`,
  detail: `${feature}lab-sample-receiving-detail.tsx`,
  paper: `${feature}lab-sample-receiving-paper.tsx`,
  mock: "src/lib/mock-data/lab-sample-receiving.ts",
};

const read = (path) =>
  readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8",
  );

const source = Object.fromEntries(
  Object.entries(paths).map(([name, path]) => [
    name,
    read(path),
  ]),
);

const parse = (name) =>
  ts.createSourceFile(
    paths[name],
    source[name],
    ts.ScriptTarget.Latest,
    true,
    paths[name].endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );

const descendants = (root, accept) => {
  const found = [];

  const visit = (node) => {
    if (accept(node)) {
      found.push(node);
    }

    ts.forEachChild(node, visit);
  };

  visit(root);

  return found;
};

/*
 * 13 ช่องกรอกจากภาพต้นฉบับ
 * แต่บนกระดาษมี 12 คอลัมน์
 * เนื่องจาก Lot. และวันที่แสดงในคอลัมน์เดียวกัน
 */
const photographedFields = [
  "sent_date",
  "sent_time",
  "sample_name",
  "lot_no",
  "lot_date",
  "sample_characteristics",
  "analysis_request",
  "sender_name",
  "received_by",
  "received_date",
  "sample_code",
  "request_no",
  "remark",
];

/* ---------------- Form AST ---------------- */

const formTree = parse("form");

const formCalls = descendants(
  formTree,
  (node) =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    ["renderField", "field"].includes(
      node.expression.text,
    ),
).filter((node) => {
  const position =
    node.expression.text === "renderField" ? 2 : 1;

  return ts.isStringLiteral(
    node.arguments[position],
  );
});

const formFieldName = (call) =>
  call.arguments[
    call.expression.text === "renderField" ? 2 : 1
  ].text;

/* ---------------- Load Domain ---------------- */

const domainJs = ts.transpileModule(
  source.domain,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

const domainUrl =
  `data:text/javascript;base64,${Buffer.from(domainJs).toString("base64")}`;

const domain = await import(domainUrl);

/* ---------------- Test 1 ---------------- */

test(
  "all new i-Lab files parse as TypeScript/TSX",
  () => {
    for (const name of Object.keys(paths)) {
      const tree = parse(name);

      assert.deepEqual(
        tree.parseDiagnostics.map((diag) =>
          ts.flattenDiagnosticMessageText(
            diag.messageText,
            "\n",
          ),
        ),
        [],
        paths[name],
      );
    }
  },
);

/* ---------------- Test 2 ---------------- */

test(
  "the form exposes all 13 photographed inputs once",
  () => {
    assert.deepEqual(
      domain.LAB_SAMPLE_FIELDS,
      photographedFields,
    );

    assert.equal(
      new Set(domain.LAB_SAMPLE_FIELDS).size,
      13,
    );

    const found = formCalls.map(formFieldName);

    assert.equal(
      found.length,
      13,
      "expected exactly 13 input call sites",
    );

    assert.deepEqual(
      [...found].sort(),
      [...photographedFields].sort(),
    );

    for (const key of photographedFields) {
      assert.equal(
        found.filter((name) => name === key).length,
        1,
        key,
      );

      assert.ok(
        domain.LAB_SAMPLE_FIELD_LABELS[key],
        `missing label ${key}`,
      );
    }
  },
);

/* ---------------- Test 3 ---------------- */

test(
  "input values update their corresponding row in form state",
  () => {
    assert.match(
      source.form,
      /sheet\.rows\.map\(/,
    );

    assert.match(
      source.form,
      /\[field\]:\s*value/,
    );

    assert.match(
      source.form,
      /aria-invalid/,
    );

    if (
      source.form.includes("function renderField(")
    ) {
      assert.match(
        source.form,
        /value=\{row\[field\]\}/,
      );

      assert.match(
        source.form,
        /updateRow\(row\.id,\s*field,\s*value\)/,
      );

      assert.match(
        source.form,
        /value=\{value\}/,
      );

      assert.match(
        source.form,
        /onChange\(event\.currentTarget\.value\)/,
      );
    } else {
      assert.match(
        source.form,
        /const value = sheet\.rows\[rowIndex\]\[key\]/,
      );

      assert.match(
        source.form,
        /patchRow\(rowIndex,\s*key,\s*event\.target\.value\)/,
      );

      assert.match(
        source.form,
        /<Input\s+\{\.\.\.props\}/,
      );

      assert.match(
        source.form,
        /<Textarea\s+\{\.\.\.props\}/,
      );
    }
  },
);

/* ---------------- Test 4 ---------------- */

test(
  "Lot and date stay separate; analysis is free text",
  () => {
    const lot = formCalls.find(
      (call) => formFieldName(call) === "lot_no",
    );

    const date = formCalls.find(
      (call) => formFieldName(call) === "lot_date",
    );

    const analysis = formCalls.find(
      (call) =>
        formFieldName(call) === "analysis_request",
    );

    assert.ok(lot);
    assert.ok(date);
    assert.ok(analysis);

    assert.match(
      date.getText(formTree),
      /"date"/,
    );

    assert.match(
      analysis.getText(formTree),
      /multiline/,
    );

    assert.match(
      source.form,
      /Lot\.\/วันที่/,
    );

    assert.match(
      source.form,
      /รายละเอียดตัวอย่าง/,
    );

    assert.match(
      source.form,
      /สำหรับเจ้าหน้าที่/,
    );
  },
);

/* ---------------- Test 5 ---------------- */

test(
  "form provides add, remove, reset and submit actions",
  () => {
    assert.match(
      source.form,
      /onClick=\{addRow\}/,
    );

    assert.match(
      source.form,
      /removeRow\((?:row\.id|rowIndex)\)/,
    );

    assert.match(
      source.form,
      /blankLabSampleRow\(crypto\.randomUUID\(\)\)/,
    );

    assert.match(source.form, /onReset/);
    assert.match(source.form, /onSave\(\)/);

    assert.match(
      source.form,
      /event\.preventDefault\(\)/,
    );

    assert.match(
      source.form,
      /type="submit"/,
    );
  },
);

/* ---------------- Test 6 ---------------- */

test(
  "detail keeps all fields and combines Lot/date for display",
  () => {
    assert.match(
      source.detail,
      /<LabSampleReceivingPaper sheet=\{sheet\}/,
    );

    if (
      source.detail.includes("const detailFields")
    ) {
      const detailTree = parse("detail");

      const declaration = descendants(
        detailTree,
        (node) =>
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === "detailFields",
      )[0];

      assert.ok(
        declaration,
        "missing detailFields list",
      );

      const array = descendants(
        declaration.initializer,
        ts.isArrayLiteralExpression,
      )[0];

      assert.ok(
        array,
        "detailFields must be a static array",
      );

      const fields = array.elements
        .filter(ts.isStringLiteral)
        .map((node) => node.text);

      const displayed = photographedFields.filter(
        (key) => key !== "lot_date",
      );

      assert.deepEqual(fields, displayed);

      assert.match(
        source.detail,
        /formatLabLotDate\(row\)/,
      );

      assert.match(
        source.detail,
        /displayValue\(row, field\)/,
      );
    }
  },
);

/* ---------------- Test 7 ---------------- */

test(
  "paper has 12 columns in the original order and grouped headers",
  () => {
    const paperTree = parse("paper");

    const cells = descendants(
      paperTree,
      (node) =>
        ts.isJsxElement(node) &&
        node.openingElement.tagName.getText(
          paperTree,
        ) === "TableCell",
    );

    const expected = [
      "formatLabDate(row.sent_date)",
      "row.sent_time",
      "row.sample_name",
      "formatLabLotDate(row)",
      "row.sample_characteristics",
      "row.analysis_request",
      "row.sender_name",
      "row.received_by",
      "formatLabDate(row.received_date)",
      "row.sample_code",
      "row.request_no",
      "row.remark",
    ];

    assert.equal(
      cells.length,
      expected.length,
    );

    expected.forEach(
      (expression, index) => {
        assert.ok(
          cells[index]
            .getText(paperTree)
            .includes(expression),
          `paper column ${index + 1}: ${expression}`,
        );
      },
    );

    assert.match(
      source.paper,
      /colSpan=\{3\}/,
    );

    assert.match(
      source.paper,
      /colSpan=\{4\}/,
    );

    for (const label of [
      "i-Lab",
      "แบบบันทึกรับตัวอย่าง",
      "รายละเอียดตัวอย่าง",
      "สำหรับเจ้าหน้าที่",
      "Lot./วันที่",
      "เลขที่คำขอ",
      "หมายเหตุ",
    ]) {
      assert.ok(
        source.paper.includes(label),
        label,
      );
    }

    assert.match(
      source.paper,
      /splitLabPaperRows\(sheet\.rows\)/,
    );

    assert.match(
      source.paper,
      /LAB_PAPER_ROWS_PER_PAGE/,
    );

    assert.equal(
      domain.LAB_PAPER_ROWS_PER_PAGE,
      24,
    );
  },
);

/* ---------------- Test 8 ---------------- */

test(
  "workspace connects mock data, validation, form, history and detail",
  () => {
    const workspace = source.workspace;

    for (const token of [
      "structuredClone(demoLabSampleReceivingSheets)",
      "validateLabSheet",
      "saveLabSheet",
      "deleteLabSheet",
      "LabSampleReceivingForm",
      "LabSampleReceivingHistory",
      "LabSampleReceivingDetail",
      "onChange=",
      "onSave=",
      "onReset=",
      "onView=",
      "onEdit=",
      "onPrint=",
      "onDelete=",
    ]) {
      assert.ok(
        workspace.includes(token),
        `missing workspace connection: ${token}`,
      );
    }

    assert.doesNotMatch(
      workspace,
      /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/,
    );

    assert.match(
      source.page,
      /<LabSampleReceivingWorkspace/,
    );

    assert.match(
      source.mock,
      /export const demoLabSampleReceivingSheets/,
    );
  },
);
