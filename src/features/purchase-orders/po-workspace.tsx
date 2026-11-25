"use client";
import { useState } from "react";
import { Copy, Eye, Pencil, Plus, Printer, RotateCcw } from "lucide-react";
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
import { usePR } from "../purchase-requisitions/pr-provider";
import { remainingQuantity } from "../purchase-requisitions/pr-domain";
import { useMasterData } from "../master-data/master-provider";
import { allowedActions, blankItem, blankPo, money, poStatuses, poTotals, previewPoNo, savePo, withMaterial, type MasterOption, type PoAction, type PoErrors, type PurchaseOrder } from "./po-domain";

const actionLabels: Record<PoAction,string> = { submit:"ส่งอนุมัติ", approve:"อนุมัติ", reject:"ไม่อนุมัติ", return_draft:"คืนร่าง", cancel:"ยกเลิกเอกสาร", close:"ปิดเอกสาร", delete:"ลบ" };
const tabs = [{ value:"all",label:"ทั้งหมด" },{ value:"draft",label:"ร่าง" },{ value:"pending_approval",label:"รออนุมัติ" },{ value:"receivable",label:"รอรับสินค้า" },{ value:"approved",label:"อนุมัติแล้ว" },{ value:"received",label:"รับเข้าแล้ว" },{ value:"rejected",label:"ไม่อนุมัติ" },{ value:"cancelled",label:"ยกเลิก" },{ value:"closed",label:"ปิดเอกสาร" }];
function matchesStatus(doc: PurchaseOrder,status: string) {
  if (status === "all") return true;
  if (status === "receivable") return ["approved","partial_received"].includes(doc.status);
  return status === "received" ? ["received","partial_received"].includes(doc.status) : doc.status === status;
}
function localDay() { return new Intl.DateTimeFormat("en-CA",{ timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date()); }
type Editor = { doc: PurchaseOrder; baseline: string; mode: "create" | "edit" | "view" };
export function PurchaseOrdersWorkspace({ initialPr = "" }: { initialPr?: string }) {
  const { loading, loadError, retry } = usePR();
  const masters = useMasterData();
  if (loading || masters.loading) return <p role="status">กำลังโหลดใบสั่งซื้อและข้อมูลหลัก…</p>;
  if (loadError || masters.loadError) return <div><p role="alert">{loadError || masters.loadError}</p><Button onClick={loadError ? retry : masters.retry}>ลองอีกครั้ง</Button></div>;
  return <PurchaseOrdersContent initialPr={initialPr} />;
}

function PurchaseOrdersContent({ initialPr }: { initialPr: string }) {
  const { pos: records, references, canApprove, savePO, actPO } = usePR();
  const { state } = useMasterData();
  const departments = state.rows.filter((row) => row.kind === "departments" && row.active && /^[A-Z0-9]{1,8}$/.test(row.code));
  const suppliers: MasterOption[] = state.rows.filter((row) => row.kind === "suppliers" && row.active);
  const warehouses: MasterOption[] = state.rows.filter((row) => row.kind === "warehouses" && row.active);
  const materials = state.rows.filter((row) => row.kind === "materials" && row.active)
    .flatMap((row) => {
      const unit = state.rows.find((master) => master.kind === "units" && master.active && master.id === row.typeId);
      return unit ? [{ id: row.id, code: row.code, name: row.name, unit: unit.name }] : [];
    });
  const availablePR = references.filter((pr) => pr.items.some((line) => remainingQuantity(line) > 0));

  function fromPR(doc: PurchaseOrder, pr: (typeof references)[number]): PurchaseOrder {
    const remaining = pr.items.filter((line) => remainingQuantity(line) > 0);
    const supplier = suppliers.find((row) => row.code === remaining[0]?.supplierCode);
    const warehouse = warehouses.find((row) => row.code === pr.warehouseCode);
    const items = remaining.filter((line) => line.supplierCode === (remaining[0]?.supplierCode ?? "")).map((line) => {
      const material = materials.find((row) => row.code === line.code);
      return {
        ...blankItem(crypto.randomUUID()), request_ref_item_id: line.id,
        raw_material_id: material?.id ?? "", material_code_snapshot: line.code, material_name_snapshot: line.name,
        specification: line.specification, unit: line.unit, ordered_qty: String(remainingQuantity(line)),
        unit_price: line.price === null ? "" : String(line.price), expected_delivery_date: pr.neededDate,
      };
    });
    return { ...doc, request_ref_id: pr.id, request_ref_no: pr.number,
      supplier_id: supplier?.id ?? "", supplier_code_snapshot: supplier?.code ?? "", supplier_name_snapshot: supplier?.name ?? "",
      warehouse_code: pr.warehouseCode, warehouse_name: warehouse?.name ?? "", expected_delivery_date: pr.neededDate, items };
  }
  const [search,setSearch] = useState(""), [prSearch,setPrSearch] = useState(""), [status,setStatus] = useState("all"), [page,setPage] = useState(1), [pageSize,setPageSize] = useState(10);
  const [selected,setSelected] = useState<string[]>([]), [message,setMessage] = useState("");
  const [editor,setEditor] = useState<Editor | null>(() => {
    const pr = availablePR.find((reference) => reference.id === initialPr);
    if (!pr) return null;
    const doc = fromPR(blankPo(localDay()), pr);
    return { doc, baseline: JSON.stringify(doc), mode: "create" };
  });
  const [errors,setErrors] = useState<PoErrors>({});
  const [busy,setBusy] = useState(false);
  const [picker,setPicker] = useState<{kind:PickerKind;rowId?:string}|null>(null);
  const [preview,setPreview] = useState<string[]>([]), [numberOpen,setNumberOpen] = useState(false), [department,setDepartment] = useState(departments[0]?.code ?? "none");
  const [confirmation,setConfirmation] = useState<{ title:string; description:string; run:()=>void | Promise<void> }|null>(null);
  const filtered = records.filter((r) => matchesStatus(r,status) && `${r.po_no} ${r.supplier_name_snapshot} ${r.warehouse_name} ${r.items.map((x)=>x.material_name_snapshot).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  const safePage = Math.min(page,Math.max(1,Math.ceil(filtered.length/pageSize))), visible = filtered.slice((safePage-1)*pageSize,safePage*pageSize);
  const selection = records.filter((r) => selected.includes(r.id));
  const permittedActions = (status: PurchaseOrder["status"]) => allowedActions(status).filter((action) => canApprove || !["approve", "reject", "return_draft"].includes(action));
  function open(doc: PurchaseOrder,mode: Editor["mode"]) { const clone = structuredClone(doc); setEditor({doc:clone,baseline:JSON.stringify(clone),mode}); setErrors({}); }
  function closeEditor() {
    if (busy) return;
    if (editor && editor.mode !== "view" && JSON.stringify(editor.doc) !== editor.baseline) setConfirmation({title:"ละทิ้งข้อมูลที่ยังไม่บันทึก?",description:"เอกสารที่บันทึกไว้จะไม่เปลี่ยน",run:()=>{setEditor(null);setErrors({});}});
    else setEditor(null);
  }
  async function save(submit: boolean) {
    if (!editor || editor.mode === "view" || busy) return;
    const result = savePo(records,editor.doc,crypto.randomUUID(),new Date().toISOString(),submit);
    setErrors(result.errors);
    if (!result.saved) return;
    setBusy(true);
    try {
      await savePO(editor.doc, submit);
      setEditor(null);
      setMessage(submit ? "ส่งใบสั่งซื้อขออนุมัติแล้ว" : "บันทึกใบสั่งซื้อแล้ว");
    } catch (error) {
      setErrors({ document: error instanceof Error ? error.message : "บันทึกใบสั่งซื้อไม่สำเร็จ" });
    } finally { setBusy(false); }
  }
  function requestAction(ids: string[],action: PoAction) {
    setConfirmation({ title:`${actionLabels[action]}ใบสั่งซื้อ?`,description:`ตรวจสอบก่อนยืนยัน ${ids.length} เอกสาร`,run:async()=>{
      try { await actPO(ids, action); setSelected([]); setMessage(`${actionLabels[action]}สำเร็จ`); }
      catch(e) { setMessage(e instanceof Error ? e.message : "เปลี่ยนสถานะใบสั่งซื้อไม่สำเร็จ"); }
    }});
  }
  function copy(doc: PurchaseOrder) {
    open({ ...structuredClone(doc),id:"",po_no:"",po_date:localDay(),status:"draft",created_at:"",updated_at:"",request_ref_id:"",request_ref_no:"",items:doc.items.map((r)=>({...r,id:crypto.randomUUID(),received_qty:"0",request_ref_item_id:""})) },"create");
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
  if (editor && department !== "none") { try { proposedNumber = previewPoNo(editor.doc.po_date,department,records); } catch {} }
  return <div className="min-w-0 space-y-5">
    <PageHeader title="PO · ใบสั่งซื้อ" description="จัดทำและติดตามใบสั่งซื้อของโรงงาน" actions={<><Button variant="outline" onClick={()=>open({...blankPo(localDay()),items:[blankItem(crypto.randomUUID())]},"create")}><Plus aria-hidden="true" />สร้างใบสั่งซื้อ</Button></>} />
    {message && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">{message}</p>}
    <SectionCard title="ติดตามใบสั่งซื้อ">
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
      {!!selection.length && <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(actionLabels) as PoAction[]).filter((action)=>selection.every((r)=>permittedActions(r.status).includes(action))).map((action)=><Button key={action} size="sm" variant="outline" onClick={()=>requestAction(selected,action)}>{actionLabels[action]}ที่เลือก</Button>)}</div>}
      <FactoryDataTable variant="history" rows={visible} rowKey={(r)=>r.id} minWidth={1150} columns={[
        {key:"select",label:"เลือก",render:(r)=><Checkbox aria-label={`เลือก ${r.po_no}`} checked={selected.includes(r.id)} onCheckedChange={(checked)=>setSelected(checked===true?[...selected.filter((id)=>id!==r.id),r.id]:selected.filter((id)=>id!==r.id))} />},
        {key:"date",label:"วันที่เอกสาร",render:(r)=>r.po_date},
        {key:"number",label:"เลขที่ PO",render:(r)=><Button variant="link" className="h-auto p-0" onClick={()=>open(r,"view")}>{r.po_no}</Button>},
        {key:"supplier",label:"ผู้ขาย",render:(r)=><p className="max-w-52 whitespace-normal break-words">{r.supplier_name_snapshot}</p>},
        {key:"warehouse",label:"คลัง / Site",render:(r)=>r.warehouse_name},
        {key:"items",label:"รายการสินค้า",render:(r)=><p className="max-w-52 whitespace-normal break-words">{r.items.map((i)=>i.material_name_snapshot).join(" / ")}</p>},
        {key:"total",label:"ยอดรวม",numeric:true,render:(r)=>`${money(poTotals(r).total)} ${r.currency_code}`},
        {key:"status",label:"สถานะ",render:(r)=><StatusBadge tone={r.status==="approved"||r.status==="received"?"success":r.status==="pending_approval"?"warning":"neutral"}>{poStatuses[r.status]}</StatusBadge>},
        {key:"delivery",label:"กำหนดส่ง",render:(r)=>r.expected_delivery_date||"—"},
        {key:"manage",label:"จัดการ",render:(r)=><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`จัดการ ${r.po_no}`}><Pencil aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>open(r,"view")}><Eye aria-hidden="true" />ดูรายละเอียด</DropdownMenuItem><DropdownMenuItem onSelect={()=>copy(r)}><Copy aria-hidden="true" />คัดลอกเป็นเอกสารใหม่</DropdownMenuItem>{["draft","rejected"].includes(r.status)&&<DropdownMenuItem onSelect={()=>open(r,"edit")}><Pencil aria-hidden="true" />แก้ไข</DropdownMenuItem>}<DropdownMenuItem onSelect={()=>setPreview([r.id])}><Printer aria-hidden="true" />พรีวิว / พิมพ์</DropdownMenuItem>{permittedActions(r.status).map((action)=><DropdownMenuItem key={action} onSelect={()=>requestAction([r.id],action)}>{actionLabels[action]}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>},
      ]} pagination={<Pagination page={safePage} pageSize={pageSize} total={filtered.length} onChange={setPage} />} />
    </SectionCard>
    <Dialog open={!!editor} onOpenChange={(open)=>{if(!open)closeEditor();}}><DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-6xl"><DialogHeader><DialogTitle>{editor?.mode==="view"?"รายละเอียดใบสั่งซื้อ":editor?.mode==="edit"?"แก้ไขใบสั่งซื้อ":"สร้างใบสั่งซื้อ"}</DialogTitle><DialogDescription>บันทึกใบสั่งซื้อและข้อมูลอ้างอิงของโรงงาน</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto pr-1">{editor&&<PoForm doc={editor.doc} errors={errors} readOnly={editor.mode==="view"} onChange={(doc)=>setEditor({...editor,doc})} onSave={(submit) => void save(submit)} onCancel={closeEditor} onPick={(kind,rowId)=>setPicker({kind,rowId})} onNumber={()=>setNumberOpen(true)} />}</div></DialogContent></Dialog>
    {picker&&picker.kind!=="pr"&&<PoMasterPicker kind={picker.kind} options={picker.kind==="supplier"?suppliers:picker.kind==="warehouse"?warehouses:materials} onClose={()=>setPicker(null)} onSelect={applyMaster} />}
    <Dialog open={picker?.kind === "pr"} onOpenChange={(open) => { if (!open) setPicker(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>เลือกใบขอซื้อ (PR)</DialogTitle>
          <DialogDescription>แสดงใบขอซื้อที่อนุมัติและยังมียอดคงเหลือ เลือกแล้วจะแทนที่ผู้ขาย คลัง และรายการในฟอร์ม</DialogDescription>
        </DialogHeader>
        <Label htmlFor="po-pr-search">ค้นหา PR</Label>
        <Input id="po-pr-search" value={prSearch} onChange={(event) => setPrSearch(event.target.value)} />
        <div className="grid max-h-64 gap-2 overflow-auto">
          {availablePR.filter((pr) => pr.number.toLowerCase().includes(prSearch.trim().toLowerCase())).map((pr) =>
            <Button key={pr.id} variant="outline" onClick={() => setConfirmation({
              title: `ใช้ข้อมูล ${pr.number}?`, description: "แทนที่รายการในฟอร์มด้วยยอดสั่งซื้อคงเหลือของ PR",
              run: () => { if (editor) setEditor({ ...editor, doc: fromPR(editor.doc, pr) }); setPicker(null); },
            })}>{pr.number}</Button>)}
          {!availablePR.some((pr) => pr.number.toLowerCase().includes(prSearch.trim().toLowerCase())) && <p>ไม่พบ PR ที่ยังมียอดคงเหลือ</p>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={numberOpen} onOpenChange={setNumberOpen}><DialogContent><DialogHeader><DialogTitle>สร้างเลข PO</DialogTitle><DialogDescription>ใช้เดือนของวันที่เอกสาร · พรีวิวไม่ใช้เลขและไม่จองเลขจริง · ตรวจซ้ำตอนบันทึก</DialogDescription></DialogHeader><SelectField label="รหัสแผนก" value={department} onChange={setDepartment} options={[{ value: "none", label: "เลือกแผนก" }, ...departments.map((row) => ({ value: row.code, label: `${row.code} · ${row.name}` }))]} /><p>วันที่เอกสาร: {editor?.doc.po_date||"ยังไม่ระบุ"}</p><p role="status" className="break-all rounded-lg border bg-muted p-4 font-semibold">{proposedNumber||"กรุณาเลือกแผนกและระบุวันที่เอกสารที่ถูกต้อง"}</p><DialogFooter><Button variant="outline" onClick={()=>setNumberOpen(false)}>ยกเลิก</Button><Button disabled={!proposedNumber} onClick={()=>{if(editor)setEditor({...editor,doc:{...editor.doc,po_no:proposedNumber}});setNumberOpen(false);}}>ใช้เลขนี้</Button></DialogFooter></DialogContent></Dialog>
    <PoPreview docs={records.filter((r)=>preview.includes(r.id))} onClose={()=>setPreview([])} />
    <AlertDialog open={!!confirmation} onOpenChange={(open)=>{if(!open)setConfirmation(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation?.title}</AlertDialogTitle><AlertDialogDescription>{confirmation?.description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={()=>{confirmation?.run();setConfirmation(null);}}>ยืนยัน</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function PoMasterPicker({ kind, options, onSelect, onClose }: {
  kind: Exclude<PickerKind, "pr">;
  options: MasterOption[];
  onSelect: (item: MasterOption) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const label = { supplier: "ผู้ขาย", warehouse: "คลัง / Site", material: "วัตถุดิบ" }[kind];
  const found = options.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader><DialogTitle>เลือก{label}</DialogTitle>
        <DialogDescription>ใช้รายการที่เปิดใช้งานจากการตั้งค่าระบบ</DialogDescription>
      </DialogHeader>
      <Label htmlFor="po-master-search">ค้นหารหัส / ชื่อ</Label>
      <Input id="po-master-search" value={search} onChange={(event) => setSearch(event.target.value)} />
      {found.map((row) => <Button key={row.id} variant="outline" className="h-auto justify-start whitespace-normal py-3 text-left" onClick={() => onSelect(row)}>{row.code} · {row.name}</Button>)}
      {!found.length && <p className="text-sm text-muted-foreground">{options.length ? "ไม่พบรายการที่ค้นหา" : `ยังไม่มี${label}ที่เปิดใช้งาน กรุณาเพิ่มในตั้งค่าระบบ`}</p>}
    </DialogContent>
  </Dialog>;
}
