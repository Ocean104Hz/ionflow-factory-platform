"use client";

import { Pie, PieChart } from "recharts";
import { SectionCard } from "@/src/components/factory/patterns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/src/components/ui/chart";
export function TopOrderedProducts({
  products,
}: {
  products: { sku: string; name: string; quantity: number }[];
}) {
  const topProducts = products.slice(0, 5);
  const total = topProducts.reduce((sum, product) => sum + product.quantity, 0);
  const config: ChartConfig = Object.fromEntries(
    topProducts.map((product, index) => [
      `product${index + 1}`,
      { label: product.name, color: `var(--chart-${index + 1})` },
    ]),
  );
  const data = topProducts.map((product, index) => ({
    ...product,
    product: `product${index + 1}`,
    fill: `var(--chart-${index + 1})`,
  }));
  return (
    <SectionCard
      className="xl:flex-1"
      title="สินค้าสั่งผลิตสูงสุด 5 อันดับ"
      subtitle="สัดส่วนจำนวนสินค้า Top 5 ในช่วงที่เลือก"
    >
      {total > 0 ? (
        <div className="relative mx-auto mb-4 w-full max-w-[240px]">
          <ChartContainer
            config={config}
            className="aspect-square w-full"
            aria-label={`สัดส่วนสินค้า Top 5 รวม ${total.toLocaleString("th-TH")} หน่วยสาธิต`}
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    nameKey="product"
                    formatter={(value, name) => (
                      <div className="grid max-w-64 gap-1 whitespace-normal">
                        <span className="font-medium">
                          {config[String(name)]?.label}
                        </span>
                        <span>
                          {Number(value).toLocaleString("th-TH")} หน่วยสาธิต ·{" "}
                          {((Number(value) / total) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="quantity"
                nameKey="product"
                innerRadius="64%"
                outerRadius="90%"
                startAngle={90}
                endAngle={-270}
                strokeWidth={3}
                stroke="var(--card)"
                isAnimationActive={false}
              />
            </PieChart>
          </ChartContainer>
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-3xl font-semibold tabular-nums">
              {total.toLocaleString("th-TH")}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              รวม Top 5
            </span>
          </div>
        </div>
      ) : (
        <p
          role="status"
          className="rounded-lg bg-muted p-6 text-center text-sm text-muted-foreground"
        >
          ไม่มีสินค้าสั่งผลิตในช่วงที่เลือก
        </p>
      )}
      <ol className="divide-y" aria-label="อันดับสินค้าและสัดส่วนของ Top 5">
        {data.map((product, index) => (
          <li
            key={product.sku}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-2"
          >
            <span
              className="mt-1 size-2.5 rounded-full"
              style={{ backgroundColor: product.fill }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium leading-relaxed">
                {index + 1}. {product.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {product.sku}
              </p>
            </div>
            <p className="text-right text-sm font-semibold tabular-nums">
              {product.quantity.toLocaleString("th-TH")}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {total > 0
                  ? ((product.quantity / total) * 100).toFixed(1)
                  : "0.0"}
                %
              </span>
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        หน่วยสาธิต · เปรียบเทียบเฉพาะ Top 5
        ไม่ใช่ยอดรวมของสินค้าทั้งหมดหรือการรวมหน่วยจริงต่างชนิด
      </p>
    </SectionCard>
  );
}
