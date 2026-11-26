"use client";

import Link from "next/link";
import { useState } from "react";
import { FactoryDataTable, Pagination, StatusBadge, type Column } from "@/src/components/factory/patterns";
import { useLocalTablePreview } from "@/src/components/factory/use-local-table-preview";
import type { listHubDocuments, listHubPrices, DocumentKind } from "@/src/server/sales-hub/documents";
import { CreateFoliarDocument, EditFoliarPrice, UpdateFoliarDelivery } from "./foliar-actions";

type DocumentRow = Omit<Awaited<ReturnType<typeof listHubDocuments>>[number], "created_at" | "payload"> & {
  grandTotal: string;
};
type PriceRow = Awaited<ReturnType<typeof listHubPrices>>[number];

const syncLabels: Record<string, string> = {
  PENDING: "รอซิงค์",
  SENDING: "กำลังซิงค์",
  DELIVERED: "ซิงค์แล้ว",
  FAILED: "ซิงค์ไม่สำเร็จ",
};

const exampleProducts: PriceRow[] = Array.from({ length: 11 }, (_, index) => ({
  company_id: "local-test-company",
  hub_product_id: `local-product-${index + 1}`,
  company_code: "TEST",
  name: `ปุ๋ยอินทรีย์ตัวอย่างสำหรับทดสอบชื่อสินค้าแบบยาว ${index + 1}`,
  sku: `TEST-PRODUCT-${index + 1}`,
  unit_name: "กระสอบ",
  unit_price: index % 3 ? ((index + 1) * 125.50).toFixed(2) : null,
}));

function FoliarTable<T>({ rows, columns, rowKey, emptyMessage }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}) {
  const [requestedPage, setPage] = useState(1);
  const pageSize = 10;
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(rows.length / pageSize)));
  return (
    <FactoryDataTable
      variant="history"
      columns={columns}
      rows={rows.slice((page - 1) * pageSize, page * pageSize)}
      rowKey={rowKey}
      emptyMessage={emptyMessage}
      pagination={<Pagination page={page} pageSize={pageSize} total={rows.length} onChange={setPage} />}
    />
  );
}

export function FoliarDocumentsTable({ rows, kind, title }: { rows: DocumentRow[]; kind: DocumentKind; title: string }) {
  const localPreview = useLocalTablePreview() && rows.length === 0;
  const invoice = kind === "INVOICE";
  const route = invoice ? "invoices" : "delivery-orders";
  const columns: Column<DocumentRow>[] = [
    {
      key: "number", label: title, width: 190,
      render: (row) => localPreview ? row.number : row.document_id
        ? <Link className="font-medium text-primary underline" title={row.number ?? undefined} href={`/${route}/${row.document_id}`}>{row.number}</Link>
        : "ยังไม่สร้าง",
    },
    {
      key: "order", label: "คำสั่งผลิต", width: 180,
      render: (row) => localPreview ? row.order_number
        : <Link className="text-primary underline" title={row.order_number} href={`/production-orders/${row.order_id}`}>{row.order_number}</Link>,
    },
    {
      key: "customer", label: "บริษัท / ลูกค้า", width: 240, textOverflow: "wrap",
      render: (row) => <>{row.company}<br />{row.customer}</>,
    },
    {
      key: "sync", label: "ซิงค์ Sales Hub", width: 160, minWidth: 130,
      render: (row) => row.sync_state ? <StatusBadge>{syncLabels[row.sync_state]}</StatusBadge> : "—",
    },
    {
      key: "actions", label: "จัดการ", width: invoice ? 200 : 290, minWidth: invoice ? 165 : 260,
      render: (row) => localPreview ? (invoice ? `ยอดสุทธิ ${row.grandTotal} บาท` : "เอกสารทดสอบ")
        : row.document_id
        ? invoice
          ? <span>ยอดสุทธิ {row.grandTotal} บาท</span>
          : <UpdateFoliarDelivery id={row.document_id} status={row.status ?? ""} />
        : <CreateFoliarDocument orderId={row.order_id} kind={kind} />,
    },
  ];
  const displayRows = localPreview ? exampleProducts.map((product, index): DocumentRow => ({
    order_id: product.hub_product_id,
    order_number: `TEST-PDO-${index + 1}`,
    company: "บริษัททดสอบ",
    customer: "ลูกค้าตัวอย่างสำหรับทดสอบตาราง",
    document_id: null,
    number: `TEST-${invoice ? "INV" : "DO"}-${index + 1}`,
    status: null,
    sync_state: ["PENDING", "DELIVERED", "FAILED"][index % 3],
    grandTotal: ((index + 1) * 1250.5).toFixed(2),
  })) : rows;
  return <>
    {localPreview && <p className="text-sm text-muted-foreground">ข้อมูลทดสอบบนเครื่อง · ดูรายการได้อย่างเดียว</p>}
    <FoliarTable columns={columns} rows={displayRows} rowKey={(row) => row.order_id}
      emptyMessage={`ยังไม่มีคำสั่งผลิตที่พร้อมสร้าง${title}`} />
  </>;
}

export function FoliarPricesTable({ rows, canEdit }: { rows: PriceRow[]; canEdit: boolean }) {
  const localPreview = useLocalTablePreview() && rows.length === 0;
  const editable = canEdit && !localPreview;
  const columns: Column<PriceRow>[] = [
    { key: "company", label: "บริษัท", width: 120, render: (row) => row.company_code },
    { key: "sku", label: "รหัสสินค้า", width: 180, render: (row) => <span title={row.sku}>{row.sku}</span> },
    { key: "name", label: "ชื่อสินค้า", width: 320, textOverflow: "wrap", render: (row) => row.name },
    { key: "unit", label: "หน่วย", width: 120, render: (row) => row.unit_name },
    {
      key: "price", label: "ราคาต่อหน่วย (บาท)", width: editable ? 280 : 175,
      minWidth: editable ? 180 : 100,
      textOverflow: editable ? "wrap" : "ellipsis",
      numeric: !editable,
      render: (row) => editable
        ? <EditFoliarPrice key={row.unit_price} companyId={row.company_id} productId={row.hub_product_id}
          unit={row.unit_name} price={row.unit_price} label={`ราคาต่อ ${row.unit_name} ของ ${row.sku} บริษัท ${row.company_code}`} />
        : row.unit_price ?? "ยังไม่ตั้งราคา",
    },
  ];
  return <>
    {localPreview && <p className="text-sm text-muted-foreground">ข้อมูลทดสอบบนเครื่อง · ดูราคาได้อย่างเดียว</p>}
    <FoliarTable columns={columns} rows={localPreview ? exampleProducts : rows}
      rowKey={(row) => `${row.company_id}:${row.hub_product_id}`}
      emptyMessage="ยังไม่มีสินค้าที่ซิงค์จาก Sales Hub" />
  </>;
}
