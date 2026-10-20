"use client";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  FactoryDataTable,
  InfoGrid,
  InfoRow,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { Card, CardContent } from "@/src/components/ui/card";
import { dateTime } from "@/src/lib/formatters";
import { inventoryQuantity as quantity } from "./inventory-quantity";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { InventoryHistory } from "./inventory-history";
import { InventoryAsOf } from "./inventory-as-of";
import { summarizeLots } from "./inventory-ledger-domain";
import {
  inventorySites,
  inventoryWarehouses,
} from "@/src/lib/mock-data/inventory";
import {
  inventoryStatuses,
  inventoryTypeLabel,
  type InventoryBalanceSnapshot,
  type InventoryRow,
  type InventoryFilters,
} from "./inventory-domain";

export function InventoryDetail({
  row,
  onClose,
  onOpenHistory,
  scope,
}: {
  row: InventoryRow | null;
  onClose: () => void;
  onOpenHistory: (itemId: string) => void;
  scope: InventoryFilters;
}) {
  if (!row) return null;
  const { item } = row;
  const lots = summarizeLots(row.balances);
  const lotColumns: Column<(typeof lots)[number]>[] = [
    { key: "lot", label: "Lot", render: (lot) => lot.lotCode || "ไม่ระบุ Lot" },
    {
      key: "positions",
      label: "จำนวนตำแหน่ง",
      numeric: true,
      render: (lot) => lot.positions,
    },
    {
      key: "quantity",
      label: "ยอดรวมใน Lot",
      numeric: true,
      render: (lot) => quantity(lot.quantity),
    },
    { key: "unit", label: "หน่วย", render: (lot) => lot.unit },
  ];
  const columns: Column<InventoryBalanceSnapshot>[] = [
    {
      key: "site",
      label: "โรงงาน / Site",
      render: (balance) =>
        inventorySites.find((site) => site.id === balance.siteId)?.name ??
        "ไม่พบโรงงาน",
    },
    {
      key: "warehouse",
      label: "คลังสินค้า",
      render: (balance) =>
        inventoryWarehouses.find(
          (warehouse) => warehouse.id === balance.warehouseId,
        )?.name ?? "ไม่พบคลัง",
    },
    {
      key: "location",
      label: "ตำแหน่ง",
      render: (balance) => balance.locationLabel || "—",
    },
    {
      key: "lot",
      label: "Lot",
      render: (balance) => balance.lotCode || "ไม่ระบุ Lot",
    },
    {
      key: "status",
      label: "สถานะ",
      render: (balance) => (
        <StatusBadge
          tone={
            balance.inventoryStatus === "AVAILABLE"
              ? "success"
              : balance.inventoryStatus === "QC_HOLD"
                ? "warning"
                : "destructive"
          }
        >
          {inventoryStatuses[balance.inventoryStatus]}
        </StatusBadge>
      ),
    },
    {
      key: "quantity",
      label: `จำนวน (${item.baseUnit})`,
      numeric: true,
      render: (balance) => quantity(balance.onHandQty),
    },
    {
      key: "updatedAt",
      label: "อัปเดตล่าสุด",
      render: (balance) => dateTime(balance.updatedAt),
    },
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1rem)] max-w-[1200px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1200px] motion-reduce:animate-none">
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>
            {item.code} · {item.name}
          </DialogTitle>
          <DialogDescription>
            รายละเอียดคงคลังแบบอ่านอย่างเดียว ·
            ยอดและรายการย่อยตามตัวกรองปัจจุบัน
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-5 overflow-y-auto p-5">
          <Tabs defaultValue="overview" className="min-w-0 gap-4">
            <div className="overflow-x-auto">
              <TabsList
                aria-label="รายละเอียดสินค้าคงคลัง"
                className="min-w-max"
              >
                <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
                <TabsTrigger value="lots">Lot และตำแหน่ง</TabsTrigger>
                <TabsTrigger value="history">ประวัติการเคลื่อนไหว</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="overview" className="min-w-0 space-y-5">
              <section className="space-y-4" aria-label="ข้อมูลสินค้า">
                <h3 className="text-sm font-semibold">ข้อมูลสินค้า</h3>
                <InfoGrid>
                  <InfoRow label="รหัสสินค้า">{item.code}</InfoRow>
                  <InfoRow label="ชื่อสินค้า">{item.name}</InfoRow>
                  <InfoRow label="ประเภท">
                    {inventoryTypeLabel(item.itemType)}
                    {item.legacyClassification && (
                      <p className="text-xs text-warning">
                        ประเภทเดิม: {item.legacyClassification} ·
                        ยังไม่จัดประเภท
                      </p>
                    )}
                  </InfoRow>
                  <InfoRow label="กลุ่มสินค้า">{item.itemGroup}</InfoRow>
                  <InfoRow label="หมวดสินค้า">{item.category}</InfoRow>
                  <InfoRow label="ข้อมูลจำเพาะ">
                    {item.specification || "ไม่ระบุ"}
                  </InfoRow>
                  <InfoRow label="หน่วยหลัก">{item.baseUnit}</InfoRow>
                  <InfoRow label="แบรนด์">{item.brand || "ไม่ระบุ"}</InfoRow>
                  <InfoRow label="สถานะทะเบียน">
                    <StatusBadge tone={item.active ? "success" : "neutral"}>
                      {item.active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </StatusBadge>
                  </InfoRow>
                  <InfoRow label="จุดสั่งซื้อ">
                    {item.reorderPoint === undefined
                      ? "ยังไม่กำหนด"
                      : `${quantity(item.reorderPoint)} ${item.baseUnit}`}
                  </InfoRow>
                </InfoGrid>
              </section>
              <section className="space-y-3" aria-label="สรุปสินค้าคงคลัง">
                <h3 className="text-sm font-semibold">
                  สรุปสินค้าคงคลังตามตัวกรอง
                </h3>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {(
                    [
                      ["คงเหลือรวม", row.totalQty, "text-foreground"],
                      ["ผ่าน QC (สาธิต)", row.availableQty, "text-success"],
                      ["กัก QC", row.qcHeldQty, "text-warning"],
                      ["ระงับใช้งาน", row.blockedQty, "text-danger"],
                    ] as const
                  ).map(([label, value, color]) => (
                    <Card key={label} className="py-3 shadow-none">
                      <CardContent className="space-y-1 px-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p
                          className={`text-xl font-semibold tabular-nums ${color}`}
                        >
                          {quantity(value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.baseUnit}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  ผ่าน QC คือยอดตามสถานะ mock เท่านั้น ไม่ใช่
                  Available-to-Promise และยังไม่หักยอดจอง
                </p>
                <p className="text-xs text-muted-foreground">
                  เกณฑ์สต็อกต่ำใช้ยอดทุกสถานะ/ทุก Lot ในพื้นที่ที่เลือก:{" "}
                  {quantity(row.scopeOnHandQty)} {item.baseUnit} ·{" "}
                  {item.reorderPoint === undefined
                    ? "ไม่ประเมินเพราะยังไม่กำหนดจุดสั่งซื้อ"
                    : row.lowStock
                      ? "ต่ำกว่าจุดสั่งซื้อ"
                      : "ไม่ต่ำกว่าจุดสั่งซื้อ"}
                </p>
              </section>
              <InventoryAsOf row={row} scope={scope} columns={columns} />
            </TabsContent>
            <TabsContent value="lots" className="min-w-0 space-y-5">
              <section className="space-y-3" aria-label="สรุป Lot">
                <h3 className="text-sm font-semibold">สรุป Lot</h3>
                <p className="text-xs text-muted-foreground">
                  ยอดรวม Lot แยกจากรายการตำแหน่งด้านล่าง ·
                  ไม่รวมข้ามสินค้า/หน่วย
                </p>
                <FactoryDataTable
                  columns={lotColumns}
                  rows={lots}
                  rowKey={(lot) =>
                    JSON.stringify([lot.itemId, lot.lotCode, lot.unit])
                  }
                  minWidth={500}
                />
              </section>
              <section className="space-y-3" aria-label="ยอดแยกคลังและ Lot">
                <h3 className="text-sm font-semibold">
                  ยอดแยกคลังและ Lot · {row.warehouseCount} คลัง / {row.lotCount}{" "}
                  Lot
                </h3>
                {row.balances.length ? (
                  <FactoryDataTable
                    columns={columns}
                    rows={row.balances}
                    rowKey={(balance) => balance.id}
                    minWidth={1050}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    ยังไม่มี snapshot ยอดคงเหลือของสินค้านี้
                  </p>
                )}
              </section>
            </TabsContent>
            <TabsContent value="history" className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  ประวัติทั้งหมดของ {item.code}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenHistory(item.id)}
                >
                  เปิดประวัติเต็มของสินค้า
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                แสดงประวัติทุกตำแหน่งของสินค้านี้ ไม่จำกัดด้วยตัวกรอง
                Lot/คลังจากตารางหลัก
              </p>
              <InventoryHistory compact itemId={item.id} />
            </TabsContent>
          </Tabs>
          <p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            ยอดคำนวณจาก Stock Ledger สาธิตแบบ immutable · อ่านอย่างเดียว ·
            ไม่รับ เบิก โอน ปรับ จอง หรือตัดสต็อกจริง
          </p>
        </div>
        <DialogFooter className="shrink-0 border-t p-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              ปิดรายละเอียด
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
