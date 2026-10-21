import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { after, test } from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const fixtureDir = mkdtempSync(join(tmpdir(), "ionflow-receiving-tests-"));
writeFileSync(
  join(fixtureDir, "package.json"),
  JSON.stringify({ type: "commonjs" }),
);
after(() => rmSync(fixtureDir, { force: true, recursive: true }));

const files = [
  "document-number.ts",
  "receiving-domain.ts",
  "receiving-mock-store.ts",
  "receiving-items.tsx",
  "receiving-signers.tsx",
  "receiving-header.tsx",
];
const read = (name) =>
  readFileSync(
    new URL(`../src/features/raw-material-receiving/${name}`, import.meta.url),
    "utf8",
  );
for (const name of files) {
  const source = read(name);
  const compiled = ts.transpileModule(source, {
    fileName: name,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const errors =
    compiled.diagnostics?.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ) ?? [];
  assert.deepEqual(
    errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, " ")),
    [],
    `${name} TS/TSX syntax`,
  );
  if (name.endsWith(".ts"))
    writeFileSync(
      join(fixtureDir, name.replace(/\.ts$/, ".js")),
      compiled.outputText,
    );
}

const {
  blankReceivingItem,
  blankReceivingSigners,
  calculateReceivingTotals,
  formatMoneyCents,
  itemAmountCents,
  validateReceivingDraft,
} = require(join(fixtureDir, "receiving-domain.js"));
const {
  loadLatestMockReceivingDocument,
  saveMockReceivingDocument,
  previewMockInboundNumber,
  reserveMockInboundNumber,
  listMockReceivingDocuments,
  INB_MOCK_DOCUMENTS_KEY,
} = require(join(fixtureDir, "receiving-mock-store.js"));
const { INB_MOCK_COUNTER_KEY } = require(
  join(fixtureDir, "document-number.js"),
);
const now = new Date("2026-10-21T00:00:00.000Z");
function reserve(
  store,
  date = "2026-10-20",
  token = "test-reservation",
  at = now,
) {
  const preview = previewMockInboundNumber(store, date, at);
  const result = reserveMockInboundNumber(
    store,
    date,
    preview.documentNo,
    token,
    at,
  );
  assert.equal(result.ok, true);
  return result.reservation;
}
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
function header() {
  return {
    location: "โรงงานกาญ 1",
    receiveDate: "2026-10-20",
    poDate: "",
    documentNo: "INB-2610001",
    poNo: "",
    supplierCode: "SUP-01",
    supplierName: "ผู้ขายตัวอย่าง",
    prNo: "",
    warehouseCode: "K01",
    qcDocumentNumbers: [],
    vendorBookNo: "",
    vendorDocumentNo: "",
  };
}
function line(id = "row-1") {
  return {
    ...blankReceivingItem(id, "2026-10-20"),
    quantity: "1.25",
    unit: "กระสอบ",
    description: "วัตถุดิบทดลอง",
    materialCode: "RM-101",
    unitPrice: "12.50",
  };
}

test("money uses exact fixed point and half-up rounding at satang", () => {
  assert.equal(itemAmountCents(line()), BigInt(1563)); // 15.625 => 15.63
  assert.equal(formatMoneyCents(BigInt(1563)), "15.63");
  assert.equal(
    itemAmountCents({ ...line(), quantity: "0.0001", unitPrice: "0.01" }),
    BigInt(0),
  );
  assert.equal(itemAmountCents({ ...line(), quantity: "1.00001" }), null);
  assert.equal(itemAmountCents({ ...line(), unitPrice: "1.001" }), null);
});

test("totals separate quantities of different units and sum prices", () => {
  const result = calculateReceivingTotals([
    line(),
    { ...line("row-2"), unit: "กิโลกรัม", quantity: "2", unitPrice: "10" },
  ]);
  assert.equal(result.amountDisplay, "35.63");
  assert.deepEqual(result.quantities, [
    { unit: "กระสอบ", quantity: "1.25" },
    { unit: "กิโลกรัม", quantity: "2" },
  ]);
});

test("requires essential header, INB number, and at least one valid item", () => {
  const invalid = validateReceivingDraft(
    { ...header(), documentNo: "", supplierName: "" },
    [blankReceivingItem("row-1", "")],
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.header.documentNo);
  assert.ok(invalid.header.supplierName);
  assert.ok(invalid.items["row-1"].quantity);
  assert.ok(invalid.items["row-1"].materialCode);
  assert.ok(invalid.items["row-1"].unitPrice);
  assert.equal(validateReceivingDraft(header(), [line()]).valid, true);
  assert.equal(validateReceivingDraft(header(), []).valid, false);
});

