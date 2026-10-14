"use client";

import { FactoryDataTable, type Column } from "./patterns";
import { money, quantity } from "@/src/lib/formatters";
import type { OrderItem } from "@/src/lib/mock-data";
export const itemColumns: Column<OrderItem>[] = [
  { key: "index", label: "ลำดับ", render: (_, i) => i + 1 },
  { key: "sku", label: "SKU", render: (r) => r.sku },
  {
    key: "name",
    label: "สินค้า",
    render: (r) => (
      <p className="min-w-60 max-w-80 leading-relaxed">{r.name}</p>
    ),
  },
  { key: "type", label: "ประเภท", render: (r) => r.type },
  {
    key: "quantity",
    label: "จำนวน",
    render: (r) => quantity(r.quantity),
    numeric: true,
  },
  { key: "unit", label: "หน่วย", render: (r) => r.unit },
  {
    key: "price",
    label: "ราคา/หน่วย",
    render: (r) => money(r.price),
    numeric: true,
  },
  {
    key: "amount",
    label: "จำนวนเงิน",
    render: (r) => money(r.quantity * r.price),
    numeric: true,
  },
  {
    key: "note",
    label: "หมายเหตุ",
    render: (r) => <p className="min-w-40">{r.note}</p>,
  },
];
export function ItemTable({ items }: { items: OrderItem[] }) {
  return (
    <FactoryDataTable
      columns={itemColumns}
      rows={items}
      rowKey={(row) => row.sku}
      minWidth={1100}
    />
  );
}
