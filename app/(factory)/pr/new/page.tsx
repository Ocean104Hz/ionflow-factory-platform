import { PREditor } from "@/src/features/purchase-requisitions/pr-editor";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
export default async function Page() {
  await requireAuthenticatedFactoryModule("pr");
  return <PREditor />;
}
