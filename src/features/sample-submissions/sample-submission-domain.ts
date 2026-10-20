export type SampleResult = "ผ่าน" | "ไม่ผ่าน" | null;
export interface SampleItem {
  id: string;
  sent_date: string;
  product_name: string;
  lot_no: string;
  sample_date: string;
  deliverer_name: string;
  analysis_receiver: string;
  analysis_result_sender: string;
  analysis_result_status: SampleResult;
  analysis_result_receiver: string;
  remark: string;
}
export interface SampleSubmission {
  id: string;
  doc_no: string;
  doc_date: string;
  rows: SampleItem[];
}
export type SampleTextField = Exclude<
  keyof SampleItem,
  "id" | "analysis_result_status"
>;
export const sampleFields: readonly (readonly [SampleTextField, string])[] = [
  ["sent_date", "วันที่นำส่ง"],
  ["product_name", "ชื่อตัวอย่าง"],
  ["lot_no", "Lot"],
  ["sample_date", "วันที่ตัวอย่าง"],
  ["deliverer_name", "คนนำส่งตัวอย่าง"],
  ["analysis_receiver", "ผู้รับวิเคราะห์"],
  ["analysis_result_sender", "ผู้ส่งผลวิเคราะห์"],
  ["analysis_result_receiver", "ผู้รับผลวิเคราะห์"],
  ["remark", "หมายเหตุ"],
];
export const resultLabel = (result: SampleResult) => result ?? "ยังไม่ระบุ";
export function newSample(id: string): SampleItem {
  return {
    id,
    sent_date: "",
    product_name: "",
    lot_no: "",
    sample_date: "",
    deliverer_name: "",
    analysis_receiver: "",
    analysis_result_sender: "",
    analysis_result_status: null,
    analysis_result_receiver: "",
    remark: "",
  };
}
export function newSubmission(): SampleSubmission {
  return {
    id: "",
    doc_no: "",
    doc_date: "",
    rows: [newSample("initial-sample")],
  };
}
export function addSample(report: SampleSubmission, id: string) {
  if (!id || report.rows.some((r) => r.id === id))
    throw new Error("รหัสแถวซ้ำ กรุณาลองใหม่");
  return { ...report, rows: [...report.rows, newSample(id)] };
}
export function removeSample(report: SampleSubmission, id: string) {
  return { ...report, rows: report.rows.filter((r) => r.id !== id) };
}
export function updateSample(report: SampleSubmission, row: SampleItem) {
  return {
    ...report,
    rows: report.rows.map((r) => (r.id === row.id ? { ...row } : r)),
  };
}
export function validSampleDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function sampleDate(value: string) {
  return validSampleDate(value)
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${value}T00:00:00Z`))
    : "—";
}
export type SampleErrors = Record<string, string>;
export function validateSubmission(
  report: SampleSubmission,
  records: readonly SampleSubmission[],
): SampleErrors {
  const errors: SampleErrors = {};
  if (!report.doc_no.trim()) errors.doc_no = "กรุณาระบุเลขที่เอกสาร";
  if (!validSampleDate(report.doc_date))
    errors.doc_date = "กรุณาระบุวันที่เอกสารที่ถูกต้อง";
  if (
    records.some(
      (r) =>
        r.id !== report.id &&
        r.doc_no.trim().toLowerCase() === report.doc_no.trim().toLowerCase(),
    )
  )
    errors.doc_no = "เลขที่เอกสารนี้มีอยู่ในข้อมูลตัวอย่างแล้ว";
  if (!report.rows.length) errors.rows = "ต้องมีตัวอย่างอย่างน้อย 1 แถว";
  const ids = new Set<string>();
  for (const row of report.rows) {
    if (!row.id || ids.has(row.id)) errors.rows = "รหัสแถวไม่ถูกต้องหรือซ้ำ";
    ids.add(row.id);
    for (const key of ["product_name", "lot_no"] as const)
      if (!row[key].trim())
        errors[`${row.id}.${key}`] =
          key === "product_name" ? "กรุณาระบุชื่อตัวอย่าง" : "กรุณาระบุ Lot";
    for (const key of ["sent_date", "sample_date"] as const)
      if (row[key] && !validSampleDate(row[key]))
        errors[`${row.id}.${key}`] = "กรุณาระบุวันที่ที่ถูกต้อง หรือเว้นว่าง";
    if (
      row.analysis_result_status !== null &&
      row.analysis_result_status !== "ผ่าน" &&
      row.analysis_result_status !== "ไม่ผ่าน"
    )
      errors[`${row.id}.analysis_result_status`] =
        "ผลต้องเป็นยังไม่ระบุ ผ่าน หรือไม่ผ่าน";
  }
  return errors;
}
export function saveSubmission(
  records: readonly SampleSubmission[],
  report: SampleSubmission,
  newId: string,
) {
  if (Object.keys(validateSubmission(report, records)).length)
    throw new Error("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
  if (report.id && !records.some((r) => r.id === report.id))
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  if (!report.id && (!newId || records.some((r) => r.id === newId)))
    throw new Error("รหัสเอกสารตัวอย่างซ้ำ กรุณาลองใหม่");
  const saved = structuredClone({
    ...report,
    id: report.id || newId,
    doc_no: report.doc_no.trim(),
  });
  return {
    saved,
    records: report.id
      ? records.map((r) => (r.id === report.id ? saved : r))
      : [saved, ...records],
  };
}
export function deleteSubmission(
  records: readonly SampleSubmission[],
  id: string,
) {
  return records.filter((r) => r.id !== id);
}
export interface SubmissionFilters {
  search: string;
  from: string;
  to: string;
}
export const emptySubmissionFilters: SubmissionFilters = {
  search: "",
  from: "",
  to: "",
};
export function submissionFilterError(f: SubmissionFilters) {
  if ((f.from && !validSampleDate(f.from)) || (f.to && !validSampleDate(f.to)))
    return "กรุณาระบุช่วงวันที่ที่ถูกต้อง";
  return f.from && f.to && f.from > f.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}
export function filterSubmissions(
  records: readonly SampleSubmission[],
  f: SubmissionFilters,
) {
  if (submissionFilterError(f)) return [];
  const query = f.search.trim().toLowerCase();
  return records.filter(
    (r) =>
      (!f.from || r.doc_date >= f.from) &&
      (!f.to || r.doc_date <= f.to) &&
      (!query ||
        [
          r.doc_no,
          ...r.rows.flatMap((s) => sampleFields.map(([key]) => s[key])),
        ].some((v) => v.toLowerCase().includes(query))),
  );
}
export function pageSubmissions<T>(
  records: readonly T[],
  requested: number,
  size: number,
) {
  const page = Math.min(
    Math.max(1, requested),
    Math.max(1, Math.ceil(records.length / size)),
  );
  return { page, rows: records.slice((page - 1) * size, page * size) };
}
