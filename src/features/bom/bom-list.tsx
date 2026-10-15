"use client";
import { useState } from "react";
import {
  Plus,
  Upload,
  SlidersHorizontal,
  Eye,
  Pencil,
  Package,
  Layers3,
  FileQuestion,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  PageHeader,
  SelectField,
  FactoryDataTable,
  Pagination,
  StatusBadge,
  EmptyState,
  type Column,
} from "@/src/components/factory/patterns";
import { dateTime } from "@/src/lib/formatters";
import { useBOM } from "./bom-provider";
import { productTypes, formulaStatuses, type Master } from "./bom-domain";
import { BOMMasterForm } from "./bom-master-form";
import { BOMFormulaForm } from "./bom-formula-form";
import {
  BOMMasterDetail,
  BOMFormulaDetail,
  formulaTone,
} from "./bom-formula-detail";
import { BOMImportPreview } from "./bom-import-preview";

type Panel =
  | { type: "master" | "masterEdit"; id?: string }
  | { type: "formulaNew"; masterId: string }
  | { type: "formula" | "formulaEdit"; id: string }
  | { type: "import" }
  | null;
const initialFilters = {
  search: "",
  type: "all",
  company: "all",
  process: "all",
  category: "all",
  brand: "all",
  department: "all",
  status: "all",
  unit: "all",
  availability: "all",
};
const metadata = {
  company: "บริษัท",
  process: "กระบวนการผลิต",
  category: "หมวดสินค้า",
  brand: "แบรนด์",
  department: "ฝ่าย / แผนก",
  unit: "หน่วย",
} as const;
export function BOMList() {
  const { state } = useBOM();
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [demoState, setDemoState] = useState("normal");
  const [message, setMessage] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const filtered = state.masters.filter((m) => {
    const formulas = state.formulas.filter((f) => f.masterId === m.id);
    return (
      `${m.code} ${m.name}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()) &&
      (filters.type === "all" || filters.type === m.type) &&
      Object.keys(metadata).every(
        (key) =>
          filters[key as keyof typeof metadata] === "all" ||
          filters[key as keyof typeof metadata] ===
            m[key as keyof typeof metadata],
      ) &&
      (filters.status === "all" ||
        formulas.some((f) => f.status === filters.status)) &&
      (filters.availability === "all" ||
        (filters.availability === "has"
          ? formulas.length > 0
          : filters.availability === "none"
            ? formulas.length === 0
            : !m.defaultFormulaId))
    );
  });
  const total = demoState === "empty" ? 0 : filtered.length;
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(total / Number(pageSize))),
  );
  const rows =
    demoState === "empty"
      ? []
      : filtered.slice(
          (current - 1) * Number(pageSize),
          current * Number(pageSize),
        );
  const masterFormulas = (m: Master) =>
    state.formulas.filter((f) => f.masterId === m.id);
  const columns: Column<Master>[] = [
    {
      key: "code",
      label: "รหัสสินค้า",
      render: (m) => (
        <Button
          variant="link"
          className="p-0"
          onClick={() => setPanel({ type: "master", id: m.id })}
        >
          {m.code}
        </Button>
      ),
    },
    {
      key: "name",
      label: "ชื่อสินค้า / วัตถุดิบ",
      render: (m) => (
        <span className="block min-w-48 max-w-72 font-medium">{m.name}</span>
      ),
    },
    {
      key: "type",
      label: "ประเภท",
      render: (m) => (
        <StatusBadge tone="neutral">{productTypes[m.type]}</StatusBadge>
      ),
    },
    { key: "usage", label: "การใช้งาน", render: (m) => m.usageType || "—" },
    {
      key: "default",
      label: "สูตรเริ่มต้น",
      render: (m) => {
        const f = state.formulas.find((r) => r.id === m.defaultFormulaId);
        return f ? (
          <Button
            variant="link"
            className="p-0"
            onClick={() => setPanel({ type: "formula", id: f.id })}
          >
            {f.code} · {f.version}
          </Button>
        ) : (
          <span className="text-muted-foreground">ยังไม่กำหนด</span>
        );
      },
    },
    {
      key: "count",
      label: "จำนวนสูตร",
      numeric: true,
      render: (m) => masterFormulas(m).length,
    },
    {
      key: "status",
      label: "สถานะสูตรที่มี",
      render: (m) => {
        const statuses = [...new Set(masterFormulas(m).map((f) => f.status))];
        return statuses.length ? (
          <div className="flex flex-wrap gap-1">
            {statuses.map((s) => (
              <StatusBadge key={s} tone={formulaTone(s)}>
                {formulaStatuses[s]}
              </StatusBadge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่มีสูตร</span>
        );
      },
    },
    {
      key: "updated",
      label: "อัปเดตล่าสุด",
      render: (m) => (
        <div className="whitespace-nowrap">
          {dateTime(m.updatedAt)}
          <p className="text-xs text-muted-foreground">{m.updatedBy}</p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (m) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-label={`ดู ${m.code}`}
            onClick={() => setPanel({ type: "master", id: m.id })}
          >
            <Eye />
            ดู
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label={`แก้ไข ${m.code}`}
            onClick={() => setPanel({ type: "masterEdit", id: m.id })}
          >
            <Pencil />
            แก้ไข
          </Button>
        </div>
      ),
    },
  ];
  function renderPanel() {
    if (!panel) return null;
    if (panel.type === "import")
      return <BOMImportPreview onClose={() => setPanel(null)} />;
    if (panel.type === "masterEdit" && !panel.id)
      return (
        <BOMMasterForm
          onSaved={(id) => {
            setPanel({ type: "master", id });
            setMessage("สร้างข้อมูลหลักแล้ว");
          }}
          onClose={() => setPanel(null)}
        />
      );
    if (panel.type === "master" || panel.type === "masterEdit") {
      const master = state.masters.find((m) => m.id === panel.id);
      if (!master) return <EmptyState title="ไม่พบข้อมูลหลักนี้แล้ว" />;
      return panel.type === "masterEdit" ? (
        <BOMMasterForm
          initial={master}
          onSaved={(id) => {
            setPanel({ type: "master", id });
            setMessage("แก้ไขข้อมูลหลักแล้ว");
          }}
          onClose={() => setPanel({ type: "master", id: master.id })}
        />
      ) : (
        <BOMMasterDetail
          master={master}
          onEdit={() => setPanel({ type: "masterEdit", id: master.id })}
          onNewFormula={() =>
            setPanel({ type: "formulaNew", masterId: master.id })
          }
          onViewFormula={(id) => setPanel({ type: "formula", id })}
          onDeleted={() => {
            setPanel(null);
            setMessage("ลบข้อมูลหลักจาก demo แล้ว");
          }}
        />
      );
    }
    if (panel.type === "formulaNew") {
      const master = state.masters.find((m) => m.id === panel.masterId);
      return master ? (
        <BOMFormulaForm
          master={master}
          onSaved={(id) => {
            setPanel({ type: "formula", id });
            setMessage("สร้างเวอร์ชันสูตรใหม่แล้ว");
          }}
          onClose={() => setPanel({ type: "master", id: master.id })}
        />
      ) : (
        <EmptyState title="ไม่พบสินค้าต้นทาง" />
      );
    }
    const formula = state.formulas.find((f) => f.id === panel.id);
    const master = state.masters.find((m) => m.id === formula?.masterId);
    if (!formula || !master) return <EmptyState title="ไม่พบสูตรนี้แล้ว" />;
    return panel.type === "formulaEdit" ? (
      <BOMFormulaForm
        master={master}
        initial={formula}
        onSaved={(id) => {
          setPanel({ type: "formula", id });
          setMessage("แก้ไขสูตรแล้ว");
        }}
        onClose={() => setPanel({ type: "formula", id: formula.id })}
      />
    ) : (
      <BOMFormulaDetail
        master={master}
        formula={formula}
        onEdit={() => setPanel({ type: "formulaEdit", id: formula.id })}
        onBack={() => setPanel({ type: "master", id: master.id })}
      />
    );
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title="สูตรผสมวัตถุดิบ (BOM)"
        description="จัดการสินค้า วัตถุดิบ และสูตรการผลิตแต่ละเวอร์ชัน"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setPanel({ type: "import" })}
            >
              <Upload />
              Import Excel (UI Demo)
            </Button>
            <Button onClick={() => setPanel({ type: "masterEdit" })}>
              <Plus />
              เพิ่มสินค้า / วัตถุดิบ
            </Button>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "ข้อมูลหลักทั้งหมด",
            count: state.masters.length,
            icon: Package,
          },
          { label: "สูตรทั้งหมด", count: state.formulas.length, icon: Layers3 },
          {
            label: "รายการที่ยังไม่มีสูตร",
            count: state.masters.filter((m) => !masterFormulas(m).length)
              .length,
            icon: FileQuestion,
          },
        ].map(({ label, count, icon: Icon }) => (
          <Card key={label} className="py-4">
            <CardContent className="flex items-center justify-between gap-4 px-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {count}
                </p>
              </div>
              <Icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
      <form
        className="factory-filter grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_190px_auto_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
          setPage(1);
          setAdvanced(false);
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="bom-search">ค้นหาสินค้า / วัตถุดิบ</Label>
          <Input
            id="bom-search"
            placeholder="รหัสหรือชื่อสินค้า"
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          />
        </div>
        <SelectField
          label="ประเภทสินค้า"
          value={draft.type}
          onChange={(type) => setDraft({ ...draft, type })}
          options={[
            { value: "all", label: "ทุกประเภท" },
            ...Object.entries(productTypes).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <Popover open={advanced} onOpenChange={setAdvanced}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline">
              <SlidersHorizontal />
              ตัวกรองเพิ่มเติม
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-[75dvh] w-[min(560px,calc(100vw-32px))] overflow-y-auto"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(metadata) as (keyof typeof metadata)[]).map(
                (key) => (
                  <SelectField
                    key={key}
                    label={metadata[key]}
                    value={draft[key]}
                    onChange={(v) => setDraft({ ...draft, [key]: v })}
                    options={[
                      { value: "all", label: "ทั้งหมด" },
                      ...[
                        ...new Set(
                          state.masters.map((m) => m[key]).filter(Boolean),
                        ),
                      ].map((v) => ({ value: v, label: v })),
                    ]}
                  />
                ),
              )}
              <SelectField
                label="สถานะสูตรที่มี"
                value={draft.status}
                onChange={(status) => setDraft({ ...draft, status })}
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  ...Object.entries(formulaStatuses).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
              <SelectField
                label="การมีสูตร"
                value={draft.availability}
                onChange={(availability) =>
                  setDraft({ ...draft, availability })
                }
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  { value: "has", label: "มีสูตร" },
                  { value: "none", label: "ไม่มีสูตร" },
                  { value: "noDefault", label: "ยังไม่มีสูตรเริ่มต้น" },
                ]}
              />
            </div>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => {
                setFilters(draft);
                setPage(1);
                setAdvanced(false);
              }}
            >
              ใช้ตัวกรอง
            </Button>
          </PopoverContent>
        </Popover>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFilters(initialFilters);
              setDraft(initialFilters);
              setPage(1);
            }}
          >
            ล้างตัวกรอง
          </Button>
          <Button type="submit">ค้นหา</Button>
        </div>
      </form>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          พบ {total} จาก {state.masters.length} รายการ · ข้อมูลจำลอง
          รีโหลดหน้าแล้วรีเซ็ต{message ? ` · ${message}` : ""}
        </p>
        <div className="w-44">
          <SelectField
            label="ตัวอย่างสถานะ UI"
            value={demoState}
            onChange={setDemoState}
            options={[
              { value: "normal", label: "ข้อมูลปกติ" },
              { value: "loading", label: "กำลังโหลด (สาธิต)" },
              { value: "empty", label: "ไม่มีข้อมูล (สาธิต)" },
            ]}
          />
        </div>
      </div>
      <FactoryDataTable
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        minWidth={1500}
        state={demoState === "loading" ? "loading" : "normal"}
        pagination={
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 [&>div:last-child]:border-0 [&>div:last-child]:p-0">
            <div className="w-36">
              <SelectField
                label="จำนวนต่อหน้า"
                value={pageSize}
                onChange={(value) => {
                  setPageSize(value);
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
              total={total}
              pageSize={Number(pageSize)}
              onChange={setPage}
            />
          </div>
        }
      />
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="shrink-0 border-b px-5 py-5 pr-16">
            <DialogTitle>
              {panel?.type === "import"
                ? "นำเข้า Excel — UI Demo"
                : panel?.type === "masterEdit"
                  ? "สร้าง / แก้ไขข้อมูลหลัก BOM"
                  : panel?.type === "master"
                    ? "รายละเอียดสินค้าและสูตร"
                    : panel?.type === "formulaNew"
                      ? "สร้างสูตรเวอร์ชันใหม่"
                      : panel?.type === "formulaEdit"
                        ? "แก้ไขสูตร"
                        : "รายละเอียดสูตร BOM"}
            </DialogTitle>
            <DialogDescription>
              ข้อมูลสาธิตในโมดูล BOM เท่านั้น · ไม่เชื่อมระบบผลิต สต็อก
              หรือระบบอนุมัติจริง
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 overflow-y-auto overscroll-contain p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            tabIndex={0}
            role="region"
            aria-label="รายละเอียด BOM เลื่อนเพื่อดูข้อมูลเพิ่มเติม"
          >
            <div key={panel ? JSON.stringify(panel) : "closed"}>
              {renderPanel()}
            </div>
          </div>
          <div className="flex shrink-0 justify-end border-t bg-background px-5 py-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ปิดหน้าต่าง
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
