"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, ArrowUpRight } from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  PageHeader,
  FilterBar,
  FactoryDataTable,
  Pagination,
  RefreshButton,
  StatusBadge,
  defaultFilters,
  type Filters,
  type Column,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { total, type SalesDocument } from "@/src/lib/mock-data";
import { date, dateTime, money } from "@/src/lib/formatters";
export function DocumentList({ kind }: { kind: "delivery" | "invoice" }) {
  const { orders, deliveries, invoices } = useDemo();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const isInvoice = kind === "invoice";
  const title = isInvoice ? "ใบแจ้งหนี้" : "ใบส่งสินค้า";
  const route = isInvoice ? "/invoices" : "/delivery-orders";
  const source = isInvoice ? invoices : deliveries;
  const order = (r: SalesDocument) => orders.find((p) => p.id === r.orderId)!;
  const rows = source.filter(
    (r) =>
      `${r.number} ${order(r).number} ${order(r).customer}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()) &&
      (filters.status === "all" || r.status === filters.status) &&
      (!filters.from || r.date >= filters.from) &&
      (!filters.to || r.date <= filters.to),
  );
  const columns: Column<SalesDocument>[] = [
    {
      key: "index",
      label: "#",
      render: (_, i) => (page - 1) * filters.pageSize + i + 1,
    },
    {
      key: "number",
      label: isInvoice ? "เลขที่ใบแจ้งหนี้" : "เลขที่ใบส่งสินค้า",
      render: (r) => (
        <Link
          className="font-semibold whitespace-nowrap text-primary hover:underline"
          href={`${route}/${r.id}`}
        >
          {r.number}
        </Link>
      ),
    },
    {
      key: "order",
      label: "เลขที่คำสั่งการผลิต",
      render: (r) => (
        <Link
          href={`/production-orders/${r.orderId}`}
          className="whitespace-nowrap hover:underline"
        >
          {order(r).number}
        </Link>
      ),
    },
    {
      key: "customer",
      label: "ลูกค้า",
      render: (r) => (
        <p className="w-64 leading-relaxed">{order(r).customer}</p>
      ),
    },
    {
      key: "date",
      label: "วันที่",
      render: (r) => <span className="whitespace-nowrap">{date(r.date)}</span>,
    },
    {
      key: "items",
      label: "จำนวนรายการ",
      render: (r) => order(r).items.length,
      numeric: true,
    },
    ...(isInvoice
      ? [
          {
            key: "subtotal",
            label: "ยอดก่อนภาษี",
            render: (r: SalesDocument) =>
              money(total(order(r).items) - r.discount),
            numeric: true,
          },
          {
            key: "tax",
            label: "ภาษี",
            render: (r: SalesDocument) =>
              money((total(order(r).items) - r.discount) * 0.07),
            numeric: true,
          },
        ]
      : []),
    {
      key: "amount",
      label: isInvoice ? "ยอดสุทธิ" : "ยอดรวม",
      render: (r) =>
        money((total(order(r).items) - r.discount) * (isInvoice ? 1.07 : 1)),
      numeric: true,
    },
    {
      key: "status",
      label: "สถานะ",
      render: (r) => <StatusBadge>{r.status}</StatusBadge>,
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
        <Button size="sm" variant="ghost" asChild>
          <Link href={`${route}/${r.id}`} aria-label={`ดู ${r.number}`}>
            ดูรายละเอียด
            <ArrowUpRight />
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title={title}
        description={`${title}ของโรงงาน · เอกสารและยอดเงินทั้งหมดเป็นข้อมูลสมมติ`}
        actions={
          <>
            {isInvoice && (
              <ConfirmDialog
                title="Export Excel · UI demo"
                description="ยังไม่สร้างไฟล์ Excel ใน phase นี้"
                trigger={
                  <Button variant="outline">
                    <Download />
                    Export Excel
                  </Button>
                }
                onConfirm={() =>
                  setNotice(
                    "ตัวอย่าง Export Excel · ไม่มีการสร้างหรือดาวน์โหลดไฟล์",
                  )
                }
              />
            )}
            <RefreshButton />
          </>
        }
      />
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-info/20 bg-info/5 p-3 text-info"
        >
          {notice}
        </p>
      )}
      <FilterBar
        statuses={
          isInvoice
            ? ["ฉบับร่าง", "ออกเอกสารแล้ว", "ยกเลิกแล้ว"]
            : ["ฉบับร่าง", "พร้อมส่ง", "ส่งข้อมูลแล้ว", "ยกเลิกแล้ว"]
        }
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <FactoryDataTable
        columns={columns}
        rows={rows.slice(
          (page - 1) * filters.pageSize,
          page * filters.pageSize,
        )}
        rowKey={(r) => r.id}
        minWidth={isInvoice ? 1700 : 1450}
        pagination={
          <Pagination
            page={page}
            pageSize={filters.pageSize}
            total={rows.length}
            onChange={setPage}
          />
        }
      />
    </>
  );
}
