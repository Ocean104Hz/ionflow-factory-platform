import { qualityProfiles, type ProfileId } from "./production-quality-profiles";

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
export const metrics = [
  {
    id: "moisture_content",
    label: "ความชื้น (%)",
    kind: "numeric",
    percent: true,
  },
  {
    id: "water_solubility",
    label: "การละลายน้ำ (นาที:วินาที)",
    kind: "duration",
  },
  { id: "bulk_density", label: "น้ำหนักจำเพาะโดยปริมาตร (g)", kind: "numeric" },
  {
    id: "percent_retained_5mm",
    label: "ค้างตะแกรง 5 mm (%)",
    kind: "numeric",
    percent: true,
  },
  {
    id: "percent_retained_2mm",
    label: "ค้างตะแกรง 2 mm (%)",
    kind: "numeric",
    percent: true,
  },
  {
    id: "percent_tray",
    label: "ถาดรองรับ (%)",
    kind: "numeric",
    percent: true,
  },
  { id: "inverter_status", label: "Inverter", kind: "numeric" },
  {
    id: "dryer_temperature_group_a",
    label: "อุณหภูมิท่ออบ ชุด A (°C)",
    kind: "temperature",
    points: 4,
  },
  {
    id: "dryer_temperature_group_b",
    label: "อุณหภูมิท่ออบ ชุด B (°C)",
    kind: "temperature",
    points: 6,
  },
  { id: "granule_hardness", label: "ความแข็งเม็ดปุ๋ย (g)", kind: "numeric" },
  { id: "dust_environment", label: "สภาพแวดล้อมฝุ่นละออง", kind: "text" },
  { id: "bigbag_code_marking", label: "การจดรหัสลงบน BIGBAG", kind: "boolean" },
  { id: "amino_drop_at_disc", label: "การหยดอะมิโนหน้าจาน", kind: "boolean" },
  { id: "imo_spraying", label: "การพ่น IMO", kind: "boolean" },
  { id: "granule_coating", label: "การเคลือบเม็ด", kind: "boolean" },
  {
    id: "operator_presence",
    label: "พบเจ้าหน้าที่คุมเครื่อง",
    kind: "boolean",
  },
] as const;
export type Metric = (typeof metrics)[number];
export type MetricId = Metric["id"];
export type Reading = (
  | { kind: "numeric" | "duration" | "text"; value: string }
  | { kind: "boolean"; value: boolean | null }
  | { kind: "temperature"; value: string[] }
) & { note: string };
export type Formula = {
  id: string;
  formulaName: string;
  lotCode: string;
  startTime: Slot | "";
  endTime: Slot | "";
  extraSlots: Slot[];
};
export const signerRoles = [
  "ผู้ตรวจสอบคุณภาพ",
  "เจ้าหน้าที่ควบคุมคุณภาพ",
  "เจ้าหน้าที่ผลิต",
  "ผู้จัดการโรงงาน/QA",
] as const;
export type Inspection = {
  id: string;
  profileId: ProfileId;
  inspectionDate: string;
  documentNumber: string;
  productionSite: string;
  productionLine: string;
  recordStatus: "DRAFT" | "RECORDED";
  disposition: "NOT_EVALUATED";
  formulas: Formula[];
  readings: Partial<Record<MetricId, Partial<Record<Slot, Reading>>>>;
  machineStart: string;
  workStart: string;
  workStop: string;
  stops: { id: string; stop: string; restart: string; reason: string }[];
  signers: { role: (typeof signerRoles)[number]; name: string; date: string }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export const statusLabel = (row: Inspection) =>
  row.recordStatus === "DRAFT" ? "แบบร่าง" : "บันทึกผลตรวจแล้ว";
export function blankFormula(id: string): Formula {
  return {
    id,
    formulaName: "",
    lotCode: "",
    startTime: "",
    endTime: "",
    extraSlots: [],
  };
}
export function blankInspection(): Inspection {
  return {
    id: "",
    profileId: "ITECH",
    inspectionDate: "",
    documentNumber: "",
    productionSite: "",
    productionLine: "",
    recordStatus: "DRAFT",
    disposition: "NOT_EVALUATED",
    formulas: [blankFormula("formula-1")],
    readings: {},
    machineStart: "",
    workStart: "",
    workStop: "",
    stops: [],
    signers: signerRoles.map((role) => ({ role, name: "", date: "" })),
    notes: "",
    createdAt: "",
    updatedAt: "",
  };
}
export function emptyReading(metric: Metric): Reading {
  if (metric.kind === "temperature")
    return {
      kind: "temperature",
      value: Array<string>(metric.points).fill(""),
      note: "",
    };
  if (metric.kind === "boolean")
    return { kind: "boolean", value: null, note: "" };
  return { kind: metric.kind, value: "", note: "" };
}
export function hasObservation(reading?: Reading): boolean {
  if (!reading) return false;
  if (reading.kind === "boolean") return reading.value !== null;
  if (reading.kind === "temperature")
    return reading.value.some((v) => v.trim() !== "");
  return reading.value.trim() !== "";
}
export function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export function parseNumeric(raw: string, metric: Metric): number | null {
  const v = raw.trim();
  // Only the legacy 5 mm sieve convention treats an explicit dash as zero.
  if (v === "-" && metric.id === "percent_retained_5mm") return 0;
  if (!/^\d+(?:\.\d{1,3})?$/.test(v)) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n > 1e9 || ("percent" in metric && n > 100))
    return null;
  return n;
}
export function parseDuration(raw: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(raw.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const rounded = Math.round(seconds);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`;
}
export function formatDate(value: string): string {
  return validDate(value)
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${value}T00:00:00+07:00`))
    : "—";
}
export function displayReading(reading?: Reading): string {
  if (!reading) return "";
  if (reading.kind === "boolean")
    return reading.value === null
      ? "ยังไม่ตรวจ"
      : reading.value
        ? "ผ่าน"
        : "ไม่ผ่าน";
  return reading.kind === "temperature"
    ? reading.value.map((v) => v || "—").join(" / ")
    : reading.value;
}
export function selectedSlots(formula: Formula): Slot[] {
  const start = timeSlots.indexOf(formula.startTime as Slot),
    end = timeSlots.indexOf(formula.endTime as Slot);
  const range =
    start >= 0 && end >= start ? timeSlots.slice(start, end + 1) : [];
  return timeSlots.filter(
    (slot) => range.includes(slot) || formula.extraSlots.includes(slot),
  );
}
export const averageMetricIds = [
  "moisture_content",
  "water_solubility",
  "bulk_density",
  "percent_retained_5mm",
  "percent_retained_2mm",
  "percent_tray",
  "granule_hardness",
] as const;
export function averageFor(
  row: Inspection,
  metricId: MetricId,
  slots: readonly Slot[],
): number | null {
  const metric = metrics.find((m) => m.id === metricId)!;
  const values = slots.flatMap((slot) => {
    const reading = row.readings[metricId]?.[slot];
    if (!reading || !hasObservation(reading)) return [];
    const n =
      reading.kind === "duration"
        ? parseDuration(reading.value)
        : reading.kind === "numeric"
          ? parseNumeric(reading.value, metric)
          : null;
    return n === null ? [] : [n];
  });
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
export function removeFormula(row: Inspection, id: string): Inspection {
  return { ...row, formulas: row.formulas.filter((f) => f.id !== id) };
}
export function changeReading(
  row: Inspection,
  metric: MetricId,
  slot: Slot,
  reading: Reading,
): Inspection {
  return {
    ...row,
    readings: {
      ...row.readings,
      [metric]: { ...row.readings[metric], [slot]: structuredClone(reading) },
    },
  };
}
export function warnings(row: Inspection): string[] {
  return timeSlots.flatMap((slot) => {
    const cells = metrics.map((m) => row.readings[m.id]?.[slot]);
    if (!cells.some(hasObservation)) return [];
    const messages: string[] = [];
    if (!hasObservation(row.readings.dust_environment?.[slot]))
      messages.push(`${slot}: ยังไม่มีข้อมูลฝุ่น`);
    const a = row.readings.dryer_temperature_group_a?.[slot],
      b = row.readings.dryer_temperature_group_b?.[slot];
    if (
      ![a, b].some(
        (r) =>
          r?.kind === "temperature" && r.value.every((v) => v.trim() !== ""),
      )
    )
      messages.push(
        `${slot}: ข้อมูลอุณหภูมิยังไม่ครบอย่างน้อยหนึ่งชุด (คำเตือน)`,
      );
    if (cells.some((r) => r?.kind === "boolean" && r.value === false))
      messages.push(
        `${slot}: พบผลตรวจไม่ผ่านบางรายการ กรุณาตรวจสอบ ไม่ใช่การตัดสินทั้งเอกสาร`,
      );
    return messages;
  });
}
export const clockMinutes = (v: string): number | null =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
    ? Number(v.slice(0, 2)) * 60 + Number(v.slice(3))
    : null;
export function validateInspection(
  row: Inspection,
  records: readonly Inspection[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const required = row.recordStatus === "RECORDED";
  const profile = qualityProfiles[row.profileId];
  if (!profile) errors.profileId = "กรุณาเลือกโรงงานที่รองรับ";
  if (
    row.disposition !== "NOT_EVALUATED" ||
    !["DRAFT", "RECORDED"].includes(row.recordStatus)
  )
    errors.recordStatus = "ไม่รองรับสถานะอนุมัติคุณภาพรวม";
  for (const field of [
    "inspectionDate",
    "documentNumber",
    "productionSite",
    "productionLine",
  ] as const)
    if (required && !row[field].trim()) errors[field] = "กรุณาระบุข้อมูลนี้";
  if (row.inspectionDate && !validDate(row.inspectionDate))
    errors.inspectionDate = "วันที่ไม่ถูกต้อง";
  if (row.productionLine && !profile?.lines.includes(row.productionLine))
    errors.productionLine = "สายการผลิตไม่อยู่ในโรงงานที่เลือก";
  const number = row.documentNumber.trim().toLowerCase();
  if (
    number &&
    records.some(
      (r) =>
        r.id !== row.id &&
        r.profileId === row.profileId &&
        r.documentNumber.trim().toLowerCase() === number,
    )
  )
    errors.documentNumber = "เลขที่เอกสารซ้ำในโรงงานนี้";
  if (
    new Set(row.formulas.map((f) => f.id)).size !== row.formulas.length ||
    row.formulas.some((f) => !f.id)
  )
    errors.formulas = "รหัสแถวสูตรไม่ถูกต้องหรือซ้ำ";
  if (
    required &&
    !row.formulas.some((f) => f.formulaName.trim() && f.lotCode.trim())
  )
    errors.formulas = "ต้องมีสูตรและ Lot อย่างน้อย 1 รายการ";
  for (const f of row.formulas) {
    if (
      (f.formulaName.trim() || f.lotCode.trim()) &&
      !(f.formulaName.trim() && f.lotCode.trim())
    )
      errors[`formula.${f.id}`] = "กรอกสูตรและ Lot ให้ครบคู่";
    if (
      (f.startTime || f.endTime) &&
      (!timeSlots.includes(f.startTime as Slot) ||
        !timeSlots.includes(f.endTime as Slot) ||
        timeSlots.indexOf(f.startTime as Slot) >
          timeSlots.indexOf(f.endTime as Slot))
    )
      errors[`calculation.${f.id}`] =
        "เลือกช่วงเวลาตามลำดับวันผลิต 09:00 → 07:00 ของวันถัดไป";
    if (f.extraSlots.some((s) => !timeSlots.includes(s)))
      errors[`calculation.${f.id}`] = "เวลาเพิ่มเติมไม่อยู่ในรอบตรวจ";
  }
  let observed = 0;
  for (const [metricId, series] of Object.entries(row.readings)) {
    const metric = metrics.find((m) => m.id === metricId);
    for (const [slot, r] of Object.entries(series)) {
      const key = `${metricId}.${slot}`;
      if (
        !metric ||
        !timeSlots.includes(slot as Slot) ||
        r.kind !== metric.kind
      ) {
        errors[key] = "ชนิดข้อมูลหรือเวลาตรวจไม่ถูกต้อง";
        continue;
      }
      if (
        r.kind === "boolean" &&
        r.value !== null &&
        typeof r.value !== "boolean"
      )
        errors[key] = "ผลตรวจต้องเป็น ผ่าน / ไม่ผ่าน / ยังไม่ตรวจ";
      if (
        r.kind === "temperature" &&
        (r.value.length !== ("points" in metric ? metric.points : 0) ||
          r.value.some((v) => v.trim() && parseNumeric(v, metric) === null))
      )
        errors[key] = "อุณหภูมิต้องเป็นตัวเลขไม่ติดลบ ทศนิยมไม่เกิน 3 ตำแหน่ง";
      if (!hasObservation(r)) continue;
      observed++;
      if (r.kind === "numeric" && parseNumeric(r.value, metric) === null)
        errors[key] =
          "ตัวเลขไม่ถูกต้อง: ไม่ติดลบ ทศนิยมไม่เกิน 3 ตำแหน่ง; เปอร์เซ็นต์ 0–100";
      if (r.kind === "duration" && parseDuration(r.value) === null)
        errors[key] = "ใช้ นาที:วินาที เช่น 01:30 (วินาที 00–59)";
      if (r.kind === "text" && !profile?.dust.includes(r.value))
        errors[key] = "เลือกค่าฝุ่นของโรงงานนี้";
    }
  }
  if (required && !observed)
    errors.readings = "ต้องมีผลตรวจอย่างน้อย 1 ค่า ก่อนบันทึกผลตรวจ";
  const times = ["machineStart", "workStart", "workStop"] as const;
  for (const key of times)
    if (row[key] && clockMinutes(row[key]) === null)
      errors[key] = "ระบุเวลา HH:mm ให้ถูกต้อง";
  const origin =
    clockMinutes(row.machineStart) ?? clockMinutes(row.workStart) ?? 9 * 60;
  const relative = (v: string) => {
    const n = clockMinutes(v)!;
    return n < origin ? n + 1440 : n;
  };
  if (
    row.machineStart &&
    row.workStart &&
    relative(row.machineStart) > relative(row.workStart)
  )
    errors.machineStart =
      "เวลาเปิดเครื่องต้องไม่อยู่หลังเริ่มงานในวันผลิตเดียวกัน";
  const spans: { start: number; end: number }[] = [];
  if (new Set(row.stops.map((s) => s.id)).size !== row.stops.length)
    errors.stops = "รหัสช่วงหยุดเครื่องซ้ำ";
  for (const stop of row.stops) {
    if (!stop.stop && !stop.restart && !stop.reason.trim()) continue;
    const key = `stop.${stop.id}`;
    if (
      clockMinutes(stop.stop) === null ||
      clockMinutes(stop.restart) === null ||
      !stop.reason.trim()
    ) {
      errors[key] = "ระบุเวลาหยุด เวลาเริ่มใหม่ และเหตุผลให้ครบ";
      continue;
    }
    const start = relative(stop.stop),
      end = relative(stop.restart);
    if (
      end <= start ||
      (row.workStart &&
        clockMinutes(row.workStart) !== null &&
        start < relative(row.workStart)) ||
      (row.workStop &&
        clockMinutes(row.workStop) !== null &&
        end > relative(row.workStop)) ||
      spans.some((s) => start < s.end && end > s.start)
    )
      errors[key] =
        "ช่วงหยุดซ้ำ ทับซ้อน หรือขัดกับเวลาทำงาน (รองรับข้ามเที่ยงคืน)";
    spans.push({ start, end });
  }
  if (
    row.signers.length !== signerRoles.length ||
    signerRoles.some(
      (role) => row.signers.filter((s) => s.role === role).length !== 1,
    )
  )
    errors.signers = "บทบาทผู้ลงชื่อไม่ครบหรือซ้ำ";
  row.signers.forEach((s, i) => {
    if (s.date && (!validDate(s.date) || !s.name.trim()))
      errors[`signer.${i}`] = "ระบุชื่อพร้อมวันที่ที่ถูกต้อง";
  });
  return errors;
}
export function saveInspection(
  records: readonly Inspection[],
  input: Inspection,
  newId: string,
  at: string,
): { records: Inspection[]; record: Inspection } {
  const old = input.id ? records.find((r) => r.id === input.id) : undefined;
  if (input.id && !old) throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  if (old && old.profileId !== input.profileId)
    throw new Error("ไม่สามารถเปลี่ยนโรงงานของเอกสารที่บันทึกแล้ว");
  if (old?.recordStatus === "RECORDED" && input.recordStatus === "DRAFT")
    throw new Error("เอกสารบันทึกผลแล้ว ไม่สามารถย้อนเป็นแบบร่าง");
  const errors = validateInspection(input, records);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (!old && (!newId || records.some((r) => r.id === newId)))
    throw new Error("รหัสเอกสารไม่ถูกต้องหรือซ้ำ");
  const record = structuredClone({
    ...input,
    id: old?.id ?? newId,
    documentNumber: input.documentNumber.trim(),
    createdAt: old?.createdAt ?? at,
    updatedAt: at,
  });
  return {
    record,
    records: old
      ? records.map((r) => (r.id === old.id ? record : r))
      : [...records, record],
  };
}
export function deleteInspection(
  records: readonly Inspection[],
  id: string,
): Inspection[] {
  if (!records.some((r) => r.id === id))
    throw new Error("ไม่พบเอกสารที่ต้องการลบ");
  return records.filter((r) => r.id !== id);
}
export type HistoryFilters = {
  search: string;
  profile: string;
  line: string;
  from: string;
  to: string;
  formula: string;
  status: string;
};
export const emptyFilters: HistoryFilters = {
  search: "",
  profile: "all",
  line: "all",
  from: "",
  to: "",
  formula: "all",
  status: "all",
};
export function filterHistory(
  rows: readonly Inspection[],
  f: HistoryFilters,
): Inspection[] {
  const q = f.search.trim().toLowerCase();
  return rows
    .filter(
      (r) =>
        (!q ||
          [
            r.documentNumber,
            r.productionSite,
            ...r.formulas.flatMap((x) => [x.formulaName, x.lotCode]),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (f.profile === "all" || r.profileId === f.profile) &&
        (f.line === "all" || r.productionLine === f.line) &&
        (!f.from || r.inspectionDate >= f.from) &&
        (!f.to || r.inspectionDate <= f.to) &&
        (f.formula === "all" ||
          r.formulas.some((x) => x.formulaName === f.formula)) &&
        (f.status === "all" || r.recordStatus === f.status),
    )
    .sort(
      (a, b) =>
        b.inspectionDate.localeCompare(a.inspectionDate) ||
        a.id.localeCompare(b.id),
    );
}
export function paginate<T>(
  rows: readonly T[],
  page: number,
  size: number,
): { rows: T[]; page: number } {
  const safeSize = Math.max(1, Math.floor(size)),
    safe = Math.min(
      Math.max(1, Math.floor(page)),
      Math.max(1, Math.ceil(rows.length / safeSize)),
    );
  return {
    rows: rows.slice((safe - 1) * safeSize, safe * safeSize),
    page: safe,
  };
}
export function yearlySummary(
  rows: readonly Inspection[],
  year: string,
  month: string,
  profile: string,
  formula: string,
) {
  const chosen = rows.filter(
    (r) =>
      r.recordStatus === "RECORDED" &&
      r.inspectionDate.slice(0, 4) === year &&
      (month === "all" || r.inspectionDate.slice(5, 7) === month) &&
      (profile === "all" || r.profileId === profile) &&
      (formula === "all" || r.formulas.some((f) => f.formulaName === formula)),
  );
  const summarize = (records: Inspection[]) => {
    const values: Record<string, number[]> = Object.fromEntries(
      averageMetricIds.map((id) => [id, []]),
    );
    let slots = 0;
    for (const row of records) {
      const selected =
        formula === "all"
          ? [...timeSlots]
          : timeSlots.filter((s) =>
              row.formulas.some(
                (f) =>
                  f.formulaName === formula && selectedSlots(f).includes(s),
              ),
            );
      slots += selected.filter((s) =>
        metrics.some((m) => hasObservation(row.readings[m.id]?.[s])),
      ).length;
      for (const id of averageMetricIds)
        for (const slot of selected) {
          const n = averageFor(row, id, [slot]);
          if (n !== null) values[id].push(n);
        }
    }
    return {
      documents: new Set(records.map((r) => r.id)).size,
      slots,
      averages: Object.fromEntries(
        averageMetricIds.map((id) => [
          id,
          values[id].length
            ? values[id].reduce((a, b) => a + b, 0) / values[id].length
            : null,
        ]),
      ),
      counts: Object.fromEntries(
        averageMetricIds.map((id) => [id, values[id].length]),
      ),
    };
  };
  return {
    ...summarize(chosen),
    monthly: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      ...summarize(
        chosen.filter((r) => Number(r.inspectionDate.slice(5, 7)) === i + 1),
      ),
    })),
  };
}
