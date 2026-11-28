"use client";
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/src/components/ui/dialog";
import { useBOM } from "./bom-provider";
import { downloadBOMTemplate, readBOMGrid, previewBOM, masterHeaders, type ImportMode, type PreviewRow } from "./bom-excel";

export function BOMExcelActions({masterId, onImported}: {masterId?:string; onImported:()=>void}) {
  const {state, loading, error, importBatch}=useBOM();
  const masterInput=useRef<HTMLInputElement>(null), formulaInput=useRef<HTMLInputElement>(null);
  const [mode,setMode]=useState<ImportMode>("master"); const [rows,setRows]=useState<PreviewRow[]>([]); const [selected,setSelected]=useState<string[]>([]);
  const [filename,setFilename]=useState(""); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false); const [issue,setIssue]=useState("");
  async function read(file:File|undefined, kind:ImportMode){
    if(!file||busy)return; setBusy(true);setIssue("");
    try{const parsed=previewBOM(await readBOMGrid(file),kind,state,masterId);setMode(kind);setRows(parsed);setSelected(parsed.filter(r=>!r.errors.length&&r.command).map(r=>r.key));setFilename(file.name);setOpen(true);}catch(e){setIssue(e instanceof Error?e.message:"อ่านไฟล์ไม่สำเร็จ");}finally{setBusy(false);}
  }
  async function download(kind:ImportMode){setIssue("");try{await downloadBOMTemplate(kind);}catch(e){setIssue(e instanceof Error?e.message:"ดาวน์โหลดไม่สำเร็จ");}}
  const valid=rows.filter(r=>!r.errors.length&&r.command); const chosen=valid.filter(r=>selected.includes(r.key));
  async function confirm(){if(busy||!chosen.length)return;setBusy(true);setIssue("");try{const commands=chosen.flatMap(r=>r.command?[r.command]:[]);await importBatch(commands);setOpen(false);setRows([]);setSelected([]);onImported();}catch(e){setIssue(e instanceof Error?e.message:"นำเข้าไม่สำเร็จ");}finally{setBusy(false);}}
  const headers=mode==="master"?masterHeaders:["รหัสสินค้า","รหัสสูตร","ชื่อสูตร","เวอร์ชัน","สถานะ","ปริมาณผลิต","ส่วนประกอบ"];
  const height=masterId?"h-10":"h-12";
  return <>
    <input ref={masterInput} type="file" accept=".xlsx,.csv" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";void read(file,"master");}} />
    <input ref={formulaInput} type="file" accept=".xlsx,.csv" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value="";void read(file,"formula");}} />
    <Button type="button" variant="outline" className={`${height} rounded-xl text-primary`} disabled={busy} onClick={()=>void download(masterId?"formula":"master")}><Download/>ดาวน์โหลดฟอร์ม</Button>
    {!masterId&&<Button type="button" variant="outline" className={`${height} rounded-xl factory-itech-button-outline`} disabled={busy||loading||Boolean(error)} onClick={()=>masterInput.current?.click()}><Upload/>นำเข้ารายการหลัก</Button>}
    <Button type="button" variant="outline" className={`${height} rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-200`} disabled={busy||loading||Boolean(error)} onClick={()=>formulaInput.current?.click()}><Upload/>{masterId?"นำเข้า Excel":"นำเข้าสูตรภายหลัง"}</Button>
    {!masterId&&<Button type="button" variant="outline" className={`${height} rounded-xl`} disabled={busy} onClick={()=>void download("formula")}><Download/>ฟอร์มสูตร</Button>}
    {!open&&issue&&<p role="alert" className="w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{issue}</p>}
    <Dialog open={open} onOpenChange={next=>{if(!busy)setOpen(next);}}>
      <DialogContent className="factory-itech-theme flex max-h-[92dvh] w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-7xl" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onInteractOutside={e=>{if(busy)e.preventDefault();}}>
        <DialogHeader className="border-b px-6 py-5 pr-14"><DialogTitle className="text-xl font-bold text-primary">{mode==="master"?"ตรวจสอบข้อมูลนำเข้า Excel":"ตรวจสอบสูตรจาก Excel"}</DialogTitle><DialogDescription>{filename} · ตรวจสอบข้อมูลก่อนกดบันทึก</DialogDescription></DialogHeader>
        <div className="flex flex-wrap gap-2 border-b bg-muted/40 px-6 py-3 text-xs font-semibold"><span className="rounded-full bg-primary/5 px-3 py-1">ทั้งหมด {rows.length} รายการ</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">พร้อมนำเข้า {valid.length} รายการ</span><span className="rounded-full bg-rose-50 px-3 py-1 text-rose-700">ต้องแก้ไข {rows.length-valid.length} รายการ</span><span className="rounded-full bg-primary/5 px-3 py-1">เลือกแล้ว {chosen.length} รายการ</span></div>
        <div className="min-h-0 max-h-[58vh] overflow-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="sticky top-0 bg-[#173b63] text-xs text-white"><tr><th className="px-4 py-3"><input type="checkbox" aria-label="เลือกข้อมูลที่ถูกต้องทั้งหมด" disabled={busy} checked={valid.length>0&&chosen.length===valid.length} onChange={()=>setSelected(chosen.length===valid.length?[]:valid.map(r=>r.key))}/></th><th className="px-4 py-3">แถว</th>{headers.map(h=><th className="px-4 py-3" key={h}>{h}</th>)}<th className="px-4 py-3">ผลตรวจสอบ</th></tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.key} className={r.errors.length?"bg-rose-50/40 dark:bg-rose-950/20":"bg-card"}><td className="px-4 py-3"><input type="checkbox" aria-label={`เลือกแถว ${r.rowNo}`} disabled={busy||!!r.errors.length||!r.command} checked={selected.includes(r.key)} onChange={()=>setSelected(old=>old.includes(r.key)?old.filter(k=>k!==r.key):[...old,r.key])}/></td><td className="px-4 py-3">{r.rowNo}</td>{r.cells.map((c,i)=><td className="px-4 py-3" key={i}>{c||"-"}</td>)}<td className="px-4 py-3 text-xs font-semibold">{r.errors.length?<span className="text-rose-600">{r.errors.join(", ")}</span>:<span className="text-emerald-700">พร้อมนำเข้า</span>}</td></tr>)}</tbody></table></div>
        {issue&&<p role="alert" className="px-6 py-3 text-sm text-rose-600">{issue}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4"><p className="text-xs text-muted-foreground">แถวที่มีข้อผิดพลาดจะไม่สามารถเลือกนำเข้าได้ (สูงสุด 100 รายการต่อครั้ง)</p><div className="flex gap-3"><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>ยกเลิก</Button><Button type="button" className="factory-itech-button-primary" disabled={busy||!chosen.length||chosen.length>100} onClick={()=>void confirm()}>{busy?"กำลังบันทึก...":`บันทึก ${chosen.length} ${mode==="master"?"รายการ":"สูตร"}`}</Button></div></div>
      </DialogContent>
    </Dialog>
  </>;
}
