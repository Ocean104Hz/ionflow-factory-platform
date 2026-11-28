import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const shell = read("src/components/factory/app-shell.tsx");
const sidebar = read("src/components/ui/sidebar.tsx");
const css = read("app/globals.css");
test("factory main sidebar retains route filtering, active state and close-on-navigation", () => {
  for (const token of [
    "currentUser.modules.includes(navigationModuleKey(item.href))",
    '!item.alias && isNavigationActive(pathname, item.href)',
    "href={item.href}", "setOpenMobile(false)",
    'navigationGroups.filter((group) => group.key !== "MAINTENANCE").map',
    "if (!visible) return null", "menu(group.key)",
    "onOpenChange={updateSidebarOpen}",
  ]) assert.ok(shell.includes(token), token);
});
test("i-Tech dimensions and edge control preserve the mobile trigger", () => {
  for (const token of ['"--sidebar-width": "18rem"', '"--sidebar-width-icon": "5rem"',
    'className="factory-itech-edge-toggle"', "onClick={toggleSidebar}",
    "aria-expanded={!compact}", 'className="md:hidden"',
    'mobileClassName="factory-sidebar factory-sidebar-itech no-print"']) {
    assert.ok(shell.includes(token), token);
  }
  assert.ok(shell.includes('appearance="factory-itech"'));
  assert.ok(sidebar.includes('appearance: "default"'));
  assert.ok(sidebar.includes('"factory-itech": ""'));
  assert.ok(sidebar.includes("mobileClassName?: string;"));
  assert.ok(sidebar.includes('text-sidebar-foreground [&>button]:hidden", mobileClassName)'));
  assert.ok(css.includes('width: min(18rem, 88vw)'));
});
test("collapsible groups provide accessible expanded state and inert hidden content", () => {
  for (const token of ["useState<Record<string, boolean>>({})", "[key]: !(previous[key] ?? false)",
    "aria-expanded={!isCollapsed}", "aria-controls={contentId}", "id={contentId}",
    "inert={isCollapsed}", "aria-hidden={isCollapsed}", "onClick={() => toggleGroup(group.key)}",
    "hidden={!compact}"]) assert.ok(shell.includes(token), token);
  assert.ok(css.includes('factory-itech-group-content[aria-hidden="true"]'));
});
test("i-Tech colors and print styles are scoped to the main Factory sidebar", () => {
  for (const token of ['.factory-sidebar.factory-sidebar-itech', '--sidebar-itech-primary: #173b63',
    '--sidebar-itech-accent: #9ec23a', 'min-height: 44px', 'border-radius: 12px',
    'nav a.factory-itech-nav-item[aria-current="page"]', '@media (prefers-reduced-motion: reduce)',
    '@media print', '.factory-sidebar-itech .factory-itech-edge-toggle']) assert.ok(css.includes(token), token);
});

test("v2 uses i-Tech typography and category rhythm only inside the main sidebar", () => {
  const rule = (selector) => {
    const start = css.indexOf(selector + " {");
    assert.ok(start >= 0, selector);
    return css.slice(start, css.indexOf("}", start));
  };
  assert.match(rule(".factory-sidebar.factory-sidebar-itech"), /font-family: Arial, Helvetica, sans-serif/);
  const group = rule(".factory-sidebar-itech .factory-itech-group-trigger");
  for (const value of ["font-size: 0.75rem", "line-height: 1rem", "font-weight: 600", "color: #94a3b8"]) assert.ok(group.includes(value), value);
  const item = rule(".factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item");
  for (const value of ["font-size: 0.875rem", "font-weight: 500", "line-height: 1.25rem"]) assert.ok(item.includes(value), value);
  assert.ok(rule(".factory-sidebar-itech .factory-itech-group-items").includes("padding-left: 4px"));
  assert.ok(css.includes('gap: 20px;'));
  assert.ok(rule('[data-collapsible="icon"] .factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item').includes('justify-content: center'));
  assert.ok(rule('[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-group-items').includes('padding-left: 0'));
});
test("v2 section icons follow i-Tech while retaining Factory group titles and route filtering", () => {
  for (const token of ["PURCHASING: ShoppingCart", "QC: FlaskConical", "WAREHOUSE: Package", "PRODUCTION: Factory", "PACKING: Archive", "LOGISTICS: Receipt", "ITECH_SECTION_ICONS[group.key] ?? navigation.find", "{group.title}", "currentUser.modules.includes(navigationModuleKey(item.href))"]) assert.ok(shell.includes(token), token);
});

test("v3 overview links are direct and retain permission filtering without a collapsible header", () => {
  const visibility = shell.indexOf("if (!visible) return null;");
  const direct = shell.indexOf('if (group.key === "OVERVIEW")');
  const rest = shell.indexOf("const GroupIcon = ITECH_SECTION_ICONS[group.key]", direct);
  assert.ok(visibility >= 0 && visibility < direct && direct < rest);
  const block = shell.slice(direct, rest);
  assert.ok(block.includes("{menu(group.key)}"));
  assert.ok(block.includes('className="factory-itech-overview-links"'));
  assert.ok(block.includes('!compact && <div aria-hidden="true" className="factory-itech-overview-divider"'));
  assert.doesNotMatch(block, /SidebarGroupLabel|toggleGroup|collapsedGroups|aria-expanded|inert=/);
  assert.ok(shell.includes("currentUser.modules.includes(navigationModuleKey(item.href))"));
  assert.ok(css.includes(".factory-sidebar-itech .factory-itech-overview-divider"));
});
