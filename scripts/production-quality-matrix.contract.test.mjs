import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/production-quality/production-quality-matrix.tsx", import.meta.url), "utf8");

test("matrix stacks each control and its note action inside a bounded cell", () => {
  assert.match(source, /className="grid w-40 min-w-0 max-w-full gap-1\.5 whitespace-normal"/);
  assert.match(source, /className="w-48 min-w-48 px-3 py-2 align-top"/);
  assert.match(source, /max-w-full justify-self-start/);
  assert.match(source, /r\.note \? "มีหมายเหตุ" : "หมายเหตุ"/);
  assert.doesNotMatch(source, /["']\+ หมายเหตุ["']/);
});

test("matrix preserves every measurement branch, note editing, scrolling and sticky metric column", () => {
  for (const kind of ["boolean", "text", "temperature", "numeric", "duration"])
    assert.ok(source.includes(`r.kind === "${kind}"`), kind);
  assert.equal((source.match(/<MetricCell\s/g) ?? []).length, 1);
  assert.match(source, /metrics\.map\(\(metric\) =>/);
  assert.match(source, /slots\.map\(\(slot\) =>/);
  assert.match(source, /changeReading\(row, metric\.id, slot, next\)/);
  assert.match(source, /update\(\{ \.\.\.r, note: e\.target\.value \}\)/);
  assert.match(source, /<Table className="w-max min-w-full">/);
  const tablePrimitive = readFileSync(new URL("../src/components/ui/table.tsx", import.meta.url), "utf8");
  assert.match(tablePrimitive, /relative w-full overflow-x-auto/);
  assert.match(source, /sticky left-0 z-10/);
  assert.match(source, /จุด \{i \+ 1\}/);
  assert.ok(source.includes("(+1 วัน)"));
});

test("matrix grows naturally without a height cap or its own vertical scrolling", () => {
  assert.match(source, /className="rounded-lg border"\s+tabIndex=\{0\}\s+role="region"/);
  assert.doesNotMatch(source, /max-h-\[|maxHeight|overflow-auto|overflow-y-auto|overflow-y-scroll/);
  assert.match(source, /className="w-48 min-w-48 px-3 text-center"/);
  assert.match(source, /className="w-48 min-w-48 px-3 py-2 align-top"/);
});

test("changed matrix TSX parses with the existing TypeScript runner", () => {
  const result = ts.transpileModule(source, {
    fileName: "production-quality-matrix.tsx",
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017 },
  });
  assert.deepEqual(result.diagnostics, []);
});
