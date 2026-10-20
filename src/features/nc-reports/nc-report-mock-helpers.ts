import {
  ncDecisions,
  type NCReport,
  type NCErrors,
  type NCFilters,
  type NCTextField,
} from "./nc-report-types";
export const ncDepartments = [
  "ผลิต",
  "คลังสินค้า",
  "QC/QA",
  "จัดซื้อ",
  "ซ่อมบำรุง",
  "ฝ่ายขาย",
  "ขนส่ง",
];
export const ncUnits = ["กระสอบ", "กก.", "ตัน", "Bag", "Kg", "Ton"];
export const headerFields = [
  ["doc_no", "เลขที่เอกสาร"],
  ["doc_date", "วันที่เอกสาร"],
  ["discoverer", "ผู้พบข้อบกพร่อง"],
  ["department", "แผนก"],
] as const;
export const productFields = [
  ["product_name", "ชื่อสินค้า"],
  ["quantity", "ปริมาณ"],
  ["unit", "หน่วยนับ"],
  ["production_date", "วันที่ผลิต"],
  ["production_code", "รหัสสินค้า"],
] as const;
export const descriptionFields = [
  ["problem_defect", "ปัญหา / ข้อบกพร่อง"],
  ["countermeasure", "การแก้ไข / ป้องกัน"],
] as const;
export const reviewerFields = [
  ["reviewer_name_1", "ผู้ทบทวน (คนที่ 1)"],
  ["reviewer_name_2", "ผู้ทบทวน (คนที่ 2)"],
  ["approver_name", "ผู้อนุมัติ"],
] as const;
export function blankNC(): NCReport {
  return {
    id: "",
    doc_no: "",
    doc_date: "",
    discoverer: "",
    department: "",
    product_name: "",
    quantity: "",
    unit: "",
    production_date: "",
    production_code: "",
    problem_defect: "",
    countermeasure: "",
    decisions: {
      accept_concession: false,
      rework: false,
      return_back: false,
      reproduce: false,
      scrap: false,
    },
    reviewer_name_1: "",
    reviewer_name_2: "",
    approver_name: "",
  };
}
export function validNCDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function ncDate(value: string) {
  return validNCDate(value)
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${value}T00:00:00Z`))
    : "—";
}
export function validateNC(
  report: NCReport,
  records: readonly NCReport[],
): NCErrors {
  const errors: NCErrors = {};
  for (const [key, label] of [
    ...headerFields,
    ...productFields,
    ...descriptionFields,
  ])
    if (!report[key].trim()) errors[key] = `กรุณาระบุ${label}`;
  for (const key of ["doc_date", "production_date"] as const)
    if (!validNCDate(report[key])) errors[key] = "กรุณาระบุวันที่ที่ถูกต้อง";
  if (
    !/^\d+(?:\.\d+)?$/.test(report.quantity.trim()) ||
    !Number.isFinite(Number(report.quantity)) ||
    Number(report.quantity) <= 0
  )
    errors.quantity = "ปริมาณต้องเป็นตัวเลขมากกว่า 0";
  if (
    records.some(
      (r) =>
        r.id !== report.id &&
        r.doc_no.trim().toLocaleLowerCase() ===
          report.doc_no.trim().toLocaleLowerCase(),
    )
  )
    errors.doc_no = "เลขที่เอกสารนี้มีอยู่ในข้อมูลตัวอย่างแล้ว";
  if (
    ncDecisions.some(([key]) => typeof report.decisions[key] !== "boolean") ||
    !ncDecisions.some(([key]) => report.decisions[key])
  )
    errors.decisions = "กรุณาเลือกแนวทางจัดการอย่างน้อย 1 ข้อ";
  return errors;
}
export function saveNC(
  records: readonly NCReport[],
  report: NCReport,
  newId: string,
) {
  if (Object.keys(validateNC(report, records)).length)
    throw new Error("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
  if (report.id && !records.some((r) => r.id === report.id))
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข กรุณาเปิดรายการอีกครั้ง");
  if (!report.id && (!newId || records.some((r) => r.id === newId)))
    throw new Error("รหัสข้อมูลตัวอย่างซ้ำ กรุณาลองใหม่");
  const saved = structuredClone({
    ...report,
    id: report.id || newId,
    doc_no: report.doc_no.trim(),
  });
  return {
    saved,
    records: report.id
      ? records.map((r) => (r.id === saved.id ? saved : r))
      : [saved, ...records],
  };
}
export function deleteNC(records: readonly NCReport[], id: string) {
  return records.filter((r) => r.id !== id);
}
export const emptyNCFilters: NCFilters = {
  search: "",
  from: "",
  to: "",
  department: "all",
};
export function ncFilterError(filters: NCFilters) {
  if (
    (filters.from && !validNCDate(filters.from)) ||
    (filters.to && !validNCDate(filters.to))
  )
    return "กรุณาระบุช่วงวันที่ที่ถูกต้อง";
  return filters.from && filters.to && filters.from > filters.to
    ? "วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด"
    : "";
}
export function filterNC(records: readonly NCReport[], filters: NCFilters) {
  if (ncFilterError(filters)) return [];
  const query = filters.search.trim().toLocaleLowerCase();
  return records.filter(
    (r) =>
      (!query ||
        [
          r.doc_no,
          r.product_name,
          r.discoverer,
          r.department,
          r.problem_defect,
        ].some((v) => v.toLocaleLowerCase().includes(query))) &&
      (filters.department === "all" || r.department === filters.department) &&
      (!filters.from || r.doc_date >= filters.from) &&
      (!filters.to || r.doc_date <= filters.to),
  );
}
export function paginateNC<T>(
  records: readonly T[],
  requested: number,
  size: number,
) {
  const pageSize = Number.isInteger(size) && size > 0 ? size : 10;
  const page = Math.min(
    Math.max(1, Number.isInteger(requested) ? requested : 1),
    Math.max(1, Math.ceil(records.length / pageSize)),
  );
  return { page, rows: records.slice((page - 1) * pageSize, page * pageSize) };
}
export function ncFieldValue(report: NCReport, key: NCTextField) {
  return key === "doc_date" || key === "production_date"
    ? ncDate(report[key])
    : report[key] || "—";
}
