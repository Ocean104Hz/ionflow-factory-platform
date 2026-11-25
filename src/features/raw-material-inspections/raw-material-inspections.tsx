"use client";

import { useState, useEffect, useId, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import { useMasterData } from "@/src/features/master-data/master-provider";
import { MasterSelect } from "@/src/features/master-data/master-select";
import {
  inspectionFields,
  fieldsForSave,
} from "@/src/features/master-data/internal-references";
import { Eye, Pencil, FlaskConical, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/src/components/ui/table";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  PageHeader,
  SectionCard,
  FactoryDataTable,
  Pagination,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { InspectionPrintPreview } from "./inspection-print-preview";
import { formatThaiDate as formatDate } from "@/src/lib/date/thai-date";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import {
  blankInspection,
  inspectionChecks,
  inspectionStatus,
  validateInspection,
  type Inspection,
  type CheckResult,
} from "./inspection-domain";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/src/components/ui/alert-dialog";

const filtersInitial = { search: "", status: "all", from: "", to: "" };
const statusTone = (status: string) =>
  status === "ผ่าน"
    ? ("success" as const)
    : status === "ไม่ผ่าน"
      ? ("destructive" as const)
      : ("warning" as const);
const resultOptions = [
  { value: "pending", label: "ยังไม่ตรวจ" },
  { value: "pass", label: "ผ่าน" },
  { value: "fail", label: "ไม่ผ่าน" },
  { value: "na", label: "ไม่เกี่ยวข้อง" },
];

type InspectionRecord = Inspection & { version: string };

type PendingFormAction =
  | { type: "new" }
  | { type: "edit"; record: InspectionRecord };

type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function readApi<T>(response: Response): Promise<T> {
  const result = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok || !result || !result.ok) {
    throw new Error(result && !result.ok ? result.message : "ไม่สามารถเชื่อมต่อระบบใบตรวจสอบได้");
  }
  return result.data;
}

async function loadInspectionRecords(signal?: AbortSignal): Promise<InspectionRecord[]> {
  const response = await fetch("/api/qc-raw-material", {
    cache: "no-store", credentials: "same-origin", signal,
  });
  const data = await readApi<InspectionRecord[]>(response);
  if (!Array.isArray(data)) throw new Error("ข้อมูลใบตรวจสอบไม่ถูกต้อง");
  return data;
}

async function persistInspection(row: Inspection, version?: string): Promise<InspectionRecord> {
  if (row.id && !version) throw new Error("ไม่พบ Version กรุณาโหลดข้อมูลใหม่");
  const csrfResponse = await fetch("/api/auth/csrf", {
    cache: "no-store", credentials: "same-origin",
  });
  const csrf = (await csrfResponse.json().catch(() => null)) as { ok: boolean; csrfToken?: string } | null;
  if (!csrfResponse.ok || !csrf?.ok || !csrf.csrfToken) {
    throw new Error("ไม่สามารถยืนยันคำขอบันทึกข้อมูลได้");
  }
  const response = await fetch(row.id
    ? `/api/qc-raw-material?id=${encodeURIComponent(row.id)}`
    : "/api/qc-raw-material", {
    method: row.id ? "PUT" : "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrf.csrfToken },
    body: JSON.stringify({ ...row, version }),
  });
  const saved = await readApi<InspectionRecord>(response);
  if (!saved?.id || typeof saved.version !== "string" || (row.id && saved.id !== row.id)) {
    throw new Error("ผลการบันทึกไม่ถูกต้อง กรุณาโหลดข้อมูลใหม่ก่อนลองอีกครั้ง");
  }
  return saved;
}

export function RawMaterialInspections() {
  const masters = useMasterData();
  const [tab, setTab] = useState("form");
  const [newInspection, setNewInspection] = useState<Inspection>(() => blankInspection());
  const [formVersion, setFormVersion] = useState(0);
  const [editingRecord, setEditingRecord] = useState<InspectionRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingFormAction | null>(null);
  const draftDirtyRef = useRef(false);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const saveLock = useRef(false);
  const retainedRecords = useRef<InspectionRecord[] | null>(null);
  useEffect(() => {
    if (retainedRecords.current === records) return;
    retainedRecords.current = records;
    for (const row of records) masters.retain(row.masterRefs ?? {});
  }, [records, masters]);
  useEffect(() => {
    const controller = new AbortController();
    loadInspectionRecords(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setRecords(data);
      setLoadState("ready");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ");
      setLoadState("error");
    });
    return () => controller.abort();
  }, []);

  async function saveDocument(row: Inspection, version?: string) {
    if (loadState !== "ready") throw new Error("กรุณาโหลดข้อมูลให้สำเร็จก่อนบันทึก");
    if (saveLock.current || deletingRef.current) throw new Error("กำลังดำเนินการ กรุณารอ");
    saveLock.current = true;
    setSavingDocument(true);
    try {
      return await persistInspection(row, version);
    } finally {
      saveLock.current = false;
      setSavingDocument(false);
    }
  }
  const [draftFilters, setDraftFilters] = useState(filtersInitial);
  const [filters, setFilters] = useState(filtersInitial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [opened, setOpened] = useState<{
    row: InspectionRecord;
    mode: "view";
  } | null>(null);
  const [message, setMessage] = useState("");
  const [filterError, setFilterError] = useState("");
  const filtered = records.filter((row) => {
    const search = filters.search.trim().toLowerCase();
    return (
      [
        row.number,
        row.lot,
        row.material,
        row.sender,
        row.reference,
        row.location,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search) &&
      (filters.status === "all" || inspectionStatus(row) === filters.status) &&
      (!filters.from || row.date >= filters.from) &&
      (!filters.to || row.date <= filters.to)
    );
  });
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / Number(pageSize))),
  );
  const rows = filtered.slice(
    (current - 1) * Number(pageSize),
    current * Number(pageSize),
  );
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(
    record: InspectionRecord,
  ): Promise<void> {
    if (deletingRef.current || saveLock.current) return;
    if (editingRecord?.id === record.id && draftDirtyRef.current) {
      setMessage("กรุณายกเลิกข้อมูลที่กำลังแก้ไขก่อนลบเอกสาร");
      return;
    }

    deletingRef.current = true;
    setDeleting(true);

    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const csrf = (await csrfResponse.json()) as {
        ok: boolean;
        csrfToken?: string;
      };

      if (
        !csrfResponse.ok ||
        !csrf.ok ||
        !csrf.csrfToken
      ) {
        throw new Error(
          "ไม่สามารถยืนยันคำขอลบเอกสารได้",
        );
      }

      const response = await fetch(
        `/api/qc-raw-material?id=${encodeURIComponent(record.id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf.csrfToken,
          },
          body: JSON.stringify({
            version: record.version,
          }),
        },
      );

      const result = (await response.json()) as
        | { ok: true; data: { id: string } }
        | { ok: false; message: string };

      if (!response.ok || !result.ok) {
        throw new Error(
          !result.ok
            ? result.message
            : "ไม่สามารถลบเอกสารได้",
        );
      }

      setRecords((previous) =>
        previous.filter((item) => item.id !== record.id),
      );

      setOpened(null);
      if (editingRecord?.id === record.id) resetForm();
      setTab("history");
      setMessage(`ลบเอกสาร ${record.number} แล้ว`);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ลบเอกสารไม่สำเร็จ",
      );
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }
  function resetForm(): void {
    draftDirtyRef.current = false;
    setEditingRecord(null);
    setNewInspection(blankInspection());
    setFormVersion((previous) => previous + 1);
    setOpened(null);
    setMessage("");
    setTab("form");
  }

  function openRecord(record: InspectionRecord): void {
    const copy = structuredClone(record);
    draftDirtyRef.current = false;
    setEditingRecord(copy);
    setNewInspection(copy);
    setFormVersion((previous) => previous + 1);
    setOpened(null);
    setMessage("");
    setTab("form");
  }

  function requestNewDocument(): void {
    if (saveLock.current || deletingRef.current) return;
    if (draftDirtyRef.current) {
      setPendingAction({ type: "new" });
      return;
    }
    resetForm();
  }

  async function handleEditRecord(record: InspectionRecord): Promise<void> {
    if (saveLock.current || deletingRef.current) return;
    setMessage("");
    saveLock.current = true;
    setSavingDocument(true);
    try {
      // The QC API currently exposes the list, not a detail endpoint.
      const latestRecords = await loadInspectionRecords();
      const latest = latestRecords.find((entry) => entry.id === record.id);
      if (!latest || !/^[1-9]\d*$/.test(latest.version)) {
        throw new Error("ไม่พบเอกสารหรือเอกสารถูกลบแล้ว กรุณาโหลดหน้าใหม่");
      }
      setRecords((previous) => previous.map((entry) => entry.id === latest.id ? latest : entry));
      if (draftDirtyRef.current) {
        setOpened(null);
        setPendingAction({ type: "edit", record: latest });
        return;
      }
      openRecord(latest);
    } catch (error: unknown) {
      setOpened(null);
      setMessage(error instanceof Error ? error.message : "เปิดเอกสารไม่สำเร็จ");
      setTab("history");
    } finally {
      saveLock.current = false;
      setSavingDocument(false);
    }
  }

  function confirmPendingAction(): void {
    if (!pendingAction || saveLock.current || deletingRef.current) return;
    if (pendingAction.type === "new") resetForm();
    else openRecord(pendingAction.record);
    setPendingAction(null);
  }

  const columns: Column<InspectionRecord>[] = [
    {
      key: "number",
      label: "เลขที่เอกสาร",
      render: (r) => (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setOpened({ row: r, mode: "view" })}
        >
          {r.number}
        </Button>
      ),
    },
    { key: "date", label: "วันที่ตรวจ", render: (r) => formatDate(r.date) },
    {
      key: "material",
      label: "วัตถุดิบ / ผู้ส่ง",
      render: (r) => (
        <div className="min-w-48">
          <p className="font-medium">{r.material}</p>
          <p className="text-xs text-muted-foreground">{r.sender}</p>
        </div>
      ),
    },
    {
      key: "lot",
      label: "Lot / เที่ยวรถ",
      render: (r) => (
        <div>
          {r.lot}
          <p className="text-xs text-muted-foreground">
            เที่ยว {r.trip || "—"}
          </p>
        </div>
      ),
    },
    { key: "location", label: "โรงงาน", render: (r) => r.location },
    { key: "ref", label: "เอกสารอ้างอิง", render: (r) => r.reference || "—" },
    {
      key: "checks",
      label: "ผ่าน / ตรวจจริง",
      render: (r) => {
        const checks = Object.values(r.checks);
        return `${checks.filter((c) => c.result === "pass").length} / ${checks.filter((c) => c.result === "pass" || c.result === "fail").length}`;
      },
    },
    {
      key: "status",
      label: "ผลการตรวจ",
      render: (r) => (
        <StatusBadge tone={statusTone(inspectionStatus(r))}>
          {inspectionStatus(r)}
        </StatusBadge>
      ),
    },
    {
      key: "inspector",
      label: "ผู้ตรวจ / ผู้อนุมัติ",
      render: (r) => (
        <div>
          {r.inspector || "—"}
          <p className="text-xs text-muted-foreground">
            {r.approver || "ยังไม่ระบุผู้อนุมัติ"}
          </p>
        </div>
      ),
    },

    {
      key: "actions",
      label: "จัดการ",
      render: (r) => (
        <div className="flex items-center gap-1">

          {/* ดูรายละเอียด */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            title="ดูรายละเอียด"
            aria-label="ดูรายละเอียด"
            onClick={() => setOpened({ row: r, mode: "view" })}
          >
            <Eye className="size-4" />
          </Button>

          {/* แก้ไข */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            title="แก้ไข"
            aria-label="แก้ไข"
            disabled={savingDocument || deleting}
            onClick={() => void handleEditRecord(r)}
          >
            <Pencil className="size-4" />
          </Button>

          {/* พิมพ์เอกสาร */}
          <InspectionPrintPreview
            row={r}
            iconOnly
          />

          {/* ลบเอกสาร */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 hover:bg-destructive/5 hover:text-destructive"
                title="ลบเอกสาร"
                aria-label="ลบเอกสาร"
                disabled={deleting || savingDocument}
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent className="bg-surface">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ลบเอกสาร {r.number}?
                </AlertDialogTitle>

                <AlertDialogDescription>
                  เอกสารจะถูกนำออกจากรายการประวัติ
                  โดยระบบยังเก็บข้อมูลและประวัติการดำเนินการไว้
                  ในฐานข้อมูล
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>
                <AlertDialogCancel>
                  ยกเลิก
                </AlertDialogCancel>

                <AlertDialogAction
                  disabled={deleting || savingDocument}
                  onClick={() => void handleDelete(r)}
                >
                  ยืนยัน
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </div>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบตรวจสอบคุณภาพวัตถุดิบ"
        description="บันทึกผลตรวจรับวัตถุดิบและติดตามคุณภาพราย Lot"
      />
      {loadState !== "ready" && (
        <p role={loadState === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">
          {loadState === "loading" ? "กำลังโหลดข้อมูลใบตรวจสอบ..." : `${loadError} กรุณาโหลดหน้าใหม่`}
        </p>
      )}
      <Tabs value={tab} onValueChange={(value) => { if (!saveLock.current && !deletingRef.current) setTab(value); }} className="min-w-0">
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="มุมมองใบตรวจสอบคุณภาพวัตถุดิบ">
            <TabsTrigger value="form">สร้างใบตรวจสอบ</TabsTrigger>
            <TabsTrigger value="history">ประวัติใบตรวจสอบ</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="form" forceMount className="mt-3 min-w-0 data-[state=inactive]:hidden">
          {editingRecord && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-sm text-primary">
                กำลังแก้ไขใบตรวจสอบคุณภาพวัตถุดิบ: {" "}
                <span className="font-medium">{editingRecord.number}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingDocument || deleting}
                onClick={requestNewDocument}
              >
                สร้างเอกสารใหม่
              </Button>
            </div>
          )}
          <InspectionForm
            key={formVersion}
            initial={newInspection}
            readOnly={false}
            records={records}
            inline
            draftDirtyRef={draftDirtyRef}
            saveDisabled={loadState !== "ready" || savingDocument || deleting}
            onClose={() => setTab("history")}
            onEdit={() => undefined}
            onSave={async (row) => {
              const saved = await saveDocument(
                { ...row, id: editingRecord?.id ?? "", number: row.number.trim() },
                editingRecord?.version,
              );
              setRecords((all) => [saved, ...all.filter((record) => record.id !== saved.id)]);
              resetForm();
              setMessage(editingRecord ? `แก้ไข ${saved.number} สำเร็จ` : `บันทึก ${saved.number} แล้ว`);
              setPage(1);
              setTab("history");
            }}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-3 min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {["รอตรวจสอบ", "ผ่าน", "ไม่ผ่าน"].map((status) => (
              <Card key={status} className="py-4">
                <CardContent className="flex items-center justify-between gap-4 px-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{status}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {records.filter((r) => inspectionStatus(r) === status).length}
                    </p>
                  </div>
                  <FlaskConical className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
          <form
            className="factory-filter grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_150px_155px_155px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                draftFilters.from &&
                draftFilters.to &&
                draftFilters.from > draftFilters.to
              ) {
                setFilterError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
                return;
              }
              setFilterError("");
              setFilters(draftFilters);
              setPage(1);
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="qc-search">ค้นหาใบตรวจสอบ</Label>
              <Input
                id="qc-search"
                placeholder="เลขเอกสาร / Lot / วัตถุดิบ / ผู้ส่ง"
                value={draftFilters.search}
                onChange={(e) =>
                  setDraftFilters({ ...draftFilters, search: e.target.value })
                }
              />
            </div>
            <SelectField
              label="ผลการตรวจ"
              value={draftFilters.status}
              onChange={(status) => setDraftFilters({ ...draftFilters, status })}
              options={[
                { value: "all", label: "ทั้งหมด" },
                ...["รอตรวจสอบ", "ผ่าน", "ไม่ผ่าน"].map((value) => ({
                  value,
                  label: value,
                })),
              ]}
            />
            {(["from", "to"] as const).map((key) => (
              <ThaiBuddhistDatePicker
                key={key}
                label={key === "from" ? "วันที่เริ่มต้น" : "วันที่สิ้นสุด"}
                value={draftFilters[key]}
                onChange={(value) =>
                  setDraftFilters((previous) => ({
                    ...previous,
                    [key]: value,
                  }))
                }
              />
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftFilters(filtersInitial);
                  setFilters(filtersInitial);
                  setFilterError("");
                  setPage(1);
                }}
              >
                ล้างตัวกรอง
              </Button>
              <Button type="submit">ค้นหา</Button>
            </div>
          </form>
          {filterError && (
            <p role="alert" className="text-danger">
              {filterError}
            </p>
          )}
          <p role="status" className="text-sm text-muted-foreground">
            {message}
          </p>
          <FactoryDataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            minWidth={1400}
            pagination={
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 [&>div:last-child]:border-0 [&>div:last-child]:p-0">
                <div className="w-36">
                  <SelectField
                    label="จำนวนต่อหน้า"
                    value={pageSize}
                    onChange={(v) => {
                      setPageSize(v);
                      setPage(1);
                    }}
                    options={[5, 10, 25, 50].map((n) => ({
                      value: String(n),
                      label: `${n} รายการ`,
                    }))}
                  />
                </div>
                <Pagination
                  page={current}
                  pageSize={Number(pageSize)}
                  total={filtered.length}
                  onChange={setPage}
                />
              </div>
            }
          />
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => { if (!open) setPendingAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ละทิ้งข้อมูลที่ยังไม่บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>
              ข้อมูลที่กำลังกรอกหรือแก้ไขอยู่จะถูกล้าง หากยังไม่ได้บันทึก
              การสลับแท็บเพียงอย่างเดียวจะไม่ล้างข้อมูล
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingAction}>
              ยืนยันละทิ้งข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!opened}
        onOpenChange={(open) => {
          if (!open && !saveLock.current) setOpened(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1600px]">
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-16 sm:px-7 sm:pr-16">
            <DialogTitle>
              รายละเอียดใบตรวจสอบคุณภาพวัตถุดิบ
            </DialogTitle>
            <DialogDescription>
              บันทึกผล 7 หัวข้อจากแบบตรวจ iTech ·
              ไม่ได้เชื่อมใบรับวัตถุดิบหรือระบบอนุมัติจริง
            </DialogDescription>
          </DialogHeader>
          <div
            className="qc-modal-scroll min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7"
            tabIndex={0}
            role="region"
            aria-label="เนื้อหาใบตรวจสอบคุณภาพวัตถุดิบ เลื่อนเพื่อดูข้อมูลเพิ่มเติม"
          >
            {opened && (
              <InspectionForm
                key={`${opened.mode}-${opened.row.id}`}
                initial={opened.row}
                readOnly
                records={records}
                onClose={() => setOpened(null)}
                onEdit={() => void handleEditRecord(opened.row)}
                saveDisabled={loadState !== "ready" || savingDocument}
                onSave={async () => undefined}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InspectionForm({
  initial,
  readOnly,
  records,
  inline = false,
  saveDisabled = false,
  draftDirtyRef,
  onClose,
  onEdit,
  onSave,
}: {
  initial: Inspection;
  readOnly: boolean;
  records: Inspection[];
  inline?: boolean;
  saveDisabled?: boolean;
  draftDirtyRef?: { current: boolean };
  onClose: () => void;
  onEdit: () => void;
  onSave: (row: Inspection) => Promise<void>;
}) {
  const masters = useMasterData();
  const formId = useId();
  const [form, setForm] = useState(initial);
  useEffect(() => {
    if (draftDirtyRef) {
      draftDirtyRef.current = JSON.stringify(form) !== JSON.stringify(initial);
    }
  }, [draftDirtyRef, form, initial]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const fields: {
    key: keyof Omit<Inspection, "checks" | "finalized" | "masterRefs">;
    label: string;
    type?: string;
    required?: boolean;
  }[] = [
      { key: "number", label: "เลขที่เอกสาร", required: true },
      { key: "date", label: "วันที่เอกสาร", type: "date", required: true },
      { key: "location", label: "โรงงาน / สถานที่ตรวจ", required: true },
      { key: "lot", label: "Lot No.", required: true },
      { key: "trip", label: "เที่ยวรถ", type: "number" },
      { key: "sender", label: "ชื่อผู้ส่ง / ผู้จำหน่าย", required: true },
      { key: "material", label: "ประเภท / ชื่อวัตถุดิบ", required: true },
      { key: "reference", label: "เอกสารอ้างอิงใบรับ (ระบุเอง)" },
    ];
  function field(key: keyof Inspection, value: string) {
    setForm((r) => ({ ...r, [key]: value }));
  }
  async function save(finalized: boolean) {
    if (readOnly || saveDisabled || savingRef.current) return;
    let row = { ...form, finalized };
    try {
      row = {
        ...row,
        masterRefs: masters.capture(
          fieldsForSave(
            inspectionFields(row),
            inspectionFields(initial),
            initial.masterRefs,
          ),
          initial.masterRefs,
        ),
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "ข้อมูลอ้างอิงไม่ถูกต้อง");
      return;
    }
    const issue = validateInspection(row, records);
    setError(issue);
    if (issue) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(row);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const input = (
    key: keyof Omit<Inspection, "checks" | "finalized" | "masterRefs">,
    label: string,
    type = "text",
    required = false,
  ) =>
    type === "date" ? (
      <ThaiBuddhistDatePicker
        key={key}
        label={`${label}${required ? " *" : ""}`}
        value={String(form[key] ?? "")}
        disabled={readOnly || saving}
        onChange={(value) => field(key, value)}
      />
    ) : !readOnly && ["location", "inspector", "approver"].includes(key) ? (
      <MasterSelect
        key={key}
        kind={key === "location" ? "areas" : "personnel"}
        label={label}
        value={String(form[key] ?? "")}
        reference={form.masterRefs?.[key]}
        onChange={(value) => field(key, value)}
      />
    ) : (
      <div key={key} className="grid gap-2">
        <Label htmlFor={`${formId}-inspection-${key}`}>
          {label}
          {required ? " *" : ""}
        </Label>
        <Input
          id={`${formId}-inspection-${key}`}
          type={type}
          required={required}
          readOnly={readOnly}
          min={type === "number" ? 1 : undefined}
          step={type === "number" ? 1 : undefined}
          value={form[key]}
          onChange={(e) => field(key, e.target.value)}
        />
      </div>
    );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save(true);
      }}
    >
      <fieldset disabled={saving} className="contents">
        <div className="flex items-center gap-3">
          <StatusBadge tone={statusTone(inspectionStatus(form))}>
            {inspectionStatus(form)}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">
            ผลตรวจไม่ใช่สถานะอนุมัติ
          </span>
        </div>
        <SectionCard title="ข้อมูลการตรวจรับ">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map((f) => input(f.key, f.label, f.type, f.required))}
            {!readOnly && (
              <MasterSelect
                kind="suppliers"
                label="เลือกผู้จำหน่ายจากทะเบียน (ไม่บังคับ)"
                value={
                  form.masterRefs?.sender?.value === form.sender
                    ? form.sender
                    : ""
                }
                reference={form.masterRefs?.sender}
                onChange={(sender, ref) =>
                  setForm((r) => ({
                    ...r,
                    sender,
                    masterRefs: ref
                      ? { ...r.masterRefs, sender: ref }
                      : r.masterRefs,
                  }))
                }
              />
            )}
          </div>
        </SectionCard>
        <SectionCard
          title="รายการตรวจสอบคุณภาพ"
          subtitle="ไม่ใช้เกณฑ์ตัวเลขเดียวกับวัตถุดิบทุกชนิด โปรดระบุค่าที่วัดได้และเกณฑ์ที่ใช้อ้างอิง · ไม่ผ่าน/ไม่เกี่ยวข้องต้องมีเหตุผล"
        >
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-185">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>หัวข้อตรวจ / แนวทาง</TableHead>
                  <TableHead className="w-44">ผลตรวจ</TableHead>
                  <TableHead className="min-w-64">
                    ค่าที่วัดได้ / หมายเหตุ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspectionChecks.map(({ key, label, hint }, i) => (
                  <TableRow key={key}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium">{label}</p>
                      <p className="mt-1 max-w-72 text-xs text-muted-foreground">
                        {hint}
                      </p>
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <StatusBadge
                          tone={
                            form.checks[key].result === "pass"
                              ? "success"
                              : form.checks[key].result === "fail"
                                ? "destructive"
                                : "neutral"
                          }
                        >
                          {resultOptions.find(
                            (o) => o.value === form.checks[key].result,
                          )?.label ?? "ยังไม่ตรวจ"}
                        </StatusBadge>
                      ) : (
                        <SelectField
                          label={`ผลตรวจ: ${label}`}
                          value={form.checks[key].result}
                          options={resultOptions}
                          onChange={(value) =>
                            setForm((r) => ({
                              ...r,
                              checks: {
                                ...r.checks,
                                [key]: {
                                  ...r.checks[key],
                                  result: value as CheckResult,
                                },
                              },
                            }))
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Label className="sr-only" htmlFor={`${formId}-note-${key}`}>
                        หมายเหตุ: {label}
                      </Label>
                      <Textarea
                        id={`${formId}-note-${key}`}
                        readOnly={readOnly}
                        value={form.checks[key].note}
                        placeholder={
                          readOnly ? "—" : "ระบุผลวัด / เกณฑ์ / เหตุผล"
                        }
                        onChange={(e) =>
                          setForm((r) => ({
                            ...r,
                            checks: {
                              ...r.checks,
                              [key]: { ...r.checks[key], note: e.target.value },
                            },
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
        <SectionCard
          title="ผู้ตรวจสอบและผู้อนุมัติ"
          subtitle="ระบุชื่อเพื่อแสดงในแบบฟอร์มเท่านั้น ไม่ใช่การลงนามหรืออนุมัติผ่านระบบสิทธิ์"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {input("inspector", "ผู้ตรวจสอบ / ผู้จัดทำ")}
            {input("inspectorDate", "วันที่ตรวจสอบ", "date")}
            {input("approver", "ผู้อนุมัติ (ถ้ามี)")}
            {input("approverDate", "วันที่อนุมัติ", "date")}
          </div>
        </SectionCard>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-danger"
        >
          {error}
        </p>
      )}
      <div className={inline
        ? "no-print flex flex-wrap justify-end gap-2"
        : "sticky -bottom-5 z-10 -mx-5 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4 sm:-mx-7 sm:px-7"
      }>
        <InspectionPrintPreview row={form} unsaved={!readOnly} />
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          {inline ? "กลับไปประวัติ" : "ปิด"}
        </Button>
        {readOnly ? (
          <Button type="button" onClick={onEdit}>
            <Pencil />
            แก้ไข
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" disabled={saving || saveDisabled} onClick={() => void save(false)}>
              บันทึกรอตรวจสอบ
            </Button>
            <Button type="submit" disabled={saving || saveDisabled}>บันทึกผลตรวจครบถ้วน</Button>
          </>
        )}
      </div>
    </form>
  );
}
