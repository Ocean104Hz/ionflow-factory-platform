"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useProductionOrders } from "./production-orders-provider";
import { ProductionOrderEditor } from "./production-order-editor";
import {
  FactoryDataTable,
  FilterBar,
  PageHeader,
  Pagination,
  RefreshButton,
  StatusBadge,
  defaultFilters,
  type Column,
  type Filters,
} from "@/src/components/factory/patterns";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Button } from "@/src/components/ui/button";
import { date, dateTime, money, quantity } from "@/src/lib/formatters";
import { total, type ProductionOrder, type Source } from "@/src/lib/mock-data";

export const salesHubColumns: Column<ProductionOrder>[] = [
  { key: "index", label: "#", render: (_, i) => i + 1 },
  {
    key: "number",
    label: "เลขที่คำสั่งการผลิต",
    render: (r) => (
      <Link
        href={`/production-orders/${r.id}`}
        className="font-semibold whitespace-nowrap text-primary hover:underline"
      >
        {r.number}
      </Link>
    ),
  },
  {
    key: "company",
    label: "บริษัทต้นทาง",
    render: (r) => <p className="w-52 leading-relaxed">{r.company}</p>,
  },
  {
    key: "date",
    label: "วันที่",
    render: (r) => <span className="whitespace-nowrap">{date(r.date)}</span>,
  },
  {
    key: "items",
    label: "รายการ",
    render: (r) => r.items.length,
    numeric: true,
  },
  {
    key: "quantity",
    label: "จำนวนรวม",
    render: (r) => quantity(r.items.reduce((n, item) => n + item.quantity, 0)),
    numeric: true,
  },
  {
    key: "amount",
    label: "ราคารวม",
    render: (r) => money(total(r.items)),
    numeric: true,
  },
  { key: "revision", label: "Rev.", render: (r) => r.revision, numeric: true },
  {
    key: "document",
    label: "เอกสาร",
    render: (r) => <StatusBadge>{r.document}</StatusBadge>,
  },
  {
    key: "material",
    label: "วัตถุดิบ",
    render: (r) => <StatusBadge>{r.material}</StatusBadge>,
  },
  {
    key: "approval",
    label: "การอนุมัติ",
    render: (r) => <StatusBadge>{r.approval}</StatusBadge>,
  },
  {
    key: "production",
    label: "การผลิต",
    render: (r) => <StatusBadge>{r.production}</StatusBadge>,
  },
  {
    key: "updated",
    label: "อัปเดตล่าสุด",
    render: (r) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {dateTime(r.updated)}
      </span>
    ),
  },
  {
    key: "actions",
    label: "จัดการ",
    render: (r) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/production-orders/${r.id}`} aria-label={`ดู ${r.number}`}>
          ดูรายละเอียด
          <ArrowUpRight />
        </Link>
      </Button>
    ),
  },
];
export const datalinkColumns: Column<ProductionOrder>[] = [
  salesHubColumns[0],
  { ...salesHubColumns[1], label: "เลขที่ DO" },
  { key: "so", label: "อ้างอิง SO", render: (r) => r.salesOrder },
  ...salesHubColumns.slice(3, 9),
  ...salesHubColumns.slice(12),
];
export function ProductionOrderList() {
  const { orders, loading, error, refresh, busy } = useProductionOrders();
  const [creating, setCreating] = useState(false);
  const [source, setSource] = useState<Source>("Sales Hub");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const filtered = orders.filter(
    (r) =>
      r.source === source &&
      `${r.number} ${r.customer} ${r.company} ${r.salesOrder}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()) &&
      (filters.status === "all" || r.document === filters.status) &&
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to) &&
      (filters.cancellation === "all" ||
        (filters.cancellation === "none"
          ? !r.cancellation
          : r.cancellation?.status === "รอพิจารณา")),
  );
  const rows = filtered;
  const count = rows.length;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(count / filters.pageSize)));
  const columns = (
    source === "Sales Hub" ? salesHubColumns : datalinkColumns
  ).map((c) =>
    c.key === "index"
      ? {
          ...c,
          render: (_: ProductionOrder, i: number) =>
            (currentPage - 1) * filters.pageSize + i + 1,
        }
      : c,
  );
  return (
    <>
      <PageHeader
        title="คำสั่งการผลิต"
        description="รายการคำสั่งการผลิตจาก Sales Hub และ Datalink"
        actions={<><Button disabled={busy} onClick={() => setCreating(true)}>เพิ่มคำสั่ง Local</Button><RefreshButton onClick={refresh} /></>}
      />
      {creating && <ProductionOrderEditor onClose={() => setCreating(false)} />}
      {error && <p role="alert" className="text-danger">{error}</p>}
      <FilterBar
        production
        statuses={["รับข้อมูลแล้ว", "ยกเลิกแล้ว"]}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <Tabs
          value={source}
          onValueChange={(s) => {
            setSource(s as Source);
            setPage(1);
          }}
        >
          <TabsList className="h-11">
            <TabsTrigger value="Datalink">Datalink</TabsTrigger>
            <TabsTrigger value="Sales Hub">Sales Hub</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <FactoryDataTable
        columns={columns}
        rows={rows.slice(
          (currentPage - 1) * filters.pageSize,
          currentPage * filters.pageSize,
        )}
        rowKey={(r) => r.id}
        state={
          loading
            ? "loading"
            : error
              ? "error"
              : "normal"
        }
        retry={refresh}
        minWidth={source === "Sales Hub" ? 1900 : 1250}
        pagination={
          <Pagination
            page={currentPage}
            pageSize={filters.pageSize}
            total={count}
            onChange={setPage}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        PostgreSQL Local · ไม่มี Mock fallback · จำนวนต่างหน่วยไม่ใช่ยอดวัตถุดิบรวม
      </p>
    </>
  );
}
