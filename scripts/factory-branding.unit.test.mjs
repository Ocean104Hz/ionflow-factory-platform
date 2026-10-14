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
  themePresets,
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

test("brand colors reach Sidebar and Login without overriding semantic colors", () => {
  const first = themeVariables(themePresets[0].color);
  for (const { color } of themePresets.slice(1)) {
    const variables = themeVariables(color);
    for (const token of ["--primary", "--accent", "--sidebar", "--sidebar-muted", "--sidebar-line"])
      assert.notEqual(variables[token], first[token], token);
    for (const token of ["--success", "--warning", "--danger", "--info"])
      assert.equal(variables[token], undefined, token);
  }
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.factory-sidebar\s*\{\s*background: var\(--sidebar\)/);
  assert.match(css, /\.login-showcase\s*\{[\s\S]*?background: var\(--sidebar\)/);
});

test("sidebar text remains readable for presets and extreme custom colors", () => {
  const luminance = hex => {
    const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  for (const color of [...themePresets.map(preset => preset.color), "#ffffff", "#000000", "#ffff00", "#ff0000"]) {
    const variables = themeVariables(color);
    for (const background of ["--sidebar", "--sidebar-line"])
      for (const foreground of ["--sidebar-foreground", "--sidebar-muted"])
        assert.ok((luminance(variables[foreground]) + 0.05) / (luminance(variables[background]) + 0.05) >= 4.5, `${color}: ${foreground} on ${background}`);
  }
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
