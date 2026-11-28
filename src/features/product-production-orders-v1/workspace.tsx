"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Eye, FileSpreadsheet, Link2, LockKeyhole, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { DocumentEditBanner } from "@/src/components/factory/document-edit-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/src/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import { formatThaiDate, todayInBangkok } from "@/src/lib/date/thai-date";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Textarea } from "@/src/components/ui/textarea";
// import { PageHeader } from "@/src/components/factory/patterns";
import { useBOM } from "../bom/bom-provider";
import { productionRequest, useProductionV1Data } from "../production-flow/production-v1-client";
import type { ProductionOrderV1 } from "./types";
import { ProductionFormulaDocument } from "../production-flow/production-formula-sheet";

type ManagedProductionOrder = ProductionOrderV1 & { revision?: string };

type PrdCandidate = { docNo: string; yy: string; mm: string; seq: number };
type PrdReservation = PrdCandidate & { reservationId: string; expiresAt: string };
type PrdReserveResult = { reserved: true; reservation: PrdReservation } | { reserved: false; candidate: PrdCandidate };

type ProductionLine = {
  id: string;
  date: string;
  lineT1Qty: string;
  lineT1Lot: string;
  lineT2Qty: string;
  lineT2Lot: string;
  lineT4Qty: string;
  lineT4Lot: string;
  shift: string;
  producer: string;
};

type Signers = {
  preparedBy: string;
  qaOfficer: string;
  productionOfficer: string;
  manager: string;
};

const newLine = (): ProductionLine => ({
  id: crypto.randomUUID(),
  date: "",
  lineT1Qty: "",
  lineT1Lot: "",
  lineT2Qty: "",
  lineT2Lot: "",
  lineT4Qty: "",
  lineT4Lot: "",
  shift: "",
  producer: "",
});

const signerFields: Array<{ key: keyof Signers; label: string }> = [
  { key: "preparedBy", label: "ผู้ออกใบสั่งผลิต" },
  { key: "qaOfficer", label: "ฝ่ายตรวจสอบคุณภาพ" },
  { key: "productionOfficer", label: "ฝ่ายผลิต" },
  { key: "manager", label: "ผู้จัดการ" },
];

const historyColumns = [
  "#",
  "เลขที่เอกสาร",
  "โรงงานผลิต",
  "วันที่",
  "ผลิตปุ๋ย",
  "จำนวน (ตัน)",
  "ผลิตแล้ว (ตัน)",
  "ยอดค้าง (ตัน)",
  "วันที่ผลิต",
  "หมายเหตุ",
  "ผู้ออกใบสั่งผลิต",
  "ฝ่ายตรวจคุณภาพ",
  "ฝ่ายผลิต",
  "ผู้จัดการ",
  "จัดการ",
];

