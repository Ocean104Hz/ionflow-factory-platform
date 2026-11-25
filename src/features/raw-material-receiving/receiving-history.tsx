"use client";

import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { FactoryDataTable, Pagination, RefreshButton, type Column } from "@/src/components/factory/patterns";
import { warehouseRequest } from "@/src/features/inventory/warehouse-client";
import { formatThaiBuddhistDate } from "./document-number";
import type { SavedReceivingDocument } from "./receiving-mock-store";

const pageSize = 10;

export function ReceivingHistory({ onOpen }: { onOpen: (document: SavedReceivingDocument) => void }) {
  const [result, setResult] = useState<{ records?: SavedReceivingDocument[]; error?: string }>({});
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const controller = new AbortController();
    warehouseRequest<SavedReceivingDocument[]>("receiving", undefined, undefined, controller.signal)
      .then((records) => { if (!controller.signal.aborted) setResult({ records }); })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ error: error instanceof Error ? error.message : "โหลดประวัติใบรับไม่สำเร็จ" });
      });
    return () => controller.abort();
  }, [revision]);

  function refresh() {
    setResult({});
    setRevision((current) => current + 1);
  }

  const keyword = search.trim().toLowerCase();
  const filtered = (result.records ?? []).filter(({ header }) =>
    [header.documentNo, header.supplierName, header.supplierCode, header.warehouseCode, header.poNo]
      .some((value) => value.toLowerCase().includes(keyword)),
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const columns: Column<SavedReceivingDocument>[] = [
    { key: "number", label: "เลขที่ใบรับ", render: ({ header }) => <span className="font-medium">{header.documentNo}</span> },
    { key: "date", label: "วันที่รับเข้า", render: ({ header }) => formatThaiBuddhistDate(header.receiveDate) || "—" },
    { key: "supplier", label: "ผู้จำหน่าย", render: ({ header }) => header.supplierName },
    { key: "warehouse", label: "รหัสคลัง", render: ({ header }) => header.warehouseCode },
    { key: "po", label: "เลข PO", render: ({ header }) => header.poNo || "—" },
    { key: "total", label: "มูลค่ารวม (บาท)", numeric: true, render: (row) => row.amountTotal },
    {
      key: "action",
      label: "จัดการ",
      render: (row) => (
        <ConfirmDialog
          title="เปิดใบรับเดิมเพื่อแก้ไข?"
          description="ข้อมูลที่ยังไม่บันทึกในแบบฟอร์มปัจจุบันจะถูกแทนที่"
          onConfirm={() => onOpen(row)}
          trigger={<Button type="button" variant="outline" size="sm" aria-label={`เปิดใบรับ ${row.header.documentNo}`}>เปิดใบรับ</Button>}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid w-full gap-2 sm:max-w-md">
          <Label htmlFor="receiving-history-search">ค้นหาใบรับ</Label>
          <Input
            id="receiving-history-search"
            placeholder="เลขที่ใบรับ ผู้จำหน่าย รหัสคลัง หรือเลข PO"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
        </div>
        <RefreshButton onClick={refresh} />
      </div>
      {result.error && <p role="alert" className="text-destructive">{result.error}</p>}
      <FactoryDataTable
        columns={columns}
        rows={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
        rowKey={(row) => row.header.documentNo}
        minWidth={780}
        state={result.error ? "error" : result.records ? "normal" : "loading"}
        retry={refresh}
        pagination={filtered.length > 0 ? <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onChange={setPage} /> : undefined}
      />
    </div>
  );
}
