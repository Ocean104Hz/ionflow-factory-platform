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

export function isNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  { group: "PURCHASING", title: "PO", href: "/purchase-orders", icon: ShoppingCart },
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
  {
    group: "QC",
    title: "รายงานผสมปุ๋ยผง",
    href: "/fertilizer-powder-mixing",
    icon: Beaker,
  },
  {
    group: "QC",
    title: "ตรวจสอบคุณภาพการผลิต",
    href: "/production-quality",
    icon: FlaskConical,
  },
  {
    group: "PACKING",
    title: "รายงานการบรรจุ",
    href: "/packaging-report",
    icon: FileText,
  },
  {
    group: "QC",
    title: "ตรวจคุณภาพปุ๋ยอินทรีย์เคมี",
    href: "/qc-organic-fertilizer",
    icon: FileText,
  },
  { group: "QC", title: "ใบ NC", href: "/nc-reports", icon: ClipboardList },
  {
    group: "QC",
    title: "ใบส่งตัวอย่าง",
    href: "/sample-submissions",
    icon: Archive,
  },
  {
    group: "QC",
    title: "แบบบันทึกการส่งตัวอย่าง",
    href: "/sample-submission-log",
    icon: FileText,
  },
  {
    group: "WAREHOUSE",
    title: "รับวัตถุดิบและวัสดุ",
    href: "/raw-material-receiving",
    icon: Package,
  },
  {
    group: "WAREHOUSE",
    title: "เบิกวัสดุ/วัตถุดิบ",
    href: "/material-requisitions",
    icon: FileText,
  },
  {
    group: "WAREHOUSE",
    title: "สินค้าคงคลัง",
    href: "/inventory",
    icon: Boxes,
  },
  {
    group: "PRODUCTION",
    title: "ใบสั่งผลิตสินค้า V1",
    href: "/product-production-orders-v1",
    icon: Factory,
  },
  {
    group: "PRODUCTION",
    title: "ใบสั่งผลิตสินค้า V2",
    href: "/bulk-production-orders",
    icon: Factory,
  },
  { group: "PRODUCTION", title: "สูตรผสมวัตถุดิบ", href: "/bom", icon: Beaker },
  {
    group: "PRODUCTION",
    title: "รายงานการผลิต",
    href: "/production-reports",
    icon: Factory,
  },
  {
    group: "PRODUCTION",
    title: "ใบรับยอดผลิต V1",
    href: "/production-receipts-v1",
    icon: ClipboardList,
  },
  {
    group: "PRODUCTION",
    title: "ใบรับยอดผลิต V2",
    href: "/production-receipts",
    icon: ClipboardList,
  },
  {
    group: "PACKING",
    title: "ใบแจ้งสั่งแพ็คสินค้า",
    href: "/packing-summary",
    icon: Archive,
  },
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
  { group: "MAINTENANCE", title: "ใบแจ้งซ่อม", href: "/repair-requests", icon: Wrench },
  { group: "MAINTENANCE", title: "รายการอุปกรณ์", href: "/equipment", icon: Wrench },
  { group: "MAINTENANCE", title: "รายงานซ่อมบำรุง", href: "/maintenance-reports", icon: Wrench },
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
