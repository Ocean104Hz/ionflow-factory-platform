// NAN_LAB_ITECH_THEME_V1

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// โหลดไฟล์ Domain จริงมาใช้ทดสอบ
const source = readFileSync(
  new URL(
    "../src/features/lab_sample_receiving/lab_sample_receiving_domain.ts",
    import.meta.url,
  ),
  "utf8",
);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const domainUrl =
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;

const d = await import(domainUrl);

// สร้างข้อมูลตัวอย่างสำหรับทดสอบ
function validRow(id = "row-1") {
  return {
    ...d.blankLabSampleRow(id),
    sample_name: "ตัวอย่างปุ๋ย",
    lot_no: "LOT-001",
  };
}

function validSheet(id = "row-1") {
  return {
    ...d.blankLabSheet(id),
    rows: [validRow(id)],
  };
}

const savedAt = "2026-11-18T09:00:00+07:00";

/* ---------------- Test 1 ---------------- */

test(
  "Domain defines 13 fields and creates a blank document",
  () => {
    assert.deepEqual(d.LAB_SAMPLE_FIELDS, [
      "sent_date",
      "sent_time",
      "sample_name",
      "lot_no",
      "lot_date",
      "sample_characteristics",
      "analysis_request",
      "sender_name",
      "received_by",
      "received_date",
      "sample_code",
      "request_no",
      "remark",
    ]);

    assert.equal(
      new Set(d.LAB_SAMPLE_FIELDS).size,
      13,
    );

    const blank = d.blankLabSampleRow("first-row");

    assert.equal(blank.id, "first-row");

    for (const field of d.LAB_SAMPLE_FIELDS) {
      assert.equal(
        blank[field],
        "",
        `Default value: ${field}`,
      );

      assert.ok(
        d.LAB_SAMPLE_FIELD_LABELS[field],
        `Label: ${field}`,
      );
    }

    const sheet = d.blankLabSheet("first-row");

    assert.equal(sheet.id, "");
    assert.equal(sheet.rows.length, 1);
    assert.equal(sheet.rows[0].id, "first-row");

    assert.equal(d.LAB_PAPER_ROWS_PER_PAGE, 24);
  },
);

/* ---------------- Test 2 ---------------- */

test(
  "Required fields and duplicate row IDs are validated",
  () => {
    const errors = d.validateLabSheet(
      d.blankLabSheet("row-1"),
    );

    assert.ok(errors["rows.0.sample_name"]);
    assert.ok(errors["rows.0.lot_no"]);

    assert.deepEqual(
      d.validateLabSheet(validSheet()),
      {},
    );

    const empty = {
      ...validSheet(),
      rows: [],
    };

    assert.ok(d.validateLabSheet(empty).rows);

    const duplicates = validSheet();

    duplicates.rows.push(validRow("row-1"));

    assert.ok(
      d.validateLabSheet(duplicates)["rows.1.id"],
    );

    const noId = validSheet();

    noId.rows[0].id = "";

    assert.ok(
      d.validateLabSheet(noId)["rows.0.id"],
    );
  },
);

/* ---------------- Test 3 ---------------- */

test(
  "Optional staff fields and free-text analysis are supported",
  () => {
    const draft = validSheet();

    draft.rows[0].analysis_request =
      "pH, ความชื้น และรายการอื่นตามคำขอ";

    draft.rows[0].sample_characteristics =
      "ตัวอย่างชนิดเม็ด\nบรรจุในถุง";

    assert.equal(draft.rows[0].received_by, "");
    assert.equal(draft.rows[0].received_date, "");

    assert.deepEqual(
      d.validateLabSheet(draft),
      {},
    );
  },
);

/* ---------------- Test 4 ---------------- */

