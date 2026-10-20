"use client";
import { useState, useRef } from "react";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/src/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  FactoryDataTable,
  Pagination,
  SelectField,
  type Column,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { organicReports } from "@/src/lib/mock-data/qc-organic-fertilizer";
import { OrganicFormSections } from "./qc-organic-form";
import {
  blankReport,
  profiles,
  validateReport,
  saveReport,
  deleteReport,
  filterReports,
  type OrganicReport,
  type Errors,
  type Profile,
} from "./qc-organic-domain";
const initialFilters = { search: "", profile: "all", from: "", to: "" };
export function OrganicWorkspace() {
  const [records, setRecords] = useState(() => structuredClone(organicReports));
  const [row, setRow] = useState(() => blankReport());
  const [baseline, setBaseline] = useState(() => JSON.stringify(blankReport()));
  const [tab, setTab] = useState("form"),
    [errors, setErrors] = useState<Errors>({}),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [opened, setOpened] = useState<{
    row: OrganicReport;
    print: boolean;
  } | null>(null);
  const [draft, setDraft] = useState(initialFilters),
    [filters, setFilters] = useState(initialFilters),
    [filterError, setFilterError] = useState("");
  const [page, setPage] = useState(1),
    [size, setSize] = useState("5");
  const errorRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(row) !== baseline;
  function openEditor(next: OrganicReport) {
    setRow(structuredClone(next));
    setBaseline(JSON.stringify(next));
    setErrors({});
    setMessage("");
    setTab("form");
  }
  function guarded(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function profileChange(profile: Profile) {
    if (profile === row.profile) return;
    guarded(() => openEditor(blankReport(profile)));
  }
  function save() {
    const nextErrors = validateReport(row, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      errorRef.current?.focus();
      return;
    }
    try {
      const result = saveReport(records, row, crypto.randomUUID());
      setRecords(result.records);
      setRow(result.saved);
      setBaseline(JSON.stringify(result.saved));
      setMessage(
        "บันทึกข้อมูลตัวอย่างแล้ว · ไม่ใช่ผลอนุมัติ QC และไม่เปลี่ยนสต็อก",
      );
    } catch (e) {
      setErrors({
        general: e instanceof Error ? e.message : "บันทึกตัวอย่างไม่สำเร็จ",
      });
      errorRef.current?.focus();
    }
  }
  const filtered = filterReports(records, filters),
    current = Math.min(
      page,
      Math.max(1, Math.ceil(filtered.length / Number(size))),
    );
  const columns: Column<OrganicReport>[] = [
    {
      key: "doc",
      label: "เลขที่เอกสาร",
      render: (r) => (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setOpened({ row: r, print: false })}
        >
          {r.doc_no}
        </Button>
      ),
    },
    { key: "date", label: "วันที่ตรวจสอบ", render: (r) => r.date },
    {
      key: "profile",
      label: "โรงงาน / Line",
      render: (r) => (
        <div>
          {profiles[r.profile].name}
          <p className="text-xs text-muted-foreground">
            {r.location} · {r.line}
          </p>
        </div>
      ),
    },
    {
      key: "formula",
      label: "สูตรปุ๋ย / Lot",
      render: (r) => (
        <div className="max-w-72 whitespace-pre-wrap break-words">
          {r.fertilizer.map((f) => `${f.name} · ${f.lot}`).join("\n")}
        </div>
      ),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={`ดู ${r.doc_no}`}
            onClick={() => setOpened({ row: r, print: false })}
          >
            <Eye aria-hidden="true" />
            ดู
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`แก้ไข ${r.doc_no}`}
            onClick={() => guarded(() => openEditor(r))}
          >
            <Pencil aria-hidden="true" />
            แก้ไข
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={`พรีวิวพิมพ์ ${r.doc_no}`}
            onClick={() => setOpened({ row: r, print: true })}
          >
            <Printer aria-hidden="true" />
            พรีวิวพิมพ์
          </Button>
          <ConfirmDialog
            title="ลบรายงานตัวอย่าง?"
            description={`${r.doc_no} จะถูกลบจากรายการในหน้านี้${row.id === r.id && dirty ? " และละทิ้งแบบฟอร์มที่แก้ไขค้างอยู่" : ""}`}
            trigger={
              <Button variant="outline" size="sm" aria-label={`ลบ ${r.doc_no}`}>
                <Trash2 aria-hidden="true" />
                ลบ
              </Button>
            }
            onConfirm={() => {
              setRecords((prev) => deleteReport(prev, r.id));
              if (row.id === r.id) openEditor(blankReport(row.profile));
              setMessage("ลบข้อมูลตัวอย่างแล้ว");
            }}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ตรวจคุณภาพปุ๋ยอินทรีย์เคมี"
        description="บันทึกและติดตามผลการตรวจสอบคุณภาพระหว่างกระบวนการผลิต"
        actions={
          <StatusBadge tone="info">UI MOCK · ไม่เชื่อมระบบจริง</StatusBadge>
        }
      />
      {message && (
        <p
          role="status"
          className="rounded-lg border border-success/20 bg-success/5 p-3 text-sm"
        >
          {message}
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList aria-label="มุมมองตรวจคุณภาพปุ๋ยอินทรีย์เคมี">
          <TabsTrigger value="form">บันทึกการตรวจสอบ</TabsTrigger>
          <TabsTrigger value="history">ประวัติการตรวจสอบ</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="min-w-0 space-y-4">
          <div ref={errorRef} tabIndex={-1} className="outline-none">
            {Object.keys(errors).length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger"
              >
                <p>ยังบันทึกไม่ได้ กรุณาตรวจสอบ</p>
                <ul className="list-inside list-disc text-sm">
                  {Object.entries(errors).map(([key, value]) => (
                    <li key={key}>
                      {value}{" "}
                      <span className="text-xs">
                        ({key.startsWith("cell-") ? key.split("-").at(-1) : key}
                        )
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <form
            noValidate
            className="min-w-0 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <OrganicFormSections
              row={row}
              onChange={setRow}
              onProfile={profileChange}
              errors={errors}
            />
            <div className="flex flex-wrap justify-end gap-3 rounded-lg border bg-background p-4">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  guarded(() => openEditor(blankReport(row.profile)))
                }
              >
                {row.id ? "ยกเลิกการแก้ไข / เริ่มใหม่" : "ล้างข้อมูล"}
              </Button>
              <Button type="submit">บันทึกข้อมูลตัวอย่าง</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="history" className="min-w-0 space-y-4">
          <SectionCard
            title="ประวัติการตรวจสอบ"
            subtitle={`พบ ${filtered.length} จาก ${records.length} รายงานตัวอย่าง`}
          >
            <form
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.from && draft.to && draft.from > draft.to) {
                  setFilterError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
                  return;
                }
                setFilters({ ...draft });
                setPage(1);
                setFilterError("");
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="organic-search">
                  ค้นหาเอกสาร / สูตร / Lot / Line
                </Label>
                <Input
                  id="organic-search"
                  value={draft.search}
                  onChange={(e) =>
                    setDraft({ ...draft, search: e.target.value })
                  }
                />
              </div>
              <SelectField
                label="โรงงาน"
                value={draft.profile}
                options={[
                  { value: "all", label: "ทุกโรงงาน" },
                  ...Object.entries(profiles).map(([value, p]) => ({
                    value,
                    label: p.name,
                  })),
                ]}
                onChange={(profile) => setDraft({ ...draft, profile })}
              />
              {(["from", "to"] as const).map((key, i) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`organic-filter-${key}`}>
                    {i === 0 ? "ตั้งแต่วันที่" : "ถึงวันที่"}
                  </Label>
                  <Input
                    id={`organic-filter-${key}`}
                    type="date"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </div>
              ))}
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(initialFilters);
                    setFilters(initialFilters);
                    setPage(1);
                    setFilterError("");
                  }}
                >
                  ล้างตัวกรอง
                </Button>
                <Button type="submit">ค้นหา</Button>
              </div>
            </form>
            {filterError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {filterError}
              </p>
            )}
          </SectionCard>
          <div className="flex justify-end">
            <SelectField
              label="จำนวนต่อหน้า"
              value={size}
              options={["5", "10", "20"].map((value) => ({
                value,
                label: `${value} รายการ`,
              }))}
              onChange={(v) => {
                setSize(v);
                setPage(1);
              }}
            />
          </div>
          <FactoryDataTable
            columns={columns}
            rows={filtered.slice(
              (current - 1) * Number(size),
              current * Number(size),
            )}
            rowKey={(r) => r.id}
            minWidth={1050}
            pagination={
              <Pagination
                page={current}
                pageSize={Number(size)}
                total={filtered.length}
                onChange={setPage}
              />
            }
          />
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ละทิ้งข้อมูลที่ยังไม่บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>
              การเริ่มใหม่หรือเปลี่ยนโรงงานจะล้างแบบฟอร์มปัจจุบัน
              ไม่แปลงค่าระหว่างโรงงาน และไม่แก้รายงานที่บันทึกไว้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                pending?.();
                setPending(null);
              }}
            >
              ยืนยันละทิ้งข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!opened}
        onOpenChange={(v) => {
          if (!v) setOpened(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] flex-col sm:max-w-[94vw]">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              {opened?.print ? "พรีวิวพิมพ์ A4 แนวนอน" : "รายละเอียดการตรวจสอบ"}
            </DialogTitle>
            <DialogDescription>
              MOCK / DEMO · อ่านอย่างเดียว ไม่ใช่เอกสารอนุมัติจริง · ไม่สร้าง
              PDF หรือสั่งพิมพ์จริง
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-auto rounded-lg border bg-muted/20 p-3">
            {opened && (
              <article
                data-organic-paper={opened.print ? "landscape" : undefined}
                className={
                  opened.print
                    ? "organic-paper mx-auto space-y-4 bg-white p-6 text-black [&_[data-slot=card]]:bg-white [&_[data-slot=card]]:text-black [&_p]:text-black [&_label]:text-black"
                    : "min-w-0"
                }
                style={opened.print ? { width: "297mm" } : undefined}
              >
                {opened.print && (
                  <>
                    <style>{`.organic-paper [data-slot=table-container]{overflow:visible}.organic-paper [data-slot=card]{overflow:visible;box-shadow:none;break-inside:auto}.organic-paper [data-organic-matrix]{break-inside:avoid}.organic-paper td{font-size:10px}.organic-paper h2{break-after:avoid}@media print{@page{size:A4 landscape;margin:10mm}.organic-paper{width:auto!important;padding:0!important}}`}</style>
                    <header className="border-b pb-3">
                      <h2 className="text-lg font-semibold">
                        ตรวจคุณภาพปุ๋ยอินทรีย์เคมี ·{" "}
                        {profiles[opened.row.profile].name}
                      </h2>
                      <p>
                        {opened.row.doc_no} · {opened.row.date} · MOCK / DEMO
                      </p>
                    </header>
                  </>
                )}
                <OrganicFormSections row={opened.row} print={opened.print} />
              </article>
            )}
          </div>
          <DialogFooter className="shrink-0">
            <DialogClose asChild>
              <Button>ปิด{opened?.print ? "พรีวิว" : "รายละเอียด"}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
