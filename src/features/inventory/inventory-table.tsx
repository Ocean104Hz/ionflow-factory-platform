"use client";

import { Eye } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  FactoryDataTable,
  Pagination,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { inventoryQuantity as quantity } from "./inventory-quantity";
import {
  classifyInventory,
  inventoryTypeLabel,
  type InventoryRow,
} from "./inventory-domain";

export function InventoryTable({
  rows,
  page,
  pageSize,
  total,
  onPageChange,
  onView,
}: {
  rows: InventoryRow[];
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onView: (id: string) => void;
}) {
  const columns: Column<InventoryRow>[] = [
    {
      key: "code",
      label: "รหัสสินค้า",
      render: ({ item }) => (
        <Button
          variant="link"
          className="h-auto p-0 font-medium"
          aria-label={`ดู ${item.code}`}
          onClick={() => onView(item.id)}
        >
          {item.code}
        </Button>
      ),
    },
    {
      key: "name",
      label: "ชื่อสินค้า",
      render: ({ item }) => (
        <div className="min-w-48 max-w-64">
          <p className="font-medium">{item.name}</p>
          {!item.active && (
            <span className="text-xs text-muted-foreground">
              ปิดใช้งานในทะเบียน
            </span>
          )}
        </div>
      ),
    },
    {
      key: "type",
      label: "ประเภท",
      render: ({ item }) => (
        <StatusBadge
          tone={
            classifyInventory(item.itemType) === "UNMAPPED"
              ? "warning"
              : "neutral"
          }
        >
          {inventoryTypeLabel(item.itemType)}
        </StatusBadge>
      ),
    },
    {
      key: "group",
      label: "กลุ่ม / หมวด",
      render: ({ item }) => (
        <div className="min-w-32">
          <p>{item.itemGroup}</p>
          <p className="text-xs text-muted-foreground">{item.category}</p>
        </div>
      ),
    },
    {
      key: "quantity",
      label: "คงเหลือรวม",
      numeric: true,
      render: (row) => (
        <span
          className={
            row.lowStock ? "font-semibold text-warning" : "font-semibold"
          }
        >
          {quantity(row.totalQty)}
        </span>
      ),
    },
    { key: "unit", label: "หน่วย", render: ({ item }) => item.baseUnit },
    {
      key: "warehouses",
      label: "คลัง",
      numeric: true,
      render: (row) => quantity(row.warehouseCount),
    },
    {
      key: "lots",
      label: "Lot",
      numeric: true,
      render: (row) => quantity(row.lotCount),
    },
    {
      key: "status",
      label: "สถานะ / คำเตือน",
      render: (row) => (
        <div className="flex min-w-36 flex-wrap gap-1">
          {row.lowStock && <StatusBadge tone="warning">สต็อกต่ำ</StatusBadge>}
          {row.qcHeldQty > 0 && (
            <StatusBadge tone="warning">กัก QC</StatusBadge>
          )}
          {row.blockedQty > 0 && (
            <StatusBadge tone="destructive">ระงับใช้งาน</StatusBadge>
          )}
          {row.totalQty === 0 && (
            <StatusBadge tone="neutral">ไม่มียอด</StatusBadge>
          )}
          {row.availableQty > 0 && (
            <StatusBadge tone="success">ผ่าน QC</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: "action",
      label: "รายละเอียด",
      render: ({ item }) => (
        <Button
          variant="outline"
          size="sm"
          aria-label={`รายละเอียด ${item.code}`}
          onClick={() => onView(item.id)}
        >
          <Eye aria-hidden="true" />
          ดู
        </Button>
      ),
    },
  ];
  return (
    <FactoryDataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.item.id}
      minWidth={1160}
      pagination={
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onChange={onPageChange}
        />
      }
    />
  );
}
