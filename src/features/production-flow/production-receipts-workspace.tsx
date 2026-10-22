"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import {
  FactoryDataTable,
  PageHeader,
  SectionCard,
  SelectField,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { inventoryStatuses } from "@/src/features/inventory/inventory-domain";
import { ledgerContext } from "@/src/features/inventory/inventory-ledger-data";
import { operationLocations } from "@/src/features/inventory/inventory-operations-domain";
import {
  receivedQuantity,
  type ProductionFlowErrors,
  type ProductionReceipt,
} from "./production-flow-domain";
import { useProductionFlow } from "./production-flow-provider";
import { ProductionReceiptDialog } from "./production-receipt-document";

export function ProductionReceiptsWorkspace() {
  const flow = useProductionFlow();
  const [receipt, setReceipt] = useState<ProductionReceipt | null>(null);
  const [errors, setErrors] = useState<ProductionFlowErrors>({});
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("form");
  const [view, setView] = useState<ProductionReceipt | null>(null);
  const report = flow.reports.find((row) => row.id === receipt?.reportId);
  const received = report ? receivedQuantity(report.id, flow.receipts) : 0;
  const remaining = Math.max(0, (report?.goodQuantity ?? 0) - received);
  const warehouses = ledgerContext.warehouses.filter(
    (row) => row.siteId === receipt?.siteId,
  );
  const locations = receipt
    ? operationLocations(ledgerContext, receipt.warehouseId)
    : [];
  const sourceOptions = flow.reports
    .filter(
      (row) =>
        row.status === "RECORDED" &&
        (row.id === receipt?.reportId ||
          receivedQuantity(row.id, flow.receipts) < (row.goodQuantity ?? 0)),
    )
    .map((row) => ({
      value: row.id,
      label: `${row.documentNumber} · คงเหลือ ${(row.goodQuantity ?? 0) - receivedQuantity(row.id, flow.receipts)} ${row.unit}`,
    }));
  function chooseReport(reportId: string) {
    try {
      setReceipt(flow.createReceipt(reportId));
      setErrors({});
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิดรายงานไม่ได้");
    }
  }
  function save() {
    if (!receipt) return;
    const result = flow.saveReceipt(receipt);
    setErrors(result.errors);
    if (!result.saved) {
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูล");
      return;
    }
    setReceipt(result.saved);
    setMessage("บันทึกใบรับยอดแบบร่างแล้ว · ยังไม่เปลี่ยนสต็อก");
  }
  function confirm() {
    if (!receipt) return;
    const result = flow.confirmReceipt(receipt);
    setErrors(result.errors);
    if (!result.saved) {
      setMessage("ยืนยันรับยอดไม่ได้ กรุณาตรวจสอบข้อมูล");
      return;
    }
    setReceipt(result.saved);
    setMessage(
      result.duplicate
        ? "รายการนี้เคยลง Stock Ledger แล้ว ระบบไม่ลงซ้ำ"
        : "ยืนยันรับยอดและลง Stock Ledger แล้ว",
    );
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="รับยอดผลิต"
        description="รับ WIP/สินค้าสำเร็จรูปจากรายงานการผลิตเข้าคลังเพียงจุดเดียว"
        actions={<StatusBadge tone="warning">ยืนยันแล้วลง Stock Ledger</StatusBadge>}
      />
      {message && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</p>}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="มุมมองรับยอดผลิต">
          <TabsTrigger value="form">บันทึกใบรับยอด</TabsTrigger>
          <TabsTrigger value="history">ประวัติใบรับยอด</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="space-y-5">
          <SectionCard
            title="รายงานการผลิตต้นทาง"
            subtitle="เลือกได้เฉพาะรายงานที่บันทึกแล้วและยังมียอดเหลือรับ"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/production-reports"><Plus />ไปรายงานการผลิต</Link>
              </Button>
            }
          >
            <SelectField
              label="รายงานการผลิต"
              value={receipt?.reportId ?? "NONE"}
              onChange={(value) => value !== "NONE" && chooseReport(value)}
              options={[
                { value: "NONE", label: sourceOptions.length ? "เลือกรายงาน" : "ยังไม่มีรายงานที่พร้อมรับ" },
                ...sourceOptions,
              ]}
            />
            {errors.source && <p className="mt-2 text-sm text-danger">{errors.source}</p>}
          </SectionCard>
          {receipt && report && (
            <form
              className="space-y-5"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
            >
              {!!Object.keys(errors).length && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  กรุณาตรวจสอบข้อมูลก่อนบันทึกหรือยืนยัน
                </p>
              )}
              <SectionCard
                title={`${receipt.itemCode} · ${receipt.itemName}`}
                subtitle={`ผลิตดี ${report.goodQuantity ?? 0} ${report.unit} · รับแล้ว ${received} ${report.unit} · คงเหลือ ${remaining} ${report.unit}`}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="production-receipt-number">เลขที่ใบรับ</Label>
                    <Input id="production-receipt-number" name="documentNumber" value={receipt.documentNumber} readOnly />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="production-receipt-quantity">จำนวนรับ ({receipt.unit}) *</Label>
                    <Input
                      id="production-receipt-quantity"
                      name="quantity"
                      inputMode="decimal"
                      value={receipt.quantity}
                      onChange={(event) =>
                        setReceipt((current) =>
                          current ? { ...current, quantity: event.target.value } : current,
                        )
                      }
                      readOnly={receipt.status === "CONFIRMED"}
                      aria-invalid={!!errors.quantity}
                    />
                    {errors.quantity && <p className="text-xs text-danger">{errors.quantity}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="production-receipt-lot">Lot *</Label>
                    <Input
                      id="production-receipt-lot"
                      name="lotCode"
                      value={receipt.lotCode}
                      onChange={(event) =>
                        setReceipt((current) =>
                          current ? { ...current, lotCode: event.target.value } : current,
                        )
                      }
                      readOnly={receipt.status === "CONFIRMED"}
                      aria-invalid={!!errors.lotCode}
                    />
                    {errors.lotCode && <p className="text-xs text-danger">{errors.lotCode}</p>}
                  </div>
                  <SelectField
                    label="โรงงาน *"
                    value={receipt.siteId}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(siteId) => {
                      const warehouse = ledgerContext.warehouses.find((row) => row.siteId === siteId);
                      const location = warehouse ? operationLocations(ledgerContext, warehouse.id)[0] ?? "" : "";
                      setReceipt((current) =>
                        current
                          ? {
                              ...current,
                              siteId,
                              warehouseId: warehouse?.id ?? "",
                              locationLabel: location,
                            }
                          : current,
                      );
                    }}
                    options={ledgerContext.sites.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))}
                  />
                  <SelectField
                    label="คลังสินค้า *"
                    value={receipt.warehouseId}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(warehouseId) =>
                      setReceipt((current) =>
                        current
                          ? {
                              ...current,
                              warehouseId,
                              locationLabel:
                                operationLocations(ledgerContext, warehouseId)[0] ?? "",
                            }
                          : current,
                      )
                    }
                    options={warehouses.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))}
                  />
                  <SelectField
                    label="ตำแหน่งจัดเก็บ *"
                    value={receipt.locationLabel}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(locationLabel) =>
                      setReceipt((current) =>
                        current ? { ...current, locationLabel } : current,
                      )
                    }
                    options={locations.map((value) => ({ value, label: value }))}
                  />
                  <SelectField
                    label="สถานะสินค้า *"
                    value={receipt.inventoryStatus}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(inventoryStatus) =>
                      setReceipt((current) =>
                        current
                          ? {
                              ...current,
                              inventoryStatus:
                                inventoryStatus as ProductionReceipt["inventoryStatus"],
                            }
                          : current,
                      )
                    }
                    options={(["AVAILABLE", "QC_HOLD"] as const).map((value) => ({ value, label: inventoryStatuses[value] }))}
                  />
                </div>
              </SectionCard>
              <SectionCard title="หมายเหตุ">
                <Label htmlFor="production-receipt-note" className="sr-only">หมายเหตุ</Label>
                <Textarea
                  id="production-receipt-note"
                  name="note"
                  value={receipt.note}
                  onChange={(event) =>
                    setReceipt((current) =>
                      current ? { ...current, note: event.target.value } : current,
                    )
                  }
                  readOnly={receipt.status === "CONFIRMED"}
                />
              </SectionCard>
              <div className="flex flex-wrap justify-end gap-2">
                {receipt.status === "DRAFT" ? (
                  <>
                    <Button type="submit" variant="outline">บันทึกแบบร่าง</Button>
                    <ConfirmDialog
                      title="ยืนยันรับยอดและลง Stock Ledger?"
                      description={`${receipt.documentNumber} · ${receipt.quantity || 0} ${receipt.unit} · เมื่อยืนยันแล้วแก้ไขไม่ได้`}
                      onConfirm={confirm}
                      trigger={<Button type="button">ยืนยันรับยอด</Button>}
                    />
                  </>
                ) : (
                  <StatusBadge tone="success">ยืนยันรับแล้ว</StatusBadge>
                )}
              </div>
            </form>
          )}
        </TabsContent>
        <TabsContent value="history">
          <SectionCard title="ประวัติใบรับยอดผลิต" subtitle="รายการยืนยันแล้วแก้ไขไม่ได้และมี Ledger event อ้างอิง">
            <FactoryDataTable
              rows={flow.receipts}
              rowKey={(row) => row.id}
              minWidth={900}
              columns={[
                { key: "number", label: "เลขที่", render: (row) => row.documentNumber },
                { key: "item", label: "สินค้า", render: (row) => `${row.itemCode} · ${row.itemName}` },
                { key: "lot", label: "Lot", render: (row) => row.lotCode },
                { key: "quantity", label: "จำนวน", numeric: true, render: (row) => `${row.quantity} ${row.unit}` },
                { key: "status", label: "สถานะ", render: (row) => <StatusBadge tone={row.status === "CONFIRMED" ? "success" : "neutral"}>{row.status === "CONFIRMED" ? "ยืนยันรับแล้ว" : "แบบร่าง"}</StatusBadge> },
                {
                  key: "actions",
                  label: "จัดการ",
                  render: (row) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`ดู ${row.documentNumber}`} onClick={() => setView(row)}><Eye /></Button>
                      {row.status === "DRAFT" && (
                        <Button variant="ghost" size="icon" aria-label={`แก้ไข ${row.documentNumber}`} onClick={() => { setReceipt(structuredClone(row)); setErrors({}); setTab("form"); }}><Pencil /></Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
      <ProductionReceiptDialog receipt={view} onClose={() => setView(null)} />
    </div>
  );
}
