"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClipboardList, FileText, Users, Clock, Lock, Info, Save, Pencil, Trash2, ChevronDown, Printer, FileSpreadsheet } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { blankPaperRows, isPaperResult, paperChecks, paperResults, updatePaperRow, buildPaperInput, rowsFromPaper, paperStatus, validatePaperInput, type PaperInput, type PaperRecord, type PaperField, type PaperCheck, type PaperResult, type PaperRow } from "./paper-domain";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/src/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/src/components/ui/alert-dialog";
import { formatThaiDate, todayInBangkok } from "@/src/lib/date/thai-date";

import { PaperPrintPreview } from "./paper-print-preview";
import { Checkbox } from "@/src/components/ui/checkbox";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/src/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/src/components/ui/dialog";
import { useBranding } from "@/src/components/factory/branding-provider";
import { buildPaperPrintHtml } from "./paper-print";

const endpoint = "/api/qc-raw-material-paper";
async function readResponse<T>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null) as {ok: true; data: T} | {ok: false; message?: string} | null;
  if (!response.ok || !value?.ok) throw new Error(value && !value.ok ? value.message || "ดำเนินการไม่สำเร็จ" : "ไม่สามารถเชื่อมต่อระบบได้");
  return value.data;
}
function verifiedRecord(value: PaperRecord): PaperRecord {
  if (!value || typeof value.id !== "string" || typeof value.version !== "string") throw new Error("ข้อมูลตอบกลับไม่ถูกต้อง กรุณาโหลดใหม่");
  return {...validatePaperInput(value), id:value.id, version:value.version};
}
async function writePaper(method: "POST"|"PUT"|"DELETE", data: object, id?: string) {
  const csrf = await fetch("/api/auth/csrf", {cache:"no-store",credentials:"same-origin"});
  const token = await csrf.json().catch(()=>null) as {ok?:boolean;csrfToken?:string}|null;
  if (!csrf.ok || !token?.ok || !token.csrfToken) throw new Error("ไม่สามารถยืนยันคำขอได้");
  return fetch(id ? `${endpoint}?id=${encodeURIComponent(id)}` : endpoint, {method,credentials:"same-origin",headers:{"Content-Type":"application/json","x-csrf-token":token.csrfToken},body:JSON.stringify(data)});
}

