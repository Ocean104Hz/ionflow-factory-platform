"use client";
import { useState } from "react";
import { Pencil, CircleDollarSign } from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  FactoryDataTable,
  FilterBar,
  PageHeader,
  Pagination,
  StatusBadge,
  defaultFilters,
  type Column,
  type Filters,
} from "@/src/components/factory/patterns";
import { FormDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { money, date, dateTime } from "@/src/lib/formatters";
import { demoDate, type Product } from "@/src/lib/mock-data";
function PriceAction({ product }: { product: Product }) {
  const { updateProduct } = useDemo();
  return (
    <FormDialog
      title={product.price === null ? "ตั้งราคาสินค้า" : "เปลี่ยนราคาสินค้า"}
      description={`${product.sku} · ${product.name} · ราคา demo เท่านั้น`}
      trigger={
        <Button
          variant="outline"
          size="sm"
          disabled={product.status !== "ใช้งาน"}
        >
          <CircleDollarSign />
          {product.price === null ? "ตั้งราคา" : "เปลี่ยนราคา"}
        </Button>
      }
      fields={[
        {
          name: "price",
          label: `ราคาขายโรงงาน (บาท / ${product.unit})`,
          type: "number",
          value: String(product.price ?? ""),
          min: "0.01",
          step: "0.01",
          required: true,
        },
        {
          name: "effective",
          label: "วันที่เริ่มใช้",
          type: "date",
          value: product.effective,
          min: demoDate,
          required: true,
        },
        {
          name: "note",
          label: "หมายเหตุ",
          type: "textarea",
          value: product.priceNote,
        },
      ]}
      onSubmit={(v) =>
        updateProduct(product.id, {
          price: Number(v.price),
          effective: v.effective,
          priceNote: v.note,
          updated: new Date().toISOString(),
        })
      }
      submitLabel="บันทึกราคา"
    />
  );
}
export function Products() {
  const { products, updateProduct } = useDemo();
  const [tab, setTab] = useState("products");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const rows = products.filter(
    (r) =>
      `${r.sku} ${r.name}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()) &&
      (filters.status === "all" || filters.status === r.status) &&
      (filters.productType === "all" || filters.productType === r.type),
  );
  const productColumns: Column<Product>[] = [
    {
      key: "sku",
      label: "รหัสสินค้า",
      render: (r) => (
        <span className="font-semibold text-primary">{r.sku}</span>
      ),
    },
    {
      key: "name",
      label: "ชื่อสินค้า",
      render: (r) => (
        <p className="max-w-96 min-w-64 leading-relaxed">{r.name}</p>
      ),
    },
    { key: "type", label: "ประเภท", render: (r) => r.type },
    { key: "unit", label: "หน่วย", render: (r) => r.unit },
    {
      key: "status",
      label: "สถานะ",
      render: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "updated",
      label: "อัปเดตล่าสุด",
      render: (r) => dateTime(r.updated),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (r) => (
        <FormDialog
          title="รายละเอียดสินค้า"
          description={`${r.sku} · แก้ไขเฉพาะชื่อและรายละเอียด demo`}
          trigger={
            <Button variant="ghost" size="sm">
              <Pencil />
              รายละเอียด
            </Button>
          }
          fields={[
            {
              name: "name",
              label: "ชื่อสินค้า",
              value: r.name,
              required: true,
            },
            { name: "type", label: "ประเภท", value: r.type, required: true },
            { name: "unit", label: "หน่วย", value: r.unit, required: true },
          ]}
          onSubmit={(v) =>
            updateProduct(r.id, {
              name: v.name,
              type: v.type,
              unit: v.unit,
              updated: new Date().toISOString(),
            })
          }
        />
      ),
    },
  ];
  const priceColumns: Column<Product>[] = [
    {
      key: "name",
      label: "สินค้า",
      render: (r) => (
        <div className="max-w-96 min-w-64">
          <p className="text-xs text-muted-foreground">{r.sku}</p>
          <p className="mt-1 font-medium leading-relaxed">{r.name}</p>
        </div>
      ),
    },
    { key: "unit", label: "หน่วย", render: (r) => r.unit },
    {
      key: "price",
      label: "ราคาปัจจุบัน",
      render: (r) =>
        r.price === null ? (
          <span className="text-muted-foreground">ยังไม่มีราคา</span>
        ) : (
          `${money(r.price)} บาท`
        ),
      numeric: true,
    },
    {
      key: "effective",
      label: "วันที่เริ่มใช้",
      render: (r) => (r.price === null ? "—" : date(r.effective)),
    },
    {
      key: "status",
      label: "สถานะ",
      render: (r) => (
        <StatusBadge
          tone={
            r.price === null
              ? "warning"
              : r.status === "ใช้งาน"
                ? "success"
                : "neutral"
          }
        >
          {r.price === null ? "ยังไม่มีราคา" : r.status}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (r) => <PriceAction product={r} />,
    },
  ];
  return (
    <>
      <PageHeader
        title="สินค้าและราคากลาง"
        description="ข้อมูลสินค้ามาตรฐานและราคาขายของโรงงาน · เปลี่ยนราคาเฉพาะใน demo state"
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
      >
        <TabsList className="h-11">
          <TabsTrigger value="products">สินค้า</TabsTrigger>
          <TabsTrigger value="prices">ราคากลาง</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar
        product
        statuses={["ใช้งาน", "ไม่ใช้งาน"]}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
      />
      <FactoryDataTable
        columns={tab === "products" ? productColumns : priceColumns}
        rows={rows.slice(
          (page - 1) * filters.pageSize,
          page * filters.pageSize,
        )}
        rowKey={(r) => r.id}
        pagination={
          <Pagination
            page={page}
            pageSize={filters.pageSize}
            total={rows.length}
            onChange={setPage}
          />
        }
      />
      <p className="text-xs text-muted-foreground">
        การตั้งราคาสาธิตไม่เปลี่ยนยอดในเอกสารเดิม ·
        ข้อมูลจะคืนค่าเมื่อโหลดหน้าใหม่
      </p>
    </>
  );
}
