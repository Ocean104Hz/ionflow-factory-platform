import { BOMList } from "@/src/features/bom/bom-list";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page() {
  await requireAuthenticatedFactoryModule("bom");
  return <BOMList />;
}
