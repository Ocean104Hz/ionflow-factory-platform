export type Tone = "neutral" | "info" | "warning" | "success" | "destructive";
export const materialStatuses = [
  "รอตรวจสอบวัตถุดิบ",
  "วัตถุดิบพร้อม",
  "วัตถุดิบไม่พร้อม",
] as const;
export const approvalStatuses = [
  "รอการอนุมัติจากโรงงาน",
  "โรงงานอนุมัติ",
  "โรงงานปฏิเสธ",
] as const;
export const productionStatuses = [
  "ยังไม่เริ่มผลิต",
  "กำลังผลิต",
  "ผลิตเสร็จแล้ว",
  "พร้อมรับสินค้า",
  "รับสินค้าแล้ว",
] as const;
export const productionSections = [
  "ข้อมูลคำสั่งการผลิต",
  "กำหนดการผลิต",
  "สถานะการดำเนินงาน",
  "รายการสินค้า",
  "ลูกค้า",
  "ผู้รับ",
  "รูปเอกสารแนบ",
  "คำขอยกเลิก",
  "ข้อมูลคนขับจาก Sales Hub",
  "ประวัติการเชื่อมต่อ",
  "หมายเหตุและผู้อนุมัติ",
] as const;
export const statusTones: Record<string, Tone> = {
  รอตรวจสอบวัตถุดิบ: "warning",
  วัตถุดิบพร้อม: "success",
  วัตถุดิบไม่พร้อม: "destructive",
  รอการอนุมัติจากโรงงาน: "warning",
  โรงงานอนุมัติ: "success",
  โรงงานปฏิเสธ: "destructive",
  ยังไม่เริ่มผลิต: "neutral",
  กำลังผลิต: "info",
  ผลิตเสร็จแล้ว: "success",
  พร้อมรับสินค้า: "success",
  รับสินค้าแล้ว: "neutral",
  ฉบับร่าง: "neutral",
  พร้อมส่ง: "info",
  ส่งข้อมูลแล้ว: "success",
  ยกเลิกแล้ว: "destructive",
  ออกเอกสารแล้ว: "success",
  รับข้อมูลแล้ว: "success",
  รอดำเนินการ: "warning",
  ใช้งาน: "success",
  ไม่ใช้งาน: "neutral",
  รอพิจารณา: "warning",
};
