import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(
  new URL(
    "../src/features/product-production-orders-v1/workspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("production order V1 keeps the complete iTECH document UI scaffold", () => {
  for (const label of [
    "สร้างใบสั่งผลิต",
    "ประวัติใบสั่งผลิต",
    "เลขที่เอกสาร",
    "ผลิตปุ๋ย",
    "อ้างอิงเอกสาร ใบรายงานผสมปุ๋ยผง",
    "LINE - T1",
    "LINE - T2",
    "LINE - T4",
    "หมายเหตุ — แก้ไขได้",
    "ผู้ออกใบสั่งผลิต",
    "ฝ่ายตรวจสอบคุณภาพ",
    "ฝ่ายผลิต",
    "ผู้จัดการ",
    "ค้นหา (เอกสาร/โรงงาน/สูตรปุ๋ย)",
    "ยอดค้าง (ตัน)",
    "จัดการ",
    "สร้างหมายเลข PRD",
    "เลือกสูตรจาก BOM",
    "เลือก ใบรายงานผสมปุ๋ยผง",
    "ตรวจสอบรายการนำเข้า Excel",
  ]) {
    assert.ok(workspace.includes(label), `missing UI label: ${label}`);
  }
});

test("production order V1 stays UI-only until its data contract is approved", () => {
  assert.doesNotMatch(workspace, /fetch\s*\(/);
  assert.doesNotMatch(workspace, /\/api\//);
  assert.match(workspace, /หน้านี้เป็นโครง UI เท่านั้น/);
  assert.match(workspace, /ใช้เลขนี้ · รอเชื่อมระบบ/);
  assert.match(workspace, /<Button type="button" disabled className="h-10 px-6">/);
});
