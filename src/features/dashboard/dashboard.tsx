"use client";
import Link from "next/link";
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
  type Column,
} from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { demoDate, type ProductionOrder } from "@/src/lib/mock-data";
import { date, dateTime } from "@/src/lib/formatters";
export function Dashboard() {
  const { orders, deliveries, invoices } = useDemo();
  const active = orders.filter((r) => r.document !== "ยกเลิกแล้ว");
  const counts = [
    active.filter((r) => r.date === demoDate).length,
    active.filter((r) => r.material === "รอตรวจสอบวัตถุดิบ").length,
    active.filter((r) => r.production === "กำลังผลิต").length,
    active.filter((r) => r.production === "พร้อมรับสินค้า").length,
  ];
  const cards = [
    { title: "คำสั่งการผลิตวันนี้", icon: ClipboardList },
    { title: "รอตรวจสอบวัตถุดิบ", icon: Boxes },
    { title: "กำลังผลิต", icon: Factory },
    { title: "พร้อมรับสินค้า", icon: Truck },
  ];
  const statuses = [
    "รอตรวจสอบวัตถุดิบ",
    "รอการอนุมัติจากโรงงาน",
    "กำลังผลิต",
    "ผลิตเสร็จแล้ว",
    "พร้อมรับสินค้า",
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
          <span className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4" />
            {date(demoDate)} · วันที่สาธิต
          </span>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <div key={c.title} className="rounded-xl border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-muted-foreground">
                {c.title}
              </p>
              <span className="rounded-lg bg-accent p-2 text-primary">
                <c.icon className="size-4" />
              </span>
            </div>
            <p className="mt-5 text-4xl font-semibold tabular-nums tracking-tight">
              {counts[i]}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                รายการ
              </span>
            </p>
            <div className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
              อ้างอิงข้อมูลสาธิตใน workspace
            </div>
          </div>
        ))}
      </div>
      <SectionCard
        title="ภาพรวมสถานะการผลิต"
        subtitle="จำนวนคำสั่งตามแต่ละสถานะ · ไม่นับเอกสารยกเลิก"
      >
        <div className="grid gap-5 md:grid-cols-5">
          {statuses.map((status) => {
            const count = active.filter((r) =>
              [r.material, r.approval, r.production].some(
                (value) => value === status,
              ),
            ).length;
            return (
              <div key={status}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {status}
                  </p>
                  <strong className="text-lg tabular-nums">{count}</strong>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${(count / Math.max(active.length, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
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
      <SectionCard title="รายการที่ต้องดำเนินการ">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "วัตถุดิบรอตรวจสอบ",
              count: counts[1],
              href: "/production-orders",
            },
            {
              label: "คำสั่งรออนุมัติ",
              count: active.filter(
                (r) => r.approval === "รอการอนุมัติจากโรงงาน",
              ).length,
              href: "/production-orders",
            },
            {
              label: "เอกสารรอดำเนินการ",
              count: [...deliveries, ...invoices].filter(
                (r) => r.status === "ฉบับร่าง",
              ).length,
              href: "/invoices",
            },
          ].map((row) => (
            <Link
              key={row.label}
              href={row.href}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent"
            >
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.count} รายการ
                </p>
              </div>
              <ArrowUpRight className="size-4 text-primary" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
