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
  createStockWipMockSheets,
} from "@/src/lib/mock-data/stock_wip_ff";

import type {
  StockWipRow,
} from "@/src/features/stock_wip_ff/stock_wip_ff_domain";

type MaterialIssueProductPickerModalProps = {
  selectedName: string;
  onSelect: (product: StockWipRow) => void;
  onClose: () => void;
};

export function MaterialIssueProductPickerModal({
  selectedName,
  onSelect,
  onClose,
}: MaterialIssueProductPickerModalProps) {
  const titleId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");

  const [products] = useState<StockWipRow[]>(() => {
    const sheets = createStockWipMockSheets();

    const latestSheet = sheets
      .filter((sheet) => sheet.period.view === "MONTH")
      .sort((a, b) => b.id.localeCompare(a.id))[0];

    return latestSheet?.rows ?? [];
  });

  const keyword = search.trim().toLowerCase();

  const filteredProducts = products.filter((row) =>
    [
      row.item.code_new,
      row.item.code_old ?? "",
      row.item.name,
    ].some((value) =>
      value.toLowerCase().includes(keyword),
    ),
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
      <div className="flex max-h-[85vh] flex-col">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold"
            >
              ค้นหาผลิตภัณฑ์จากสต็อก
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              เลือกผลิตภัณฑ์สำหรับใบเบิกจ่ายวัสดุ
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
              placeholder="ค้นหารหัสหรือชื่อผลิตภัณฑ์"
              aria-label="ค้นหาผลิตภัณฑ์"
              className="pl-9 focus-visible:border-muted-foreground focus-visible:ring-0"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            ข้อมูลจากสต็อกสินค้า
          </p>
        </div>

        {/* Product Table */}
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-162.5">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-16 text-center">
                    ลำดับ
                  </TableHead>

                  <TableHead className="w-32">
                    รหัสสินค้า
                  </TableHead>

                  <TableHead className="min-w-60">
                    ชื่อผลิตภัณฑ์
                  </TableHead>

                  <TableHead className="w-28 text-right">
                    คงเหลือ
                  </TableHead>

                  <TableHead className="w-24 text-center">
                    หน่วย
                  </TableHead>

                  <TableHead className="w-24 text-center">
                    จัดการ
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((row, index) => (
                    <TableRow
                      key={row.item.code_new}
                      className={
                        selectedName === row.item.name.trim()
                          ? "bg-primary/5"
                          : undefined
                      }
                    >
                      <TableCell className="text-center">
                        {index + 1}
                      </TableCell>

                      <TableCell className="font-medium">
                        {row.item.code_new || "-"}
                      </TableCell>

                      <TableCell className="whitespace-normal">
                        {row.item.name.trim()}
                      </TableCell>

                      <TableCell className="text-right tabular-nums">
                        {row.summary.closing_balance || "-"}
                      </TableCell>

                      {/* <TableCell className="text-center">
                        {row.item.unit || "-"}
                      </TableCell> */}

                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelect(row)}
                        >
                          เลือก
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-28 text-center text-muted-foreground"
                    >
                      ไม่พบผลิตภัณฑ์ที่ค้นหา
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Total Products */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3">
          <span className="text-sm text-muted-foreground">
            ทั้งหมด{" "}
            {filteredProducts.length.toLocaleString("th-TH")}{" "}
            รายการ
          </span>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t px-5 py-4">
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