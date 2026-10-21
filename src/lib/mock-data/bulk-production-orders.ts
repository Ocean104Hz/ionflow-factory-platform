import {
  blankBulkOrder,
  newBulkRow,
  type BulkOrder,
  type BulkProduct,
} from "@/src/features/bulk-production-orders/bulk-production-domain";

// Isolated fictional product/formula suggestions; no BOM writes or live lookups.
export const bulkProducts: BulkProduct[] = [
  {
    id: "demo-ag",
    code: "BULK-DEMO-AG",
    name: "ปุ๋ยเบล้าท์ AG ตัวอย่าง ขนาด 50 กก.",
    size: 50,
    formulaVersion: "DEMO-AG-V1",
  },
  {
    id: "demo-np",
    code: "BULK-DEMO-NP",
    name: "ปุ๋ยเบล้าท์ NP ตัวอย่าง ขนาด 25 กก.",
    size: 25,
    formulaVersion: "DEMO-NP-V2",
  },
];
export const bulkOrders: BulkOrder[] = [0, 1, 2, 3, 4, 5].map((i) => {
  const doc = blankBulkOrder();
  return {
    ...doc,
    id: `bulk-demo-${i}`,
    header: {
      ...doc.header,
      date: `2026-10-${String(10 + i).padStart(2, "0")}`,
      docNo: `BULK-DEMO-${i + 1}`,
      planTons: 5,
      producedTons: 5,
      targetBags: 100,
      productionDays: "3",
      payDate: "2026-10-20",
    },
    rows: [0, 1].map((n) => ({
      ...newBulkRow(`bulk-${i}-${n}`),
      product: bulkProducts[n].name,
      productCode: bulkProducts[n].code,
      qty: 50,
      size: bulkProducts[n].size,
      lot: bulkProducts[n].formulaVersion,
      qtyUnit: "กระสอบ",
      countUnit: "กระสอบ",
      producedQty: i === 0 ? 0 : i === 1 ? 20 : 50,
      carryQty: i === 1 ? 30 : 0,
      sizeNote: "รายการสมมติ",
      carryNote: i === 1 ? "รอการผลิตตัวอย่าง" : "",
      rowTotalNote: "บันทึกรายแถว",
    })),
    note: "ข้อมูลสำหรับทดสอบ ไม่เชื่อมการผลิตหรือคลังจริง",
    docSigners: {
      issuer: "คุณแผน ตัวอย่าง",
      qc: "คุณตรวจ สมมติ",
      production: "คุณผลิต ตัวอย่าง",
      manager: "คุณจัดการ สมมติ",
    },
    createdAt: "2026-10-10T03:00:00.000Z",
    updatedAt: "2026-10-15T03:00:00.000Z",
  };
});
