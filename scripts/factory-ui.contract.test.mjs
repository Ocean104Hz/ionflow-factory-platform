// Narrow source contracts only; not a browser/component test runner.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("factory shell includes the five module links and mobile Sheet", () => {
  const shell = read("src/components/factory/app-shell.tsx");
  for (const route of [
    "dashboard",
    "production-orders",
    "delivery-orders",
    "invoices",
    "products",
  ])
    assert.ok(shell.includes(`href: "/${route}"`));
  assert.match(shell, /<Sheet /);
  assert.match(shell, /aria-label="เปิดเมนู"/);
  assert.match(shell, /renderNavigation\(collapsed\)/);
  assert.match(shell, /aria-expanded=\{!collapsed\}/);
  assert.match(shell, /renderNavigation\(\)/);
});
test("production detail has the eleven sections in the required order", () => {
  const detail = read(
    "src/features/production-orders/production-order-detail.tsx",
  );
  const matches = [
    ...detail.matchAll(/title=\{productionSections\[(\d+)\]\}/g),
  ].map((m) => Number(m[1]));
  assert.deepEqual(
    matches,
    Array.from({ length: 11 }, (_, i) => i),
  );
});
test("Sales Hub table preserves fourteen standard columns", () => {
  const list = read(
    "src/features/production-orders/production-order-list.tsx",
  ).split("export const datalinkColumns")[0];
  const labels = [...list.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, [
    "#",
    "เลขที่คำสั่งการผลิต",
    "บริษัทต้นทาง",
    "วันที่",
    "รายการ",
    "จำนวนรวม",
    "ราคารวม",
    "Rev.",
    "เอกสาร",
    "วัตถุดิบ",
    "การอนุมัติ",
    "การผลิต",
    "อัปเดตล่าสุด",
    "จัดการ",
  ]);
});
test("status palette, horizontal table overflow, and dialog safety are shared", () => {
  const patterns = read("src/components/factory/patterns.tsx");
  for (const tone of ["neutral", "info", "warning", "success", "destructive"])
    assert.ok(patterns.includes(`${tone}:`));
  assert.match(patterns, /overflow-x-auto/);
  const dialog = read("src/components/factory/confirm-dialog.tsx");
  assert.match(dialog, /DialogTitle/);
  assert.match(dialog, /DialogDescription/);
  assert.match(dialog, /f\.required && !values\[f\.name\]/);
  assert.match(dialog, /setOpen\(false\)/);
});

test("Login is a mock entry outside the factory shell and never stores credentials", () => {
  const login = read("src/features/login/login.tsx");
  assert.match(login, /MOCK LOGIN/);
  assert.match(login, /router\.push\("\/dashboard"\)/);
  assert.match(login, /e\.currentTarget\.reset\(\)/);
  assert.doesNotMatch(login, /localStorage|sessionStorage|fetch\(/);
  assert.match(read("app/layout.tsx"), /<BrandingProvider>/);
  assert.match(read("app/page.tsx"), /redirect\("\/login"\)/);
  assert.match(read("app/login/page.tsx"), /<Login \/>/);
});