// Saved-document history helpers. All exports use saved records, never unsaved drafts.
function filterPaperHistory(records: PaperRecord[], search: string, from: string, to: string): PaperRecord[] {
  const query = search.trim().toLowerCase();
  if (from && to && from > to) return [];
  return records.filter(record => (!from || record.date >= from) && (!to || record.date <= to) &&
    [record.number, record.date, formatThaiDate(record.date), ...record.lines.flatMap(line => [line.materialCode, line.supplierCode, line.note])].some(value => value.toLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number, undefined, { numeric: true }) || a.id.localeCompare(b.id));
}
function countPaperResults(record: PaperRecord, key: PaperCheck) {
  return { pass: record.lines.filter(line => line[key] === "pass").length,
    acceptable: record.lines.filter(line => line[key] === "acceptable").length,
    fail: record.lines.filter(line => line[key] === "fail").length };
}
function paperHistoryExportRows(records: PaperRecord[]): string[][] {
  return [["เอกสารเลขที่", "วันที่", "ลำดับ", "รหัสวัตถุดิบ", "รหัส Supplier", "จำนวน", "หน่วย", ...paperChecks.map(check => check.label), "หมายเหตุ"],
    ...records.flatMap(record => record.lines.map(line => [record.number, formatThaiDate(record.date), String(line.lineNo), line.materialCode, line.supplierCode, line.quantity, line.unit,
      ...paperChecks.map(check => paperResults.find(result => result.value === line[check.key])?.label ?? ""), line.note]))];
}
function escapeSheetXml(value: string): string {
  return Array.from(value).filter(char => {
    const point = char.codePointAt(0) ?? 0;
    return point === 9 || point === 10 || point === 13 || (point >= 32 && point <= 0xd7ff) || (point >= 0xe000 && point <= 0xfffd) || (point >= 0x10000 && point <= 0x10ffff);
  }).join("").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#13;");
}
// Minimal, uncompressed ZIP for a single-sheet OOXML workbook. No new dependency.
function buildPaperHistoryXlsx(records: PaperRecord[]): Uint8Array<ArrayBuffer> {
  const rows = paperHistoryExportRows(records);
  const sheet = rows.map((row, index) => `<row r="${index + 1}">${row.map((value, col) => `<c r="${String.fromCharCode(65 + col)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeSheetXml(value)}</t></is></c>`).join("")}</row>`).join("");
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const entries: [string, string][] = [
    ["[Content_Types].xml", xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ["_rels/.rels", xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", xml+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="QC Raw Material" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", xml+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheet}</sheetData></worksheet>`],
  ];
  const encoder = new TextEncoder();
  const local: Uint8Array<ArrayBuffer>[] = [], central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0, centralSize = 0;
  for (const [name, content] of entries) {
    const filename = encoder.encode(name), bytes = encoder.encode(content);
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = new Uint8Array(30 + filename.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, filename.length, true); header.set(filename, 30);
    const entry = new Uint8Array(46 + filename.length), d = new DataView(entry.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(14, 33, true); d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, filename.length, true); d.setUint32(42, offset, true); entry.set(filename, 46);
    local.push(header, bytes); central.push(entry); offset += header.length + bytes.length; centralSize += entry.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const chunk of [...local, ...central, end]) { result.set(chunk, position); position += chunk.length; }
  return result;
}
function downloadPaperHistory(records: PaperRecord[]) {
  if (!records.length) return;
  const data = buildPaperHistoryXlsx(records);
  const url = URL.createObjectURL(new Blob([data], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
  const link = document.createElement("a");
  link.href = url;
  link.download = records.length === 1 ? `QC-${records[0].number.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx` : `QC-Raw-Material-${todayInBangkok()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function HistoryResult({ record, check }: { record: PaperRecord; check: PaperCheck }) {
  const counts = countPaperResults(record, check);
  return <div className="flex flex-wrap justify-center gap-1" aria-label={`ผ่าน ${counts.pass}, ยอมรับได้ ${counts.acceptable}, ไม่ผ่าน ${counts.fail}`}>
    {counts.pass>0&&<span className="nan-qc-count nan-qc-pass">✓ {counts.pass}/{record.lines.length}</span>}
    {counts.acceptable>0&&<span className="nan-qc-count nan-qc-acceptable">O {counts.acceptable}/{record.lines.length}</span>}
    {counts.fail>0&&<span className="nan-qc-count nan-qc-fail">X {counts.fail}/{record.lines.length}</span>}
  </div>;
}
function HistoryPrintDialog({record,onClose}:{record:PaperRecord;onClose:()=>void}) {
  const {branding}=useBranding();
  const frame=useRef<HTMLIFrameElement>(null);
  const [loadedHtml,setLoadedHtml]=useState("");
  const [printError,setPrintError]=useState("");
  const html=buildPaperPrintHtml(record,branding.factoryName);
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent variant="preview"><DialogHeader className="pr-8"><DialogTitle>ตัวอย่างก่อนพิมพ์ {record.number}</DialogTitle><DialogDescription>A5 แนวนอน · ข้อมูลจากเอกสารที่บันทึกแล้ว</DialogDescription></DialogHeader>
      <iframe ref={frame} title="ตัวอย่างก่อนพิมพ์" className="min-h-0 w-full flex-1 rounded-md border bg-white" sandbox="allow-same-origin allow-modals" srcDoc={html} onLoad={()=>setLoadedHtml(html)}/>
      {printError&&<p role="alert" className="text-danger">{printError}</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>ปิด</Button><Button type="button" disabled={loadedHtml!==html} onClick={()=>{try{const target=frame.current?.contentWindow;if(!target)throw new Error("ยังไม่พร้อม");target.focus();target.print();}catch{setPrintError("ไม่สามารถเปิดหน้าต่างพิมพ์ได้");}}}><Printer/>พิมพ์ / บันทึก PDF</Button></DialogFooter>
    </DialogContent></Dialog>;
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-3 text-base font-semibold text-[#172033]">
        <span className="text-[#173b63]" aria-hidden="true">{icon}</span>{title}
      </h2>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </section>
  );
}

const resultColors: Record<PaperResult, string> = {
  "": "#64748b", pass: "#15803d", acceptable: "#b45309", fail: "#dc2626",
};

function ResultPicker({ label, value, onChange, disabled }: { label: string; value: PaperResult; onChange: (value: PaperResult) => void; disabled: boolean }) {
  const selected = paperResults.find((result) => result.value === value);
  return (
    <Select disabled={disabled} value={value || "unset"} onValueChange={(next) => {
      const result = next === "unset" ? "" : next;
      if (isPaperResult(result)) onChange(result);
    }}>
      <SelectTrigger size="sm" aria-label={label} className="nan-qc-inspection-control w-full min-w-0 rounded-lg border-[#d1d5db] bg-white px-2 text-sm shadow-none focus-visible:border-[#9ec23a] focus-visible:ring-[#9ec23a]/30" style={{ color: resultColors[value] }}>
        <SelectValue>{selected ? `${selected.symbol} ${selected.label}` : "เลือก"}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-[9rem] rounded-lg border-[#e2e8f0] bg-white text-[#172033] shadow-lg">
        {paperResults.map((result) => (
          <SelectItem key={result.value} value={result.value} className="text-xs focus:bg-[#f1f5f9] focus:text-[#172033]">
            <span style={{ color: resultColors[result.value] }} className="inline-block w-4 font-bold">{result.symbol}</span>{result.label}
          </SelectItem>
        ))}
        <SelectItem value="unset" className="text-xs text-[#64748b]">ล้างผลตรวจ</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function RawMaterialPaperWorkspace({ children }: { children: ReactNode }) {
  const [initialDate, setInitialDate] = useState(() => todayInBangkok());
  const [date, setDate] = useState(initialDate);
  const [number, setNumber] = useState("");
  const [rows, setRows] = useState(blankPaperRows);
  const [tab, setTab] = useState<"form"|"history">("form");
  const [historyKind, setHistoryKind] = useState<"paper"|"legacy">("paper");
  const [legacyMounted, setLegacyMounted] = useState(false);
  const [records,setRecords]=useState<PaperRecord[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [loadError,setLoadError]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const [editing,setEditing]=useState<PaperRecord|null>(null);
  const [viewOnly,setViewOnly]=useState(false);
  const [search,setSearch]=useState("");
  const [fromDate,setFromDate]=useState("");
  const [toDate,setToDate]=useState("");
  const [pageSize,setPageSize]=useState(10);
  const [page,setPage]=useState(1);
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [printRecord,setPrintRecord]=useState<PaperRecord|null>(null);
  const [pending,setPending]=useState<{kind:"open";record:PaperRecord;readOnly:boolean}|{kind:"new"}|{kind:"archive";record:PaperRecord}|null>(null);
  const dirty=number !== (editing?.number??"") || (editing ? date!==editing.date || JSON.stringify(rows)!==JSON.stringify(rowsFromPaper(editing)) : date!==initialDate || rows.some(r=>Object.values(r).some(v=>v!=="")));
  useEffect(()=>{
    const controller=new AbortController();
    fetch(endpoint,{cache:"no-store",credentials:"same-origin",signal:controller.signal})
      .then(readResponse<PaperRecord[]>).then(data=>{ if(!controller.signal.aborted){setRecords(data.map(verifiedRecord));setLoaded(true);} })
      .catch((e:unknown)=>{if(!controller.signal.aborted)setLoadError(e instanceof Error?e.message:"โหลดข้อมูลไม่สำเร็จ");});
    return ()=>controller.abort();
  },[]);
  function reset() {const today=todayInBangkok();setInitialDate(today);setDate(today);setNumber("");setRows(blankPaperRows());setEditing(null);setViewOnly(false);setError("");}
  function open(record:PaperRecord,readOnly:boolean) {setDate(record.date);setNumber(record.number);setRows(rowsFromPaper(record));setEditing(record);setViewOnly(readOnly);setError("");setNotice("");setTab("form");}
  function requestOpen(record:PaperRecord,readOnly:boolean) {if(dirty)setPending({kind:"open",record,readOnly});else open(record,readOnly);}
  async function save() {
    if(lock.current||viewOnly||!loaded)return;
    setError("");setNotice("");
    let input:PaperInput;
    try {input=buildPaperInput(date,number,rows);} catch(e){setError(e instanceof Error?e.message:"ข้อมูลไม่ถูกต้อง");return;}
    lock.current=true;setBusy(true);
    try {
      const saved=verifiedRecord(await readResponse<PaperRecord>(await writePaper(editing?"PUT":"POST",{...input,version:editing?.version},editing?.id)));
      if(editing&&saved.id!==editing.id)throw new Error("ข้อมูลตอบกลับไม่ตรงกับเอกสาร กรุณาโหลดใหม่");
      setRecords(prev=>[saved,...prev.filter(r=>r.id!==saved.id)]);
      reset();setNotice(`บันทึกเอกสาร ${saved.number} สำเร็จ`);setHistoryKind("paper");setTab("history");
    } catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}
    finally {lock.current=false;setBusy(false);}
  }
  async function archive(record:PaperRecord) {
    if(lock.current||!loaded)return;
    lock.current=true;setBusy(true);setError("");setNotice("");
    try {const removed=await readResponse<{id:string}>(await writePaper("DELETE",{version:record.version},record.id));if(removed.id!==record.id)throw new Error("ข้อมูลตอบกลับไม่ตรงกับเอกสาร กรุณาโหลดใหม่");setRecords(prev=>prev.filter(r=>r.id!==record.id));if(editing?.id===record.id)reset();setNotice(`ยกเลิกเอกสาร ${record.number} สำเร็จ`);}
    catch(e){setError(e instanceof Error?e.message:"ยกเลิกเอกสารไม่สำเร็จ");}
    finally{lock.current=false;setBusy(false);}
  }
  function confirm() {const action=pending;setPending(null);if(!action)return;if(action.kind==="new"){reset();setTab("form");}else if(action.kind==="open")open(action.record,action.readOnly);else void archive(action.record);}
  const disabled=busy||viewOnly;
  const filtered=filterPaperHistory(records,search,fromDate,toDate);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pageCount);
  const visibleRecords=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
  const selectedRecords=filtered.filter(record=>selectedIds.includes(record.id));
  const allVisibleSelected=visibleRecords.length>0&&visibleRecords.every(record=>selectedIds.includes(record.id));
  const someVisibleSelected=visibleRecords.some(record=>selectedIds.includes(record.id));
  function exportRecords(savedRecords:PaperRecord[]) {try{setError("");downloadPaperHistory(savedRecords);}catch{setError("ไม่สามารถนำออก Excel ได้ กรุณาลองใหม่");}}


  function change<K extends keyof PaperRow>(index: number, key: K, value: PaperRow[K]) {
    setRows((previous) => updatePaperRow(previous, index, key, value));
  }

  function textCell(row: PaperRow, index: number, key: PaperField, label: string) {
    return (
      <TableCell className="nan-qc-inspection-cell">
        <Input disabled={disabled} maxLength={key === "note" ? 1000 : key === "unit" ? 50 : key === "quantity" ? 19 : 100} aria-label={`${label} แถว ${index + 1}`} value={row[key]} onChange={(event) => change(index, key, event.target.value)} inputMode={key === "quantity" ? "decimal" : undefined} className="nan-qc-inspection-control w-full min-w-0 rounded-lg border-[#d1d5db] bg-white px-2 text-sm shadow-none focus-visible:border-[#9ec23a] focus-visible:ring-[#9ec23a]/30" />
      </TableCell>
    );
  }

  const head = "nan-qc-inspection-head !h-auto !text-white !whitespace-normal text-center font-semibold";
  return (
    <div className="nan-qc-paper min-w-0 space-y-4 text-sm text-[#172033]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div role="group" aria-label="มุมมองเอกสาร" className="mx-auto flex w-full max-w-xl rounded-full border border-[#e2e8f0] bg-white p-1 shadow-sm">
        {([ ["form","สร้างรายงาน"], ["history","ประวัติการตรวจสอบ"] ] as const).map(([key,label])=><Button key={key} type="button" variant="ghost" aria-pressed={tab===key} disabled={busy} onClick={()=>setTab(key)} className={`!rounded-full flex-1 ${tab===key?"!bg-[#173b63] !text-white":"!bg-white !text-[#172033] hover:!bg-[#f1f5f9]"}`}>{label}</Button>)}
      </div>
      {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-green-800">{notice}</p>}
      {loadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">{loadError} · กรุณาตรวจสอบ Migration และรีเฟรชหน้า</p>}
      {!loaded&&!loadError&&<p role="status" className="text-xs text-[#64748b]">กำลังโหลดข้อมูล...</p>}
      {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">{error}</p>}
      {tab==="form"&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();void save();}}>
      {editing&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3"><span>{viewOnly?"รายละเอียดเอกสาร":"กำลังแก้ไข"}: {editing.number}</span><div className="flex gap-2">{viewOnly&&<Button type="button" variant="outline" onClick={()=>setViewOnly(false)}>แก้ไข</Button>}<Button type="button" variant="outline" disabled={busy} onClick={()=>dirty?setPending({kind:"new"}):reset()}>สร้างรายงานใหม่</Button></div></div>}
      <Panel title="ส่วนหัวเอกสาร" icon={<FileText className="size-5" />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ThaiBuddhistDatePicker label="วันที่ *" disabled={disabled} value={date} onChange={setDate} />
          <label className="grid gap-1.5 text-sm text-[#475569]">
            <span>เอกสารเลขที่ <span className="text-red-600">*</span></span>
            <Input disabled={disabled} value={number} onChange={(event) => setNumber(event.target.value)} placeholder="ระบุเลขที่เอกสาร" maxLength={100} className="rounded-lg border-[#d1d5db] bg-white focus-visible:border-[#9ec23a] focus-visible:ring-[#9ec23a]/30" />
          </label>
        </div>
      </Panel>
      <Panel title="รายการตรวจสอบ" icon={<ClipboardList className="size-5" />}>
        <div className="nan-qc-inspection-grid max-w-full overflow-x-auto rounded-xl border border-[#e2e8f0]" role="region" aria-label="ตารางตรวจสอบวัตถุดิบ เลื่อนแนวนอนได้" tabIndex={0}>
          <Table className="nan-qc-inspection-table w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "5%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "7%" }} /><col style={{ width: "6%" }} />
              {paperChecks.map(({ key }) => <col key={key} style={{ width: "9.5%" }} />)}<col style={{ width: "18%" }} />
            </colgroup>
            <TableHeader className="bg-[#173b63]">
              <TableRow className="hover:!bg-[#173b63]">
                <TableHead scope="col" rowSpan={2} className={head}>ลำดับ</TableHead>
                <TableHead scope="col" rowSpan={2} className={head}>รหัสวัตถุดิบ</TableHead>
                <TableHead scope="col" rowSpan={2} className={head}>รหัส Supplier</TableHead>
                <TableHead scope="col" rowSpan={2} className={head}>จำนวน</TableHead>
                <TableHead scope="col" rowSpan={2} className={head}>หน่วย</TableHead>
                <TableHead scope="colgroup" colSpan={4} className={head}>การตรวจสอบคุณภาพ</TableHead>
                <TableHead scope="col" rowSpan={2} className={head}>หมายเหตุ</TableHead>
              </TableRow>
              <TableRow className="hover:!bg-[#173b63]">{paperChecks.map(({ key, label }) => <TableHead key={key} scope="col" className={head}>{label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} className="nan-qc-inspection-row">
                  <TableHead scope="row" className="nan-qc-inspection-index !h-auto text-center font-medium !text-[#172033]"><span>{index + 1}</span></TableHead>
                  {textCell(row, index, "materialCode", "รหัสวัตถุดิบ")}
                  {textCell(row, index, "supplierCode", "รหัส Supplier")}
                  {textCell(row, index, "quantity", "จำนวน")}
                  {textCell(row, index, "unit", "หน่วย")}
                  {paperChecks.map(({ key, label }) => (
                    <TableCell key={key} className="nan-qc-inspection-cell">
                      <ResultPicker disabled={disabled} label={`${label} แถว ${index + 1}`} value={row[key]} onChange={(value) => change(index, key, value)} />
                    </TableCell>
                  ))}
                  {textCell(row, index, "note", "หมายเหตุ")}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-[#e8f0fb] px-3 py-2 text-sm font-medium text-[#173b63]">
          <Info className="size-4" aria-hidden="true" />
          {paperResults.map(({ value, symbol, label }) => <span key={value}>{symbol} = {label}</span>)}
        </div>
      </Panel>
      <Panel title="รายชื่อผู้ลงนาม" icon={<Users className="size-5" />}>
        <p className="mb-2 text-xs text-[#64748b]">ยังไม่เปิดระบบลงนามและแจ้งเตือนอัตโนมัติ</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#e2e8f0] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">ผู้ตรวจสอบคุณภาพ</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#fffbeb] px-2 py-1 text-xs font-medium text-[#b45309]"><Clock className="size-3.5" aria-hidden="true" />รอลงนาม</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#475569]">รอเชื่อมระบบลงนามของผู้ตรวจสอบคุณภาพ</p>
          </div>
          <div className="rounded-xl border border-[#e2e8f0] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">รับทราบโดย</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-1 text-xs font-medium text-[#475569]"><Lock className="size-3.5" aria-hidden="true" />รอลำดับก่อนหน้า</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#475569]">รับทราบหลังผู้ตรวจสอบคุณภาพลงนาม (ยังไม่เปิดใช้งาน)</p>
          </div>
        </div>
      </Panel>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {editing&&viewOnly&&<PaperPrintPreview record={editing}/>}
        {!viewOnly&&<Button type="submit" disabled={busy||!loaded} className="rounded-lg !bg-[#173b63] px-5 !text-white"><Save className="size-4" aria-hidden="true" />{busy?"กำลังบันทึก...":"บันทึก"}</Button>}
      </div>
      </form>}
      {tab==="history"&&<section className="nan-qc-history min-w-0 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] px-4 py-3">
          <h2 className="font-semibold text-[#172033]">ข้อมูลที่บันทึก</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={historyKind==="paper"?"default":"outline"} onClick={()=>setHistoryKind("paper")}>ฟอร์มใหม่</Button>
            <Button type="button" size="sm" variant={historyKind==="legacy"?"default":"outline"} onClick={()=>{setLegacyMounted(true);setHistoryKind("legacy");}}>เอกสารรูปแบบเดิม</Button>
          </div>
        </div>
        {historyKind==="paper"&&<div className="space-y-3 p-3 sm:p-4">
          <div className="nan-qc-history-filters">
            <label className="grid min-w-0 gap-1.5 text-xs text-[#475569]">ค้นหา (เอกสาร/Supplier/วัตถุดิบ)
              <Input placeholder="พิมพ์คำค้น..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);setSelectedIds([]);}}/>
            </label>
            <ThaiBuddhistDatePicker label="วันที่เริ่มค้นหา" value={fromDate} onChange={value=>{setFromDate(value);setPage(1);setSelectedIds([]);}}/>
            <ThaiBuddhistDatePicker label="วันที่สิ้นสุด" value={toDate} onChange={value=>{setToDate(value);setPage(1);setSelectedIds([]);}}/>
            <div className="grid min-w-0 gap-1.5 text-xs text-[#475569]"><span>แสดงต่อหน้า</span>
              <Select value={String(pageSize)} onValueChange={value=>{setPageSize(Number(value));setPage(1);}}><SelectTrigger aria-label="แสดงต่อหน้า" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[10,20,50,100].map(n=><SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          {fromDate&&toDate&&fromDate>toDate&&<p role="alert" className="text-xs text-red-700">วันที่เริ่มค้นหาต้องไม่อยู่หลังวันที่สิ้นสุด</p>}
          {selectedRecords.length>0&&<div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>เลือก {selectedRecords.length} เอกสาร</span><div className="flex gap-2"><Button size="sm" type="button" variant="outline" onClick={()=>exportRecords(selectedRecords)}><FileSpreadsheet/>นำออก Excel</Button><Button type="button" size="sm" variant="ghost" onClick={()=>setSelectedIds([])}>ล้างการเลือก</Button></div></div>}
          <Table containerProps={{className:"nan-qc-history-scroll rounded-lg border border-[#dce3eb]",role:"region","aria-label":"ตารางประวัติการตรวจสอบ",tabIndex:0}} className="nan-qc-history-table">
            <TableHeader><TableRow>
              <TableHead scope="col"><Checkbox aria-label="เลือกเอกสารทั้งหมดในหน้านี้" disabled={!visibleRecords.length||busy} checked={allVisibleSelected?true:someVisibleSelected?"indeterminate":false} onCheckedChange={value=>setSelectedIds(previous=>value===true?[...new Set([...previous,...visibleRecords.map(record=>record.id)])]:previous.filter(id=>!visibleRecords.some(record=>record.id===id)))} className="rounded-sm border-white bg-white text-[#173b63]"/></TableHead>
              {['#','เลขที่เอกสาร','วันที่','รหัสวัตถุดิบ','รหัส Supplier','จำนวนรายการ',...paperChecks.map(check=>check.label),'ผลตรวจ','จัดการ'].map(label=><TableHead key={label} scope="col">{label}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>{visibleRecords.map((record,index)=><TableRow key={record.id} data-state={selectedIds.includes(record.id)?"selected":undefined}>
              <TableCell><Checkbox aria-label={`เลือกเอกสาร ${record.number}`} checked={selectedIds.includes(record.id)} disabled={busy} onCheckedChange={value=>setSelectedIds(previous=>value===true?[...new Set([...previous,record.id])]:previous.filter(id=>id!==record.id))} className="rounded-sm"/></TableCell>
              <TableCell>{(currentPage-1)*pageSize+index+1}</TableCell>
              <TableCell className="font-semibold"><Button type="button" variant="ghost" className="h-auto px-0 py-0 text-[#173b63] hover:underline" disabled={busy} onClick={()=>requestOpen(record,true)}>{record.number}</Button></TableCell>
              <TableCell>{formatThaiDate(record.date)}</TableCell>
              <TableCell className="nan-qc-code-cell">{[...new Set(record.lines.map(line=>line.materialCode))].join(", ")}</TableCell>
              <TableCell className="nan-qc-code-cell">{[...new Set(record.lines.map(line=>line.supplierCode))].join(", ")}</TableCell>
              <TableCell>{record.lines.length}</TableCell>
              {paperChecks.map(check=><TableCell key={check.key}><HistoryResult record={record} check={check.key}/></TableCell>)}
              <TableCell><span className={`nan-qc-count ${paperStatus(record.lines)==="ไม่ผ่าน"?"nan-qc-fail":paperStatus(record.lines)==="ยอมรับได้"?"nan-qc-acceptable":"nan-qc-pass"}`}>{paperStatus(record.lines)}</span></TableCell>
              <TableCell><DropdownMenu modal={false}><DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline" disabled={busy} aria-label={`จัดการ ${record.number}`} className="nan-qc-manage">จัดการ<ChevronDown className="size-3.5"/></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={6} className="nan-qc-history-menu w-48 rounded-xl border-[#e2e8f0] bg-white p-1.5 text-[#172033] shadow-lg">
                  <DropdownMenuItem onSelect={()=>requestOpen(record,true)}><FileText/>ดูรายละเอียด</DropdownMenuItem>
                  <DropdownMenuItem onSelect={()=>setPrintRecord(record)}><Printer/>พิมพ์เอกสาร</DropdownMenuItem>
                  <DropdownMenuItem onSelect={()=>requestOpen(record,false)}><Pencil/>แก้ไข</DropdownMenuItem>
                  <DropdownMenuItem onSelect={()=>exportRecords([record])}><FileSpreadsheet/>นำออก Excel</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={()=>setPending({kind:"archive",record})}><Trash2/>ลบเอกสาร</DropdownMenuItem>
                </DropdownMenuContent></DropdownMenu></TableCell>
            </TableRow>)}{loaded&&!visibleRecords.length&&<TableRow><TableCell colSpan={13} className="py-12 text-center text-[#64748b]">ไม่พบเอกสาร</TableCell></TableRow>}{!loaded&&<TableRow><TableCell colSpan={13} className="py-12 text-center text-[#64748b]">{loadError?"โหลดข้อมูลไม่สำเร็จ":"กำลังโหลดข้อมูล..."}</TableCell></TableRow>}</TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748b]">
            <span>{filtered.length?(currentPage-1)*pageSize+1:0}–{Math.min(currentPage*pageSize,filtered.length)} จาก {filtered.length} รายการ</span>
            <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>ก่อนหน้า</Button><span>หน้า {currentPage} / {pageCount}</span><Button type="button" size="sm" variant="outline" disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>ถัดไป</Button></div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-[#64748b]"><span>✓ ผ่าน</span><span>O ยอมรับได้</span><span>X ไม่ผ่าน</span><span>ตัวเลข = จำนวนผลตรวจประเภทนั้น / จำนวนรายการ</span></div>
        </div>}
      </section>}
      {printRecord&&<HistoryPrintDialog key={printRecord.id} record={printRecord} onClose={()=>setPrintRecord(null)}/>}
      {legacyMounted&&<div hidden={tab!=="history"||historyKind!=="legacy"}>{children}</div>}
      <AlertDialog open={pending!==null} onOpenChange={open=>{if(!open)setPending(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.kind==="archive"?"ยกเลิกเอกสาร?":"แทนที่ข้อมูลที่ยังไม่บันทึก?"}</AlertDialogTitle><AlertDialogDescription>{pending?.kind==="archive"?"เอกสารจะถูกซ่อนจากประวัติ แต่ข้อมูลและประวัติการเปลี่ยนแปลงจะยังอยู่ในฐานข้อมูล":"ข้อมูลในฟอร์มปัจจุบันที่ยังไม่ได้บันทึกจะถูกแทนที่"}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>ยกเลิก</AlertDialogCancel><AlertDialogAction onClick={confirm}>ยืนยัน</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
