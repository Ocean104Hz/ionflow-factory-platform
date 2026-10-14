import { notFound } from "next/navigation";
import { invoices } from "@/src/lib/mock-data";
import { InvoiceDetail } from "@/src/features/invoices/invoice-detail";
export function generateStaticParams() {
  return invoices.map((p) => ({ invoiceId: p.id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  if (!invoices.some((p) => p.id === invoiceId)) notFound();
  return <InvoiceDetail key={invoiceId} id={invoiceId} />;
}
