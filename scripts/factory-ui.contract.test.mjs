// Narrow source contracts only; not a browser/component test runner.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("factory shell includes the five module links and mobile Sheet", () => {
  const shell = read("src/components/factory/app-shell.tsx");
  const catalog = read("src/lib/constants/navigation.ts");
  for (const route of [
    "dashboard",
    "production-orders",
    "delivery-orders",
    "invoices",
    "products",
  ])
    assert.ok(catalog.includes(`href: "/${route}"`));
  for (const primitive of [
    "SidebarProvider",
    "SidebarInset",
    "SidebarMenuButton",
    "SidebarTrigger",
    "SidebarGroupLabel",
    "Breadcrumb",
    "AvatarFallback",
  ])
    assert.ok(shell.includes(`<${primitive}`), primitive);
  assert.match(
    read("src/components/ui/sidebar.tsx"),
    /<Sheet open=\{openMobile\}/,
  );
  assert.match(shell, /setOpenMobile\(false\)/);
  for (const group of [
    "OVERVIEW",
    "PRODUCTION",
    "LOGISTICS",
    "SALES DOCUMENTS",
    "MASTER DATA",
    "SYSTEM",
  ])
    assert.ok((shell + catalog).includes(group));
  assert.doesNotMatch(shell, /renderNavigation|closedGroups|<aside/);
  assert.match(shell, /ionflow.sidebar.open/);
  assert.match(shell, /<AppSidebar/);
  assert.match(shell, /<SiteHeader/);
});

