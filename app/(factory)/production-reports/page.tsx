import { ProductionReportsWorkspace } from "@/src/features/production-flow/production-reports-workspace";

import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("production_reports");
  return <ProductionReportsWorkspace />;
}
