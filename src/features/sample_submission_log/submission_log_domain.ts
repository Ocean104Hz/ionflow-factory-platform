export const analysisItems = [
  ["ph", "ความเป็นกรด - ด่าง(pH)"],
  ["moisture", "ความชื้น (Moisture)"],
  ["specific_gravity", "ความถ่วงจำเพาะ (Specific gravity)"],
  ["ec", "ค่าการนำไฟฟ้า (EC)"],
  ["humic_acid", "ฮิวมิก แอซิด (Humic acid)"],
  ["om", "อินทรียวัตถุ (OM)"],
  ["total_n", "ไนโตรเจนทั้งหมด (Total N)"],
  ["an", "แอมโมเนียมไนโตรเจน (AN)"],
  ["total_p2o5", "ฟอสฟอรัสทั้งหมด (Total P₂O₅)"],
  ["avp", "ฟอสฟอรัสที่เป็นประโยชน์ (AVP)"],
  ["cip", "ฟอสฟอรัสที่ไม่ละลายในสารละลายซิเตรท (CIP)"],
  ["total_k2o", "โพแทสเซียมทั้งหมด (Total K₂O)"],
  ["wk2o", "โพแทสเซียมที่ละลายน้ำ (WK₂O)"],
  ["cao", "แคลเซียมออกไซด์ (CaO)"],
  ["mgo", "แมกนีเซียมออกไซด์ (MgO)"],
  ["s", "กำมะถันทั้งหมด (S)"],
  ["fe", "เหล็กทั้งหมด (Fe)"],
  ["cu", "ทองแดงทั้งหมด (Cu)"],
  ["mn", "แมงกานีสทั้งหมด (Mn)"],
  ["zn", "สังกะสีทั้งหมด (Zn)"],
  ["b", "โบรอน (B)"],
  ["wca", "แคลเซียมที่ละลายน้ำ (WCa)"],
  ["wmg", "แมกนีเซียมที่ละลายน้ำ (WMg)"],
  ["ws", "กำมะถันที่ละลายน้ำ (WS)"],
  ["wfe", "เหล็กที่ละลายน้ำ (WFe)"],
  ["wcu", "ทองแดงที่ละลายน้ำ (WCu)"],
  ["wmn", "แมงกานีสที่ละลายน้ำ (WMn)"],
  ["wzn", "สังกะสีที่ละลายน้ำ (WZn)"],
  ["wb", "โบรอนที่ละลายน้ำ (WB)"],
  ["wmo", "โมลิบดีนัมที่ละลายน้ำ (WMo)"],
  ["gi", "การย่อยสลายสมบูรณ์ (GI)"],
  ["other", "อื่นๆ (ระบุ)"],
] as const;
export type AnalysisKey = (typeof analysisItems)[number][0];
export const typeOptions = [
  ["chemical_fertilizer", "ปุ๋ยเคมี"],
  ["organo_chemical_fertilizer", "ปุ๋ยอินทรีย์เคมี"],
  ["organic_fertilizer", "ปุ๋ยอินทรีย์"],
  ["other", "อื่น ๆ (ระบุ)"],
] as const;
export const formOptions = [
  ["granule", "เม็ด"],
  ["powder", "ผง"],
  ["liquid", "ของเหลว"],
  ["other", "อื่น ๆ (ระบุ)"],
] as const;
export interface SubmissionLog {
  id: string;
  doc_no: string;
  sample_code: string;
  requester_name: string;
  requester_address: string;
  requester_phone: string;
  requester_email: string;
  sample_name: string;
  sample_characteristics: string;
  sample_type: {
    chemical_fertilizer: boolean;
    organo_chemical_fertilizer: boolean;
    organic_fertilizer: boolean;
    other_detail: string | null;
  };
  sample_form: {
    granule: boolean;
    powder: boolean;
    liquid: boolean;
    other_detail: string | null;
  };
  requested_items: Record<AnalysisKey, boolean> & { other_detail: string };
  quantity: {
    amount: string;
    packaging: string;
    receive_result: {
      sample_return: boolean;
      not_return: boolean;
      pick_up: boolean;
      mail: boolean;
    };
  };
  sender_sign: { signer_name: string; signed_date: string };
  staff_section: {
    sample_condition: {
      normal: boolean;
      abnormal: boolean;
      abnormal_detail: string;
    };
    received_by: string;
    received_date: string;
    job_acceptance: {
      accepted: boolean;
      rejected: boolean;
      reject_reason: string;
    };
    accepted_by: string;
    accepted_date: string;
  };
}
export type LogErrors = Record<string, string>;
export function blankLog(): SubmissionLog {
  return {
    id: "",
    doc_no: "",
    sample_code: "",
    requester_name: "",
    requester_address: "",
    requester_phone: "",
    requester_email: "",
    sample_name: "",
    sample_characteristics: "",
    sample_type: {
      chemical_fertilizer: false,
      organo_chemical_fertilizer: false,
      organic_fertilizer: false,
      other_detail: null,
    },
    sample_form: {
      granule: false,
      powder: false,
      liquid: false,
      other_detail: null,
    },
    requested_items: {
      ...(Object.fromEntries(
        analysisItems.map(([key]) => [key, false]),
      ) as Record<AnalysisKey, boolean>),
      other_detail: "",
    },
    quantity: {
      amount: "",
      packaging: "",
      receive_result: {
        sample_return: false,
        not_return: false,
        pick_up: false,
        mail: false,
      },
    },
    sender_sign: { signer_name: "", signed_date: "" },
    staff_section: {
      sample_condition: { normal: false, abnormal: false, abnormal_detail: "" },
      received_by: "",
      received_date: "",
      job_acceptance: { accepted: false, rejected: false, reject_reason: "" },
      accepted_by: "",
      accepted_date: "",
    },
  };
}
export function setLogType(r: SubmissionLog, value: string): SubmissionLog {
  return {
    ...r,
    sample_type: {
      chemical_fertilizer: value === "chemical_fertilizer",
      organo_chemical_fertilizer: value === "organo_chemical_fertilizer",
      organic_fertilizer: value === "organic_fertilizer",
      other_detail:
        value === "other" ? (r.sample_type.other_detail ?? "") : null,
    },
  };
}
export function setLogForm(r: SubmissionLog, value: string): SubmissionLog {
  return {
    ...r,
    sample_form: {
      granule: value === "granule",
      powder: value === "powder",
      liquid: value === "liquid",
      other_detail:
        value === "other" ? (r.sample_form.other_detail ?? "") : null,
    },
  };
}
export function logTypeValue(r: SubmissionLog) {
  const t = r.sample_type;
  return t.chemical_fertilizer
    ? "chemical_fertilizer"
    : t.organo_chemical_fertilizer
      ? "organo_chemical_fertilizer"
      : t.organic_fertilizer
        ? "organic_fertilizer"
        : t.other_detail !== null
          ? "other"
          : "";
}
export function logFormValue(r: SubmissionLog) {
  const f = r.sample_form;
  return f.granule
    ? "granule"
    : f.powder
      ? "powder"
      : f.liquid
        ? "liquid"
        : f.other_detail !== null
          ? "other"
          : "";
}
export function validLogDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function logDate(value: string) {
  return validLogDate(value)
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${value}T00:00:00Z`))
    : "—";
}
export const selectedAnalysis = (r: SubmissionLog) =>
  analysisItems.filter(([key]) => r.requested_items[key]);
export function validateLog(
  r: SubmissionLog,
  records: readonly SubmissionLog[],
): LogErrors {
  const e: LogErrors = {};
  for (const [key, label] of [
    ["doc_no", "เลขที่คำขอ"],
    ["sample_code", "รหัสตัวอย่าง"],
    ["requester_name", "ชื่อผู้ส่ง"],
    ["sample_name", "ชื่อตัวอย่าง"],
  ] as const)
    if (!r[key].trim()) e[key] = `กรุณาระบุ${label}`;
  if (
    records.some(
      (x) =>
        x.id !== r.id &&
        x.doc_no.trim().toLowerCase() === r.doc_no.trim().toLowerCase(),
    )
  )
    e.doc_no = "เลขที่คำขอนี้มีอยู่ในข้อมูลตัวอย่างแล้ว";
  const t = r.sample_type,
    f = r.sample_form,
    q = r.quantity,
    rr = q.receive_result,
    s = r.staff_section;
  if (
    [
      t.chemical_fertilizer,
      t.organo_chemical_fertilizer,
      t.organic_fertilizer,
      t.other_detail !== null,
    ].filter(Boolean).length !== 1
  )
    e.sample_type = "เลือกประเภทตัวอย่าง 1 ข้อ";
  if (t.other_detail !== null && !t.other_detail.trim())
    e.sample_type_other = "กรุณาระบุประเภทตัวอย่างอื่น ๆ";
  if (
    [f.granule, f.powder, f.liquid, f.other_detail !== null].filter(Boolean)
      .length !== 1
  )
    e.sample_form = "เลือกรูปแบบตัวอย่าง 1 ข้อ";
  if (f.other_detail !== null && !f.other_detail.trim())
    e.sample_form_other = "กรุณาระบุรูปแบบตัวอย่างอื่น ๆ";
  if (
    !selectedAnalysis(r).length ||
    analysisItems.some(([key]) => typeof r.requested_items[key] !== "boolean")
  )
    e.requested_items = "เลือกรายการตรวจวิเคราะห์อย่างน้อย 1 ข้อ";
  if (r.requested_items.other && !r.requested_items.other_detail.trim())
    e.analysis_other = "กรุณาระบุรายการวิเคราะห์อื่น ๆ";
  if (
    !/^\d+(?:\.\d+)?$/.test(q.amount.trim()) ||
    !Number.isFinite(Number(q.amount)) ||
    Number(q.amount) <= 0
  )
    e.quantity_amount = "ปริมาณตัวอย่างต้องเป็นตัวเลขมากกว่า 0";
  if (!q.packaging.trim()) e.quantity_packaging = "กรุณาระบุภาชนะบรรจุ";
  if ([rr.sample_return, rr.not_return].filter(Boolean).length !== 1)
    e.sample_return = "เลือกการรับคืนตัวอย่าง 1 ข้อ";
  if ([rr.pick_up, rr.mail].filter(Boolean).length !== 1)
    e.result_delivery = "เลือกวิธีรับผลทดสอบ 1 ข้อ";
  if (!r.sender_sign.signer_name.trim())
    e.sender_name = "กรุณาระบุชื่อผู้ส่งตัวอย่าง";
  if (!validLogDate(r.sender_sign.signed_date))
    e.sender_date = "กรุณาระบุวันที่ลงชื่อที่ถูกต้อง";
  if (
    r.requester_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.requester_email.trim())
  )
    e.requester_email = "รูปแบบอีเมลไม่ถูกต้อง";
  if (s.sample_condition.normal && s.sample_condition.abnormal)
    e.sample_condition = "เลือกสภาพตัวอย่างได้เพียง 1 ข้อ";
  if (s.sample_condition.abnormal && !s.sample_condition.abnormal_detail.trim())
    e.abnormal_detail = "กรุณาระบุรายละเอียดความผิดปกติ";
  if (s.job_acceptance.accepted && s.job_acceptance.rejected)
    e.job_acceptance = "เลือกความพร้อมรับงานได้เพียง 1 ข้อ";
  if (s.job_acceptance.rejected && !s.job_acceptance.reject_reason.trim())
    e.reject_reason = "กรุณาระบุเหตุผลที่ไม่พร้อมรับงาน";
  if (s.received_date && !validLogDate(s.received_date))
    e.received_date = "วันที่รับตัวอย่างไม่ถูกต้อง";
  if (s.accepted_date && !validLogDate(s.accepted_date))
    e.accepted_date = "วันที่รับงานไม่ถูกต้อง";
  return e;
}
export function saveLog(
  records: readonly SubmissionLog[],
  r: SubmissionLog,
  id: string,
) {
  if (Object.keys(validateLog(r, records)).length)
    throw new Error("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
  if (r.id && !records.some((x) => x.id === r.id))
    throw new Error("ไม่พบเอกสารที่ต้องการแก้ไข");
  if (!r.id && (!id || records.some((x) => x.id === id)))
    throw new Error("รหัสตัวอย่างซ้ำ กรุณาลองใหม่");
  const saved = structuredClone({
    ...r,
    id: r.id || id,
    doc_no: r.doc_no.trim(),
  });
  return {
    saved,
    records: r.id
      ? records.map((x) => (x.id === r.id ? saved : x))
      : [saved, ...records],
  };
}
export const deleteLog = (records: readonly SubmissionLog[], id: string) =>
  records.filter((r) => r.id !== id);
export const emptyLogFilters = { search: "", from: "", to: "" };
export function logFilterError(f: typeof emptyLogFilters) {
  return (f.from && !validLogDate(f.from)) ||
    (f.to && !validLogDate(f.to)) ||
    (f.from && f.to && f.from > f.to)
    ? "กรุณาระบุช่วงวันที่ที่ถูกต้อง"
    : "";
}
export function filterLogs(
  records: readonly SubmissionLog[],
  f: typeof emptyLogFilters,
) {
  if (logFilterError(f)) return [];
  const query = f.search.trim().toLowerCase();
  return records.filter(
    (r) =>
      (!f.from || r.sender_sign.signed_date >= f.from) &&
      (!f.to || r.sender_sign.signed_date <= f.to) &&
      [
        r.doc_no,
        r.sample_code,
        r.requester_name,
        r.sender_sign.signer_name,
        r.sample_name,
        ...selectedAnalysis(r).map(([, label]) => label),
      ].some((v) => v.toLowerCase().includes(query)),
  );
}
export function pageLogs<T>(
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
export const labSampleNote =
  "ข้อมูลอ้างอิงเดิม: ห้องปฏิบัติการแนะนำตัวอย่าง 1 กิโลกรัมขึ้นไป หากไม่ถึง 1 กิโลกรัม จะพิจารณาตามรายการวิเคราะห์ว่ามีเพียงพอหรือไม่ · เป็นข้อความประกอบ ไม่ใช่กฎปฏิเสธของ UI นี้ และไม่มีการแปลงหน่วย";
