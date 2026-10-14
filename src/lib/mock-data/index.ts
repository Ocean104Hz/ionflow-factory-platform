import type {
  approvalStatuses,
  materialStatuses,
  productionStatuses,
} from "../constants/status";

export type Source = "Sales Hub" | "Datalink";
export interface Product {
  id: string;
  sku: string;
  name: string;
  type: string;
  unit: string;
  status: string;
  price: number | null;
  effective: string;
  updated: string;
  priceNote?: string;
}
export interface OrderItem {
  sku: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  price: number;
  note: string;
}
export interface ProductionOrder {
  id: string;
  number: string;
  salesOrder: string;
  company: string;
  customer: string;
  customerCode: string;
  source: Source;
  date: string;
  received: string;
  updated: string;
  revision: number;
  warehouse: string;
  document: string;
  material: (typeof materialStatuses)[number];
  approval: (typeof approvalStatuses)[number];
  production: (typeof productionStatuses)[number];
  requestedDate: string;
  pickup: string;
  proposal: {
    completion: string;
    pickup: string;
    reason: string;
    at: string;
  } | null;
  cancellation: {
    reason: string;
    requester: string;
    at: string;
    status: string;
    decision: string;
    by: string;
    decidedAt: string;
  } | null;
  items: OrderItem[];
  note: string;
}
export interface SalesDocument {
  id: string;
  number: string;
  orderId: string;
  date: string;
  updated: string;
  status: string;
  discount: number;
  note: string;
  deliveryType: string;
  vehicle: string;
  driver: string;
}
export const demoDate = "2026-10-14";
export const products: Product[] = [
  {
    id: "product-01",
    sku: "DEMO-P001",
    name: "เม็ดพลาสติกรีไซเคิล เกรดอุตสาหกรรม รุ่นมาตรฐาน",
    type: "วัตถุดิบ",
    unit: "กระสอบ",
    status: "ใช้งาน",
    price: 1200,
    effective: demoDate,
    updated: "2026-10-14T09:20:00+07:00",
  },
  {
    id: "product-02",
    sku: "DEMO-P002",
    name: "แผ่นโฟมกันกระแทก ความหนา 25 มิลลิเมตร",
    type: "สินค้าสำเร็จรูป",
    unit: "แผ่น",
    status: "ใช้งาน",
    price: 85,
    effective: demoDate,
    updated: "2026-10-14T08:00:00+07:00",
  },
  {
    id: "product-03",
    sku: "DEMO-P003",
    name: "วัสดุผสมสูตรพิเศษสำหรับงานผลิตตามคำสั่งลูกค้า",
    type: "สินค้าสำเร็จรูป",
    unit: "ตัน",
    status: "ใช้งาน",
    price: null,
    effective: demoDate,
    updated: "2026-10-13T15:00:00+07:00",
  },
  {
    id: "product-04",
    sku: "DEMO-P004",
    name: "กล่องบรรจุภัณฑ์ รุ่นเดิม",
    type: "บรรจุภัณฑ์",
    unit: "ใบ",
    status: "ไม่ใช้งาน",
    price: 15,
    effective: "2026-10-01",
    updated: "2026-10-12T10:00:00+07:00",
  },
];
const customers = [
  "บริษัท ตัวอย่างอุตสาหกรรม จำกัด (ข้อมูลสมมติ)",
  "บริษัท โรงงานสาธิตเพื่อการพัฒนาและทดสอบระบบ จำกัด",
  "ห้างหุ้นส่วน ตัวอย่างบรรจุภัณฑ์ (สมมติ)",
];
export const productionOrders: ProductionOrder[] = Array.from(
  { length: 16 },
  (_, i) => ({
    id: `po-${String(i + 1).padStart(2, "0")}`,
    number: `${i < 10 ? "PDO" : "DL-DO"}-DEMO-${String(i + 1).padStart(4, "0")}`,
    salesOrder: `SO-DEMO-${100 + i}`,
    company: "บริษัท ต้นทางสาธิต จำกัด",
    customer: customers[i % customers.length],
    customerCode: `DEMO-C00${(i % 3) + 1}`,
    source: i < 10 ? "Sales Hub" : "Datalink",
    date: i < 5 ? demoDate : "2026-10-13",
    received: "2026-10-14T08:30:00+07:00",
    updated: `2026-10-14T${String(9 + (i % 3)).padStart(2, "0")}:15:00+07:00`,
    revision: (i % 3) + 1,
    warehouse: "คลังสาธิต A",
    document: i === 9 ? "ยกเลิกแล้ว" : "รับข้อมูลแล้ว",
    material:
      i === 8
        ? "วัตถุดิบไม่พร้อม"
        : i % 5 === 0
          ? "รอตรวจสอบวัตถุดิบ"
          : "วัตถุดิบพร้อม",
    approval:
      i === 8
        ? "โรงงานปฏิเสธ"
        : i % 5 <= 1
          ? "รอการอนุมัติจากโรงงาน"
          : "โรงงานอนุมัติ",
    production:
      i === 7
        ? "รับสินค้าแล้ว"
        : i % 5 <= 1 || i === 8
          ? "ยังไม่เริ่มผลิต"
          : i % 5 === 2
            ? "กำลังผลิต"
            : i % 5 === 3
              ? "ผลิตเสร็จแล้ว"
              : "พร้อมรับสินค้า",
    requestedDate: "2026-10-18",
    pickup: "2026-10-19T10:00:00+07:00",
    proposal: null,
    cancellation:
      i === 1
        ? {
            reason: "ลูกค้าสาธิตขอปรับแผนการรับสินค้า",
            requester: "ฝ่ายขายสาธิต",
            at: "2026-10-14T10:00:00+07:00",
            status: "รอพิจารณา",
            decision: "—",
            by: "—",
            decidedAt: "",
          }
        : null,
    items: products
      .slice(0, (i % 3) + 1)
      .map((p, j) => ({
        sku: p.sku,
        name: p.name,
        type: p.type,
        quantity: (i + 1) * 10 + j,
        unit: p.unit,
        price: p.price ?? 16000,
        note: j === 0 ? "ตรวจสอบคุณภาพก่อนบรรจุ (สมมติ)" : "—",
      })),
    note: "ข้อมูลทั้งหมดใช้เพื่อสาธิต UI เท่านั้น ไม่ใช่เอกสารสำหรับซื้อขายจริง",
  }),
);
export const deliveryOrders: SalesDocument[] = productionOrders
  .slice(0, 8)
  .map((p, i) => ({
    id: `do-${i + 1}`,
    number: `DO-DEMO-${String(i + 1).padStart(4, "0")}`,
    orderId: p.id,
    date: demoDate,
    updated: p.updated,
    status: ["ฉบับร่าง", "พร้อมส่ง", "ส่งข้อมูลแล้ว", "ยกเลิกแล้ว"][i % 4],
    discount: 0,
    note: "ตรวจสอบจำนวนสินค้าก่อนรับ (สมมติ)",
    deliveryType: i === 0 ? "การส่งครั้งแรก" : "เที่ยวส่งเพิ่มเติม",
    vehicle: "DEMO-0001",
    driver: "คนขับสาธิต",
  }));
