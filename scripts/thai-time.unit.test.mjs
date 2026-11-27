import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const helper = readFileSync(
  new URL("../src/lib/date/thai-time.ts", import.meta.url),
  "utf8",
);

const picker = readFileSync(
  new URL(
    "../src/components/ui/thai-time-picker.tsx",
    import.meta.url,
  ),
  "utf8",
);

const compiled = ts.transpileModule(helper, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const time = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("24-hour time options cover every hour and minute exactly once", () => {
  assert.equal(time.THAI_TIME_HOURS.length, 24);
  assert.equal(new Set(time.THAI_TIME_HOURS).size, 24);

  assert.equal(time.THAI_TIME_MINUTES.length, 60);
  assert.equal(new Set(time.THAI_TIME_MINUTES).size, 60);

  for (const hour of time.THAI_TIME_HOURS) {
    for (const minute of time.THAI_TIME_MINUTES) {
      assert.equal(
        time.isValidThaiTime(`${hour}:${minute}`),
        true,
      );
    }
  }
});

test("strict HH:mm rejects invalid or ambiguous values", () => {
  for (const value of [
    "",
    "24:00",
    "12:60",
    "9:05",
    "09:5",
    "09:05:00",
    "09:05 PM",
    "09:05\n",
  ]) {
    assert.equal(
      time.isValidThaiTime(value),
      false,
      value,
    );
  }

  assert.deepEqual(time.parseThaiTime("00:00"), {
    hour: "00",
    minute: "00",
  });

  assert.deepEqual(time.parseThaiTime("23:59"), {
    hour: "23",
    minute: "59",
  });
});

test("user-selected parts preserve the other part and allow clearing", () => {
  assert.equal(
    time.setThaiTimePart("14:37", "hour", "23"),
    "23:37",
  );

  assert.equal(
    time.setThaiTimePart("14:37", "minute", "05"),
    "14:05",
  );

  assert.equal(
    time.setThaiTimePart("", "hour", "14"),
    "14:00",
  );

  assert.equal(
    time.setThaiTimePart("", "minute", "37"),
    "00:37",
  );

  assert.equal(
    time.setThaiTimePart("14:37", "hour", ""),
    "",
  );

  assert.equal(
    time.setThaiTimePart("14:37", "minute", ""),
    "",
  );

  assert.equal(
    time.setThaiTimePart("14:37", "hour", "24"),
    null,
  );

  assert.equal(
    time.setThaiTimePart("14:37", "minute", "60"),
    null,
  );
});

test("Bangkok time uses UTC+7 and midnight is 00:00", () => {
  assert.equal(
    time.timeInBangkok(
      new Date("2026-11-27T16:59:00Z"),
    ),
    "23:59",
  );

  assert.equal(
    time.timeInBangkok(
      new Date("2026-11-27T17:00:00Z"),
    ),
    "00:00",
  );

  assert.equal(
    time.timeInBangkok(
      new Date("2026-11-27T07:37:00Z"),
    ),
    "14:37",
  );

  assert.equal(
    time.timeInBangkok(new Date("invalid")),
    "",
  );
});

test("shared picker parses as TSX and only updates on user selection", () => {
  const tree = ts.createSourceFile(
    "thai-time-picker.tsx",
    picker,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  assert.deepEqual(tree.parseDiagnostics, []);

  assert.match(picker, /from "\.\/select"/);

  assert.match(
    picker,
    /onValueChange=\{\(next\) => changePart\("hour", next\)\}/,
  );

  assert.match(
    picker,
    /onValueChange=\{\(next\) => changePart\("minute", next\)\}/,
  );

  assert.match(
    picker,
    /if \(next !== null && next !== value\) onChange\(next\)/,
  );

  assert.doesNotMatch(
    picker,
    /useEffect|timeInBangkok\(/,
  );
});