"use client";
import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  FactoryDataTable,
  Pagination,
  SelectField,
  SectionCard,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  emptyHistoryFilters,
  filterReports,
  paginateReports,
  recordLabel,
  thaiDate,
  type PackagingReport,
} from "./packaging-domain";
import { packagingProfiles } from "./packaging-profiles";
import { usePackaging } from "./packaging-provider";
import { PackagingPrintPreview } from "./packaging-print-preview";
export function PackagingHistory({
  onEdit,
  onView,
}: {
  onEdit: (r: PackagingReport) => void;
  onView: (r: PackagingReport) => void;
}) {
  const { records, remove, busy } = usePackaging();
  const [filters, setFilters] = useState({ ...emptyHistoryFilters }),
    [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [error, setError] = useState("");
  const rows = filterReports(records, filters),
    paged = paginateReports(rows, page, size);
  const patch = (v: Partial<typeof filters>) => {
    setFilters({ ...filters, ...v });
    setPage(1);
  };
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติรายงาน"
        subtitle={`พบ ${rows.length} จาก ${records.length} รายงาน`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pack-search">
              ค้นหาเอกสาร / สูตร / Lot / โรงงาน
            </Label>
            <Input
              id="pack-search"
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
            />
          </div>
          <SelectField
            label="โรงงานในประวัติ"
            value={filters.profile}
            onChange={(profile) => patch({ profile })}
            options={[
              { value: "all", label: "ทุกโรงงาน" },
              ...Object.entries(packagingProfiles).map(([value, p]) => ({
                value,
                label: p.label,
              })),
            ]}
          />
          <SelectField
            label="สถานะรายงาน"
            value={filters.status}
            onChange={(status) => patch({ status })}
            options={[
              { value: "all", label: "ทุกสถานะ" },
              { value: "DRAFT", label: "แบบร่าง" },
              { value: "RECORDED", label: "บันทึกรายงานแล้ว" },
            ]}
          />
          {(
            [
              ["from", "วันที่เริ่มต้น"],
              ["to", "วันที่สิ้นสุด"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`pack-${key}`}>{label}</Label>
              <Input
                id={`pack-${key}`}
                type="date"
                value={filters[key]}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ ...emptyHistoryFilters });
                setPage(1);
              }}
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </div>
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
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <FactoryDataTable variant="history"
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
                className="h-auto p-0"
                onClick={() => onView(r)}
              >
                {r.documentNumber || "แบบร่างไม่มีเลข"}
              </Button>
            ),
          },
          {
            key: "date",
            label: "วันที่",
            render: (r) => thaiDate(r.documentDate),
          },
          {
            key: "profile",
            label: "โรงงาน",
            render: (r) => packagingProfiles[r.profileId].label,
          },
          { key: "sets", label: "SET", render: (r) => String(r.sets.length) },
          {
            key: "contexts",
            label: "สูตร / Lot",
            render: (r) => (
              <div className="max-w-64 space-y-1 whitespace-normal">
                {r.sets.flatMap((s) =>
                  s.contexts.map((c) => (
                    <p key={c.id}>
                      SET {s.setNo} · {c.fertilizerName || "—"}
                      <span className="block text-xs text-muted-foreground">
                        {c.lotCode || "—"}
                      </span>
                    </p>
                  )),
                )}
              </div>
            ),
          },
          {
            key: "status",
            label: "สถานะการบันทึก",
            render: (r) => (
              <StatusBadge tone={r.status === "DRAFT" ? "neutral" : "info"}>
                {recordLabel(r)}
              </StatusBadge>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (r) => (
              <RowActionMenu containsDialog>
                <RowActionItem disabled={busy} onClick={() => onEdit(r)}>
                  แก้ไข
                </RowActionItem>
                <PackagingPrintPreview report={r} trigger={<RowActionItem>พรีวิวพิมพ์</RowActionItem>} />
                <ConfirmDialog
                  live
                  title="ลบรายงานนี้?"
                  description="รายงานนี้จะถูกนำออกจากประวัติ"
                  trigger={
                    <RowActionItem disabled={busy} className="w-full justify-start text-destructive">
                      ลบ
                    </RowActionItem>
                  }
                  onConfirm={async () => {
                    try {
                      await remove(r);
                      setError("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "ลบไม่ได้");
                    }
                  }}
                />
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