test(
  "Dates, times and Lot/date display are validated",
  () => {
    assert.equal(
      d.isValidLabDate("2024-02-29"),
      true,
    );

    assert.equal(
      d.isValidLabDate("2026-02-29"),
      false,
    );

    assert.equal(
      d.isValidLabDate("2026-02-30"),
      false,
    );

    assert.equal(
      d.isValidLabDate("2026-13-01"),
      false,
    );

    assert.equal(d.isValidLabTime("00:00"), true);
    assert.equal(d.isValidLabTime("23:59"), true);
    assert.equal(d.isValidLabTime("24:00"), false);
    assert.equal(d.isValidLabTime("9:30"), false);

    for (const [field, value] of [
      ["sent_date", "2026-02-30"],
      ["lot_date", "invalid"],
      ["received_date", "2026-13-01"],
      ["sent_time", "24:00"],
    ]) {
      const draft = validSheet();

      draft.rows[0][field] = value;

      assert.ok(
        d.validateLabSheet(draft)[
          `rows.0.${field}`
        ],
        field,
      );
    }

    assert.match(
      d.formatLabDate("2026-11-18"),
      /2569/,
    );

    assert.equal(
      d.formatLabDate("invalid"),
      "",
    );

    assert.match(
      d.formatLabLotDate({
        lot_no: "LOT-001",
        lot_date: "2026-11-18",
      }),
      /LOT-001 \/ .*2569/,
    );

    assert.equal(
      d.formatLabLotDate({
        lot_no: "LOT-001",
        lot_date: "",
      }),
      "LOT-001",
    );

    assert.equal(
      d.formatLabLotDate({
        lot_no: "",
        lot_date: "",
      }),
      "",
    );

    assert.equal(
      d.labSavedDateKey(
        "2026-11-17T18:30:00Z",
      ),
      "2026-11-18",
    );
  },
);

/* ---------------- Test 5 ---------------- */

test(
  "Create and edit preserve rows and timestamps",
  () => {
    const draft = validSheet();

    draft.rows[0].sample_name =
      "  ตัวอย่างปุ๋ย  ";

    draft.rows[0].lot_no =
      "  LOT-001  ";

    draft.rows.push({
      ...validRow("row-2"),
      analysis_request: "pH",
    });

    const created = d.saveLabSheet(
      [],
      draft,
      "sheet-001",
      savedAt,
    );

    assert.equal(
      created.saved.id,
      "sheet-001",
    );

    assert.equal(
      created.saved.created_at,
      savedAt,
    );

    assert.equal(
      created.saved.updated_at,
      savedAt,
    );

    assert.equal(
      created.saved.rows.length,
      2,
    );

    assert.equal(
      created.saved.rows[0].sample_name,
      "ตัวอย่างปุ๋ย",
    );

    assert.equal(
      created.saved.rows[0].lot_no,
      "LOT-001",
    );

    // ข้อมูลต้นฉบับต้องไม่ถูกเปลี่ยน
    assert.equal(
      draft.rows[0].lot_no,
      "  LOT-001  ",
    );

    assert.equal(created.records.length, 1);

    // ทดลองแก้ไขเอกสาร
    const edited = structuredClone(
      created.saved,
    );

    edited.rows[1].analysis_request =
      "ความชื้น";

    const nextDate =
      "2026-11-19T10:00:00+07:00";

    const updated = d.saveLabSheet(
      created.records,
      edited,
      "unused",
      nextDate,
    );

    assert.equal(
      updated.records.length,
      1,
    );

    assert.equal(
      updated.saved.id,
      "sheet-001",
    );

    assert.equal(
      updated.saved.created_at,
      savedAt,
    );

    assert.equal(
      updated.saved.updated_at,
      nextDate,
    );

    assert.equal(
      updated.saved.rows[1].analysis_request,
      "ความชื้น",
    );

    assert.equal(
      created.records[0].rows[1].analysis_request,
      "pH",
    );
  },
);

/* ---------------- Test 6 ---------------- */

