"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { FactoryDataTable, PageHeader, SectionCard, SelectField, StatusBadge } from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { inventoryStatuses } from "@/src/features/inventory/inventory-domain";
import { ledgerContext } from "@/src/features/inventory/inventory-ledger-data";
import { operationLocations } from "@/src/features/inventory/inventory-operations-domain";
import { receivedQuantity, type ProductionFlowErrors, type ProductionReceipt } from "./production-flow-domain";
import { useProductionFlow } from "./production-flow-provider";
import { ProductionReceiptDialog } from "./production-receipt-document";

function formatDocumentDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function siteLabel(siteId: string) {
  const site = ledgerContext.sites.find((row) => row.id === siteId);
  return site ? `${site.code} · ${site.name}` : siteId || "—";
}

function warehouseLabel(warehouseId: string) {
  const warehouse = ledgerContext.warehouses.find((row) => row.id === warehouseId);
  return warehouse ? `${warehouse.code} · ${warehouse.name}` : warehouseId || "—";
}

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
  const warehouses = ledgerContext.warehouses.filter((row) => row.siteId === receipt?.siteId);
  const locations = receipt ? operationLocations(ledgerContext, receipt.warehouseId) : [];
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
        title="ใบรับยอดผลิต"
        description="จัดทำเอกสารรับ WIP/สินค้าสำเร็จรูปจากรายงานการผลิตเข้าคลัง"
        actions={<StatusBadge tone="warning">ยืนยันแล้วลง Stock Ledger</StatusBadge>}
      />

      {message && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</p>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="มุมมองใบรับยอดผลิต" className="mx-auto grid h-11 w-full max-w-lg grid-cols-2 rounded-full p-1">
          <TabsTrigger value="form" className="h-9 rounded-full px-4">สร้างใบรับยอดผลิต</TabsTrigger>
          <TabsTrigger value="history" className="h-9 rounded-full px-4">ประวัติใบรับยอดผลิต</TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-5">
          <SectionCard
            title="รายงานการผลิตต้นทาง"
            subtitle="เลือกได้เฉพาะรายงานที่บันทึกแล้วและยังมียอดเหลือรับ"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/production-reports"><Plus aria-hidden="true" />ไปรายงานการผลิต</Link>
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
                title="ส่วนหัวเอกสาร"
                subtitle="โครงเอกสารอ้างอิงจาก iTECH โดยคงกติกาเลขที่เอกสารของ Factory"
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <SelectField
                    label="สถานที่ *"
                    value={receipt.siteId}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(siteId) => {
                      const warehouse = ledgerContext.warehouses.find((row) => row.siteId === siteId);
                      const location = warehouse ? operationLocations(ledgerContext, warehouse.id)[0] ?? "" : "";
                      setReceipt((current) =>
                        current
                          ? { ...current, siteId, warehouseId: warehouse?.id ?? "", locationLabel: location }
                          : current,
                      );
                    }}
                    options={ledgerContext.sites.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))}
                  />

                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="production-receipt-date">วันที่เอกสาร</Label>
                    <Input
                      id="production-receipt-date"
                      value={formatDocumentDate(receipt.createdAt || receipt.confirmedAt)}
                      placeholder="บันทึกอัตโนมัติเมื่อบันทึกแบบร่าง"
                      readOnly
                      className="bg-muted/35"
                    />
                    <p className="text-xs text-muted-foreground">ใช้วันเวลาที่ระบบบันทึกเอกสาร ไม่เพิ่มข้อมูลวันที่ใหม่</p>
                  </div>

                  <div className="grid min-w-0 gap-2">
                    <Label htmlFor="production-receipt-number">เอกสารเลขที่</Label>
                    <Input
                      id="production-receipt-number"
                      name="documentNumber"
                      value={receipt.documentNumber}
                      readOnly
                      className="bg-muted/35 font-medium"
                    />
                    <p className="text-xs text-muted-foreground">สร้างตามกติกาเลขเอกสารของ Factory</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="ข้อมูลปลายทางคลัง"
                subtitle="ระบุคลัง ตำแหน่งจัดเก็บ และสถานะสินค้าที่จะรับเข้า"
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <SelectField
                    label="คลังสินค้า *"
                    value={receipt.warehouseId}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(warehouseId) =>
                      setReceipt((current) =>
                        current
                          ? { ...current, warehouseId, locationLabel: operationLocations(ledgerContext, warehouseId)[0] ?? "" }
                          : current,
                      )
                    }
                    options={warehouses.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }))}
                  />
                  <SelectField
                    label="ตำแหน่งจัดเก็บ *"
                    value={receipt.locationLabel}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(locationLabel) => setReceipt((current) => current ? { ...current, locationLabel } : current)}
                    options={locations.map((value) => ({ value, label: value }))}
                  />
                  <SelectField
                    label="สถานะสินค้า *"
                    value={receipt.inventoryStatus}
                    disabled={receipt.status === "CONFIRMED"}
                    onChange={(inventoryStatus) =>
                      setReceipt((current) =>
                        current
                          ? { ...current, inventoryStatus: inventoryStatus as ProductionReceipt["inventoryStatus"] }
                          : current,
                      )
                    }
                    options={(["AVAILABLE", "QC_HOLD"] as const).map((value) => ({ value, label: inventoryStatuses[value] }))}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="รายการรับยอดการผลิต"
                subtitle={`ผลิตดี ${report.goodQuantity ?? 0} ${report.unit} · รับแล้ว ${received} ${report.unit} · คงเหลือ ${remaining} ${report.unit}`}
                contentClassName="px-0"
              >
                <div
                  role="region"
                  tabIndex={0}
                  aria-label="ตารางรายละเอียดใบรับยอดผลิต เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"
                  className="overflow-x-auto"
                >
                  <Table className="min-w-[860px]">
                    <TableHeader className="bg-surface-muted">
                      <TableRow>
                        <TableHead className="w-16 px-5 text-center">No.</TableHead>
                        <TableHead className="min-w-56">รายการ</TableHead>
                        <TableHead className="min-w-40">รหัสสินค้า</TableHead>
                        <TableHead className="min-w-44">จำนวนรับ</TableHead>
                        <TableHead className="min-w-28">หน่วยนับ</TableHead>
                        <TableHead className="min-w-44 pr-5">Lot</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="px-5 text-center text-muted-foreground">1</TableCell>
                        <TableCell className="font-medium">{receipt.itemName}</TableCell>
                        <TableCell>{receipt.itemCode}</TableCell>
                        <TableCell className="align-top">
                          <Label htmlFor="production-receipt-quantity" className="sr-only">จำนวนรับ ({receipt.unit})</Label>
                          <Input
                            id="production-receipt-quantity"
                            name="quantity"
                            inputMode="decimal"
                            value={receipt.quantity}
                            onChange={(event) => setReceipt((current) => current ? { ...current, quantity: event.target.value } : current)}
                            readOnly={receipt.status === "CONFIRMED"}
                            aria-invalid={!!errors.quantity}
                            aria-describedby={errors.quantity ? "production-receipt-quantity-error" : undefined}
                            className="min-w-36"
                          />
                          {errors.quantity && (
                            <p id="production-receipt-quantity-error" className="mt-1.5 whitespace-normal text-xs text-danger">
                              {errors.quantity}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{receipt.unit}</TableCell>
                        <TableCell className="align-top pr-5">
                          <Label htmlFor="production-receipt-lot" className="sr-only">Lot</Label>
                          <Input
                            id="production-receipt-lot"
                            name="lotCode"
                            value={receipt.lotCode}
                            onChange={(event) => setReceipt((current) => current ? { ...current, lotCode: event.target.value } : current)}
                            readOnly={receipt.status === "CONFIRMED"}
                            aria-invalid={!!errors.lotCode}
                            aria-describedby={errors.lotCode ? "production-receipt-lot-error" : undefined}
                            className="min-w-36"
                          />
                          {errors.lotCode && (
                            <p id="production-receipt-lot-error" className="mt-1.5 whitespace-normal text-xs text-danger">
                              {errors.lotCode}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </SectionCard>

              <SectionCard title="หมายเหตุ">
                <Label htmlFor="production-receipt-note" className="sr-only">หมายเหตุ</Label>
                <Textarea
                  id="production-receipt-note"
                  name="note"
                  value={receipt.note}
                  onChange={(event) => setReceipt((current) => current ? { ...current, note: event.target.value } : current)}
                  readOnly={receipt.status === "CONFIRMED"}
                  placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                  className="min-h-28 resize-y bg-surface"
                />
              </SectionCard>

              <section aria-label="การดำเนินการเอกสาร" className="rounded-xl border bg-surface px-5 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">สถานะเอกสาร</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <StatusBadge tone={receipt.status === "CONFIRMED" ? "success" : "neutral"}>
                        {receipt.status === "CONFIRMED" ? "ยืนยันรับแล้ว" : "แบบร่าง"}
                      </StatusBadge>
                      <span>
                        {receipt.status === "CONFIRMED"
                          ? "เอกสารนี้เป็นแบบอ่านอย่างเดียว"
                          : "การบันทึกแบบร่างยังไม่เปลี่ยนสต็อก"}
                      </span>
                    </div>
                  </div>

                  {receipt.status === "DRAFT" && (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button type="submit" variant="outline">บันทึกแบบร่าง</Button>
                      <ConfirmDialog
                        title="ยืนยันรับยอดและลง Stock Ledger?"
                        description={`${receipt.documentNumber} · ${receipt.quantity || 0} ${receipt.unit} · เมื่อยืนยันแล้วแก้ไขไม่ได้`}
                        onConfirm={confirm}
                        trigger={<Button type="button">ยืนยันรับยอด</Button>}
                      />
                    </div>
                  )}
                </div>
              </section>
            </form>
          )}
        </TabsContent>

        <TabsContent value="history">
          <SectionCard
            title="ประวัติใบรับยอดผลิต"
            subtitle="แสดงข้อมูลสถานที่และคลังจริงของ Factory · เอกสารที่ยืนยันแล้วแก้ไขไม่ได้"
            contentClassName="space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/25 px-4 py-3 text-sm">
              <span className="font-medium">ข้อมูลที่บันทึก</span>
              <span className="text-muted-foreground">ทั้งหมด {flow.receipts.length.toLocaleString("th-TH")} รายการ</span>
            </div>
            <FactoryDataTable
              rows={flow.receipts}
              rowKey={(row) => row.id}
              minWidth={1120}
              columns={[
                {
                  key: "number",
                  label: "เลขที่เอกสาร",
                  render: (row) => <span className="font-medium">{row.documentNumber}</span>,
                },
                {
                  key: "date",
                  label: "วันที่",
                  render: (row) => formatDocumentDate(row.createdAt || row.confirmedAt || row.updatedAt) || "—",
                },
                {
                  key: "destination",
                  label: "สถานที่ / คลัง",
                  render: (row) => (
                    <div className="min-w-56 whitespace-normal">
                      <p>{siteLabel(row.siteId)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{warehouseLabel(row.warehouseId)} · {row.locationLabel || "—"}</p>
                    </div>
                  ),
                },
                {
                  key: "item",
                  label: "สินค้า",
                  render: (row) => (
                    <div className="min-w-52 whitespace-normal">
                      <p>{row.itemName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.itemCode}</p>
                    </div>
                  ),
                },
                { key: "lot", label: "Lot", render: (row) => row.lotCode },
                { key: "quantity", label: "จำนวนรับ", numeric: true, render: (row) => `${row.quantity} ${row.unit}` },
                {
                  key: "status",
                  label: "สถานะ",
                  render: (row) => (
                    <StatusBadge tone={row.status === "CONFIRMED" ? "success" : "neutral"}>
                      {row.status === "CONFIRMED" ? "ยืนยันรับแล้ว" : "แบบร่าง"}
                    </StatusBadge>
                  ),
                },
                {
                  key: "actions",
                  label: "จัดการ",
                  render: (row) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`ดู ${row.documentNumber}`} onClick={() => setView(row)}>
                        <Eye aria-hidden="true" />
                      </Button>
                      {row.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`แก้ไข ${row.documentNumber}`}
                          onClick={() => {
                            setReceipt(structuredClone(row));
                            setErrors({});
                            setTab("form");
                          }}
                        >
                          <Pencil aria-hidden="true" />
                        </Button>
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
