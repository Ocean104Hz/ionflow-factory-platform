"use client";
import { useSyncExternalStore } from "react";
import { internalMasters } from "@/src/lib/mock-data/internal-masters";
import { acceptRepair, blankForm, createRepair, equipmentAdapter, saveWork, transitionRepair, validateForm, type Equipment, type Repair, type RepairForm, type RepairStatus, type WorkLog } from "./repair-domain";

function fixtures(): Repair[] {
  const equipment = equipmentAdapter(internalMasters.rows); const first = equipment[0]; if (!first) return [];
  const values: Repair[] = [];
  for (let index=0;index<6;index++) {
    const day=`2026-10-${String(10+index).padStart(2,"0")}`; const now=`${day}T08:00:00+07:00`;
    const form: RepairForm={...blankForm(day),requester:"ผู้แจ้งสาธิต",department:"การผลิต",site:first.site,area:first.line,equipmentId:first.id,title:["มอเตอร์มีเสียงผิดปกติ","ตรวจสายไฟชำรุด","ใบกวนสั่น","ชุดควบคุมขัดข้อง","บำรุงรักษาชุดส่งกำลัง","โครงครอบหลวม"][index],category:["เครื่องกล","ไฟฟ้า","เครื่องกล","ระบบควบคุม","เครื่องกล","โครงสร้าง"][index],description:"ข้อมูลสมมติเพื่อทดสอบ UI เท่านั้น โปรดตรวจสอบก่อนใช้งาน",priority:index===1?"CRITICAL":index===2?"URGENT":"NORMAL",detectedAt:`${day}T07:00`,stopped:index===1};
    let r=createRepair(values,form,equipment,false,`repair-demo-${index+1}`,now)[0];
    if(index>0) r=transitionRepair(r,"PENDING_ASSIGNMENT",now);
    if(index>1) r=transitionRepair(r,"ASSIGNED",now,"","ช่างสาธิต ก");
    if(index>2) {r=acceptRepair(r,now); r=transitionRepair(r,"IN_PROGRESS",now);}
    if(index>3) {r=saveWork(r,{diagnosis:"ชิ้นส่วนสึกหรอ (สาธิต)",method:"ปรับตั้งและเปลี่ยนชิ้นส่วน (สาธิต)",technicianNotes:"ทดสอบเดินเครื่อง",parts:[{id:`part-demo-${index}`,name:"ลูกปืนสาธิต",quantity:"2",unit:"ชิ้น",unitCost:"250.00"}],laborCost:"300.00",workStart:`${day}T08:00`,workEnd:`${day}T10:00`},now);r=transitionRepair(r,"PENDING_INSPECTION",`${day}T10:00:00+07:00`);}
    if(index>4) {r=transitionRepair(r,"COMPLETED",`${day}T11:00:00+07:00`);r=transitionRepair(r,"CLOSED",`${day}T12:00:00+07:00`);}
    values.push(r);
  }
  return values;
}
const initial=fixtures(); let records=initial; const listeners=new Set<()=>void>();
const emit=(next:Repair[])=>{records=next;listeners.forEach(fn=>fn());};
const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
// shortcut: session-memory demo only; replace this adapter when an authorized Maintenance API exists.
export function useRepairs() {
  const requests=useSyncExternalStore(subscribe,()=>records,()=>initial);
  return {requests,
    create(form:RepairForm,equipment:Equipment[],draft:boolean,id:string) {const next=createRepair(records,form,equipment,draft,id,new Date().toISOString());emit(next);return next[0];},
    change(id:string,target:RepairStatus,reason="",technician="") {update(id,r=>transitionRepair(r,target,new Date().toISOString(),reason,technician||r.technician));},
    accept(id:string) {update(id,r=>acceptRepair(r,new Date().toISOString()));},
    work(id:string,log:WorkLog) {update(id,r=>saveWork(r,log,new Date().toISOString()));},
    submitDraft(id:string,form:RepairForm,equipment:Equipment[]) {const errors=validateForm(form,equipment);if(Object.keys(errors).length)throw new Error(Object.values(errors)[0]);update(id,r=>transitionRepair({...r,...structuredClone(form)},"SUBMITTED",new Date().toISOString()));},
  };
}
function update(id:string,fn:(r:Repair)=>Repair) { const old=records.find(r=>r.id===id);if(!old)throw new Error("ไม่พบงานซ่อม"); const next=fn(old);emit(records.map(r=>r.id===id?next:r)); }
