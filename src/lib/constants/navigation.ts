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

// Menu labels only, collected from iCON sidebar, iTech SIDEBAR_SECTIONS and iFoam SidebarPreview.
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
    group: "OVERVIEW",
    title: "ตั้งค่าระบบ",
    href: "/settings",
    alias: true,
    icon: Wrench,
  },
  {
    group: "PURCHASING",
    title: "คำสั่งการผลิต",
    href: "/production-orders",
    icon: ClipboardList,
  },
  {
    group: "PURCHASING",
    title: "PR",
    href: "/pr",
    icon: FileText,
  },
  { group: "PURCHASING", title: "PO", icon: ShoppingCart },
  {
    group: "QC",
    title: "ใบตรวจสอบวัตถุดิบ",
    href: "/qc_raw_material",
    icon: FlaskConical,
  },
  { group: "QC", title: "ใบตรวจวัตถุดิบ", icon: FlaskConical },
  { group: "QC", title: "ใบรายงานผสมปุ๋ยผง", icon: Beaker },
  {
    group: "QC",
    title:
      "รายงานการตรวจสอบคุณภาพการผลิตปุ๋ยอินทรีย์/สารปรับสภาพดิน/หัวเชื้ออะมิโน, หัวเชื้อโอเอ็ม",
    icon: FlaskConical,
  },
  {
    group: "QC",
    title:
      "ใบรายงานการบรรจุปุ๋ยอินทรีย์/ปุ๋ยอินทรีย์เคมี/ปุ๋ยเคมี/สารปรับสภาพดิน",
    icon: FileText,
  },
  { group: "QC", title: "ใบรายงานผลิตปุ๋ยอินทรีย์เคมี", icon: FileText },
  { group: "QC", title: "ใบ NC", icon: ClipboardList },
  { group: "QC", title: "ใบส่งตัวอย่าง", icon: Archive },
  { group: "QC", title: "แบบบันทึกการส่งตัวอย่าง", icon: FileText },
  { group: "WAREHOUSE", title: "ใบรับวัตถุดิบ/วัสดุ", icon: Package },
  { group: "WAREHOUSE", title: "ใบรับวัตถุดิบ", icon: Package },
  { group: "WAREHOUSE", title: "ใบเบิกวัสดุ/วัตถุดิบ", icon: FileText },
  { group: "WAREHOUSE", title: "สต็อกวัตถุดิบ", icon: Boxes },
  {
    group: "WAREHOUSE",
    title: "ตั้งราคาสินค้า",
    href: "/products",
    alias: true,
    icon: ReceiptText,
  },
  { group: "PRODUCTION", title: "ใบสั่งผลิต", icon: ClipboardList },
  { group: "PRODUCTION", title: "ใบสูตรผลิต", icon: FileText },
  { group: "PRODUCTION", title: "ใบสั่งผลิตสินค้า", icon: Factory },
  { group: "PRODUCTION", title: "รายงานการผลิต", icon: Factory },
  {
    group: "PRODUCTION",
    title: "รายงานการผลิตปุ๋ยเม็ด ประจำโรงงานกาญ 1",
    icon: Factory,
  },
  {
    group: "PRODUCTION",
    title: "รายงานการผลิตปุ๋ยเม็ด ประจำโรงงานกาญ 3",
    icon: Factory,
  },
  { group: "PRODUCTION", title: "ใบรับยอดผลิต", icon: ClipboardList },
  { group: "PRODUCTION", title: "ใบรายงานการผลิต", icon: FileText },
  { group: "PRODUCTION", title: "ใบเบิกวัตถุดิบ", icon: FileText },
  { group: "PRODUCTION", title: "คลัง BOM", icon: Database },
  { group: "PRODUCTION", title: "สูตรผสมวัตถุดิบ", href: "/bom", icon: Beaker },
  { group: "PACKING", title: "ใบแจ้งสั่งแพ็คสินค้า", icon: Archive },
  {
    group: "LOGISTICS",
    title: "ใบส่งสินค้า",
    href: "/delivery-orders",
    icon: Truck,
  },
  {
    group: "LOGISTICS",
    title: "ส่งสินค้า",
    href: "/delivery-orders",
    alias: true,
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
  { key: "QC", title: "QC" },
  { key: "WAREHOUSE", title: "คลังสินค้า" },
  { key: "PRODUCTION", title: "การผลิต" },
  { key: "PACKING", title: "แพ็ค / FG" },
  { key: "LOGISTICS", title: "จ่าย / ขนส่ง" },
  { key: "SALES DOCUMENTS", title: "เอกสารขาย" },
  { key: "MAINTENANCE", title: "แจ้งซ่อม" },
  { key: "MASTER DATA", title: "ข้อมูลหลัก" },
];
