"use client";
import { useState, type ReactNode } from "react";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import {
  FactoryDataTable,
  Pagination,
  SelectField,
  SectionCard,
  StatusBadge,
  EmptyState,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { ncDecisions, type NCReport } from "./nc-report-types";
import {
  emptyNCFilters,
  filterNC,
  paginateNC,
  ncDate,
  ncFilterError,
} from "./nc-report-mock-helpers";

export function NCReportHistory({
  records,
  onView,
  onEdit,
  onPrint,
  onDelete,
}: {
  records: NCReport[];
  onView: (r: NCReport) => void;
  onEdit: (r: NCReport) => void;
  onPrint: (r: NCReport) => void;
  onDelete: (r: NCReport) => void;
}) {
  const [filters, setFilters] = useState({ ...emptyNCFilters }),
    [page, setPage] = useState(1),
    [size, setSize] = useState(5);
  const rows = filterNC(records, filters),
    paged = paginateNC(rows, page, size),
    filterError = ncFilterError(filters);
  function action(label: string, icon: ReactNode, click: () => void) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={click}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติใบ NC"
        subtitle={`พบ ${rows.length} จาก ${records.length} รายการตัวอย่าง`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="nc-search">ค้นหาใบ NC</Label>
            <Input
              id="nc-search"
              placeholder="เอกสาร สินค้า ผู้พบ แผนก หรือข้อบกพร่อง"
              value={filters.search}
              onChange={(e) => {
                setFilters({ ...filters, search: e.target.value });
                setPage(1);
              }}
            />
          </div>
          <SelectField
            label="กรองแผนก"
            value={filters.department}
            options={[
              { value: "all", label: "ทุกแผนก" },
              ...Array.from(new Set(records.map((r) => r.department))).map(
                (v) => ({ value: v, label: v }),
              ),
            ]}
            onChange={(v) => {
              setFilters({ ...filters, department: v });
              setPage(1);
            }}
          />
          {(
            [
              ["from", "ตั้งแต่วันที่"],
              ["to", "ถึงวันที่"],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="space-y-2">
              <Label htmlFor={`nc-filter-${k}`}>{l}</Label>
              <Input
                id={`nc-filter-${k}`}
                type="date"
                value={filters[k]}
                aria-invalid={!!filterError}
                aria-describedby={filterError ? "nc-filter-error" : undefined}
                onChange={(e) => {
                  setFilters({ ...filters, [k]: e.target.value });
                  setPage(1);
                }}
              />
            </div>
          ))}
        </div>
        {filterError && (
          <p
            role="alert"
            id="nc-filter-error"
            className="mt-3 text-sm text-danger"
          >
            {filterError}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setFilters({ ...emptyNCFilters });
              setPage(1);
            }}
          >
            ล้างตัวกรอง
          </Button>
          <div className="w-36">
            <SelectField
              label="จำนวนต่อหน้า"
              value={String(size)}
              options={[5, 10, 20].map((n) => ({
                value: String(n),
                label: `${n} รายการ`,
              }))}
              onChange={(v) => {
                setSize(Number(v));
                setPage(1);
              }}
            />
          </div>
        </div>
      </SectionCard>
      {records.length === 0 ? (
        <EmptyState
          title="ยังไม่มีใบ NC ตัวอย่าง"
          description="กลับไปที่สร้างใบ NC เพื่อบันทึกข้อมูลตัวอย่าง"
        />
      ) : (
        <FactoryDataTable
          rows={paged.rows}
          rowKey={(r) => r.id}
          minWidth={1050}
          columns={[
            {
              key: "number",
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
            { key: "date", label: "วันที่", render: (r) => ncDate(r.doc_date) },
            {
              key: "discoverer",
              label: "ผู้พบ",
              render: (r) => (
                <span className="block max-w-40 whitespace-normal break-words">
                  {r.discoverer}
                </span>
              ),
            },
            {
              key: "department",
              label: "แผนก",
              render: (r) => (
                <span className="block max-w-32 whitespace-normal break-words">
                  {r.department}
                </span>
              ),
            },
            {
              key: "product",
              label: "สินค้า",
              render: (r) => (
                <span className="block max-w-52 whitespace-normal break-words">
                  {r.product_name}
                </span>
              ),
            },
            {
              key: "quantity",
              label: "ปริมาณ",
              render: (r) => `${r.quantity} ${r.unit}`,
            },
            {
              key: "decisions",
              label: "แนวทางจัดการ (ตัวอย่าง)",
              render: (r) => (
                <div className="flex max-w-60 flex-wrap gap-1">
                  {ncDecisions
                    .filter(([k]) => r.decisions[k])
                    .map(([k, l]) => (
                      <StatusBadge key={k}>{l}</StatusBadge>
                    ))}
                </div>
              ),
            },
            {
              key: "actions",
              label: "จัดการ",
              render: (r) => (
                <div className="flex gap-1">
                  {action(`ดูรายละเอียด ${r.doc_no}`, <Eye />, () => onView(r))}
                  {action(`แก้ไข ${r.doc_no}`, <Pencil />, () => onEdit(r))}
                  {action(`พรีวิวพิมพ์ ${r.doc_no}`, <Printer />, () =>
                    onPrint(r),
                  )}
                  <ConfirmDialog
                    title={`ลบ ${r.doc_no}?`}
                    description="ลบเฉพาะข้อมูลตัวอย่าง หากกำลังแก้ไขเอกสารนี้ แบบฟอร์มจะถูกล้าง ไม่เปลี่ยนสต็อก"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`ลบ ${r.doc_no}`}
                        className="text-danger"
                        title={`ลบ ${r.doc_no}`}
                      >
                        <Trash2 />
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
