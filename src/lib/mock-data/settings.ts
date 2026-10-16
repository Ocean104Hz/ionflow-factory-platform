export const factoryModules = [
  { key: "dashboard", label: "แดชบอร์ด" },
  { key: "production", label: "คำสั่งการผลิต" },
  { key: "delivery", label: "ใบส่งสินค้า" },
  { key: "invoices", label: "ใบแจ้งหนี้" },
  { key: "products", label: "สินค้าและราคากลาง" },
  { key: "settings", label: "ตั้งค่า" },
] as const;
export type FactoryModule = (typeof factoryModules)[number]["key"];
export const departments = ["บริหาร", "การผลิต", "คลังสินค้า", "บัญชี", "QC"];
export const userRoles = ["ผู้ดูแลโรงงาน", "หัวหน้าแผนก", "พนักงาน"];
export interface DemoUser {
  id: string;
  displayName: string;
  email: string;
  department: string;
  role: string;
  active: boolean;
  modules: FactoryModule[];
}
export const demoUsers: DemoUser[] = [
  {
    id: "DEMO-U001",
    displayName: "ผู้ดูแลสาธิต",
    email: "admin@example.test",
    department: "บริหาร",
    role: "ผู้ดูแลโรงงาน",
    active: true,
    modules: factoryModules.map((m) => m.key),
  },
  {
    id: "DEMO-U002",
    displayName: "ฝ่ายผลิตสาธิต",
    email: "production@example.test",
    department: "การผลิต",
    role: "หัวหน้าแผนก",
    active: true,
    modules: ["dashboard", "production", "products"],
  },
  {
    id: "DEMO-U003",
    displayName: "ฝ่ายคลังสาธิต",
    email: "warehouse@example.test",
    department: "คลังสินค้า",
    role: "พนักงาน",
    active: true,
    modules: ["dashboard", "delivery"],
  },
];

export function visibleModules(user: DemoUser) {
  return factoryModules.filter(
    (module) => user.active && user.modules.includes(module.key),
  );
}

export function validateDemoUser(
  user: DemoUser,
  users: DemoUser[],
  allowedDepartments = departments,
): string {
  if (!user.displayName.trim()) return "กรุณาระบุชื่อที่แสดง";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email.trim()))
    return "กรุณาระบุอีเมลที่ถูกต้อง";
  if (
    users.some(
      (other) =>
        other.id !== user.id &&
        other.email.toLowerCase() === user.email.trim().toLowerCase(),
    )
  )
    return "อีเมลนี้ถูกใช้กับผู้ใช้สาธิตคนอื่นแล้ว";
  if (
    !allowedDepartments.includes(user.department) ||
    !userRoles.includes(user.role)
  )
    return "กรุณาเลือกแผนกและบทบาทที่ถูกต้อง";
  if (
    user.modules.some(
      (key) => !factoryModules.some((module) => module.key === key),
    )
  )
    return "พบเมนูที่ไม่รองรับ";
  return "";
}
