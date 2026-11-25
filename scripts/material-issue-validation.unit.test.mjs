import test from "node:test";
import assert from "node:assert/strict";

import {
  validateMaterialIssueInput,
} from "../src/server/material-issues/material-issue-validation.ts";

function createDraft() {
  return {
    header: {
      location: "โรงงานกาญ 2",
      productName: "Test Product",
      quantity: "250",
      issueDate: "2026-11-25",
      department: "ฝ่ายผลิต",
    },
    items: [
      {
        id: "row-1",
        materialCode: "TEST-001",
        materialName: "Test Material",
        quantity: "254",
        unit: "ขวด",
        damagedQuantity: "",
        additionalQuantity: "",
      },
      {
        id: "row-2",
        materialCode: "",
        materialName: "",
        quantity: "",
        unit: "",
        damagedQuantity: "",
        additionalQuantity: "",
      },
    ],
    signers: {
      requestedBy: "",
      issuedBy: "",
      inspectedBy: "",
    },
  };
}

test("accepts valid document and ignores empty rows", () => {
  const result = validateMaterialIssueInput(createDraft());

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, "254");
});

test("rejects missing material code", () => {
  const draft = createDraft();

  draft.items[0].materialCode = "";

  assert.throws(
    () => validateMaterialIssueInput(draft),
    /รหัสวัสดุ/,
  );
});

test("rejects zero quantity", () => {
  const draft = createDraft();

  draft.items[0].quantity = "0";

  assert.throws(
    () => validateMaterialIssueInput(draft),
    /มากกว่า 0/,
  );
});

test("rejects negative quantity", () => {
  const draft = createDraft();

  draft.items[0].quantity = "-5";

  assert.throws(
    () => validateMaterialIssueInput(draft),
    /ตัวเลขไม่ติดลบ/,
  );
});

test("rejects excessive decimal precision", () => {
  const draft = createDraft();

  draft.items[0].quantity = "1.12345";

  assert.throws(
    () => validateMaterialIssueInput(draft),
    /ทศนิยม/,
  );
});

test("rejects invalid document date", () => {
  const draft = createDraft();

  draft.header.issueDate = "2026-02-30";

  assert.throws(
    () => validateMaterialIssueInput(draft),
    /วันที่/,
  );
});
test("rejects missing product quantity", () => {
    const draft = createDraft();
    draft.header.quantity = "";

    assert.throws(
        () => validateMaterialIssueInput(draft),
        /จำนวนผลิตภัณฑ์/,
    );
});

test("rejects zero product quantity", () => {
    const draft = createDraft();
    draft.header.quantity = "0";

    assert.throws(
        () => validateMaterialIssueInput(draft),
        /มากกว่า 0/,
    );
});

test("rejects missing department", () => {
    const draft = createDraft();
    draft.header.department = "   ";

    assert.throws(
        () => validateMaterialIssueInput(draft),
        /ฝ่าย/,
    );
});