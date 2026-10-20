export const ncDecisions = [
  ["accept_concession", "ยอมรับ / อนุโลม"],
  ["rework", "แก้ไข"],
  ["return_back", "ตีกลับ"],
  ["reproduce", "นำกลับไปผลิตใหม่"],
  ["scrap", "เสีย"],
] as const;
export type NCDecision = (typeof ncDecisions)[number][0];
export interface NCReport {
  id: string;
  doc_no: string;
  doc_date: string;
  discoverer: string;
  department: string;
  product_name: string;
  quantity: string;
  unit: string;
  production_date: string;
  production_code: string;
  problem_defect: string;
  countermeasure: string;
  decisions: Record<NCDecision, boolean>;
  reviewer_name_1: string;
  reviewer_name_2: string;
  approver_name: string;
}
export type NCTextField = Exclude<keyof NCReport, "id" | "decisions">;
export type NCErrors = Partial<Record<NCTextField | "decisions", string>>;
export interface NCFilters {
  search: string;
  from: string;
  to: string;
  department: string;
}
