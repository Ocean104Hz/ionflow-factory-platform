"use client";
import { useState } from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
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
      className="gap-3 border-0 py-2 shadow-none"
      contentClassName="px-0"
      subtitle="จำนวนตามแผน ไม่ใช่ยอดใช้จริง · คงเหลือเป็นข้อมูลจำลอง ไม่จองหรือตัดสต็อก"
      action={
        onChange && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                <Plus aria-hidden="true" />
                เพิ่มวัตถุดิบ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85dvh] w-[94vw] max-w-[94vw] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>ค้นหาวัตถุดิบ</DialogTitle>
                <DialogDescription>เลือกจากรายการวัตถุดิบจำลองของโมดูลนี้</DialogDescription>
              </DialogHeader>
              <Label htmlFor="mix-material-search">
                ค้นหารหัส / ชื่อวัตถุดิบ
              </Label>
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="mix-material-search" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
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
            </DialogContent>
          </Dialog>
        )
      }
    >
      {errors.materials && (
        <p role="alert" className="mb-3 text-danger">
          {errors.materials}
        </p>
      )}
      <div className="[&_.factory-table_td]:py-2! [&_.factory-table_th]:px-3! [&_.factory-table_td]:px-3!">
      <FactoryDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        minWidth={760}
      />
      </div>
    </SectionCard>
  );
}
