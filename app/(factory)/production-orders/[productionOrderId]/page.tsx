import { notFound } from "next/navigation";
import { productionOrders } from "@/src/lib/mock-data";
import { ProductionOrderDetail } from "@/src/features/production-orders/production-order-detail";
export function generateStaticParams() {
  return productionOrders.map((p) => ({ productionOrderId: p.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ productionOrderId: string }>;
}) {
  const { productionOrderId } = await params;
  if (!productionOrders.some((p) => p.id === productionOrderId)) notFound();
  return (
    <ProductionOrderDetail key={productionOrderId} id={productionOrderId} />
  );
}
