import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const expectedGroups = {
  OVERVIEW: ["ภาพรวม", ["แดชบอร์ด", "ประวัติการแก้ไข"]],
  PURCHASING: ["จัดซื้อ", ["PR", "PO", "คำสั่งการผลิต"]],
  QC: [
    "ตรวจสอบคุณภาพ (QC)",
    [
      "ตรวจสอบวัตถุดิบ",
      "รายงานผสมปุ๋ยผง",
      "ตรวจสอบคุณภาพการผลิต",
      "ตรวจคุณภาพปุ๋ยอินทรีย์เคมี",
      "ใบ NC",
      "ใบส่งตัวอย่าง",
      "แบบบันทึกการนำเข้าส่งตัวอย่างวิเคราะห์",
      "i-Lab แบบบันทึกรับตัวอย่าง",
      "QC ตรวจเช็คน้ำหนักผลิตภัณฑ์",
    ],
  ],
  WAREHOUSE: [
    "คลังสินค้า",
    [
      "รับวัตถุดิบและวัสดุ",
      "เบิกวัสดุ/วัตถุดิบ",
      "ใบเบิกจ่ายวัสดุ",
      "สินค้าคงคลัง",
      "วัสดุคงเหลือลูกค้า",
      "สต็อกสินค้า",
      "วัสดุคงเหลือ Foliar Fertilizer",
      "สต็อก WIP Foliar Fertilizer",
      "สต็อก RM Foliar Fertilizer",
    ],
  ],
  PRODUCTION: [
    "การผลิต",
    [
      "ใบสั่งผลิตสินค้า V1",
      "สูตรผสมวัตถุดิบ",
      "รายงานการผลิต",
      "ใบรับยอดผลิต V1",
    ],
  ],
  ORGANIC: [
    "ชุดอินทรีย์",
    [
      "บันทึกการรับ-จ่าย WIP",
      "ใบตรวจรับวัตถุดิบ/รับเข้าวัตถุดิบ",
      "ใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต",
      "บันทึกการรับ-จ่าย วัตถุดิบต้มสกัด",
      "บันทึกการรับ-จ่ายวัตถุดิบเม็ดฟู่",
    ],
  ],
  PACKING: ["บรรจุสินค้า", ["รายงานการบรรจุ", "ใบแจ้งสั่งแพ็คสินค้า"]],
  LOGISTICS: ["จ่ายและขนส่ง", ["ใบส่งสินค้า", "ใบจ่ายสินค้า"]],
  "SALES DOCUMENTS": ["เอกสารขาย", ["ใบแจ้งหนี้"]],
  MAINTENANCE: ["ซ่อมบำรุง", ["ใบแจ้งซ่อม", "งานของช่าง", "รายการอุปกรณ์", "รายงานซ่อมบำรุง"]],
  "MASTER DATA": ["ข้อมูลหลัก", ["สินค้าและราคากลาง"]],
  SYSTEM: ["ระบบ", ["ตั้งค่าระบบ"]],
};
const routes = {
  ใบแจ้งซ่อม: "/repair-requests",
  งานของช่าง: "/maintenance-work",
  รายการอุปกรณ์: "/equipment",
  รายงานซ่อมบำรุง: "/maintenance-reports",
  PO: "/purchase-orders",
  "ใบสั่งผลิตสินค้า V1": "/product-production-orders-v1",
  รายงานการผลิต: "/production-reports",
  "ใบรับยอดผลิต V1": "/production-receipts-v1",
  "เบิกวัสดุ/วัตถุดิบ": "/material-requisitions",
  รับวัตถุดิบและวัสดุ: "/raw-material-receiving",
  แดชบอร์ด: "/dashboard",
  ประวัติการแก้ไข: "/audit_log",
  ตั้งค่าระบบ: "/settings",
  คำสั่งการผลิต: "/production-orders",
  PR: "/pr",
  ตรวจสอบวัตถุดิบ: "/qc_raw_material",
  รายงานผสมปุ๋ยผง: "/fertilizer-powder-mixing",
  ตรวจสอบคุณภาพการผลิต: "/production-quality",
  ตรวจคุณภาพปุ๋ยอินทรีย์เคมี: "/qc-organic-fertilizer",
  รายงานการบรรจุ: "/packaging-report",
  ใบแจ้งสั่งแพ็คสินค้า: "/packing-summary",
  "ใบ NC": "/nc-reports",
  ใบส่งตัวอย่าง: "/sample-submissions",
  แบบบันทึกการนำเข้าส่งตัวอย่างวิเคราะห์: "/sample-submission-log",
  "i-Lab แบบบันทึกรับตัวอย่าง": "/lab_sample_receiving",
  "QC ตรวจเช็คน้ำหนักผลิตภัณฑ์": "/qc_product_weight_check",
  ใบเบิกจ่ายวัสดุ: "/material-issues",
  สต็อกสินค้า: "/stock_products",
  วัสดุคงเหลือลูกค้า: "/stock_customer_materials",
  "วัสดุคงเหลือ Foliar Fertilizer": "/stock_remaining_materials_ff",
  "สต็อก WIP Foliar Fertilizer": "/stock_wip_ff",
  "สต็อก RM Foliar Fertilizer": "/stock_rm_ff",
  "บันทึกการรับ-จ่าย WIP": "/wip-receiving-issuing",
  "ใบตรวจรับวัตถุดิบ/รับเข้าวัตถุดิบ": "/organic_raw_material_receiving",
  "ใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต":
    "/organic_extraction_temperature",
  "บันทึกการรับ-จ่าย วัตถุดิบต้มสกัด":
    "/organic_extraction_material_ledger",
  "บันทึกการรับ-จ่ายวัตถุดิบเม็ดฟู่": "/effervescent_material_ledger",
  สูตรผสมวัตถุดิบ: "/bom",
  ใบส่งสินค้า: "/delivery-orders",
  ใบแจ้งหนี้: "/invoices",
  สินค้าและราคากลาง: "/products",
  สินค้าคงคลัง: "/inventory",
};
function catalog() {
  const source = read("src/lib/constants/navigation.ts");
  const menu = source.slice(
    source.indexOf("export const navigation:"),
    source.indexOf("export const navigationGroups"),
  );
  const items = [
    ...menu.matchAll(
      /\{\s*group:\s*"([^"]+)",\s*title:\s*"([^"]+)"([\s\S]*?)\}/g,
    ),
  ].map(([, group, title, rest]) => ({
    group,
    title,
    href: rest.match(/href:\s*"([^"]+)"/)?.[1],
    icon: rest.match(/icon:\s*(\w+)/)?.[1],
    alias: /alias:\s*true/.test(rest),
  }));
  const groups = [
    ...source
      .slice(source.indexOf("export const navigationGroups"))
      .matchAll(/key:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g),
  ].map(([, key, title]) => ({ key, title }));
  return { items, groups };
}
test("sidebar has canonical items in the approved business groups", () => {
  const { items, groups } = catalog();
  const titles = items.map((item) => item.title);
  assert.equal(titles.length, new Set(titles).size);
  assert.deepEqual(
    groups,
    Object.entries(expectedGroups).map(([key, [title]]) => ({ key, title })),
  );
  for (const [key, [, expected]] of Object.entries(expectedGroups))
    assert.deepEqual(
      items.filter((item) => item.group === key).map((item) => item.title),
      expected,
      key,
    );
  for (const item of items)
    assert.ok(
      groups.some((group) => group.key === item.group),
      item.title,
    );
  for (const removed of [
    "ส่งสินค้า",
    "ตั้งราคาสินค้า",
    "ใบตรวจสอบวัตถุดิบ",
    "ใบตรวจวัตถุดิบ",
    "รับวัตถุดิบ (PO/QC/รับตรง)",
    "เบิกวัตถุดิบการผลิต",
    "ใบสั่งผลิต",
    "รายงานการผลิตปุ๋ยเม็ด (กาญ 1)",
    "รายงานการผลิตปุ๋ยเม็ด (กาญ 3)",
    "รายงานการผลิตปุ๋ยเม็ด",
    "ใบรายงานการผลิต",
  ])
    assert.ok(!titles.includes(removed), removed);
});

