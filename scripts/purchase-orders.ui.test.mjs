import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
// Existing Node/TypeScript/React renderer only; no added test framework.
function moduleURL(file) {
  if (cache.has(file)) return cache.get(file);
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
  });
  assert.equal(
    output.diagnostics?.filter(
      (d) => d.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
    file,
  );
  const code = output.outputText.replace(
    /(from\s+|import\s*)(["'])([^"']+)\2/g,
    (full, start, quote, spec) => {
      if (!spec.startsWith(".") && !spec.startsWith("@/")) {
        let target = import.meta.resolve(spec);
        if (
          target.startsWith("file:") &&
          !existsSync(fileURLToPath(target)) &&
          existsSync(fileURLToPath(target) + ".js")
        )
          target += ".js";
        return `${start}${quote}${target}${quote}`;
      }
      const base = spec.startsWith("@/")
        ? path.join(root, spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const target = [
        base,
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
      ].find((p) => existsSync(p) && /\.(ts|tsx)$/.test(p));
      assert.ok(target, base);
      return `${start}${quote}${moduleURL(target)}${quote}`;
    },
  );
  const url = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
  cache.set(file, url);
  return url;
}

const domainPath = path.join(root,"src/features/purchase-orders/po-domain.ts");
const d = await import(moduleURL(domainPath));
const {PoForm} = await import(moduleURL(path.join(root,"src/features/purchase-orders/po-form.tsx")));
const {PoPaper} = await import(moduleURL(path.join(root,"src/features/purchase-orders/po-preview.tsx")));
const records = d.demoPurchaseOrders();
const draft = () => ({...structuredClone(records[0]),id:"",po_no:"PO-UI-NEW",status:"draft",created_at:"",updated_at:""});
test("PO required inputs, dates, duplicate numbers, decimal quantity and price validation",()=>{
  assert.ok(Object.keys(d.validatePo(d.blankPo(),records)).length>=5);
  const doc=draft();
  assert.deepEqual(d.validatePo(doc,records),{});
  for(const [key,value] of [["po_no",""],["supplier_name_snapshot",""],["warehouse_name",""],["po_date","2026-02-30"],["credit_days","-1"]])
    assert.ok(Object.keys(d.validatePo({...doc,[key]:value},records)).length,key);
  assert.ok(d.validatePo({...doc,po_no:" po-demo-001 "},records).po_no);
  for(const key of ["ordered_qty","unit_price"])
    for(const value of ["","0","-1","NaN","Infinity","1.001"])
      assert.ok(Object.keys(d.validatePo({...doc,items:[{...doc.items[0],[key]:value}]},records)).length);
  assert.ok(Object.keys(d.validatePo({...doc,items:[{...doc.items[0],tax_amount:"-1"}]},records)).length);
});
test("exact mock monetary totals preserve manual tax and do not infer VAT rates",()=>{
  const row={...draft().items[0],ordered_qty:"0.10",unit_price:"0.20",tax_amount:"0.01"};
  assert.equal(d.lineAmount(row),BigInt(2));
  assert.deepEqual(d.poTotals({...draft(),items:[row,row]}),{subtotal:BigInt(4),tax:BigInt(2),total:BigInt(6)});
  assert.equal(d.money(BigInt(123456)),"1,234.56");
  assert.equal(d.lineAmount({...row,ordered_qty:"1.25",unit_price:"12.50"}),BigInt(1563));
  assert.equal(d.lineAmount({...row,discount_amount:"100.00"}),BigInt(0));
  assert.deepEqual(d.poTotals({...draft(),vat_type:"VAT_INCLUDED",items:[row]}),d.poTotals({...draft(),vat_type:"VAT_EXCLUDED",items:[row]}));
});
test("independent row IDs, material and PR pickers preserve snapshots without cross-module writes",()=>{
  const row={...d.blankItem("row-a"),remarks:"preserve"};
  const mapped=d.withMaterial(row,d.demoMaterials[1]);
  assert.equal(mapped.id,"row-a");assert.equal(mapped.remarks,"preserve");
  assert.equal(mapped.material_code_snapshot,d.demoMaterials[1].code);
  assert.equal(mapped.unit_price,"8.00");
  const doc=d.withPr(draft(),"pr-row");
  assert.equal(doc.request_ref_no,d.demoPr.number);assert.equal(doc.items[0].id,"pr-row");
  assert.equal(doc.supplier_id,d.demoPr.supplier.id);
  const second={...mapped,id:"row-b"};
  const multiple={...doc,items:[doc.items[0],second]};
  assert.deepEqual(multiple.items.filter(r=>r.id!=="row-b"),doc.items);
  assert.equal(new Set(multiple.items.map(r=>r.id)).size,2);
});
test("local create/edit retains identity, all editable fields and notes; duplicate/restricted saves fail",()=>{
  const doc=draft();doc.remarks="เอกสารยาว";doc.items[0].remarks="หมายเหตุแถว";doc.items[0].specification="รายละเอียด";doc.items[0].tax_amount="7.25";
  doc.payment_term="เครดิต 15 วัน";doc.credit_days="15";doc.currency_code="EUR";doc.vat_type="VAT_EXCLUDED";
  const before=structuredClone(records);
  const created=d.savePo(records,doc,"local-new","2026-10-26T00:00:00Z");
  assert.ok(created.saved);assert.deepEqual(created.saved.items,doc.items);
  for(const key of ["remarks","payment_term","credit_days","currency_code","vat_type","request_ref_no","warehouse_name","supplier_name_snapshot"])
    assert.equal(created.saved[key],doc[key],key);
  const edited=d.savePo(created.records,{...created.saved,remarks:"แก้ไข"},"unused","2026-10-26T01:00:00Z");
  assert.equal(edited.saved.id,"local-new");assert.equal(edited.saved.created_at,created.saved.created_at);
  assert.equal(edited.records.length,records.length+1);
  assert.equal(d.savePo(created.records,{...doc,po_no:" po-ui-new "},"another","now").saved,null);
  assert.equal(d.savePo(records,{...doc,id:"missing"},"another","now").saved,null);
  assert.equal(d.savePo(records,records[2],"another","now").saved,null);
  assert.deepEqual(records,before);
});
test("mock actions enforce source lifecycle and fail atomically for mixed bulk selection",()=>{
  let current=structuredClone(records), id=current[0].id;
  current=d.transitionPo(current,[id],"submit","now");assert.equal(current[0].status,"pending_approval");
  current=d.transitionPo(current,[id],"approve","now");assert.equal(current[0].status,"approved");
  current=d.transitionPo(current,[id],"cancel","now");assert.equal(current[0].status,"cancelled");
  current=d.transitionPo(current,[id],"delete","now");assert.ok(!current.some(r=>r.id===id));
  assert.throws(()=>d.transitionPo(records,[records[0].id,records[2].id],"submit","now"));
  assert.throws(()=>d.transitionPo(records,["missing"],"cancel","now"));
  assert.equal(d.transitionPo(records,[records[4].id],"close","now")[4].status,"closed");
  assert.equal(d.transitionPo(records,[records[1].id],"return_draft","now")[1].status,"draft");
  assert.equal(d.transitionPo(records,[records[1].id],"reject","now")[1].status,"rejected");
  assert.equal(records[0].status,"draft");
});
test("document number preview is local, monthly, date-based and never consumes a number",()=>{
  const before=structuredClone(records);
  assert.equal(d.previewPoNo("2026-10-26","IT",records),"PO-IT2610001");
  assert.equal(d.previewPoNo("2026-10-26","IT",records),"PO-IT2610001");
  assert.equal(d.previewPoNo("2026-11-01","IT",records),"PO-IT2611001");
  assert.equal(d.previewPoNo("2026-10-26","IT",[...records,{...records[0],po_no:"PO-IT2610001"}]),"PO-IT2610002");
  assert.throws(()=>d.previewPoNo("bad","IT",records));assert.deepEqual(records,before);
});
// Independent manifest from iTech create modal + item table, not from the TypeScript interface.
const headers=["po_date","po_no","supplier_code_snapshot","supplier_name_snapshot","warehouse_code","warehouse_name","request_ref_no","payment_term","credit_days","expected_delivery_date","remarks"];
const rowFields=["material_code_snapshot","material_name_snapshot","specification","ordered_qty","unit_price","tax_amount","unit","expected_delivery_date","remarks"];
test("actual rendered form exposes original PO fields, selectors, independent item controls and errors",()=>{
  const doc=draft();doc.items.push({...doc.items[0],id:"second-row"});
  const html=renderToStaticMarkup(React.createElement(PoForm,{doc,errors:{po_no:"กรุณากรอกเลข"},onChange(){},onSave(){},onCancel(){},onPick(){},onNumber(){}}));
  for(const key of [...headers,...doc.items.flatMap(r=>rowFields.map(key=>`items.${r.id}.${key}`))]) {
    const tag=[...html.matchAll(/<(?:input|textarea)\b[^>]*>/g)].map(m=>m[0]).find(t=>t.includes(`name="${key}"`));
    assert.ok(tag,key);
    if(key==="request_ref_no") assert.match(tag,/readOnly/i,key);
    else assert.doesNotMatch(tag,/\s(?:disabled|readonly)(?:=|\s|>)/i,key);
    assert.ok(html.includes(`for="po-${key}"`),key);
  }
  for(const label of ["สกุลเงิน","ประเภทธุรกรรม","เลือก PR","เลือกผู้ขายตัวอย่าง","เลือกคลังตัวอย่าง","สร้างเลข PO ตัวอย่าง","ยอดรวมสุทธิ"])
    assert.ok(html.includes(label),label);
  assert.match(html,/role="alert"/);assert.match(html,/aria-invalid="true"/);
});
test("preview retains all document/item notes, values and escapes user content",()=>{
  const doc=draft();doc.remarks="<script>not html</script>";doc.items[0].remarks="หมายเหตุสินค้า";doc.items[0].specification="สเปค";doc.items.push({...doc.items[0],id:"second-row",material_name_snapshot:"สินค้าทดสอบแถวสอง"});
  const html=renderToStaticMarkup(React.createElement(PoPaper,{doc}));
  assert.equal((html.match(/data-po-paper-row=/g)||[]).length,2);
  for(const value of [doc.po_no,doc.supplier_name_snapshot,doc.warehouse_name,doc.request_ref_no,"หมายเหตุสินค้า","สเปค","สินค้าทดสอบแถวสอง"])
    assert.ok(html.includes(value),value);
  assert.match(html,/&lt;script&gt;not html&lt;\/script&gt;/);
});
test("PO uses local state only, preserves existing route boundaries and includes discard confirmation",()=>{
  const source=readFileSync(path.join(root,"src/features/purchase-orders/po-workspace.tsx"),"utf8");
  assert.match(source,/useState\(demoPurchaseOrders\)/);assert.match(source,/ละทิ้งข้อมูลที่ยังไม่บันทึก/);
  for(const name of ["po-domain.ts","po-form.tsx","po-workspace.tsx","po-preview.tsx"]) {
    const code=readFileSync(path.join(root,"src/features/purchase-orders",name),"utf8");
    assert.doesNotMatch(code,/fetch\s*\(|\/api\/|localStorage|sessionStorage|from ["'][^"']*server\//);
  }
  assert.match(readFileSync(path.join(root,"app/(factory)/purchase-orders/page.tsx"),"utf8"),/<PurchaseOrdersWorkspace/);
});
test("focused TypeScript checks only the added PO source files",()=>{
  const files=["src/features/purchase-orders/po-domain.ts","src/features/purchase-orders/po-form.tsx","src/features/purchase-orders/po-preview.tsx","src/features/purchase-orders/po-workspace.tsx","app/(factory)/purchase-orders/page.tsx"].map(f=>path.join(root,f));
  const configFile=ts.readConfigFile(path.join(root,"tsconfig.json"),ts.sys.readFile);
  const config=ts.parseJsonConfigFileContent(configFile.config,ts.sys,root);
  const program=ts.createProgram(files,{...config.options,incremental:false,noEmit:true});
  const selected=new Set(files.map(f=>f.replaceAll("\\","/").toLowerCase()));
  const errors=ts.getPreEmitDiagnostics(program).filter(d=>!d.file||selected.has(d.file.fileName.replaceAll("\\","/").toLowerCase()));
  assert.equal(errors.length,0,ts.formatDiagnostics(errors,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> "\n"}));
});