export const invoices: SalesDocument[] = productionOrders
  .slice(0, 9)
  .map((p, i) => ({
    id: `inv-${i + 1}`,
    number: `INV-DEMO-${String(i + 1).padStart(4, "0")}`,
    orderId: p.id,
    date: demoDate,
    updated: p.updated,
    status: ["ฉบับร่าง", "ออกเอกสารแล้ว", "ยกเลิกแล้ว"][i % 3],
    discount: i === 0 ? 500 : 0,
    note: "ชำระเงินภายใน 30 วัน · ข้อมูลสาธิต",
    deliveryType: "",
    vehicle: "",
    driver: "",
  }));
export const attachments = [
  {
    id: "a1",
    name: "product-reference-demo.svg",
    label: "รูปอ้างอิงสินค้า",
    src: "/demo/product.svg",
    mime: "image/svg+xml",
  },
  {
    id: "a2",
    name: "masked-driver-id-demo.svg",
    label: "เอกสารคนขับ (ข้อมูลสมมติ/ปกปิด)",
    src: "/demo/driver-id.svg",
    mime: "image/svg+xml",
  },
  {
    id: "a3",
    name: "vehicle-demo.svg",
    label: "รูปการมาถึงของรถ",
    src: "/demo/vehicle.svg",
    mime: "image/svg+xml",
  },
  {
    id: "a4",
    name: "delivery-document-demo.pdf",
    label: "เอกสารประกอบสาธิต",
    src: "",
    mime: "application/pdf",
  },
];
export const total = (items: OrderItem[]) =>
  items.reduce((sum, item) => sum + item.quantity * item.price, 0);
