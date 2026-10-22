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
// Existing Node/TypeScript/React renderer only; no added test framework.
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
      "src/features/bulk-production-orders/bulk-production-domain.ts",
    ),
  )
);
const { bulkOrders: fixtures, bulkProducts } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/bulk-production-orders.ts"))
);
const { BulkProductionForm: Form } = await import(
  moduleURL(
    path.join(
      root,
      "src/features/bulk-production-orders/bulk-production-form.tsx",
    ),
  )
);
const { BulkProductionDocument: Document } = await import(
  moduleURL(
    path.join(
      root,
      "src/features/bulk-production-orders/bulk-production-detail.tsx",
    ),
  )
);
const draft = () => ({
  ...structuredClone(fixtures[0]),
  id: "",
  header: { ...fixtures[0].header, docNo: "UI-NEW" },
});
const save = (records, doc, id = "new-doc") =>
  d.saveBulkOrder(records, doc, id, "2026-10-21T04:00:00.000Z");

// Authoritative visible-control checklist, transcribed independently from iCON header/detail/signers.
const headerFields = [
  ["date", "date"],
  ["docNo", "text"],
  ["planTons", "number"],
  ["targetBags", "number"],
  ["productionDays", "number"],
  ["payDate", "date"],
];
const rowFields = [
  ["productCode", "text"],
  ["product", "text"],
  ["qty", "number"],
  ["lot", "text"],
  ["size", "number"],
  ["carryQty", "number"],
  ["carryNote", "text"],
  ["sizeNote", "text"],
];
const signers = ["issuer", "qc", "production", "manager"];
// No source inputs: row.itemName (legacy fallback name), qtyUnit/countUnit (implicit units), header.producedTons (planned-ton alias at save).
// Intentional differences: explicit document note editor; keep manual carryQty instead of API normalization that overwrites it; blank dates until entered.

