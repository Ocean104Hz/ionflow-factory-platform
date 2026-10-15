import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/lib/mock-data/master-settings.ts", import.meta.url),
  "utf8",
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { demoMasterSettings, validateMasterSetting } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("master settings accepts fixtures and edits without treating the same row as a duplicate", () => {
  for (const kind of ["departments", "warehouses"]) {
    for (const row of demoMasterSettings[kind])
      assert.equal(
        validateMasterSetting(row, demoMasterSettings[kind], kind),
        "",
      );
    const row = demoMasterSettings[kind][0];
    assert.equal(
      validateMasterSetting(
        { ...row, code: ` ${row.code.toLowerCase()} `, active: false },
        demoMasterSettings[kind],
        kind,
      ),
      "",
    );
  }
});

test("master settings rejects empty, duplicate and invalid master values", () => {
  for (const kind of ["departments", "warehouses"]) {
    const rows = demoMasterSettings[kind];
    const draft = {
      ...rows[0],
      id: "new-row",
      code: "NEW-01",
      name: "ข้อมูลสาธิตใหม่",
    };
    assert.equal(validateMasterSetting(draft, rows, kind), "");
    for (const patch of [
      { code: " " },
      { code: "bad code" },
      { name: " " },
      { type: "unsupported" },
      { code: rows[0].code.toLowerCase() },
      { name: ` ${rows[0].name} ` },
    ])
      assert.notEqual(
        validateMasterSetting({ ...draft, ...patch }, rows, kind),
        "",
      );
  }
});
