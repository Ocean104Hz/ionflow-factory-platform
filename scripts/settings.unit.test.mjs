import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/mock-data/settings.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { demoUsers, factoryModules, visibleModules, validateDemoUser } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );

test("settings validates each demo user and rejects blank, duplicate or unsupported assignments", () => {
  for (const user of demoUsers)
    assert.equal(validateDemoUser(user, demoUsers), "");
  for (const changes of [
    { displayName: "   " },
    { email: "broken" },
    { email: ` ${demoUsers[1].email.toUpperCase()} ` },
    { department: "unknown" },
    { role: "unknown" },
    { modules: ["unknown"] },
  ])
    assert.notEqual(
      validateDemoUser({ ...demoUsers[0], ...changes }, demoUsers),
      "",
    );
});

test("settings preview is per user, inactive users see nothing and roles never grant implicit access", () => {
  assert.equal(visibleModules(demoUsers[0]).length, factoryModules.length);
  assert.deepEqual(
    visibleModules(demoUsers[2]).map((module) => module.key),
    ["dashboard", "delivery"],
  );
  assert.equal(visibleModules({ ...demoUsers[0], active: false }).length, 0);
  assert.equal(visibleModules({ ...demoUsers[0], modules: [] }).length, 0);
  assert.equal(demoUsers[0].modules.length, factoryModules.length);
});

const readComponent = (name) =>
  readFileSync(
    new URL(`../src/components/factory/${name}.tsx`, import.meta.url),
    "utf8",
  );
const sidebar = readComponent("settings-sidebar");
const page = readComponent("settings-page");

test("settings sidebar maps exactly six groups and sixteen unique destinations", () => {
  const ast = ts.createSourceFile(
    "settings-sidebar.tsx",
    sidebar,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const declaration = ast.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((item) => item.name.getText(ast) === "settingsGroups");
  assert.ok(
    declaration && ts.isArrayLiteralExpression(declaration.initializer),
  );
  const groups = declaration.initializer.elements.map((item) => {
    const property = (name) =>
      item.properties.find((p) => p.name.getText(ast) === name).initializer;
    return {
      title: property("title").text,
      items: property("items").elements.map((value) => value.text),
    };
  });
  assert.deepEqual(groups, [
    { title: "ผู้ใช้และสิทธิ์", items: ["users"] },
    {
      title: "องค์กรและพื้นที่",
      items: ["sites", "areas", "warehouses", "departments"],
    },
    {
      title: "การปฏิบัติงาน",
      items: ["lines", "shifts", "vehicleTypes", "vehicles", "equipment"],
    },
    {
      title: "ข้อมูลสินค้า",
      items: ["units", "categories", "brands", "processes"],
    },
    { title: "ผู้ขายภายใน", items: ["suppliers"] },
    { title: "ตั้งค่าโรงงาน", items: ["branding"] },
  ]);
  const destinations = groups.flatMap((group) => group.items);
  assert.equal(destinations.length, 16);
  assert.equal(new Set(destinations).size, 16);
  const domain = readFileSync(
    new URL("../src/features/master-data/master-domain.ts", import.meta.url),
    "utf8",
  );
  const kinds = [...domain.split("} as const;")[0].matchAll(/^  (\w+):/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    destinations.filter((item) => !["users", "branding"].includes(item)).sort(),
    kinds.sort(),
  );
});

test("settings mounts only the selected existing component, keys master kinds and retains the settings route", () => {
  assert.match(
    page,
    /selected === "users" \?\s*\(?\s*<UserSettings onDirtyChange=\{setDirty\}/,
  );
  assert.match(page, /selected === "branding"/);
  assert.match(page, /<BrandingEditor onDirtyChange=\{setDirty\}/);
  assert.match(page, /<MasterSettings\s+key=\{selected\}\s+kind=\{selected\}/);
  assert.doesNotMatch(page, /Tabs|forceMount|MasterCategory|router\.|href=/);
  assert.match(page, /BOM ภายใน[\s\S]*Sales Hub/);
  const route = readFileSync(
    new URL("../app/(factory)/settings/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(route, /<SettingsPage\s*\/>/);
  const globalShell = readComponent("app-shell");
  assert.doesNotMatch(globalShell, /SettingsSidebar|settingsGroups/);
  assert.doesNotMatch(sidebar, /SidebarProvider|AppShell|href=/);
});

test("settings navigation preserves accessible collapsible, active, mobile and reduced-motion controls", () => {
  for (const name of [
    "Collapsible",
    "CollapsibleTrigger",
    "CollapsibleContent",
  ])
    assert.match(sidebar, new RegExp(`<${name}[\\s>]`));
  assert.match(
    sidebar,
    /const open = active \|\| expanded.includes\(group.title\)/,
  );
  assert.match(sidebar, /aria-expanded=\{open\}/);
  assert.match(
    sidebar,
    /aria-current=\{\s*selected === destination \? "page" : undefined\s*\}/,
  );
  assert.match(sidebar, /bg-primary\/10/);
  assert.match(sidebar, /motion-reduce:transition-none/);
  assert.match(page, /lg:grid-cols-\[260px_minmax\(0,1fr\)\]/);
  assert.match(page, /<Sheet /);
  assert.match(page, /<SheetTitle>/);
});

test("settings guards submenu switches without autosaving and all existing editors report dirty drafts", () => {
  assert.match(page, /if \(destination === selected\)/);
  assert.match(page, /if \(dirty\) \{\s*setPending\(destination\);\s*return;/);
  assert.match(page, /<AlertDialog\s+open=\{pending !== null\}/);
  assert.match(page, /<AlertDialogCancel>แก้ไขต่อ/);
  assert.match(page, /setDirty\(false\)/);
  for (const name of ["master-settings", "user-settings", "branding-editor"]) {
    const component = readComponent(name);
    assert.match(component, /onDirtyChange\?: \(dirty: boolean\) => void/);
    assert.match(component, /onDirtyChange\?\.\(/);
  }
  assert.match(
    readComponent("user-settings"),
    /useState<DemoUser>\(users\[0\]\)/,
  );
  assert.doesNotMatch(
    page,
    /localStorage|sessionStorage|fetch\(|\.save\(|updateBranding\(/,
  );
});