test("header dates, document number uniqueness and numeric constraints", () => {
  assert.ok(d.validateBulkOrder(d.blankBulkOrder(), fixtures)["header.date"]);
  assert.ok(d.validateBulkOrder(d.blankBulkOrder(), fixtures)["header.docNo"]);
  assert.ok(d.validateBulkOrder(d.blankBulkOrder(), fixtures).rows);
  for (const value of ["2026-02-30", "bad"])
    assert.ok(
      d.validateBulkOrder(
        { ...draft(), header: { ...draft().header, date: value } },
        fixtures,
      )["header.date"],
    );
  assert.ok(
    d.validateBulkOrder(
      { ...draft(), header: { ...draft().header, docNo: " bulk-demo-1 " } },
      fixtures,
    )["header.docNo"],
  );
  for (const key of ["planTons", "targetBags"])
    for (const n of [-1, NaN, Infinity])
      assert.ok(
        d.validateBulkOrder(
          { ...draft(), header: { ...draft().header, [key]: n } },
          fixtures,
        )[`header.${key}`],
      );
  const optional = draft();
  optional.header.planTons = null;
  optional.header.targetBags = null;
  optional.header.productionDays = "";
  optional.header.payDate = "";
  assert.deepEqual(d.validateBulkOrder(optional, fixtures), {});
  assert.ok(
    d.validateBulkOrder(
      {
        ...draft(),
        header: { ...draft().header, targetBags: 1.5, productionDays: "-2" },
      },
      fixtures,
    )["header.targetBags"],
  );
});
test("product, Lot, quantity, size validation and optional later production details", () => {
  const doc = draft();
  for (const key of ["product", "lot"]) {
    const invalid = structuredClone(doc);
    invalid.rows[0][key] = "";
    assert.ok(
      d.validateBulkOrder(invalid, fixtures)[`rows.${doc.rows[0].id}.${key}`],
    );
  }
  for (const key of ["qty", "size", "producedQty", "carryQty"])
    for (const n of [-1, NaN, Infinity]) {
      const invalid = structuredClone(doc);
      invalid.rows[0][key] = n;
      assert.ok(
        d.validateBulkOrder(invalid, fixtures)[`rows.${doc.rows[0].id}.${key}`],
      );
    }
  assert.deepEqual(d.validateBulkOrder(doc, fixtures), {});
  for (const key of ["qty", "size"]) {
    const invalid = structuredClone(doc);
    invalid.rows[0][key] = null;
    assert.ok(
      d.validateBulkOrder(invalid, fixtures)[`rows.${doc.rows[0].id}.${key}`],
    );
  }
});
test("all three source time/signer-note pairs validate in both directions without requiring schedules", () => {
  for (const [key, note, value] of [
    ["startTime", "startTimeNote", "23:00"],
    ["endTime", "endTimeNote", "01:00"],
    ["signer", "signerNote", "ผู้ผลิตสมมติ"],
  ]) {
    let doc = draft();
    doc.rows[0][key] = value;
    assert.ok(
      d.validateBulkOrder(doc, fixtures)[`rows.${doc.rows[0].id}.${note}`],
    );
    doc.rows[0][note] = "รายละเอียด";
    assert.deepEqual(d.validateBulkOrder(doc, fixtures), {});
    doc.rows[0][key] = "";
    assert.ok(
      d.validateBulkOrder(doc, fixtures)[`rows.${doc.rows[0].id}.${key}`],
    );
  }
  const doc = draft();
  doc.rows[0].startTime = "23:00";
  doc.rows[0].startTimeNote = "กะกลางคืน";
  doc.rows[0].endTime = "01:00";
  doc.rows[0].endTimeNote = "วันถัดไป";
  assert.deepEqual(d.validateBulkOrder(doc, fixtures), {});
});
test("independent rows and mock product/formula selection preserve all other values", () => {
  const original = draft();
  const before = structuredClone(original);
  const added = {
    ...original,
    rows: [...original.rows, d.newBulkRow("row-new")],
  };
  const selected = d.selectBulkProduct(added, "row-new", bulkProducts[1]);
  assert.equal(selected.rows[2].productCode, bulkProducts[1].code);
  assert.equal(selected.rows[2].size, 25);
  assert.equal(selected.rows[2].lot, bulkProducts[1].formulaVersion);
  const changed = d.updateBulkRow(selected, "row-new", {
    qty: 20,
    carryQty: 9,
    carryNote: "เก็บไว้",
    producedQty: 10,
  });
  const afterOutput = d.updateBulkRow(changed, "row-new", { producedQty: 19 });
  assert.equal(afterOutput.rows[2].carryQty, 9);
  assert.equal(afterOutput.rows[2].carryNote, "เก็บไว้");
  assert.deepEqual(afterOutput.rows.slice(0, 2), original.rows);
  assert.deepEqual(d.removeBulkRow(afterOutput, "row-new").rows, original.rows);
  assert.deepEqual(original, before);
});
test("summary uses ordered bags and actual remaining, not target subtraction or mixed tons", () => {
  const doc = draft();
  doc.header.targetBags = 999;
  doc.rows[0].producedQty = 20;
  doc.rows[1].producedQty = 70;
  doc.rows.push({
    ...d.newBulkRow("tons"),
    qty: 8,
    producedQty: 2,
    qtyUnit: "ตัน",
  });
  assert.deepEqual(d.bulkSummary(doc), {
    totalBags: 100,
    targetBags: 999,
    remainingBags: 30,
  });
  assert.equal(d.remainingQty(doc.rows[1]), 0);
});
test("derived source progress states include completed-report fallback without writing actual output", () => {
  const doc = draft();
  assert.equal(d.bulkProgress(doc), "รอดำเนินการ");
  doc.rows[0].producedQty = 10;
  assert.equal(d.bulkProgress(doc), "กำลังผลิต");
  doc.rows.forEach((r) => (r.producedQty = r.qty));
  assert.equal(d.bulkProgress(doc), "เสร็จสิ้น");
  const fallback = draft();
  fallback.rows.forEach((r) =>
    Object.assign(r, {
      prodDate: "2026-10-21",
      startTime: "09:00",
      endTime: "10:00",
      signer: "สมมติ",
    }),
  );
  const before = structuredClone(fallback);
  assert.equal(d.bulkProgress(fallback), "เสร็จสิ้น");
  assert.deepEqual(fallback, before);
});
test("CRUD round-trips all header/row/note/signer fields with stable identity and no fixture mutation", () => {
  const before = structuredClone(fixtures);
  const doc = draft();
  for (const key of [
    "sizeNote",
    "prodDateNote",
    "startTimeNote",
    "endTimeNote",
    "signerNote",
    "carryNote",
    "rowTotalNote",
  ])
    doc.rows[0][key] = `ค่า ${key}`;
  Object.assign(doc.rows[0], {
    prodDate: "2026-10-21",
    startTime: "09:00",
    endTime: "11:00",
    signer: "ผู้ผลิต",
    producedQty: 17,
    carryQty: 8,
    itemName: "ชื่อภายในเดิม",
  });
  doc.note = "หมายเหตุเอกสาร";
  signers.forEach((key) => (doc.docSigners[key] = `ชื่อ ${key}`));
  const created = save(fixtures, doc);
  assert.equal(created.records.length, 7);
  assert.deepEqual(created.saved.rows, doc.rows);
  assert.deepEqual(created.saved.docSigners, doc.docSigners);
  assert.equal(created.saved.note, doc.note);
  assert.equal(created.saved.header.producedTons, doc.header.planTons);
  const edited = save(created.records, { ...created.saved, note: "แก้ไขแล้ว" });
  assert.equal(edited.saved.id, created.saved.id);
  assert.equal(edited.saved.createdAt, created.saved.createdAt);
  assert.equal(edited.records.length, 7);
  assert.deepEqual(
    d.deleteBulkOrder(edited.records, edited.saved.id),
    fixtures,
  );
  assert.deepEqual(d.deleteBulkOrder(fixtures, "missing"), fixtures);
  assert.deepEqual(fixtures, before);
});
test("history search/date filters find exact mock documents", () => {
  const f = { search: "", from: "", to: "" };
  assert.equal(
    d.filterBulkOrders(fixtures, { ...f, search: "  bulk-demo-1 " }).length,
    1,
  );
  assert.equal(
    d.filterBulkOrders(fixtures, { ...f, from: "2026-10-12", to: "2026-10-13" })
      .length,
    2,
  );
  assert.equal(
    d.filterBulkOrders(fixtures, { ...f, search: "ไม่มีข้อมูลนี้" }).length,
    0,
  );
});
test("actual rendered order controls match independent source manifest: 6 header, 8 planned fields per row, 4 signers and document note", () => {
  const doc = draft();
  const html = renderToStaticMarkup(
    React.createElement(Form, {
      doc,
      errors: {},
      onChange() {},
      onSave() {},
      onCancel() {},
    }),
  );
  const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);
  const check = (key, type) => {
    const tag = inputs.find((t) => t.includes(`name="${key}"`));
    assert.ok(tag, key);
    assert.ok(tag.includes(`type="${type}"`), key);
    assert.ok(!/\s(?:disabled|readonly)(?:=|\s|>)/i.test(tag), key);
    assert.ok(html.includes(`for="bulk-${key}"`), key);
  };
  headerFields.forEach(([key, type]) => check(`header.${key}`, type));
  for (const row of doc.rows)
    rowFields.forEach(([key, type]) => check(`rows.${row.id}.${key}`, type));
  signers.forEach((key) => check(`docSigners.${key}`, "text"));
  assert.match(html, /<textarea[^>]*name="note"/);
  for (const hidden of [
    "header.producedTons",
    `rows.${doc.rows[0].id}.itemName`,
    `rows.${doc.rows[0].id}.qtyUnit`,
    `rows.${doc.rows[0].id}.countUnit`,
    `rows.${doc.rows[0].id}.producedQty`,
    `rows.${doc.rows[0].id}.prodDate`,
    `rows.${doc.rows[0].id}.startTime`,
    `rows.${doc.rows[0].id}.endTime`,
  ])
    assert.ok(!inputs.some((t) => t.includes(`name="${hidden}"`)), hidden);
  assert.ok(html.includes(doc.rows[0].productCode));
  assert.ok(html.includes(doc.docSigners.manager));
});
test("print groups seven rows, retains every row/notes/signers, escapes user text and never clips with fixed heights", () => {
  const doc = draft();
  doc.rows = Array.from({ length: 8 }, (_, i) => ({
    ...doc.rows[0],
    id: `print-${i}`,
    product: `สินค้าแถว ${i}`,
    sizeNote: `หมายเหตุ ${i}`,
  }));
  doc.note = "<script>not-html</script>";
  assert.deepEqual(
    d.bulkPrintPages(doc.rows).map((p) => p.length),
    [7, 1],
  );
  const html = renderToStaticMarkup(React.createElement(Document, { doc }));
  assert.equal((html.match(/data-bulk-print-row=/g) || []).length, 8);
  for (const row of doc.rows) {
    assert.ok(html.includes(row.product));
    assert.ok(html.includes(row.sizeNote));
  }
  signers.forEach((key) => assert.ok(html.includes(doc.docSigners[key])));
  assert.ok(html.includes("&lt;script&gt;not-html&lt;/script&gt;"));
  const source = readFileSync(
    path.join(
      root,
      "src/features/bulk-production-orders/bulk-production-detail.tsx",
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(source, /contentWindow.print\(\)/);
});
test("internal production destinations are activated without a duplicate formula or BOM menu", () => {
  const source = readFileSync(
    path.join(root, "src/lib/constants/navigation.ts"),
    "utf8",
  );
  assert.equal(
    (source.match(/href: "\/bulk-production-orders"/g) || []).length,
    1,
  );
  assert.match(source, /title: "ใบสั่งผลิตสินค้า", href: "\/bulk-production-orders", icon: Factory/);
  assert.doesNotMatch(source, /title: "ใบสูตรผลิต"|title: "คลัง BOM"/);
  assert.match(source, /title: "รายงานการผลิต", href: "\/production-reports"/);
  assert.match(source, /title: "รับยอดผลิต", href: "\/production-receipts"/);
  assert.ok(
    existsSync(
      path.join(root, "app/(factory)/bulk-production-orders/page.tsx"),
    ),
  );
});
