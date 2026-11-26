"use client";
import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState, type ReactNode } from "react";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import {
  FactoryDataTable,
  Pagination,
  SelectField,
  SectionCard,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
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
  readOnly = false,
  onView,
  onEdit,
  onPrint,
  onDelete,
}: {
  records: NCReport[];
  readOnly?: boolean;
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
    return <RowActionItem onClick={click}>{icon}{label}</RowActionItem>;
  }
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติใบ NC"
        subtitle={readOnly ? "ข้อมูลทดสอบบนเครื่อง · ดูและพิมพ์ตัวอย่างได้" : `พบ ${rows.length} จาก ${records.length} รายการตัวอย่าง`}
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
      <FactoryDataTable
        variant="history"
        emptyMessage={records.length ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีใบ NC"}
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
            textOverflow: "wrap",
            label: "ผู้พบ",
            render: (r) => (
              <span className="block max-w-40 whitespace-normal break-words">
                {r.discoverer}
              </span>
            ),
          },
          {
            key: "department",
            textOverflow: "wrap",
            label: "แผนก",
            render: (r) => (
              <span className="block max-w-32 whitespace-normal break-words">
                {r.department}
              </span>
            ),
          },
          {
            key: "product",
            textOverflow: "wrap",
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
            textOverflow: "wrap",
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
              <RowActionMenu readOnly={readOnly} containsDialog>
                {action(`ดูรายละเอียด ${r.doc_no}`, <Eye />, () => onView(r))}
                {!readOnly && action(`แก้ไข ${r.doc_no}`, <Pencil />, () => onEdit(r))}
                {action(`พรีวิวพิมพ์ ${r.doc_no}`, <Printer />, () =>
                  onPrint(r),
                )}
                {!readOnly && <ConfirmDialog
                  title={`ลบ ${r.doc_no}?`}
                  description="นำเอกสารออกจากรายการและเก็บประวัติการลบ"
                  trigger={
                    <RowActionItem aria-label={`ลบ ${r.doc_no}`} title={`ลบ ${r.doc_no}`} className="w-full justify-start text-destructive">
                      <Trash2 />
                      ลบ
                    </RowActionItem>
                  }
                  onConfirm={() => onDelete(r)}
                />}
              </RowActionMenu>
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
    </div>
  );
}
