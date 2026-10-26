import type { MasterRow } from "../master-data/master-domain";

export const statuses = { DRAFT: "ร่าง", SUBMITTED: "ส่งแจ้งซ่อม", PENDING_ASSIGNMENT: "รอรับงาน", ASSIGNED: "มอบหมายแล้ว", IN_PROGRESS: "กำลังซ่อม", WAITING_PARTS: "รออะไหล่", PENDING_INSPECTION: "รอตรวจรับ", COMPLETED: "ซ่อมเสร็จ", CLOSED: "ปิดงาน", CANCELLED: "ยกเลิก" } as const;
export type RepairStatus = keyof typeof statuses;
export const priorities = { NORMAL: "ปกติ", URGENT: "เร่งด่วน", CRITICAL: "วิกฤต" } as const;
export type Priority = keyof typeof priorities;
export const categories = ["เครื่องกล", "ไฟฟ้า", "ระบบควบคุม", "โครงสร้าง", "อื่น ๆ"];
export const technicians = ["ช่างสาธิต ก", "ช่างสาธิต ข"];
export const actor = "ผู้ดำเนินการ DEMO";
export type Photo = { id: string; name: string; url: string };
export type Part = { id: string; name: string; quantity: string; unit: string; unitCost: string };
export type Activity = { id: string; at: string; actor: string; text: string; status: RepairStatus };
export type RepairForm = { requestDate: string; requester: string; department: string; site: string; area: string; equipmentId: string; title: string; category: string; description: string; priority: Priority; stopped: boolean; detectedAt: string; remarks: string; requestedDate: string; notes: string; photos: Photo[] };
export type Repair = RepairForm & { id: string; number: string; status: RepairStatus; technician: string; acceptedAt: string; workStart: string; workEnd: string; diagnosis: string; method: string; technicianNotes: string; parts: Part[]; laborCost: string; activities: Activity[]; createdAt: string; updatedAt: string };
export type Equipment = { id: string; code: string; name: string; type: string; site: string; location: string; line: string; active: boolean };
export function equipmentAdapter(rows: MasterRow[]): Equipment[] {
  return rows.filter(r => r.kind === "equipment").map(r => {
    const ancestry: MasterRow[] = []; const seen = new Set([r.id]); let parent = rows.find(p => p.id === r.parentId);
    while (parent && !seen.has(parent.id)) { ancestry.push(parent); seen.add(parent.id); parent = rows.find(p => p.id === parent?.parentId); }
    return { id: r.id, code: r.code, name: r.name, type: r.type, active: r.active, site: ancestry.find(p => p.kind === "sites")?.name ?? "", line: ancestry.find(p => p.kind === "lines")?.name ?? "", location: ancestry.filter(p => p.kind !== "sites").map(p => p.name).join(" / ") };
  });
}
export function blankForm(date: string): RepairForm { return { requestDate: date, requester: "", department: "", site: "", area: "", equipmentId: "", title: "", category: "", description: "", priority: "NORMAL", stopped: false, detectedAt: "", remarks: "", requestedDate: "", notes: "", photos: [] }; }
export function validDate(v: string) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v; }
export function validTime(v: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?Z?)?$/.test(v) && validDate(v.slice(0,10)) && /^([01]\d|2[0-3]):[0-5]\d/.test(v.slice(11)) && Number.isFinite(Date.parse(v)); }
export function validateForm(f: RepairForm, equipment: Equipment[], draft = false) {
  const errors: Record<string,string> = {};
  const required = draft ? ["title"] as const : ["requester","department","site","area","equipmentId","title","category","description","detectedAt"] as const;
  for (const key of required) if (!f[key].trim()) errors[key] = "กรุณาระบุข้อมูลนี้";
  if (!validDate(f.requestDate)) errors.requestDate = "กรุณาระบุวันที่แจ้งที่ถูกต้อง";
  if (f.requestedDate && !validDate(f.requestedDate)) errors.requestedDate = "วันที่ต้องการซ่อมไม่ถูกต้อง";
  if (f.detectedAt && !validTime(f.detectedAt)) errors.detectedAt = "วันเวลาที่ตรวจพบไม่ถูกต้อง";
  if (f.equipmentId && !equipment.some(e => e.id === f.equipmentId && e.active)) errors.equipmentId = "กรุณาเลือกอุปกรณ์ที่เปิดใช้งานจาก Master เดิม";
  if (f.category && !categories.includes(f.category)) errors.category = "ประเภทอาการเสียไม่ถูกต้อง";
  if (!Object.hasOwn(priorities,f.priority)) errors.priority = "ความเร่งด่วนไม่ถูกต้อง";
  if (f.photos.length > 5 || f.photos.some(p => !p.url.startsWith("blob:") || !p.name)) errors.photos = "รองรับภาพในเครื่องไม่เกิน 5 ภาพ";
  return errors;
}
export function nextNumber(records: Repair[], date: string) {
  if (!validDate(date)) throw new Error("วันที่แจ้งไม่ถูกต้อง");
  const prefix = `RR-${date.slice(0,4)}${date.slice(5,7)}-`;
  const sequence = Math.max(0,...records.filter(r => r.number.startsWith(prefix)).map(r => Number(r.number.slice(prefix.length)) || 0)) + 1;
  return `${prefix}${String(sequence).padStart(3,"0")}`;
}
export function createRepair(records: Repair[], form: RepairForm, equipment: Equipment[], draft: boolean, id: string, now: string): Repair[] {
  const errors = validateForm(form,equipment,draft); if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (records.some(r => r.id === id)) throw new Error("คำขอนี้ถูกบันทึกแล้ว");
  const status = draft ? "DRAFT" : "SUBMITTED";
  const r: Repair = { ...structuredClone(form), id, number: nextNumber(records,form.requestDate), status, technician: "", acceptedAt:"", workStart:"",workEnd:"", diagnosis:"", method:"",technicianNotes:"",parts:[],laborCost:"",activities:[{id:`${id}-created`,at:now,actor,text:draft?"บันทึกร่างจำลอง":"ส่งใบแจ้งซ่อมจำลอง",status}],createdAt:now,updatedAt:now };
  return [r,...records];
}
export const transitions: Record<RepairStatus, RepairStatus[]> = {
  DRAFT:["SUBMITTED","CANCELLED"], SUBMITTED:["PENDING_ASSIGNMENT","CANCELLED"], PENDING_ASSIGNMENT:["ASSIGNED","CANCELLED"], ASSIGNED:["IN_PROGRESS","CANCELLED"], IN_PROGRESS:["WAITING_PARTS","PENDING_INSPECTION"], WAITING_PARTS:["IN_PROGRESS"], PENDING_INSPECTION:["COMPLETED","IN_PROGRESS"], COMPLETED:["CLOSED"], CLOSED:[], CANCELLED:[],
};
export function transitionRepair(r: Repair, target: RepairStatus, now: string, reason = "", technician = r.technician): Repair {
  if (!transitions[r.status].includes(target)) throw new Error("เปลี่ยนสถานะข้ามขั้นตอนไม่ได้");
  if (target === "ASSIGNED" && !technicians.includes(technician)) throw new Error("กรุณาเลือกช่างผู้รับผิดชอบ");
  if (r.status === "ASSIGNED" && target === "IN_PROGRESS" && !r.acceptedAt) throw new Error("กรุณารับงานก่อนเริ่มซ่อม");
  if ((target === "CANCELLED" || (r.status === "PENDING_INSPECTION" && target === "IN_PROGRESS")) && !reason.trim()) throw new Error("กรุณาระบุเหตุผล");
  if (target === "PENDING_INSPECTION" && (!r.diagnosis.trim() || !r.method.trim())) throw new Error("กรุณาบันทึกผลวิเคราะห์และวิธีซ่อมก่อนส่งตรวจรับ");
  return { ...r,status:target,technician:target === "ASSIGNED"?technician:r.technician,workStart:target === "IN_PROGRESS" && !r.workStart ? now:r.workStart,workEnd:target === "PENDING_INSPECTION"?now:target === "IN_PROGRESS"?"":r.workEnd,updatedAt:now,activities:[...r.activities,{id:`${r.id}-event-${r.activities.length}`,at:now,actor,status:target,text:`${statuses[r.status]} → ${statuses[target]}${reason.trim()?` · ${reason.trim()}`:""}`}] };
}
export function acceptRepair(r: Repair, now: string): Repair {
  if (r.status !== "ASSIGNED" || r.acceptedAt) throw new Error("รับงานได้เฉพาะงานที่มอบหมายและยังไม่รับ");
  return {...r,acceptedAt:now,updatedAt:now,activities:[...r.activities,{id:`${r.id}-event-${r.activities.length}`,at:now,actor,status:r.status,text:"ช่างรับงานจำลอง"}]};
}
export function cents(v: string): bigint { if (!/^\d{1,9}(\.\d{1,2})?$/.test(v)) throw new Error("จำนวนเงินต้องเป็นเลขไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง"); const [a,b=""] = v.split("."); return BigInt(a)*BigInt(100)+BigInt(b.padEnd(2,"0")); }
export function partCost(p: Part) { const q=cents(p.quantity); if(q<=BigInt(0)) throw new Error("จำนวนอะไหล่ต้องมากกว่า 0"); return (q*cents(p.unitCost)+BigInt(50))/BigInt(100); }
export function repairCost(r: Pick<Repair,"parts"|"laborCost">) { return r.parts.reduce((sum,p)=>sum+partCost(p),BigInt(0))+cents(r.laborCost||"0"); }
export function formatCost(value: bigint) { return `${(value/BigInt(100)).toLocaleString("th-TH")}.${String(value%BigInt(100)).padStart(2,"0")}`; }
export type WorkLog = Pick<Repair,"diagnosis"|"method"|"technicianNotes"|"workStart"|"workEnd"|"parts"|"laborCost">;
export function saveWork(r: Repair, log: WorkLog, now: string): Repair {
  if (!["ASSIGNED","IN_PROGRESS","WAITING_PARTS"].includes(r.status)) throw new Error("สถานะนี้แก้ไขบันทึกซ่อมไม่ได้");
  if (log.parts.some(p=>!p.name.trim()||!p.unit.trim()) || new Set(log.parts.map(p=>p.id)).size!==log.parts.length) throw new Error("ระบุชื่อ หน่วย และแถวอะไหล่ให้ครบ");
  repairCost(log);
  if ((log.workStart && !validTime(log.workStart)) || (log.workEnd && (!validTime(log.workEnd)||!log.workStart||Date.parse(log.workEnd)<Date.parse(log.workStart)))) throw new Error("ช่วงเวลาซ่อมไม่ถูกต้อง");
  return {...r,...structuredClone(log),updatedAt:now,activities:[...r.activities,{id:`${r.id}-event-${r.activities.length}`,at:now,actor,status:r.status,text:"บันทึกผลซ่อมและค่าใช้จ่ายจำลอง"}]};
}
export type RepairFilters = { search: string; status: string; priority: string; department: string; technician: string; from: string; to: string; equipmentId: string };
export const emptyFilters: RepairFilters = {search:"",status:"all",priority:"all",department:"all",technician:"all",from:"",to:"",equipmentId:"all"};
export function filterRepairs(records: Repair[], f: RepairFilters, equipment: Equipment[]) {
  return records.filter(r=> {
    const e=equipment.find(e=>e.id===r.equipmentId);
    return (!f.search || [r.number,r.title,r.description,r.requester,e?.name,e?.code].join(" ").toLocaleLowerCase("th").includes(f.search.trim().toLocaleLowerCase("th"))) && (f.status==="all"||r.status===f.status) && (f.priority==="all"||r.priority===f.priority) && (f.department==="all"||r.department===f.department) && (f.technician==="all"||r.technician===f.technician) && (f.equipmentId==="all"||r.equipmentId===f.equipmentId) && (!f.from||r.requestDate>=f.from)&&(!f.to||r.requestDate<=f.to);
  });
}
export function statistics(records: Repair[], now: string) {
  const done = records.filter(r=>["COMPLETED","CLOSED"].includes(r.status)).length;
  const downtime = records.filter(r=>r.stopped&&r.detectedAt&&r.status!=="CANCELLED"&&r.status!=="DRAFT").reduce((sum,r)=>sum+Math.max(0,Date.parse(r.workEnd||now)-Date.parse(r.detectedAt)),0);
  return {total:records.length,open:records.filter(r=>!["DRAFT","COMPLETED","CLOSED","CANCELLED"].includes(r.status)).length,done,downtimeHours:Math.round(downtime/360000)/10};
}
