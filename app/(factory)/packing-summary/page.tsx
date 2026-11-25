import { PackingSummaryWorkspace } from
  "@/src/features/packing-summary/packing-summary-workspace";

import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("packing_summary");
  return <PackingSummaryWorkspace />;
}