test("production report variants collapse into one implemented production page", () => {
  const { items } = catalog();
  const reports = items.filter((item) => item.title === "รายงานการผลิต");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].group, "PRODUCTION");
  assert.equal(reports[0].icon, "Factory");
  assert.equal(reports[0].href, "/production-reports");
  assert.ok(!items.some((item) => item.title === "รายงานการผลิตปุ๋ยเม็ด"));
  assert.ok(!items.some((item) => item.title === "ใบรายงานการผลิต"));
});
test("implemented routes remain accessible once, with no fabricated placeholder links", () => {
  const { items } = catalog();
  const linked = items.filter((item) => item.href);
  assert.equal(new Set(linked.map((item) => item.href)).size, linked.length);
  for (const [title, href] of Object.entries(routes)) {
    const item = items.find((item) => item.title === title);
    assert.equal(item?.href, href, title);
    assert.equal(item.alias, false, title);
    assert.ok(
      existsSync(new URL(`../app/(factory)${href}/page.tsx`, import.meta.url)),
      href,
    );
  }
  for (const item of items.filter((item) => !Object.hasOwn(routes, item.title)))
    assert.equal(item.href, undefined, item.title);
});

test("receiving uses one warehouse entry for every intake mode", () => {
  const { items } = catalog();
  const receiving = items.filter((item) => item.title === "รับวัตถุดิบและวัสดุ");
  assert.equal(receiving.length, 1);
  assert.equal(receiving[0].href, "/raw-material-receiving");
  assert.equal(receiving[0].group, "WAREHOUSE");
  assert.equal(receiving[0].icon, "Package");
  assert.ok(!items.some((item) => item.title === "รับวัตถุดิบ (PO/QC/รับตรง)"));
});

