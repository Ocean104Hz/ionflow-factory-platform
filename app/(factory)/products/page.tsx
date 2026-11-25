import { FoliarPriceRegister } from "@/src/features/documents/foliar-document-list";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
export default async function Page() {
  const user = await requireAuthenticatedFactoryModule("products");
  return <FoliarPriceRegister canEdit={user.roles.includes("factory_admin")} />;
}
