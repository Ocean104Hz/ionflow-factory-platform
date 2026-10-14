import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const source = readFileSync(
  new URL("../src/lib/branding.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const {
  parseBranding,
  readBranding,
  defaultBranding,
  themeVariables,
  isLogoDataUrl,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
test("branding storage accepts only known non-sensitive fields", () => {
  const result = parseBranding({
    factoryName: " ABC Factory ",
    shortName: "ABC",
    primaryColor: "#B8954F",
    password: "do-not-save",
    token: "do-not-save",
    logoDataUrl: "https://example.test/logo.png",
  });
  assert.deepEqual(result, {
    factoryName: "ABC Factory",
    shortName: "ABC",
    primaryColor: "#b8954f",
    logoDataUrl: null,
  });
});
test("corrupt, oversized and unsafe stored values fall back safely", () => {
  assert.deepEqual(readBranding("broken JSON"), defaultBranding);
  assert.deepEqual(readBranding("x".repeat(751001)), defaultBranding);
  assert.equal(
    parseBranding({ primaryColor: "red; background:url(x)" }).primaryColor,
    defaultBranding.primaryColor,
  );
  assert.equal(isLogoDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isLogoDataUrl("data:image/png;base64,aA=="), true);
});
test("light and dark themes choose readable button foregrounds", () => {
  assert.equal(themeVariables("#ffffff")["--primary-foreground"], "#000000");
  assert.equal(themeVariables("#000000")["--primary-foreground"], "#ffffff");
  assert.equal(themeVariables("#b8954f")["--primary"], "#b8954f");
  assert.equal(
    themeVariables("invalid")["--primary"],
    defaultBranding.primaryColor,
  );
});
