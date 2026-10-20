import {
  blankLog,
  setLogType,
  setLogForm,
  type SubmissionLog,
} from "@/src/features/sample-submission-log/submission-log-domain";
export const demoSubmissionLogs: SubmissionLog[] = Array.from(
  { length: 6 },
  (_, i) => {
    const r = setLogForm(
      setLogType(
        blankLog(),
        i % 2 ? "chemical_fertilizer" : "organic_fertilizer",
      ),
      i % 2 ? "granule" : "powder",
    );
    r.id = `log-demo-${i + 1}`;
    r.doc_no = `LAB-DEMO-000${i + 1}`;
    r.sample_code = `S-DEMO-${i + 1}`;
    r.requester_name = `ผู้ส่งสาธิต ${i + 1}`;
    r.requester_address = "ที่อยู่สมมติสำหรับทดสอบ UI เท่านั้น";
    r.requester_phone = "";
    r.requester_email = "sample@example.com";
    r.sample_name = `ตัวอย่างปุ๋ยสาธิต ${i + 1}`;
    r.sample_characteristics = "ตัวอย่างจำลองสำหรับการออกแบบ";
    r.requested_items.ph = true;
    r.requested_items.moisture = true;
    if (i % 2) r.requested_items.total_n = true;
    r.quantity.amount = i === 0 ? "0.50" : "2.00";
    r.quantity.packaging = "ถุงปิดผนึกสาธิต";
    r.quantity.receive_result = {
      sample_return: i % 2 === 0,
      not_return: i % 2 !== 0,
      pick_up: i % 2 === 0,
      mail: i % 2 !== 0,
    };
    r.sender_sign = {
      signer_name: `ผู้นำส่งสาธิต ${i + 1}`,
      signed_date: `2026-10-${String(20 - i).padStart(2, "0")}`,
    };
    if (i === 2) {
      r.staff_section.sample_condition.abnormal = true;
      r.staff_section.sample_condition.abnormal_detail =
        "บรรจุภัณฑ์ตัวอย่างชำรุด (สมมติ)";
      r.staff_section.job_acceptance.rejected = true;
      r.staff_section.job_acceptance.reject_reason =
        "รอข้อมูลเพิ่มเติมในตัวอย่าง UI เท่านั้น";
    }
    if (i === 3) {
      r.staff_section.sample_condition.normal = true;
      r.staff_section.received_by = "เจ้าหน้าที่สาธิต";
      r.staff_section.received_date = "2026-10-18";
      r.staff_section.job_acceptance.accepted = true;
      r.staff_section.accepted_by = "ผู้ทบทวนสาธิต";
      r.staff_section.accepted_date = "2026-10-18";
    }
    return r;
  },
);
