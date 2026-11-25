import { FoliarDocumentDetail } from "@/src/features/documents/foliar-document-detail";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  await requireAuthenticatedFactoryModule("invoices");
  return <FoliarDocumentDetail id={(await params).invoiceId} kind="INVOICE" />;
}
