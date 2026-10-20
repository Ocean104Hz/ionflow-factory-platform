import {
  newSample,
  type SampleSubmission,
} from "@/src/features/sample-submissions/sample-submission-domain";
export const demoSampleSubmissions: SampleSubmission[] = Array.from(
  { length: 6 },
  (_, i) => ({
    id: `submission-demo-${i + 1}`,
    doc_no: `SAMPLE-DEMO-000${i + 1}`,
    doc_date: `2026-10-${String(20 - i).padStart(2, "0")}`,
    rows: Array.from({ length: (i % 2) + 1 }, (_, j) => ({
      ...newSample(`sample-demo-${i}-${j}`),
      sent_date: "2026-10-14",
      sample_date: "2026-10-13",
      product_name: `ตัวอย่างปุ๋ยสาธิต ${i + 1}.${j + 1}`,
      lot_no: `DEMO-LOT-${i + 1}-${j + 1}`,
      deliverer_name: "ผู้นำส่งตัวอย่างสาธิต",
      analysis_receiver: i % 3 ? "เจ้าหน้าที่วิเคราะห์สาธิต" : "",
      analysis_result_status:
        i % 3 === 0
          ? null
          : i % 3 === 1
            ? ("ผ่าน" as const)
            : ("ไม่ผ่าน" as const),
      analysis_result_sender: i % 3 ? "ผู้ส่งผลสาธิต" : "",
      analysis_result_receiver: i % 3 ? "ผู้รับผลสาธิต" : "",
      remark: "ข้อมูลสมมติ ผลรายตัวอย่างไม่ใช่การอนุมัติ QA หรือปล่อยสต็อก",
    })),
  }),
);
