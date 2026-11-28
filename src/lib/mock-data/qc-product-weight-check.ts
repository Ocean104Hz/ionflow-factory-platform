import {
  blankQcWeightRow,
  blankQcWeightGroupTimes,
  type QcProductWeightCheckDocument,
  type QcProductWeightCheckRow,
  type QcWeightMeasurements,
  type QcWeightReadings,
  type QcWeightResult,
} from "@/src/features/qc_product_weight_check/qc_product_weight_check_domain";

/* ---------------- demo products ---------------- */

const DEMO_PRODUCT_NAMES = [
  "ปุ๋ยชนิดเม็ด (สาธิต)",
  "ปุ๋ยชนิดผง (สาธิต)",
  "ผลิตภัณฑ์ชนิดน้ำ (สาธิต)",
  "ผลิตภัณฑ์บรรจุขวด (สาธิต)",
  "ปุ๋ยชนิดเม็ด B (สาธิต)",
  "ผลิตภัณฑ์ทดสอบหลายหน้า (สาธิต)",
] as const;

/* ---------------- demo measurements ---------------- */

type DemoMeasurementType = "PASS" | "FAIL" | "PENDING";

const DEMO_MEASUREMENTS: Record<DemoMeasurementType, QcWeightMeasurements> = {
  PASS: {
    group_1: ["0.005", "0.004", "0.005", "0.006"],
    group_2: ["0.005", "0.005", "0.004", "0.006"],
    group_3: ["0.006", "0.005", "0.005", "0.004"],
    group_4: ["0.005", "0.006", "0.004", "0.005"],
  },

  FAIL: {
    group_1: ["0.009", "0.008", "0.009", "0.010"],
    group_2: ["0.009", "0.009", "0.010", "0.008"],
    group_3: ["0.008", "0.009", "0.009", "0.010"],
    group_4: ["0.010", "0.009", "0.008", "0.009"],
  },

  PENDING: {
    group_1: ["0.005", "", "", ""],
    group_2: ["", "", "", ""],
    group_3: ["", "", "", ""],
    group_4: ["", "", "", ""],
  },
};

/* ---------------- clone helpers ---------------- */

function copyReadings(readings: QcWeightReadings): QcWeightReadings {
  return [readings[0], readings[1], readings[2], readings[3]];
}

function copyMeasurements(
  measurements: QcWeightMeasurements,
): QcWeightMeasurements {
  return {
    group_1: copyReadings(measurements.group_1),
    group_2: copyReadings(measurements.group_2),
    group_3: copyReadings(measurements.group_3),
    group_4: copyReadings(measurements.group_4),
  };
}

/* ---------------- create demo row ---------------- */

function createDemoRow(
  documentNumber: number,
  rowNumber: number,
): QcProductWeightCheckRow {
  const documentCode = String(documentNumber).padStart(3, "0");

  const rowCode = String(rowNumber).padStart(2, "0");

  const result: QcWeightResult =
    rowNumber % 5 === 0 ? "FAIL" : rowNumber % 4 === 0 ? "" : "PASS";

  const measurementType: DemoMeasurementType =
    result === "" ? "PENDING" : result;

  const hour = String(9 + Math.floor((rowNumber - 1) / 8)).padStart(2, "0");

  const minute = String((rowNumber * 7) % 60).padStart(2, "0");

  return {
    ...blankQcWeightRow(`qc-demo-row-${documentCode}-${rowCode}`),

    time: `${hour}:${minute}`,

    measurements: copyMeasurements(DEMO_MEASUREMENTS[measurementType]),

    average: result === "PASS" ? "0.005" : result === "FAIL" ? "0.009" : "",

    result,
  };
}

/* ---------------- create demo document ---------------- */

function createDemoDocument(
  documentNumber: number,
  rowCount: number,
): QcProductWeightCheckDocument {
  const documentCode = String(documentNumber).padStart(3, "0");

  const day = String(18 - documentNumber).padStart(2, "0");

  const documentDate = `2026-11-${day}`;

  const createdAt = `${documentDate}T09:00:00+07:00`;

  const isReviewed = documentNumber % 2 === 0;

  return {
    id: `qc-weight-demo-${documentCode}`,

    /* Document Information */

    doc_no: `QC-W-DEMO-${documentCode}`,
    doc_date: documentDate,

    /* Product Information */

    product_name: DEMO_PRODUCT_NAMES[documentNumber - 1] ?? "ผลิตภัณฑ์สาธิต",

    /* Lot Number */

    lot_no: `LOT-DEMO-${documentCode}`,

    /* Packing Size */

    pack_size: "500 มล. (สาธิต)",

    /* Packing Quantity */

    pack_count:
      documentNumber % 2 === 0 ? "500 ขวด (สาธิต)" : "884 ขวด (สาธิต)",

    /* Weight Specification */

    weight_spec: "0.005 ± 0.001 (ตัวอย่างเท่านั้น)",

    /* Weight Check Rows */

    group_times: blankQcWeightGroupTimes(),
    rows: Array.from({ length: rowCount }, (_, index) =>
      createDemoRow(documentNumber, index + 1),
    ),

    /* Remark */

    remark:
      documentNumber === 6
        ? "ข้อมูลสาธิตสำหรับตรวจสอบการแบ่งหน้ากระดาษ A4 แนวนอน"
        : "ข้อมูลตัวอย่างสำหรับทดสอบ UI MOCK ไม่ใช่ผลการตรวจสอบจริง",

    /* Prepared By */

    prepared_by: "ผู้จัดทำ (สาธิต)",
    prepared_date: documentDate,

    /* Checked By */

    checked_by: isReviewed ? "ผู้ตรวจสอบ (สาธิต)" : "",

    checked_date: isReviewed ? documentDate : "",

    /* Mock Timestamps */

    created_at: createdAt,
    updated_at: createdAt,
  };
}

/* ---------------- exported mock data ---------------- */

export const demoQcProductWeightCheckDocuments: QcProductWeightCheckDocument[] =
  [
    createDemoDocument(1, 2),
    createDemoDocument(2, 3),
    createDemoDocument(3, 1),
    createDemoDocument(4, 4),
    createDemoDocument(5, 2),
    createDemoDocument(6, 17),
  ];
