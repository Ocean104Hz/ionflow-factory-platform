"use client";

import { useId, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/src/components/ui/collapsible";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import {
  FactoryDataTable,
  type Column,
} from "@/src/components/factory/patterns";
import {
  aggregateInventory,
  filterInventory,
  type InventoryBalanceSnapshot,
  type InventoryFilters,
  type InventoryRow,
} from "./inventory-domain";
import { ledgerContext } from "./inventory-ledger-data";
import { useInventoryOperations } from "./inventory-operations-provider";
import { ledgerBusinessDate, replayLedger } from "./inventory-ledger-domain";
import {
  inventoryQuantity,
  quantityDecimal,
  quantityUnits,
} from "./inventory-quantity";

export function InventoryAsOf({
  row,
  scope,
  columns,
}: {
  row: InventoryRow;
  scope: InventoryFilters;
  columns: Column<InventoryBalanceSnapshot>[];
}) {
  const id = useId();
  const { inventoryProjection, events } = useInventoryOperations();
  const latest =
    inventoryProjection.ok && inventoryProjection.events.length
      ? ledgerBusinessDate(
          inventoryProjection.events[inventoryProjection.events.length - 1]
            .postedAt,
        )
      : "";
  const [day, setDay] = useState(latest);
  const historical = day ? replayLedger(events, ledgerContext, day) : null;
  const historicalRow = historical?.ok
    ? filterInventory(
        aggregateInventory(ledgerContext.items, historical.balances, scope),
        scope,
      ).find((candidate) => candidate.item.id === row.item.id)
    : undefined;
  const past = historicalRow?.totalQty ?? 0;
  return (
    <section
      className="space-y-3 border-t pt-4"
      aria-label="ยอดคงเหลือย้อนหลัง"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            ยอดคงเหลือย้อนหลัง · {row.item.code}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            ใช้ขอบเขตและตัวกรองเดียวกับยอดปัจจุบัน · รวมจนสิ้นวัน Asia/Bangkok
          </p>
        </div>
        <div className="grid w-48 gap-2">
          <Label htmlFor={id}>ยอด ณ วันที่</Label>
          <Input
            id={id}
            type="date"
            max={latest || undefined}
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </div>
      </div>
      {!historical ? (
        <p className="text-sm text-muted-foreground">
          เลือกวันที่เพื่อดูยอดย้อนหลัง
        </p>
      ) : !historical.ok ? (
        <Alert>
          <AlertDescription>
            {historical.errors.map((error) => error.message).join(" · ")}
          </AlertDescription>
        </Alert>
      ) : !historical.supportedFrom ? (
        <Alert>
          <AlertDescription>
            ยังไม่มีประวัติหรือยอดตั้งต้น ไม่สามารถยืนยันยอดย้อนหลังได้
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 sm:grid-cols-3">
            {[
              [`ยอด ณ ${day}`, inventoryQuantity(past)],
              ["ยอดปัจจุบัน", inventoryQuantity(row.totalQty)],
              [
                "เปลี่ยนแปลงถึงปัจจุบัน",
                inventoryQuantity(
                  quantityDecimal(
                    quantityUnits(row.totalQty) - quantityUnits(past),
                  ),
                ),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {value}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    {row.item.baseUnit}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="outline">
                ดูตำแหน่งคงเหลือ ณ วันที่เลือก
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <FactoryDataTable
                columns={columns}
                rows={historicalRow?.balances ?? []}
                rowKey={(balance) => balance.id}
                minWidth={1050}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </section>
  );
}
