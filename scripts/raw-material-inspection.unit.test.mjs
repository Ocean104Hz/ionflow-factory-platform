import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read(
  "src/features/raw-material-inspections/inspection-domain.ts",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const {
  blankInspection,
  inspectionChecks,
  inspectionStatus,
  validateInspection,
} = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const example = () => ({
  ...blankInspection(),
  id: "demo",
  number: "QC-DEMO-9",
  date: "2026-10-15",
  location: "DEMO",
  lot: "LOT-DEMO",
  sender: "DEMO Supplier",
  material: "DEMO material",
});

test("QC print includes all fields, seven checks and escaped content on A5 landscape", async () => {
  const domainUrl = `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
  const printSource = ts
    .transpileModule(
      read("src/features/raw-material-inspections/inspection-print.ts"),
      { compilerOptions: { module: ts.ModuleKind.ESNext } },
    )
    .outputText.replace(
      /from ["']\.\/inspection-domain["']/,
      `from "${domainUrl}"`,
    );
  const { buildInspectionPrintHtml } = await import(
    `data:text/javascript;base64,${Buffer.from(printSource).toString("base64")}`
  );
  const row = example();
  row.reference = "IN-DEMO-9";
  row.checks.color.note = '<script>alert("x")</script>';
  const html = buildInspectionPrintHtml(
    row,
    {
      factoryName: "Demo & Factory",
      shortName: "DEMO",
      logoDataUrl: "javascript:bad",
    },
    true,
  );
  for (const token of [
    "A5 landscape",
    "ใบตรวจสอบคุณภาพวัตถุดิบ",
    row.number,
    row.lot,
    row.reference,
    "ผู้ตรวจสอบคุณภาพ",
    "ผู้อนุมัติ",
    "ยังไม่ได้บันทึก",
    "Demo &amp; Factory",
  ])
    assert.ok(html.includes(token), token);
  for (const { label } of inspectionChecks) assert.ok(html.includes(label));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.doesNotMatch(html, /<script>|javascript:bad|FR-P1-12/);
});

test("QC modal scrolls only the body, hides scrollbars and exposes a real print preview", () => {
  const page = read(
    "src/features/raw-material-inspections/raw-material-inspections.tsx",
  );
  const preview = read(
    "src/features/raw-material-inspections/inspection-print-preview.tsx",
  );
  assert.ok(page.includes("sm:max-w-[1600px]"));
  assert.ok(page.includes("qc-modal-scroll min-h-0 overflow-y-auto"));
  assert.ok(page.includes("flex-col gap-0 overflow-hidden"));
  assert.ok(page.includes("<InspectionPrintPreview row={form}"));
  assert.ok(read("app/globals.css").includes("scrollbar-width: none"));
  assert.ok(preview.includes("target.print()"));
  assert.ok(preview.includes('sandbox="allow-same-origin allow-modals"'));
  assert.ok(preview.includes("loadedHtml !== html"));
});

test("inspection validates drafts, unique numbers and trip count", () => {
  assert.ok(validateInspection(blankInspection(), []));
  const row = example();
  assert.equal(validateInspection(row, []), "");
  assert.ok(
    validateInspection({ ...row, id: "new" }, [row]).includes("มีอยู่แล้ว"),
  );
  assert.equal(validateInspection(row, [row]), "");
  assert.ok(validateInspection({ ...row, trip: "1.5" }, []));
  assert.ok(validateInspection({ ...row, approver: "DEMO" }, []));
});

test("completion requires inspector, seven results and reasons; N/A alone cannot pass", () => {
  const row = { ...example(), finalized: true };
  assert.equal(inspectionChecks.length, 7);
  assert.ok(validateInspection(row, []));
  row.inspector = "DEMO QC";
  row.inspectorDate = "2026-10-15";
  assert.ok(validateInspection(row, []).includes("7"));
  for (const check of Object.values(row.checks)) check.result = "pass";
  assert.equal(validateInspection(row, []), "");
  assert.equal(inspectionStatus(row), "ผ่าน");
  row.checks.bag.result = "fail";
  assert.ok(validateInspection(row, []).includes("เหตุผล"));
  row.checks.bag.note = "DEMO damaged bag";
  assert.equal(validateInspection(row, []), "");
  assert.equal(inspectionStatus(row), "ไม่ผ่าน");
  row.finalized = false;
  assert.equal(inspectionStatus(row), "รอตรวจสอบ");
  row.finalized = true;
  for (const check of Object.values(row.checks)) {
    check.result = "na";
    check.note = "DEMO not applicable";
  }
  assert.ok(validateInspection(row, []).includes("อย่างน้อย"));
});

test("QC route and menu use shared shadcn patterns with no backend", () => {
  const page = read(
    "src/features/raw-material-inspections/raw-material-inspections.tsx",
  );
  assert.ok(
    read("app/(factory)/qc_raw_material/page.tsx").includes(
      "RawMaterialInspections",
    ),
  );
  assert.ok(
    read("src/lib/constants/navigation.ts").includes(
      'href: "/qc_raw_material"',
    ),
  );
  for (const token of [
    "FactoryDataTable",
    "Pagination",
    "DialogContent",
    "SectionCard",
    "SelectField",
    "Textarea",
    "validateInspection",
    "setRecords",
    "บันทึกรอตรวจสอบ",
    "บันทึกผลตรวจครบถ้วน",
  ])
    assert.ok(page.includes(token), token);
  assert.doesNotMatch(page, /fetch\(|axios|\/api\//);
});
