import {
  blankRequisition,
  type Requisition,
} from "@/src/features/material-requisitions/material-requisition-domain";

// Fictional picker catalog; no connection to production receipts or stock balances.
export const requisitionMaterials = [
  { id: "bag-demo", name: "กระสอบปุ๋ยตัวอย่าง", size: 50, unit: "กระสอบ" },
  {
    id: "bag-small-demo",
    name: "กระสอบสารปรับสภาพดินตัวอย่าง",
    size: 25,
    unit: "Bag",
  },
];
export const materialRequisitions: Requisition[] = ["itech", "ifoam"].flatMap(
  (p, index) => {
    const profile = p as Requisition["profile"];
    return [1, 2, 3].map((n) => ({
      ...blankRequisition(profile),
      id: `req-${profile}-${n}`,
      doc_no: `ST-DEMO-${index + 1}0${n}`,
      date: `2026-10-${String(10 + n).padStart(2, "0")}`,
      material_details: [
        {
          id: `mat-${profile}-${n}`,
          m_item_name: `กระสอบปุ๋ยตัวอย่าง ${n}`,
          m_size: 50,
          m_qty: n * 20,
          m_unit: "กระสอบ",
          m_desc: "ข้อมูลสมมติ ไม่ได้เบิกจากคลังจริง",
        },
      ],
      wip_materials: [
        {
          id: `wip-${profile}-${n}`,
          w_item_name: "ปุ๋ยอินทรีย์ WIP",
          w_size: 50,
          w_qty: n * 2,
          w_unit: "ตัน",
          w_desc: `ชุดทดลอง ${n}`,
        },
      ],
      bag_dispenser_bag_warehouse_staff: "คุณคลัง ตัวอย่าง",
      requisitioner_production_supervisor: "คุณผลิต สมมติ",
      inventory_auditor: "คุณตรวจ ตัวอย่าง",
      createdAt: "2026-10-11T03:00:00.000Z",
      updatedAt: "2026-10-15T04:00:00.000Z",
    }));
  },
);
