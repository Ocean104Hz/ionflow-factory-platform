import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("sidebar catalog retains the combined factory menu names without duplicate labels", () => {
  const source = read("src/lib/constants/navigation.ts");
  const menu = source.slice(
    source.indexOf("export const navigation:"),
    source.indexOf("export const navigationGroups"),
  );
  const titles = [...menu.matchAll(/title:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(titles.length, new Set(titles).size);
  for (const title of [
    "แดชบอร์ด",
    "ประวัติการแก้ไข",
    "ตั้งค่าระบบ",
    "คำสั่งการผลิต",
    "PR",
    "PO",
    "ใบตรวจสอบวัตถุดิบ",
    "ใบตรวจวัตถุดิบ",
    "ใบรายงานผสมปุ๋ยผง",
    "ใบรายงานผลิตปุ๋ยอินทรีย์เคมี",
    "ใบ NC",
    "ใบส่งตัวอย่าง",
    "แบบบันทึกการส่งตัวอย่าง",
    "รายงานการตรวจสอบคุณภาพการผลิตปุ๋ยอินทรีย์/สารปรับสภาพดิน/หัวเชื้ออะมิโน, หัวเชื้อโอเอ็ม",
    "ใบรายงานการบรรจุปุ๋ยอินทรีย์/ปุ๋ยอินทรีย์เคมี/ปุ๋ยเคมี/สารปรับสภาพดิน",
    "ใบรับวัตถุดิบ/วัสดุ",
    "ใบรับวัตถุดิบ",
    "ใบเบิกวัสดุ/วัตถุดิบ",
    "สต็อกวัตถุดิบ",
    "ตั้งราคาสินค้า",
    "ใบสั่งผลิต",
    "ใบสูตรผลิต",
    "ใบสั่งผลิตสินค้า",
    "รายงานการผลิต",
    "รายงานการผลิตปุ๋ยเม็ด ประจำโรงงานกาญ 1",
    "รายงานการผลิตปุ๋ยเม็ด ประจำโรงงานกาญ 3",
    "ใบรับยอดผลิต",
    "ใบรายงานการผลิต",
    "ใบเบิกวัตถุดิบ",
    "คลัง BOM",
    "สูตรผสมวัตถุดิบ",
    "ใบแจ้งสั่งแพ็คสินค้า",
    "ใบส่งสินค้า",
    "ส่งสินค้า",
    "ใบจ่ายสินค้า",
    "ใบแจ้งหนี้",
    "ใบแจ้งซ่อม",
    "รายการอุปกรณ์",
    "สินค้าและราคากลาง",
  ])
    assert.ok(titles.includes(title), title);
  assert.equal(titles.length, 39);
  for (const href of [...menu.matchAll(/href:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  ))
    assert.ok(
      [
        "/dashboard",
        "/audit_log",
        "/production-orders",
        "/products",
        "/delivery-orders",
        "/invoices",
        "/settings",
        "/pr",
        "/qc_raw_material",
        "/bom",
      ].includes(href),
      href,
    );
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
  ])
    assert.ok(shell.includes(token), token);
  assert.match(shell, /item.href \? \(/);
  assert.match(shell, /key=\{item.title\}/);
  assert.doesNotMatch(shell, /href="#"|window\.location|https:\/\//);
});
