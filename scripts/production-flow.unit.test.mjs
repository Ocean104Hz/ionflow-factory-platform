import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

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
  });
  const code = output.outputText.replace(
    /(from\s+|import\s*)(["'])([^"']+)\2/g,
    (full, start, quote, spec) => {
      if (!spec.startsWith(".") && !spec.startsWith("@/"))
        return `${start}${quote}${import.meta.resolve(spec)}${quote}`;
      const base = spec.startsWith("@/")
        ? path.join(root, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const target = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]
        .find((candidate) => existsSync(candidate) && /\.(ts|tsx)$/.test(candidate));
      assert.ok(target, base);
      return `${start}${quote}${moduleURL(target)}${quote}`;
    },
  );
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  cache.set(file, url);
  return url;
}

const domain = await import(
  moduleURL(path.join(root, "src/features/production-flow/production-flow-domain.ts")),
);
const { bulkOrders } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/bulk-production-orders.ts")),
);
const { demoBOM } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/bom.ts")),
);
const { inventoryItems, inventorySites, inventoryWarehouses } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/inventory.ts")),
);
const { ledgerContext } = await import(
  moduleURL(path.join(root, "src/features/inventory/inventory-ledger-data.ts")),
);
const operations = await import(
  moduleURL(path.join(root, "src/features/inventory/inventory-operations-domain.ts")),
);
const { inventoryLedger } = await import(
  moduleURL(path.join(root, "src/lib/mock-data/inventory-ledger.ts")),
);

function recordedReport(sheet) {
  const report = domain.newProductionReport(sheet, sheet.lines[0].orderLineId, "PRD-000001");
  return {
    ...report,
    reportDate: "2026-10-22",
    shift: "กะเช้า",
    productionLine: "LINE-1",
    startTime: "08:00",
    endTime: "10:00",
    goodQuantity: 40,
    wasteQuantity: 1,
    operator: "ผู้ผลิตสาธิต",
    status: "RECORDED",
  };
}

test("formula issue creates an immutable active-version snapshot with scaled materials", () => {
  const bom = structuredClone(demoBOM);
  const sheet = domain.issueFormulaSheet(
    structuredClone(bulkOrders[0]),
    bom,
    "sheet-1",
    "2026-10-22T01:00:00.000Z",
  );
  assert.equal(sheet.lines.length, 2);
  assert.equal(sheet.lines[0].formulaVersion, "V2");
  assert.equal(sheet.lines[0].batchCount, 2.5);
  assert.equal(sheet.lines[0].ingredients[0].quantity, 2000);
  bom.formulas.find((row) => row.id === "formula-a2").ingredients[0].quantity = 1;
  assert.equal(sheet.lines[0].ingredients[0].quantity, 2000);
  assert.throws(
    () =>
      domain.issueFormulaSheet(
        { ...structuredClone(bulkOrders[0]), rows: [{ ...bulkOrders[0].rows[0], formulaId: "missing" }] },
        bom,
        "sheet-2",
        "2026-10-22T01:00:00.000Z",
      ),
    /ไม่มีสูตร Active/,
  );
});

test("report owns actual output, validates its source and never implies a stock receipt", () => {
  const sheet = domain.issueFormulaSheet(bulkOrders[0], demoBOM, "sheet-1", "2026-10-22T01:00:00.000Z");
  const report = recordedReport(sheet);
  assert.deepEqual(domain.productionReportErrors(report, [], [sheet]), {});
  const saved = domain.saveProductionReport([], [], report, [sheet], "report-1", "2026-10-22T03:00:00.000Z");
  assert.equal(saved.saved.status, "RECORDED");
  assert.equal(saved.saved.materials[0].actualQuantity, 2000);
  const over = { ...report, goodQuantity: sheet.lines[0].plannedQuantity + 1 };
  assert.ok(domain.productionReportErrors(over, [], [sheet]).goodQuantity);
  assert.equal(domain.productionOrderProgress(bulkOrders[0], []), "รอดำเนินการ");
  assert.equal(domain.productionOrderProgress(bulkOrders[0], [saved.saved]), "กำลังผลิต");
});

