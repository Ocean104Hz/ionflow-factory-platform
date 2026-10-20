"use client";

import { useId, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
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
  Pagination,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { dateTime } from "@/src/lib/formatters";
import { inventoryStatuses, paginateInventory } from "./inventory-domain";
import {
  defaultMovementFilters,
  filterMovements,
  ledgerEventTypes,
  type MovementFilters,
  type StockLedgerEvent,
  type StockPosting,
} from "./inventory-ledger-domain";
import { ledgerContext } from "./inventory-ledger-data";
import { useInventoryOperations } from "./inventory-operations-provider";
import {
  inventoryQuantity,
  quantityDecimal,
  quantityUnits,
} from "./inventory-quantity";

const warehouseLabel = (posting: StockPosting) =>
  `${ledgerContext.warehouses.find((row) => row.id === posting.warehouseId)?.code ?? posting.warehouseId} · ${posting.locationLabel} · ${inventoryStatuses[posting.inventoryStatus]}`;
function movementQuantity(event: StockLedgerEvent) {
  if (new Set(event.postings.map((posting) => posting.itemId)).size !== 1)
    return "แยกตามสินค้า/หน่วย";
  const paired =
    event.eventType === "TRANSFER" || event.eventType === "STATUS_CHANGE";
  const total = event.postings.reduce((sum, posting) => {
    const delta = quantityUnits(posting.quantityDelta);
    return sum + (paired && delta < BigInt(0) ? BigInt(0) : delta);
  }, BigInt(0));
  return `${total > BigInt(0) && !paired ? "+" : ""}${inventoryQuantity(quantityDecimal(total))} ${event.postings[0].unit}${paired ? " (ย้ายยอด)" : ""}`;
}
function EventDetail({
  event,
  onClose,
}: {
  event: StockLedgerEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;
  const columns: Column<StockPosting>[] = [
    {
      key: "item",
      label: "สินค้า",
      render: (posting) => {
        const item = ledgerContext.items.find(
          (row) => row.id === posting.itemId,
        );
        return (
          <div className="min-w-40">
            <p className="font-medium">{item?.code}</p>
            <p className="text-xs text-muted-foreground">{item?.name}</p>
          </div>
        );
      },
    },
    {
      key: "site",
      label: "โรงงาน",
      render: (posting) =>
        ledgerContext.sites.find((row) => row.id === posting.siteId)?.name,
    },
    {
      key: "warehouse",
      label: "คลัง / ตำแหน่ง",
      render: (posting) => warehouseLabel(posting),
    },
    {
      key: "lot",
      label: "Lot",
      render: (posting) => posting.lotCode || "ไม่ระบุ",
    },
    {
      key: "quantity",
      label: "เปลี่ยนแปลง",
      numeric: true,
      render: (posting) => (
        <span
          className={
            quantityUnits(posting.quantityDelta) < BigInt(0)
              ? "text-danger"
              : "text-success"
          }
        >
          {quantityUnits(posting.quantityDelta) > BigInt(0) ? "+" : ""}
          {inventoryQuantity(posting.quantityDelta)}
        </span>
      ),
    },
    { key: "unit", label: "หน่วย", render: (posting) => posting.unit },
  ];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[88dvh] w-[calc(100%-1rem)] max-w-[1150px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1150px] motion-reduce:animate-none">
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>{event.documentNo}</DialogTitle>
          <DialogDescription>
            {ledgerEventTypes[event.eventType]} · {dateTime(event.postedAt)} ·
            Asia/Bangkok
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <p className="text-sm">{event.reason || "ไม่ระบุหมายเหตุ"}</p>
          <p className="text-sm">
            ผู้ทำรายการ: {event.operation?.actor ?? "ข้อมูลประวัติสาธิต"}
          </p>
          {event.operation?.note && (
            <p className="text-sm">หมายเหตุ: {event.operation.note}</p>
          )}
          {event.operation?.type === "ADJUST" && (
            <p className="text-sm">
              ยอดระบบที่ทบทวน: {event.operation.reviewedQuantity} · ตรวจนับ:{" "}
              {event.operation.countedQuantity} {event.postings[0].unit}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            หนึ่งเหตุการณ์รวม {event.postings.length} postings · โอนและเปลี่ยน
            QC แสดงต้นทาง/ปลายทางในเอกสารเดียว ไม่มีการทำรายการจริง
          </p>
          <FactoryDataTable
            columns={columns}
            rows={[...event.postings]}
            rowKey={(posting) => posting.id}
            minWidth={1000}
          />
          <p className="text-xs text-muted-foreground">
            Event ID: {event.id} · ลำดับเมื่อเวลาเท่ากัน: {event.order} ·
            ข้อมูลประวัติสาธิตแบบ immutable
          </p>
        </div>
        <DialogFooter className="shrink-0 border-t p-4">
          <DialogClose asChild>
            <Button variant="outline">ปิดเหตุการณ์</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function InventoryHistory({
  itemId = "ALL",
  compact = false,
}: {
  itemId?: string;
  compact?: boolean;
}) {
  const id = useId();
  const { inventoryProjection } = useInventoryOperations();
  const [filters, setFilters] = useState<MovementFilters>({
    ...defaultMovementFilters,
    itemId,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<StockLedgerEvent | null>(null);
  const events = inventoryProjection.ok ? inventoryProjection.events : [];
  let error = "";
  let filtered: StockLedgerEvent[] = [];
  try {
    filtered = filterMovements(
      events,
      { ...filters, itemId: compact ? itemId : filters.itemId },
      ledgerContext,
    );
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "ตัวกรองไม่ถูกต้อง";
  }
  const paged = paginateInventory(filtered, page, pageSize);
  function change(patch: Partial<MovementFilters>) {
    setFilters((previous) => ({ ...previous, ...patch }));
    setPage(1);
  }
  const columns: Column<StockLedgerEvent>[] = [
    {
      key: "date",
      label: "วันที่ลงบัญชี",
      render: (event) => dateTime(event.postedAt),
    },
    {
      key: "document",
      label: "เอกสารอ้างอิง",
      render: (event) => (
        <Button
          variant="link"
          className="h-auto p-0"
          onClick={() => setSelected(event)}
        >
          {event.documentNo}
        </Button>
      ),
    },
    {
      key: "type",
      label: "ประเภท",
      render: (event) => (
        <StatusBadge
          tone={
            event.eventType === "OPENING"
              ? "neutral"
              : event.eventType === "ISSUE"
                ? "warning"
                : "info"
          }
        >
          {ledgerEventTypes[event.eventType]}
        </StatusBadge>
      ),
    },
    ...(!compact
      ? [
          {
            key: "item",
            label: "สินค้า",
            render: (event: StockLedgerEvent) => {
              const ids = Array.from(
                new Set(event.postings.map((posting) => posting.itemId)),
              );
              const item = ledgerContext.items.find((row) => row.id === ids[0]);
              return ids.length === 1 ? (
                <div className="min-w-40">
                  <p className="font-medium">{item?.code}</p>
                  <p className="text-xs text-muted-foreground">{item?.name}</p>
                </div>
              ) : (
                `${ids.length} รหัสสินค้า`
              );
            },
          },
          {
            key: "source",
            label: "ต้นทาง",
            render: (event: StockLedgerEvent) =>
              Array.from(
                new Set(
                  event.postings
                    .filter(
                      (posting) =>
                        quantityUnits(posting.quantityDelta) < BigInt(0),
                    )
                    .map(warehouseLabel),
                ),
              ).join(" / ") || "ยอดเพิ่ม",
          },
          {
            key: "destination",
            label: "ปลายทาง",
            render: (event: StockLedgerEvent) => (
              <div className="min-w-40 max-w-64">
                {event.eventType === "OPENING"
                  ? `${event.postings.length} ตำแหน่งตั้งต้น`
                  : Array.from(
                      new Set(
                        event.postings
                          .filter(
                            (posting) =>
                              quantityUnits(posting.quantityDelta) > BigInt(0),
                          )
                          .map(warehouseLabel),
                      ),
                    ).join(" / ") || "จ่ายออก"}
              </div>
            ),
          },
          {
            key: "lot",
            label: "Lot",
            render: (event: StockLedgerEvent) => {
              const lots = Array.from(
                new Set(event.postings.map((posting) => posting.lotCode)),
              );
              return lots.length === 1 ? lots[0] : `${lots.length} Lot`;
            },
          },
        ]
      : []),
    { key: "quantity", label: "จำนวน / หน่วย", render: movementQuantity },
    {
      key: "actor",
      label: "ผู้ทำรายการ",
      render: (event) => event.operation?.actor ?? "ประวัติสาธิต",
    },
    ...(!compact
      ? [
          {
            key: "status",
            label: "สถานะ",
            render: () => (
              <StatusBadge tone="neutral">ลงบัญชีสาธิต</StatusBadge>
            ),
          },
        ]
      : []),
    {
      key: "actions",
      label: "รายละเอียด",
      render: (event) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`ดูเหตุการณ์ ${event.documentNo}`}
          onClick={() => setSelected(event)}
        >
          <Eye aria-hidden="true" />
          ดู
        </Button>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-4">
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold">ประวัติสต็อก</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            เหตุการณ์สาธิตที่ใช้คำนวณยอด ·
            โอนและเปลี่ยนสถานะนับเป็นเหตุการณ์เดียว · ไม่ใช่หน้าบันทึกรายการ
          </p>
        </div>
      )}
      <div className="grid items-end gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-search`}>ค้นหาประวัติ</Label>
          <Input
            id={`${id}-search`}
            value={filters.search}
            placeholder="เอกสาร สินค้า คลัง หรือ Lot"
            onChange={(event) => change({ search: event.target.value })}
          />
        </div>
        <SelectField
          label="ประเภทการเคลื่อนไหว"
          value={filters.eventType}
          onChange={(value) =>
            change({ eventType: value as MovementFilters["eventType"] })
          }
          options={[
            { value: "ALL", label: "ทุกประเภท" },
            ...Object.entries(ledgerEventTypes).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <div className="grid gap-2">
          <Label htmlFor={`${id}-from`}>ตั้งแต่วันที่</Label>
          <Input
            id={`${id}-from`}
            type="date"
            value={filters.from}
            aria-invalid={Boolean(error)}
            onChange={(event) => change({ from: event.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-to`}>ถึงวันที่</Label>
          <Input
            id={`${id}-to`}
            type="date"
            value={filters.to}
            aria-invalid={Boolean(error)}
            onChange={(event) => change({ to: event.target.value })}
          />
        </div>
        {!compact && (
          <>
            <SelectField
              label="สินค้าในประวัติ"
              value={filters.itemId}
              onChange={(value) => change({ itemId: value })}
              options={[
                { value: "ALL", label: "ทุกสินค้า" },
                ...ledgerContext.items.map((item) => ({
                  value: item.id,
                  label: `${item.code} · ${item.name}`,
                })),
              ]}
            />
            <SelectField
              label="โรงงานในประวัติ"
              value={filters.siteId}
              onChange={(value) =>
                change({ siteId: value, warehouseId: "ALL" })
              }
              options={[
                { value: "ALL", label: "ทุกโรงงาน" },
                ...ledgerContext.sites.map((site) => ({
                  value: site.id,
                  label: site.name,
                })),
              ]}
            />
            <SelectField
              label="คลังในประวัติ"
              value={filters.warehouseId}
              onChange={(value) => change({ warehouseId: value })}
              options={[
                { value: "ALL", label: "ทุกคลัง (ต้นทาง/ปลายทาง)" },
                ...ledgerContext.warehouses
                  .filter(
                    (warehouse) =>
                      filters.siteId === "ALL" ||
                      warehouse.siteId === filters.siteId,
                  )
                  .map((warehouse) => ({
                    value: warehouse.id,
                    label: `${warehouse.code} · ${warehouse.name}`,
                  })),
              ]}
            />
            <div className="grid gap-2">
              <Label htmlFor={`${id}-lot`}>Lot ในประวัติ</Label>
              <Input
                id={`${id}-lot`}
                value={filters.lot}
                placeholder="ค้นหา Lot"
                onChange={(event) => change({ lot: event.target.value })}
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 xl:col-span-4">
          <p className="text-xs text-muted-foreground">
            วันสิ้นสุดรวมถึง 23:59:59.999 น. เวลาไทย ·
            ผลลัพธ์แสดงทั้งเหตุการณ์รวมต้นทาง/ปลายทาง
          </p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFilters({
                ...defaultMovementFilters,
                itemId: compact ? itemId : "ALL",
              });
              setPage(1);
            }}
          >
            <RotateCcw aria-hidden="true" />
            ล้างตัวกรองประวัติ
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-end justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          {filtered.length} เหตุการณ์
        </p>
        <div className="w-32">
          <SelectField
            label="ประวัติต่อหน้า"
            value={String(pageSize)}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
            options={[5, 10, 20].map((value) => ({
              value: String(value),
              label: `${value} รายการ`,
            }))}
          />
        </div>
      </div>
      <FactoryDataTable
        columns={columns}
        rows={paged.rows}
        rowKey={(event) => event.id}
        minWidth={compact ? 760 : 1450}
        pagination={
          <Pagination
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            onChange={setPage}
          />
        }
      />
      <EventDetail event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
