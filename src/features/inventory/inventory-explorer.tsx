"use client";

import { useState } from "react";
import { Boxes, ShieldAlert, TriangleAlert } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { PageHeader, SelectField } from "@/src/components/factory/patterns";
import { inventoryQuantity as quantity } from "./inventory-quantity";
import {
  inventoryItems,
  inventoryWarehouses,
} from "@/src/lib/mock-data/inventory";
import {
  aggregateInventory,
  defaultInventoryFilters,
  filterInventory,
  inventoryTypeCounts,
  inventoryTypes,
  paginateInventory,
  summarizeInventory,
  validateInventoryBalances,
  type InventoryFilters as Filters,
} from "./inventory-domain";
import { InventoryFilters } from "./inventory-filters";
import { InventoryTable } from "./inventory-table";
import { InventoryDetail } from "./inventory-detail";
import { InventoryHistory } from "./inventory-history";
import { inventoryReconciliation } from "./inventory-ledger-data";
import { useInventoryOperations } from "./inventory-operations-provider";
import { InventoryOperationsDialog } from "./inventory-operations-dialog";
import { InventoryIntegrationPreview } from "./inventory-integration-preview";

export function InventoryExplorer() {
  const { inventoryProjection, events } = useInventoryOperations();
  const operationCount = events.filter((event) => event.operation).length;
  const snapshot = validateInventoryBalances(
    inventoryItems,
    inventoryProjection.ok ? inventoryProjection.balances : [],
    inventoryWarehouses,
  );
  const [filters, setFilters] = useState<Filters>(defaultInventoryFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState("stock");
  const [historyRequest, setHistoryRequest] = useState({
    itemId: "ALL",
    version: 0,
  });
  const scoped = aggregateInventory(inventoryItems, snapshot.valid, filters);
  const summary = summarizeInventory(scoped);
  const counts = inventoryTypeCounts(scoped);
  const filtered = filterInventory(scoped, filters);
  const paged = paginateInventory(filtered, page, pageSize);
  const detail = filtered.find((row) => row.item.id === selected) ?? null;
  const types = [
    { value: "ALL", label: "ทั้งหมด" },
    ...Object.entries(inventoryTypes).map(([value, label]) => ({
      value,
      label,
    })),
    ...(counts.UNMAPPED || filters.itemType === "UNMAPPED"
      ? [{ value: "UNMAPPED", label: "ยังไม่จัดประเภท" }]
      : []),
  ];
  function change(next: Filters) {
    setFilters(next);
    setPage(1);
    setSelected(null);
  }
  function openHistory(itemId: string) {
    setHistoryRequest((previous) => ({
      itemId,
      version: previous.version + 1,
    }));
    setSelected(null);
    setView("history");
  }
  if (!inventoryProjection.ok)
    return (
      <>
        <PageHeader title="สินค้าคงคลัง" />
        <Alert variant="destructive">
          <AlertTitle>ไม่สามารถคำนวณ Stock Ledger</AlertTitle>
          <AlertDescription>
            {inventoryProjection.errors
              .map((error) => `${error.eventId}: ${error.message}`)
              .join(" · ")}
          </AlertDescription>
        </Alert>
      </>
    );
  if (!inventoryProjection.supportedFrom)
    return (
      <>
        <PageHeader title="สินค้าคงคลัง" />
        <Alert>
          <AlertTitle>ยังไม่มีประวัติยอดตั้งต้น</AlertTitle>
          <AlertDescription>
            ยังไม่สามารถยืนยันยอดคงเหลือได้ ไม่แสดงยอดศูนย์แทนข้อมูลที่ขาดหาย
          </AlertDescription>
        </Alert>
      </>
    );
  return (
    <>
      <PageHeader
        title="สินค้าคงคลัง"
        description="ค้นหา ตรวจสอบ และติดตามสินค้าคงเหลือตามประเภท คลังสินค้า และ Lot"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">DEMO · ไม่เชื่อมระบบจริง</Badge>
            <InventoryOperationsDialog />
          </div>
        }
      />
      <Tabs value={view} onValueChange={setView} className="min-w-0 gap-4">
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="มุมมองสินค้าคงคลัง" className="min-w-max">
            <TabsTrigger value="stock">สินค้าคงคลัง</TabsTrigger>
            <TabsTrigger value="history">ประวัติสต็อก</TabsTrigger>
            <TabsTrigger value="integration">
              ตัวอย่างการเชื่อมโมดูล
            </TabsTrigger>
          </TabsList>
        </div>
        <p
          role="status"
          className={`text-xs ${inventoryReconciliation?.ok ? "text-muted-foreground" : "text-danger"}`}
        >
          {inventoryReconciliation?.ok
            ? `Ledger สาธิต · ยอดตั้งต้นตรวจตรงกับ Step 1 ครบ ${inventoryReconciliation.matching.length} ตำแหน่ง · รายการใหม่ ${operationCount} เหตุการณ์ (ยอดปัจจุบันรวมรายการใหม่แล้ว)`
            : "ยอด Ledger ไม่ตรงกับ Step 1 · ไม่มีการเขียนทับยอดอัตโนมัติ"}
        </p>
        <TabsContent
          value="stock"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-xs text-muted-foreground">
                ภาพรวมโรงงาน/คลังที่เลือก · นับรายการสินค้า ไม่รวมยอดต่างหน่วย ·
                ไม่ขึ้นกับประเภทและคำค้น
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    [
                      "รายการสินค้าทั้งหมด",
                      summary.itemCount,
                      Boxes,
                      "text-primary",
                      "จำนวนรหัสสินค้าไม่ซ้ำ",
                    ],
                    [
                      "สินค้าต่ำกว่าจุดสั่งซื้อ",
                      summary.lowStockCount,
                      TriangleAlert,
                      "text-warning",
                      "เฉพาะรายการที่กำหนดจุดสั่งซื้อ",
                    ],
                    [
                      "สินค้าที่มียอดกัก QC",
                      summary.qcHeldCount,
                      ShieldAlert,
                      "text-warning",
                      "รายการที่มียอด QC_HOLD มากกว่าศูนย์",
                    ],
                  ] as const
                ).map(([title, value, Icon, color, description]) => (
                  <Card key={title} className="gap-2 py-4 shadow-none">
                    <CardHeader className="flex flex-row items-center justify-between px-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                      </CardTitle>
                      <Icon aria-hidden="true" className={`size-4 ${color}`} />
                    </CardHeader>
                    <CardContent className="space-y-1 px-4">
                      <p className="text-3xl font-semibold tabular-nums">
                        {quantity(value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            {snapshot.issues.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>มี snapshot ไม่ถูกต้อง ไม่รวมในยอด</AlertTitle>
                <AlertDescription>
                  <ul>
                    {snapshot.issues.map((issue, index) => (
                      <li key={`${issue.id}-${index}`}>
                        {issue.id}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <Tabs
              className="min-w-0 gap-4"
              value={filters.itemType}
              onValueChange={(value) =>
                change({ ...filters, itemType: value as Filters["itemType"] })
              }
            >
              <div className="max-w-full overflow-x-auto pb-1">
                <TabsList
                  aria-label="ประเภทสินค้าคงคลัง"
                  className="h-auto min-w-max justify-start gap-1 bg-muted/50 p-1"
                >
                  {types.map(({ value, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="gap-2 px-3 py-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      {label}
                      <span className="text-xs tabular-nums opacity-70">
                        {counts[value]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <TabsContent
                value={filters.itemType}
                className="min-w-0 space-y-4"
              >
                <InventoryFilters
                  value={filters}
                  onChange={change}
                  onReset={() => change({ ...defaultInventoryFilters })}
                />
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">
                      รายการสินค้าคงคลัง{" "}
                      <span
                        role="status"
                        className="text-sm font-normal text-muted-foreground"
                      >
                        {quantity(filtered.length)} รายการ
                      </span>
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ยอดตามโรงงาน คลัง และสถานะที่เลือก · ค้นหาตรง Lot
                      จะรวมเฉพาะ Lot ที่พบ · คลิกรหัสเพื่อดูรายละเอียด
                    </p>
                  </div>
                  <div className="w-32 shrink-0">
                    <SelectField
                      label="จำนวนต่อหน้า"
                      value={String(pageSize)}
                      onChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                      options={[5, 10, 20, 50].map((value) => ({
                        value: String(value),
                        label: `${value} รายการ`,
                      }))}
                    />
                  </div>
                </div>
                <InventoryTable
                  rows={paged.rows}
                  page={paged.page}
                  pageSize={paged.pageSize}
                  total={paged.total}
                  onPageChange={setPage}
                  onView={setSelected}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  ประเภท กลุ่มสินค้า และหมวดสินค้าเป็นคนละมิติ ·
                  “ยังไม่จัดประเภท” ไม่รวมกับ “อื่น ๆ” · ยอดคำนวณจาก Ledger
                  สาธิตและรายการที่บันทึกในเซสชันนี้ ·
                  ไม่ใช่ยอดพร้อมสัญญาขายและไม่เชื่อมระบบจริง
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        <TabsContent
          value="history"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <InventoryHistory
            key={historyRequest.version}
            itemId={historyRequest.itemId}
          />
        </TabsContent>
        <TabsContent
          value="integration"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <InventoryIntegrationPreview />
        </TabsContent>
      </Tabs>
      <InventoryDetail
        key={selected}
        row={detail}
        scope={filters}
        onOpenHistory={openHistory}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
