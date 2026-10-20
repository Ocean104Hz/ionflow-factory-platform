import {
  blankReport,
  blankFormula,
  type OrganicReport,
  type Profile,
} from "@/src/features/qc-organic-fertilizer/qc-organic-domain";
export const organicReports: OrganicReport[] = (
  ["itech", "ifoam"] as Profile[]
).flatMap((profile, p) =>
  [0, 1, 2].map((i) => {
    const r = blankReport(profile);
    r.id = `organic-${profile}-${i}`;
    r.doc_no = `QC-DEMO-${p + 1}-${i + 1}`;
    r.date = `2026-10-${String(20 - i).padStart(2, "0")}`;
    r.line = profile === "itech" ? "T1" : "F1";
    r.fertilizer = [
      {
        ...blankFormula(`formula-${profile}-${i}`),
        name: `สูตรปุ๋ยสาธิต ${i + 1}`,
        lot: `LOT-DEMO-${p + 1}-${i + 1}`,
        from_time: "09:00",
        to_time: "10:00",
      },
    ];
    r.measurements.moisture_content["09:00"] = "12";
    r.measurements.moisture_content["10:00"] = "14";
    r.measurements.water_solubility["09:00"] = "10.30";
    r.measurements.bulk_density["09:00"] = "750";
    r.measurements.dust_environment["09:00"] =
      profile === "itech" ? "น้อย" : "ฝุ่นปานกลาง";
    r.measurements.dust_environment["10:00"] =
      r.measurements.dust_environment["09:00"];
    r.measurements.dryer_temp_s2_test_1_3_2_4["09:00"] = "100/110//120";
    r.measurements.dryer_temp_s5_test_1_2_3_4_5_6["09:00"] =
      "100/110/120/130/140/150";
    r.measurements.bigbag_code_marking["09:00"] = i === 1 ? "false" : "true";
    r.metricNotes.moisture_content = "ข้อมูลสาธิต ไม่ใช่ผลทดสอบจริง";
    r.remark = "ตัวอย่างสมมติสำหรับตรวจ UI เท่านั้น";
    r.machine_start_time = "08:30";
    r.work_start_time = "09:00";
    r.work_stop_time = "07:00";
    r.stop_start = [
      {
        id: `stop-${i}`,
        machine_stop_time: "23:30",
        machine_run_time: "00:30",
        machine_stop_reason: "พักเครื่องสาธิต",
      },
    ];
    r.inspector = "ผู้ตรวจสาธิต";
    r.inspector_date = r.date;
    r.supervisor = "เจ้าหน้าที่ QC สาธิต";
    r.production = "ผู้ผลิตสาธิต";
    r.production_date = r.date;
    r.factory_qa = "ผู้จัดการสาธิต";
    return r;
  }),
);
