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