test("sidebar menu hover motion preserves shadcn states and reduced motion", () => {
  const sidebar = read("src/components/ui/sidebar.tsx");
  const styles = sidebar.slice(
    sidebar.indexOf("const sidebarMenuButtonVariants"),
    sidebar.indexOf("function SidebarMenuButton"),
  );
  for (const token of [
    "motion-safe:hover:scale-[1.02]",
    "motion-safe:active:scale-[0.98]",
    "motion-safe:hover:[&>svg]:scale-110",
    "motion-safe:hover:[&>span]:scale-[1.03]",
    "duration-200",
    "ease-out",
    "origin-left",
    "group-data-[collapsible=icon]:origin-center",
    "group-data-[collapsible=icon]:justify-center",
    "motion-reduce:transition-none",
    "motion-reduce:[&>svg]:transition-none",
    "motion-reduce:[&>span]:transition-none",
    "hover:bg-sidebar-accent",
    "hover:text-sidebar-accent-foreground",
    "focus-visible:ring-2",
    "data-[active=true]:bg-sidebar-accent",
  ])
    assert.ok(styles.includes(token), token);
  assert.doesNotMatch(
    styles,
    /hover:(?:h-|p-|text-\[|text-(?:xs|sm|base|lg|xl))/,
  );
  assert.match(sidebar, /<TooltipTrigger asChild>\{button\}<\/TooltipTrigger>/);
  assert.match(sidebar, /hidden=\{state !== "collapsed" \|\| isMobile\}/);
  assert.match(
    read("src/components/factory/app-shell.tsx"),
    /!compact && <span>ตั้งค่า<\/span>/,
  );
});

test("factory UI uses shared shadcn primitives instead of native control substitutes", () => {
  for (const path of [
    "src/components/factory/branding-editor.tsx",
    "src/components/factory/attachment-gallery.tsx",
    "src/features/dashboard/factory-daily-overview-chart.tsx",
  ])
    assert.doesNotMatch(
      read(path),
      /<(button|input|table|details|summary)(?:\s|>)/,
    );
  assert.match(
    read("src/features/dashboard/production-status-overview.tsx"),
    /<Progress/,
  );
  assert.match(
    read("src/features/dashboard/top-ordered-products.tsx"),
    /<ChartContainer/,
  );
  assert.match(read("src/components/ui/progress.tsx"), /value=\{value\}/);
  assert.match(read("AGENTS.md"), /official shadcn\/ui/);
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

test("settings groups reuse shadcn Tabs and keep user data mock only", () => {
  const settings = read("src/components/factory/settings-page.tsx");
  assert.match(settings, /<PageHeader[\s\S]*?title="ตั้งค่า"/);
  assert.match(settings, /<Tabs defaultValue="users"/);
  for (const label of ["ตั้งค่าผู้ใช้", "ตั้งค่าโรงงาน"])
    assert.ok(settings.includes(label));
  assert.match(settings, /<TabsContent[\s\S]*?value="users"/);
  assert.match(settings, /<TabsContent[\s\S]*?value="factory"/);
  assert.match(settings, /<UserSettings/);
  assert.match(
    read("src/components/factory/branding-editor.tsx"),
    /updateBranding\(draft\)/,
  );
  assert.match(read("app/(factory)/settings/page.tsx"), /<SettingsPage/);
  assert.doesNotMatch(
    settings + read("src/components/factory/branding-editor.tsx"),
    /<Dialog/,
  );
  for (const path of [
    "src/components/factory/app-shell.tsx",
    "src/features/login/login.tsx",
  ]) {
    assert.doesNotMatch(read(path), /ปรับแต่งโรงงาน/);
    assert.match(read(path), /href="\/settings"/);
  }
  const user = read("src/components/factory/user-settings.tsx");
  for (const primitive of [
    "Input",
    "Label",
    "Button",
    "FactoryDataTable",
    "SelectField",
  ])
    assert.ok(user.includes(`<${primitive}`));
  assert.match(user, /validateDemoUser\(profile, users\)/);
  assert.match(user, /type="email"/);
  assert.match(user, /aria-pressed=\{profile.modules.includes\(module.key\)\}/);
  assert.doesNotMatch(
    user,
    /localStorage|sessionStorage|fetch\(|type="password"|DialogClose|DialogFooter|<Dialog/,
  );
  assert.match(read("src/lib/mock-data/settings.ts"), /admin@example\.test/);
});

test("filter layout shares control sizing and field spacing across list pages", () => {
  const patterns = read("src/components/factory/patterns.tsx");
  const selectField = patterns.slice(
    patterns.indexOf("export function SelectField"),
    patterns.indexOf("export function FilterBar"),
  );
  assert.match(selectField, /className="grid min-w-0 gap-2"/);
  assert.match(
    selectField,
    /<SelectTrigger id=\{id\} className="w-full bg-surface"/,
  );
  assert.doesNotMatch(selectField, /space-y-2|h-10/);
  const filters = patterns.slice(patterns.indexOf("export function FilterBar"));
  assert.doesNotMatch(filters, /h-10|space-y-2/);
  assert.match(filters, /sm:grid-cols-2/);
  assert.match(filters, /grid items-end gap-3/);
  for (const path of [
    "src/features/production-orders/production-order-list.tsx",
    "src/features/documents/document-list.tsx",
    "src/features/products/products.tsx",
  ])
    assert.match(read(path), /<FilterBar/);
  for (const path of [
    "src/features/production-orders/production-order-list.tsx",
    "src/features/products/products.tsx",
  ]) {
    const page = read(path);
    assert.ok(page.indexOf("<FilterBar") < page.indexOf("<Tabs"));
  }
  assert.match(
    patterns,
    /\{actions && <div className="no-print flex flex-wrap gap-2"/,
  );
});

test("compact filter Popover preserves fields and rejects reversed dates before applying", () => {
  const source = read("src/components/factory/patterns.tsx");
  for (const field of [
    "draft.search",
    "draft.status",
    "draft.cancellation",
    "draft.productType",
    "draft.pageSize",
    "draft[key]",
  ])
    assert.ok(source.includes(field), field);
  assert.match(source, /<Popover open=\{filtersOpen\}/);
  const body = source.match(/function apply\(\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(body);
  const apply = new Function(
    "draft",
    "onApply",
    "setFilterError",
    "setFiltersOpen",
    body,
  );
  for (const [from, to, valid] of [
    ["2026-10-01", "2026-10-14", true],
    ["2026-10-14", "2026-10-01", false],
    ["", "", true],
  ]) {
    const draft = { from, to };
    let applied = null,
      error = "",
      open = false;
    apply(
      draft,
      (value) => {
        applied = value;
      },
      (value) => {
        error = value;
      },
      (value) => {
        open = value;
      },
    );
    assert.equal(applied, valid ? draft : null);
    assert.equal(open, !valid);
    assert.equal(Boolean(error), !valid);
  }
});

test("operations composition retains chart, ranking, latest orders and Appearance", () => {
  const dashboard = read("src/features/dashboard/dashboard.tsx");
  for (const component of [
    "SectionCards",
    "FactoryDailyOverviewChart",
    "ProductionStatusOverview",
    "TopOrderedProducts",
    "FactoryDataTable",
    "PeriodFilter",
  ])
    assert.ok(dashboard.includes(`<${component}`), component);
  assert.ok(dashboard.includes("คำสั่งการผลิตล่าสุด"));
  const metrics = read("src/features/dashboard/section-cards.tsx");
  for (const component of [
    "CardHeader",
    "CardTitle",
    "CardDescription",
    "CardFooter",
    "Badge",
  ])
    assert.ok(metrics.includes(`<${component}`), component);
  const editor = read("src/components/factory/branding-editor.tsx");
  for (const label of [
    "ข้อมูลแบรนด์",
    "สีธีม",
    "ตัวอย่าง",
    "บันทึกการปรับแต่ง",
  ])
    assert.ok(editor.includes(label));
  assert.match(
    read("src/components/factory/settings-page.tsx"),
    /<BrandingEditor/,
  );
  assert.match(read("src/features/dashboard/period-filter.tsx"), /<Tabs /);
});

test("document and product table domain columns remain available", () => {
  const documents = read("src/features/documents/document-list.tsx");
  for (const column of [
    "ลูกค้า",
    "วันที่",
    "จำนวนรายการ",
    "สถานะ",
    "อัปเดตล่าสุด",
  ])
    assert.ok(documents.includes(column), column);
  const products = read("src/features/products/products.tsx");
  for (const column of [
    "รหัสสินค้า",
    "ชื่อสินค้า",
    "ประเภท",
    "หน่วย",
    "สถานะ",
    "ราคาปัจจุบัน",
    "วันที่เริ่มใช้",
  ])
    assert.ok(products.includes(column), column);
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

test("shared polish keeps local typography, mobile targets and reduced-motion support", () => {
  const css = read("app/globals.css");
  assert.match(css, /\/fonts\/NotoSansThai-Variable\.ttf/);
  assert.match(css, /font-display: swap/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height: 44px/);
  assert.match(read("src/components/factory/app-shell.tsx"), /factory-sidebar/);
  assert.match(read("src/features/login/login.tsx"), /login-form-card/);
});
