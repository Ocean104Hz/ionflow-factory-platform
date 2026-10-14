import { SectionCard } from "@/src/components/factory/patterns";
import { Progress } from "@/src/components/ui/progress";
export function TopOrderedProducts({
  products,
}: {
  products: { sku: string; name: string; quantity: number }[];
}) {
  const max = Math.max(1, ...products.map((product) => product.quantity));
  return (
    <SectionCard
      title="สินค้าสั่งผลิตสูงสุด 5 อันดับ"
      subtitle="จำนวนสินค้าในช่วงที่เลือก · หน่วยสาธิต"
    >
      <ol className="divide-y">
        {products.map((product, index) => (
          <li
            key={product.sku}
            className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 sm:gap-5"
          >
            <span className="text-sm font-semibold tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{product.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {product.sku}
              </p>
              <Progress
                className="mt-3 h-1.5 bg-muted"
                aria-label={`อันดับจำนวน ${product.name}`}
                value={(product.quantity / max) * 100}
              />
            </div>
            <p className="text-right text-sm font-semibold tabular-nums">
              {product.quantity.toLocaleString("th-TH")}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                หน่วย
              </span>
            </p>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
