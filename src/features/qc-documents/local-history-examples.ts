import { blankNC } from "../nc-reports/nc-report-mock-helpers";
import { newSample } from "../sample-submissions/sample-submission-domain";

const sampleDate = "2026-11-26";
const sampleProduct = "ปุ๋ยอินทรีย์ตัวอย่างสำหรับทดสอบตารางและข้อความภาษาไทยแบบยาว";

export const localNCExamples = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  const report = blankNC();
  return {
    ...report,
    id: `local-nc-${number}`,
    doc_no: `TEST-NC-${number}`,
    doc_date: sampleDate,
    discoverer: "เจ้าหน้าที่ทดสอบ",
    department: number % 2 ? "QC/QA" : "ผลิต",
    product_name: sampleProduct,
    quantity: String(number * 10),
    unit: "กก.",
    production_date: sampleDate,
    production_code: "TEST-PRODUCT-001",
    problem_defect: "ตัวอย่างกรณีน้ำหนักบรรจุต่ำกว่าเกณฑ์",
    countermeasure: "ตรวจสอบเครื่องชั่งและชั่งน้ำหนักซ้ำ",
    decisions: { ...report.decisions, rework: true },
  };
});

export const localSubmissionExamples = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  return {
    id: `local-sample-${number}`,
    doc_no: `TEST-SAMPLE-${number}`,
    doc_date: sampleDate,
    rows: [{
      ...newSample(`local-item-${number}`),
      sent_date: sampleDate,
      sample_date: sampleDate,
      product_name: sampleProduct,
      lot_no: `TEST-LOT-${number}`,
      deliverer_name: "เจ้าหน้าที่ทดสอบ",
      analysis_result_status: number % 2 ? "ผ่าน" as const : "ไม่ผ่าน" as const,
    }],
  };
});
