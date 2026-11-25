import { PRList } from "@/src/features/purchase-requisitions/pr-list";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
export default async function Page() {
  await requireAuthenticatedFactoryModule("pr");
  return <PRList />;
}
