
import {
  blankLabSampleRow,
  type LabSampleReceivingRow,
  type LabSampleReceivingSheet,
} from "@/src/features/lab_sample_receiving/lab_sample_receiving_domain";

/**
 * i-Lab UI MOCK
 *
 * ข้อมูลทั้งหมดเป็นข้อมูลสมมติสำหรับทดลองหน้าเว็บ
 * ไม่มีการเชื่อมต่อ API หรือฐานข้อมูลจริง
 */

/* ---------------- create demo row ---------------- */

function createDemoRow(
  sheetNumber: number,
  rowNumber: number,
  sentDate: string,
): LabSampleReceivingRow {
  const sheetCode = String(sheetNumber).padStart(3, "0");
  const rowCode = String(rowNumber).padStart(2, "0");

  const isPendingReceive = rowNumber % 4 === 0;

  const row = blankLabSampleRow(
    `lab-demo-row-${sheetCode}-${rowCode}`,
  );

  return {
    ...row,

    sent_date: sentDate,
    sent_time: rowNumber % 2 === 0 ? "10:30" : "09:00",

    sample_name: `ตัวอย่างปุ๋ยสาธิต ${sheetCode}-${rowCode}`,

    lot_no: `LOT-DEMO-${sheetCode}-${rowCode}`,
    lot_date: sentDate,

    sample_characteristics:
      rowNumber % 2 === 0
        ? "ผงละเอียด (สาธิต)"
        : "เม็ด (สาธิต)",

    analysis_request:
      rowNumber % 2 === 0
        ? "ความชื้น, pH"
        : "pH, ธาตุอาหาร",

    sender_name: `ผู้ส่งตัวอย่างสาธิต ${sheetNumber}`,

    received_by: isPendingReceive
      ? ""
      : "เจ้าหน้าที่รับตัวอย่าง (สาธิต)",

    received_date: isPendingReceive
      ? ""
      : sentDate,

    sample_code: `S-DEMO-${sheetCode}-${rowCode}`,

    request_no: `REQ-DEMO-${sheetCode}-${rowCode}`,

    remark: isPendingReceive
      ? "รอรับตัวอย่าง (สาธิต)"
      : "ข้อมูลสาธิต",
  };
}

/* ---------------- create demo sheet ---------------- */

function createDemoSheet(
  sheetNumber: number,
  rowCount: number,
): LabSampleReceivingSheet {
  const sheetCode = String(sheetNumber).padStart(3, "0");

  const day = String(19 - sheetNumber).padStart(2, "0");

  const sentDate = `2026-11-${day}`;

  const createdAt = `${sentDate}T09:00:00+07:00`;

  return {
    id: `ilab-demo-${sheetCode}`,

    created_at: createdAt,
    updated_at: createdAt,

    rows: Array.from(
      { length: rowCount },
      (_, index) =>
        createDemoRow(
          sheetNumber,
          index + 1,
          sentDate,
        ),
    ),
  };
}

/* ---------------- exported mock data ---------------- */

export const demoLabSampleReceivingSheets:
  LabSampleReceivingSheet[] = [
    createDemoSheet(1, 2),
    createDemoSheet(2, 1),
    createDemoSheet(3, 3),
    createDemoSheet(4, 2),
    createDemoSheet(5, 1),

    // ใช้ทดลองกรณีมีข้อมูลเกิน 24 แถว
    // เพื่อดูการแบ่งหน้าพิมพ์
    createDemoSheet(6, 25),
  ];
