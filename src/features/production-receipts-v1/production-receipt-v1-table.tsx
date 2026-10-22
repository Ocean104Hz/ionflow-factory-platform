"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { ReceiptItemV1 } from "./production-receipt-v1-types";

type Props = {
  title: string;
  items: ReceiptItemV1[];

  // รายการหน่วยนับที่ดึงมาจาก Settings
  unitOptions: {
    value: string;
    label: string;
  }[];

  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<ReceiptItemV1>) => void;
};

export function ProductionReceiptV1Table({
  title,
  items,
  unitOptions,
  onAdd,
  onRemove,
  onUpdate,
}: Props) {
  const total = items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            จำนวนรายการ {items.length} รายการ
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-4" />
          เพิ่มรายการ
        </Button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th rowSpan={2} className="w-14 border-r p-3 text-center">
                No.
              </th>
              <th colSpan={2} className="border-r p-3 text-center">
                รายละเอียดวัสดุ
              </th>
              <th rowSpan={2} className="border-r p-3 text-center">
                จำนวน
              </th>
              <th rowSpan={2} className="border-r p-3 text-center">
                หน่วยนับ
              </th>
              <th rowSpan={2} className="border-r p-3 text-center">
                Lot
              </th>
              <th rowSpan={2} className="border-r p-3 text-center">
                หมายเหตุ
              </th>
              <th rowSpan={2} className="w-14 p-3 text-center">
                จัดการ
              </th>
            </tr>
            <tr className="border-b border-border">
              <th className="border-r p-3 text-left">รายการ</th>
              <th className="border-r p-3 text-left">ขนาด (kg)</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr
                key={item.id}
                className="border-b border-border/60 last:border-0"
              >
                <td className="border-r p-2 text-center">{index + 1}</td>
                <td className="min-w-52 border-r p-2">
                  <Input
                    aria-label={`${title} รายการ ${index + 1}`}
                    value={item.name}
                    onChange={(e) =>
                      onUpdate(item.id, { name: e.target.value })
                    }
                  />
                </td>
                <td className="min-w-32 border-r p-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`${title} ขนาด ${index + 1}`}
                    value={item.sizeKg}
                    onChange={(e) =>
                      onUpdate(item.id, { sizeKg: e.target.value })
                    }
                  />
                </td>
                <td className="min-w-32 border-r p-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    aria-label={`${title} จำนวน ${index + 1}`}
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdate(item.id, { quantity: e.target.value })
                    }
                  />
                </td>
                <td className="min-w-32 border-r p-2">
                  <select
                    aria-label={`${title} หน่วยนับ ${index + 1}`}
                    value={item.unit}
                    onChange={(event) =>
                      onUpdate(item.id, {
                        unit: event.target.value,
                      })
                    }
                    className="h-9 w-full min-w-32 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">เลือกหน่วยนับ</option>

                    {item.unit &&
                      !unitOptions.some(
                        (option) => option.value === item.unit,
                      ) && (
                        <option value={item.unit}>{item.unit} (ค่าเดิม)</option>
                      )}

                    {unitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="min-w-36 border-r p-2">
                  <Input
                    aria-label={`${title} Lot ${index + 1}`}
                    value={item.lot}
                    onChange={(e) => onUpdate(item.id, { lot: e.target.value })}
                  />
                </td>
                <td className="min-w-40 border-r p-2">
                  <Input
                    aria-label={`${title} หมายเหตุ ${index + 1}`}
                    value={item.note}
                    onChange={(e) =>
                      onUpdate(item.id, { note: e.target.value })
                    }
                  />
                </td>
                <td className="p-2 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบ ${title} รายการ ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() => onRemove(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className="border-t border-border bg-muted/30">
            <tr>
              <td colSpan={3} className="p-3 text-right font-semibold">
                รวมจำนวน
              </td>
              <td className="p-3 text-center font-semibold tabular-nums">
                {total.toLocaleString("th-TH")}
              </td>
              <td colSpan={4} className="p-3 text-xs text-muted-foreground">
                รวมตามจำนวนที่กรอก
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
