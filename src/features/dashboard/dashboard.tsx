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
import { SectionCards } from "./section-cards";
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
        description={`ภาพรวมการดำเนินงานของโรงงาน · ${branding.factoryName}`}
        actions={
          <>
            <span className="sr-only">
              <CalendarDays aria-hidden="true" className="size-4" />
              {branding.factoryName} · {date(range.from)} – {date(range.to)}
            </span>
            <PeriodFilter
              period={period}
              range={range}
              anchor={demoDate}
              onChange={(value, selectedRange) => {
                setPeriod(value);
                setRange(selectedRange);
              }}
            />
            <RefreshButton onClick={() => setRefresh((value) => value + 1)} />
          </>
        }
      />
      <SectionCards
        items={cards.map((card, index) => ({
          ...card,
          count: counts[index],
          context:
            index === 0 ? "ในช่วงเวลาที่เลือก" : "งานปัจจุบันใน demo workspace",
          badge: ["ช่วงที่เลือก", "รอตรวจสอบ", "กำลังดำเนินการ", "พร้อมรับ"][
            index
          ],
        }))}
      />
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="min-w-0 xl:flex xl:flex-col">
          <FactoryDailyOverviewChart
            key={`${range.from}:${range.to}:${period}:${refresh}`}
            rows={analytics.rows}
            hasData={analytics.hasData}
          />
        </div>
        <div className="min-w-0 xl:flex xl:flex-col">
          <TopOrderedProducts products={analytics.topProducts} />
        </div>
      </div>
      <ProductionStatusOverview
        orders={active}
        anchor={demoDate}
        draftCount={
          [...deliveries, ...invoices].filter(
            (row) => row.status === "ฉบับร่าง",
          ).length
        }
      />
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
