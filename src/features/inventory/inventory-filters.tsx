"use client";

import { useId } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { SelectField } from "@/src/components/factory/patterns";
import {
  inventoryItems,
  inventorySites,
  inventoryWarehouses,
} from "@/src/lib/mock-data/inventory";
import {
  inventoryStatuses,
  type InventoryFilters as Filters,
} from "./inventory-domain";

export function InventoryFilters({
  value,
  onChange,
  onReset,
}: {
  value: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
}) {
  const id = useId();
  const field = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next });
  const advancedCount = [
    value.itemGroup,
    value.category,
    value.unit,
    value.brand,
    value.lowStock,
    value.zeroBalance,
  ].filter((v) => v !== "ALL").length;
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_1fr_1fr_1fr]">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={id}>ค้นหาสินค้าหรือ Lot</Label>
          <Input
            id={id}
            value={value.search}
            placeholder="รหัส ชื่อ ข้อมูลจำเพาะ หรือ Lot"
            onChange={(event) => field("search", event.target.value)}
          />
        </div>
        <SelectField
          label="โรงงาน / Site"
          value={value.siteId}
          onChange={(siteId) =>
            onChange({ ...value, siteId, warehouseId: "ALL" })
          }
          options={[
            { value: "ALL", label: "ทุกโรงงาน / Site" },
            ...inventorySites.map((site) => ({
              value: site.id,
              label: `${site.code} · ${site.name}`,
            })),
          ]}
        />
        <SelectField
          label="คลังสินค้า"
          value={value.warehouseId}
          onChange={(warehouseId) => field("warehouseId", warehouseId)}
          options={[
            { value: "ALL", label: "ทุกคลังสินค้า" },
            ...inventoryWarehouses
              .filter(
                (warehouse) =>
                  value.siteId === "ALL" || warehouse.siteId === value.siteId,
              )
              .map((warehouse) => ({
                value: warehouse.id,
                label: `${warehouse.code} · ${warehouse.name}`,
              })),
          ]}
        />
        <SelectField
          label="สถานะคงคลัง"
          value={value.inventoryStatus}
          onChange={(status) =>
            field("inventoryStatus", status as Filters["inventoryStatus"])
          }
          options={[
            { value: "ALL", label: "ทุกสถานะ" },
            ...Object.entries(inventoryStatuses).map(([key, label]) => ({
              value: key,
              label,
            })),
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          ตัวกรองมีผลทันที · ไม่มีการแก้ไขยอดสต็อก
        </p>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <SlidersHorizontal aria-hidden="true" />
                ตัวกรองเพิ่มเติม{advancedCount ? ` (${advancedCount})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(460px,calc(100vw-2rem))] space-y-4"
            >
              <p className="text-sm font-semibold">ตัวกรองเพิ่มเติม</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["itemGroup", "กลุ่มสินค้า", "itemGroup"],
                    ["category", "หมวดสินค้า", "category"],
                    ["unit", "หน่วยนับ", "baseUnit"],
                    ["brand", "แบรนด์", "brand"],
                  ] as const
                ).map(([key, label, itemKey]) => (
                  <SelectField
                    key={key}
                    label={label}
                    value={value[key]}
                    onChange={(next) => field(key, next)}
                    options={[
                      { value: "ALL", label: "ทั้งหมด" },
                      ...Array.from(
                        new Set(
                          inventoryItems
                            .map((item) => item[itemKey])
                            .filter((v): v is string => Boolean(v)),
                        ),
                      )
                        .sort()
                        .map((v) => ({ value: v, label: v })),
                    ]}
                  />
                ))}
                <SelectField
                  label="สต็อกต่ำ"
                  value={value.lowStock}
                  onChange={(next) =>
                    field("lowStock", next as Filters["lowStock"])
                  }
                  options={[
                    { value: "ALL", label: "ทั้งหมด" },
                    { value: "LOW", label: "ต่ำกว่าจุดสั่งซื้อ" },
                    { value: "NOT_LOW", label: "ไม่มีคำเตือนสต็อกต่ำ" },
                  ]}
                />
                <SelectField
                  label="ยอดคงเหลือ"
                  value={value.zeroBalance}
                  onChange={(next) =>
                    field("zeroBalance", next as Filters["zeroBalance"])
                  }
                  options={[
                    { value: "ALL", label: "ทั้งหมด" },
                    { value: "ZERO", label: "ยอดเป็นศูนย์" },
                    { value: "NONZERO", label: "มียอดคงเหลือ" },
                  ]}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                สต็อกต่ำเทียบจุดสั่งซื้อกับยอดทุกสถานะและทุก Lot
                ในโรงงาน/คลังที่เลือก
              </p>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            ล้างตัวกรอง
          </Button>
        </div>
      </div>
    </div>
  );
}
