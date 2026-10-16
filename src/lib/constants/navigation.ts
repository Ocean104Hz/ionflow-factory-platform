import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  ReceiptText,
  Package,
  FileText,
  FlaskConical,
  Boxes,
  ShoppingCart,
  Wrench,
  History,
  Factory,
  Archive,
  Database,
  Beaker,
  type LucideIcon,
} from "lucide-react";

export type FactoryNavigationItem = {
  group: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  alias?: boolean;
};

// Business navigation consolidated from verified iCON/iTech/iFoam module identities.
// Missing href means this template does not yet implement that module.
export const navigation: FactoryNavigationItem[] = [
  {
    group: "OVERVIEW",
    title: "แดชบอร์ด",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    group: "OVERVIEW",
    title: "ประวัติการแก้ไข",
    icon: History,
    href: "/audit_log",
  },
  {
    group: "SYSTEM",
    title: "ตั้งค่าระบบ",
    href: "/settings",
    icon: Wrench,
  },
  {
    group: "PURCHASING",
    title: "PR",
    href: "/pr",
    icon: FileText,
  },
  { group: "PURCHASING", title: "PO", icon: ShoppingCart },
  {
    group: "PURCHASING",
    title: "คำสั่งการผลิต",
    href: "/production-orders",
    icon: ClipboardList,
  },
  {
    group: "QC",
    title: "ตรวจสอบวัตถุดิบ",
    href: "/qc_raw_material",
    icon: FlaskConical,
  },
  { group: "QC", title: "รายงานผสมปุ๋ยผง", icon: Beaker },
  {
    group: "QC",
    title: "ตรวจสอบคุณภาพการผลิต",
    icon: FlaskConical,
  },
  {
    group: "PACKING",
    title: "รายงานการบรรจุ",
    icon: FileText,
  },
  { group: "QC", title: "ตรวจคุณภาพปุ๋ยอินทรีย์เคมี", icon: FileText },
  { group: "QC", title: "ใบ NC", icon: ClipboardList },
  { group: "QC", title: "ใบส่งตัวอย่าง", icon: Archive },
  { group: "QC", title: "แบบบันทึกการส่งตัวอย่าง", icon: FileText },
  { group: "WAREHOUSE", title: "รับวัตถุดิบและวัสดุ", icon: Package },
  { group: "WAREHOUSE", title: "รับวัตถุดิบ (PO/QC/รับตรง)", icon: Package },
  { group: "WAREHOUSE", title: "เบิกวัสดุ/วัตถุดิบ", icon: FileText },
  { group: "WAREHOUSE", title: "เบิกวัตถุดิบการผลิต", icon: FileText },
  { group: "WAREHOUSE", title: "สต็อกวัตถุดิบ", icon: Boxes },
  { group: "PRODUCTION", title: "ใบสั่งผลิต", icon: ClipboardList },
  { group: "PRODUCTION", title: "ใบสูตรผลิต", icon: FileText },
  { group: "PRODUCTION", title: "ใบสั่งผลิตสินค้า", icon: Factory },
  { group: "PRODUCTION", title: "รายงานการผลิต", icon: Factory },
  {
    group: "PRODUCTION",
    title: "รายงานการผลิตปุ๋ยเม็ด (กาญ 1)",
    icon: Factory,
  },
  {
    group: "PRODUCTION",
    title: "รายงานการผลิตปุ๋ยเม็ด (กาญ 3)",
    icon: Factory,
  },
  { group: "PRODUCTION", title: "รับยอดผลิต", icon: ClipboardList },
  { group: "PRODUCTION", title: "ใบรายงานการผลิต", icon: FileText },
  { group: "PRODUCTION", title: "คลัง BOM", icon: Database },
  { group: "PRODUCTION", title: "สูตรผสมวัตถุดิบ", href: "/bom", icon: Beaker },
  { group: "PACKING", title: "ใบแจ้งสั่งแพ็คสินค้า", icon: Archive },
  {
    group: "LOGISTICS",
    title: "ใบส่งสินค้า",
    href: "/delivery-orders",
    icon: Truck,
  },
  { group: "LOGISTICS", title: "ใบจ่ายสินค้า", icon: Package },
  {
    group: "SALES DOCUMENTS",
    title: "ใบแจ้งหนี้",
    href: "/invoices",
    icon: ReceiptText,
  },
  { group: "MAINTENANCE", title: "ใบแจ้งซ่อม", icon: Wrench },
  { group: "MAINTENANCE", title: "รายการอุปกรณ์", icon: Wrench },
  {
    group: "MASTER DATA",
    title: "สินค้าและราคากลาง",
    href: "/products",
    icon: Package,
  },
];

export const navigationGroups = [
  { key: "OVERVIEW", title: "ภาพรวม" },
  { key: "PURCHASING", title: "จัดซื้อ" },
  { key: "QC", title: "ตรวจสอบคุณภาพ (QC)" },
  { key: "WAREHOUSE", title: "คลังสินค้า" },
  { key: "PRODUCTION", title: "การผลิต" },
  { key: "PACKING", title: "บรรจุสินค้า" },
  { key: "LOGISTICS", title: "จ่ายและขนส่ง" },
  { key: "SALES DOCUMENTS", title: "เอกสารขาย" },
  { key: "MAINTENANCE", title: "ซ่อมบำรุง" },
  { key: "MASTER DATA", title: "ข้อมูลหลัก" },
  { key: "SYSTEM", title: "ระบบ" },
];