test("rejects mismatched INB date, negative price, and invalid purchase notice date", () => {
  const mismatch = validateReceivingDraft(
    { ...header(), receiveDate: "2026-11-01" },
    [line()],
  );
  assert.match(mismatch.header.documentNo ?? "", /เดือน/);
  const invalid = validateReceivingDraft(header(), [
    { ...line(), orderNoticeDate: "2026-02-30", unitPrice: "-1" },
  ]);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.items["row-1"].orderNoticeDate);
  assert.ok(invalid.items["row-1"].unitPrice);
});

test("save persists complete mock record and supports updating the same INB without duplicate", () => {
  const store = storage();
  const signers = {
    ...blankReceivingSigners(),
    issuerName: "ผู้ทดสอบ",
    inspectorName: "ผู้ตรวจทดสอบ",
  };
  const reservation = reserve(
    store,
    "2026-10-20",
    "first",
    new Date("2026-10-20T00:00:00.000Z"),
  );
  saveMockReceivingDocument(
    store,
    {
      header: header(),
      items: [line()],
      note: "บันทึกทดลอง",
      signers,
    },
    new Date("2026-10-20T00:00:00.000Z"),
    { reservationToken: reservation.token },
  );
  let saved = loadLatestMockReceivingDocument(store);
  assert.equal(saved?.header.documentNo, "INB-2610001");
  assert.equal(saved?.amountTotal, "15.63");
  assert.equal(saved?.note, "บันทึกทดลอง");
  assert.deepEqual(saved?.signers, signers);
  assert.deepEqual(saved?.items, [line()]);
  saveMockReceivingDocument(
    store,
    {
      header: header(),
      items: [{ ...line(), quantity: "2" }],
      note: "แก้ไขข้อมูล",
      signers,
    },
    new Date("2026-10-20T01:00:00.000Z"),
    { editingDocumentNo: header().documentNo },
  );
  saved = loadLatestMockReceivingDocument(store);
  assert.equal(saved?.amountTotal, "25.00");
  assert.equal(saved?.note, "แก้ไขข้อมูล");
  assert.equal(
    JSON.parse(store.getItem(INB_MOCK_DOCUMENTS_KEY)).documents.length,
    1,
  );
});

test("damaged existing storage cannot silently be overwritten", () => {
  const store = storage();
  store.setItem(INB_MOCK_DOCUMENTS_KEY, "bad-json");
  assert.throws(() => loadLatestMockReceivingDocument(store));
  assert.throws(() =>
    saveMockReceivingDocument(store, {
      header: header(),
      items: [line()],
      note: "",
      signers: blankReceivingSigners(),
    }),
  );
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), "bad-json");
  store.setItem(INB_MOCK_DOCUMENTS_KEY, "");
  assert.throws(() => previewMockInboundNumber(store, "2026-10-21", now));
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), "");
});

test("duplicate item identities and invalid optional PO date are rejected", () => {
  assert.ok(validateReceivingDraft(header(), [line(), line()]).general);
  assert.ok(
    validateReceivingDraft({ ...header(), poDate: "2026-02-30" }, [line()])
      .header.poDate,
  );
});

test("invalid saved relationships or duplicated row IDs preserve original stored text", () => {
  for (const corrupt of [
    (saved) => {
      saved.latestDocNo = "missing";
    },
    (saved) => {
      saved.documents.push(structuredClone(saved.documents[0]));
    },
    (saved) => {
      saved.documents[0].items.push(
        structuredClone(saved.documents[0].items[0]),
      );
    },
  ]) {
    const store = storage();
    const reservation = reserve(store);
    saveMockReceivingDocument(
      store,
      {
        header: header(),
        items: [line()],
        note: "",
        signers: blankReceivingSigners(),
      },
      now,
      { reservationToken: reservation.token },
    );
    const state = JSON.parse(store.getItem(INB_MOCK_DOCUMENTS_KEY));
    corrupt(state);
    const original = JSON.stringify(state);
    store.setItem(INB_MOCK_DOCUMENTS_KEY, original);
    assert.throws(() => loadLatestMockReceivingDocument(store));
    assert.throws(() =>
      saveMockReceivingDocument(store, {
        header: header(),
        items: [line()],
        note: "",
        signers: blankReceivingSigners(),
      }),
    );
    assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), original);
  }
});

