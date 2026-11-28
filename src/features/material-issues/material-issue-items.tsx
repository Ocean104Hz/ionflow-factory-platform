"use client";

import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";

import { SectionCard } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import { MaterialIssueStockPickerModal } from "./material-issue-stock-picker-modal";

import type { MaterialIssueItem } from "./material-issue-domain";
import type { MaterialIssueStockItem } from "./material-issue-domain";

type EditableItemField = Exclude<
  keyof MaterialIssueItem,
  "id"
>;

type MaterialIssueItemsProps = {
  items: MaterialIssueItem[];
  onChange: (
    id: string,
    field: EditableItemField,
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
};

export function MaterialIssueItems({
  items,
  onChange,
  onAdd,
  onRemove,
}: MaterialIssueItemsProps) {
  const [selectedRowId, setSelectedRowId] =
    useState<string | null>(null);

  const selectedRow = items.find(
    (item) => item.id === selectedRowId,
  );

  function handleSelectMaterial(
    material: MaterialIssueStockItem,
  ): void {
    if (!selectedRowId || !selectedRow) return;

    onChange(
      selectedRowId,
      "materialCode",
      material.materialCode,
    );

    onChange(
      selectedRowId,
      "materialName",
      material.materialName,
    );

    onChange(
      selectedRowId,
      "unit",
      material.unit,
    );

    setSelectedRowId(null);
  }

  return (
    <>
      <SectionCard title="รายการวัสดุ">
        <div className="overflow-x-auto rounded-md border">
          <Table className="factory-itech-form-table min-w-250">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead
                  rowSpan={2}
                  className="w-16 border-r text-center"
                >
                  ลำดับ
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="w-36 border-r text-center"
                >
                  รหัส
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="min-w-60 border-r"
                >
                  รายการวัสดุ
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="w-28 border-r text-center"
                >
                  จำนวน
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="w-28 border-r text-center"
                >
                  หน่วย
                </TableHead>

                <TableHead
                  colSpan={2}
                  className="border-r text-center"
                >
                  หมายเหตุ
                </TableHead>

                <TableHead
                  rowSpan={2}
                  className="w-20 text-center"
                >
                  จัดการ
                </TableHead>
              </TableRow>

              <TableRow>
                <TableHead className="w-28 border-r text-center">
                  ชำรุด
                </TableHead>

                <TableHead className="w-28 border-r text-center">
                  เบิกเพิ่ม
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>

                  {/* ลำดับ */}
                  <TableCell className="border-r text-center">
                    {index + 1}
                  </TableCell>

                  {/* ปุ่มค้นหารหัสวัสดุ */}
                  <TableCell className="border-r">
                    <button
                      type="button"
                      aria-label={`ค้นหารหัสวัสดุ รายการ ${index + 1}`}
                      aria-haspopup="dialog"
                      title={
                        item.materialCode ||
                        "คลิกเพื่อค้นหารหัส"
                      }
                      onClick={() =>
                        setSelectedRowId(item.id)
                      }
                      className="flex h-9 w-full min-w-0 items-center justify-between overflow-hidden rounded-md border border-input bg-transparent text-left text-sm shadow-xs transition-colors hover:bg-muted/50 focus-visible:border-muted-foreground focus-visible:outline-none"
                    >
                      <span
                        className={`min-w-0 flex-1 truncate px-2 ${
                          item.materialCode
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {item.materialCode ||
                          "ค้นหารหัส"}
                      </span>

                      <span className="flex h-6 w-8 shrink-0 items-center justify-center border-l border-border text-muted-foreground">
                        <Search
                          className="size-4"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                  </TableCell>

                  {/* รายการวัสดุ */}
                  <TableCell className="border-r">
                    <Input
                      aria-label={`ชื่อวัสดุ รายการ ${index + 1}`}
                      value={item.materialName}
                      placeholder="ระบุรายการวัสดุ"
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "materialName",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>

                  {/* จำนวน */}
                  <TableCell className="border-r">
                    <Input
                      aria-label={`จำนวน รายการ ${index + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      className="text-right"
                      value={item.quantity}
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "quantity",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>

                  {/* หน่วย */}
                  <TableCell className="border-r">
                    <Input
                      aria-label={`หน่วย รายการ ${index + 1}`}
                      value={item.unit}
                      placeholder="หน่วย"
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "unit",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>

                  {/* ชำรุด */}
                  <TableCell className="border-r">
                    <Input
                      aria-label={`ชำรุด รายการ ${index + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      className="text-right"
                      value={item.damagedQuantity}
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "damagedQuantity",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>

                  {/* เบิกเพิ่ม */}
                  <TableCell className="border-r">
                    <Input
                      aria-label={`เบิกเพิ่ม รายการ ${index + 1}`}
                      type="number"
                      min="0"
                      step="any"
                      className="text-right"
                      value={item.additionalQuantity}
                      onChange={(event) =>
                        onChange(
                          item.id,
                          "additionalQuantity",
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>

                  {/* ลบรายการ */}
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      aria-label={`ลบรายการที่ ${index + 1}`}
                      disabled={items.length <= 1}
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            ทั้งหมด {items.length} รายการ
          </span>

          <Button
            type="button"
            variant="outline"
            onClick={onAdd}
          >
            <Plus className="size-4" />
            เพิ่มรายการวัสดุ
          </Button>
        </div>
      </SectionCard>

      {/* Modal ค้นหาวัสดุ */}
      {selectedRow && (
        <MaterialIssueStockPickerModal
          key={selectedRow.id}
          selectedCode={selectedRow.materialCode}
          onSelect={handleSelectMaterial}
          onClose={() => setSelectedRowId(null)}
        />
      )}
    </>
  );
}