import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionCard, StatusBadge } from "@/src/components/factory/patterns";
import type { ProductionOrder } from "@/src/lib/mock-data";
import { Progress } from "@/src/components/ui/progress";
import type { CSSProperties } from "react";
export function ProductionStatusOverview({
  orders,
  draftCount,
  anchor,
}: {
  orders: ProductionOrder[];
  draftCount: number;
  anchor: string;
}) {
  const statuses = [
    { label: "รอตรวจสอบวัตถุดิบ", color: "bg-warning" },
    { label: "รอการอนุมัติจากโรงงาน", color: "bg-info" },
    { label: "กำลังผลิต", color: "bg-primary" },
    { label: "ผลิตเสร็จแล้ว", color: "bg-success" },
    { label: "พร้อมรับสินค้า", color: "bg-success" },
  ];
  const count = (status: string) =>
    orders.filter((order) =>
      [order.material, order.approval, order.production].includes(status),
    ).length;
  const attention = [
    {
      label: "วัตถุดิบรอตรวจสอบ",
      count: count("รอตรวจสอบวัตถุดิบ"),
      tone: "warning" as const,
    },
    {
      label: "คำสั่งรออนุมัติ",
      count: count("รอการอนุมัติจากโรงงาน"),
      tone: "info" as const,
    },
    {
      label: "รายการผลิตล่าช้า",
      count: orders.filter(
        (order) =>
          order.requestedDate < anchor &&
          ["ยังไม่เริ่มผลิต", "กำลังผลิต"].includes(order.production),
      ).length,
      tone: "destructive" as const,
    },
    {
      label: "พร้อมรับสินค้า",
      count: count("พร้อมรับสินค้า"),
      tone: "success" as const,
    },
  ];
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
      <SectionCard
        title="สถานะการผลิต"
        subtitle="งานปัจจุบันใน demo workspace · ไม่รวมเอกสารยกเลิก"
      >
        <div className="space-y-4">
          {statuses.map((status) => (
            <div key={status.label}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm">{status.label}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {count(status.label)} รายการ
                </span>
              </div>
              <Progress
                className="bg-muted [&_[data-slot=progress-indicator]]:bg-[var(--progress-color)]"
                style={
                  {
                    "--progress-color": `var(--${status.color.slice(3)})`,
                  } as CSSProperties
                }
                aria-label={status.label}
                value={(count(status.label) / Math.max(orders.length, 1)) * 100}
              />
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard
        title="รายการที่ต้องดำเนินการ"
        subtitle="รายการปัจจุบันใน demo workspace"
      >
        <div className="space-y-0">
          {attention.map((row) => (
            <Link
              key={row.label}
              href="/production-orders"
              className="flex items-center justify-between gap-3 border-b py-3 last:border-0 hover:text-primary"
            >
              <span className="text-sm">{row.label}</span>
              <StatusBadge tone={row.tone}>{`${row.count} รายการ`}</StatusBadge>
            </Link>
          ))}
          <Link
            href="/invoices"
            className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground"
          >
            เอกสารรอดำเนินการ {draftCount} รายการ
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
