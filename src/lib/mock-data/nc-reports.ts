import {
  blankNC,
  ncDepartments,
} from "@/src/features/nc-reports/nc-report-mock-helpers";
import type { NCReport } from "@/src/features/nc-reports/nc-report-types";
export const demoNCReports: NCReport[] = Array.from({ length: 6 }, (_, i) => ({
  ...blankNC(),
  id: `nc-demo-${i + 1}`,
  doc_no: `NC-DEMO-000${i + 1}`,
  doc_date: `2026-10-${String(20 - i * 2).padStart(2, "0")}`,
  discoverer: `ผู้พบตัวอย่าง ${i + 1}`,
  department: ncDepartments[i],
  product_name: ["ปุ๋ยอินทรีย์สาธิต A", "วัสดุบรรจุสาธิต B", "ส่วนผสมสาธิต C"][
    i % 3
  ],
  quantity: ["25.50", "120", "5", "2.75", "80", "10"][i],
  unit: i % 2 ? "กระสอบ" : "กก.",
  production_date: "2026-10-08",
  production_code: `DEMO-P00${i + 1}`,
  problem_defect: [
    "พบรอยเย็บกระสอบไม่สม่ำเสมอในตัวอย่าง",
    "ฉลากตัวอย่างมีข้อความคลาดเคลื่อน",
    "สีของตัวอย่างไม่สม่ำเสมอ ต้องตรวจทวนสาเหตุ",
  ][i % 3],
  countermeasure:
    "แยกตัวอย่างและบันทึกสาเหตุเพื่อทบทวนขั้นตอนร่วมกัน ข้อความนี้ไม่สั่งให้ระบบเปลี่ยนสต็อกหรือเริ่มงานจริง",
  decisions: {
    accept_concession: i === 0 || i === 5,
    rework: i === 1 || i === 5,
    return_back: i === 2,
    reproduce: i === 3,
    scrap: i === 4,
  },
  reviewer_name_1: `ผู้ทบทวนตัวอย่าง ${i + 1}`,
  reviewer_name_2: i % 2 ? "" : "ผู้ทบทวนตัวอย่างฝ่ายคุณภาพ",
  approver_name: i % 2 ? "ชื่อผู้อนุมัติตัวอย่าง" : "",
}));
