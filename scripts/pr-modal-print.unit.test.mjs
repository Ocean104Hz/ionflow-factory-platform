import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const domainUrl = url(compile(read("src/features/purchase-requisitions/pr-domain.ts")));
const domain = await import(domainUrl);
const print = await import(url(compile(read("src/features/purchase-requisitions/pr-print.ts")).replace(/from ["']\.\/pr-domain["']/, `from "${domainUrl}"`)));

test("PR print renders A4 requisitions, totals and safe text without copying PO company data", () => {
  const pr = structuredClone(domain.demoPRs[0]);
  pr.purpose = '<script>alert("unsafe")</script>';
  pr.items[0].name = '<img src=x onerror="bad">';
  const html = print.buildPRPrintHtml([pr, domain.demoPRs[1]], { factoryName: 'Demo & <Factory>', shortName: 'IF', logoDataUrl: 'javascript:bad' });
  assert.equal((html.match(/class="sheet"/g) || []).length, 2);
  assert.ok(html.includes("PURCHASE REQUISITION"));
  assert.ok(html.includes("size: A4 portrait"));
  assert.ok(html.includes("2,500.00"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("Demo &amp; &lt;Factory&gt;"));
  assert.doesNotMatch(html, /<script>|<img src=x|javascript:bad|0105547164801/);
  assert.ok(html.includes("break-after: page"));
  pr.items[0].price = null;
  assert.ok(print.buildPRPrintHtml([pr], { factoryName: "Demo", shortName: "D", logoDataUrl: null }).includes("ยังระบุราคาไม่ครบ"));
});

test("PR list uses modal callbacks, accessible checkbox selection and bottom page-size control", () => {
  const list = read("src/features/purchase-requisitions/pr-list.tsx");
  const detail = read("src/features/purchase-requisitions/pr-detail.tsx");
  const editor = read("src/features/purchase-requisitions/pr-editor.tsx");
  const preview = read("src/features/purchase-requisitions/pr-print-preview.tsx");
  for (const token of ["<Dialog", "<PREditor", "<PRDetail", "onSaved=", "onEdit=", "<Checkbox", "indeterminate", "pagination={"]) assert.ok(list.includes(token), token);
  assert.ok(list.indexOf('id="pr-page-size"') > list.indexOf("pagination={"));
  assert.doesNotMatch(list, /เลือก\/ยกเลิกเลือกหน้านี้|เลือกแล้ว|aria-pressed|href=\{`\/pr\//);
  assert.match(editor, /if \(onSaved\)/);
  assert.match(detail, /if \(onEdit\)/);
  assert.ok(preview.includes("target.print()"));
  assert.ok(preview.includes('sandbox="allow-same-origin allow-modals"'));
  assert.ok(preview.includes("loadedHtml !== html"));
});
