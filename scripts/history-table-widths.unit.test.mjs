import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { clampColumnWidth, fillColumnWidths } from "../src/components/factory/history-table-widths.ts";

const columns = [{ key: "date", width: 140 }, { key: "user", width: 280 }, { key: "action", width: 150 }];
const sum = (widths) => Object.values(widths).reduce((total, width) => total + width, 0);

test("widths clamp like iTECH, including explicit limits and unset widths", () => {
  assert.equal(clampColumnWidth(columns[0], 0), 80);
  assert.equal(clampColumnWidth(columns[0], Infinity), 650);
  assert.equal(clampColumnWidth({ key: "check", minWidth: 48 }, 0), 48);
  assert.equal(clampColumnWidth({ key: "custom", minWidth: 112, maxWidth: 100 }, 700), 112);
  assert.deepEqual(fillColumnWidths([{ key: "untouched" }], {}, 0), { untouched: 180 });
});

test("repeated shrinking fills the viewport proportionally and preserves hidden widths", () => {
  const stored = Object.freeze({ date: 80, user: 80, action: 80, hidden: 402 });
  for (const available of [1920, 1440, 1024, 768]) {
    assert.deepEqual(fillColumnWidths(columns, stored, available), {
      date: available / 3, user: available / 3, action: available / 3,
    });
  }
  const wide = fillColumnWidths(columns, { date: 80, user: 180, action: 140 }, 1200);
  assert.deepEqual(wide, { date: 240, user: 540, action: 420 });
  assert.equal(stored.hidden, 402);
});

test("expanded columns overflow horizontally and react to viewport changes", () => {
  const stored = { date: 650, user: 650, action: 150 };
  assert.deepEqual(fillColumnWidths(columns, stored, 768), stored);
  assert.equal(sum(fillColumnWidths(columns, stored, 1440)), 1450);
  assert.ok(Math.abs(sum(fillColumnWidths(columns, stored, 1920)) - 1920) < 0.001);
  assert.deepEqual(fillColumnWidths(columns.slice(1), stored, 768), { user: 650, action: 150 });
});

test("only history tables use the shared fixed geometry and per-column overflow", () => {
  const source = readFileSync(new URL("../src/components/factory/patterns.tsx", import.meta.url), "utf8");
  assert.match(source, /new ResizeObserver\(measure\)/);
  assert.match(source, /width: tableWidth, minWidth: "100%", tableLayout: "fixed"/);
  assert.match(source, /\{isHistory && \(\s*<colgroup>/);
  assert.match(source, /c\.textOverflow === "wrap"[\s\S]*?overflow-hidden whitespace-normal[\s\S]*?: "truncate"/);
  assert.match(source, /: \{ minWidth \}/);
});
