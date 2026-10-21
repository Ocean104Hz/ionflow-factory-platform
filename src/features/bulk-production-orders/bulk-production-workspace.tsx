"use client";
import { useState } from "react";
import { Eye, Pencil, Printer, Plus, Trash2 } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  StatusBadge,
  FactoryDataTable,
  Pagination,
  SelectField,
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
import { bulkOrders } from "@/src/lib/mock-data/bulk-production-orders";
import {
  blankBulkOrder,
  bulkProgress,
  deleteBulkOrder,
  filterBulkOrders,
  saveBulkOrder,
  type BulkOrder,
  type BulkErrors,
  type BulkFilters,
} from "./bulk-production-domain";
import { BulkProductionForm } from "./bulk-production-form";
import { BulkProductionDetail } from "./bulk-production-detail";

const emptyFilters: BulkFilters = { search: "", from: "", to: "" };
export function BulkProductionWorkspace() {
  const [records, setRecords] = useState(() => structuredClone(bulkOrders));
  const [doc, setDoc] = useState(blankBulkOrder);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankBulkOrder()),
  );
  const [tab, setTab] = useState("form");
  const [errors, setErrors] = useState<BulkErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<BulkOrder | null>(null);
  const [view, setView] = useState<{ id: string; print: boolean } | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const filtered = filterBulkOrders(records, filters);
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  function open(next: BulkOrder) {
    setDoc(structuredClone(next));
    setBaseline(JSON.stringify(next));
    setErrors({});
    setTab("form");
    setMessage("");
  }
  function request(next: BulkOrder) {
    if (JSON.stringify(doc) !== baseline) setPending(next);
    else open(next);
  }
  function save() {
    const result = saveBulkOrder(
      records,
      doc,
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    setErrors(result.errors);
    if (!result.saved) {
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ");
      return;
    }
    setRecords(result.records);
    open(result.saved);
    setMessage("บันทึกข้อมูลตัวอย่างแล้ว · ไม่สั่งผลิตจริง ไม่เปลี่ยนสต็อก");
  }
  function remove(id: string) {
    setRecords((previous) => deleteBulkOrder(previous, id));
    if (doc.id === id) open(blankBulkOrder());
    if (view?.id === id) setView(null);
    setMessage("ลบเอกสารตัวอย่างแล้ว · ไม่เปลี่ยนข้อมูลโมดูลอื่น");
  }
  function filter(patch: Partial<BulkFilters>) {
    setFilters({ ...filters, ...patch });
    setPage(1);
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบสั่งผลิตสินค้า"
        description="จัดทำแผนการผลิตปุ๋ย ติดตามยอดผลิตจริงและยอดค้างตามรายการ"
        actions={
          <>
            <StatusBadge tone="info">UI MOCK · Bulk ภายใน</StatusBadge>
            <Button onClick={() => request(blankBulkOrder())}>
              <Plus />
              สร้างใบสั่งผลิตใหม่
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
        <TabsList aria-label="มุมมองใบสั่งผลิต">
          <TabsTrigger value="form">บันทึกใบสั่งผลิต</TabsTrigger>
          <TabsTrigger value="history">ประวัติใบสั่งผลิต</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="min-w-0">
          <BulkProductionForm
            doc={doc}
            errors={errors}
            onChange={setDoc}
            onSave={save}
            onCancel={() => request(blankBulkOrder())}
          />
        </TabsContent>
        <TabsContent value="history" className="min-w-0">
          <SectionCard
            title="ประวัติใบสั่งผลิต"
            subtitle="สถานะเป็นป้ายความคืบหน้าจำลอง ไม่ใช่การอนุมัติหรือสถานะจาก Sales Hub"
          >
            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label htmlFor="bulk-search">ค้นหาใบสั่งผลิต</Label>
                <Input
                  id="bulk-search"
                  placeholder="เลขเอกสาร สินค้า รหัส Lot"
                  value={filters.search}
                  onChange={(e) => filter({ search: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-from">วันที่ตั้งแต่</Label>
                <Input
                  id="bulk-from"
                  type="date"
                  value={filters.from}
                  onChange={(e) => filter({ from: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-to">ถึงวันที่</Label>
                <Input
                  id="bulk-to"
                  type="date"
                  value={filters.to}
                  onChange={(e) => filter({ to: e.target.value })}
                />
              </div>
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
                (safePage - 1) * pageSize,
                safePage * pageSize,
              )}
              rowKey={(r) => r.id}
              minWidth={1100}
              columns={[
                {
                  key: "docNo",
                  label: "เลขที่เอกสาร",
                  render: (r) => (
                    <span className="font-medium">{r.header.docNo}</span>
                  ),
                },
                {
                  key: "date",
                  label: "วันที่เอกสาร",
                  render: (r) => r.header.date,
                },
                {
                  key: "tons",
                  label: "จำนวน (ตัน) · แผน",
                  render: (r) =>
                    r.header.planTons?.toLocaleString("th-TH") ?? "—",
                  numeric: true,
                },
                {
                  key: "items",
                  label: "รายการสินค้า",
                  render: (r) => (
                    <div className="max-w-64 whitespace-normal break-words">
                      {r.rows.map((x) => x.product).join(" / ")}
                    </div>
                  ),
                },
                {
                  key: "days",
                  label: "ระยะเวลาในการผลิต",
                  render: (r) =>
                    r.header.productionDays
                      ? `${r.header.productionDays} วัน`
                      : "—",
                },
                {
                  key: "pay",
                  label: "วันที่จ่าย",
                  render: (r) => r.header.payDate || "—",
                },
                {
                  key: "progress",
                  label: "สถานะการผลิต",
                  render: (r) => {
                    const status = bulkProgress(r);
                    return (
                      <StatusBadge
                        tone={
                          status === "เสร็จสิ้น"
                            ? "success"
                            : status === "กำลังผลิต"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {status}
                      </StatusBadge>
                    );
                  },
                },
                {
                  key: "actions",
                  label: "จัดการ",
                  render: (r) => (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="ดูรายละเอียด"
                        aria-label={`ดูรายละเอียด ${r.header.docNo}`}
                        onClick={() => setView({ id: r.id, print: false })}
                      >
                        <Eye />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="แก้ไข"
                        aria-label={`แก้ไข ${r.header.docNo}`}
                        onClick={() => request(r)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="พรีวิวเอกสาร / พิมพ์"
                        aria-label={`พรีวิว ${r.header.docNo}`}
                        onClick={() => setView({ id: r.id, print: true })}
                      >
                        <Printer />
                      </Button>
                      <ConfirmDialog
                        title="ลบใบสั่งผลิตตัวอย่าง?"
                        description={`ลบ ${r.header.docNo} เฉพาะข้อมูลจำลองในหน้านี้`}
                        onConfirm={() => remove(r.id)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            title="ลบ"
                            aria-label={`ลบ ${r.header.docNo}`}
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
                  page={safePage}
                  pageSize={pageSize}
                  total={filtered.length}
                  onChange={setPage}
                />
              }
            />
            <p className="mt-3 text-xs text-muted-foreground">
              ตามกติกา history ต้นฉบับ หากยังไม่ระบุยอดผลิตจริงแต่กรอกวันที่ผลิต
              เวลาเริ่ม/จบ และชื่อผู้ผลิตครบ
              จะถือว่ารายการนั้นผลิตครบสำหรับป้ายความคืบหน้าเท่านั้น
              ไม่เขียนยอดจริงทับ
            </p>
          </SectionCard>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">
        ข้อมูลในหน้านี้รีเซ็ตเมื่อรีโหลด · ไม่เชื่อมคำสั่งการผลิต Sales Hub, BOM
        หรือ Inventory
      </p>
      <BulkProductionDetail
        doc={records.find((r) => r.id === view?.id) ?? null}
        print={view?.print ?? false}
        onClose={() => setView(null)}
        onEdit={request}
      />
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
              ข้อมูลที่แก้ไขยังไม่ได้บันทึก
              การเปิดเอกสารอื่นหรือสร้างใบสั่งผลิตใหม่จะล้างค่าที่กรอก
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
