import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const domainSource = ts.transpileModule(
  read("src/features/purchase-requisitions/pr-domain.ts"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const domain = await import(
  `data:text/javascript;base64,${Buffer.from(domainSource).toString("base64")}`
);

const menuFor = (status) => [
  "view",
  "copy",
  ...(["draft", "rejected"].includes(status) ? ["edit"] : []),
  "print",
  ...Object.entries(domain.actionRules)
    .filter(([, rule]) => rule.from.includes(status))
    .map(([action]) => action),
  ...(status === "draft" ? ["delete"] : []),
  ...(["approved", "partial_po_created"].includes(status)
    ? ["create-po"]
    : []),
];

test("PR row menu exposes the exact actions for every document status", () => {
  assert.deepEqual(menuFor("draft"), [
    "view", "copy", "edit", "print", "submit", "cancel", "delete",
  ]);
  assert.deepEqual(menuFor("pending_approval"), [
    "view", "copy", "print", "approve", "reject", "cancel",
  ]);
  assert.deepEqual(menuFor("approved"), [
    "view", "copy", "print", "cancel", "create-po",
  ]);
  assert.deepEqual(menuFor("rejected"), [
    "view", "copy", "edit", "print", "submit",
  ]);
  assert.deepEqual(menuFor("cancelled"), ["view", "copy", "print"]);
  assert.deepEqual(menuFor("partial_po_created"), [
    "view", "copy", "print", "cancel", "create-po",
  ]);
  assert.deepEqual(menuFor("fully_po_created"), [
    "view", "copy", "print", "close",
  ]);
  assert.deepEqual(menuFor("closed"), ["view", "copy", "print"]);
});

test("PR row menu reuses existing commands and opens dialogs after the menu closes", () => {
  const list = read("src/features/purchase-requisitions/pr-list.tsx");
  const components = read("src/features/purchase-requisitions/pr-components.tsx");
  const preview = read("src/features/purchase-requisitions/pr-print-preview.tsx");

  for (const token of [
    "DropdownMenu",
    "MoreHorizontal",
    "ดูรายละเอียด",
    "คัดลอกเป็นฉบับร่าง",
    "พรีวิว / พิมพ์",
    "actionRules[action].from.includes(pr.status)",
    'requiresReason={action === "reject" || action === "cancel"}',
    'rowOverlay?.type === "delete"',
    'rowOverlay?.type === "create-po"',
    "copy(pr.id)",
    "act(pr.id, action, reason)",
    "remove(rowOverlay.id)",
    "<PRCreatePO",
    "<PRPrintPreview",
    "window.setTimeout(action, 0)",
    "actionButtons.current.get(id)?.focus()",
    "selectedRows.length > 0",
    "<Pagination",
  ])
    assert.ok(list.includes(token), token);

  assert.match(components, /const open = controlledOpen \?\? internalOpen/);
  assert.match(components, /onOpenChange\?\.\(value\)/);
  assert.match(preview, /open=\{open\}/);
  assert.match(preview, /trigger !== null/);
});