test("visible item section includes every screenshot column, note and controls", () => {
  const s = read("receiving-items.tsx");
  for (const label of [
    "รายการสินค้า",
    "ประเภท",
    "ลำดับ",
    "จำนวน",
    "หน่วยนับ",
    "รายการ",
    "วันที่แจ้งสั่งซื้อ",
    "รหัสวัตถุดิบ",
    "จำนวนเงินต่อหน่วย (บาท)",
    "ราคารวม (บาท)",
    "เพิ่มแถว",
    "ลบ",
    "รวมจำนวน",
    "ราคารวมทั้งหมด",
    "หมายเหตุ",
  ])
    assert.ok(s.includes(label), `Missing: ${label}`);
  for (const key of [
    "quantity",
    "unit",
    "description",
    "orderNoticeDate",
    "materialCode",
    "unitPrice",
  ]) {
    assert.ok(
      s.includes(`changeItem(item.id, { ${key}`),
      `Missing editable control: ${key}`,
    );
  }
  assert.match(s, /onClick=\{onAdd\}/);
  assert.match(s, /items\.filter\(/);
  assert.match(s, /readOnly/);
});

test("all four signer roles and mock save button are wired into the workspace", () => {
  const signers = read("receiving-signers.tsx");
  for (const role of [
    "ผู้ออก/วันที่",
    "ผู้อนุมัติ",
    "ผู้บันทึกบัญชี",
    "ผู้ตรวจสอบ",
  ]) {
    assert.ok(signers.includes(role), role);
  }
  for (const field of [
    "issuerName",
    "approverName",
    "recorderName",
    "inspectorName",
  ]) {
    assert.ok(signers.includes(field), field);
  }
  const ws = read("receiving-header.tsx");
  for (const name of [
    "ReceivingItemsSection",
    "ReceivingSignersSection",
    "saveMockReceivingDocument",
    "saveDocument",
    "openSavedDocument",
  ]) {
    assert.ok(ws.includes(name), name);
  }
  assert.match(ws, /onClick=\{saveDocument\}/);
  assert.match(ws, /onClick=\{generateNumber\}/);
});

test("preview and cancellation write nothing; confirmation reserves exactly 24 hours", () => {
  const store = storage();
  const before = store.getItem(INB_MOCK_DOCUMENTS_KEY);
  for (let i = 0; i < 3; i++)
    assert.equal(
      previewMockInboundNumber(store, "2026-10-21", now).documentNo,
      "INB-2610001",
    );
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), before);
  assert.equal(store.getItem(INB_MOCK_COUNTER_KEY), null);
  const r = reserve(store, "2026-10-21");
  assert.equal(r.status, "reserved");
  assert.equal(r.period, "2026-10");
  assert.equal(r.sequence, 1);
  assert.equal(Date.parse(r.expiresAt) - Date.parse(r.reservedAt), 86400000);
  assert.equal(
    previewMockInboundNumber(store, "2026-10-22", now).documentNo,
    "INB-2610002",
  );
  assert.equal(
    previewMockInboundNumber(store, "2026-11-01", now).documentNo,
    "INB-2611001",
  );
  assert.equal(
    reserve(store, "2026-10-22", "second").documentNo,
    "INB-2610002",
  );
});

test("confirm rechecks a stale preview and never silently reserves a different number", () => {
  const store = storage(),
    first = previewMockInboundNumber(store, "2026-10-21", now);
  reserve(store, "2026-10-21", "other-form");
  const before = store.getItem(INB_MOCK_DOCUMENTS_KEY);
  const conflict = reserveMockInboundNumber(
    store,
    "2026-10-21",
    first.documentNo,
    "my-form",
    now,
  );
  assert.equal(conflict.ok, false);
  assert.equal(conflict.preview.documentNo, "INB-2610002");
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), before);
});

test("saving uses the confirmed reservation once; duplicate new save is rejected and explicit edit retains identity", () => {
  const store = storage(),
    r = reserve(store),
    data = {
      header: header(),
      items: [line()],
      note: "note",
      signers: { ...blankReceivingSigners(), approverName: "mock" },
    };
  assert.throws(() => saveMockReceivingDocument(store, data, now), /ยืนยัน/);
  saveMockReceivingDocument(store, data, now, { reservationToken: r.token });
  const state = JSON.parse(store.getItem(INB_MOCK_DOCUMENTS_KEY));
  assert.equal(state.reservations[0].status, "used");
  assert.equal(state.counters["2026-10"], 1);
  assert.throws(
    () =>
      saveMockReceivingDocument(store, data, now, {
        reservationToken: r.token,
      }),
    /ถูกใช้/,
  );
  saveMockReceivingDocument(store, { ...data, note: "edited" }, now, {
    editingDocumentNo: r.documentNo,
  });
  assert.equal(listMockReceivingDocuments(store).length, 1);
  assert.deepEqual(
    loadLatestMockReceivingDocument(store).signers,
    data.signers,
  );
  assert.deepEqual(loadLatestMockReceivingDocument(store).items, data.items);
  assert.equal(loadLatestMockReceivingDocument(store).note, "edited");
  assert.equal(
    JSON.parse(store.getItem(INB_MOCK_DOCUMENTS_KEY)).reservations.length,
    1,
  );
  assert.throws(
    () =>
      saveMockReceivingDocument(
        store,
        { ...data, header: { ...data.header, documentNo: "INB-2610002" } },
        now,
        { editingDocumentNo: r.documentNo },
      ),
    /แก้ไข/,
  );
});

