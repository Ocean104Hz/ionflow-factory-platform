import { ProductionOrderDetail } from "@/src/features/production-orders/production-order-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ productionOrderId: string }>;
}) {
  const { productionOrderId } = await params;
  return (
    <ProductionOrderDetail key={productionOrderId} id={productionOrderId} />
  );
}
