"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  FactoryDataTable,
  Pagination,
  SelectField,
  StatusBadge,
  SectionCard,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { qualityProfiles } from "./production-quality-profiles";
import {
  emptyFilters,
  filterHistory,
  formatDate,
  paginate,
  statusLabel,
  type Inspection,
} from "./production-quality-domain";
import { useProductionQuality } from "./production-quality-provider";
import { QualityPrintPreview } from "./production-quality-print-preview";
export function QualityHistory({
  onEdit,
  onView,
}: {
  onEdit: (row: Inspection) => void;
  onView: (row: Inspection) => void;
}) {
  const { records, remove } = useProductionQuality();
  const [filters, setFilters] = useState({ ...emptyFilters });
  const [page, setPage] = useState(1),
    [size, setSize] = useState(10),
    [error, setError] = useState("");
  const rows = filterHistory(records, filters),
    paged = paginate(rows, page, size);
  const patch = (value: Partial<typeof filters>) => {
    setFilters({ ...filters, ...value });
    setPage(1);
  };
  const formulas = Array.from(
    new Set(
      records.flatMap((r) =>
        r.formulas.map((f) => f.formulaName).filter(Boolean),
      ),
    ),
  );
  return (
    <div className="min-w-0 space-y-4">
      <SectionCard
        title="ประวัติการตรวจสอบ"
        subtitle={`พบ ${rows.length} จาก ${records.length} เอกสาร · ข้อมูลใน demo session`}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="quality-search">
              ค้นหาเอกสาร / สูตร / Lot / สถานที่
            </Label>
            <Input
              id="quality-search"
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
            />
          </div>
          <SelectField
            label="โรงงาน"
            value={filters.profile}
            onChange={(profile) => patch({ profile, line: "all" })}
            options={[
              { value: "all", label: "ทุกโรงงาน" },
              ...Object.entries(qualityProfiles).map(([value, p]) => ({
                value,
                label: p.label,
              })),
            ]}
          />
          <SelectField
            label="สายการผลิต"
            value={filters.line}
            onChange={(line) => patch({ line })}
            options={[
              { value: "all", label: "ทุกสาย" },
              ...Object.entries(qualityProfiles)
                .filter(
                  ([key]) =>
                    filters.profile === "all" || key === filters.profile,
                )
                .flatMap(([, p]) =>
                  p.lines.map((value) => ({ value, label: value })),
                ),
            ]}
          />
          <SelectField
            label="สถานะเอกสาร"
            value={filters.status}
            onChange={(status) => patch({ status })}
            options={[
              { value: "all", label: "ทุกสถานะ" },
              { value: "DRAFT", label: "แบบร่าง" },
              { value: "RECORDED", label: "บันทึกผลตรวจแล้ว" },
            ]}
          />
          <div className="space-y-2">
            <Label htmlFor="quality-from">วันที่เริ่มต้น</Label>
            <Input
              id="quality-from"
              type="date"
              value={filters.from}
              onChange={(e) => patch({ from: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quality-to">วันที่สิ้นสุด</Label>
            <Input
              id="quality-to"
              type="date"
              value={filters.to}
              onChange={(e) => patch({ to: e.target.value })}
            />
          </div>
          <SelectField
            label="สูตร"
            value={filters.formula}
            onChange={(formula) => patch({ formula })}
            options={[
              { value: "all", label: "ทุกสูตร" },
              ...formulas.map((value) => ({ value, label: value })),
            ]}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ ...emptyFilters });
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
      <FactoryDataTable
        rows={paged.rows}
        rowKey={(r) => r.id}
        minWidth={1200}
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
            label: "วันที่ตรวจ",
            render: (r) => formatDate(r.inspectionDate),
          },
          {
            key: "factory",
            label: "โรงงาน / สาย",
            render: (r) => (
              <div>
                {qualityProfiles[r.profileId].label}
                <p className="text-xs text-muted-foreground">
                  {r.productionLine || "—"}
                </p>
              </div>
            ),
          },
          {
            key: "formula",
            label: "สูตร / Lot",
            render: (r) => (
              <div className="max-w-64 space-y-1 whitespace-normal">
                {r.formulas.map((f) => (
                  <p key={f.id}>
                    {f.formulaName || "—"}
                    <span className="block text-xs text-muted-foreground">
                      {f.lotCode || "—"}
                    </span>
                  </p>
                ))}
              </div>
            ),
          },
          {
            key: "inspector",
            label: "ผู้ตรวจ",
            render: (r) => r.signers[0]?.name || "—",
          },
          {
            key: "status",
            label: "สถานะการบันทึก",
            render: (r) => (
              <StatusBadge
                tone={r.recordStatus === "DRAFT" ? "neutral" : "info"}
              >
                {statusLabel(r)}
              </StatusBadge>
            ),
          },
          {
            key: "actions",
            label: "จัดการ",
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(r)}>
                  แก้ไข
                </Button>
                <QualityPrintPreview row={r} />
                <ConfirmDialog
                  title="ลบเอกสารตรวจสอบนี้?"
                  description="ลบเฉพาะเอกสารสาธิตนี้ ไม่เปลี่ยนสต็อก"
                  trigger={
                    <Button variant="ghost" size="sm" className="text-danger">
                      ลบ
                    </Button>
                  }
                  onConfirm={() => {
                    try {
                      remove(r.id);
                      setError("");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
                    }
                  }}
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
    </div>
  );
}
