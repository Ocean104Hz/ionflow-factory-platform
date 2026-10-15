"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/src/components/ui/collapsible";
import {
  Table,
  TableCaption,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/src/components/ui/table";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/src/components/ui/chart";
import { SectionCard } from "@/src/components/factory/patterns";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/src/components/ui/select";
import type { AnalyticsRow } from "@/src/lib/mock-data/dashboard";
const config = {
  productionOrderCount: { label: "คำสั่งการผลิต", color: "var(--primary)" },
  totalQuantity: { label: "จำนวนสินค้ารวม", color: "var(--info)" },
  completedCount: { label: "ผลิตเสร็จแล้ว", color: "var(--success)" },
} satisfies ChartConfig;
const number = (value: number) => value.toLocaleString("th-TH");
const label = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: value.length === 10 ? "numeric" : undefined,
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`),
  );
export function FactoryDailyOverviewChart({
  rows,
  hasData,
}: {
  rows: AnalyticsRow[];
  hasData: boolean;
}) {
  const initial = Math.max(
    0,
    rows.findLastIndex((row) => row.productionOrderCount > 0),
  );
  const [selected, setSelected] = useState(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = rows[hovered ?? selected];
  return (
    <SectionCard
      className="xl:flex-1"
      contentClassName="xl:flex xl:flex-1 xl:flex-col"
      title="ภาพรวมการผลิต"
      subtitle="แนวโน้มคำสั่งการผลิตและสถานะงานตามช่วงเวลา"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="analytics-day">
            เลือก{rows[0]?.date.length === 7 ? "เดือน" : "วัน"}เพื่อดูค่าจริง
          </Label>
          <Select
            value={String(selected)}
            onValueChange={(value) => {
              setSelected(Number(value));
              setHovered(null);
            }}
          >
            <SelectTrigger id="analytics-day" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row, index) => (
                <SelectItem key={row.date} value={String(index)}>
                  {label(row.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <dl
          className="grid flex-1 gap-4 sm:grid-cols-3 sm:pl-4"
          aria-label={`ข้อมูล ${label(active.date)}`}
        >
          {Object.entries(config).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{value.label}</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {number(active[key as keyof typeof config])}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {key === "totalQuantity" ? "หน่วย" : "รายการ"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {!hasData && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground"
        >
          ไม่มีข้อมูลสาธิตในช่วงนี้ เลือกช่วงเวลาภายในปี 2569 ก่อนหรือถึงวันที่
          14 ต.ค.
        </p>
      )}
      <p className="mb-2 text-sm font-medium">ค่าจริง: {label(active.date)}</p>
      <p className="mb-3 text-xs text-muted-foreground">
        แกนซ้าย: คำสั่ง / งาน (รายการ) · แกนขวา: จำนวนสินค้า (หน่วย) ·
        แตะกราฟเพื่อเลือก หรือใช้ตัวเลือกวันด้านบน
      </p>
      <div
        className="relative min-h-64 overflow-x-auto focus-visible:outline-2 focus-visible:outline-primary xl:flex-1"
        tabIndex={0}
        role="region"
        aria-label="กราฟเปรียบเทียบ เลื่อนแนวนอนเพื่อดูทุกวันที่"
      >
        <ChartContainer
          config={config}
          className="h-64 w-full aspect-auto xl:absolute xl:inset-0 xl:h-full [&_.recharts-surface]:focus-visible:outline-2 [&_.recharts-surface]:focus-visible:outline-primary"
          style={{ minWidth: Math.max(360, rows.length * 64 + 80) }}
        >
          <BarChart
            accessibilityLayer
            data={rows}
            margin={{ top: 16, right: 12, left: 4, bottom: 8 }}
            onMouseMove={(state) => {
              const index = Number(state.activeTooltipIndex);
              if (
                state.activeTooltipIndex != null &&
                Number.isInteger(index) &&
                rows[index]
              )
                setHovered(index);
            }}
            onMouseLeave={() => setHovered(null)}
            onClick={(state) => {
              const index = Number(state.activeTooltipIndex);
              if (
                state.activeTooltipIndex != null &&
                Number.isInteger(index) &&
                rows[index]
              )
                setSelected(index);
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                label(String(value)).replace(/\s2569$/, "")
              }
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={10}
            />
            <YAxis
              yAxisId="orders"
              allowDecimals={false}
              width={36}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="quantity"
              orientation="right"
              allowDecimals={false}
              width={42}
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => label(String(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              yAxisId="orders"
              dataKey="productionOrderCount"
              fill="var(--color-productionOrderCount)"
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="quantity"
              dataKey="totalQuantity"
              fill="var(--color-totalQuantity)"
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
            <Bar
              yAxisId="orders"
              dataKey="completedCount"
              fill="var(--color-completedCount)"
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </div>
      <Collapsible className="mt-4 text-sm">
        <CollapsibleTrigger asChild>
          <Button variant="link" className="px-0">
            ดูข้อมูลกราฟเป็นตาราง
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 overflow-x-auto">
            <Table className="w-full text-left text-sm">
              <TableCaption className="sr-only">
                ค่าจริงของทุกช่วงในกราฟ
              </TableCaption>
              <TableHeader>
                <TableRow>
                  {[
                    "วันที่ / เดือน",
                    ...Object.values(config).map((value) => value.label),
                  ].map((title) => (
                    <TableHead
                      key={title}
                      className="whitespace-nowrap border-b p-2"
                    >
                      {title}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.date}>
                    <TableHead
                      scope="row"
                      className="whitespace-nowrap p-2 font-normal"
                    >
                      {label(row.date)}
                    </TableHead>
                    {[
                      row.productionOrderCount,
                      row.totalQuantity,
                      row.completedCount,
                    ].map((value, index) => (
                      <TableCell key={index} className="p-2 tabular-nums">
                        {number(value)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SectionCard>
  );
}
