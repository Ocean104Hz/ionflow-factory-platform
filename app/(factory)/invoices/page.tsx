import { FoliarDocumentList } from "@/src/features/documents/foliar-document-list";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
export default async function Page() {
  await requireAuthenticatedFactoryModule("invoices");
  return <FoliarDocumentList kind="INVOICE" />;
}
