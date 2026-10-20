"use client";
import { useState } from "react";
import { Eye, Pencil, Printer, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  SectionCard,
  FactoryDataTable,
  Pagination,
  SelectField,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  emptyLogFilters,
  filterLogs,
  logFilterError,
  pageLogs,
  logDate,
  selectedAnalysis,
  type SubmissionLog,
} from "./submission-log-domain";

export function SubmissionLogHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: {
  records: SubmissionLog[];
  onEdit: (r: SubmissionLog) => void;
  onView: (r: SubmissionLog) => void;
  onPrint: (r: SubmissionLog) => void;
  onDelete: (r: SubmissionLog) => void;
}) {
  const [draft, setDraft] = useState({ ...emptyLogFilters }),
    [filters, setFilters] = useState({ ...emptyLogFilters }),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5),
    [error, setError] = useState("");
  const filtered = filterLogs(records, filters),
    paged = pageLogs(filtered, page, size);
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติแบบบันทึก"
        subtitle={`พบ ${filtered.length} จาก ${records.length} เอกสารสาธิต · วันที่ส่งใช้วันที่ลงชื่อผู้ส่ง`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const issue = logFilterError(draft);
            setError(issue);
            if (!issue) {
              setFilters({ ...draft });
              setPage(1);
            }
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid content-start gap-2">
              <Label htmlFor="log-search">ค้นหาแบบบันทึก</Label>
              <Input
                id="log-search"
                value={draft.search}
                placeholder="คำขอ รหัสตัวอย่าง ชื่อ หรือรายการตรวจ"
                onChange={(e) => setDraft({ ...draft, search: e.target.value })}
              />
            </div>
            {(
              [
                ["from", "ตั้งแต่วันที่ส่ง"],
                ["to", "ถึงวันที่ส่ง"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid content-start gap-2">
                <Label htmlFor={`log-filter-${key}`}>{label}</Label>
                <Input
                  id={`log-filter-${key}`}
                  type="date"
                  value={draft[key]}
                  aria-invalid={!!error}
                  aria-describedby={error ? "log-filter-error" : undefined}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft({ ...emptyLogFilters });
                  setFilters({ ...emptyLogFilters });
                  setError("");
                  setPage(1);
                }}
              >
                ล้างตัวกรอง
              </Button>
              <Button type="submit">
                <Search aria-hidden="true" />
                ค้นหา
              </Button>
            </div>
          </div>
          {error && (
            <p
              id="log-filter-error"
              role="alert"
              className="text-sm text-danger"
            >
              {error}
            </p>
          )}
        </form>
      </SectionCard>
      <div className="ml-auto w-36">
        <SelectField
          label="จำนวนต่อหน้า"
          value={String(size)}
          onChange={(v) => {
            setSize(Number(v));
            setPage(1);
          }}
          options={[5, 10, 20].map((n) => ({
            value: String(n),
            label: `${n} รายการ`,
          }))}
        />
      </div>
      <FactoryDataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        minWidth={1100}
        columns={[
          {
            key: "doc",
            label: "เลขที่คำขอ",
            render: (r) => (
              <Button
                variant="link"
                className="h-auto max-w-44 whitespace-normal break-all p-0 text-left"
                onClick={() => onView(r)}
              >
                {r.doc_no}
              </Button>
            ),
          },
          {
            key: "date",
            label: "วันที่ส่ง",
            render: (r) => logDate(r.sender_sign.signed_date),
          },
          {
            key: "sender",
            label: "ผู้ส่งตัวอย่าง",
            render: (r) => (
              <div className="max-w-40 whitespace-normal break-words">
                {r.sender_sign.signer_name}
                <p className="text-xs text-muted-foreground">
                  ผู้ขอ: {r.requester_name}
                </p>
              </div>
            ),
          },
          {
            key: "code",
            label: "รหัสตัวอย่าง",
            render: (r) => (
              <span className="block max-w-32 whitespace-normal break-all">
                {r.sample_code}
              </span>
            ),
          },
          {
            key: "name",
            label: "ชื่อตัวอย่าง",
            render: (r) => (
              <span className="block max-w-44 whitespace-normal break-words">
                {r.sample_name}
              </span>
            ),
          },
          {
            key: "analysis",
            label: "รายการตรวจวิเคราะห์",
            render: (r) => (
              <div className="max-w-52 whitespace-normal break-words">
                <span className="font-medium">
                  {selectedAnalysis(r).length} รายการ
                </span>
                <p className="text-xs text-muted-foreground">
                  {selectedAnalysis(r)
                    .map(([, label]) => label)
                    .join(" · ")}
                </p>
              </div>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onView(r)}>
                  <Eye aria-hidden="true" />
                  ดู
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit(r)}>
                  <Pencil aria-hidden="true" />
                  แก้ไข
                </Button>
                <Button variant="outline" size="sm" onClick={() => onPrint(r)}>
                  <Printer aria-hidden="true" />
                  พรีวิวพิมพ์
                </Button>
                <ConfirmDialog
                  title={`ลบ ${r.doc_no}?`}
                  description="ลบข้อมูลสาธิตเท่านั้น หากกำลังแก้ไขเอกสารนี้ แบบฟอร์มจะถูกล้าง ไม่มีผลต่อระบบจริง"
                  trigger={
                    <Button variant="ghost" size="sm" className="text-danger">
                      ลบ
                    </Button>
                  }
                  onConfirm={() => onDelete(r)}
                />
              </div>
            ),
          },
        ]}
        pagination={
          <Pagination
            page={paged.page}
            pageSize={size}
            total={filtered.length}
            onChange={setPage}
          />
        }
      />
    </div>
  );
}
