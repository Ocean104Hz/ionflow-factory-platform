import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/src/components/factory/patterns";
import { readHubDocument, type DocumentKind } from "@/src/server/sales-hub/documents";
import { UpdateFoliarDelivery } from "./foliar-actions";

export async function FoliarDocumentDetail({ id, kind }: { id: string; kind: DocumentKind }) {
  const row = await readHubDocument(kind, id);
  if (!row) notFound();
  const invoice = kind === "INVOICE";
  const title = invoice ? "ใบแจ้งหนี้" : "ใบส่งสินค้า";
  const items = invoice ? row.payload.items as Array<{
    id: string; productCodeSnapshot: string; productNameSnapshot: string; quantity: string;
    quantityUom: string; unitPriceSnapshot: string; netAmount: string;
  }> : row.items.map((item, index) => ({
    id: String(index), productCodeSnapshot: item.sku, productNameSnapshot: item.name, quantity: String(item.quantity),
    quantityUom: item.unit, unitPriceSnapshot: "", netAmount: "",
  }));
  return <>
    <PageHeader title={row.number} description={`W1-FF · ${row.company} · ${row.customer}`}
      parent={{ title, href: invoice ? "/invoices" : "/delivery-orders" }}
      actions={!invoice && <UpdateFoliarDelivery id={id} status={row.status} />} />
    <Link className="underline" href={`/production-orders/${row.order_id}`}>คำสั่งผลิต {row.order_number}</Link>
    <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted"><tr>
          {["รหัสสินค้า", "สินค้า", "จำนวน", "หน่วย", ...(invoice ? ["ราคาต่อหน่วย", "ยอดสุทธิ"] : [])]
            .map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
        </tr></thead>
        <tbody>{items.map(item => <tr key={item.id} className="border-t">
          <td className="px-4 py-3">{item.productCodeSnapshot || "—"}</td>
          <td className="px-4 py-3">{item.productNameSnapshot}</td>
          <td className="px-4 py-3 tabular-nums">{item.quantity}</td>
          <td className="px-4 py-3">{item.quantityUom || "—"}</td>
          {invoice && <><td className="px-4 py-3 tabular-nums">{item.unitPriceSnapshot}</td><td className="px-4 py-3 tabular-nums">{item.netAmount}</td></>}
        </tr>)}</tbody>
        {invoice && <tfoot className="border-t bg-muted"><tr>
          <th scope="row" colSpan={5} className="px-4 py-3 text-right">ยอดสุทธิ (บาท)</th>
          <td className="px-4 py-3 font-semibold tabular-nums">{String(row.payload.grandTotal)}</td>
        </tr></tfoot>}
      </table>
    </div>
  </>;
}
