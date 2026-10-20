import {
  packagingProfiles,
  packagingTimes,
  packagingUnits,
  type PackagingProfileId,
} from "./packaging-profiles";
export type PackagingContext = {
  id: string;
  fertilizerName: string;
  productionDate: string;
  packageType: string;
  packageWeight: string;
  packageUnit: string;
  quantity: string;
  lotCode: string;
};
export type PackagingObservation = {
  id: string;
  contextId: string;
  packingTime: string;
  hourlySamplingTime: string;
  bagWeight1: string;
  bagWeight2: string;
  physicalCondition: boolean | null;
  bagCodeMarking: boolean | null;
  bagSealing: boolean | null;
  moisture: string;
  waterSolubility: string;
  dust: string;
};
export type LoadCell = { id: string; time: string; weight: string };
export type MasterComparison = {
  id: string;
  time: string;
  qcWeight: string;
  masterWeight: string;
};
export type PackagingSet = {
  id: string;
  setNo: number;
  contexts: PackagingContext[];
  inspections: PackagingObservation[];
  loadCells: LoadCell[];
  comparisons: MasterComparison[];
  remarks: string;
};
export type PackagingReport = {
  id: string;
  documentNumber: string;
  profileId: PackagingProfileId;
  location: string;
  documentDate: string;
  status: "DRAFT" | "RECORDED";
  disposition: "NOT_EVALUATED";
  sets: PackagingSet[];
  remarks: string;
  signers: { role: string; name: string; date: string }[];
  createdAt: string;
  updatedAt: string;
};
export function newContext(id: string): PackagingContext {
  return {
    id,
    fertilizerName: "",
    productionDate: "",
    packageType: "",
    packageWeight: "",
    packageUnit: "",
    quantity: "",
    lotCode: "",
  };
}
export function newObservation(
  id: string,
  contextId: string,
): PackagingObservation {
  return {
    id,
    contextId,
    packingTime: "",
    hourlySamplingTime: "",
    bagWeight1: "",
    bagWeight2: "",
    physicalCondition: null,
    bagCodeMarking: null,
    bagSealing: null,
    moisture: "",
    waterSolubility: "",
    dust: "",
  };
}
export function newSet(id: string, setNo: number): PackagingSet {
  const context = newContext(`${id}-context`);
  return {
    id,
    setNo,
    contexts: [context],
    inspections: [newObservation(`${id}-inspection`, context.id)],
    loadCells: [],
    comparisons: [],
    remarks: "",
  };
}
export function newReport(
  profileId: PackagingProfileId = "ITECH",
): PackagingReport {
  return {
    id: "",
    documentNumber: "",
    profileId,
    location: "",
    documentDate: "",
    status: "DRAFT",
    disposition: "NOT_EVALUATED",
    sets: [newSet("initial-set", 1)],
    remarks: "",
    signers: packagingProfiles[profileId].signers.map((role) => ({
      role,
      name: "",
      date: "",
    })),
    createdAt: "",
    updatedAt: "",
  };
}
export const recordLabel = (r: PackagingReport) =>
  r.status === "DRAFT" ? "แบบร่าง" : "บันทึกรายงานแล้ว";
export const booleanLabel = (v: boolean | null) =>
  v === null ? "ยังไม่ตรวจ" : v ? "ผ่าน" : "ไม่ผ่าน";
