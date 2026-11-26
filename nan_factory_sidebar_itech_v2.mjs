import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Incremental patch for the installed Nan factory sidebar v1.
const args = process.argv.slice(2);
const paths = [
  'src/components/factory/app-shell.tsx',
  'app/globals.css',
  'scripts/factory-sidebar-itech.contract.test.mjs',
];
const marker = '/* Nan Factory sidebar v2: i-Tech typography and section rhythm. */';
function replaceOnce(source, before, after, label) {
  const at = source.indexOf(before);
  if (at < 0 || source.indexOf(before, at + before.length) >= 0) {
    throw new Error(`Missing or ambiguous anchor: ${label}`);
  }
  return source.slice(0, at) + after + source.slice(at + before.length);
}
function patchShell(source) {
  let s = source;
  const r = (before, after, label) => { s = replaceOnce(s, before, after, label); };
  r('import { Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";',
    'import { Archive, Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Factory, FlaskConical, Package, Receipt, ShoppingCart, X, type LucideIcon } from "lucide-react";', 'v1 imports');
  r('function AppSidebar({', `// Match the i-Tech section icons without changing Factory navigation or permissions.
const ITECH_SECTION_ICONS: Readonly<Partial<Record<string, LucideIcon>>> = {
  PURCHASING: ShoppingCart,
  QC: FlaskConical,
  WAREHOUSE: Package,
  PRODUCTION: Factory,
  PACKING: Archive,
  LOGISTICS: Receipt,
  "SALES DOCUMENTS": Receipt,
};

function AppSidebar({`, 'sidebar function');
  r('const GroupIcon = navigation.find((item) => item.group === group.key)?.icon;',
    'const GroupIcon = ITECH_SECTION_ICONS[group.key] ?? navigation.find((item) => item.group === group.key)?.icon;', 'section icon');
  return s;
}
function patchCss(source) {
  if (source.includes(marker)) throw new Error('v2 is already installed.');
  if (!source.includes('/* Main Factory sidebar only: i-Tech visual reference. */')) throw new Error('Install v1 first.');
  let s = source;
  const r = (before, after, label) => { s = replaceOnce(s, before, after, label); };
  r('  --sidebar-itech-primary: #173b63;', '  font-family: Arial, Helvetica, sans-serif;\n  --sidebar-itech-primary: #173b63;', 'sidebar-only font');
  r('.factory-sidebar-itech .factory-itech-group { padding: 0; margin: 0 0 16px; }', `${marker}
.factory-sidebar-itech .factory-itech-scroll > nav {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.factory-sidebar-itech .factory-itech-group { padding: 0; margin: 0; gap: 4px; }`, 'section spacing');
  r('  font-size: 12px;\n  font-weight: 600;\n  color: #64748b;\n  cursor: pointer;', '  font-size: 0.75rem;\n  line-height: 1rem;\n  font-weight: 600;\n  color: #94a3b8;\n  cursor: pointer;', 'section typography');
  r('.factory-sidebar-itech .factory-itech-group-title { flex: 1; min-width: 0; }', `.factory-sidebar-itech .factory-itech-group-title { flex: 1; min-width: 0; }
.factory-sidebar-itech .factory-itech-group-icon,
.factory-sidebar-itech .factory-itech-group-chevron { width: 16px; height: 16px; flex-shrink: 0; }`, 'section icons');
  r('.factory-sidebar-itech .factory-itech-group-items { min-height: 0; overflow: hidden; padding-inline: 2px; }', '.factory-sidebar-itech .factory-itech-group-items { min-height: 0; overflow: hidden; padding-left: 4px; }', 'nested menu indent');
  r('  font-size: 14px;\n  font-weight: 500;\n  line-height: 1.25rem;', '  font-size: 0.875rem;\n  font-weight: 500;\n  line-height: 1.25rem;', 'menu typography');
  r('.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item > svg {', `.factory-sidebar-itech .factory-itech-nav-label {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item > svg {`, 'menu label sizing');
  r('[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-nav-item {', `[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-group-items { padding-left: 0; }
[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-group-icon { width: 20px; height: 20px; }
[data-collapsible="icon"] .factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item {`, 'compact alignment');
  r('.factory-itech-tooltip {\n  background: #173b63;', '.factory-itech-tooltip {\n  font-family: Arial, Helvetica, sans-serif;\n  font-size: 0.75rem;\n  line-height: 1rem;\n  background: #173b63;', 'tooltip font');
  return s;
}
const extraTests = `

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
`;
try {
  if (args.length !== 1 || !['--check', '--apply'].includes(args[0])) throw new Error('Usage: node nan_factory_sidebar_itech_v2.mjs --check | --apply');
  const root = process.cwd();
  if (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name !== 'ionflow-factory-platform') throw new Error('Wrong project.');
  if (execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim() !== 'nan') throw new Error('Expected branch nan.');
  const transforms = [patchShell, patchCss, (source) => {
    if (!source.includes('test("i-Tech colors and print styles are scoped to the main Factory sidebar"') || source.includes('test("v2 uses i-Tech typography')) throw new Error('Expected unchanged v1 test without v2 tests.');
    return source.trimEnd() + extraTests;
  }];
  const plans = paths.map((path, i) => {
    const full = resolve(root, path);
    const original = readFileSync(full, 'utf8');
    const next = transforms[i](original.replace(/\r\n/g, '\n'));
    return { path, full, original, next: original.includes('\r\n') ? next.replace(/\n/g, '\r\n') : next };
  });
  console.log('PASS: v1 source anchors matched; 3 existing files.');
  for (const plan of plans) console.log(`  MOD ${plan.path}`);
  if (args[0] === '--check') console.log('CHECK ONLY: no files changed.');
  else {
    for (const p of plans) if (readFileSync(p.full, 'utf8') !== p.original) throw new Error(`Concurrent edit: ${p.path}`);
    const written = [];
    try {
      for (const p of plans) { written.push(p); writeFileSync(p.full, p.next, 'utf8'); }
    } catch (error) {
      for (const p of written.reverse()) writeFileSync(p.full, p.original, 'utf8');
      throw error;
    }
    console.log('APPLIED: local files only. No commit, push, database or deployment.');
  }
} catch (error) {
  console.error(`STOP: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
