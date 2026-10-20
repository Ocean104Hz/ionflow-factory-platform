export type PackagingProfileId = "ITECH" | "IFOAM";
export const packagingProfiles = {
  ITECH: {
    label: "โรงงานกาญ 1",
    locations: ["โรงงานกาญ 1"],
    multiSet: false,
    hourlySampling: false,
    signers: [
      "ผู้ตรวจสอบคุณภาพ",
      "เจ้าหน้าที่ควบคุมคุณภาพ",
      "ผู้จัดการโรงงาน / QA",
    ],
  },
  IFOAM: {
    label: "โรงงานกาญ 3",
    locations: ["โรงงานกาญ 3"],
    multiSet: true,
    hourlySampling: true,
    signers: [
      "ผู้ตรวจสอบคุณภาพ",
      "เจ้าหน้าที่ผู้คุมเครื่องแพ็ค",
      "ผู้จัดการฝ่ายผลิต",
      "ผู้จัดการโรงงาน / QA",
    ],
  },
} as const;
export const packagingTimes = Array.from(
  { length: 96 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
);
export const packagingUnits = [
  "kg",
  "g",
  "ton",
  "lb",
  "กิโลกรัม",
  "ตัน",
  "Bag",
] as const;