export function validDate(v: string) {
  const d = new Date(`${v}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number(v.slice(0, 4)) >= 1900 &&
    Number.isFinite(d.getTime()) &&
    d.toISOString().slice(0, 10) === v
  );
}
export function thaiDate(v: string) {
  return validDate(v)
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${v}T00:00:00+07:00`))
    : "—";
}
export const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export function validDecimal(v: string, positive = false, percent = false) {
  const n = Number(v.trim());
  return (
    /^\d+(?:\.\d+)?$/.test(v.trim()) &&
    Number.isFinite(n) &&
    (positive ? n > 0 : n >= 0) &&
    (!percent || n <= 100)
  );
}
export function updateSet(
  report: PackagingReport,
  id: string,
  change: (s: PackagingSet) => PackagingSet,
): PackagingReport {
  if (!report.sets.some((s) => s.id === id)) throw new Error("ไม่พบ SET");
  return {
    ...report,
    sets: report.sets.map((s) =>
      s.id === id ? change(structuredClone(s)) : s,
    ),
  };
}
export function addSet(report: PackagingReport, id: string): PackagingReport {
  if (!packagingProfiles[report.profileId].multiSet)
    throw new Error("iTech ใช้ SET เดียว เพิ่มบริบทสูตร/Lot ภายใน SET ได้");
  if (!id || report.sets.some((s) => s.id === id))
    throw new Error("รหัส SET ซ้ำ");
  return {
    ...report,
    sets: [...report.sets, newSet(id, report.sets.length + 1)],
  };
}
export function removeSet(
  report: PackagingReport,
  id: string,
): PackagingReport {
  if (report.sets.length <= 1) throw new Error("ต้องมีอย่างน้อย 1 SET");
  if (!report.sets.some((s) => s.id === id)) throw new Error("ไม่พบ SET");
  return {
    ...report,
    sets: report.sets
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, setNo: i + 1 })),
  };
}
export function removeContext(
  report: PackagingReport,
  setId: string,
  id: string,
): PackagingReport {
  return updateSet(report, setId, (s) => {
    if (s.contexts.length <= 1)
      throw new Error("ต้องมีข้อมูลบรรจุอย่างน้อย 1 บริบท");
    if (s.inspections.some((r) => r.contextId === id))
      throw new Error(
        "มีผลตรวจอ้างอิงบริบทนี้ กรุณาเปลี่ยนบริบทหรือลบผลตรวจที่เกี่ยวข้องก่อน",
      );
    return { ...s, contexts: s.contexts.filter((c) => c.id !== id) };
  });
}
export function validateReport(
  r: PackagingReport,
  records: readonly PackagingReport[],
): Record<string, string> {
  const errors: Record<string, string> = {},
    required = r.status === "RECORDED",
    profile = packagingProfiles[r.profileId];
  if (!profile) errors.profileId = "เลือกโรงงานที่รองรับ";
  if (
    !["DRAFT", "RECORDED"].includes(r.status) ||
    r.disposition !== "NOT_EVALUATED"
  )
    errors.status = "ไม่รองรับสถานะอนุมัติคุณภาพรวม";
  for (const key of ["documentNumber", "documentDate", "location"] as const)
    if (required && !r[key].trim()) errors[key] = "กรุณาระบุข้อมูลนี้";
  if (r.documentDate && !validDate(r.documentDate))
    errors.documentDate = "วันที่เอกสารไม่ถูกต้อง";
  if (
    r.location &&
    !(profile?.locations as readonly string[] | undefined)?.includes(r.location)
  )
    errors.location = "สถานที่ไม่ตรงกับโรงงานที่เลือก";
  if (
    r.documentNumber.trim() &&
    records.some(
      (old) =>
        old.id !== r.id &&
        old.profileId === r.profileId &&
        old.documentNumber.trim().toLowerCase() ===
          r.documentNumber.trim().toLowerCase(),
    )
  )
    errors.documentNumber = "เลขที่เอกสารซ้ำภายในโรงงานนี้";
  if (!r.sets.length || (!profile?.multiSet && r.sets.length !== 1))
    errors.sets = "จำนวน SET ไม่ตรงกับรูปแบบโรงงาน";
  const ids = new Set<string>();
  const identity = (id: string, key: string) => {
    if (!id || ids.has(id)) errors[key] = "รหัสภายในซ้ำหรือไม่ถูกต้อง";
    ids.add(id);
  };
  for (const [index, s] of r.sets.entries()) {
    const base = `sets.${s.id}`;
    identity(s.id, base);
    if (s.setNo !== index + 1) errors[base] = "ลำดับ SET ไม่ถูกต้อง";
    if (!s.contexts.length || (profile?.multiSet && s.contexts.length !== 1))
      errors[`${base}.contexts`] =
        "iFoam ต้องมีข้อมูลบรรจุหลัก 1 บริบทต่อ SET; iTech อย่างน้อย 1 บริบท";
    for (const c of s.contexts) {
      const k = `${base}.contexts.${c.id}`;
      identity(c.id, k);
      for (const key of [
        "fertilizerName",
        "productionDate",
        "packageType",
        "packageWeight",
        "packageUnit",
        "quantity",
        "lotCode",
      ] as const)
        if (required && !c[key].trim())
          errors[`${k}.${key}`] = "กรอกข้อมูลบรรจุให้ครบ";
      if (c.productionDate && !validDate(c.productionDate))
        errors[`${k}.productionDate`] = "วันที่บรรจุไม่ถูกต้อง";
      for (const key of ["packageWeight", "quantity"] as const)
        if (c[key] && !validDecimal(c[key], true))
          errors[`${k}.${key}`] =
            "ต้องเป็นจำนวนบวกที่ถูกต้อง ไม่ใช้ NaN/Infinity";
      if (
        c.packageUnit &&
        !(packagingUnits as readonly string[]).includes(c.packageUnit)
      )
        errors[`${k}.packageUnit`] = "เลือกหน่วยน้ำหนักที่รองรับ";
    }
    if (required && !s.inspections.length)
      errors[`${base}.inspections`] = "ต้องมีผลตรวจอย่างน้อย 1 แถวต่อ SET";
    const seenInspections = new Set<string>();
    for (const o of s.inspections) {
      const k = `${base}.inspections.${o.id}`;
      identity(o.id, k);
      if (!s.contexts.some((c) => c.id === o.contextId))
        errors[`${k}.contextId`] = "ไม่พบบริบทสูตร/Lot ใน SET นี้";
      if (
        (required || o.packingTime) &&
        !packagingTimes.includes(o.packingTime)
      )
        errors[`${k}.packingTime`] = "เลือกเวลาบรรจุทุก 15 นาที (HH:mm)";
      for (const key of ["bagWeight1", "bagWeight2"] as const)
        if ((required || o[key]) && !validDecimal(o[key], true))
          errors[`${k}.${key}`] = "ระบุน้ำหนักตัวอย่างมากกว่า 0";
      for (const key of [
        "physicalCondition",
        "bagCodeMarking",
        "bagSealing",
      ] as const)
        if (o[key] !== null && typeof o[key] !== "boolean")
          errors[`${k}.${key}`] = "ผลตรวจต้องเป็น ยังไม่ตรวจ / ผ่าน / ไม่ผ่าน";
      for (const key of ["moisture", "waterSolubility", "dust"] as const)
        if (o[key] && !validDecimal(o[key], false, key !== "waterSolubility"))
          errors[`${k}.${key}`] =
            "ระบุตัวเลขไม่ติดลบ; เปอร์เซ็นต์อยู่ระหว่าง 0–100";
      const sampled = !!(
        o.moisture.trim() ||
        o.waterSolubility.trim() ||
        o.dust.trim()
      );
      if (
        o.hourlySamplingTime &&
        !packagingTimes.includes(o.hourlySamplingTime)
      )
        errors[`${k}.hourlySamplingTime`] =
          "เวลาสุ่มตรวจต้องอยู่ในช่วงตัวเลือก 15 นาที";
      if (
        profile?.hourlySampling &&
        required &&
        sampled &&
        !o.hourlySamplingTime
      )
        errors[`${k}.hourlySamplingTime`] =
          "ระบุเวลาสุ่มตรวจเมื่อกรอกค่าทดสอบรายชั่วโมง";
      const duplicate = `${o.contextId}|${o.packingTime}`;
      if (o.packingTime && seenInspections.has(duplicate))
        errors[`${k}.packingTime`] = "เวลาตรวจซ้ำในบริบทเดียวกัน";
      seenInspections.add(duplicate);
    }
    const checkTimes = (
      rows: readonly { id: string; time: string }[],
      group: string,
    ) => {
      const seen = new Set<string>();
      for (const x of rows) {
        identity(x.id, `${base}.${group}.${x.id}`);
        if (x.time && !validTime(x.time))
          errors[`${base}.${group}.${x.id}.time`] = "เวลาไม่ถูกต้อง ใช้ HH:mm";
        if (x.time && seen.has(x.time))
          errors[`${base}.${group}.${x.id}.time`] = "เวลาตรวจซ้ำใน SET นี้";
        if (x.time) seen.add(x.time);
      }
    };
    checkTimes(s.loadCells, "loadCells");
    checkTimes(s.comparisons, "comparisons");
    for (const l of s.loadCells) {
      const k = `${base}.loadCells.${l.id}`;
      if (required && (!l.time || !l.weight.trim()))
        errors[k] = "กรอกเวลาและน้ำหนัก Load Cell ให้ครบ หรือลบแถว";
      if (l.weight && !validDecimal(l.weight, true))
        errors[`${k}.weight`] = "น้ำหนัก Load Cell ต้องเป็นจำนวนบวก";
    }
    for (const c of s.comparisons) {
      const k = `${base}.comparisons.${c.id}`;
      if (required && (!c.time || !c.qcWeight.trim() || !c.masterWeight.trim()))
        errors[k] = "กรอกเวลา น้ำหนัก QC และ Master ให้ครบ หรือลบแถว";
      for (const key of ["qcWeight", "masterWeight"] as const)
        if (c[key] && !validDecimal(c[key], true))
          errors[`${k}.${key}`] = "ค่าชั่งต้องเป็นจำนวนบวก";
    }
  }
  const roles = profile?.signers as readonly string[] | undefined;
  if (
    !roles ||
    r.signers.length !== roles.length ||
    roles.some((role) => r.signers.filter((s) => s.role === role).length !== 1)
  )
    errors.signers = "บทบาทผู้ลงชื่อไม่ตรงกับโรงงาน";
  r.signers.forEach((s, i) => {
    if (s.date && (!validDate(s.date) || !s.name.trim()))
      errors[`signers.${i}`] = "กรอกชื่อและวันที่ผู้ลงชื่อให้ถูกต้อง";
  });
  return errors;
}
export function saveReport(
  records: readonly PackagingReport[],
  input: PackagingReport,
  id: string,
  at: string,
) {
  const old = records.find((r) => r.id === input.id);
  if (input.id && !old) throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  if (old && old.profileId !== input.profileId)
    throw new Error("เปลี่ยนโรงงานของเอกสารที่บันทึกแล้วไม่ได้");
  if (old?.status === "RECORDED" && input.status === "DRAFT")
    throw new Error("เอกสารบันทึกแล้วไม่สามารถย้อนเป็นแบบร่าง");
  const errors = validateReport(input, records);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (!old && (!id || records.some((r) => r.id === id)))
    throw new Error("รหัสเอกสารซ้ำ");
  const record = structuredClone({
    ...input,
    id: old?.id ?? id,
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
export function deleteReport(records: readonly PackagingReport[], id: string) {
  if (!records.some((r) => r.id === id))
    throw new Error("ไม่พบเอกสารที่ต้องการลบ");
  return records.filter((r) => r.id !== id);
}
export const emptyHistoryFilters = {
  search: "",
  profile: "all",
  from: "",
  to: "",
  status: "all",
};
export function filterReports(
  records: readonly PackagingReport[],
  f: typeof emptyHistoryFilters,
) {
  const q = f.search.trim().toLowerCase();
  return records
    .filter(
      (r) =>
        (!q ||
          [
            r.documentNumber,
            r.location,
            packagingProfiles[r.profileId].label,
            ...r.sets.flatMap((s) =>
              s.contexts.flatMap((c) => [c.fertilizerName, c.lotCode]),
            ),
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (f.profile === "all" || r.profileId === f.profile) &&
        (!f.from || r.documentDate >= f.from) &&
        (!f.to || r.documentDate <= f.to) &&
        (f.status === "all" || r.status === f.status),
    )
    .sort(
      (a, b) =>
        b.documentDate.localeCompare(a.documentDate) ||
        a.id.localeCompare(b.id),
    );
}
export function paginateReports<T>(
  rows: readonly T[],
  page: number,
  size: number,
) {
  const p = Math.max(
    1,
    Math.min(page, Math.max(1, Math.ceil(rows.length / size))),
  );
  return { rows: rows.slice((p - 1) * size, p * size), page: p };
}

// Each legacy flat row retains its own packaging context; no formula/Lot merging.
export type LegacyITechRow = {
  id: string;
  fertilizer: string;
  date: string;
  package: string;
  package_weight: string;
  package_unit: string;
  qty: string;
  lot_no: string;
  packing_time: string;
  bag_weight_1: string;
  bag_weight_2: string;
  physical_condition: boolean | null;
  bag_code_marking: boolean | null;
  bag_sealing: boolean | null;
  moisture_percent: string;
  water_solubility: string;
  dust_percent: string;
};
export function mapITechRows(
  rows: readonly LegacyITechRow[],
  setId: string,
): PackagingSet {
  const s = newSet(setId, 1);
  s.contexts = rows.map((r) => ({
    id: `${setId}-context-${r.id}`,
    fertilizerName: r.fertilizer,
    productionDate: r.date,
    packageType: r.package,
    packageWeight: r.package_weight,
    packageUnit: r.package_unit,
    quantity: r.qty,
    lotCode: r.lot_no,
  }));
  s.inspections = rows.map((r) => ({
    ...newObservation(
      `${setId}-inspection-${r.id}`,
      `${setId}-context-${r.id}`,
    ),
    packingTime: r.packing_time,
    bagWeight1: r.bag_weight_1,
    bagWeight2: r.bag_weight_2,
    physicalCondition: r.physical_condition,
    bagCodeMarking: r.bag_code_marking,
    bagSealing: r.bag_sealing,
    moisture: r.moisture_percent,
    waterSolubility: r.water_solubility,
    dust: r.dust_percent,
  }));
  return s;
}
