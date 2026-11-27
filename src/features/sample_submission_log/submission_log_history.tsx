"use client";
import { useRef, useState } from "react";
import { ChevronDown, Download, FileText, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/src/components/ui/alert-dialog";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import { formatThaiDate } from "@/src/lib/date/thai-date";
import {
  emptyLogFilters, filterLogs, logFilterError, pageLogs,
  validLogDate, selectedAnalysis, type SubmissionLog,
} from "./submission_log_domain";

const headClass = "h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold text-white";
const cellClass = "px-4 py-3 align-top text-sm";
const menuItemClass = "min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground";

export function SubmissionLogHistory({ records, onEdit, onView, onPrint, onDelete }: {
  records: SubmissionLog[];
  onEdit: (r: SubmissionLog) => void;
  onView: (r: SubmissionLog) => void;
  onPrint: (r: SubmissionLog) => void;
  onDelete: (r: SubmissionLog) => void;
}) {
  const [filters, setFilters] = useState({ ...emptyLogFilters });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<SubmissionLog | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const manageTriggers = useRef(new Map<string, HTMLButtonElement>());
  const filtered = filterLogs(records, filters);
  const paged = pageLogs(filtered, page, size);
  const error = logFilterError(filters);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const activeFilter = Boolean(filters.search || filters.from || filters.to);

  function updateFilter<K extends keyof typeof emptyLogFilters>(key: K, value: (typeof emptyLogFilters)[K]) {
    setFilters(previous => ({ ...previous, [key]: value }));
    setPage(1);
  }

  return (
    <Card className="min-w-0 gap-0 rounded-xl border bg-card py-0 shadow-sm">
      <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
        <CardTitle className="text-base font-semibold"><h2>ข้อมูลที่บันทึก</h2></CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 p-4">
        <div className="grid items-start gap-3 sm:grid-cols-2 @[900px]/main:grid-cols-[1.35fr_1fr_1fr_0.65fr]">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="log-search">ค้นหา</Label>
            <Input ref={searchRef} id="log-search" className="h-9 rounded-lg" placeholder="ค้นหา (เลขที่เอกสาร/ชื่อ/รหัสตัวอย่าง)" value={filters.search} onChange={event => updateFilter("search", event.target.value)} />
          </div>
          <div className="min-w-0">
            <ThaiBuddhistDatePicker label="จากวันที่" value={filters.from} onChange={value => updateFilter("from", value)} />
          </div>
          <div className="min-w-0">
            <ThaiBuddhistDatePicker label="ถึงวันที่" value={filters.to} onChange={value => updateFilter("to", value)} error={error || undefined} />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="log-page-size">ต่อหน้า</Label>
            <Select value={String(size)} onValueChange={value => { setSize(Number(value)); setPage(1); }}>
              <SelectTrigger id="log-page-size" className="w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 10, 20].map(n => <SelectItem key={n} value={String(n)}>{n} รายการ</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Table className="min-w-[900px] table-fixed text-foreground" containerProps={{ className: "rounded-lg border", role: "region", "aria-label": "ตารางประวัติแบบบันทึก เลื่อนแนวนอนเพื่อดูข้อมูล", tabIndex: 0 }}>
          <TableHeader>
            <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
              <TableHead className={`${headClass} w-[19%]`}>เลขที่เอกสาร</TableHead>
              <TableHead className={`${headClass} w-[12%]`}>วันที่คำขอ</TableHead>
              <TableHead className={`${headClass} w-[20%]`}>ผู้ยื่นคำขอ</TableHead>
              <TableHead className={`${headClass} w-[23%]`}>รหัส/ชื่อตัวอย่าง</TableHead>
              <TableHead className={`${headClass} w-[14%]`}>รายการตรวจวิเคราะห์</TableHead>
              <TableHead className={`${headClass} w-[12%] text-center`}>จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.rows.map(r => {
              const analysis = selectedAnalysis(r);
              const analysisLabels = analysis.map(([, label]) => label).join(" · ");
              return (
                <TableRow key={r.id} className="border-border/60 hover:bg-muted/40">
                  <TableCell className={cellClass}>
                    <Button type="button" variant="link" onClick={() => onView(r)} className="block h-auto w-full overflow-hidden text-ellipsis whitespace-nowrap p-0 text-left font-medium text-foreground" title={r.doc_no}>{r.doc_no || "-"}</Button>
                    <p className="truncate text-xs text-muted-foreground" title={r.id}>ID: {r.id}</p>
                  </TableCell>
                  <TableCell className={cellClass}>{validLogDate(r.sender_sign.signed_date) ? formatThaiDate(r.sender_sign.signed_date) : "-"}</TableCell>
                  <TableCell className={cellClass}>
                    <p className="truncate font-medium" title={r.requester_name}>{r.requester_name || "-"}</p>
                    {r.sender_sign.signer_name && r.sender_sign.signer_name !== r.requester_name && <p className="truncate text-xs text-muted-foreground" title={r.sender_sign.signer_name}>ผู้ส่ง: {r.sender_sign.signer_name}</p>}
                  </TableCell>
                  <TableCell className={cellClass}>
                    <p className="truncate font-medium" title={r.sample_code}>{r.sample_code || "-"}</p>
                    <p className="truncate text-xs text-muted-foreground" title={r.sample_name}>{r.sample_name || "-"}</p>
                  </TableCell>
                  <TableCell className={cellClass}>
                    <p className="font-medium">{analysis.length} รายการ</p>
                    <p className="truncate text-xs text-muted-foreground" title={analysisLabels}>{analysisLabels || "-"}</p>
                  </TableCell>
                  <TableCell className={`${cellClass} text-center`}>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button ref={node => { if (node) manageTriggers.current.set(r.id, node); else manageTriggers.current.delete(r.id); }} type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-[#a6bf49] bg-muted/40 px-2.5 text-xs font-medium text-[#173b63]! shadow-none hover:bg-muted hover:text-[#173b63]! data-[state=open]:border-[#a6bf49] data-[state=open]:bg-muted dark:text-foreground! dark:hover:text-foreground!" aria-label={`จัดการ ${r.doc_no}`}>
                          จัดการ <ChevronDown aria-hidden="true" className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" sideOffset={8} className="w-52 max-w-[calc(100vw-24px)] rounded-xl border bg-card p-1.5 text-foreground shadow-md" onCloseAutoFocus={event => { if (deleteTrigger.current) event.preventDefault(); }}>
                        <DropdownMenuItem className={menuItemClass} onSelect={() => onView(r)}><FileText aria-hidden="true" className="text-current" />ดูรายงาน</DropdownMenuItem>
                        <DropdownMenuItem className={menuItemClass} onSelect={() => onPrint(r)}><Printer aria-hidden="true" className="text-current" />พิมพ์เอกสาร</DropdownMenuItem>
                        <DropdownMenuItem className={menuItemClass} onSelect={() => onEdit(r)}><Pencil aria-hidden="true" className="text-current" />แก้ไข</DropdownMenuItem>
                        <DropdownMenuItem className={menuItemClass} disabled title="ยังไม่เปิดใช้งานการนำออก Excel"><Download aria-hidden="true" className="text-current" />นำออก Excel</DropdownMenuItem>
                        <DropdownMenuItem className={`${menuItemClass} data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive`} variant="destructive" onSelect={() => {
                          deleteTrigger.current = manageTriggers.current.get(r.id) ?? null;
                          setDeleteTarget(r);
                        }}><Trash2 aria-hidden="true" />ลบเอกสาร</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {!paged.rows.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">{error ? "กรุณาตรวจสอบช่วงวันที่" : records.length ? "ไม่พบข้อมูลตามตัวกรอง" : "ยังไม่มีข้อมูลในประวัติ"}</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p role="status">ทั้งหมด <strong>{filtered.length}</strong> รายการ{activeFilter && <span className="ml-1 text-muted-foreground">(จาก {records.length})</span>}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>ก่อนหน้า</Button>
            <span className="whitespace-nowrap">หน้า {paged.page} / {pages}</span>
            <Button type="button" variant="outline" size="sm" disabled={paged.page >= pages} onClick={() => setPage(paged.page + 1)}>ถัดไป</Button>
          </div>
        </div>
      </CardContent>
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent onCloseAutoFocus={event => {
          event.preventDefault();
          if (deleteTrigger.current?.isConnected) deleteTrigger.current.focus();
          else searchRef.current?.focus();
          deleteTrigger.current = null;
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบเอกสาร {deleteTarget?.doc_no}?</AlertDialogTitle>
            <AlertDialogDescription>นำเอกสารออกจากรายการและเก็บประวัติการลบ</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteTarget) onDelete(deleteTarget); setDeleteTarget(null); }}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
