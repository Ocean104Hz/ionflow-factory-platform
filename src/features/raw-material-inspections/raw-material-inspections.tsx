"use client";

import { useState } from "react";
import { FilePlus2, Eye, Pencil, FlaskConical } from "lucide-react";
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
import { mockInspections } from "@/src/lib/mock-data/raw-material-inspections";
import { InspectionPrintPreview } from "./inspection-print-preview";
import { date as formatDate } from "@/src/lib/formatters";
import {
  blankInspection,
  inspectionChecks,
  inspectionStatus,
  validateInspection,
  type Inspection,
  type CheckResult,
} from "./inspection-domain";

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

export function RawMaterialInspections() {
  // shortcut: demo state resets on navigation/reload; replace with a repository when backend wiring is authorized.
  const [records, setRecords] = useState<Inspection[]>(mockInspections);
  const [draftFilters, setDraftFilters] = useState(filtersInitial);
  const [filters, setFilters] = useState(filtersInitial);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [opened, setOpened] = useState<{
    row: Inspection;
    mode: "new" | "view" | "edit";
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
  const columns: Column<Inspection>[] = [
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
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpened({ row: r, mode: "view" })}
          >
            <Eye className="size-4" />
            ดู
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpened({ row: r, mode: "edit" })}
          >
            <Pencil className="size-4" />
            แก้ไข
          </Button>
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบตรวจสอบคุณภาพวัตถุดิบ"
        description="บันทึกผลตรวจรับวัตถุดิบและติดตามคุณภาพราย Lot · ข้อมูลจำลองเท่านั้น"
        actions={
          <Button
            onClick={() => setOpened({ row: blankInspection(), mode: "new" })}
          >
            <FilePlus2 />
            สร้างใบตรวจสอบ
          </Button>
        }
      />
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
          <div key={key} className="grid gap-2">
            <Label htmlFor={`qc-${key}`}>
              {key === "from" ? "วันที่เริ่มต้น" : "วันที่สิ้นสุด"}
            </Label>
            <Input
              id={`qc-${key}`}
              type="date"
              value={draftFilters[key]}
              min={key === "to" ? draftFilters.from : undefined}
              onChange={(e) =>
                setDraftFilters({ ...draftFilters, [key]: e.target.value })
              }
            />
          </div>
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
      <Dialog
        open={!!opened}
        onOpenChange={(open) => {
          if (!open) setOpened(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1600px]">
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-16 sm:px-7 sm:pr-16">
            <DialogTitle>
              {opened?.mode === "new"
                ? "สร้างใบตรวจสอบคุณภาพวัตถุดิบ"
                : opened?.mode === "edit"
                  ? "แก้ไขใบตรวจสอบคุณภาพวัตถุดิบ"
                  : "รายละเอียดใบตรวจสอบคุณภาพวัตถุดิบ"}
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
                readOnly={opened.mode === "view"}
                records={records}
                onClose={() => setOpened(null)}
                onEdit={() => setOpened({ ...opened, mode: "edit" })}
                onSave={(row) => {
                  const saved = {
                    ...row,
                    number: row.number.trim(),
                    id: row.id || crypto.randomUUID(),
                  };
                  setRecords((all) =>
                    row.id
                      ? all.map((r) => (r.id === row.id ? saved : r))
                      : [saved, ...all],
                  );
                  setOpened({ row: saved, mode: "view" });
                  setMessage(
                    `บันทึก ${saved.number} แล้ว · ข้อมูลจะรีเซ็ตเมื่อออกจากหน้าหรือโหลดใหม่`,
                  );
                }}
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
  onClose,
  onEdit,
  onSave,
}: {
  initial: Inspection;
  readOnly: boolean;
  records: Inspection[];
  onClose: () => void;
  onEdit: () => void;
  onSave: (row: Inspection) => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const fields: {
    key: keyof Omit<Inspection, "checks" | "finalized">;
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
  function save(finalized: boolean) {
    const row = { ...form, finalized };
    const issue = validateInspection(row, records);
    setError(issue);
    if (!issue) onSave(row);
  }
  const input = (
    key: keyof Omit<Inspection, "checks" | "finalized">,
    label: string,
    type = "text",
    required = false,
  ) => (
    <div key={key} className="grid gap-2">
      <Label htmlFor={`inspection-${key}`}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={`inspection-${key}`}
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
        save(true);
      }}
    >
      <div className="flex items-center gap-3">
        <StatusBadge tone={statusTone(inspectionStatus(form))}>
          {inspectionStatus(form)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          ผลตรวจไม่ใช่สถานะอนุมัติ · ข้อมูลสาธิต
        </span>
      </div>
      <SectionCard title="ข้อมูลการตรวจรับ">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {fields.map((f) => input(f.key, f.label, f.type, f.required))}
        </div>
      </SectionCard>
      <SectionCard
        title="รายการตรวจสอบคุณภาพ"
        subtitle="ไม่ใช้เกณฑ์ตัวเลขเดียวกับวัตถุดิบทุกชนิด โปรดระบุค่าที่วัดได้และเกณฑ์ที่ใช้อ้างอิง · ไม่ผ่าน/ไม่เกี่ยวข้องต้องมีเหตุผล"
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[740px]">
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
                    <Label className="sr-only" htmlFor={`note-${key}`}>
                      หมายเหตุ: {label}
                    </Label>
                    <Textarea
                      id={`note-${key}`}
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
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-danger"
        >
          {error}
        </p>
      )}
      <div className="sticky -bottom-5 z-10 -mx-5 flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-4 sm:-mx-7 sm:px-7">
        <InspectionPrintPreview row={form} unsaved={!readOnly} />
        <Button type="button" variant="outline" onClick={onClose}>
          ปิด
        </Button>
        {readOnly ? (
          <Button type="button" onClick={onEdit}>
            <Pencil />
            แก้ไข
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => save(false)}>
              บันทึกรอตรวจสอบ
            </Button>
            <Button type="submit">บันทึกผลตรวจครบถ้วน</Button>
          </>
        )}
      </div>
    </form>
  );
}
