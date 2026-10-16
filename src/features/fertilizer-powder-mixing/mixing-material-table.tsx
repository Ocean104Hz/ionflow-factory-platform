"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/src/components/ui/popover";
import {
  FactoryDataTable,
  SectionCard,
  type Column,
} from "@/src/components/factory/patterns";
import { mixingCatalog } from "@/src/lib/mock-data/fertilizer-powder-mixing";
import { quantity } from "@/src/lib/formatters";
import { MixingField } from "./mixing-header";
import type { Material, FieldErrors } from "./mixing-domain";

export function MixingMaterialTable({
  rows,
  onChange,
  errors = {},
}: {
  rows: Material[];
  onChange?: (rows: Material[]) => void;
  errors?: FieldErrors;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const update = (index: number, patch: Partial<Material>) =>
    onChange?.(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const columns: Column<Material>[] = [
    {
      key: "code",
      label: "รหัส / ชื่อวัตถุดิบ",
      render: (r, i) => (
        <div className="min-w-56">
          <p className="font-medium">{r.material_name}</p>
          <p className="text-xs text-muted-foreground">{r.material_code}</p>
          {errors[`materials.${i}.material_code`] && (
            <p className="text-xs text-danger">
              {errors[`materials.${i}.material_code`]}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "lot",
      label: "Lot วัตถุดิบ",
      render: (r, i) =>
        onChange ? (
          <Input
            className="min-w-36"
            aria-label={`Lot วัตถุดิบ ${i + 1}`}
            value={r.lot_no}
            onChange={(e) => update(i, { lot_no: e.target.value })}
          />
        ) : (
          r.lot_no || "—"
        ),
    },
    {
      key: "qty",
      label: "จำนวนตามใบสั่งผสม",
      render: (r, i) =>
        onChange ? (
          <div className="min-w-40">
            <MixingField
              label={`จำนวนวัตถุดิบ ${i + 1} *`}
              type="number"
              step="any"
              value={Number.isNaN(r.order_qty) ? "" : r.order_qty}
              onChange={(e) => update(i, { order_qty: e.target.valueAsNumber })}
              error={errors[`materials.${i}.order_qty`]}
            />
          </div>
        ) : (
          quantity(r.order_qty)
        ),
    },
    { key: "unit", label: "หน่วย", render: (r) => r.unit },
    {
      key: "stock",
      label: "คงเหลือจำลอง (อ้างอิง)",
      numeric: true,
      render: (r) => quantity(r.stock_balance),
    },
  ];
  if (onChange)
    columns.push({
      key: "remove",
      label: "จัดการ",
      render: (r, i) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`ลบวัตถุดิบ ${i + 1}`}
          onClick={() => onChange(rows.filter((m) => m.id !== r.id))}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ),
    });
  return (
    <SectionCard
      title="วัตถุดิบตามใบสั่งผสม"
      subtitle="จำนวนตามแผน ไม่ใช่ยอดใช้จริง · คงเหลือเป็นข้อมูลจำลอง ไม่จองหรือตัดสต็อก"
      action={
        onChange && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline">
                <Plus aria-hidden="true" />
                เพิ่มวัตถุดิบ
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(480px,90vw)] space-y-3"
            >
              <Label htmlFor="mix-material-search">
                ค้นหารหัส / ชื่อวัตถุดิบ
              </Label>
              <Input
                id="mix-material-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {mixingCatalog
                  .filter((m) =>
                    `${m.material_code} ${m.material_name}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((m) => (
                    <Button
                      key={m.material_code}
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-start py-3 text-left whitespace-normal"
                      onClick={() => {
                        onChange([
                          ...rows,
                          {
                            ...m,
                            id: crypto.randomUUID(),
                            lot_no: "",
                            order_qty: 1,
                          },
                        ]);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span>
                        <span className="block">{m.material_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {m.material_code} · {quantity(m.stock_balance)}{" "}
                          {m.unit} (จำลอง)
                        </span>
                      </span>
                    </Button>
                  ))}
                {!mixingCatalog.some((m) =>
                  `${m.material_code} ${m.material_name}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <p className="p-3 text-sm text-muted-foreground">
                    ไม่พบวัตถุดิบ
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )
      }
    >
      {errors.materials && (
        <p role="alert" className="mb-3 text-danger">
          {errors.materials}
        </p>
      )}
      <FactoryDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        minWidth={850}
      />
    </SectionCard>
  );
}
