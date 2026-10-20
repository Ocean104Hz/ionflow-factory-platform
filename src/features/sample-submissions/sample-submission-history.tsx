"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  FactoryDataTable,
  Pagination,
  SelectField,
  SectionCard,
  EmptyState,
} from "@/src/components/factory/patterns";
import {
  emptySubmissionFilters,
  filterSubmissions,
  pageSubmissions,
  submissionFilterError,
  sampleDate,
  resultLabel,
  type SampleSubmission,
} from "./sample-submission-domain";

export function SampleSubmissionHistory({
  records,
  onEdit,
  onView,
  onPrint,
  onDelete,
}: {
  records: SampleSubmission[];
  onEdit: (r: SampleSubmission) => void;
  onView: (r: SampleSubmission) => void;
  onPrint: (r: SampleSubmission) => void;
  onDelete: (r: SampleSubmission) => void;
}) {
  const [filters, setFilters] = useState({ ...emptySubmissionFilters }),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5);
  const rows = filterSubmissions(records, filters),
    paged = pageSubmissions(rows, page, size),
    error = submissionFilterError(filters);
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติใบส่งตัวอย่าง"
        subtitle={`พบ ${rows.length} จาก ${records.length} เอกสารตัวอย่าง`}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="submission-search">ค้นหาใบส่งตัวอย่าง</Label>
            <Input
              id="submission-search"
              placeholder="เลขที่เอกสาร ชื่อตัวอย่าง Lot หรือผู้เกี่ยวข้อง"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
            />
          </div>
          {(
            [
              ["from", "ตั้งแต่วันที่"],
              ["to", "ถึงวันที่"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`submission-filter-${key}`}>{label}</Label>
              <Input
                id={`submission-filter-${key}`}
                type="date"
                value={filters[key]}
                aria-invalid={!!error}
                aria-describedby={error ? "submission-filter-error" : undefined}
                onChange={(e) => {
                  setFilters({ ...filters, [key]: e.target.value });
                  setPage(1);
                }}
              />
            </div>
          ))}
        </div>
        {error && (
          <p
            role="alert"
            id="submission-filter-error"
            className="mt-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setFilters({ ...emptySubmissionFilters });
              setPage(1);
            }}
          >
            ล้างตัวกรอง
          </Button>
          <div className="w-36">
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
        </div>
      </SectionCard>
      {records.length === 0 ? (
        <EmptyState
          title="ยังไม่มีใบส่งตัวอย่าง"
          description="สร้างเอกสารตัวอย่างได้จากแท็บสร้างใบส่งตัวอย่าง"
        />
      ) : (
        <FactoryDataTable
          rows={paged.rows}
          rowKey={(r) => r.id}
          minWidth={1000}
          columns={[
            {
              key: "doc",
              label: "เลขที่เอกสาร",
              render: (r) => (
                <Button
                  variant="link"
                  className="h-auto max-w-48 whitespace-normal break-all p-0 text-left"
                  onClick={() => onView(r)}
                >
                  {r.doc_no}
                </Button>
              ),
            },
            {
              key: "date",
              label: "วันที่",
              render: (r) => sampleDate(r.doc_date),
            },
            {
              key: "samples",
              label: "ตัวอย่าง / Lot",
              render: (r) => (
                <div className="max-w-64 space-y-1 whitespace-normal [overflow-wrap:anywhere]">
                  {r.rows.map((s) => (
                    <p key={s.id}>
                      {s.product_name}
                      <span className="block text-xs text-muted-foreground">
                        {s.lot_no} · {resultLabel(s.analysis_result_status)}
                      </span>
                    </p>
                  ))}
                </div>
              ),
            },
            {
              key: "count",
              label: "จำนวนตัวอย่าง",
              render: (r) => String(r.rows.length),
            },
            {
              key: "actions",
              label: "จัดการ",
              render: (r) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onView(r)}>
                    ดูรายละเอียด
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(r)}>
                    แก้ไข
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPrint(r)}
                  >
                    พรีวิวพิมพ์
                  </Button>
                  <ConfirmDialog
                    title={`ลบ ${r.doc_no}?`}
                    description="ลบเฉพาะข้อมูลตัวอย่าง รวมแบบฟอร์มที่กำลังแก้ไขเอกสารนี้ ไม่มีผลต่อระบบอื่น"
                    trigger={
                      <Button size="sm" variant="ghost" className="text-danger">
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
              total={rows.length}
              onChange={setPage}
            />
          }
        />
      )}
    </div>
  );
}
