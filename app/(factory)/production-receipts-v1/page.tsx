import { ProductionReceiptV1Workspace } from "@/src/features/production-receipts-v1/production-receipt-v1-workspace";

import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("production_receipts_v1");
  return <ProductionReceiptV1Workspace />;
}
