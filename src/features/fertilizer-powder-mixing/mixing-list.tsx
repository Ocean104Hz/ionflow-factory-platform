"use client";
import { useState } from "react";
import {
  Plus,
  Eye,
  Pencil,
  Copy,
  Trash2,
  Printer,
  Search,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/components/ui/dialog";
import {
  PageHeader,
  FactoryDataTable,
  Pagination,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { date, dateTime } from "@/src/lib/formatters";
import { useMixing } from "./mixing-provider";
import {
  blankReport,
  emptyFilters,
  filterReports,
  nextDocumentNumber,
  shifts,
  summarizeReport,
  validDate,
  type MixingReport,
} from "./mixing-domain";
import { MixingForm } from "./mixing-form";
import { MixingDetail } from "./mixing-detail";
import { MixingPrintPreview } from "./mixing-print-preview";
import {
  MixingExportPreview,
  MixingImportPreview,
} from "./mixing-import-preview";

function newReport(records: MixingReport[]) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return blankReport(day, nextDocumentNumber(records, `MIX-DEMO-${day.replaceAll("-", "")}`));
}

export function MixingList() {
  const { records, remove, copy } = useMixing();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [filterError, setFilterError] = useState("");
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [editor, setEditor] = useState<MixingReport | null>(() => newReport(records));
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [panel, setPanel] = useState<{ mode: "view"; id: string } | null>(null);
  const filtered = filterReports(records, filters);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / Number(pageSize))),
  );
  const visible = filtered.slice(
    (currentPage - 1) * Number(pageSize),
    currentPage * Number(pageSize),
  );
  const selectedRows = filtered.filter((r) => selected.includes(r.id));
  const report = records.find((r) => r.id === panel?.id);
  function openFormTab() {
    if (!editor) setEditor(newReport(records));
    setActiveTab("form");
  }
  function startEditor(row?: MixingReport) {
    if (dirty && !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?")) return;
    setEditor(row ? structuredClone(row) : newReport(records));
    setEditorKey((key) => key + 1);
    setDirty(false);
    setPanel(null);
    setActiveTab("form");
  }
  const allChecked =
    visible.length > 0 && visible.every((r) => selected.includes(r.id));
  function act(action: () => void, success: string) {
    try {
      action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  }
  function copyRow(row: MixingReport) {
    act(
      () => copy(row.id),
      "คัดลอกเป็นเอกสารใหม่แล้ว · ล้างผลตรวจและผู้ลงชื่อเพื่อบันทึกใหม่",
    );
  }
  const columns: Column<MixingReport>[] = [
    {
      key: "select",
      label: "เลือกเพื่อพิมพ์",
      header: (
        <Checkbox
          aria-label="เลือกทุกรายงานในหน้านี้เพื่อพิมพ์"
          checked={
            allChecked
              ? true
              : visible.some((r) => selected.includes(r.id))
                ? "indeterminate"
                : false
          }
          disabled={!visible.length}
          onCheckedChange={(v) =>
            setSelected((ids) =>
              v === true
                ? [...new Set([...ids, ...visible.map((r) => r.id)])]
                : ids.filter((id) => !visible.some((r) => r.id === id)),
            )
          }
        />
      ),
      render: (r) => (
        <Checkbox
          aria-label={`เลือกรายงาน ${r.doc_no} เพื่อพิมพ์`}
          checked={selected.includes(r.id)}
          onCheckedChange={(v) =>
            setSelected((ids) =>
              v === true ? [...ids, r.id] : ids.filter((id) => id !== r.id),
            )
          }
        />
      ),
    },
    { key: "number", label: "#", render: (_, i) => (currentPage - 1) * Number(pageSize) + i + 1 },
    {
      key: "doc",
      label: "เลขที่เอกสาร",
      render: (r) => (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setPanel({ mode: "view", id: r.id })}
        >
          {r.doc_no}
        </Button>
      ),
    },
    {
      key: "date",
      label: "วันที่รายงาน",
      render: (r) => (
        <span className="whitespace-nowrap">{date(r.report_date)}</span>
      ),
    },
    {
      key: "formula",
      label: "สูตร / ผลิตภัณฑ์",
      render: (r) => <span className="block min-w-48">{r.fertilizer}</span>,
    },
    { key: "lot", label: "Lot No.", render: (r) => r.lot_no },
    { key: "shift", label: "กะ", render: (r) => r.shift },
    {
      key: "location",
      label: "สถานที่ผสม",
      render: (r) => <span className="whitespace-nowrap">{r.location}</span>,
    },
    { key: "inspector", label: "ผู้ตรวจสอบ", render: (r) => r.inspector || "-" },
    { key: "production", label: "ผู้ผลิต", render: (r) => r.production || "-" },
    { key: "factory_qa", label: "ฝ่าย QA", render: (r) => r.factory_qa || "-" },
    {
      key: "materials",
      label: "วัตถุดิบ",
      numeric: true,
      render: (r) => `${r.materials.length} รายการ`,
    },
    {
      key: "rounds",
      label: "รอบผสม",
      numeric: true,
      render: (r) => `${r.mix_rounds.length} รอบ`,
    },
    {
      key: "summary",
      label: "สรุปผลตรวจ",
      render: (r) => {
        const s = summarizeReport(r);
        return (
          <div className="space-y-1">
            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              ผ่าน {s.passed} / ไม่ผ่าน {s.failed} / รอตรวจ {s.pending}
            </p>
          </div>
        );
      },
    },
    {
      key: "updated",
      label: "แก้ไขล่าสุด",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {dateTime(r.updated_at)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (r) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            aria-label={`ดู ${r.doc_no}`}
            onClick={() => setPanel({ mode: "view", id: r.id })}
          >
            <Eye aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            aria-label={`แก้ไข ${r.doc_no}`}
            onClick={() => startEditor(r)}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            aria-label={`คัดลอก ${r.doc_no}`}
            onClick={() => copyRow(r)}
          >
            <Copy aria-hidden="true" />
          </Button>
          <MixingPrintPreview
            rows={[r]}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label={`พรีวิวพิมพ์ ${r.doc_no}`}
              >
                <Printer aria-hidden="true" />
              </Button>
            }
          />
          <ConfirmDialog
            title={`ลบรายงาน ${r.doc_no}?`}
            description="ลบเฉพาะรายงานนี้ ไม่กระทบสต็อกหรือสูตร BOM"
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-danger hover:bg-danger/10 hover:text-danger"
                aria-label={`ลบ ${r.doc_no}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            }
            onConfirm={() =>
              act(() => {
                if (editor?.id === r.id && dirty) {
                  throw new Error("กรุณาบันทึกหรือยกเลิกการแก้ไขเอกสารนี้ก่อนลบ");
                }
                remove(r.id);
                if (editor?.id === r.id) setEditor(null);
                setSelected((ids) => ids.filter((id) => id !== r.id));
              }, "ลบรายงานจำลองแล้ว")
            }
          />
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="รายงานผสมปุ๋ยผง" description="ข้อมูลจำลองในเซสชันนี้ · ยังไม่ได้เชื่อม API" />
      <div className="flex justify-center py-1">
        <div role="group" aria-label="หน้ารายงานผสมปุ๋ยผง" className="inline-flex w-full max-w-xl rounded-full border border-border bg-card p-1 shadow-sm">
          <button type="button" aria-pressed={activeTab === "form"} onClick={openFormTab}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeTab === "form" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
            แบบฟอร์มรายงานผสม
          </button>
          <button type="button" aria-pressed={activeTab === "history"} onClick={() => setActiveTab("history")}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeTab === "history" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"}`}>
            ประวัติรายงานผสม
          </button>
        </div>
      </div>
      {editor && (
        <div className={activeTab === "form" ? "space-y-3" : "hidden"}>
          {editor.id && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
              <span>กำลังแก้ไขเอกสาร: {editor.doc_no}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => startEditor()}>ยกเลิกการแก้ไข</Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MixingImportPreview />
            <Button type="button" variant="outline" onClick={() => startEditor()}>
              <Plus aria-hidden="true" /> สร้างรายงานใหม่
            </Button>
          </div>
          <MixingForm key={editorKey} initial={editor} onDirtyChange={() => setDirty(true)} onSaved={() => {
            setEditor(null);
            setDirty(false);
            setMessage("บันทึกรายงานจำลองแล้ว");
            setActiveTab("history");
          }} />
          <div className="flex justify-end gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
            <Button type="button" variant="outline" onClick={() => startEditor()}>ล้างแบบฟอร์ม</Button>
            <Button type="submit" form="mixing-editor">บันทึกรายงาน</Button>
          </div>
        </div>
      )}
      <div className={activeTab === "history" ? "space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm" : "hidden"}>
      <h2 className="border-b border-border pb-3 text-base font-semibold">ข้อมูลที่บันทึก</h2>
      <form
        className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (
            (draft.from && !validDate(draft.from)) ||
            (draft.to && !validDate(draft.to)) ||
            (draft.from && draft.to && draft.from > draft.to)
          ) {
            setFilterError("ตรวจสอบวันที่เริ่มต้นและสิ้นสุด");
            return;
          }
          setFilters(draft);
          setPage(1);
          setSelected([]);
          setFilterError("");
        }}
      >
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="mix-search">ค้นหารายงาน</Label>
          <Input
            id="mix-search"
            placeholder="เลขที่เอกสาร / สูตร / Lot / สถานที่"
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          />
        </div>
        <div className="min-w-0">
          <SelectField
            label="สรุปผลตรวจ"
            value={draft.result}
            onChange={(result) => setDraft({ ...draft, result })}
            options={[
              { value: "all", label: "ทั้งหมด" },
              { value: "pass", label: "ผ่านทุกรอบ" },
              { value: "review", label: "ต้องทบทวน / รอตรวจ" },
            ]}
          />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="mix-from">จากวันที่</Label>
          <Input id="mix-from" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="mix-to">ถึงวันที่</Label>
          <Input id="mix-to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </div>
        <SelectField label="กะที่ผลิต" value={draft.shift} onChange={(shift) => setDraft({ ...draft, shift })}
          options={[{ value: "all", label: "ทุกกะ" }, ...shifts.map((value) => ({ value, label: value }))]} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(emptyFilters);
            setFilters(emptyFilters);
            setSelected([]);
            setPage(1);
            setFilterError("");
          }}
        >
          ล้างตัวกรอง
        </Button>
        <Button type="submit">
          <Search aria-hidden="true" />
          ค้นหา
        </Button>
      </form>
      {filterError && (
        <p role="alert" className="text-danger">
          {filterError}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MixingExportPreview rows={filtered} />
          <MixingPrintPreview
            rows={selectedRows}
            trigger={
              <Button variant="outline" disabled={!selectedRows.length}>
                <Printer aria-hidden="true" />
                พิมพ์ที่เลือก ({selectedRows.length})
              </Button>
            }
          />
          <span className="text-xs text-muted-foreground">
            พบ {filtered.length} จาก {records.length} รายงาน
          </span>
        </div>
        <div className="w-36">
          <SelectField
            label="จำนวนต่อหน้า"
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            options={[5, 10, 20, 50].map((n) => ({
              value: String(n),
              label: `${n} รายการ`,
            }))}
          />
        </div>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {message ||
          "ข้อมูลจำลอง · อยู่ต่อเมื่อเปลี่ยนหน้าภายในระบบ และคืนค่าเมื่อรีโหลดเบราว์เซอร์"}
      </p>
      <div className="[&_.factory-table_thead]:bg-primary! [&_.factory-table_thead_tr]:bg-primary! [&_.factory-table_thead_th]:text-primary-foreground! [&_.factory-table_td]:py-2!">
      <FactoryDataTable
        rows={visible}
        columns={columns}
        rowKey={(r) => r.id}
        minWidth={1850}
        pagination={
          <Pagination
            page={currentPage}
            pageSize={Number(pageSize)}
            total={filtered.length}
            onChange={setPage}
          />
        }
      />
      </div>
      </div>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[97vw] max-w-[97vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1600px]">
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-14">
            <DialogTitle>รายละเอียดรายงานผสมปุ๋ยผง</DialogTitle>
            <DialogDescription>
              {report?.doc_no} · ข้อมูลจำลอง
              ไม่เชื่อมต่อสต็อกหรือระบบอนุมัติจริง
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-5">
            {report ? <MixingDetail row={report} /> : <p>ไม่พบรายงาน อาจถูกลบแล้ว</p>}
          </div>
          <DialogFooter className="shrink-0 border-t bg-card px-5 py-3">
            {report && (
              <>
                <MixingPrintPreview rows={[report]} />
                <Button
                  variant="outline"
                  onClick={() => {
                    copyRow(report);
                    setPanel(null);
                  }}
                >
                  <Copy aria-hidden="true" />
                  คัดลอกเป็นใหม่
                </Button>
                <Button
                  onClick={() => startEditor(report)}
                >
                  <Pencil aria-hidden="true" />
                  แก้ไข
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setPanel(null)}>
              ปิดรายละเอียด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