function quantity(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  const id = useId();
  // NAN_PRODUCTION_V1_THAI_DATE: keep ISO values, render Buddhist calendar.
  if (type === "date") {
    return (
      <div className="min-w-0 [&>div>label]:leading-none">
        <ThaiBuddhistDatePicker label={label} value={value} onChange={onChange} placeholder={placeholder} />
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DocumentSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-[#1e3868]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ProductProductionOrdersV1Workspace() {
  const [tab, setTab] = useState("form");
  const [date, setDate] = useState<string>(() => todayInBangkok());
  const [location, setLocation] = useState("");
  const draftBaseline = useRef({ date, location });
  const [formula, setFormula] = useState("");
  const [mixingReference, setMixingReference] = useState("");
  const { state: bom, loading: formulasLoading, error: formulasError } = useBOM();
  const { data, loading, error, refresh } = useProductionV1Data<{ documents: ManagedProductionOrder[]; produced: Record<string, number> }>("order");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ManagedProductionOrder | null>(null);
  const [editing, setEditing] = useState<ManagedProductionOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedProductionOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [printPreview, setPrintPreview] = useState(false);
  const printContent = useRef<HTMLDivElement>(null);
  const printFrame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => { printFrame.current?.remove(); }, []);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ProductionLine[]>([newLine()]);
  const [signers, setSigners] = useState<Signers>({
    preparedBy: "",
    qaOfficer: "",
    productionOfficer: "",
    manager: "",
  });
  const [historySearch, setHistorySearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [docNumberOpen, setDocNumberOpen] = useState(false);
  const [prdCandidate, setPrdCandidate] = useState<PrdCandidate | null>(null);
  const [prdReservation, setPrdReservation] = useState<PrdReservation | null>(null);
  const [prdBusy, setPrdBusy] = useState(false);
  const [prdError, setPrdError] = useState("");
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaSearch, setFormulaSearch] = useState("");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const formulaOptions = bom.formulas.filter((row) => row.status === "ACTIVE").flatMap((row) => {
    const product = bom.masters.find((master) => master.id === row.masterId);
    return product ? [{ row, product }] : [];
  });
  const selectedFormula = formulaOptions.find(({ row }) => row.id === formula);
  const filtered = (data?.documents ?? []).filter((order) =>
    (!historyFrom || order.date >= historyFrom) && (!historyTo || order.date <= historyTo) &&
    `${order.documentNumber} ${order.location} ${order.sheet.lines[0].productName}`.toLowerCase().includes(historySearch.trim().toLowerCase()),
  );
  const historyPages = Math.max(1, Math.ceil(filtered.length / Number(pageSize)));
  const currentPage = Math.min(page, historyPages);
  const historyDateError = Boolean(historyFrom && historyTo && historyFrom > historyTo);
  const activeHistoryFilter = Boolean(historySearch || historyFrom || historyTo);

  async function openPrd() {
    if (prdBusy || saving || prdReservation || editing) return;
    if (!date) { setSaveError("กรุณาเลือกวันที่ก่อนสร้างเลข PRD"); return; }
    setSaveError(""); setPrdError(""); setPrdCandidate(null);
    setDocNumberOpen(true); setPrdBusy(true);
    try {
      setPrdCandidate(await productionRequest<PrdCandidate>("order", { action: "preview_doc_no", date }));
    } catch (issue) { setPrdError(issue instanceof Error ? issue.message : "โหลดเลข PRD ไม่สำเร็จ"); }
    finally { setPrdBusy(false); }
  }

  async function reservePrd() {
    if (prdBusy || !prdCandidate || prdReservation) return;
    setPrdBusy(true); setPrdError("");
    try {
      const result = await productionRequest<PrdReserveResult>("order", { action: "reserve_doc_no", date, expectedDocNo: prdCandidate.docNo });
      if (!result.reserved) {
        setPrdCandidate(result.candidate);
        setPrdError("เลขนี้ถูกจองแล้ว กรุณาตรวจสอบเลขใหม่และกดใช้เลขนี้อีกครั้ง");
        return;
      }
      setPrdReservation(result.reservation); setDocNumberOpen(false);
    } catch (issue) { setPrdError(issue instanceof Error ? issue.message : "จองเลข PRD ไม่สำเร็จ"); }
    finally { setPrdBusy(false); }
  }

  function resetOrderForm() {
    const today = todayInBangkok();
    draftBaseline.current = { date: today, location: "" };
    setEditing(null); setDate(today); setLocation("");
    setPrdReservation(null); setPrdCandidate(null); setPrdError("");
    setFormula(""); setAmount(""); setNote(""); setMixingReference(""); setRows([newLine()]);
    setSigners({ preparedBy: "", qaOfficer: "", productionOfficer: "", manager: "" });
  }

  function beginEdit(order: ManagedProductionOrder) {
    if (saving || deleting || prdBusy) return;
    // Do not silently discard unfinished data or a reserved number.
    const hasDraft = Boolean(editing || prdReservation || date !== draftBaseline.current.date ||
      location !== draftBaseline.current.location || formula || amount || note || mixingReference ||
      Object.values(signers).some(Boolean) || rows.length > 1 ||
      rows.some(({ date, lineT1Qty, lineT1Lot, lineT2Qty, lineT2Lot, lineT4Qty, lineT4Lot, shift, producer }) =>
        [date, lineT1Qty, lineT1Lot, lineT2Qty, lineT2Lot, lineT4Qty, lineT4Lot, shift, producer].some(Boolean)));
    if (hasDraft && !window.confirm(prdReservation
      ? "มีข้อมูลและเลข PRD ที่ยังไม่ได้บันทึก หากเปิดเอกสารอื่น ข้อมูลร่างจะหายและเลขเดิมจะยังถูกจองจนหมดอายุ ต้องการดำเนินการต่อหรือไม่?"
      : "มีข้อมูลที่ยังไม่ได้บันทึก ต้องการเปิดเอกสารอื่นแทนหรือไม่?")) return;
    setEditing(order); setDate(order.date); setLocation(order.location); setFormula(order.formulaId);
    setAmount(order.amount); setNote(order.note); setMixingReference(order.mixingReference);
    setRows(order.rows.map((row) => ({ ...row })));
    setSigners({ ...order.signers }); setPrdReservation(null); setPrdCandidate(null);
    setSaveError(""); setNotice(""); setTab("form");
  }

  function cancelEdit() {
    if (saving || !window.confirm("ยกเลิกการแก้ไขโดยไม่บันทึกหรือไม่?")) return;
    resetOrderForm(); setSaveError(""); setTab("history");
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting || saving) return;
    setDeleting(true); setDeleteError("");
    try {
      await productionRequest<{ id: string; documentNumber: string }>("order", {
        action: "delete", id: deleteTarget.id, expectedRevision: deleteTarget.revision ?? deleteTarget.createdAt,
      });
      if (editing?.id === deleteTarget.id) resetOrderForm();
      setNotice(`ลบ ${deleteTarget.documentNumber} แล้ว`); setDeleteTarget(null); refresh();
    } catch (issue) { setDeleteError(issue instanceof Error ? issue.message : "ลบเอกสารไม่สำเร็จ"); }
    finally { setDeleting(false); }
  }

  function openOrderDetails(order: ManagedProductionOrder, printing = false) {
    setPrintPreview(printing); setView(order);
  }

  function printOrder() {
    if (!printContent.current || !view) return;
    printFrame.current?.remove();
    const iframe = document.createElement("iframe");
    iframe.title = "ใบสั่งผลิตสำหรับพิมพ์";
    iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    const clone = printContent.current.cloneNode(true);
    iframe.onload = () => {
      const target = iframe.contentDocument;
      const targetWindow = iframe.contentWindow;
      if (!target || !targetWindow) return;
      const style = target.createElement("style");
      style.textContent = "@page{size:A4 portrait;margin:12mm}body{font:11px/1.5 system-ui,sans-serif;color:#000}h1,h2{text-align:center}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:5px;border:1px solid #888;text-align:left;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}p,dd{overflow-wrap:anywhere}dt{font-weight:600}dl{display:grid;grid-template-columns:1fr 1fr;gap:8px}dd{margin:0 0 8px}article,section{margin:10px 0}";
      target.head.append(style); target.body.replaceChildren(clone);
      target.title = `ใบสั่งผลิต ${view.documentNumber}`;
      targetWindow.focus(); targetWindow.print();
    };
    iframe.srcdoc = "<!doctype html><html lang='th'><head><meta charset='utf-8'></head><body></body></html>";
    printFrame.current = iframe; document.body.append(iframe);
  }

  async function save() {
    if (saving || prdBusy) return;
    if (!editing && !prdReservation) { setSaveError("กรุณาสร้างและยืนยันใช้เลข PRD ก่อนบันทึก"); return; }
    if (editing && date.slice(0, 7) !== editing.date.slice(0, 7)) { setSaveError("แก้ไขวันที่ข้ามเดือนหรือปีของเลข PRD เดิมไม่ได้"); return; }
    if (!editing && prdReservation && Date.parse(prdReservation.expiresAt) <= Date.now()) {
      setPrdReservation(null); setSaveError("เลข PRD หมดอายุ กรุณาสร้างเลขใหม่"); return;
    }
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const row = { date, location, formulaId: formula, amount, note, mixingReference, rows, signers };
      const result = await productionRequest<ManagedProductionOrder>("order", editing ? {
        action: "edit", id: editing.id, expectedRevision: editing.revision ?? editing.createdAt, row,
      } : {
        action: "save", row: { ...row, reservationId: prdReservation?.reservationId },
      });
      setNotice(`${editing ? "แก้ไข" : "บันทึก"} ${result.documentNumber} แล้ว`);
      if (editing) resetOrderForm();
      else {
        draftBaseline.current = { date, location };
        setPrdReservation(null); setPrdCandidate(null);
        setFormula(""); setAmount(""); setNote(""); setMixingReference(""); setRows([newLine()]);
        setSigners({ preparedBy: "", qaOfficer: "", productionOfficer: "", manager: "" });
      }
      setTab("history");
      refresh();
    } catch (issue) { setSaveError(issue instanceof Error ? issue.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  const produced = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          quantity(row.lineT1Qty) +
          quantity(row.lineT2Qty) +
          quantity(row.lineT4Qty),
        0,
      ),
    [rows],
  );
  const remaining = Math.max(0, quantity(amount) - produced);
  function editRow(id: string, patch: Partial<ProductionLine>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.id !== id) : current,
    );
  }

  return (
    <div className="min-w-0 pb-10 text-[#1e3868]">
      {/* <PageHeader title="ใบสั่งผลิตสินค้า" description="จัดทำและติดตามใบสั่งผลิตสินค้า" /> */}
      {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
      {saveError && <p role="alert" className="mb-4 text-sm text-danger">{saveError}</p>}
      {error && <div className="mb-4 flex items-center gap-2"><p role="alert">{error}</p><Button className="factory-itech-button-primary" onClick={refresh}>ลองใหม่</Button></div>}
      {editing && (
        <DocumentEditBanner
          documentNumber={editing.documentNumber}
          onCancel={cancelEdit}
          disabled={saving || deleting}
        />
      )}
      <Tabs value={tab} onValueChange={setTab} className="mt-3 min-w-0 space-y-3">
        <TabsList aria-label="ใบสั่งผลิตสินค้า" className="factory-itech-theme factory-itech-tabs">
          <TabsTrigger value="form" disabled={loading || saving || deleting}>{editing ? "แก้ไขข้อมูล" : "กรอกข้อมูล"}</TabsTrigger>
          <TabsTrigger value="history" disabled={loading || saving || deleting}>ดูประวัติ</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="min-w-0 space-y-4">
          <DocumentSection
            title={editing ? `แก้ไขใบสั่งงาน ${editing.documentNumber}` : "ใบสั่งงาน"}
            subtitle="ข้อมูลหัวเอกสารและแผนการผลิต"
            action={
              <Button
                type="button"
                className="h-9 factory-itech-button-primary"
                disabled={Boolean(editing)}
                onClick={() => setImportOpen(true)}
              >
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                นำเข้า Excel
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
              <Field label="วันที่" type="date" value={date} onChange={(value) => { if (value !== date) { setPrdReservation(null); setPrdCandidate(null); } setDate(value); }} />
              <div className="min-w-0 space-y-2 md:col-span-2">
                <Label>เลขที่เอกสาร</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={editing?.documentNumber ?? prdReservation?.docNo ?? ""} readOnly placeholder="กรุณาสร้างเลข PRD" className="min-w-0 flex-1 bg-muted/40" />
                  <Button
                    type="button"
                    variant="outline"
                    className="factory-itech-button-outline"
                    disabled={prdBusy || saving || Boolean(editing)}
                    onClick={() => { if (prdReservation) { setPrdReservation(null); setPrdCandidate(null); } else { void openPrd(); } }}
                  >
                    {editing ? "เลขเดิม" : prdReservation ? "ล้างเลข PRD" : "สร้างเลข PRD"}
                  </Button>
                </div>
              </div>
              <Field
                label="สถานที่"
                value={location}
                onChange={setLocation}
                placeholder="เลือกหรือพิมพ์สถานที่ผลิต"
              />
              <div className="min-w-0 space-y-2">
                <Label>ผลิตปุ๋ย</Label>
                <div className="flex gap-2">
                  <Input
                    value={editing && formula === editing.formulaId ? `${editing.sheet.lines[0].productName} · ${editing.sheet.lines[0].formulaCode} ${editing.sheet.lines[0].formulaVersion}` : selectedFormula ? `${selectedFormula.product.name} · ${selectedFormula.row.code} ${selectedFormula.row.version}` : ""}
                    readOnly
                    placeholder="ค้นหาสูตรปุ๋ย"
                  />
                  <Button className="factory-itech-button-outline"
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormulaOpen(true)}
                    aria-label="ค้นหาสูตรปุ๋ย"
                    title="ค้นหาสูตรปุ๋ย"
                  >
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>
              <Field
                label="จำนวน (ตัน)"
                type="number"
                value={amount}
                onChange={setAmount}
                placeholder="0.000"
              />
              <div className="min-w-0 space-y-2">
                <Label>ยอดค้าง (ตัน)</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{remaining.toFixed(3)}</span>
                    <span className="text-xs text-muted-foreground">ตัน</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ผลิตแล้ว {produced.toFixed(3)} ตัน / แผน {quantity(amount).toFixed(3)} ตัน
                  </p>
                </div>
              </div>
              <div className="min-w-0 space-y-2 md:col-span-7">
                <Label>อ้างอิงเอกสาร ใบรายงานผสมปุ๋ยผง</Label>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <Input
                    value={mixingReference}
                    onChange={(event) => setMixingReference(event.target.value)}
                    placeholder="กรอกเลขที่ใบรายงานผสมปุ๋ยผง (ถ้ามี)"
                    className="min-w-0 flex-1 bg-muted/40"
                  />
                  <Button
                    type="button"
                    className="factory-itech-button-primary"
                    onClick={() => setReferenceOpen(true)}
                  >
                    <Link2 className="size-4" aria-hidden="true" />
                    ผูกกับ ใบรายงานผสมปุ๋ยผง
                  </Button>
                  <Button className="factory-itech-button-outline" type="button" variant="outline" disabled={!mixingReference} onClick={() => setMixingReference("")}>ล้างเลขอ้างอิง</Button>
                </div>
              </div>
            </div>
          </DocumentSection>

          <DocumentSection
            title={
              <span className="flex flex-wrap items-center gap-2">
                รายละเอียดผลผลิต (ดูอย่างเดียว)
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  <LockKeyhole className="size-3" aria-hidden="true" />
                  รอข้อมูลต้นทาง
                </span>
              </span>
            }
            subtitle="ข้อมูลจริงมาจากใบรายงานผสมปุ๋ยผงเมื่อเชื่อมระบบ"
          >
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <Table className="min-w-250 border-collapse">
                <TableHeader className="bg-gray-100 text-gray-700">
                  <TableRow className="hover:bg-gray-100">
                    <TableHead rowSpan={3} className="w-44 border-r text-center">วันที่ผลิต</TableHead>
                    <TableHead colSpan={6} className="border-r text-center">เครื่องจักร</TableHead>
                    <TableHead rowSpan={3} className="border-r text-center">กะที่ผลิต</TableHead>
                    <TableHead rowSpan={3} className="border-r text-center">ลงชื่อ/ผลิต</TableHead>
                    <TableHead rowSpan={3} className="w-16 text-center">ลบ</TableHead>
                  </TableRow>
                  <TableRow className="hover:bg-gray-100">
                    {["LINE - T1", "LINE - T2", "LINE - T4"].map((line) => (
                      <TableHead key={line} colSpan={2} className="border-r text-center">{line}</TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-gray-100">
                    {["จำนวน/ตัน", "Lot.ที่ผลิต", "จำนวน/ตัน", "Lot.ที่ผลิต", "จำนวน/ตัน", "Lot.ที่ผลิต"].map(
                      (title, index) => (
                        <TableHead key={`${title}-${index}`} className="border-r text-center">
                          {title}
                        </TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id}>
                      {(
                        [
                          ["date", "date", "วันที่ผลิต"],
                          ["lineT1Qty", "number", "จำนวน LINE T1"],
                          ["lineT1Lot", "text", "Lot LINE T1"],
                          ["lineT2Qty", "number", "จำนวน LINE T2"],
                          ["lineT2Lot", "text", "Lot LINE T2"],
                          ["lineT4Qty", "number", "จำนวน LINE T4"],
                          ["lineT4Lot", "text", "Lot LINE T4"],
                          ["shift", "text", "กะที่ผลิต"],
                          ["producer", "text", "ลงชื่อผู้ผลิต"],
                        ] as const
                      ).map(([key, type, label]) => (
                        <TableCell key={key} className="border-r p-2">
                          {type === "date" ? (
                            <div className="factory-itech-date-cell min-w-36">
                              <ThaiBuddhistDatePicker
                                label={`${label} แถว ${index + 1}`}
                                value={row[key]}
                                onChange={(value) => editRow(row.id, { [key]: value })}
                              />
                            </div>
                          ) : (
                            <Input
                              aria-label={`${label} แถว ${index + 1}`}
                              type={type}
                              min={type === "number" ? "0" : undefined}
                              step={type === "number" ? "0.001" : undefined}
                              value={row[key]}
                              onChange={(event) => editRow(row.id, { [key]: event.target.value })}
                              placeholder={type === "number" ? "0" : undefined}
                              className="min-w-28"
                            />
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={rows.length === 1}
                          onClick={() => removeRow(row.id)}
                          aria-label={`ลบแถวผลิต ${index + 1}`}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              type="button"
              className="mt-3 factory-itech-button-primary"
              onClick={() => setRows((current) => [...current, newLine()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              เพิ่มแถวผลิต
            </Button>
            <div className="mt-5 space-y-2">
              <Label htmlFor="production-order-note">หมายเหตุ — แก้ไขได้</Label>
              <Textarea
                id="production-order-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="พิมพ์ข้อความที่นี่..."
                className="min-h-28 resize-y"
              />
            </div>
          </DocumentSection>

          <DocumentSection title="รายชื่อผู้ลงนาม">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {signerFields.map((field) => (
                <div key={field.key} className="space-y-3 rounded-xl border p-4">
                  <Label htmlFor={`signer-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`signer-${field.key}`}
                    value={signers[field.key]}
                    onChange={(event) =>
                      setSigners((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    placeholder="ชื่อ-สกุล"
                  />
                </div>
              ))}
            </div>
          </DocumentSection>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {editing ? "แก้ไขข้อมูลโดยใช้เลข PRD เดิม (วันที่ต้องอยู่ในเดือนและปีเดิม)" : "กรุณายืนยันใช้เลข PRD ก่อนบันทึก (เลขจองมีอายุ 24 ชั่วโมง)"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={saving || prdBusy || ((!editing || formula !== editing.formulaId) && (formulasLoading || Boolean(formulasError)))} onClick={() => void save()} className="h-10 px-6 factory-itech-button-primary">
                {saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึก"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="min-w-0">
          <Card className="factory-itech-theme min-w-0 gap-0 rounded-xl border bg-card py-0 text-foreground shadow-sm">
            <CardHeader className="border-b px-4 py-3 [.border-b]:pb-3">
              <CardTitle className="text-base font-semibold"><h2>ข้อมูลที่บันทึก</h2></CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 space-y-3 p-4">
              <div className="grid items-start gap-3 sm:grid-cols-2 @[900px]/main:grid-cols-[1.35fr_1fr_1fr_0.65fr]">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="history-search" className="leading-relaxed">ค้นหา</Label>
                  <Input id="history-search" className="h-9 rounded-lg" value={historySearch}
                    onChange={(event) => { setHistorySearch(event.target.value); setPage(1); }}
                    placeholder="ค้นหา (เลขที่เอกสาร/โรงงาน/สูตรปุ๋ย)" />
                </div>
                <div className="min-w-0 [&>div>label]:leading-relaxed [&>div>button]:h-9 [&>div>button]:rounded-lg">
                  <ThaiBuddhistDatePicker label="จากวันที่" value={historyFrom}
                    onChange={(value) => { setHistoryFrom(value); setPage(1); }} />
                </div>
                <div className="min-w-0 [&>div>label]:leading-relaxed [&>div>button]:h-9 [&>div>button]:rounded-lg">
                  <ThaiBuddhistDatePicker label="ถึงวันที่" value={historyTo}
                    onChange={(value) => { setHistoryTo(value); setPage(1); }}
                    error={historyDateError ? "วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น" : undefined} />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="history-page-size" className="leading-relaxed">ต่อหน้า</Label>
                  <Select value={pageSize} onValueChange={(value) => { setPageSize(value); setPage(1); }}>
                    <SelectTrigger id="history-page-size" className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["5", "10", "20", "50", "100"].map((size) => (
                        <SelectItem key={size} value={size}>{size} รายการ</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Table className="min-w-[1780px] table-fixed text-foreground" containerProps={{ className: "rounded-lg border", role: "region", "aria-label": "ตารางประวัติใบสั่งผลิตสินค้า เลื่อนแนวนอนเพื่อดูข้อมูล", tabIndex: 0 }}>
                <TableHeader>
                  <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
                    {historyColumns.map((label, index) => (
                      <TableHead key={label} className={`h-11 whitespace-nowrap px-4 py-3 text-sm font-semibold text-white ${index === 0 ? "w-20" : index === historyColumns.length - 1 ? "w-28 text-center" : index >= 5 && index <= 7 ? "text-right" : ""}`}>
                        {index === 0 ? <span className="flex items-center gap-3"><Checkbox disabled aria-label="เลือกทั้งหมด" />{label}</span> : label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice((currentPage - 1) * Number(pageSize), currentPage * Number(pageSize)).map((order, index) => {
                    const actual = data?.produced[order.id] ?? 0;
                    const values = [
                      (currentPage - 1) * Number(pageSize) + index + 1,
                      order.documentNumber,
                      order.location,
                      order.date ? formatThaiDate(order.date) || order.date : "—",
                      order.sheet.lines[0].productName,
                      order.amount,
                      actual.toFixed(3),
                      Math.max(0, Number(order.amount) - actual).toFixed(3),
                      order.rows.filter((row) => row.date).map((row) => formatThaiDate(row.date) || row.date).join(", ") || "—",
                      order.note || "—",
                      order.signers.preparedBy,
                      order.signers.qaOfficer,
                      order.signers.productionOfficer,
                      order.signers.manager,
                    ];
                    return (
                      <TableRow key={order.id} className="border-border/60 hover:bg-muted/40">
                        {values.map((value, columnIndex) => (
                          <TableCell key={historyColumns[columnIndex]} className={`whitespace-normal wrap-break-word px-4 py-3 align-top text-sm ${columnIndex >= 5 && columnIndex <= 7 ? "text-right tabular-nums" : ""}`}>
                            {columnIndex === 1 ? (
                              <Button type="button" variant="link" className="block h-auto w-full overflow-hidden text-ellipsis whitespace-nowrap p-0 text-left font-medium text-foreground" title={order.documentNumber} onClick={() => openOrderDetails(order)}>{order.documentNumber}</Button>
                            ) : value}
                          </TableCell>
                        ))}
                        <TableCell className="px-4 py-3 text-center align-top text-sm">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-xl border-[#a6bf49] bg-muted/40 px-2.5 text-xs font-medium text-[#173b63]! shadow-none hover:bg-muted hover:text-[#173b63]! data-[state=open]:border-[#a6bf49] data-[state=open]:bg-muted dark:text-foreground! dark:hover:text-foreground!" aria-label={`จัดการ ${order.documentNumber}`}>
                                จัดการ <ChevronDown aria-hidden="true" className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={8} className="w-52 max-w-[calc(100vw-24px)] rounded-xl border bg-card p-1.5 text-foreground shadow-md">
                              <DropdownMenuItem className="min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground" onSelect={() => openOrderDetails(order)}>
                                <Eye aria-hidden="true" className="size-4 text-current" />ดูรายละเอียด
                              </DropdownMenuItem>
                              <DropdownMenuItem className="min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground" disabled={saving || deleting || prdBusy} onSelect={() => beginEdit(order)}>
                                <Pencil aria-hidden="true" className="size-4 text-current" />แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem className="min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm focus:bg-muted focus:text-foreground" onSelect={() => openOrderDetails(order, true)}>
                                <Printer aria-hidden="true" className="size-4 text-current" />พิมพ์เอกสาร
                              </DropdownMenuItem>
                              <DropdownMenuItem className="min-h-10 cursor-pointer gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive" disabled={saving || deleting || prdBusy} onSelect={() => { setDeleteError(""); setDeleteTarget(order); }}>
                                <Trash2 aria-hidden="true" className="size-4 text-current" />ลบเอกสาร
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filtered.length && (
                    <TableRow><TableCell colSpan={historyColumns.length} className="py-12 text-center text-sm text-muted-foreground">
                      {loading ? "กำลังโหลดข้อมูล..." : historyDateError ? "กรุณาตรวจสอบช่วงวันที่" : "ไม่พบข้อมูลตามเงื่อนไข"}
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p role="status">ทั้งหมด <strong>{filtered.length}</strong> รายการ{activeHistoryFilter && <span className="ml-1 text-muted-foreground">(จาก {data?.documents.length ?? 0})</span>}</p>
                <div className="flex items-center gap-2">
                  <Button className="factory-itech-button-outline" type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</Button>
                  <span className="whitespace-nowrap">หน้า {currentPage} / {historyPages}</span>
                  <Button className="factory-itech-button-outline" type="button" variant="outline" size="sm" disabled={currentPage >= historyPages} onClick={() => setPage(currentPage + 1)}>ถัดไป</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={view !== null} onOpenChange={(open) => { if (!open) setView(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{printPreview ? "พิมพ์เอกสาร · " : ""}{view?.documentNumber}</DialogTitle>
            <DialogDescription>ใบสั่งผลิต V1 · {view?.location}</DialogDescription>
          </DialogHeader>
          {view && <div ref={printContent} className="space-y-3">
            {printPreview && <header className="text-center"><h1 className="text-lg font-semibold">ใบสั่งผลิตสินค้า {view.documentNumber}</h1><p>สถานที่: {view.location} · วันที่: {formatThaiDate(view.date) || view.date}</p></header>}
            <ProductionFormulaDocument sheet={view.sheet} thaiDates />
            {view.mixingReference && <p>อ้างอิงใบรายงานผสมปุ๋ยผง {view.mixingReference}</p>}
            {view.note && <p>หมายเหตุ {view.note}</p>}
            <dl className="grid gap-2 sm:grid-cols-2">{signerFields.map(({ key, label }) => (
              <div key={key}><dt>{label}</dt><dd>{view.signers[key] || "—"}</dd></div>
            ))}</dl>
            <Table><TableHeader><TableRow>{["วันที่ผลิต", "T1 (ตัน) / Lot", "T2 (ตัน) / Lot", "T4 (ตัน) / Lot", "กะ", "ผู้ผลิต"].map((label) => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{view.rows.map((row) => <TableRow key={row.id}>
                <TableCell>{formatThaiDate(row.date) || row.date || "—"}</TableCell>
                <TableCell>{row.lineT1Qty || "—"} / {row.lineT1Lot || "—"}</TableCell>
                <TableCell>{row.lineT2Qty || "—"} / {row.lineT2Lot || "—"}</TableCell>
                <TableCell>{row.lineT4Qty || "—"} / {row.lineT4Lot || "—"}</TableCell>
                <TableCell>{row.shift || "—"}</TableCell><TableCell>{row.producer || "—"}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>}
          {printPreview && <DialogFooter><Button type="button" className="factory-itech-button-primary" onClick={printOrder}><Printer className="size-4" />พิมพ์เอกสาร</Button></DialogFooter>}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="gap-0 rounded-xl bg-card p-0 sm:max-w-md [&>button]:text-white">
          <DialogHeader className="rounded-t-xl bg-[#173b63] px-5 py-4 text-left text-white">
            <DialogTitle className="text-white">ยืนยันลบเอกสาร</DialogTitle>
            <DialogDescription className="text-white/80">ใบสั่งผลิต {deleteTarget?.documentNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-5 text-sm">
            <p>ต้องการลบเอกสารนี้ออกจากรายการใช้งานหรือไม่? เลข PRD ที่เคยใช้แล้วจะไม่ถูกนำกลับมาใช้อีก</p>
            <p className="text-muted-foreground">เอกสารที่มีรายงานการผลิตหรือใบรับยอดผลิตอ้างอิงอยู่จะไม่สามารถลบได้</p>
            {deleteError && <p role="alert" className="text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <Button type="button" variant="outline" className="factory-itech-button-outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>ยกเลิก</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? "กำลังลบ…" : "ลบเอกสาร"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={docNumberOpen}
        onOpenChange={(open) => { if (!prdBusy) setDocNumberOpen(open); }}
      >
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-xl bg-card p-0 sm:max-w-5xl [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="rounded-t-xl bg-[#173b63] px-5 py-4 text-left text-white">
            <DialogTitle className="text-base font-semibold text-white">
              สร้างหมายเลข PRD
            </DialogTitle>

            <DialogDescription className="text-white/80">
              เลข PRD จะถูกจองจริงหลังจากกดใช้เลขนี้
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-5">
            {/* Document Number */}

            <div className="space-y-2">
              <Label>เลขที่ใบสั่งผลิต</Label>

              <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 text-lg font-bold text-[#173b63] dark:text-foreground">
                {prdBusy && !prdCandidate ? "กำลังโหลดเลข PRD…" : prdCandidate?.docNo ?? "-"}
              </div>
            </div>

            {/* Document Number Components */}

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-7">
              {[
                ["สัญลักษณ์ที่ 1", "P"],
                ["สัญลักษณ์ที่ 2", "R"],
                ["สัญลักษณ์ที่ 3", "D"],
                ["สัญลักษณ์ที่ 4", "-"],
                ["ปี", prdCandidate?.yy ?? "-"],
                ["เดือน", prdCandidate?.mm ?? "-"],
                ["ลำดับหมายเลข", prdCandidate ? String(prdCandidate.seq).padStart(3, "0") : "-"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 space-y-2"
                >
                  <Label>{label}</Label>

                  <Input
                    value={value}
                    readOnly
                    className="h-9 rounded-lg bg-muted/30"
                  />
                </div>
              ))}
            </div>

            {/* Information */}

            <p className="rounded-lg border border-[#173b63]/10 bg-[#173b63]/5 px-4 py-3 text-sm text-[#173b63] dark:text-foreground">
              ถ้าปิด Modal โดยไม่กดใช้เลขนี้ ระบบจะยังไม่จองเลขลงฐานข้อมูล
            </p>
            {prdError && <p role="alert" className="text-sm text-destructive">{prdError}</p>}
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="factory-itech-button-outline"
                disabled={prdBusy}
              >
                ปิด
              </Button>
            </DialogClose>
            <Button type="button" className="factory-itech-button-primary" disabled={prdBusy || !prdCandidate} onClick={() => void reservePrd()}>
              {prdBusy ? "กำลังดำเนินการ…" : "ใช้เลขนี้"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto rounded-xl bg-card p-0 sm:max-w-5xl [&>button]:text-white [&>button]:opacity-100">
          <DialogHeader className="rounded-t-xl bg-[#173b63] px-5 py-4 text-left text-white">
            <DialogTitle className="text-base font-semibold text-white">
              เลือกสูตรจาก BOM
            </DialogTitle>

            <DialogDescription className="text-white/80">
              เลือกสินค้าหลักเพื่อใช้สูตรค่าเริ่มต้น หรือเลือกเวอร์ชันอื่น
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-5">
            <Input
              value={formulaSearch}
              onChange={(event) => setFormulaSearch(event.target.value)}
              placeholder="ค้นหาด้วยรหัสสินค้า ชื่อสินค้า หรือประเภทการใช้งาน"
              className="h-9 rounded-lg"
            />

            <div className="overflow-hidden rounded-lg border">
              <Table className="min-w-190 text-foreground">
                <TableHeader>
                  <TableRow className="border-0 bg-[#173b63] hover:bg-[#173b63]">
                    {[
                      "รหัสสินค้า",
                      "สินค้าหลัก",
                      "ประเภทการใช้งาน",
                      "สูตรค่าเริ่มต้น",
                      "การทำงาน",
                    ].map((title) => (
                      <TableHead
                        key={title}
                        className="h-11 whitespace-nowrap px-4 py-3 font-semibold text-white"
                      >
                        {title}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {formulaOptions
                    .filter(({ row, product }) =>
                      `${row.code} ${row.name} ${product.code} ${product.name}`
                        .toLowerCase()
                        .includes(formulaSearch.trim().toLowerCase()),
                    )
                    .map(({ row, product }) => (
                      <TableRow
                        key={row.id}
                        className="border-border/60 hover:bg-muted/40"
                      >
                        <TableCell className="px-4 py-3">
                          {product.code}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          {product.name}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          {product.usageType || "—"}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          {row.code} · {row.version}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          <Button
                            type="button"
                            className="factory-itech-button-outline"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFormula(row.id);
                              setFormulaOpen(false);
                            }}
                          >
                            เลือกสูตร
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                  {(!formulaOptions.length || formulasError) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-28 text-center text-muted-foreground"
                      >
                        {formulasError ||
                          (formulasLoading
                            ? "กำลังโหลดสูตร…"
                            : "ยังไม่มีสูตร BOM ที่เปิดใช้งาน")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button
                type="button"
                className="factory-itech-button-outline"
                variant="outline"
              >
                ปิด
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referenceOpen} onOpenChange={(open) => { setReferenceOpen(open); if (!open) setReferenceDate(""); }}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle className="text-xl text-[#84CAED]">
              เลือก ใบรายงานผสมปุ๋ยผง
            </DialogTitle>
            <DialogDescription>
              ใบสั่งผลิต - · เลือกแล้ว 0 เอกสาร
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5">
            <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={referenceSearch}
                  onChange={(event) => setReferenceSearch(event.target.value)}
                  placeholder="ค้นหาวันที่ / สถานที่ / สูตรปุ๋ย / Lot / กะ / รถตัก"
                  className="h-11 pl-10"
                />
              </div>
              <div className="min-w-0 [&>div>label]:sr-only [&>div>button]:h-11">
                <ThaiBuddhistDatePicker label="กรองตามวันที่" value={referenceDate} onChange={setReferenceDate} />
              </div>
            </div>
            <p className="text-sm text-gray-500">พบ 0 รายการ</p>
            <div className="rounded-xl border bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              ยังไม่พบเอกสาร ใบรายงานผสมปุ๋ยผง สำหรับเลือกอ้างอิง
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-4 sm:justify-between">
            <span className="text-sm text-gray-600">เลือกแล้ว 0 เอกสาร</span>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button className="factory-itech-button-outline" variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button disabled className="factory-itech-button-primary">
                ยืนยันเลือก (0)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="p-0 sm:max-w-4xl">
          <DialogHeader className="bg-[#84CAED] px-5 py-4 text-left text-white">
            <DialogTitle>ตรวจสอบรายการนำเข้า Excel</DialogTitle>
            <DialogDescription className="text-white/90">
              ตรวจสอบข้อมูลก่อนยืนยันนำเข้า
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-6 text-center">
            <FileSpreadsheet className="mx-auto size-9 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium text-[#1e3868]">ยังไม่ได้เลือกไฟล์ Excel</p>
            <p className="mt-1 text-sm text-gray-500">
              การอ่านและนำเข้าไฟล์จะเปิดใช้เมื่อเชื่อมระบบข้อมูล
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button className="factory-itech-button-outline" variant="outline">ปิด</Button>
            </DialogClose>
            <Button disabled className="factory-itech-button-primary">
              ยืนยันนำเข้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
