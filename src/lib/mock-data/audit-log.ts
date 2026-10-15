export const auditActions = {
  CREATE: "สร้างข้อมูล",
  UPDATE: "แก้ไขข้อมูล",
  DELETE: "ลบข้อมูล",
  LOGIN: "เข้าสู่ระบบ",
  LOGOUT: "ออกจากระบบ",
  EXPORT: "ส่งออกข้อมูล",
} as const;
export type AuditAction = keyof typeof auditActions;
export type AuditEntry = {
  id: string;
  occurredAt: string;
  user: string;
  email: string;
  action: AuditAction;
  module: string;
  reference: string;
  summary: string;
  ipAddress: string;
  changes: { field: string; before: string; after: string }[];
};

// Fictional snapshots only: demo interactions elsewhere do not write an audit trail.
export const auditEntries: AuditEntry[] = [
  {
    id: "AUD-DEMO-001",
    occurredAt: "2026-10-14T16:45:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "UPDATE",
    module: "คำสั่งการผลิต",
    reference: "PDO-DEMO-0003",
    summary: "ปรับกำหนดวันผลิตเสร็จ พร้อมระบุเหตุผล",
    ipAddress: "192.0.2.10",
    changes: [
      { field: "วันผลิตเสร็จ", before: "15 ต.ค. 2569", after: "16 ต.ค. 2569" },
      {
        field: "เหตุผล",
        before: "—",
        after: "ปรับแผนเครื่องจักร (ข้อมูลสาธิต)",
      },
    ],
  },
  {
    id: "AUD-DEMO-002",
    occurredAt: "2026-10-14T15:30:00+07:00",
    user: "เจ้าหน้าที่คลังสาธิต",
    email: "warehouse@example.com",
    action: "CREATE",
    module: "ใบส่งสินค้า",
    reference: "DO-DEMO-0001",
    summary: "สร้างใบส่งสินค้าฉบับร่าง",
    ipAddress: "192.0.2.20",
    changes: [
      { field: "เลขที่ใบส่งสินค้า", before: "—", after: "DO-DEMO-0001" },
      { field: "สถานะ", before: "—", after: "ฉบับร่าง" },
    ],
  },
  {
    id: "AUD-DEMO-003",
    occurredAt: "2026-10-14T14:10:00+07:00",
    user: "เจ้าหน้าที่บัญชีสาธิต",
    email: "finance@example.com",
    action: "EXPORT",
    module: "ใบแจ้งหนี้",
    reference: "INV-DEMO-0001",
    summary: "ส่งออกรายการใบแจ้งหนี้ 5 รายการ",
    ipAddress: "192.0.2.30",
    changes: [],
  },
  {
    id: "AUD-DEMO-004",
    occurredAt: "2026-10-14T13:20:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "UPDATE",
    module: "ผู้ใช้งาน",
    reference: "USER-DEMO-002",
    summary: "เปลี่ยนแผนกและสิทธิ์การมองเห็นเมนู",
    ipAddress: "192.0.2.10",
    changes: [
      { field: "แผนก", before: "การผลิต", after: "คลังสินค้า" },
      {
        field: "เมนูที่มองเห็น",
        before: "แดชบอร์ด, คำสั่งการผลิต",
        after: "แดชบอร์ด, ใบส่งสินค้า",
      },
    ],
  },
  {
    id: "AUD-DEMO-005",
    occurredAt: "2026-10-14T11:50:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "UPDATE",
    module: "ตั้งค่าโรงงาน",
    reference: "BRAND-DEMO",
    summary: "ปรับชื่อโรงงานที่แสดงในระบบ",
    ipAddress: "192.0.2.10",
    changes: [
      {
        field: "ชื่อโรงงาน",
        before: "โรงงานตัวอย่าง",
        after: "Ionflow Demo Factory",
      },
    ],
  },
  {
    id: "AUD-DEMO-006",
    occurredAt: "2026-10-14T09:00:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "LOGIN",
    module: "การเข้าใช้งาน",
    reference: "SESSION-DEMO-001",
    summary: "เข้าสู่ระบบสาธิต",
    ipAddress: "192.0.2.10",
    changes: [],
  },
  {
    id: "AUD-DEMO-007",
    occurredAt: "2026-10-13T17:00:00+07:00",
    user: "เจ้าหน้าที่คลังสาธิต",
    email: "warehouse@example.com",
    action: "LOGOUT",
    module: "การเข้าใช้งาน",
    reference: "SESSION-DEMO-002",
    summary: "ออกจากระบบสาธิต",
    ipAddress: "192.0.2.20",
    changes: [],
  },
  {
    id: "AUD-DEMO-008",
    occurredAt: "2026-10-13T15:25:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "DELETE",
    module: "สินค้าและราคากลาง",
    reference: "DEMO-P099",
    summary: "ลบสินค้าทดลองที่ยังไม่ได้ใช้งาน",
    ipAddress: "192.0.2.10",
    changes: [{ field: "สินค้า", before: "สินค้าทดลอง DEMO-P099", after: "—" }],
  },
  {
    id: "AUD-DEMO-009",
    occurredAt: "2026-10-13T10:20:00+07:00",
    user: "เจ้าหน้าที่บัญชีสาธิต",
    email: "finance@example.com",
    action: "UPDATE",
    module: "สินค้าและราคากลาง",
    reference: "DEMO-P001",
    summary: "ปรับราคากลางสินค้า",
    ipAddress: "192.0.2.30",
    changes: [
      { field: "ราคาต่อหน่วย (บาท)", before: "120.00", after: "125.00" },
    ],
  },
  {
    id: "AUD-DEMO-010",
    occurredAt: "2026-10-12T16:40:00+07:00",
    user: "ผู้ดูแลสาธิต",
    email: "admin@example.com",
    action: "UPDATE",
    module: "คำสั่งการผลิต",
    reference: "PDO-DEMO-0002",
    summary: "ตรวจสอบความพร้อมของวัตถุดิบ",
    ipAddress: "192.0.2.10",
    changes: [
      {
        field: "วัตถุดิบ",
        before: "รอตรวจสอบวัตถุดิบ",
        after: "วัตถุดิบพร้อม",
      },
    ],
  },
  {
    id: "AUD-DEMO-011",
    occurredAt: "2026-10-12T10:00:00+07:00",
    user: "เจ้าหน้าที่บัญชีสาธิต",
    email: "finance@example.com",
    action: "CREATE",
    module: "ใบแจ้งหนี้",
    reference: "INV-DEMO-0001",
    summary: "สร้างใบแจ้งหนี้ฉบับร่าง",
    ipAddress: "192.0.2.30",
    changes: [{ field: "สถานะ", before: "—", after: "ฉบับร่าง" }],
  },
  {
    id: "AUD-DEMO-012",
    occurredAt: "2026-10-12T08:00:00+07:00",
    user: "เจ้าหน้าที่คลังสาธิต",
    email: "warehouse@example.com",
    action: "LOGIN",
    module: "การเข้าใช้งาน",
    reference: "SESSION-DEMO-003",
    summary: "เข้าสู่ระบบสาธิต",
    ipAddress: "192.0.2.20",
    changes: [],
  },
];
export type AuditFilters = {
  search: string;
  action: string;
  module: string;
  user: string;
  from: string;
  to: string;
};
export const emptyAuditFilters: AuditFilters = {
  search: "",
  action: "all",
  module: "all",
  user: "all",
  from: "",
  to: "",
};
export function filterAuditEntries(
  entries: AuditEntry[],
  filters: AuditFilters,
): AuditEntry[] {
  const search = filters.search.trim().toLocaleLowerCase("th-TH");
  return entries
    .filter((entry) => {
      // Audit dates are compared in the factory's Bangkok timezone, including both endpoints.
      const date = new Date(
        new Date(entry.occurredAt).getTime() + 7 * 60 * 60 * 1000,
      )
        .toISOString()
        .slice(0, 10);
      return (
        (filters.action === "all" || entry.action === filters.action) &&
        (filters.module === "all" || entry.module === filters.module) &&
        (filters.user === "all" || entry.email === filters.user) &&
        (!filters.from || date >= filters.from) &&
        (!filters.to || date <= filters.to) &&
        [
          entry.id,
          entry.user,
          entry.email,
          entry.reference,
          entry.module,
          entry.summary,
          auditActions[entry.action],
        ]
          .join(" ")
          .toLocaleLowerCase("th-TH")
          .includes(search)
      );
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