test("receipt rejects over-receipt and confirmation command is idempotent in Stock Ledger", () => {
  const sheet = domain.issueFormulaSheet(bulkOrders[0], demoBOM, "sheet-1", "2026-10-22T01:00:00.000Z");
  const report = { ...recordedReport(sheet), id: "report-1" };
  const item = inventoryItems.find((row) => row.id === sheet.lines[0].inventoryItemId);
  const site = inventorySites[0];
  const warehouse = inventoryWarehouses.find((row) => row.siteId === site.id);
  const location = operations.operationLocations(ledgerContext, warehouse.id)[0];
  const receipt = domain.newProductionReceipt(
    report,
    sheet,
    item,
    "RCV-999999",
    site.id,
    warehouse.id,
    location,
  );
  const saved = domain.saveProductionReceipt(
    [],
    receipt,
    [report],
    inventoryItems,
    inventorySites,
    inventoryWarehouses,
    [location],
    "receipt-1",
    "2026-10-22T04:00:00.000Z",
  );
  assert.ok(saved.saved);
  const confirmed = { ...saved.saved, status: "CONFIRMED" };
  const second = { ...receipt, documentNumber: "RCV-999998", quantity: "1" };
  assert.ok(
    domain.productionReceiptErrors(
      second,
      [confirmed],
      [report],
      inventoryItems,
      inventorySites,
      inventoryWarehouses,
      [location],
    ).quantity,
  );
  const command = {
    type: "RECEIVE",
    operationId: "production-receipt:receipt-1",
    documentNo: receipt.documentNumber,
    postedAt: "2026-10-22T04:00:00.000Z",
    actor: "ผู้ใช้งานสาธิต",
    note: "รับยอดผลิต",
    destination: {
      itemId: receipt.itemId,
      siteId: receipt.siteId,
      warehouseId: receipt.warehouseId,
      locationLabel: receipt.locationLabel,
      lotCode: receipt.lotCode,
      inventoryStatus: receipt.inventoryStatus,
      unit: receipt.unit,
    },
    quantity: receipt.quantity,
  };
  const first = operations.commitStockOperation(inventoryLedger, command, ledgerContext);
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  const duplicate = operations.commitStockOperation(first.events, command, ledgerContext);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
});

test("production forms cover the approved visible fields and routes", () => {
  const reports = readFileSync(
    path.join(root, "src/features/production-flow/production-reports-workspace.tsx"),
    "utf8",
  );
  for (const field of [
    "documentNumber",
    "reportDate",
    "productionLine",
    "startTime",
    "endTime",
    "goodQuantity",
    "wasteQuantity",
    "operator",
    "materials.${index}.actualQuantity",
    "note",
  ])
    assert.ok(reports.includes(field), field);
  const receipts = readFileSync(
    path.join(root, "src/features/production-flow/production-receipts-workspace.tsx"),
    "utf8",
  );
  for (const field of [
    "documentNumber",
    "quantity",
    "lotCode",
    "siteId",
    "warehouseId",
    "locationLabel",
    "inventoryStatus",
    "note",
  ])
    assert.ok(receipts.includes(field), field);
  assert.ok(existsSync(path.join(root, "app/(factory)/production-reports/page.tsx")));
  assert.ok(existsSync(path.join(root, "app/(factory)/production-receipts/page.tsx")));
});

test("production receipt UI keeps the iTECH document structure and Factory behavior", () => {
  const workspace = readFileSync(
    path.join(root, "src/features/production-flow/production-receipts-workspace.tsx"),
    "utf8",
  );
  const document = readFileSync(
    path.join(root, "src/features/production-flow/production-receipt-document.tsx"),
    "utf8",
  );

  for (const text of [
    'title="ใบรับยอดผลิต"',
    "สร้างใบรับยอดผลิต",
    "ประวัติใบรับยอดผลิต",
    "ส่วนหัวเอกสาร",
    "สถานที่ *",
    "วันที่เอกสาร",
    "เอกสารเลขที่",
    "รายการรับยอดการผลิต",
    "รหัสสินค้า",
    "จำนวนรับ",
    "หน่วยนับ",
    "ข้อมูลปลายทางคลัง",
    "หมายเหตุ",
  ]) {
    assert.ok(workspace.includes(text), text);
  }

  assert.ok(workspace.includes("flow.saveReceipt(receipt)"));
  assert.ok(workspace.includes("flow.confirmReceipt(receipt)"));
  assert.ok(workspace.includes('receipt.status === "CONFIRMED"'));
  assert.ok(workspace.includes('row.status === "DRAFT"'));
  assert.ok(workspace.includes('aria-label="ตารางรายละเอียดใบรับยอดผลิต เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"'));
  assert.ok(document.includes("receipt.quantity"));
  assert.ok(document.includes("receipt.lotCode"));
  assert.ok(document.includes("receipt.ledgerEventId"));
});

test("isolated production receipt V1 stays UI-only and keeps the iTECH form sections", () => {
  const workspace = readFileSync(
    path.join(
      root,
      "src/features/production-receipts-v1/production-receipt-v1-workspace.tsx",
    ),
    "utf8",
  );
  const types = readFileSync(
    path.join(
      root,
      "src/features/production-receipts-v1/production-receipt-v1-types.ts",
    ),
    "utf8",
  );

  for (const text of [
    "ใบรับยอดผลิต V1",
    "UI DRAFT",
    "เอกสารอ้างอิง",
    "รายละเอียดวัสดุ / สินค้า",
    "รายละเอียดการผลิต",
    "รายชื่อผู้ลงนาม",
    "ประวัติใบรับยอดผลิต V1",
    "หน้านี้ยังไม่บันทึกข้อมูลจริง",
  ])
    assert.ok(workspace.includes(text), text);

  assert.ok(workspace.includes("newReceiptItemV1()"));
  assert.ok(workspace.includes("disabled"));
  assert.ok(!workspace.includes("saveReceipt("));
  assert.ok(!workspace.includes("confirmReceipt("));
  assert.ok(types.includes("items: [newReceiptItemV1()]"));
  assert.ok(
    existsSync(
      path.join(root, "app/(factory)/production-receipts-v1/page.tsx"),
    ),
  );
});
