import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

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
      "แบบบันทึกการส่งตัวอย่าง",
    ],
  ],
  WAREHOUSE: [
    "คลังสินค้า",
    [
      "รับวัตถุดิบและวัสดุ",
      "รับวัตถุดิบ (PO/QC/รับตรง)",
      "เบิกวัสดุ/วัตถุดิบ",
      "เบิกวัตถุดิบการผลิต",
      "สต็อกวัตถุดิบ",
    ],
  ],
  PRODUCTION: [
    "การผลิต",
    [
      "ใบสั่งผลิต",
      "ใบสูตรผลิต",
      "ใบสั่งผลิตสินค้า",
      "รายงานการผลิต",
      "รายงานการผลิตปุ๋ยเม็ด (กาญ 1)",
      "รายงานการผลิตปุ๋ยเม็ด (กาญ 3)",
      "รับยอดผลิต",
      "ใบรายงานการผลิต",
      "คลัง BOM",
      "สูตรผสมวัตถุดิบ",
    ],
  ],
  PACKING: ["บรรจุสินค้า", ["รายงานการบรรจุ", "ใบแจ้งสั่งแพ็คสินค้า"]],
  LOGISTICS: ["จ่ายและขนส่ง", ["ใบส่งสินค้า", "ใบจ่ายสินค้า"]],
  "SALES DOCUMENTS": ["เอกสารขาย", ["ใบแจ้งหนี้"]],
  MAINTENANCE: ["ซ่อมบำรุง", ["ใบแจ้งซ่อม", "รายการอุปกรณ์"]],
  "MASTER DATA": ["ข้อมูลหลัก", ["สินค้าและราคากลาง"]],
  SYSTEM: ["ระบบ", ["ตั้งค่าระบบ"]],
};
const routes = {
  แดชบอร์ด: "/dashboard",
  ประวัติการแก้ไข: "/audit_log",
  ตั้งค่าระบบ: "/settings",
  คำสั่งการผลิต: "/production-orders",
  PR: "/pr",
  ตรวจสอบวัตถุดิบ: "/qc_raw_material",
  สูตรผสมวัตถุดิบ: "/bom",
  ใบส่งสินค้า: "/delivery-orders",
  ใบแจ้งหนี้: "/invoices",
  สินค้าและราคากลาง: "/products",
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
    alias: /alias:\s*true/.test(rest),
  }));
  const groups = [
    ...source
      .slice(source.indexOf("export const navigationGroups"))
      .matchAll(/key:\s*"([^"]+)",\s*title:\s*"([^"]+)"/g),
  ].map(([, key, title]) => ({ key, title }));
  return { items, groups };
}
test("sidebar has 36 canonical items in the approved business groups", () => {
  const { items, groups } = catalog();
  const titles = items.map((item) => item.title);
  assert.equal(items.length, 36);
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
  ])
    assert.ok(!titles.includes(removed), removed);
});
test("all ten implemented routes remain accessible once, with no fabricated placeholder links", () => {
  const { items } = catalog();
  const linked = items.filter((item) => item.href);
  assert.equal(linked.length, 10);
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

test("sidebar keeps shared shadcn navigation and safe inline placeholders instead of broken routes", () => {
  const shell = read("src/components/factory/app-shell.tsx");
  for (const token of [
    "SidebarMenuButton",
    "SidebarGroupLabel",
    "navigationGroups.map",
    "menu(group.key)",
    "onPreview(item.title)",
    "เร็วๆนี้",
    "ยังไม่มีหน้าสาธิต",
    'role="status"',
    "!item.alias",
    "setOpenMobile(false)",
    "group-data-[collapsible=icon]:overflow-y-auto",
  ])
    assert.ok(shell.includes(token), token);
  assert.match(shell, /item.href \? \(/);
  assert.match(shell, /key=\{item.title\}/);
  assert.doesNotMatch(shell, /href="#"|window\.location|https:\/\//);
});
