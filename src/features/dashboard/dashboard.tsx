"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ClipboardList,
  Boxes,
  Factory,
  Truck,
  CalendarDays,
} from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  FactoryDataTable,
  PageHeader,
  SectionCard,
  StatusBadge,
  RefreshButton,
  type Column,
} from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { useBranding } from "@/src/components/factory/branding-provider";
import {
  dashboardAnalytics,
  periodRange,
  type DashboardPeriod,
  type DateRange,
} from "@/src/lib/mock-data/dashboard";
import { PeriodFilter } from "./period-filter";
import { FactoryDailyOverviewChart } from "./factory-daily-overview-chart";
import { ProductionStatusOverview } from "./production-status-overview";
import { TopOrderedProducts } from "./top-ordered-products";
import { demoDate, type ProductionOrder } from "@/src/lib/mock-data";
import { date, dateTime } from "@/src/lib/formatters";
export function Dashboard() {
  const { orders, deliveries, invoices } = useDemo();
  const { branding } = useBranding();
  const [period, setPeriod] = useState<DashboardPeriod>("week");
  const [range, setRange] = useState<DateRange>(() =>
    periodRange("week", demoDate),
  );
  const [refresh, setRefresh] = useState(0);
  const analytics = useMemo(
    () => dashboardAnalytics(range, demoDate, period === "year"),
    [range, period],
  );
  const active = orders.filter((r) => r.document !== "ยกเลิกแล้ว");
  const counts = [
    analytics.orderCount,
    active.filter((r) => r.material === "รอตรวจสอบวัตถุดิบ").length,
    active.filter((r) => r.production === "กำลังผลิต").length,
    active.filter((r) => r.production === "พร้อมรับสินค้า").length,
  ];
  const cards = [
    { title: "คำสั่งการผลิต", icon: ClipboardList },
    { title: "รอตรวจสอบวัตถุดิบ", icon: Boxes },
    { title: "กำลังผลิต", icon: Factory },
    { title: "พร้อมรับสินค้า", icon: Truck },
  ];
  const columns: Column<ProductionOrder>[] = [
    {
      key: "number",
      label: "เลขที่คำสั่งการผลิต",
      render: (r) => (
        <Link
          className="font-semibold text-primary hover:underline"
          href={`/production-orders/${r.id}`}
        >
          {r.number}
        </Link>
      ),
    },
    {
      key: "customer",
      label: "ลูกค้า",
      render: (r) => (
        <p className="max-w-72 min-w-52 leading-relaxed">{r.customer}</p>
      ),
    },
    { key: "date", label: "วันที่", render: (r) => date(r.date) },
    {
      key: "items",
      label: "จำนวนรายการ",
      render: (r) => r.items.length,
      numeric: true,
    },
    {
      key: "status",
      label: "สถานะ",
      render: (r) => (
        <StatusBadge>
          {r.production === "ยังไม่เริ่มผลิต" ? r.approval : r.production}
        </StatusBadge>
      ),
    },
    {
      key: "updated",
      label: "อัปเดตล่าสุด",
      render: (r) => dateTime(r.updated),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (r) => (
        <Button variant="ghost" size="icon" asChild>
          <Link
            href={`/production-orders/${r.id}`}
            aria-label={`ดู ${r.number}`}
          >
            <ArrowUpRight />
          </Link>
        </Button>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        title="แดชบอร์ด"
        description="ภาพรวมการดำเนินงานของโรงงาน"
        actions={
          <>
            <span className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-xs text-muted-foreground">
              <CalendarDays aria-hidden="true" className="size-4" />
              {branding.factoryName} · {date(range.from)} – {date(range.to)}
            </span>
            <RefreshButton onClick={() => setRefresh((value) => value + 1)} />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <Card
            key={c.title}
            className="factory-metric rounded-xl border bg-surface py-0 shadow-none"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {c.title}
                </p>
                <span className="rounded-lg bg-accent p-2 text-primary">
                  <c.icon aria-hidden="true" className="size-4" />
                </span>
              </div>
              <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">
                {counts[i]}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  รายการ
                </span>
              </p>
              <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
                {i === 0
                  ? "ยอด analytics สาธิตในช่วงที่เลือก"
                  : "งานปัจจุบันใน demo workspace"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PeriodFilter
        period={period}
        range={range}
        anchor={demoDate}
        onChange={(value, selectedRange) => {
          setPeriod(value);
          setRange(selectedRange);
        }}
      />
      <FactoryDailyOverviewChart
        key={`${range.from}:${range.to}:${period}:${refresh}`}
        rows={analytics.rows}
        hasData={analytics.hasData}
      />
      <ProductionStatusOverview
        orders={active}
        anchor={demoDate}
        draftCount={
          [...deliveries, ...invoices].filter(
            (row) => row.status === "ฉบับร่าง",
          ).length
        }
      />
      <TopOrderedProducts products={analytics.topProducts} />
      <SectionCard
        title="คำสั่งการผลิตล่าสุด"
        subtitle="เอกสารที่อัปเดตล่าสุด"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/production-orders">
              ดูทั้งหมด
              <ArrowUpRight />
            </Link>
          </Button>
        }
      >
        <FactoryDataTable
          columns={columns}
          rows={[...orders]
            .sort((a, b) => b.updated.localeCompare(a.updated))
            .slice(0, 5)}
          rowKey={(r) => r.id}
        />
      </SectionCard>
    </>
  );
}
