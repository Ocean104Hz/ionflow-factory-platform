import { FoliarDocumentDetail } from "@/src/features/documents/foliar-document-detail";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";

export default async function Page({ params }: { params: Promise<{ deliveryOrderId: string }> }) {
  await requireAuthenticatedFactoryModule("delivery_orders");
  return <FoliarDocumentDetail id={(await params).deliveryOrderId} kind="DELIVERY_ORDER" />;
}
