import assert from "node:assert/strict";
import { readFileSync,existsSync,readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=f=>readFileSync(path.join(root,f),"utf8");
const cache=new Map();
const data=code=>`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function moduleURL(file) {
  if(cache.has(file))return cache.get(file);
  const output=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const parsed=ts.createSourceFile(file+".js",output,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const imports=parsed.statements.filter(node=>ts.isImportDeclaration(node)||(ts.isExportDeclaration(node)&&node.moduleSpecifier)).map(node=>node.moduleSpecifier);
  let code=output;
  for(const node of imports.reverse()) {
    const spec=node.text;
    function resolve() {
    if(spec==="next/navigation")return data('export function useRouter(){return {push(){},replace(){}}} export function usePathname(){return "/repair-requests"}');
    if(!spec.startsWith(".")&&!spec.startsWith("@/")) {let target=import.meta.resolve(spec);if(target.startsWith("file:")&&!existsSync(fileURLToPath(target))&&existsSync(fileURLToPath(target)+".js"))target+=".js";return target;}
    const base=spec.startsWith("@/")?path.join(root,spec.slice(2)):path.resolve(path.dirname(file),spec);
    const target=[base,base+".ts",base+".tsx",path.join(base,"index.tsx")].find(p=>existsSync(p)&&/\.(ts|tsx)$/.test(p));assert.ok(target,base);
    return moduleURL(target);
    }
    code=code.slice(0,node.getStart(parsed))+JSON.stringify(resolve())+code.slice(node.end);
  }const url=data(code);cache.set(file,url);return url;
}
const dir="src/features/repair-requests/";
const d=await import(moduleURL(path.join(root,dir,"repair-domain.ts")));
const {internalMasters}=await import(moduleURL(path.join(root,"src/lib/mock-data/internal-masters.ts")));
const equipment=d.equipmentAdapter(internalMasters.rows);
const valid=()=>({...d.blankForm("2026-10-26"),requester:"ผู้แจ้งทดสอบ",department:"ผลิต",site:"โรงงานสาธิต",area:"Line 1",equipmentId:equipment[0].id,title:"มอเตอร์สั่น",category:"เครื่องกล",description:"ทดสอบโดยไม่มีรายการจริง",detectedAt:"2026-10-26T08:00",remarks:"หมายเหตุ",notes:"บันทึกแยก",requestedDate:"2026-10-27"});
const now="2026-10-26T08:00:00Z";
const make=()=>d.createRepair([],valid(),equipment,false,"test-1",now)[0];
test("required fields, dates, existing equipment IDs, category, priority and draft validation",()=>{
  const errors=d.validateForm(d.blankForm(""),equipment);for(const key of ["requestDate","requester","department","site","area","equipmentId","title","category","description","detectedAt"])assert.ok(errors[key],key);
  assert.deepEqual(d.validateForm(valid(),equipment),{});
  assert.deepEqual(d.validateForm({...d.blankForm("2026-10-26"),title:"ร่าง"},equipment,true),{});
  for(const [key,value] of [["requestDate","2026-02-30"],["detectedAt","2026-10-26T29:00"],["equipmentId","invented-id"],["category","other"],["priority","wrong"]])assert.ok(d.validateForm({...valid(),[key]:value},equipment)[key],key);
  assert.ok(d.validateForm({...valid(),equipmentId:equipment[0].id},[{...equipment[0],active:false}]).equipmentId);
});
test("mock creation preserves all input, stable identity and unique monthly numbers",()=>{
  const first=d.createRepair([],valid(),equipment,false,"a",now);const second=d.createRepair(first,valid(),equipment,false,"b",now);
  assert.equal(second[0].number,"RR-202610-002");assert.equal(second[1].number,"RR-202610-001");assert.equal(second[0].status,"SUBMITTED");assert.equal(second[0].remarks,"หมายเหตุ");assert.equal(second[0].notes,"บันทึกแยก");assert.equal(first.length,1);
  assert.equal(d.nextNumber(second,"2026-11-01"),"RR-202611-001");assert.throws(()=>d.createRepair(first,valid(),equipment,false,"a",now));
});
test("all stages, acceptance, parts wait, inspection rework reason and closed mutation denial",()=>{
  let r=make();assert.throws(()=>d.transitionRepair(r,"IN_PROGRESS",now));r=d.transitionRepair(r,"PENDING_ASSIGNMENT",now);assert.throws(()=>d.transitionRepair(r,"ASSIGNED",now));r=d.transitionRepair(r,"ASSIGNED",now,"",d.technicians[0]);assert.throws(()=>d.transitionRepair(r,"IN_PROGRESS",now));r=d.acceptRepair(r,now);assert.throws(()=>d.acceptRepair(r,now));r=d.transitionRepair(r,"IN_PROGRESS",now);r=d.transitionRepair(r,"WAITING_PARTS",now);r=d.transitionRepair(r,"IN_PROGRESS",now);assert.throws(()=>d.transitionRepair(r,"PENDING_INSPECTION",now));
  r=d.saveWork(r,{diagnosis:"ชิ้นส่วนหลวม",method:"ปรับตั้ง",technicianNotes:"ทดสอบ",workStart:"2026-10-26T08:00",workEnd:"2026-10-26T09:00",parts:[],laborCost:"100"},now);
  r=d.transitionRepair(r,"PENDING_INSPECTION",now);assert.throws(()=>d.transitionRepair(r,"IN_PROGRESS",now));r=d.transitionRepair(r,"IN_PROGRESS",now,"ยังมีเสียง");assert.equal(r.workEnd,"");r=d.transitionRepair(r,"PENDING_INSPECTION",now);r=d.transitionRepair(r,"COMPLETED",now);r=d.transitionRepair(r,"CLOSED",now);
  assert.equal(r.activities.length,13);assert.equal(r.id,"test-1");assert.equal(r.activities[0].status,"SUBMITTED");assert.ok(r.activities.some(a=>a.text.includes("ยังมีเสียง")));assert.throws(()=>d.transitionRepair(r,"IN_PROGRESS",now));assert.throws(()=>d.saveWork(r,r,now));
});
test("cancellation requires reason, disallows late cancellation, and preserves audit",()=>{const r=make();assert.throws(()=>d.transitionRepair(r,"CANCELLED",now));const cancelled=d.transitionRepair(r,"CANCELLED",now,"แจ้งซ้ำ");assert.equal(cancelled.activities.length,2);assert.equal(r.status,"SUBMITTED");assert.deepEqual(d.transitions.CANCELLED,[]);assert.ok(!d.transitions.IN_PROGRESS.includes("CANCELLED"));});
test("cost precision, independent part rows and invalid or negative numbers",()=>{
  const parts=[{id:"p1",name:"น็อต",quantity:"1.50",unit:"ชิ้น",unitCost:"0.10"},{id:"p2",name:"สายพาน",quantity:"2",unit:"ชิ้น",unitCost:"20.25"}];assert.equal(d.repairCost({parts,laborCost:"100.10"}),14075n);assert.equal(d.formatCost(14075n),"140.75");assert.throws(()=>d.partCost({...parts[0],quantity:"0"}));assert.throws(()=>d.cents("-1"));assert.throws(()=>d.cents("Infinity"));assert.throws(()=>d.cents("0.001"));
  const r={...make(),status:"IN_PROGRESS"};assert.throws(()=>d.saveWork(r,{...r,parts:[parts[0],parts[0]]},now));assert.throws(()=>d.saveWork(r,{...r,workStart:"2026-10-26T09:00",workEnd:"2026-10-26T08:00"},now));const changed=d.saveWork(r,{...r,parts,laborCost:"100.10"},now);parts[0].name="changed";assert.equal(changed.parts[0].name,"น็อต");assert.equal(r.parts.length,0);
});
test("equipment adapter uses exact master ID and ancestry, never invents master fields",()=>{assert.equal(equipment[0].id,"machine-1");assert.equal(equipment[0].site,"โรงงานสาธิต");assert.equal(equipment[0].line,"DEMO Line 1");assert.equal(equipment[0].type,"");assert.equal(equipment.length,internalMasters.rows.filter(r=>r.kind==="equipment").length);assert.deepEqual(d.equipmentAdapter([]),[]);});
test("filters, equipment history and report statistics use the same records",()=>{
  const first=make();const second={...make(),id:"test-2",status:"CLOSED",workEnd:"2026-10-26T10:00",stopped:true};const records=[first,second];assert.equal(d.filterRepairs(records,{...d.emptyFilters,search:"MACHINE-01"},equipment).length,2);assert.equal(d.filterRepairs(records,{...d.emptyFilters,status:"CLOSED"},equipment).length,1);assert.equal(d.filterRepairs(records,{...d.emptyFilters,from:"2026-10-27"},equipment).length,0);assert.equal(d.filterRepairs(records,{...d.emptyFilters,equipmentId:"unknown"},equipment).length,0);
  const stats=d.statistics(records,"2026-10-26T11:00");assert.equal(stats.total,2);assert.equal(stats.open,1);assert.equal(stats.done,1);assert.equal(stats.downtimeHours,2);
});
const {MasterDataProvider}=await import(moduleURL(path.join(root,"src/features/master-data/master-provider.tsx")));
const {RepairForm}=await import(moduleURL(path.join(root,dir,"repair-form.tsx")));
const {RepairList}=await import(moduleURL(path.join(root,dir,"repair-list.tsx")));
const {RepairDetail,WorkLogEditor}=await import(moduleURL(path.join(root,dir,"repair-detail.tsx")));
const {EquipmentList,EquipmentDetail}=await import(moduleURL(path.join(root,dir,"equipment-workspace.tsx")));
const {MaintenanceReports}=await import(moduleURL(path.join(root,dir,"maintenance-reports.tsx")));
const render=(component,props={})=>renderToStaticMarkup(React.createElement(MasterDataProvider,null,React.createElement(component,props)));
// Independent manifest from the approved brief, not inferred from the TypeScript type.
test("rendered full-page form contains all document, equipment, problem and note controls",()=>{
  const html=render(RepairForm);const fields=["number","requestDate","requester","department","site","area","equipmentName","equipmentLocation","equipmentType","title","description","detectedAt","remarks","notes","requestedDate","photos","stopped"];
  for(const name of fields)assert.ok(html.includes(`id="repair-${name}"`),name);
  for(const label of ["รหัสอุปกรณ์ *","ประเภทอาการเสีย *","ความเร่งด่วน *","บันทึกร่าง","ส่งใบแจ้งซ่อมจำลอง","ไม่อัปโหลด"])assert.ok(html.includes(label),label);
  for(const name of ["description","remarks","notes"])assert.match(html,new RegExp(`<textarea[^>]*id="repair-${name}"`));
  for(const name of ["equipmentName","equipmentLocation","equipmentType","number"]) {const tag=html.match(new RegExp(`<input[^>]*id="repair-${name}"[^>]*>`))?.[0];assert.match(tag,/readOnly/i);}
  assert.doesNotMatch(html,/<dialog/);assert.match(html,/<form/);
});
test("all six screens render, links preserve equipment and repair identity",()=>{
  for(const component of [RepairList,EquipmentList,MaintenanceReports])assert.match(render(component),/<h1/);
  const detail=render(RepairDetail,{id:"repair-demo-1"});for(const label of ["ภาพรวม","การดำเนินงาน","อะไหล่และค่าใช้จ่าย","ประวัติกิจกรรม","มอเตอร์มีเสียงผิดปกติ","ผู้แจ้งสาธิต"])assert.ok(detail.includes(label),label);
  assert.match(render(EquipmentDetail,{id:"machine-1"}),/repair-demo-1/);assert.match(render(EquipmentDetail,{id:"unknown"}),/ไม่พบอุปกรณ์/);assert.match(render(RepairDetail,{id:"unknown"}),/ไม่พบใบแจ้งซ่อม/);
  assert.doesNotMatch(render(RepairDetail,{id:"repair-demo-6"}),/ยืนยันการดำเนินการจำลอง|รับงานจำลอง<|เริ่มซ่อม \/ กลับมาซ่อม</);
});
test("rendered work controls, individual part IDs, read-only closed records and exact totals",()=>{
  const request={...make(),status:"IN_PROGRESS",parts:[{id:"first",name:"อะไหล่ A",quantity:"2",unit:"ชิ้น",unitCost:"10.25"},{id:"second",name:"อะไหล่ B",quantity:"1",unit:"ชิ้น",unitCost:"5"}],laborCost:"100.00"};const html=render(WorkLogEditor,{request,onSave(){}});
  for(const key of ["diagnosis","method","technicianNotes","workStart","workEnd","laborCost",...request.parts.flatMap(p=>["name","quantity","unit","unitCost"].map(k=>`part-${p.id}-${k}`))])assert.ok(html.includes(`id="repair-${key}"`),key);
  assert.match(html,/125.50/);assert.match(html,/บันทึกงานซ่อมและค่าใช้จ่ายจำลอง/);assert.doesNotMatch(render(WorkLogEditor,{request:{...request,status:"CLOSED"},onSave(){}}),/เพิ่มอะไหล่|บันทึกงานซ่อมและค่าใช้จ่ายจำลอง/);
});
test("all routes, nested active states, no database/API/storage writes or new master dataset",async()=>{
  for(const route of ["repair-requests","repair-requests/new","repair-requests/[repairRequestId]","equipment","equipment/[equipmentId]","maintenance-reports"])assert.ok(existsSync(path.join(root,`app/(factory)/${route}/page.tsx`)),route);
  for(const file of readdirSync(path.join(root,dir)).filter(f=>/\.(ts|tsx)$/.test(f)))assert.doesNotMatch(read(dir+file),/fetch\s*\(|localStorage|sessionStorage|from ["'].*server\/|from ["']pg["']/);
  assert.match(read(dir+"repair-store.ts"),/useSyncExternalStore/);assert.match(read(dir+"repair-ui.tsx"),/useMasterData/);assert.match(read(dir+"repair-form.tsx"),/beforeunload/);
  const {isNavigationActive}=await import(moduleURL(path.join(root,"src/lib/constants/navigation.ts")));
  assert.equal(isNavigationActive("/repair-requests/new","/repair-requests"),true);assert.equal(isNavigationActive("/equipment/machine-1","/equipment"),true);assert.equal(isNavigationActive("/equipment-extra","/equipment"),false);
});
test("focused TypeScript diagnostics for Maintenance source and routes only",()=>{
  const files=readdirSync(path.join(root,dir)).filter(f=>/\.(ts|tsx)$/.test(f)).map(f=>path.join(root,dir,f));for(const route of ["repair-requests","repair-requests/new","repair-requests/[repairRequestId]","equipment","equipment/[equipmentId]","maintenance-reports"])files.push(path.join(root,`app/(factory)/${route}/page.tsx`));
  const config=ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(root,"tsconfig.json"),ts.sys.readFile).config,ts.sys,root);const program=ts.createProgram(files,{...config.options,noEmit:true,incremental:false});const selected=new Set(files.map(f=>f.replaceAll("\\","/").toLowerCase()));const errors=ts.getPreEmitDiagnostics(program).filter(d=>!d.file||selected.has(d.file.fileName.replaceAll("\\","/").toLowerCase()));assert.equal(errors.length,0,ts.formatDiagnostics(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=>"\n"}));
});
