import { PurchaseOrdersWorkspace } from "@/src/features/purchase-orders/po-workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
export default async function Page({ searchParams }: { searchParams: Promise<{ pr?: string }> }) {
  await requireAuthenticatedFactoryModule("purchase_orders");
  const params = await searchParams;
  return <PurchaseOrdersWorkspace key={params.pr ?? ""} initialPr={typeof params.pr === "string" ? params.pr : ""} />;
}
