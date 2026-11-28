"use client";
import { useState } from "react";
import {
  Plus,
  Filter,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  ArrowRight,
  PackagePlus,
  ClipboardList,
  FlaskConical,
  Eye,
  Pencil,
  Package,
  Layers3,
  FileQuestion,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  // DialogClose,
} from "@/src/components/ui/dialog";
import {
  PageHeader,
  SelectField,
  FactoryDataTable,
  EmptyState,
  type Column,
} from "@/src/components/factory/patterns";
import { dateTime } from "@/src/lib/formatters";
import { useBOM } from "./bom-provider";
import { productTypes, formulaStatuses, canHaveFormula, type Master } from "./bom-domain";
import { BOMMasterForm } from "./bom-master-form";
import { BOMFormulaForm } from "./bom-formula-form";
import {
  BOMMasterDetail,
  BOMFormulaDetail,
} from "./bom-formula-detail";
import { BOMExcelActions } from "./bom-excel-import";

type Panel =
  | { type: "master" | "masterEdit"; id?: string }
  | { type: "formulaNew"; masterId: string }
  | { type: "formula" | "formulaEdit"; id: string }
  | null;
const initialFilters = {
  search: "",
  type: "all",
  company: "all",
  process: "all",
  category: "all",
  brand: "all",
  department: "all",
  status: "all",
  unit: "all",
  availability: "all",
};
const metadata = {
  company: "บริษัท",
  process: "กระบวนการผลิต",
  category: "หมวดสินค้า",
  brand: "แบรนด์",
  department: "ฝ่าย / แผนก",
  unit: "หน่วย",
} as const;
export function BOMList() {
  const { state, loading, error, retry, removeMaster } = useBOM();
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [message, setMessage] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const filtered = state.masters.filter((m) => {
    const formulas = state.formulas.filter((f) => f.masterId === m.id);
    return (
      `${m.code} ${m.name}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()) &&
      (filters.type === "all" || filters.type === m.type) &&
      Object.keys(metadata).every(
        (key) =>
          filters[key as keyof typeof metadata] === "all" ||
          filters[key as keyof typeof metadata] ===
          m[key as keyof typeof metadata],
      ) &&
      (filters.status === "all" ||
        formulas.some((f) => f.status === filters.status)) &&
      (filters.availability === "all" ||
        (filters.availability === "has"
          ? formulas.length > 0
          : filters.availability === "none"
            ? formulas.length === 0
            : !m.defaultFormulaId))
    );
  });
  const total = filtered.length;
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(total / Number(pageSize))),
  );
  const rows = filtered.slice((current - 1) * Number(pageSize), current * Number(pageSize));
  const masterFormulas = (m: Master) =>
    state.formulas.filter((f) => f.masterId === m.id);
  const columns: Column<Master>[] = [
    {
      key: "code",
      label: "รหัสสินค้า",
      width: 260,
      render: (m) => (
        <Button
          variant="link"
          className="h-auto p-0 text-sm font-bold text-primary dark:text-foreground"
          onClick={() => setPanel({ type: "master", id: m.id })}
        >
          {m.code}
        </Button>
      ),
    },
    {
      key: "name",
      label: "ชื่อสินค้า / วัตถุดิบ",
      width: 260,
      render: (m) => (
        <span className="block min-w-48 max-w-72 font-medium">{m.name}</span>
      ),
    },
    {
      key: "type",
      label: "ประเภท",
      width: 170,
      render: (m) => (
        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{productTypes[m.type]}</span>
      ),
    },
    { key: "usage", label: "ประเภทการใช้งาน", width: 180, render: (m) => <span className="text-muted-foreground">{m.usageType || "—"}</span> },
    {
      key: "default",
      label: "สูตรค่าเริ่มต้น",
      width: 180,
      render: (m) => {
        const f = state.formulas.find((r) => r.id === m.defaultFormulaId);
        return f ? (
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-bold text-primary dark:text-foreground"
            onClick={() => setPanel({ type: "formula", id: f.id })}
          >
            {f.code}
          </Button>
        ) : (
          <span className="text-muted-foreground">ยังไม่กำหนด</span>
        );
      },
    },
    {
      key: "count",
      label: "จำนวนสูตร",
      width: 180,
      render: (m) => <span className="block text-center tabular-nums">{masterFormulas(m).length} สูตร</span>,
    },
    {
      key: "status",
      label: "สถานะ",
      width: 190,
      render: (m) => {
        const statuses = [...new Set(masterFormulas(m).map((f) => f.status))];
        return statuses.length ? (
          <div className="flex flex-wrap gap-1">
            {statuses.map((s) => (
              <span key={s} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${s === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : s === "DRAFT" ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"}`}>{formulaStatuses[s]}</span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่มีสูตร</span>
        );
      },
    },
    {
      key: "updated",
      label: "อัปเดตล่าสุด",
      width: 180,
      render: (m) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{dateTime(m.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      label: "การทำงาน",
      width: 210,
      render: (m) => (
        <div className="flex flex-nowrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-lg border-[#173b63] bg-card text-[#173b63] shadow-none hover:bg-primary/5 dark:text-foreground"
            aria-label={`ดูรายละเอียด ${m.code}`}
            title="ดูรายละเอียด"
            onClick={() =>
              setPanel({ type: "master", id: m.id })
            }
          >
            <Eye aria-hidden="true" className="size-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={m.id.startsWith("settings-")}
            className="size-9 shrink-0 rounded-lg bg-card text-[#173b63] shadow-none hover:border-[#173b63] hover:bg-primary/5 dark:text-foreground"
            aria-label={`แก้ไข ${m.code}`}
            title="แก้ไขข้อมูลหลัก"
            onClick={() =>
              setPanel({ type: "masterEdit", id: m.id })
            }
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!canHaveFormula(m)}
            className="size-9 shrink-0 rounded-lg bg-card text-[#173b63] shadow-none hover:border-[#173b63] hover:bg-primary/5 dark:text-foreground"
            aria-label={`เพิ่มสูตร ${m.code}`}
            title="เพิ่มสูตร"
            onClick={() =>
              setPanel({ type: "formulaNew", masterId: m.id })
            }
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>

          <ConfirmDialog
            title={`ลบข้อมูลหลัก ${m.code}?`}
            description="จะลบได้เฉพาะรายการที่ไม่มีสูตรและไม่ถูกใช้เป็นส่วนประกอบ ไม่มีการลบสูตรแบบต่อเนื่อง"
            trigger={
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={m.id.startsWith("settings-")}
                className="size-9 shrink-0 rounded-lg border-rose-200 bg-card text-rose-600 shadow-none hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950"
                aria-label={`ลบรายการ ${m.code}`}
                title="ลบรายการหลัก"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </Button>
            }
            onConfirm={async () => {
              setDeleteError("");

              try {
                await removeMaster(m.id);
                setMessage(`ลบข้อมูลหลัก ${m.code} แล้ว`);
              } catch (e) {
                setDeleteError(
                  e instanceof Error
                    ? e.message
                    : "ไม่สามารถลบข้อมูลหลักได้",
                );
              }
            }}
          />
        </div>
      ),
    },
  ];
  function renderPanel() {
    if (!panel) return null;
    if (panel.type === "masterEdit" && !panel.id)
      return (
        <BOMMasterForm
          onSaved={(id) => {
            setPanel({ type: "master", id });
            setMessage("สร้างข้อมูลหลักแล้ว");
          }}
          onClose={() => setPanel(null)}
        />
      );
    if (panel.type === "master" || panel.type === "masterEdit") {
      const master = state.masters.find((m) => m.id === panel.id);
      if (!master) return <EmptyState title="ไม่พบข้อมูลหลักนี้แล้ว" />;
      return panel.type === "masterEdit" ? (
        <BOMMasterForm
          initial={master}
          onSaved={(id) => {
            setPanel({ type: "master", id });
            setMessage("แก้ไขข้อมูลหลักแล้ว");
          }}
          onClose={() => setPanel({ type: "master", id: master.id })}
        />
      ) : (
        <BOMMasterDetail
          master={master}
          onEdit={() => setPanel({ type: "masterEdit", id: master.id })}
          onNewFormula={() =>
            setPanel({ type: "formulaNew", masterId: master.id })
          }
          onViewFormula={(id) => setPanel({ type: "formula", id })}
          onDeleted={() => {
            setPanel(null);
            setMessage("ลบข้อมูลหลักแล้ว");
          }}
        />
      );
    }
    if (panel.type === "formulaNew") {
      const master = state.masters.find((m) => m.id === panel.masterId);
      return master ? (
        <BOMFormulaForm
          master={master}
          onSaved={(id) => {
            setPanel({ type: "formula", id });
            setMessage("สร้างเวอร์ชันสูตรใหม่แล้ว");
          }}
          onClose={() => setPanel({ type: "master", id: master.id })}
        />
      ) : (
        <EmptyState title="ไม่พบสินค้าต้นทาง" />
      );
    }
    const formula = state.formulas.find((f) => f.id === panel.id);
    const master = state.masters.find((m) => m.id === formula?.masterId);
    if (!formula || !master) return <EmptyState title="ไม่พบสูตรนี้แล้ว" />;
    return panel.type === "formulaEdit" ? (
      <BOMFormulaForm
        master={master}
        initial={formula}
        onSaved={(id) => {
          setPanel({ type: "formula", id });
          setMessage("แก้ไขสูตรแล้ว");
        }}
        onClose={() => setPanel({ type: "formula", id: formula.id })}
      />
    ) : (
      <BOMFormulaDetail
        master={master}
        formula={formula}
        onEdit={() => setPanel({ type: "formulaEdit", id: formula.id })}
        onBack={() => setPanel({ type: "master", id: master.id })}
      />
    );
  }
  return (
    <div className="factory-itech-theme min-w-0 space-y-5">
      <PageHeader
        title="สูตรผสมวัตถุดิบ (BOM)"
        description="จัดการสินค้า วัตถุดิบ และสูตรการผลิตแต่ละเวอร์ชัน"
        actions={
          <>
            <div className="relative min-w-0 w-full sm:w-72">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="bom-search" aria-label="ค้นหาสินค้า / วัตถุดิบ" placeholder="ค้นหารหัสสินค้า หรือชื่อสินค้า..." value={draft.search} onChange={(e) => {
                const search = e.target.value;
                setDraft((previous) => ({ ...previous, search }));
                setFilters((previous) => ({ ...previous, search }));
                setPage(1);
              }} className="h-12 rounded-xl bg-card pl-10" />
            </div>
            <BOMExcelActions onImported={() => { setPage(1); setMessage("นำเข้าข้อมูลสำเร็จ"); }} />
            <Button className="h-12 rounded-xl factory-itech-button-primary" disabled={loading || Boolean(error)} onClick={() => setPanel({ type: "masterEdit" })}>
              <Plus />
              เพิ่มรายการหลัก
            </Button>
          </>
        }
      />
      {error && <div><p role="alert">{error}</p><Button onClick={retry}>ลองใหม่</Button></div>}
      <section aria-label="ขั้นตอนการจัดการสูตร" className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_32px_1fr_32px_1fr]">
          {[
            { title: "สร้างรายการหลัก", description: "กำหนดสินค้า วัตถุดิบ หรือสินค้ากึ่งสำเร็จรูป", icon: PackagePlus },
            { title: "เพิ่มสูตรการผลิต", description: "สร้างเวอร์ชันและส่วนประกอบของแต่ละสูตร", icon: ClipboardList },
            { title: "ดูและจัดการสูตร", description: "ตรวจสอบ แก้ไข และกำหนดสถานะการใช้งาน", icon: FlaskConical },
          ].map(({ title, description, icon: Icon }, index) => (
            <div key={title} className={`flex gap-3 rounded-2xl border p-4 ${index === 0 ? "lg:col-start-1" : index === 1 ? "lg:col-start-3" : "lg:col-start-5"} ${index === 1 ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300" : "border-primary/20 bg-primary/5 text-primary dark:text-foreground"}`}>
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
                <Icon aria-hidden="true" className="size-6" />
                <span className="absolute -left-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#173b63] text-[10px] font-bold text-white">{index + 1}</span>
              </div>
              <div><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
            </div>
          ))}
          <div className="hidden items-center justify-center text-muted-foreground lg:col-start-2 lg:row-start-1 lg:flex"><ArrowRight aria-hidden="true" className="size-5" /></div>
          <div className="hidden items-center justify-center text-muted-foreground lg:col-start-4 lg:row-start-1 lg:flex"><ArrowRight aria-hidden="true" className="size-5" /></div>
        </div>
      </section>
      <section aria-label="สรุปข้อมูล BOM" className="grid overflow-hidden rounded-3xl border bg-card shadow-sm sm:grid-cols-3 sm:divide-x">
        {[
          { label: "รายการหลักทั้งหมด", count: state.masters.length, icon: Package, unit: "รายการ", tone: "bg-primary/10 text-primary dark:text-foreground" },
          { label: "สูตร BOM ทั้งหมด", count: state.formulas.length, icon: Layers3, unit: "สูตร", tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
          { label: "รายการที่ยังไม่มีสูตร", count: state.masters.filter((m) => !masterFormulas(m).length).length, icon: FileQuestion, unit: "รายการ", tone: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
        ].map(({ label, count, icon: Icon, unit, tone }) => (
          <div key={label} className="flex items-center gap-4 p-5">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon aria-hidden="true" className="size-6" /></span>
            <div><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary dark:text-foreground">{count.toLocaleString("th-TH")} <span className="text-xs font-medium text-muted-foreground">{unit}</span></p></div>
          </div>
        ))}
      </section>
      {deleteError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <span>{deleteError}</span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDeleteError("")}
          >
            ปิด
          </Button>
        </div>
      )}
      <section aria-labelledby="bom-table-heading" className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5">
          <div><h2 id="bom-table-heading" className="text-lg font-bold text-primary dark:text-foreground">รายการสินค้าและวัตถุดิบ</h2><p className="mt-1 text-xs text-muted-foreground" role="status">ทั้งหมด {total.toLocaleString("th-TH")} รายการ{message ? ` · ${message}` : ""}</p></div>
          <div className="flex items-center gap-2">
            <Popover open={advanced} onOpenChange={(open) => { if (open) setDraft(filters); setAdvanced(open); }}>
              <PopoverTrigger asChild><Button type="button" variant="outline" className="h-10 rounded-xl px-4 font-semibold text-primary dark:text-foreground"><Filter aria-hidden="true" />ตัวกรอง{Object.entries(filters).filter(([key,value]) => key !== "search" && value !== "all").length > 0 && <span>({Object.entries(filters).filter(([key,value]) => key !== "search" && value !== "all").length})</span>}</Button></PopoverTrigger>
              <PopoverContent align="end" className="max-h-[75dvh] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-2xl p-5">
                <h3 className="mb-4 font-bold text-primary dark:text-foreground">ตัวกรองรายการสินค้าและวัตถุดิบ</h3>
                <form onSubmit={(e) => { e.preventDefault(); setFilters(draft); setPage(1); setAdvanced(false); }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SelectField
            label="ประเภทสินค้า"
            value={draft.type}
            onChange={(type) => setDraft({ ...draft, type })}
            options={[
              { value: "all", label: "ทุกประเภท" },
              ...Object.entries(productTypes).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />

                {(Object.keys(metadata) as (keyof typeof metadata)[]).map(
                  (key) => (
                    <SelectField
                      key={key}
                      label={metadata[key]}
                      value={draft[key]}
                      onChange={(v) => setDraft({ ...draft, [key]: v })}
                      options={[
                        { value: "all", label: "ทั้งหมด" },
                        ...[
                          ...new Set(
                            state.masters.map((m) => m[key]).filter(Boolean),
                          ),
                        ].map((v) => ({ value: v, label: v })),
                      ]}
                    />
                  ),
                )}
                <SelectField
                  label="สถานะสูตรที่มี"
                  value={draft.status}
                  onChange={(status) => setDraft({ ...draft, status })}
                  options={[
                    { value: "all", label: "ทั้งหมด" },
                    ...Object.entries(formulaStatuses).map(([value, label]) => ({
                      value,
                      label,
                    })),
                  ]}
                />
                <SelectField
                  label="การมีสูตร"
                  value={draft.availability}
                  onChange={(availability) =>
                    setDraft({ ...draft, availability })
                  }
                  options={[
                    { value: "all", label: "ทั้งหมด" },
                    { value: "has", label: "มีสูตร" },
                    { value: "none", label: "ไม่มีสูตร" },
                    { value: "noDefault", label: "ยังไม่มีสูตรเริ่มต้น" },
                  ]}
                />

                  </div>
                  <div className="mt-5 flex justify-end gap-2 border-t pt-4">
                    <Button type="button" variant="outline" onClick={() => { const next = {...initialFilters, search: filters.search}; setDraft(next); setFilters(next); setPage(1); setAdvanced(false); }}>ล้างตัวกรอง</Button>
                    <Button type="submit" className="factory-itech-button-primary">ใช้ตัวกรอง</Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild><Button type="button" variant="outline" size="icon" className="size-10 rounded-xl" aria-label="ตั้งค่าตาราง" title="ตั้งค่าตาราง"><Settings2 aria-hidden="true" /></Button></PopoverTrigger>
              <PopoverContent align="end" className="w-48 rounded-xl"><SelectField label="จำนวนต่อหน้า" value={pageSize} onChange={(value) => { setPageSize(value); setPage(1); }} options={[5,10,25,50].map(n => ({value:String(n),label:`${n} รายการ`}))} /></PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="min-w-0 [&>.factory-table]:rounded-none [&>.factory-table]:border-0 [&>.factory-table>div:first-child]:px-4 [&>.factory-table>div:first-child]:py-4 [&>.factory-table>div:first-child_button]:rounded-xl [&_thead]:bg-[#173b63] [&_th]:h-12 [&_th]:bg-[#173b63] [&_th]:font-semibold [&_th]:text-white [&_th_button]:text-white [&_tbody_tr]:h-16 [&_tbody_tr]:bg-card [&_tbody_tr:hover]:bg-[#d0d9e1] dark:[&_tbody_tr:hover]:bg-muted [&_td]:py-3 [&_td]:text-sm [&_th[data-column-key=count]]:text-center [&_th[data-column-key=actions]]:text-right">
          <FactoryDataTable variant="history"
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            minWidth={1500}
            state={loading ? "loading" : "normal"}
        pagination={
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-xs text-muted-foreground">แสดง {rows.length} จาก {total.toLocaleString("th-TH")} รายการ · {pageSize} รายการต่อหน้า</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label="หน้าแรก" disabled={current <= 1} onClick={() => setPage(1)}><ChevronsLeft /></Button>
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label="หน้าก่อนหน้า" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft /></Button>
              <span className="rounded-lg bg-primary/5 px-4 py-2 text-xs font-bold tabular-nums text-primary dark:text-foreground" aria-live="polite">{current} / {Math.max(1, Math.ceil(total / Number(pageSize)))}</span>
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label="หน้าถัดไป" disabled={current >= Math.ceil(total / Number(pageSize))} onClick={() => setPage(current + 1)}><ChevronRight /></Button>
              <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" aria-label="หน้าสุดท้าย" disabled={current >= Math.ceil(total / Number(pageSize))} onClick={() => setPage(Math.max(1, Math.ceil(total / Number(pageSize))))}><ChevronsRight /></Button>
            </div>
          </div>
        }
          />
        </div>
      </section>
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className={`factory-itech-theme flex max-h-[92dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-3xl p-0 ${panel?.type === "masterEdit" ? "sm:max-w-3xl" : "sm:max-w-[1680px]"}`}>
          <DialogHeader className="shrink-0 border-b px-6 py-5 pr-16">
            <DialogTitle>
              {panel?.type === "masterEdit"
                  ? panel.id ? "แก้ไขรายการหลัก" : "เพิ่มรายการหลัก"
                  : panel?.type === "master"
                    ? "รายละเอียดสินค้าและสูตร"
                    : panel?.type === "formulaNew"
                      ? "สร้างสูตรเวอร์ชันใหม่"
                      : panel?.type === "formulaEdit"
                        ? "แก้ไขสูตร"
                        : "รายละเอียดสูตร BOM"}
            </DialogTitle>
            <DialogDescription>
              {panel?.type === "masterEdit" ? "สร้างสินค้า วัตถุดิบ หรือสินค้ากึ่งสำเร็จรูปสำหรับผูกสูตร" : "สูตรที่เปิดใช้งานสามารถเลือกในใบสั่งผลิต V1"}
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 overflow-y-auto overscroll-contain p-5 scrollbar-none [&::-webkit-scrollbar]:hidden"
            tabIndex={0}
            role="region"
            aria-label="รายละเอียด BOM เลื่อนเพื่อดูข้อมูลเพิ่มเติม"
          >
            <div key={panel ? JSON.stringify(panel) : "closed"}>
              {renderPanel()}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
