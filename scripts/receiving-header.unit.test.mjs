import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  INB_MOCK_COUNTER_KEY,
  formatThaiBuddhistDate,
  inboundNumberPreview,
  legacyInboundCounters,
  isValidIsoDate,
  todayInBangkok,
} from "../src/features/raw-material-receiving/document-number.ts";

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("INB formatting uses selected Gregorian year-month and at least three sequence digits", () => {
  assert.equal(inboundNumberPreview("2026-10-21", 1).documentNo, "INB-2610001");
  assert.equal(inboundNumberPreview("2026-10-22", 2).documentNo, "INB-2610002");
  assert.equal(inboundNumberPreview("2026-11-01", 1).documentNo, "INB-2611001");
  assert.equal(
    inboundNumberPreview("2026-10-31", 1000).documentNo,
    "INB-26101000",
  );
});

test("old INB counter high-water marks are read without being reset or changed", () => {
  const storage = createStorage();
  storage.setItem(INB_MOCK_COUNTER_KEY, '{"2610":2}');
  assert.deepEqual(legacyInboundCounters(storage), { 2610: 2 });
  assert.equal(storage.getItem(INB_MOCK_COUNTER_KEY), '{"2610":2}');
});

test("INB rejects impossible dates and never increments their sequence", () => {
  const storage = createStorage();
  for (const date of [
    "",
    "2026-02-30",
    "2026-13-01",
    "20/10/2026",
    "2026-10-99",
  ]) {
    assert.equal(isValidIsoDate(date), false);
    assert.throws(() => inboundNumberPreview(date, 1));
  }
  assert.equal(storage.getItem(INB_MOCK_COUNTER_KEY), null);
});

test("INB refuses damaged counter storage rather than restarting and duplicating numbers", () => {
  const storage = createStorage();
  storage.setItem(INB_MOCK_COUNTER_KEY, "not-json");
  assert.throws(() => legacyInboundCounters(storage));
  storage.setItem(INB_MOCK_COUNTER_KEY, '{"2610":-1}');
  assert.throws(() => legacyInboundCounters(storage));
});

test("Bangkok dates and Buddhist display are independent of the machine timezone", () => {
  assert.equal(
    todayInBangkok(new Date("2026-10-19T18:00:00.000Z")),
    "2026-10-20",
  );
  assert.match(formatThaiBuddhistDate("2026-10-20"), /2569/);
});

test("header prototype includes every source screenshot label, including supplier evidence", () => {
  const s = readFileSync(
    new URL(
      "../src/features/raw-material-receiving/receiving-header.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const label of [
    "ส่วนหัวเอกสาร",
    "สถานที่",
    "วันที่รับเข้า",
    "วันที่ PO",
    "เอกสารเลขที่",
    "สร้างเลข INB",
    "ใบสั่งซื้อเลขที่ PO",
    "รหัสผู้จำหน่าย",
    "ชื่อผู้จำหน่าย",
    "ใบขอสั่งซื้อเลขที่ PR No.",
    "รหัสคลัง",
    "อ้างอิงเอกสารเลขที่ใบตรวจสอบคุณภาพวัตถุดิบ",
    "ผูกกับใบตรวจสอบคุณภาพ",
    "ล้างการผูก",
    "หลักฐานผู้จำหน่าย",
    "ใบสั่งของเล่มที่",
    "เลขที่",
    "เชื่อม PO เดิมอีกครั้ง",
    "ดึงจาก PO",
    "นำเข้า Excel",
  ]) {
    assert.ok(s.includes(label), `missing label: ${label}`);
  }
  assert.match(s, /onClick=\{generateNumber\}/);
  assert.match(s, /readOnly/);
});
