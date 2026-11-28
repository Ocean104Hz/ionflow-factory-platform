import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const root='src/features/raw-material-inspections/';
const read=p=>readFileSync(root+p,'utf8');
const source=read('raw-material-paper-workspace.tsx');
const css=read('paper-theme.css');
const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX};
const transpile=s=>ts.transpileModule(s,{compilerOptions:options}).outputText;
const dataUrl=s=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const domainUrl=dataUrl(transpile(read('paper-domain.ts')));
const start=source.indexOf('function filterPaperHistory('), end=source.indexOf('function HistoryResult(');
assert.ok(start>=0&&end>start);
const helpers=await import(dataUrl(transpile(`import {paperChecks,paperResults} from '${domainUrl}';\nconst formatThaiDate=(x)=>x;\n${source.slice(start,end)}\nexport {filterPaperHistory,countPaperResults,paperHistoryExportRows,buildPaperHistoryXlsx};`)));
const {filterPaperHistory,countPaperResults,paperHistoryExportRows,buildPaperHistoryXlsx}=helpers;
const line={lineNo:2,materialCode:'RM001',supplierCode:'0002',quantity:'135.2500',unit:'kg',weight:'pass',contamination:'acceptable',physical:'fail',color:'pass',note:'=1+1 & <tag> ไทย'};
const first={id:'a',version:'1',date:'2026-10-27',number:'00001',lines:[line,{...line,lineNo:7,weight:'acceptable'}]};
const second={id:'b',version:'1',date:'2026-11-01',number:'00002',lines:[{...line,materialCode:'RM002'}]};
test('date range is inclusive, search matches saved material/supplier/document, results sorted newest first',()=>{
 assert.deepEqual(filterPaperHistory([first,second],'','', '').map(r=>r.id),['b','a']);
 assert.deepEqual(filterPaperHistory([first,second],'rm001','2026-10-27','2026-10-27'),[first]);
 assert.deepEqual(filterPaperHistory([first,second],'0002','2026-11-01',''),[second]);
 assert.deepEqual(filterPaperHistory([first,second],'','2026-12-01','2026-10-01'),[]);
});
test('pass, acceptable and fail are counted independently',()=>{assert.deepEqual(countPaperResults(first,'weight'),{pass:1,acceptable:1,fail:0});assert.deepEqual(countPaperResults(first,'physical'),{pass:0,acceptable:0,fail:2});});
test('Excel rows preserve original line number, code, decimal and all check states',()=>{
 const rows=paperHistoryExportRows([first]);assert.equal(rows.length,3);assert.deepEqual(rows[1],['00001','2026-10-27','2','RM001','0002','135.2500','kg','ผ่าน','ยอมรับได้','ไม่ผ่าน','ผ่าน',line.note]);assert.equal(rows[2][2],'7');
 const bytes=buildPaperHistoryXlsx([first]);assert.equal(Buffer.from(bytes).readUInt32LE(0),0x04034b50);assert.ok(Buffer.from(bytes).includes(Buffer.from('t="inlineStr"')));assert.ok(Buffer.from(bytes).includes(Buffer.from('=1+1 &amp; &lt;tag&gt; ไทย')));assert.ok(!Buffer.from(bytes).includes(Buffer.from('<f>')));
 if(process.env.NAN_QC_EXPORT_TEST_PATH)writeFileSync(process.env.NAN_QC_EXPORT_TEST_PATH,bytes);
});
test('history filter, pagination, selection, dropdown and saved-record print wiring',()=>{
 for(const token of ['ข้อมูลที่บันทึก','วันที่เริ่มค้นหา','วันที่สิ้นสุด','แสดงต่อหน้า','visibleRecords=filtered.slice','selectedRecords=filtered.filter','ดูรายละเอียด','พิมพ์เอกสาร','แก้ไข','นำออก Excel','ลบเอกสาร','align="end"','variant="destructive"','setPrintRecord(record)','requestOpen(record,true)','requestOpen(record,false)','exportRecords([record])','setPending({kind:"archive",record})','<HistoryPrintDialog','{children}','เอกสารรูปแบบเดิม'])assert.ok(source.includes(token),token);
 assert.ok(css.includes('.nan-qc-history-table thead'));assert.ok(css.includes('position:sticky'));assert.doesNotMatch(source,/\bany\b/);
});
test('TSX syntax has no transpiler diagnostics',()=>{const result=ts.transpileModule(source,{compilerOptions:options,fileName:'raw-material-paper-workspace.tsx',reportDiagnostics:true});assert.deepEqual(result.diagnostics,[]);});
