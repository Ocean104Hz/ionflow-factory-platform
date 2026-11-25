import Link from "next/link";
import { PageHeader, StatusBadge } from "@/src/components/factory/patterns";
import { listHubDocuments, listHubPrices, type DocumentKind } from "@/src/server/sales-hub/documents";
import { CreateFoliarDocument, EditFoliarPrice, UpdateFoliarDelivery } from "./foliar-actions";

const syncLabels: Record<string, string> = {
  PENDING: "รอซิงค์", SENDING: "กำลังซิงค์", DELIVERED: "ซิงค์แล้ว", FAILED: "ซิงค์ไม่สำเร็จ",
};

export async function FoliarDocumentList({ kind }: { kind: DocumentKind }) {
  const rows = await listHubDocuments(kind);
  const title = kind === "INVOICE" ? "ใบแจ้งหนี้" : "ใบส่งสินค้า";
  return <>
    <PageHeader title={title} description="เอกสาร Foliar Fertilizer (W1-FF) จากคำสั่งผลิต Sales Hub" />
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted"><tr>{[title, "คำสั่งผลิต", "บริษัท / ลูกค้า", "ซิงค์ Sales Hub", "การดำเนินการ"].map(label => <th scope="col" className="px-4 py-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map(row => <tr className="border-t" key={row.order_id}>
            <td className="px-4 py-3 font-medium">{row.document_id ? <Link className="underline" href={`/${kind === "INVOICE" ? "invoices" : "delivery-orders"}/${row.document_id}`}>{row.number}</Link> : "ยังไม่สร้าง"}</td>
            <td className="px-4 py-3"><Link className="underline" href={`/production-orders/${row.order_id}`}>{row.order_number}</Link></td>
            <td className="px-4 py-3">{row.company}<br />{row.customer}</td>
            <td className="px-4 py-3">{row.sync_state ? <StatusBadge>{syncLabels[row.sync_state]}</StatusBadge> : "—"}</td>
            <td className="px-4 py-3">{row.document_id
              ? kind === "INVOICE" ? <span>ยอดสุทธิ {String(row.payload?.grandTotal ?? "")} บาท</span> : <UpdateFoliarDelivery id={row.document_id} status={row.status ?? ""} />
              : <CreateFoliarDocument orderId={row.order_id} kind={kind} />}</td>
          </tr>)}
          {!rows.length && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>ยังไม่มีคำสั่งผลิตที่พร้อมสร้าง{title}</td></tr>}
        </tbody>
      </table>
    </div>
  </>;
}

export async function FoliarPriceRegister({ canEdit }: { canEdit: boolean }) {
  const rows = await listHubPrices();
  return <>
    <PageHeader title="สินค้าและราคากลาง" description="ราคาออกใบแจ้งหนี้ของ W1-FF แยกตามบริษัท สินค้า และหน่วยจาก Sales Hub" />
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted"><tr>{["บริษัท", "รหัสสินค้า", "ชื่อสินค้า", "หน่วย", "ราคาต่อหน่วย (บาท)"].map(label => <th scope="col" className="px-4 py-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr className="border-t" key={`${row.company_id}:${row.hub_product_id}`}>
          <td className="px-4 py-3">{row.company_code}</td>
          <td className="px-4 py-3">{row.sku}</td>
          <td className="px-4 py-3">{row.name}</td>
          <td className="px-4 py-3">{row.unit_name}</td>
          <td className="px-4 py-3">{canEdit ? <EditFoliarPrice key={row.unit_price} companyId={row.company_id} productId={row.hub_product_id} unit={row.unit_name} price={row.unit_price} label={`ราคาต่อ ${row.unit_name} ของ ${row.sku} บริษัท ${row.company_code}`} /> : row.unit_price ?? "ยังไม่ตั้งราคา"}</td>
        </tr>)}
        {!rows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีสินค้าที่ซิงค์จาก Sales Hub</td></tr>}</tbody>
      </table>
    </div>
  </>;
}
