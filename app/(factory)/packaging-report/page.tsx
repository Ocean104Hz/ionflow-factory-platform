import { PackagingWorkspace } from "@/src/features/packaging-reports/packaging-workspace";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("packaging_report");
  return <PackagingWorkspace />;
}