test("expired unused reservations can be reused; expired or superseded tokens cannot save; used stays unavailable", () => {
  const store = storage(),
    r = reserve(store),
    data = {
      header: header(),
      items: [line()],
      note: "",
      signers: blankReceivingSigners(),
    };
  const later = new Date(now.getTime() + 86400000);
  assert.throws(
    () =>
      saveMockReceivingDocument(store, data, later, {
        reservationToken: r.token,
      }),
    /หมดอายุ/,
  );
  assert.equal(
    previewMockInboundNumber(store, "2026-10-21", later).documentNo,
    r.documentNo,
  );
  const reused = reserve(store, "2026-10-21", "new-owner", later);
  assert.equal(reused.documentNo, r.documentNo);
  assert.throws(
    () =>
      saveMockReceivingDocument(store, data, later, {
        reservationToken: r.token,
      }),
    /ยืนยัน/,
  );
  saveMockReceivingDocument(store, data, later, {
    reservationToken: reused.token,
  });
  assert.equal(
    previewMockInboundNumber(
      store,
      "2026-10-21",
      new Date(later.getTime() + 86400000),
    ).documentNo,
    "INB-2610002",
  );
});

test("legacy saved records and old counter survive previews and edits without destructive migration", () => {
  const store = storage(),
    data = {
      header: header(),
      items: [line()],
      note: "legacy",
      signers: blankReceivingSigners(),
      amountTotal: "15.63",
      quantityByUnit: [{ unit: "กระสอบ", quantity: "1.25" }],
      savedAt: now.toISOString(),
    };
  const raw = JSON.stringify({
    version: 1,
    latestDocNo: header().documentNo,
    documents: [data],
  });
  store.setItem(INB_MOCK_DOCUMENTS_KEY, raw);
  store.setItem(INB_MOCK_COUNTER_KEY, '{"2610":5}');
  assert.equal(
    previewMockInboundNumber(store, "2026-10-21", now).documentNo,
    "INB-2610006",
  );
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), raw);
  saveMockReceivingDocument(store, { ...data, note: "edited legacy" }, now, {
    editingDocumentNo: data.header.documentNo,
  });
  assert.equal(
    loadLatestMockReceivingDocument(store).header.documentNo,
    data.header.documentNo,
  );
  assert.deepEqual(
    JSON.parse(store.getItem(INB_MOCK_DOCUMENTS_KEY)).reservations,
    [],
  );
  assert.equal(store.getItem(INB_MOCK_COUNTER_KEY), '{"2610":5}');
});

test("one atomic local write keeps document and reservation consistent on quota failure", () => {
  const store = storage(),
    r = reserve(store),
    before = store.getItem(INB_MOCK_DOCUMENTS_KEY);
  const failing = {
    getItem: store.getItem,
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.throws(
    () =>
      saveMockReceivingDocument(
        failing,
        {
          header: header(),
          items: [line()],
          note: "",
          signers: blankReceivingSigners(),
        },
        now,
        { reservationToken: r.token },
      ),
    /quota/,
  );
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), before);
  assert.equal(JSON.parse(before).documents.length, 0);
  assert.equal(JSON.parse(before).reservations[0].status, "reserved");
  assert.throws(
    () =>
      reserveMockInboundNumber(
        failing,
        "2026-10-21",
        "INB-2610002",
        "second",
        now,
      ),
    /quota/,
  );
  assert.equal(store.getItem(INB_MOCK_DOCUMENTS_KEY), before);
});

test("UI lifecycle starts empty, opens saved receipts explicitly and disables generation for editing only", () => {
  const source = read("receiving-header.tsx");
  assert.match(source, /documentNo: ""/);
  assert.doesNotMatch(
    source,
    /useEffect|loadLatestMockReceivingDocument|disabled=\{hasNumber/,
  );
  assert.match(source, /disabled=\{generatingDocNo \|\| isEditing\}/);
  assert.ok(source.includes("เปิดใบรับเดิม"));
  assert.ok(source.includes("ใช้เลขนี้"));
  assert.match(source, /field === "receiveDate" && value !== form.receiveDate/);
  assert.match(source, /setPreview\(null\)/);
  assert.match(source, /documentNo:\s*""/);
  assert.match(source, /onClick=\{confirmNumber\}/);
});
