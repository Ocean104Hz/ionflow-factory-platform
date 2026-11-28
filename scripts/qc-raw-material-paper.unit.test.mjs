import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const base="src/features/raw-material-inspections/";
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const dataUrl=js=>`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const domainUrl=dataUrl(transpile(read(`${base}paper-domain.ts`)));
const {blankPaperRows,paperChecks,paperResults,updatePaperRow,buildPaperInput,validatePaperInput,validatePaperIdentity,rowsFromPaper,paperStatus}=await import(domainUrl);
const example=()=>({materialCode:"RM9101",supplierCode:"SR9101",quantity:"135.25",unit:"kg",weight:"pass",contamination:"acceptable",physical:"pass",color:"fail",note:"Example"});
const document=(lines=[{...example(),lineNo:1}])=>({date:"2026-10-27",number:"QA-0001",lines});
test("ten independent rows, three distinct symbols, four paper checks",()=>{
 const rows=blankPaperRows();assert.equal(rows.length,10);assert.equal(new Set(rows).size,10);assert.deepEqual(paperChecks.map(c=>c.key),["weight","contamination","physical","color"]);assert.deepEqual(paperResults.map(r=>[r.value,r.symbol]),[["pass","/"],["acceptable","O"],["fail","X"]]);
 const changed=updatePaperRow(rows,2,"weight","acceptable");assert.equal(changed[2].weight,"acceptable");assert.equal(rows[2].weight,"");assert.equal(changed[3],rows[3]);
});
test("save preserves nonconsecutive line positions and data after round trip",()=>{
 const rows=blankPaperRows();rows[1]=example();rows[9]={...example(),color:"pass",note:""};const input=buildPaperInput("2026-10-27"," QA-0001 ",rows);assert.deepEqual(input.lines.map(l=>l.lineNo),[2,10]);assert.equal(input.number,"QA-0001");assert.deepEqual(rowsFromPaper({...input,id:"id",version:"1"}),rows);assert.equal(paperStatus(input.lines),"ไม่ผ่าน");assert.equal(paperStatus([input.lines[1]]),"ยอมรับได้");
});
test("rejects empty and partially filled rows, invalid results, excessive quantity precision and dates",()=>{
 const rows=blankPaperRows();assert.throws(()=>buildPaperInput("2026-10-27","QA-0001",rows));rows[0].materialCode="RM";assert.throws(()=>buildPaperInput("2026-10-27","QA-0001",rows));
 for(const invalid of ["na","pending","","other"])assert.throws(()=>validatePaperInput(document([{...example(),lineNo:1,weight:invalid}])));
 for(const invalid of ["0","-1","1e2","1.1234567","Infinity","1000000000000"])assert.throws(()=>validatePaperInput(document([{...example(),lineNo:1,quantity:invalid}])));
 assert.throws(()=>validatePaperInput({...document(),date:"2026-02-30"}));assert.throws(()=>validatePaperInput({...document(),number:" "}));assert.throws(()=>validatePaperInput(document([{...example(),lineNo:1},{...example(),lineNo:1}])));assert.throws(()=>validatePaperInput(document(Array.from({length:11},(_,i)=>({...example(),lineNo:i+1})))));
});
test("validates optimistic version identifiers",()=>{const id="aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";assert.deepEqual(validatePaperIdentity(id,"1"),{id,version:"1"});for(const v of ["0","-1","1.5","9223372036854775807",1])assert.throws(()=>validatePaperIdentity(id,v));assert.throws(()=>validatePaperIdentity("bad","1"));});
test("approved form is default URL, real save, old history and controlled inputs are retained",()=>{
 const page=read("app/(factory)/qc_raw_material/page.tsx"),ui=read(`${base}raw-material-paper-workspace.tsx`),route=read("app/api/qc-raw-material-paper/route.ts"),repo=read("src/server/raw-material-inspections/paper-repository.ts"),sql=read("migrations/0011_qc_receiving_sheet.up.sql");
 assert.ok(page.includes("<RawMaterialPaperWorkspace>"));assert.ok(page.includes("<RawMaterialInspections />"));assert.doesNotMatch(page,/paper-preview|useSearchParams|Suspense/);
 for(const token of ['useState<"form"|"history">("form")','ส่วนหัวเอกสาร','วันที่ *','เอกสารเลขที่','รายการตรวจสอบ','รหัสวัตถุดิบ','รหัส Supplier','จำนวน','หน่วย','colSpan={4}','หมายเหตุ','รายชื่อผู้ลงนาม','ผู้ตรวจสอบคุณภาพ','รับทราบโดย','รอลงนาม','รอลำดับก่อนหน้า','buildPaperInput(date,number,rows)','/api/qc-raw-material-paper','เอกสารรูปแบบเดิม','PaperPrintPreview'])assert.ok(ui.includes(token),token);
 assert.doesNotMatch(ui,/paper-preview=1|localStorage|sessionStorage/);
 for(const token of ['requireFactoryModule(user,"qc_raw_material")','requireFactoryRole(user,"factory_admin")','assertCsrf(request)','assertTrustedAuthRequest(request)','validatePaperInput','validatePaperIdentity','GET()','POST(','PUT(','DELETE('])assert.ok(route.includes(token),token);
 for(const token of ['getDevelopmentDatabase().write','FOR UPDATE','version=version+1','await saveLines','await audit','archived_at=CURRENT_TIMESTAMP'])assert.ok(repo.includes(token),token);
 for(const token of ['line_no BETWEEN 1 AND 10',"'pass','acceptable','fail'",'PRIMARY KEY (sheet_id,line_no)','qc_receiving_reserve_legacy_number','qc_receiving_reserve_paper_number','SECURITY DEFINER','REVOKE ALL ON FUNCTION','FROM foliar_fertilizer.m_qc_raw_material'])assert.ok(sql.includes(token),token);
 assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE TABLE|DELETE FROM foliar_fertilizer\.m_qc_raw_material/);
});
test("print includes every approved field, symbol and escaped notes without scripts",async()=>{
 const dateUrl=dataUrl('export const formatThaiDate=x=>x;');
 const print=await import(dataUrl(transpile(read(`${base}paper-print.ts`)).replace(/from ["']\.\/paper-domain["']/,`from "${domainUrl}"`).replace(/from ["']@\/src\/lib\/date\/thai-date["']/,`from "${dateUrl}"`)));
 const record={...validatePaperInput(document([{...example(),lineNo:3,note:"<script>alert(1)</script>"}])),id:"id",version:"1"};const html=print.buildPaperPrintHtml(record,"Factory & Co");for(const token of ["A5 landscape","QA-0001","RM9101","SR9101","135.25","kg","น้ำหนัก","สิ่งปนเปื้อน","กายภาพ","สี","ผู้ตรวจสอบคุณภาพ","รับทราบโดย","&lt;script&gt;","Factory &amp; Co"])assert.ok(html.includes(token),token);assert.doesNotMatch(html,/<script>/);assert.equal((html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)??[]).length,10);
});
