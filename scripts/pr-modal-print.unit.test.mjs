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
  const components = read("src/features/purchase-requisitions/pr-components.tsx");
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
  assert.ok(list.includes('document?.mode === "view"'));
  assert.ok(list.includes('w-[min(96vw,1500px)]'));
  assert.ok(list.includes('min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto'));
  assert.ok(list.includes('variant="dialog"'));
  assert.ok(list.includes('flex max-h-[94dvh] min-h-0 w-[min(96vw,1500px)]'));
  assert.ok(detail.includes('variant?: "page" | "dialog"'));
  assert.ok(detail.includes('variant={variant === "dialog" ? "detail" : "default"}'));
  assert.ok(components.includes('variant?: "default" | "detail"'));
  assert.ok(components.includes('minWidth={1120}'));
  assert.ok(components.includes('minWidth={1450}'));
  for (const label of ["ผู้ขาย:", "สเปก:", "หมายเหตุ:", "จำนวนขอซื้อ", "ออก PO แล้ว", "ค้างซื้อ", "ราคา/หน่วย", "ก่อนภาษี / ภาษี", "รวม"]) {
    assert.ok(components.includes(label), label);
  }
});

test("PR modals keep document forms responsive, action footers visible and standalone pages separate", () => {
  const list = read("src/features/purchase-requisitions/pr-list.tsx");
  const editor = read("src/features/purchase-requisitions/pr-editor.tsx");
  const components = read("src/features/purchase-requisitions/pr-components.tsx");

  assert.ok(list.includes('w-[min(96vw,1500px)]'));
  assert.ok(list.includes('flex max-h-[94dvh] min-h-0'));
  assert.ok(list.includes('DialogHeader className="shrink-0 pr-8"'));
  assert.ok(editor.includes('const embedded = Boolean(onSaved)'));
  assert.ok(editor.includes('{!embedded && ('));
  assert.ok(editor.includes('min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto'));
  assert.ok(editor.includes('grid gap-4 md:grid-cols-2 xl:grid-cols-3'));
  assert.ok(editor.includes('space-y-3 rounded-lg border p-4'));
  assert.ok(editor.includes('flex shrink-0 flex-col-reverse'));
  assert.ok(editor.includes('form.items.length >= 100'));
  assert.ok(editor.includes('newPRItem(crypto.randomUUID())'));
  assert.ok(editor.includes('form.items.filter((row) => row.id !== item.id)'));
  assert.ok(editor.includes('persist(false)'));
  assert.ok(editor.includes('persist(true)'));
  assert.ok(components.includes('size?: "compact" | "wide"'));
  assert.ok(components.includes('w-[min(calc(100vw-2rem),640px)]'));
  assert.ok(components.includes('w-[min(96vw,1100px)]'));
  assert.ok(components.includes('size="wide"'));
  assert.ok(components.includes('w-[min(96vw,1250px)]'));
  assert.ok(components.includes('variant="detail"'));
});

test("PR print preview gives the document frame the viewport space left by the header and actions", () => {
  const preview = read("src/features/purchase-requisitions/pr-print-preview.tsx");
  const dialog = read("src/components/ui/dialog.tsx");

  assert.ok(preview.includes('w-[min(96vw,1200px)]'));
  assert.ok(preview.includes('<DialogContent variant="preview"'));
  assert.ok(preview.includes('min-h-0 w-full flex-1'));
  assert.ok(dialog.includes('h-[calc(100dvh-1rem)]'));
  assert.ok(dialog.includes('sm:h-[92dvh]'));
});
