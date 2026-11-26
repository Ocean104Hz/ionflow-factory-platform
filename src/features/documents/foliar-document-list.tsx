import { PageHeader } from "@/src/components/factory/patterns";
import { listHubDocuments, listHubPrices, type DocumentKind } from "@/src/server/sales-hub/documents";
import { FoliarDocumentsTable, FoliarPricesTable } from "./foliar-document-tables";

export async function FoliarDocumentList({ kind }: { kind: DocumentKind }) {
  const rows = (await listHubDocuments(kind)).map(({ order_id, order_number, company, customer, document_id, number, status, sync_state, payload }) => ({
    order_id, order_number, company, customer, document_id, number, status, sync_state,
    grandTotal: String(payload?.grandTotal ?? ""),
  }));
  const title = kind === "INVOICE" ? "ใบแจ้งหนี้" : "ใบส่งสินค้า";
  return <>
    <PageHeader title={title} description="เอกสาร Foliar Fertilizer (W1-FF) จากคำสั่งผลิต Sales Hub" />
    <FoliarDocumentsTable rows={rows} kind={kind} title={title} />
  </>;
}

export async function FoliarPriceRegister({ canEdit }: { canEdit: boolean }) {
  const rows = await listHubPrices();
  return <>
    <PageHeader title="สินค้าและราคากลาง" description="ราคาออกใบแจ้งหนี้ของ W1-FF แยกตามบริษัท สินค้า และหน่วยจาก Sales Hub" />
    <FoliarPricesTable rows={rows} canEdit={canEdit} />
  </>;
}
