export const timeSlots = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "01:00",
  "02:00",
  "03:00",
  "04:00",
  "05:00",
  "06:00",
  "07:00",
] as const;
export type Slot = (typeof timeSlots)[number];
export type Profile = "itech" | "ifoam";
export const profiles = {
  itech: {
    name: "iTech",
    location: "โรงงานกาญ 1",
    lines: ["T1", "T2", "T4"],
    lotKey: "lot",
    documentKey: "doc",
    dust: ["น้อย", "กลาง", "มาก"],
    temperatures: [
      "อุณหภูมิท่ออบ S2 ทดสอบ 1/3 ทดสอบ 2/4",
      "อุณหภูมิท่ออบ S5 ทดสอบ 1/2/3 ทดสอบ 4/5/6",
    ],
  },
  ifoam: {
    name: "iFoam",
    location: "โรงงานกาญ 3",
    lines: ["F1", "F2", "F3"],
    lotKey: "lot_no",
    documentKey: "doc_no",
    dust: ["ฝุ่นปานกลาง", "ฝุ่นเยอะ", "ฝุ่นเยอะมาก"],
    temperatures: [
      "อุณหภูมิท่ออบ ท่ออบ 1/2 ท่ออบ 3/4",
      "อุณหภูมิท่ออบ ท่ออบ 1/2 ท่ออบ 3/4 ท่ออบ 5/6",
    ],
  },
} as const;
export const metrics = [
  ["moisture_content", "ความชื้น", "numeric"],
  ["water_solubility", "การละลายน้ำ (ไม่เกิน 15 นาที)", "duration"],
  ["bulk_density", "ค่าน้ำหนักจำเพาะโดยปริมาตร", "numeric"],
  ["percent_retained_5mm", "เปอร์เซ็นต์ค้างตะแกรง 5 mm", "numeric"],
  ["percent_retained_2mm", "เปอร์เซ็นต์ค้างตะแกรง 2 mm", "numeric"],
  ["percent_tray", "เปอร์เซ็นต์ถาดรองรับ", "numeric"],
  ["inverter_status", "Inverter", "numeric"],
  ["dryer_temp_s2_test_1_3_2_4", "อุณหภูมิท่ออบชุดแรก", "temperature"],
  ["dryer_temp_s5_test_1_2_3_4_5_6", "อุณหภูมิท่ออบชุดที่สอง", "temperature"],
  ["granule_hardness", "ความแข็งเม็ดปุ๋ย", "numeric"],
  ["dust_environment", "สภาพแวดล้อมฝุ่นละออง", "dust"],
  ["bigbag_code_marking", "การจดรหัสลงบน BIGBAG", "boolean"],
  ["amino_drop_at_disc", "การหยดอะมิโนหน้าจาน", "boolean"],
  ["imo_spraying", "การพ่น IMO", "boolean"],
  ["granule_coating", "การเคลือบเม็ด", "boolean"],
  ["operator_presence", "การพบเจ้าหน้าที่ควบคุมเครื่อง", "boolean"],
] as const;
export type MetricKey = (typeof metrics)[number][0];
export type Measurements = Record<MetricKey, Record<Slot, string>>;
export const summaryFields = [
  ["moisture_sum", "moisture_content", "ความชื้น (รวม)"],
  ["dissolution_sum", "water_solubility", "การละลายน้ำ"],
  ["density_sum", "bulk_density", "ค่าน้ำหนักจำเพาะโดยปริมาตร"],
  ["sieve_5_sum", "percent_retained_5mm", "ค้างตะแกรง 5 mm"],
  ["sieve_2_sum", "percent_retained_2mm", "ค้างตะแกรง 2 mm"],
  ["draining_tray_sum", "percent_tray", "ถาดรองรับ"],
  ["hardness_sum", "granule_hardness", "ความแข็งเม็ดปุ๋ย"],
] as const;
export interface Formula {
  id: string;
  name: string;
  lot: string;
  from_time: string;
  to_time: string;
  extra_times: Slot[];
  volume_sum: string;
}
export interface Stop {
  id: string;
  machine_stop_time: string;
  machine_run_time: string;
  machine_stop_reason: string;
}
export const reportFields = [
  ["date", "วันที่ตรวจสอบ", "date"],
  ["doc_no", "เลขที่เอกสาร", "text"],
  ["location", "สถานที่", "text"],
  ["machine_start_time", "เริ่มเดินเครื่อง", "time"],
  ["work_start_time", "เวลาทำงานตั้งแต่", "time"],
  ["work_stop_time", "เวลาทำงานถึง", "time"],
  ["inspector", "ผู้ตรวจสอบคุณภาพ", "text"],
  ["inspector_date", "วันที่ตรวจสอบ (ผู้ตรวจ)", "date"],
  ["supervisor", "เจ้าหน้าที่ควบคุมคุณภาพ", "text"],
  ["production", "เจ้าหน้าที่ผลิต", "text"],
  ["production_date", "วันที่ฝ่ายผลิต", "date"],
  ["factory_qa", "ผู้จัดการโรงงาน / QA", "text"],
] as const;
export type ReportField = (typeof reportFields)[number][0];
export type OrganicReport = Record<ReportField, string> & {
  id: string;
  profile: Profile;
  line: string;
  fertilizer: Formula[];
  measurements: Measurements;
  metricNotes: Record<MetricKey, string>;
  stop_start: Stop[];
  remark: string;
};
export type Errors = Record<string, string>;
export function blankFormula(id: string): Formula {
  return {
    id,
    name: "",
    lot: "",
    from_time: "",
    to_time: "",
    extra_times: [],
    volume_sum: "",
  };
}
export function blankReport(profile: Profile = "itech"): OrganicReport {
  return {
    id: "",
    profile,
    line: "",
    date: "",
    doc_no: "",
    location: profiles[profile].location,
    machine_start_time: "",
    work_start_time: "",
    work_stop_time: "",
    inspector: "",
    inspector_date: "",
    supervisor: "",
    production: "",
    production_date: "",
    factory_qa: "",
    fertilizer: [blankFormula("formula-initial")],
    measurements: Object.fromEntries(
      metrics.map(([key]) => [
        key,
        Object.fromEntries(timeSlots.map((t) => [t, ""])),
      ]),
    ) as Measurements,
    metricNotes: Object.fromEntries(
      metrics.map(([key]) => [key, ""]),
    ) as Record<MetricKey, string>,
    stop_start: [],
    remark: "",
  };
}
export function metricLabel(profile: Profile, key: MetricKey): string {
  if (key === "dryer_temp_s2_test_1_3_2_4")
    return profiles[profile].temperatures[0];
  if (key === "dryer_temp_s5_test_1_2_3_4_5_6")
    return profiles[profile].temperatures[1];
  return metrics.find((m) => m[0] === key)![1];
}
export function temperatureCount(key: MetricKey) {
  return key === "dryer_temp_s2_test_1_3_2_4" ? 4 : 6;
}
export function selectedTimes(f: Formula): Slot[] {
  const from = timeSlots.indexOf(f.from_time as Slot),
    to = timeSlots.indexOf(f.to_time as Slot);
  const range =
    from < 0 || to < 0
      ? []
      : to >= from
        ? timeSlots.slice(from, to + 1)
        : [...timeSlots.slice(from), ...timeSlots.slice(0, to + 1)];
  return [
    ...new Set([
      ...range,
      ...f.extra_times.filter((t) => timeSlots.includes(t)),
    ]),
  ];
}
export function durationSeconds(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [m, s = ""] = value.split(".");
  return Number(m) * 60 + Number(s.padEnd(2, "0"));
}
export function durationDisplay(value: number | null): string {
  return value === null
    ? "—"
    : `${Math.floor(value / 60)} นาที ${Math.round(value % 60)} วินาที`;
}
export function calculation(row: OrganicReport, f: Formula) {
  const slots = selectedTimes(f);
  const values = Object.fromEntries(
    summaryFields.map(([target, key]) => {
      const found = slots
        .map((t) => row.measurements[key][t].trim())
        .filter((v) => v !== "")
        .map((v) =>
          key === "water_solubility"
            ? durationSeconds(v)
            : key === "percent_retained_5mm" && v === "-"
              ? 0
              : Number(v),
        )
        .filter((v): v is number => v !== null && Number.isFinite(v));
      const average = found.length
        ? found.reduce((a, b) => a + b, 0) / found.length
        : null;
      return [
        target,
        key === "water_solubility" && average !== null
          ? Math.round(average)
          : average,
      ];
    }),
  ) as Record<(typeof summaryFields)[number][0], number | null>;
  return {
    fertilizer_testing: slots.length,
    ...values,
    volume_sum: f.volume_sum === "" ? null : Number(f.volume_sum),
  };
}
export function minutesBetween(from: string, to: string): number | null {
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(from) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(to)
  )
    return null;
  const minute = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (minute(to) - minute(from) + 1440) % 1440;
}
const dateValid = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export function validateReport(
  row: OrganicReport,
  records: readonly OrganicReport[],
): Errors {
  const e: Errors = {};
  if (!dateValid(row.date)) e.date = "กรุณาระบุวันที่ตรวจสอบที่ถูกต้อง";
  if (!row.doc_no.trim()) e.doc_no = "กรุณากรอกเลขที่เอกสาร";
  else if (
    records.some(
      (r) =>
        r.id !== row.id &&
        r.doc_no.trim().toLowerCase() === row.doc_no.trim().toLowerCase() &&
        r.profile === row.profile,
    )
  )
    e.doc_no = "เลขที่เอกสารซ้ำในโรงงานนี้";
  if (!row.location.trim()) e.location = "กรุณากรอกสถานที่";
  if (!(profiles[row.profile].lines as readonly string[]).includes(row.line))
    e.line = "กรุณาเลือก Line ให้ตรงกับโรงงาน";
  if (!row.fertilizer.length)
    e.fertilizer = "กรุณาเพิ่มสูตรปุ๋ยอย่างน้อย 1 รายการ";
  const reserved = new Set<Slot>();
  for (const f of row.fertilizer) {
    if (!f.name.trim()) e[`formula-${f.id}-name`] = "กรุณากรอกชื่อสูตรปุ๋ย";
    if (!f.lot.trim()) e[`formula-${f.id}-lot`] = "กรุณากรอก Lot การผลิต";
    if (
      (f.from_time || f.to_time) &&
      (!timeSlots.includes(f.from_time as Slot) ||
        !timeSlots.includes(f.to_time as Slot))
    )
      e[`formula-${f.id}-range`] = "กรุณาเลือกเวลาเริ่มและสิ้นสุดให้ครบ";
    if (f.volume_sum !== "" && !Number.isFinite(Number(f.volume_sum)))
      e[`formula-${f.id}-volume`] = "กรุณาระบุ volume_sum เป็นตัวเลข";
    for (const t of selectedTimes(f)) {
      if (reserved.has(t))
        e[`formula-${f.id}-range`] = "ช่วงเวลาซ้ำกับสูตรอื่น กรุณาตรวจสอบ";
      reserved.add(t);
    }
  }
  if (new Set(row.fertilizer.map((f) => f.id)).size !== row.fertilizer.length)
    e.fertilizer = "รหัสรายการสูตรซ้ำ";
  for (const t of timeSlots) {
    const active = metrics.some(
      ([key]) => row.measurements[key][t].trim() !== "",
    );
    for (const [key, , kind] of metrics) {
      const v = row.measurements[key][t].trim(),
        k = `cell-${key}-${t}`;
      if (
        v &&
        kind === "numeric" &&
        !(key === "percent_retained_5mm" && v === "-") &&
        !Number.isFinite(Number(v))
      )
        e[k] = "กรุณากรอกตัวเลขที่ถูกต้อง";
      if (v && kind === "duration" && durationSeconds(v) === null)
        e[k] = "ใช้รูปแบบ นาที.วินาที เช่น 10.30";
      if (v && kind === "boolean" && !["true", "false"].includes(v))
        e[k] = "เลือก ไม่ตรวจ / ผ่าน / ไม่ผ่าน";
      if (
        kind === "dust" &&
        ((active && !v) ||
          (v && !(profiles[row.profile].dust as readonly string[]).includes(v)))
      )
        e[k] = "กรุณาระบุสภาพฝุ่นของโรงงานในช่วงเวลาที่บันทึก";
      if (v && kind === "temperature") {
        const parts = v.split("/");
        if (
          parts.length !== temperatureCount(key) ||
          parts.some((p) => p.trim() !== "" && !Number.isFinite(Number(p)))
        )
          e[k] = "กรุณาระบุอุณหภูมิเป็นตัวเลขตามจุดที่กำหนด";
      }
    }
  }
  for (const [key, , kind] of reportFields) {
    const v = row[key];
    if (v && kind === "date" && !dateValid(v)) e[key] = "วันที่ไม่ถูกต้อง";
    if (v && kind === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v))
      e[key] = "เวลาไม่ถูกต้อง";
  }
  for (const s of row.stop_start) {
    if (!s.machine_stop_time || !s.machine_stop_reason.trim())
      e[`stop-${s.id}`] =
        "กรุณาระบุเวลาหยุดเครื่องและสาเหตุ (เวลาเดินเครื่องอีกครั้งเว้นว่างได้)";
    for (const t of [s.machine_stop_time, s.machine_run_time])
      if (t && minutesBetween(t, t) === null)
        e[`stop-${s.id}`] = "เวลาไม่ถูกต้อง";
  }
  if (new Set(row.stop_start.map((s) => s.id)).size !== row.stop_start.length)
    e.stops = "รหัสรายการหยุดเครื่องซ้ำ";
  return e;
}
export function saveReport(
  records: readonly OrganicReport[],
  input: OrganicReport,
  id: string,
) {
  const errors = validateReport(input, records);
  if (Object.keys(errors).length)
    throw new Error(Object.values(errors).join(" · "));
  if (input.id && !records.some((r) => r.id === input.id))
    throw new Error("ไม่พบเอกสารที่แก้ไข");
  if (
    input.id &&
    records.find((r) => r.id === input.id)?.profile !== input.profile
  )
    throw new Error("เปลี่ยนโรงงานของเอกสารเดิมไม่ได้");
  if (!input.id && records.some((r) => r.id === id))
    throw new Error("รหัสเอกสารซ้ำ");
  const saved = structuredClone({
    ...input,
    id: input.id || id,
    doc_no: input.doc_no.trim(),
  });
  return {
    saved,
    records: input.id
      ? records.map((r) => (r.id === saved.id ? saved : r))
      : [saved, ...records],
  };
}
export function deleteReport(records: readonly OrganicReport[], id: string) {
  return records.filter((r) => r.id !== id);
}
export function filterReports(
  records: readonly OrganicReport[],
  filters: { search: string; profile: string; from: string; to: string },
) {
  const q = filters.search.trim().toLocaleLowerCase();
  return records.filter(
    (r) =>
      (filters.profile === "all" || r.profile === filters.profile) &&
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to) &&
      [
        r.doc_no,
        r.location,
        r.line,
        ...r.fertilizer.flatMap((f) => [f.name, f.lot]),
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
  );
}
// Explicit adapters document legacy differences; these never send data anywhere.
export function legacyFormula(
  profile: Profile,
  f: Formula,
): { name: string; lot: string } | { name: string; lot_no: string } {
  return profile === "itech"
    ? { name: f.name, lot: f.lot }
    : { name: f.name, lot_no: f.lot };
}
export function legacyDocument(
  row: OrganicReport,
): { doc: string } | { doc_no: string } {
  return row.profile === "itech" ? { doc: row.doc_no } : { doc_no: row.doc_no };
}
