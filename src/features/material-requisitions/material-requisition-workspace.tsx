"use client";
import { useState } from "react";
import { Eye, Pencil, Printer, Plus, Trash2 } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  SelectField,
  StatusBadge,
  FactoryDataTable,
  Pagination,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/src/components/ui/alert-dialog";
import { materialRequisitions } from "@/src/lib/mock-data/material-requisitions";
import {
  blankRequisition,
  deleteRequisition,
  documentNumber,
  filterRequisitions,
  profiles,
  saveRequisition,
  type Requisition,
  type Errors,
  type HistoryFilters,
} from "./material-requisition-domain";
import { MaterialRequisitionForm } from "./material-requisition-form";
import { MaterialRequisitionDetail } from "./material-requisition-detail";

const emptyFilters: HistoryFilters = {
  search: "",
  from: "",
  to: "",
  profile: "",
};
export function MaterialRequisitionWorkspace() {
  const [records, setRecords] = useState(() =>
    structuredClone(materialRequisitions),
  );
  const [row, setRow] = useState(blankRequisition);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankRequisition()),
  );
  const [tab, setTab] = useState("form");
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Requisition | null>(null);
  const [view, setView] = useState<{ id: string; print: boolean } | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const filtered = filterRequisitions(records, filters);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  const updateFilters = (patch: Partial<HistoryFilters>) => {
    setFilters({ ...filters, ...patch });
    setPage(1);
  };
  function open(next: Requisition) {
    setRow(structuredClone(next));
    setBaseline(JSON.stringify(next));
    setErrors({});
    setTab("form");
    setMessage("");
  }
  function request(next: Requisition) {
    if (JSON.stringify(row) !== baseline) setPending(next);
    else open(next);
  }
  function save() {
    const result = saveRequisition(
      records,
      row,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    setErrors(result.errors);
    if (!result.row) {
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ");
      return;
    }
    setRecords(result.records);
    open(result.row);
    setMessage(
      "บันทึกข้อมูลตัวอย่างแล้ว · ไม่มีการตัดสต็อก · รีเฟรชหน้าจะคืนข้อมูลเริ่มต้น",
    );
  }
  function remove(id: string) {
    setRecords((previous) => deleteRequisition(previous, id));
    if (row.id === id) open(blankRequisition(row.profile));
    if (view?.id === id) setView(null);
    setMessage("ลบใบเบิกตัวอย่างแล้ว ไม่เปลี่ยนข้อมูลคลังสินค้า");
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="เบิกวัสดุ/วัตถุดิบ"
        description="จัดการเอกสารเบิกวัสดุ วัตถุดิบ และวัตถุดิบระหว่างการผลิต"
        actions={
          <>
            <StatusBadge tone="info">UI MOCK · ไม่ตัดสต็อก</StatusBadge>
            <Button onClick={() => request(blankRequisition(row.profile))}>
              <Plus />
              สร้างใบเบิกใหม่
            </Button>
          </>
        }
      />
      {message && (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          {message}
        </p>
      )}
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList aria-label="มุมมองใบเบิก">
          <TabsTrigger value="form">บันทึกใบเบิก</TabsTrigger>
          <TabsTrigger value="history">ประวัติใบเบิก</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="min-w-0">
          <MaterialRequisitionForm
            row={row}
            errors={errors}
            onChange={setRow}
            onProfileChange={(profile) => request(blankRequisition(profile))}
            onSave={save}
            onReset={() => request(blankRequisition(row.profile))}
          />
        </TabsContent>
        <TabsContent value="history" className="min-w-0 space-y-5">
          <SectionCard
            title="ประวัติใบเบิก"
            subtitle="เอกสารตัวอย่างในหน้านี้เท่านั้น ไม่ใช่ประวัติการเคลื่อนไหวสต็อก"
          >
            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="grid gap-2">
                <Label htmlFor="req-search">ค้นหาใบเบิก</Label>
                <Input
                  id="req-search"
                  placeholder="เลขเอกสาร รายการ ผู้เบิก"
                  value={filters.search}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="req-from">วันที่ตั้งแต่</Label>
                <Input
                  id="req-from"
                  type="date"
                  value={filters.from}
                  onChange={(e) => updateFilters({ from: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="req-to">ถึงวันที่</Label>
                <Input
                  id="req-to"
                  type="date"
                  value={filters.to}
                  onChange={(e) => updateFilters({ to: e.target.value })}
                />
              </div>
              <SelectField
                label="โรงงาน"
                value={filters.profile || "all"}
                onChange={(v) =>
                  updateFilters({ profile: v === "all" ? "" : v })
                }
                options={[
                  { value: "all", label: "ทุกโรงงาน" },
                  ...Object.entries(profiles).map(([value, p]) => ({
                    value,
                    label: p.label,
                  })),
                ]}
              />
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters(emptyFilters);
                    setPage(1);
                  }}
                >
                  ล้างตัวกรอง
                </Button>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                พบ {filtered.length} เอกสาร
              </p>
              <SelectField
                label="รายการต่อหน้า"
                value={String(pageSize)}
                onChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
                options={[5, 10, 20].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </div>
            <FactoryDataTable
              rows={filtered.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize,
              )}
              rowKey={(r) => r.id}
              minWidth={1000}
              columns={[
                {
                  key: "doc",
                  label: "เอกสารเลขที่",
                  render: (r) => (
                    <span className="font-medium">
                      {documentNumber(r.doc_no)}
                    </span>
                  ),
                },
                { key: "date", label: "วันที่เอกสาร", render: (r) => r.date },
                {
                  key: "factory",
                  label: "โรงงาน / สถานที่",
                  render: (r) => (
                    <div>
                      {profiles[r.profile].label}
                      <p className="text-xs text-muted-foreground">
                        {r.location}
                      </p>
                    </div>
                  ),
                },
                {
                  key: "materials",
                  label: "รายการวัสดุ",
                  render: (r) => r.material_details.length,
                  numeric: true,
                },
                {
                  key: "wip",
                  label: "รายการ WIP",
                  render: (r) => r.wip_materials.length,
                  numeric: true,
                },
                {
                  key: "requester",
                  label: "ผู้เบิก",
                  render: (r) => r.requisitioner_production_supervisor || "—",
                },
                {
                  key: "actions",
                  label: "จัดการ",
                  render: (r) => (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`ดูรายละเอียด ${r.doc_no}`}
                        title="ดูรายละเอียด"
                        onClick={() => setView({ id: r.id, print: false })}
                      >
                        <Eye />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`แก้ไข ${r.doc_no}`}
                        title="แก้ไข"
                        onClick={() => request(r)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`พรีวิว ${r.doc_no}`}
                        title="พรีวิวเอกสาร"
                        onClick={() => setView({ id: r.id, print: true })}
                      >
                        <Printer />
                      </Button>
                      <ConfirmDialog
                        title="ลบใบเบิกตัวอย่าง?"
                        description={`ลบ ${r.doc_no} ออกจากข้อมูลในหน้านี้เท่านั้น`}
                        onConfirm={() => remove(r.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`ลบ ${r.doc_no}`}
                            title="ลบ"
                          >
                            <Trash2 />
                          </Button>
                        }
                      />
                    </div>
                  ),
                },
              ]}
              pagination={
                <Pagination
                  page={currentPage}
                  pageSize={pageSize}
                  total={filtered.length}
                  onChange={setPage}
                />
              }
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        Excel import/export ไม่อยู่ในระยะนี้ · ใบเบิกนี้แยกจาก Formula BOM
        และใบเบิกวัตถุดิบการผลิตของ iCON
      </p>
      <MaterialRequisitionDetail
        row={records.find((r) => r.id === view?.id) ?? null}
        print={view?.print ?? false}
        onClose={() => setView(null)}
        onEdit={request}
      />
      <AlertDialog
        open={!!pending}
        onOpenChange={(value) => {
          if (!value) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ละทิ้งข้อมูลที่ยังไม่บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>
              การเปิดใบเบิกใหม่ เปลี่ยนโรงงาน
              หรือเปิดเอกสารอื่นจะล้างค่าที่ยังไม่บันทึก
              เอกสารที่บันทึกแล้วจะไม่เปลี่ยน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) open(pending);
                setPending(null);
              }}
            >
              ละทิ้งและดำเนินการ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
