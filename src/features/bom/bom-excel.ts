import { blankMaster, blankFormula, masterErrors, formulaErrors, productTypes, formulaStatuses, type BOMState, type Master, type Formula, type Component } from "./bom-domain";

export type ImportMode = "master" | "formula";
export type PreviewRow = { key: string; rowNo: number; cells: string[]; errors: string[]; command: { action: "master"; row: Master } | { action: "formula"; row: Formula; default: boolean } | null };
export const masterHeaders = ["รหัสสินค้า", "ชื่อสินค้า / วัตถุดิบ", "ประเภท", "ประเภทการใช้งาน", "หน่วยหลัก", "หมายเหตุ"];
export const formulaHeaders = ["รหัสสินค้า", "รหัสสูตร", "ชื่อสูตร", "เวอร์ชัน", "สถานะ", "วันที่เริ่มใช้", "ปริมาณผลิต", "หน่วยผลิต", "ประเภทส่วนประกอบ", "รหัสวัตถุดิบ", "ชื่อวัตถุดิบ", "จำนวนวัตถุดิบ", "หน่วยวัตถุดิบ", "หมายเหตุ"];
const norm = (s: string) => s.trim().toUpperCase();
function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) return value.richText.map((p: unknown) => typeof p === "object" && p !== null && "text" in p ? cellText(p.text) : "").join("").trim();
  if (typeof value === "object" && "result" in value) throw new Error("ไม่รองรับเซลล์สูตรคำนวณ กรุณาวางเป็นค่าในไฟล์ก่อนนำเข้า");
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text.trim();
  throw new Error("พบชนิดข้อมูล Excel ที่ไม่รองรับ");
}
export function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  const s = source.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') { if (quoted && s[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && s[i + 1] === "\n") i++; row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("เครื่องหมายคำพูดใน CSV ไม่ครบ");
  row.push(cell.trim()); rows.push(row); return rows;
}
export async function readBOMGrid(file: File): Promise<string[][]> {
  if (file.size > 5_000_000) throw new Error("ไฟล์เกิน 5 MB");
  let grid: string[][];
  if (/\.csv$/i.test(file.name)) grid = parseCsv(await file.text());
  else if (/\.xlsx$/i.test(file.name)) {
    const ExcelJS = await import("exceljs"); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    const sheet = wb.worksheets[0]; if (!sheet) throw new Error("ไม่พบแผ่นงาน");
    if (sheet.rowCount > 2001 || sheet.columnCount > 64) throw new Error("ไฟล์มีแถวหรือคอลัมน์เกินกำหนด");
    grid = Array.from({ length: sheet.rowCount }, (_, i) => Array.from({ length: sheet.columnCount }, (_, j) => cellText(sheet.getCell(i + 1, j + 1).value)));
  } else throw new Error("รองรับเฉพาะ .xlsx และ .csv");
  if (grid.length > 2001 || grid.some(r => r.length > 64)) throw new Error("ไฟล์มีแถวหรือคอลัมน์เกินกำหนด");
  return grid;
}
const aliases: Record<string, string[]> = {
  "รหัสสินค้า": ["รหัสสินค้า / วัตถุดิบ", "รหัส", "code", "product_code", "item_code"],
  "ชื่อสินค้า / วัตถุดิบ": ["ชื่อสินค้า", "ชื่อรายการ", "name", "product_name", "item_name"],
  "ประเภท": ["type", "item_type"], "ประเภทการใช้งาน": ["ชื่อกระบวนการ", "กระบวนการ", "usage_type", "process_name"],
  "หน่วยหลัก": ["หน่วย", "unit", "default_unit"], "หมายเหตุ": ["note", "remark", "รายละเอียด"],
  "รหัสสูตร": ["formula_code"], "ชื่อสูตร": ["formula_name"], "เวอร์ชัน": ["version"], "สถานะ": ["status"], "วันที่เริ่มใช้": ["effective_date"], "ปริมาณผลิต": ["batch_size"], "หน่วยผลิต": ["production_unit"],
  "ประเภทส่วนประกอบ": ["ประเภท", "item_role"], "รหัสวัตถุดิบ": ["รหัสวัตถุดิบ/บรรจุภัณฑ์", "รหัสส่วนประกอบ", "material_code"], "ชื่อวัตถุดิบ": ["ชื่อวัตถุดิบ/บรรจุภัณฑ์", "ชื่อส่วนประกอบ", "material_name"], "จำนวนวัตถุดิบ": ["จำนวน", "quantity"], "หน่วยวัตถุดิบ": ["หน่วย", "material_unit"]
};
export function previewBOM(grid: string[][], mode: ImportMode, state: BOMState, expectedMaster?: string): PreviewRow[] {
  const headers = mode === "master" ? masterHeaders : formulaHeaders;
  const required = mode === "master" ? [headers[0], headers[1], headers[2], headers[4]] : ["รหัสสินค้า", "รหัสสูตร", "ชื่อสูตร", "เวอร์ชัน", "ปริมาณผลิต", "หน่วยผลิต", "ประเภทส่วนประกอบ", "รหัสวัตถุดิบ", "จำนวนวัตถุดิบ", "หน่วยวัตถุดิบ"];
  const indexOf = (r: string[], h: string) => r.findIndex(v => [h, ...(aliases[h] ?? [])].some(a => norm(a) === norm(v)));
  const head = grid.findIndex(r => required.every(h => indexOf(r,h) >= 0));
  if (head < 0) throw new Error("หัวคอลัมน์ไม่ครบ กรุณาใช้ฟอร์มที่ดาวน์โหลด (สูตรต้องมีข้อมูลหัวสูตรครบ)");
  const indices = headers.map(h => indexOf(grid[head], h));
  const data = grid.slice(head + 1).map((r,i) => ({rowNo: head + i + 2, cells: indices.map(j => j < 0 ? "" : r[j] ?? "")})).filter(r => r.cells.some(Boolean));
  if (!data.length) throw new Error("ไม่พบข้อมูลสำหรับนำเข้า");
  if (mode === "master") return data.map(({rowNo,cells}) => {
    const [code,name,typeText,usageType,unit,notes] = cells;
    const type = (Object.keys(productTypes) as Master["type"][]).find(k => norm(k) === norm(typeText) || productTypes[k] === typeText);
    const row = {...blankMaster(), code:norm(code), name, type: type ?? "OTHER", usageType, unit, notes};
    const errors = Object.values(masterErrors(state,row));
    if (!type) errors.push("ประเภทไม่ถูกต้อง");
    if (type === "RAW_MATERIAL") errors.push("วัตถุดิบต้องจัดการผ่านทะเบียนตั้งค่าระบบ");
    if (data.filter(x => norm(x.cells[0]) === norm(code)).length > 1) errors.push("รหัสซ้ำภายในไฟล์");
    return {key:String(rowNo),rowNo,cells,errors,command:{action:"master",row}};
  });
  const groups = new Map<string, typeof data>();
  for (const item of data) {const key=JSON.stringify([norm(item.cells[0]),norm(item.cells[3])]);groups.set(key,[...(groups.get(key)??[]),item]);}
  return [...groups.entries()].map(([key,items]) => {
    const first=items[0], [product,code,name,version,statusText,effectiveDate,batch,unit]=first.cells;
    const errors:string[]=[];
    const master=state.masters.find(m=>norm(m.code)===norm(product));
    if (!master) errors.push("ไม่พบรหัสสินค้า");
    if (expectedMaster && master?.id !== expectedMaster) errors.push("รหัสสินค้าไม่ตรงกับรายการที่เลือก");
    const status=(Object.keys(formulaStatuses) as Formula["status"][]).find(k=>norm(k)===norm(statusText)||formulaStatuses[k]===statusText);
    if (statusText && !status) errors.push("สถานะไม่ถูกต้อง");
    const ingredients:Component[]=[],packaging:Component[]=[];
    for(const item of items){
      if (JSON.stringify(item.cells.slice(0,8))!==JSON.stringify(first.cells.slice(0,8))) errors.push(`แถว ${item.rowNo}: ข้อมูลหัวสูตรไม่ตรงกัน`);
      const [, , , , , , , , role,materialCode,,quantity,materialUnit,remarks]=item.cells;
      const material=state.masters.find(m=>norm(m.code)===norm(materialCode));
      const pack=["PACKAGING","บรรจุภัณฑ์"].includes(norm(role));
      if (!pack && !["RAW_MATERIAL","วัตถุดิบ"].includes(norm(role))) errors.push(`แถว ${item.rowNo}: ประเภทส่วนประกอบไม่ถูกต้อง`);
      if (!material || material.usageType === "ปิดใช้งาน") errors.push(`แถว ${item.rowNo}: ไม่พบวัสดุที่เปิดใช้งาน ${materialCode}`);
      if (!quantity || !Number.isFinite(Number(quantity)) || Number(quantity)<=0) errors.push(`แถว ${item.rowNo}: จำนวนไม่ถูกต้อง`);
      (pack?packaging:ingredients).push({materialId:material?.id??"",quantity:Number(quantity),unit:materialUnit,remarks});
    }
    let command:PreviewRow["command"]=null;
    if(master){const row:Formula={...blankFormula(master),code:norm(code),name,version:norm(version),status:status??"DRAFT",effectiveDate,batchSize:Number(batch),unit,ingredients,packaging};
      errors.push(...Object.values(formulaErrors(state,row,false)));
      if (row.batchSize===1000 && ["T","TON","TONNE","ตัน"].includes(norm(unit))) errors.push("สูตรต่อหนึ่งตันต้องระบุ 1 ตัน ไม่ใช่ 1,000 ตัน");
      command={action:"formula",row,default:false};
    }
    return {key,rowNo:first.rowNo,cells:[product,code,name,version,statusText||"ร่าง",`${batch} ${unit}`,`${ingredients.length} วัตถุดิบ / ${packaging.length} บรรจุภัณฑ์`],errors:[...new Set(errors)],command};
  });
}
export async function downloadBOMTemplate(mode: ImportMode) {
  const ExcelJS=await import("exceljs"); const wb=new ExcelJS.Workbook(); const sheet=wb.addWorksheet(mode==="master"?"รายการหลัก":"สูตร BOM");
  const headers=mode==="master"?masterHeaders:formulaHeaders;
  sheet.columns=headers.map(header=>({header,width:Math.max(18,header.length+6)}));
  sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}}; sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF173B63"}};
  sheet.views=[{state:"frozen",ySplit:1}];
  const bytes=await wb.xlsx.writeBuffer(); const blob=new Blob([new Uint8Array(bytes)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=mode==="master"?"bom-master-import-template.xlsx":"bom-formula-import-example.xlsx"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
