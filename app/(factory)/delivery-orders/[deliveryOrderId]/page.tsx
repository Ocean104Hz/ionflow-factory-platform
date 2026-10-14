import { notFound } from "next/navigation";
import { deliveryOrders } from "@/src/lib/mock-data";
import { DeliveryOrderDetail } from "@/src/features/delivery-orders/delivery-order-detail";
export function generateStaticParams() {
  return deliveryOrders.map((p) => ({ deliveryOrderId: p.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ deliveryOrderId: string }>;
}) {
  const { deliveryOrderId } = await params;
  if (!deliveryOrders.some((p) => p.id === deliveryOrderId)) notFound();
  return <DeliveryOrderDetail key={deliveryOrderId} id={deliveryOrderId} />;
}