test(
  "Invalid data, duplicate IDs and stale edits are rejected",
  () => {
    const existing = d.saveLabSheet(
      [],
      validSheet(),
      "sheet-001",
      savedAt,
    ).records;

    assert.throws(
      () =>
        d.saveLabSheet(
          existing,
          validSheet(),
          "sheet-001",
          savedAt,
        ),
      /ซ้ำ/,
    );

    assert.throws(
      () =>
        d.saveLabSheet(
          existing,
          {
            ...validSheet(),
            id: "missing",
          },
          "unused",
          savedAt,
        ),
      /ไม่พบ/,
    );

    assert.throws(
      () =>
        d.saveLabSheet(
          existing,
          validSheet(),
          "sheet-002",
          "invalid",
        ),
      /วันที่บันทึก/,
    );

    assert.throws(
      () =>
        d.saveLabSheet(
          existing,
          d.blankLabSheet("row-empty"),
          "sheet-002",
          savedAt,
        ),
      /กรุณาแก้ไข/,
    );
  },
);

/* ---------------- Test 7 ---------------- */

test(
  "Search, date filters, deletion and pagination work",
  () => {
    const firstDraft = validSheet("a-row");

    firstDraft.rows[0].request_no =
      "REQ-100";

    firstDraft.rows[0].analysis_request =
      "pH";

    const first = d.saveLabSheet(
      [],
      firstDraft,
      "sheet-A",
      savedAt,
    ).saved;

    const secondDraft = validSheet("b-row");

    secondDraft.rows[0].sample_code =
      "S-200";

    secondDraft.rows[0].sample_name =
      "ตัวอย่างน้ำ";

    const second = d.saveLabSheet(
      [],
      secondDraft,
      "sheet-B",
      "2026-11-19T09:00:00+07:00",
    ).saved;

    const all = [first, second];

    // ค้นหาจากเลขที่คำขอ
    assert.deepEqual(
      d.filterLabSheets(all, {
        search: " req-100 ",
        from: "",
        to: "",
      }).map((sheet) => sheet.id),
      ["sheet-A"],
    );

    // ค้นหาจากรหัสตัวอย่าง
    assert.deepEqual(
      d.filterLabSheets(all, {
        search: "s-200",
        from: "",
        to: "",
      }).map((sheet) => sheet.id),
      ["sheet-B"],
    );

    // กรองตามวันที่บันทึก
    assert.deepEqual(
      d.filterLabSheets(all, {
        search: "",
        from: "2026-11-19",
        to: "2026-11-19",
      }).map((sheet) => sheet.id),
      ["sheet-B"],
    );

    assert.ok(
      d.labFilterError({
        search: "",
        from: "2026-11-20",
        to: "2026-11-19",
      }),
    );

    assert.deepEqual(
      d.filterLabSheets(all, {
        search: "",
        from: "invalid",
        to: "",
      }),
      [],
    );

    // ลบเอกสาร
    assert.deepEqual(
      d.deleteLabSheet(
        all,
        "sheet-A",
      ).map((sheet) => sheet.id),
      ["sheet-B"],
    );

    // ข้อมูลต้นฉบับยังอยู่
    assert.equal(all.length, 2);

    // Pagination
    assert.deepEqual(
      d.paginateLabSheets(
        [1, 2, 3, 4, 5],
        9,
        2,
      ),
      {
        page: 3,
        totalPages: 3,
        items: [5],
      },
    );

    assert.deepEqual(
      d.paginateLabSheets([], 1, 10),
      {
        page: 1,
        totalPages: 1,
        items: [],
      },
    );
  },
);

/* ---------------- Test 8 ---------------- */

test(
  "Paper pagination preserves all rows",
  () => {
    const rows = Array.from(
      { length: 49 },
      (_, index) =>
        validRow(`row-${index + 1}`),
    );

    const pages = d.splitLabPaperRows(rows);

    assert.deepEqual(
      pages.map((page) => page.length),
      [24, 24, 1],
    );

    assert.deepEqual(
      pages
        .flat()
        .map((row) => row.id),
      rows.map((row) => row.id),
    );

    assert.deepEqual(
      d.splitLabPaperRows([]),
      [[]],
    );

    assert.deepEqual(
      d.splitLabPaperRows(
        rows.slice(0, 24),
      ).map((page) => page.length),
      [24],
    );
  },
);
