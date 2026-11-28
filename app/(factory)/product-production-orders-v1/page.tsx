
import { Suspense } from "react";
import { ProductProductionOrdersV1Workspace } from "@/src/features/product-production-orders-v1/workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

async function ProductionOrdersContent() {
  await requireAuthenticatedFactoryModule(
    "product_production_orders_v1",
  );

  return <ProductProductionOrdersV1Workspace />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProductionOrdersContent />
    </Suspense>
  );
}
