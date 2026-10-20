import {
  blankInspection,
  blankFormula,
  changeReading,
  type Inspection,
} from "@/src/features/production-quality/production-quality-domain";
import {
  qualityProfiles,
  type ProfileId,
} from "@/src/features/production-quality/production-quality-profiles";

function fixture(
  index: number,
  profileId: ProfileId,
  date: string,
): Inspection {
  let row: Inspection = {
    ...blankInspection(),
    id: `quality-demo-${index}`,
    profileId,
    inspectionDate: date,
    documentNumber: `QC-DEMO-${index.toString().padStart(3, "0")}`,
    productionSite: qualityProfiles[profileId].label,
    productionLine: qualityProfiles[profileId].lines[index % 3],
    recordStatus: index === 6 ? "DRAFT" : "RECORDED",
    formulas: [
      {
        ...blankFormula(`formula-${index}-a`),
        formulaName: "สูตรสาธิต A",
        lotCode: `LOT-DEMO-${index}A`,
        startTime: "09:00",
        endTime: "11:00",
        extraSlots: [],
      },
      {
        ...blankFormula(`formula-${index}-b`),
        formulaName: "สูตรสาธิต B",
        lotCode: `LOT-DEMO-${index}B`,
        startTime: "23:00",
        endTime: "02:00",
        extraSlots: ["03:00"],
      },
    ],
    machineStart: "08:00",
    workStart: "09:00",
    workStop: "07:00",
    stops: [
      {
        id: `stop-${index}`,
        stop: "23:30",
        restart: "00:15",
        reason: "ทำความสะอาดเครื่อง (ตัวอย่าง)",
      },
    ],
    signers: blankInspection().signers.map((s, i) => ({
      ...s,
      name: `เจ้าหน้าที่ตัวอย่าง ${i + 1}`,
      date: i === 0 || i === 2 ? date : "",
    })),
    notes: "ข้อมูลสมมติ ไม่ใช่ผลทดสอบจริงหรือหลักฐานการอนุมัติคุณภาพ",
    createdAt: `${date}T02:00:00Z`,
    updatedAt: `${date}T06:00:00Z`,
  };
  for (const slot of ["09:00", "10:00", "23:00", "01:00", "02:00"] as const) {
    row = changeReading(row, "moisture_content", slot, {
      kind: "numeric",
      value: String(10 + index / 10),
      note: "ตัวอย่างการวัด",
    });
    row = changeReading(row, "water_solubility", slot, {
      kind: "duration",
      value: slot === "09:00" ? "01:30" : "02:00",
      note: "",
    });
    row = changeReading(row, "bulk_density", slot, {
      kind: "numeric",
      value: "750.25",
      note: "",
    });
    row = changeReading(row, "percent_retained_5mm", slot, {
      kind: "numeric",
      value: "-",
      note: "ไม่ค้างตะแกรง",
    });
    row = changeReading(row, "percent_retained_2mm", slot, {
      kind: "numeric",
      value: "95",
      note: "",
    });
    row = changeReading(row, "percent_tray", slot, {
      kind: "numeric",
      value: "5",
      note: "",
    });
    row = changeReading(row, "inverter_status", slot, {
      kind: "numeric",
      value: "45",
      note: "",
    });
    row = changeReading(row, "granule_hardness", slot, {
      kind: "numeric",
      value: "1200",
      note: "",
    });
    row = changeReading(row, "dust_environment", slot, {
      kind: "text",
      value: qualityProfiles[profileId].dust[0],
      note: "",
    });
    row = changeReading(row, "dryer_temperature_group_a", slot, {
      kind: "temperature",
      value: ["70", "72", "71", "73"],
      note: "",
    });
    row = changeReading(row, "dryer_temperature_group_b", slot, {
      kind: "temperature",
      value: ["75", "76", "77", "78", "79", "80"],
      note: "",
    });
    for (const metric of [
      "bigbag_code_marking",
      "amino_drop_at_disc",
      "imo_spraying",
      "granule_coating",
      "operator_presence",
    ] as const)
      row = changeReading(row, metric, slot, {
        kind: "boolean",
        value:
          metric === "imo_spraying" && index === 2
            ? false
            : metric === "operator_presence" && index === 6
              ? null
              : true,
        note: "",
      });
  }
  return row;
}
export const demoQualityInspections: Inspection[] = [
  fixture(1, "ITECH", "2026-08-14"),
  fixture(2, "ITECH", "2026-09-10"),
  fixture(3, "IFOAM", "2026-09-20"),
  fixture(4, "IFOAM", "2026-10-05"),
  fixture(5, "ITECH", "2026-10-14"),
  fixture(6, "IFOAM", "2026-10-16"),
];
