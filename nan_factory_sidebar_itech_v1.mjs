import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Target: Ocean104Hz/ionflow-factory-platform, nan.
// Reference tree: 048ef23229868bdd5154f1ab83e1e443a924b15a.
// All exact source anchors are checked before any files are written.
const args = process.argv.slice(2);
if (args.length !== 1 || !['--check', '--apply'].includes(args[0])) {
  console.error('Usage: node nan_factory_sidebar_itech_v1.mjs --check | --apply');
  process.exit(1);
}
const root = process.cwd();
const shellPath = 'src/components/factory/app-shell.tsx';
const sidebarPath = 'src/components/ui/sidebar.tsx';
const cssPath = 'app/globals.css';
const testPath = 'scripts/factory-sidebar-itech.contract.test.mjs';
const changes = [];
function replaceOnce(source, before, after, label) {
  const at = source.indexOf(before);
  if (at === -1 || source.indexOf(before, at + before.length) !== -1) {
    throw new Error(`Source anchor missing or ambiguous: ${label}. No files changed.`);
  }
  return source.slice(0, at) + after + source.slice(at + before.length);
}
function plan(path, transform) {
  const full = resolve(root, path);
  const original = readFileSync(full, 'utf8');
  const normalized = original.replace(/\r\n/g, '\n');
  const next = transform(normalized);
  if (next === normalized) throw new Error(`No change: ${path}`);
  changes.push({ path, full, original, next: original.includes('\r\n') ? next.replace(/\n/g, '\r\n') : next });
}
function shell(source) {
  let s = source;
  const r = (before, after, label) => { s = replaceOnce(s, before, after, label); };
  r('import { Bell, ChevronDown, CircleHelp, X } from "lucide-react";',
    'import { Bell, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";', 'shell icons');
  r('style={{ "--sidebar-width-icon": "4rem" } as CSSProperties}',
    'style={{ "--sidebar-width": "18rem", "--sidebar-width-icon": "5rem" } as CSSProperties}', 'desktop widths');
  r('  const { state, isMobile, setOpenMobile } = useSidebar();\n  const compact = !isMobile && state === "collapsed";\n  function menu(group: string) {',
    `  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const compact = !isMobile && state === "collapsed";
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  function toggleGroup(key: string) {
    setCollapsedGroups((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? false),
    }));
  }
  function menu(group: string) {`, 'group state');
  r('tooltip={item.title}\n                  className="h-9"',
    'tooltip={compact ? { children: item.title, className: "factory-itech-tooltip", sideOffset: 10 } : undefined}\n                  appearance="factory-itech"\n                  className="factory-itech-nav-item"', 'menu appearance');
  r('<item.icon aria-hidden="true" />\n                    {!compact && <span>{item.title}</span>}',
    '<item.icon aria-hidden="true" />\n                    {!compact && <span className="factory-itech-nav-label">{item.title}</span>}', 'menu label');
  r('className="factory-sidebar no-print"\n    >\n      <SidebarHeader className="px-3 py-5">',
    `className="factory-sidebar factory-sidebar-itech no-print"
      mobileClassName="factory-sidebar factory-sidebar-itech no-print"
    >
      {!isMobile && (
        <button
          type="button"
          className="factory-itech-edge-toggle"
          onClick={toggleSidebar}
          aria-controls="factory-sidebar"
          aria-expanded={!compact}
          aria-label={compact ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
          title={compact ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
        >
          {compact ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      )}
      <SidebarHeader className="factory-itech-brand">`, 'sidebar header and edge toggle');
  r('          aria-label={branding.factoryName}\n          onClick={() => setOpenMobile(false)}',
    '          aria-label={branding.factoryName}\n          className="factory-itech-brand-link"\n          onClick={() => setOpenMobile(false)}', 'brand link');
  r('            aria-label="ปิดเมนู"\n            onClick={() => setOpenMobile(false)}',
    '            aria-label="ปิดเมนู"\n            className="factory-itech-mobile-close"\n            onClick={() => setOpenMobile(false)}', 'mobile close');
  r(`      <SidebarSeparator />
      <SidebarContent className="group-data-[collapsible=icon]:overflow-y-auto">
        <nav aria-label="เมนูโรงงาน">
          {navigationGroups.filter((group) => group.key !== "MAINTENANCE").map((group) => (
            <SidebarGroup key={group.key}>
              {!compact && (
                <SidebarGroupLabel className="text-[11px] tracking-wide text-muted-foreground">
                  {group.title}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>{menu(group.key)}</SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>`,
    `      <SidebarContent className="factory-itech-scroll group-data-[collapsible=icon]:overflow-y-auto">
        <nav aria-label="เมนูโรงงาน">
          {navigationGroups.filter((group) => group.key !== "MAINTENANCE").map((group) => {
            const visible = navigation.some(
              (item) => item.group === group.key && item.href &&
                currentUser.modules.includes(navigationModuleKey(item.href)),
            );
            if (!visible) return null;
            const GroupIcon = navigation.find((item) => item.group === group.key)?.icon;
            const isCollapsed = collapsedGroups[group.key] ?? false;
            const contentId = \`factory-sidebar-group-\${group.key.toLowerCase().replaceAll(" ", "-")}\`;
            return (
              <SidebarGroup key={group.key} className="factory-itech-group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarGroupLabel asChild className="factory-itech-group-trigger">
                      <button
                        type="button"
                        aria-label={group.title}
                        aria-expanded={!isCollapsed}
                        aria-controls={contentId}
                        onClick={() => toggleGroup(group.key)}
                      >
                        {GroupIcon && <GroupIcon aria-hidden="true" className="factory-itech-group-icon" />}
                        {!compact && <span className="factory-itech-group-title">{group.title}</span>}
                        {!compact && <ChevronDown aria-hidden="true" className="factory-itech-group-chevron" />}
                      </button>
                    </SidebarGroupLabel>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center" sideOffset={10} hidden={!compact} className="factory-itech-tooltip">
                    {group.title}
                  </TooltipContent>
                </Tooltip>
                <SidebarGroupContent
                  id={contentId}
                  inert={isCollapsed}
                  aria-hidden={isCollapsed}
                  className="factory-itech-group-content"
                >
                  <div className="factory-itech-group-items">{menu(group.key)}</div>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </nav>
      </SidebarContent>`, 'navigation groups');
  r('  SidebarSeparator,\n', '', 'unused separator import');
  r('  const { state, isMobile, openMobile } = useSidebar();\n  const compact = !isMobile && state === "collapsed";',
    '  const { isMobile, openMobile } = useSidebar();', 'header sidebar state');
  r(`        <SidebarTrigger
          aria-label={
            isMobile ? "เปิดเมนู" : compact ? "ขยาย sidebar" : "ยุบ sidebar"
          }
          aria-expanded={isMobile ? openMobile : !compact}
          aria-controls="factory-sidebar"
        />
        <Separator orientation="vertical" className="mx-1 h-4" />`,
    `        <SidebarTrigger
          className="md:hidden"
          aria-label={openMobile ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={isMobile && openMobile}
          aria-controls="factory-sidebar"
        />
        <Separator orientation="vertical" className="mx-1 h-4 md:hidden" />`, 'mobile-only header trigger');
  return s;
}
function sidebar(source) {
  let s = source;
  const r = (before, after, label) => { s = replaceOnce(s, before, after, label); };
  r('  collapsible = "offcanvas",\n  className,\n  children,',
    '  collapsible = "offcanvas",\n  className,\n  mobileClassName,\n  children,', 'optional mobile appearance');
  r('  collapsible?: "offcanvas" | "icon" | "none";\n}) {',
    '  collapsible?: "offcanvas" | "icon" | "none";\n  mobileClassName?: string;\n}) {', 'mobile appearance type');
  r('className="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"',
    'className={cn("w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden", mobileClassName)}', 'mobile class forwarding');
  r(' group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent',
    ' hover:bg-sidebar-accent', 'move default collapsed menu sizing');
  r('    variants: {\n      variant: {\n        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",',
    '    variants: {\n      appearance: {\n        default: "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",\n        "factory-itech": "",\n      },\n      variant: {\n        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",', 'opt-in menu appearance');
  r('    defaultVariants: {\n      variant: "default",\n      size: "default",',
    '    defaultVariants: {\n      appearance: "default",\n      variant: "default",\n      size: "default",', 'preserve default menu sizing');
  r('  variant = "default",\n  size = "default",\n  tooltip,',
    '  variant = "default",\n  size = "default",\n  appearance = "default",\n  tooltip,', 'appearance argument');
  r('sidebarMenuButtonVariants({ variant, size }), className',
    'sidebarMenuButtonVariants({ variant, size, appearance }), className', 'pass opt-in variant');
  return s;
}
const styles = `
/* Main Factory sidebar only: i-Tech visual reference. */
.factory-sidebar.factory-sidebar-itech {
  --sidebar-itech-primary: #173b63;
  --sidebar-itech-accent: #9ec23a;
  --sidebar-itech-border: #e2e8f0;
  --sidebar: #ffffff;
  --sidebar-foreground: #475569;
  --sidebar-muted: #64748b;
  --sidebar-line: var(--sidebar-itech-border);
  --sidebar-border: var(--sidebar-itech-border);
  --sidebar-ring: var(--sidebar-itech-primary);
  --sidebar-primary: var(--sidebar-itech-primary);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f0f6e1;
  --sidebar-accent-foreground: var(--sidebar-itech-primary);
  background: #fff;
  border-color: var(--sidebar-itech-border);
  color: var(--sidebar-foreground);
}
[data-slot="sidebar-container"].factory-sidebar-itech {
  z-index: 40;
  height: 100dvh;
  transition-duration: 300ms;
  box-shadow: 0 1px 3px rgb(15 23 42 / 8%);
}
[data-slot="sidebar"]:has(> .factory-sidebar-itech) > [data-slot="sidebar-gap"] {
  transition-duration: 300ms;
}
.factory-sidebar-itech[data-mobile="true"] {
  width: min(18rem, 88vw);
  max-width: 88vw;
  animation-duration: 300ms;
}
.factory-sidebar-itech .factory-itech-edge-toggle {
  position: absolute;
  right: -14px;
  top: 32px;
  z-index: 40;
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--sidebar-itech-border);
  border-radius: 50%;
  background: #fff;
  color: #64748b;
  cursor: pointer;
  box-shadow: 0 1px 3px rgb(15 23 42 / 12%);
  transition: color 200ms, border-color 200ms;
}
.factory-sidebar-itech .factory-itech-edge-toggle:hover {
  border-color: var(--sidebar-itech-accent);
  color: var(--sidebar-itech-primary);
}
.factory-sidebar-itech .factory-itech-brand {
  display: flex;
  min-height: 88px;
  flex: 0 0 88px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--sidebar-itech-border);
  padding: 0 16px;
}
.factory-sidebar-itech .factory-itech-brand-link {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  width: 100%;
}
.factory-sidebar-itech .factory-itech-brand-link > span > span:first-child {
  width: 56px;
  height: 56px;
  color: var(--sidebar-itech-primary);
}
.factory-sidebar-itech .factory-itech-brand-link strong {
  color: var(--sidebar-itech-primary);
  font-size: 15px;
  line-height: 1.25;
}
.factory-sidebar-itech .factory-itech-brand-link > span > span:nth-child(2) > span {
  color: #15803d;
  font-size: 9.5px;
  font-weight: 600;
}
.factory-sidebar-itech .factory-itech-mobile-close { flex-shrink: 0; }
.factory-sidebar-itech .factory-itech-scroll { overflow-x: hidden; overflow-y: auto; }
.factory-sidebar-itech .factory-itech-scroll > nav { padding: 16px 12px; }
.factory-sidebar-itech .factory-itech-group { padding: 0; margin: 0 0 16px; }
.factory-sidebar-itech .factory-itech-group-trigger {
  display: flex;
  height: auto;
  min-height: 32px;
  width: 100%;
  align-items: center;
  gap: 8px;
  margin-top: 0;
  opacity: 1;
  border-radius: 8px;
  padding: 6px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background-color 200ms, color 200ms;
}
.factory-sidebar-itech .factory-itech-group-trigger:hover {
  background: rgb(158 194 58 / 15%);
  color: var(--sidebar-itech-primary);
}
.factory-sidebar-itech .factory-itech-group-title { flex: 1; min-width: 0; }
.factory-sidebar-itech .factory-itech-group-chevron {
  color: var(--sidebar-itech-primary);
  transition: transform 300ms ease-in-out;
}
.factory-sidebar-itech .factory-itech-group-trigger[aria-expanded="false"] .factory-itech-group-chevron { transform: rotate(-90deg); }
.factory-sidebar-itech .factory-itech-group-content {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 300ms ease-in-out, opacity 300ms ease-in-out;
}
.factory-sidebar-itech .factory-itech-group-content[aria-hidden="true"] { grid-template-rows: 0fr; opacity: 0; }
.factory-sidebar-itech .factory-itech-group-items { min-height: 0; overflow: hidden; padding-inline: 2px; }
.factory-sidebar-itech [data-slot="sidebar-menu"] { gap: 4px; }
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item {
  display: flex;
  width: 100%;
  height: auto;
  min-height: 44px;
  align-items: center;
  gap: 12px;
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25rem;
  color: #475569;
  scale: 1;
  transition: background-color 200ms, color 200ms;
}
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item > svg {
  width: 20px;
  height: 20px;
  color: #94a3b8;
}
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item:hover:not([aria-current="page"]) {
  background: rgb(158 194 58 / 15%);
  color: var(--sidebar-itech-primary);
}
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item[aria-current="page"] {
  background: var(--sidebar-itech-primary);
  color: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 12%);
}
.factory-sidebar.factory-sidebar-itech nav a.factory-itech-nav-item[aria-current="page"] > svg { color: var(--sidebar-itech-accent); }
[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-brand { padding-inline: 8px; }
[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-group-trigger { justify-content: center; padding-inline: 0; }
[data-collapsible="icon"] .factory-sidebar-itech .factory-itech-nav-item {
  width: 100%;
  height: auto;
  min-height: 44px;
  justify-content: center;
  padding: 10px 0;
}
[data-collapsible="icon"] .factory-sidebar-itech [data-slot="sidebar-footer"] { padding: 8px; }
[data-collapsible="icon"] .factory-sidebar-itech [data-slot="sidebar-footer"] > div { justify-content: center; }
.factory-sidebar-itech .factory-itech-nav-item:focus-visible,
.factory-sidebar-itech .factory-itech-group-trigger:focus-visible {
  outline: 2px solid var(--sidebar-itech-primary);
  outline-offset: -2px;
}
.factory-itech-tooltip {
  background: #173b63;
  color: #fff;
  border-radius: 8px;
  font-weight: 600;
}
.factory-itech-tooltip svg { fill: #173b63; background: #173b63; }
@media (prefers-reduced-motion: reduce) {
  [data-slot="sidebar-container"].factory-sidebar-itech,
  [data-slot="sidebar"]:has(> .factory-sidebar-itech) > [data-slot="sidebar-gap"],
  .factory-sidebar-itech .factory-itech-group-content,
  .factory-sidebar-itech .factory-itech-group-chevron,
  .factory-sidebar-itech .factory-itech-nav-item,
  .factory-sidebar-itech .factory-itech-edge-toggle { transition: none; }
  .factory-sidebar-itech[data-mobile="true"], .factory-itech-tooltip { animation: none; }
}
@media print {
  [data-slot="sidebar"]:has(> .factory-sidebar-itech),
  .factory-sidebar-itech,
  .factory-itech-tooltip { display: none !important; }
}
`;
const testSource = `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(new URL(\`../\${path}\`, import.meta.url), "utf8");
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
`;
try {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'ionflow-factory-platform') throw new Error('Wrong project: expected ionflow-factory-platform.');
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
  if (branch !== 'nan') throw new Error(`Wrong branch: expected nan, found ${branch || '(detached HEAD)'}.`);
  plan(shellPath, shell);
  plan(sidebarPath, sidebar);
  plan(cssPath, (source) => {
    if (source.includes('/* Main Factory sidebar only: i-Tech visual reference. */')) throw new Error('Styles already installed.');
    if (!source.includes('.factory-sidebar nav a[aria-current="page"]')) throw new Error('Factory sidebar CSS anchor not found.');
    return source.trimEnd() + '\n' + styles;
  });
  const testFull = resolve(root, testPath);
  if (existsSync(testFull)) throw new Error(`Test already exists: ${testPath}`);
  changes.push({ path: testPath, full: testFull, original: null, next: testSource });
  console.log('PASS: all source anchors matched; 3 existing files and 1 new test.');
  for (const change of changes) console.log(`  ${change.original === null ? 'NEW' : 'MOD'} ${change.path}`);
  if (args[0] === '--check') {
    console.log('CHECK ONLY: no files changed.');
  } else {
    const written = [];
    try {
      // Recheck the originals before writing to avoid overwriting concurrent edits.
      for (const change of changes) {
        if (change.original === null ? existsSync(change.full) : readFileSync(change.full, 'utf8') !== change.original) {
          throw new Error(`File changed after preflight: ${change.path}`);
        }
      }
      for (const change of changes) {
        if (change.original === null) {
          writeFileSync(change.full, change.next, { encoding: 'utf8', flag: 'wx' });
          written.push(change);
        } else {
          written.push(change);
          writeFileSync(change.full, change.next, 'utf8');
        }
      }
    } catch (error) {
      for (const change of written.reverse()) {
        if (change.original === null) { if (existsSync(change.full)) unlinkSync(change.full); }
        else writeFileSync(change.full, change.original, 'utf8');
      }
      throw error;
    }
    console.log('APPLIED: local files only. No git add, commit, push, database or deployment.');
  }
} catch (error) {
  console.error(`STOP: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
