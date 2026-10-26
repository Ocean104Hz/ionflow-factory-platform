"use client";
import { useState } from "react";
import { Copy, Eye, MoreHorizontal, Pencil, Plus, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/src/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { PageHeader, SectionCard, StatusBadge, SelectField, FactoryDataTable, Pagination } from "@/src/components/factory/patterns";
import { PoForm, type PickerKind } from "./po-form";
import { PoPreview } from "./po-preview";
import { allowedActions, blankItem, blankPo, demoMaterials, demoPr, demoPurchaseOrders, demoSuppliers, demoWarehouses, money, poStatuses, poTotals, previewPoNo, savePo, transitionPo, withMaterial, withPr, type MasterOption, type PoAction, type PoErrors, type PurchaseOrder } from "./po-domain";

const actionLabels: Record<PoAction,string> = { submit:"ส่งอนุมัติ", approve:"อนุมัติ", reject:"ไม่อนุมัติ", return_draft:"คืนร่าง", cancel:"ยกเลิกเอกสาร", close:"ปิดเอกสาร", delete:"ลบ" };
const tabs = [{ value:"all",label:"ทั้งหมด" },{ value:"draft",label:"ร่าง" },{ value:"pending_approval",label:"รออนุมัติ" },{ value:"receivable",label:"รอรับสินค้า" },{ value:"approved",label:"อนุมัติแล้ว" },{ value:"received",label:"รับเข้าแล้ว" },{ value:"rejected",label:"ไม่อนุมัติ" },{ value:"cancelled",label:"ยกเลิก" },{ value:"closed",label:"ปิดเอกสาร" }];
function matchesStatus(doc: PurchaseOrder,status: string) {
  if (status === "all") return true;
  if (status === "receivable") return ["approved","partial_received"].includes(doc.status);
  return status === "received" ? ["received","partial_received"].includes(doc.status) : doc.status === status;
}
function localDay() { return new Intl.DateTimeFormat("en-CA",{ timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date()); }
type Editor = { doc: PurchaseOrder; baseline: string; mode: "create" | "edit" | "view" };
export function PurchaseOrdersWorkspace() {
  const [records,setRecords] = useState(demoPurchaseOrders);
  const [search,setSearch] = useState(""), [prSearch,setPrSearch] = useState(""), [status,setStatus] = useState("all"), [page,setPage] = useState(1), [pageSize,setPageSize] = useState(10);
  const [selected,setSelected] = useState<string[]>([]), [message,setMessage] = useState("");
  const [editor,setEditor] = useState<Editor | null>(null), [errors,setErrors] = useState<PoErrors>({});
  const [picker,setPicker] = useState<{kind:PickerKind;rowId?:string}|null>(null);
  const [suppliers,setSuppliers] = useState(demoSuppliers), [warehouses,setWarehouses] = useState(demoWarehouses);
  const [preview,setPreview] = useState<string[]>([]), [numberOpen,setNumberOpen] = useState(false), [department,setDepartment] = useState("IT");
  const [confirmation,setConfirmation] = useState<{ title:string; description:string; run:()=>void }|null>(null);
  const filtered = records.filter((r) => matchesStatus(r,status) && `${r.po_no} ${r.supplier_name_snapshot} ${r.warehouse_name} ${r.items.map((x)=>x.material_name_snapshot).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  const safePage = Math.min(page,Math.max(1,Math.ceil(filtered.length/pageSize))), visible = filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  const selection = records.filter((r) => selected.includes(r.id));
  function open(doc: PurchaseOrder,mode: Editor["mode"]) { const clone = structuredClone(doc); setEditor({doc:clone,baseline:JSON.stringify(clone),mode}); setErrors({}); }
  function closeEditor() {
    if (editor && editor.mode !== "view" && JSON.stringify(editor.doc) !== editor.baseline) setConfirmation({title:"ละทิ้งข้อมูลที่ยังไม่บันทึก?",description:"เอกสารตัวอย่างที่บันทึกไว้จะไม่เปลี่ยน",run:()=>{setEditor(null);setErrors({});}});
    else setEditor(null);
  }
  function save(submit: boolean) {
    if (!editor || editor.mode === "view") return;
    const result = savePo(records,editor.doc,crypto.randomUUID(),new Date().toISOString(),submit);
    setErrors(result.errors);
    if (!result.saved) return;
    setRecords(result.records); setEditor(null);
    setMessage(submit ? "บันทึกและเปลี่ยนเป็นรออนุมัติตัวอย่างแล้ว · ไม่มีการอนุมัติหรือส่งข้อมูลจริง" : "บันทึกข้อมูลตัวอย่างแล้ว · รีโหลดหน้านี้จะคืน fixtures เริ่มต้น");
  }
  function requestAction(ids: string[],action: PoAction) {
    setConfirmation({ title:`${actionLabels[action]}ข้อมูลตัวอย่าง?`,description:`${ids.length} เอกสาร · เปลี่ยนเฉพาะ React state ของหน้า PO ไม่ทำรายการซื้อ รับเข้า หรือเปลี่ยนสต็อกจริง`,run:()=>{
      try { setRecords(transitionPo(records,ids,action,new Date().toISOString())); setSelected([]); setMessage(`${actionLabels[action]}ข้อมูลตัวอย่างแล้ว · ไม่กระทบข้อมูลโมดูลอื่น`); }
      catch(e) { setMessage(e instanceof Error ? e.message : "เปลี่ยนข้อมูลตัวอย่างไม่ได้"); }
    }});
  }
  function copy(doc: PurchaseOrder) {
    open({ ...structuredClone(doc),id:"",po_no:"",po_date:localDay(),status:"draft",created_at:"",updated_at:"",items:doc.items.map((r)=>({...r,id:crypto.randomUUID(),received_qty:"0"})) },"create");
  }
  function applyMaster(option: MasterOption) {
    if (!editor || !picker) return;
    const doc = editor.doc;
    const next = picker.kind === "supplier" ? {...doc,supplier_id:option.id,supplier_code_snapshot:option.code,supplier_name_snapshot:option.name}
      : picker.kind === "warehouse" ? {...doc,warehouse_code:option.code,warehouse_name:option.name}
      : {...doc,items:doc.items.map((r)=>r.id===picker.rowId?withMaterial(r,option):r)};
    setEditor({...editor,doc:next}); setPicker(null);
  }
  let proposedNumber = "";
  if (editor) { try { proposedNumber = previewPoNo(editor.doc.po_date,department,records); } catch {} }
  return <div className="min-w-0 space-y-5">
    <PageHeader title="PO · ใบสั่งซื้อ" description="ติดตามใบสั่งซื้อและทดลองจัดทำเอกสารตามแบบ iTech" actions={<><StatusBadge tone="info">UI MOCK · ไม่เชื่อม API</StatusBadge><Button onClick={()=>open({...blankPo(localDay()),items:[blankItem(crypto.randomUUID())]},"create")}><Plus aria-hidden="true" />สร้างใบสั่งซื้อ</Button></>} />
    {message && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</p>}
    <SectionCard title="ติดตามใบสั่งซื้อ" subtitle="ข้อมูลทุกแถวเป็นตัวอย่าง · ไม่ใช้เป็นเอกสารทางธุรกิจจริง">
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_160px_auto]">
        <div className="grid gap-2"><Label htmlFor="po-search">ค้นหาเลขที่ PO / ผู้ขาย / คลัง / สินค้า</Label><Input id="po-search" value={search} onChange={(e)=>{setSearch(e.target.value);setPage(1);}} placeholder="เลขที่ PO / Supplier / คลัง" /></div>
        <SelectField label="รายการต่อหน้า" value={String(pageSize)} onChange={(value)=>{setPageSize(Number(value));setPage(1);}} options={[5,10,20,100].map((n)=>({value:String(n),label:n===100?"ทั้งหมด (สูงสุด 100)":`${n} รายการ`}))} />
        <Button variant="outline" className="self-end" onClick={()=>{setSearch("");setStatus("all");setPage(1);setSelected([]);}}><RotateCcw aria-hidden="true" />รีเซ็ตตัวกรอง</Button>
      </div>
      <Tabs value={status} onValueChange={(value)=>{setStatus(value);setPage(1);}}><TabsList aria-label="สถานะใบสั่งซื้อ" className="h-auto w-full flex-wrap justify-start gap-1">{tabs.map((t)=><TabsTrigger key={t.value} value={t.value}>{t.label} ({records.filter((r)=>matchesStatus(r,t.value)).length})</TabsTrigger>)}</TabsList></Tabs>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Checkbox id="po-select-page" aria-label="เลือกเอกสารในหน้านี้ทั้งหมด" checked={visible.length>0 && visible.every((r)=>selected.includes(r.id))} onCheckedChange={(checked)=>setSelected(checked===true?[...new Set([...selected,...visible.map((r)=>r.id)])]:selected.filter((id)=>!visible.some((r)=>r.id===id)))} /><Label htmlFor="po-select-page">เลือกในหน้านี้ · เลือกแล้ว {selection.length}</Label></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!selection.length} onClick={()=>setPreview(selected)}><Printer aria-hidden="true" />พรีวิวที่เลือก</Button><Button variant="outline" disabled title="ยังไม่เชื่อม Excel ใน UI phase">นำเข้า / ส่งออก Excel · ยังไม่เชื่อม</Button></div>
      </div>
      {!!selection.length && <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(actionLabels) as PoAction[]).filter((action)=>selection.every((r)=>allowedActions(r.status).includes(action))).map((action)=><Button key={action} size="sm" variant="outline" onClick={()=>requestAction(selected,action)}>{actionLabels[action]}ตัวอย่างที่เลือก</Button>)}</div>}
      <FactoryDataTable rows={visible} rowKey={(r)=>r.id} minWidth={1150} columns={[
        {key:"select",label:"เลือก",render:(r)=><Checkbox aria-label={`เลือก ${r.po_no}`} checked={selected.includes(r.id)} onCheckedChange={(checked)=>setSelected(checked===true?[...selected.filter((id)=>id!==r.id),r.id]:selected.filter((id)=>id!==r.id))} />},
        {key:"date",label:"วันที่เอกสาร",render:(r)=>r.po_date},
        {key:"number",label:"เลขที่ PO",render:(r)=><Button variant="link" className="h-auto p-0" onClick={()=>open(r,"view")}>{r.po_no}</Button>},
        {key:"supplier",label:"ผู้ขาย",render:(r)=><p className="max-w-52 whitespace-normal break-words">{r.supplier_name_snapshot}</p>},
        {key:"warehouse",label:"คลัง / Site",render:(r)=>r.warehouse_name},
        {key:"items",label:"รายการสินค้า",render:(r)=><p className="max-w-52 whitespace-normal break-words">{r.items.map((i)=>i.material_name_snapshot).join(" / ")}</p>},
        {key:"total",label:"ยอดรวม",numeric:true,render:(r)=>`${money(poTotals(r).total)} ${r.currency_code}`},
        {key:"status",label:"สถานะจำลอง",render:(r)=><StatusBadge tone={r.status==="approved"||r.status==="received"?"success":r.status==="pending_approval"?"warning":"neutral"}>{poStatuses[r.status]}</StatusBadge>},
        {key:"delivery",label:"กำหนดส่ง",render:(r)=>r.expected_delivery_date||"—"},
        {key:"manage",label:"จัดการ",render:(r)=><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`จัดการ ${r.po_no}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>open(r,"view")}><Eye aria-hidden="true" />ดูรายละเอียด</DropdownMenuItem><DropdownMenuItem onSelect={()=>copy(r)}><Copy aria-hidden="true" />คัดลอกเป็นเอกสารใหม่</DropdownMenuItem>{["draft","rejected"].includes(r.status)&&<DropdownMenuItem onSelect={()=>open(r,"edit")}><Pencil aria-hidden="true" />แก้ไข</DropdownMenuItem>}<DropdownMenuItem onSelect={()=>setPreview([r.id])}><Printer aria-hidden="true" />พรีวิว / พิมพ์</DropdownMenuItem>{allowedActions(r.status).map((action)=><DropdownMenuItem key={action} onSelect={()=>requestAction([r.id],action)}>{actionLabels[action]}ตัวอย่าง</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>},
      ]} pagination={<Pagination page={safePage} pageSize={pageSize} total={filtered.length} onChange={setPage} />} />
    </SectionCard>
    <p className="text-xs text-muted-foreground">UI + React state เท่านั้น · รีโหลดหรือออกจากหน้านี้ข้อมูลอาจกลับเป็นตัวอย่างเริ่มต้น · ไม่ใช้สิทธิ์หรืออนุมัติจริง ไม่เปลี่ยนคลัง PR หรือสต็อก</p>
    <Dialog open={!!editor} onOpenChange={(open)=>{if(!open)closeEditor();}}><DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-6xl"><DialogHeader><DialogTitle>{editor?.mode==="view"?"รายละเอียดใบสั่งซื้อ":editor?.mode==="edit"?"แก้ไขใบสั่งซื้อ":"สร้างใบสั่งซื้อ"}</DialogTitle><DialogDescription>UI DEMO · ข้อมูลเก็บเฉพาะในหน้านี้ ไม่เชื่อมระบบจัดซื้อจริง</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto pr-1">{editor&&<PoForm doc={editor.doc} errors={errors} readOnly={editor.mode==="view"} onChange={(doc)=>setEditor({...editor,doc})} onSave={save} onCancel={closeEditor} onPick={(kind,rowId)=>setPicker({kind,rowId})} onNumber={()=>setNumberOpen(true)} />}</div></DialogContent></Dialog>
    {picker&&picker.kind!=="pr"&&<PoMasterPicker kind={picker.kind} options={picker.kind==="supplier"?suppliers:picker.kind==="warehouse"?warehouses:demoMaterials} onClose={()=>setPicker(null)} onSelect={applyMaster} onAdd={picker.kind==="supplier"?(item)=>setSuppliers([...suppliers,item]):picker.kind==="warehouse"?(item)=>setWarehouses([...warehouses,item]):undefined} />}
    <Dialog open={picker?.kind==="pr"} onOpenChange={(open)=>{if(!open)setPicker(null);}}><DialogContent><DialogHeader><DialogTitle>เลือกใบขอซื้อ (PR) ตัวอย่าง</DialogTitle><DialogDescription>ไม่อ่านหรือแก้ไข PR จริง · การเลือกจะแทนที่ผู้ขาย คลัง และรายการในฟอร์มนี้หลังยืนยัน</DialogDescription></DialogHeader><Label htmlFor="po-pr-search">ค้นหา PR ตัวอย่าง</Label><Input id="po-pr-search" value={prSearch} onChange={(event)=>setPrSearch(event.target.value)} />{`${demoPr.number} ${demoPr.supplier.name}`.toLowerCase().includes(prSearch.toLowerCase())?<Button variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={()=>setConfirmation({title:"ใช้ข้อมูล PR ตัวอย่างนี้?",description:"รายการที่กรอกในฟอร์มจะถูกแทนที่ด้วยรายการตัวอย่างจาก PR",run:()=>{if(editor)setEditor({...editor,doc:withPr(editor.doc,crypto.randomUUID())});setPicker(null);}})}>{demoPr.number} · {demoPr.supplier.name}</Button>:<p className="text-sm text-muted-foreground">ไม่พบ PR ตัวอย่าง</p>}</DialogContent></Dialog>
    <Dialog open={numberOpen} onOpenChange={setNumberOpen}><DialogContent><DialogHeader><DialogTitle>สร้างเลข PO ตัวอย่าง</DialogTitle><DialogDescription>ใช้เดือนของวันที่เอกสาร · พรีวิวไม่ใช้เลขและไม่จองเลขจริง · ตรวจซ้ำตอนบันทึก</DialogDescription></DialogHeader><SelectField label="รหัสแผนกตัวอย่าง" value={department} onChange={setDepartment} options={[{value:"IT",label:"IT · ตัวอย่าง"},{value:"QA",label:"QA · ตัวอย่าง"}]} /><p>วันที่เอกสาร: {editor?.doc.po_date||"ยังไม่ระบุ"}</p><p role="status" className="break-all rounded-lg border bg-muted p-4 font-semibold">{proposedNumber||"กรุณาระบุวันที่เอกสารที่ถูกต้องก่อน"}</p><DialogFooter><Button variant="outline" onClick={()=>setNumberOpen(false)}>ยกเลิก</Button><Button disabled={!proposedNumber} onClick={()=>{if(editor)setEditor({...editor,doc:{...editor.doc,po_no:proposedNumber}});setNumberOpen(false);}}>ใช้เลขตัวอย่างนี้</Button></DialogFooter></DialogContent></Dialog>
    <PoPreview docs={records.filter((r)=>preview.includes(r.id))} onClose={()=>setPreview([])} />
    <AlertDialog open={!!confirmation} onOpenChange={(open)=>{if(!open)setConfirmation(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>{confirmation?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={()=>{confirmation?.run();setConfirmation(null);}}>ยืนยัน</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function PoMasterPicker({ kind,options,onSelect,onClose,onAdd }: { kind: Exclude<PickerKind,"pr">; options: MasterOption[]; onSelect:(item:MasterOption)=>void; onClose:()=>void; onAdd?: (item:MasterOption)=>void }) {
  const [search,setSearch] = useState(""), [adding,setAdding] = useState(false), [code,setCode] = useState(""), [name,setName] = useState(""), [error,setError] = useState("");
  const [details,setDetails] = useState({ contact_name:"",phone:"",address:"",site_name:"",note:"" });
  const label = {supplier:"ผู้ขาย",warehouse:"คลัง / Site",material:"วัตถุดิบ"}[kind];
  const found = options.filter((r)=>`${r.code} ${r.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Dialog open onOpenChange={(open)=>{if(!open)onClose();}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>เลือก{label}ตัวอย่าง</DialogTitle><DialogDescription>ข้อมูลแยกภายในหน้า PO ไม่อ่านหรือสร้าง master data จริง</DialogDescription></DialogHeader><Label htmlFor="po-master-search">ค้นหารหัส / ชื่อ</Label><Input id="po-master-search" value={search} onChange={(e)=>setSearch(e.target.value)} />
    {found.map((row)=><Button key={row.id} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={()=>onSelect(row)}>{row.code} · {row.name}</Button>)}{!found.length&&<p className="text-sm text-muted-foreground">ไม่พบข้อมูลตัวอย่าง</p>}
    {onAdd&&<><Button variant="outline" onClick={()=>setAdding(!adding)}>เพิ่ม{label}ตัวอย่างเฉพาะหน้านี้</Button>{adding&&<form className="space-y-3 rounded-lg border p-4" onSubmit={(event)=>{event.preventDefault();if(!code.trim()||!name.trim()){setError("กรุณากรอกรหัสและชื่อ");return;}if(options.some((r)=>r.code.toLowerCase()===code.trim().toLowerCase())){setError("รหัสซ้ำ");return;}const item={id:`demo-custom-${crypto.randomUUID()}`,code:code.trim(),name:name.trim(),...details};onAdd(item);onSelect(item);}}><Label htmlFor="po-master-code">รหัส</Label><Input id="po-master-code" value={code} onChange={(e)=>setCode(e.target.value)} /><Label htmlFor="po-master-name">ชื่อ</Label><Input id="po-master-name" value={name} onChange={(e)=>setName(e.target.value)} />{(kind==="supplier"?([['contact_name','ผู้ติดต่อ'],['phone','เบอร์โทร'],['address','ที่อยู่']] as const):([['site_name','ชื่อ Site'],['note','หมายเหตุ']] as const)).map(([key,label])=><div key={key} className="grid gap-2"><Label htmlFor={`po-master-${key}`}>{label}</Label><Input id={`po-master-${key}`} value={details[key]} onChange={(event)=>setDetails({...details,[key]:event.target.value})} /></div>)}{error&&<p role="alert" className="text-sm text-danger">{error}</p>}<Button type="submit">ใช้ข้อมูลตัวอย่างนี้</Button></form>}</>}
  </DialogContent></Dialog>;
}
