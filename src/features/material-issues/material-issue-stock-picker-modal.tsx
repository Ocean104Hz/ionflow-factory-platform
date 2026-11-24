"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Search, X } from "lucide-react";

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

import {
  MOCK_MATERIAL_STOCK,
  type MaterialIssueStockItem,
} from "./material-issue-stock.mock";

type MaterialIssueStockPickerModalProps = {
  selectedCode: string;
  onSelect: (material: MaterialIssueStockItem) => void;
  onClose: () => void;
};

export function MaterialIssueStockPickerModal({
  selectedCode,
  onSelect,
  onClose,
}: MaterialIssueStockPickerModalProps) {
  const titleId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");

  const keyword = search.trim().toLowerCase();

  const filteredMaterials = MOCK_MATERIAL_STOCK.filter(
    (material) =>
      material.materialCode
        .toLowerCase()
        .includes(keyword) ||
      material.materialName
        .toLowerCase()
        .includes(keyword) ||
      material.unit
        .toLowerCase()
        .includes(keyword),
  );

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    searchRef.current?.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-4xl overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="flex min-w-0 max-h-[85vh] flex-col">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold"
            >
              ค้นหารายการวัสดุจากสต็อก
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              เลือกรายการวัสดุที่ต้องการเบิก
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="shrink-0 border-b px-5 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />

            <Input
              ref={searchRef}
              type="search"
              autoComplete="off"
              value={search}
              placeholder="ค้นหารหัส ชื่อวัสดุ หรือหน่วย"
              aria-label="ค้นหารายการวัสดุ"
              className="pl-9 focus-visible:border-muted-foreground focus-visible:ring-0"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            ข้อมูลจากสต็อกวัสดุคงเหลือ FF เดือนตุลาคม 2569 (Mock Data)
          </p>
        </div>

        {/* Stock Table */}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-5">
          <div className="w-full min-w-0 overflow-x-auto rounded-md border">

            <Table className="w-full min-w-150 table-fixed">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    ลำดับ
                  </TableHead>

                  <TableHead className="w-32">
                    รหัสวัสดุ
                  </TableHead>

                  <TableHead>
                    รายการวัสดุ
                  </TableHead>

                  <TableHead className="w-20 text-right">
                    คงเหลือ
                  </TableHead>

                  <TableHead className="w-16 text-center">
                    หน่วย
                  </TableHead>

                  <TableHead className="w-20 text-center">
                    จัดการ
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredMaterials.length > 0 ? (
                  filteredMaterials.map(
                    (material, index) => (
                      <TableRow
                        key={material.id}
                        className={
                          selectedCode === material.materialCode
                            ? "bg-primary/5"
                            : undefined
                        }
                      >
                        {/* ลำดับ */}
                        <TableCell className="text-center">
                          {index + 1}
                        </TableCell>

                        {/* รหัสวัสดุ */}
                        <TableCell className="whitespace-normal wrap-break-word font-medium">
                          {material.materialCode || "-"}
                        </TableCell>

                        {/* รายการวัสดุ */}
                        <TableCell className="whitespace-normal wrap-break-word">
                          {material.materialName}
                        </TableCell>

                        {/* คงเหลือ */}
                        <TableCell className="whitespace-normal wrap-break-word text-right tabular-nums">
                          {material.remainingQuantity.trim() || "-"}
                        </TableCell>

                        {/* หน่วย */}
                        <TableCell className="whitespace-normal wrap-break-word text-center">
                          {material.unit || "-"}
                        </TableCell>

                        {/* ปุ่มเลือก */}
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`เลือก ${material.materialName}`}
                            onClick={() => onSelect(material)}
                          >
                            เลือก
                          </Button>
                        </TableCell>
                      </TableRow>
                    ),
                  )
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      ไม่พบรายการวัสดุที่ค้นหา
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4">
          <span className="text-sm text-muted-foreground">
            ทั้งหมด{" "}
            {filteredMaterials.length.toLocaleString("th-TH")}{" "}
            รายการ
          </span>

          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            ยกเลิก
          </Button>
        </div>
      </div>
    </dialog>
  );
}