test("inventory replaces the warehouse stock placeholder once without changing its icon or group", () => {
  const { items } = catalog();
  const inventory = items.filter((item) => item.title === "สินค้าคงคลัง");
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].href, "/inventory");
  assert.equal(inventory[0].group, "WAREHOUSE");
  assert.equal(inventory[0].icon, "Boxes");
  assert.ok(!items.some((item) => item.title === "สต็อกวัตถุดิบ"));
});

test("sidebar keeps shared shadcn navigation and filters unavailable modules", () => {
  const shell = read("src/components/factory/app-shell.tsx");
  for (const token of [
    "SidebarMenuButton",
    "SidebarGroupLabel",
    'navigationGroups.filter((group) => group.key !== "MAINTENANCE").map',
    "menu(group.key)",
    "currentUser.modules.includes(navigationModuleKey(item.href))",
    "!item.alias",
    "setOpenMobile(false)",
    "group-data-[collapsible=icon]:overflow-y-auto",
  ])
    assert.ok(shell.includes(token), token);
  assert.match(shell, /item.href \? \(/);
  assert.match(shell, /key=\{item.title\}/);
  assert.doesNotMatch(shell, /href="#"|window\.location|https:\/\//);
});

test("production V1 routes stay distinct from purchasing and replace hidden V2 routes", async () => {
  const { items } = catalog();
  const incoming = items.find((r) => r.title === "คำสั่งการผลิต");
  const productV1 = items.find((r) => r.title === "ใบสั่งผลิตสินค้า V1");
  assert.equal(incoming.group, "PURCHASING");
  assert.equal(incoming.href, "/production-orders");
  assert.equal(productV1.group, "PRODUCTION");
  assert.equal(productV1.href, "/product-production-orders-v1");
  assert.ok(!items.some((r) => r.group === "PRODUCTION" && r.title.endsWith(" V2")));
  assert.ok(!items.some((r) => r.title === "ใบสั่งผลิต"));
  assert.match(read("app/(factory)/production-orders/page.tsx"), /<ProductionOrderList\s*\/>/);
  assert.match(read("app/(factory)/product-production-orders-v1/page.tsx"), /<ProductProductionOrdersV1Workspace\s*\/>/);
  assert.match(read("app/(factory)/bulk-production-orders/page.tsx"), /redirect\("\/product-production-orders-v1"\)/);
  assert.match(read("app/(factory)/production-receipts/page.tsx"), /redirect\("\/production-receipts-v1"\)/);
  const nav = read("src/lib/constants/navigation.ts");
  const functionSource = nav.slice(nav.indexOf("export function isNavigationActive"), nav.indexOf("// Business navigation"));
  const code = ts.transpileModule(functionSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { isNavigationActive } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  for (const [pathname, expected] of [[incoming.href, incoming], [`${incoming.href}/existing-id`, incoming], [productV1.href, productV1]]) {
    assert.deepEqual(items.filter((r) => r.href && !r.alias && isNavigationActive(pathname,r.href)).map((r) => r.title), [expected.title]);
  }
  assert.equal(isNavigationActive("/production-orders-extra", incoming.href), false);
});
