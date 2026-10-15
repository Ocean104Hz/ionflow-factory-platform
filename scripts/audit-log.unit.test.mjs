import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("src/lib/mock-data/audit-log.ts"), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { auditEntries, auditActions, emptyAuditFilters, filterAuditEntries } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );

test("audit filters combine search, actor, action and module without changing snapshots", () => {
  const original = JSON.stringify(auditEntries);
  const result = filterAuditEntries(auditEntries, {
    ...emptyAuditFilters,
    search: "  pdo-demo-0003  ",
    user: "admin@example.com",
    action: "UPDATE",
    module: "คำสั่งการผลิต",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "AUD-DEMO-001");
  assert.equal(
    filterAuditEntries(auditEntries, {
      ...emptyAuditFilters,
      search: "no-matching-demo",
    }).length,
    0,
  );
  assert.equal(JSON.stringify(auditEntries), original);
  assert.equal(
    new Set(auditEntries.map((entry) => entry.id)).size,
    auditEntries.length,
  );
  for (const action of Object.keys(auditActions))
    assert.ok(auditEntries.some((entry) => entry.action === action));
});

test("audit date boundaries include the whole Bangkok day and results are newest first", () => {
  const samples = [
    "2026-10-13T16:59:59Z",
    "2026-10-13T17:00:00Z",
    "2026-10-14T16:59:59Z",
    "2026-10-14T17:00:00Z",
  ].map((occurredAt, index) => ({
    ...auditEntries[0],
    id: String(index),
    occurredAt,
  }));
  assert.deepEqual(
    filterAuditEntries(samples, {
      ...emptyAuditFilters,
      from: "2026-10-14",
      to: "2026-10-14",
    }).map((entry) => entry.id),
    ["2", "1"],
  );
  assert.equal(
    filterAuditEntries(samples, {
      ...emptyAuditFilters,
      from: "2026-10-15",
      to: "2026-10-14",
    }).length,
    0,
  );
});

test("audit page uses shared readonly UI, linked route and fictional data only", () => {
  const ui = read("src/features/audit-log/audit-log.tsx");
  for (const token of [
    "FactoryDataTable",
    "Pagination",
    "SheetTitle",
    "SheetDescription",
    "InfoRow",
    "ข้อมูลก่อน–หลังแก้ไข",
    "ไม่มีข้อมูลเปรียบเทียบ",
    "aria-label",
    "invalidRange",
  ])
    assert.ok(ui.includes(token), token);
  assert.doesNotMatch(ui, /fetch\(|localStorage|dangerouslySetInnerHTML/);
  assert.ok(read("app/(factory)/audit_log/page.tsx").includes("<AuditLog />"));
  assert.match(
    read("src/lib/constants/navigation.ts"),
    /title: "ประวัติการแก้ไข"[\s\S]{0,100}href: "\/audit_log"/,
  );
  for (const entry of auditEntries) {
    assert.ok(entry.email.endsWith("@example.com"));
    assert.ok(entry.ipAddress.startsWith("192.0.2."));
  }
});
