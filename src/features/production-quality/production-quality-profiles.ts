export type ProfileId = "ITECH" | "IFOAM";
export const qualityProfiles: Record<
  ProfileId,
  {
    label: string;
    lines: readonly string[];
    dust: readonly string[];
    dryerA: string;
    dryerB: string;
  }
> = {
  ITECH: {
    label: "โรงงานกาญ 1",
    lines: ["T1", "T2", "T4"],
    dust: ["น้อย", "กลาง", "มาก"],
    dryerA: "อุณหภูมิท่ออบ S2 ทดสอบ 1/3 ทดสอบ 2/4",
    dryerB: "อุณหภูมิท่ออบ S5 ทดสอบ 1/2/3 ทดสอบ 4/5/6",
  },
  IFOAM: {
    label: "โรงงานกาญ 3",
    lines: ["F1", "F2", "F3"],
    dust: ["ฝุ่นปานกลาง", "ฝุ่นเยอะ", "ฝุ่นเยอะมาก"],
    dryerA: "อุณหภูมิท่ออบ ท่ออบ 1/2 ท่ออบ 3/4",
    dryerB: "อุณหภูมิท่ออบ ท่ออบ 1/2 ท่ออบ 3/4 ท่ออบ 5/6",
  },
};
