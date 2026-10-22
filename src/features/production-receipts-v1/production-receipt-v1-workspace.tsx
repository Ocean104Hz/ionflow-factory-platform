"use client";

import { useId, useState, type HTMLInputTypeAttribute } from "react";
import {
  AlertCircle,
  ClipboardList,
  FileText,
  History,
  Plus,
  Trash2,
} from "lucide-react";
import { SectionCard } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import {
  newReceiptDocumentV1,
  newReceiptItemV1,
  type ReceiptDocumentV1,
  type ReceiptItemV1,
} from "./production-receipt-v1-types";

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  readOnly?: boolean;
}) {
  const id = useId();

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={readOnly ? "bg-muted/40" : "bg-background"}
      />
    </div>
  );
}

export function ProductionReceiptV1Workspace() {
  const [tab, setTab] = useState<"form" | "history">("form");
  const [doc, setDoc] = useState<ReceiptDocumentV1>(newReceiptDocumentV1);

  function updateDocument(patch: Partial<ReceiptDocumentV1>) {
    setDoc((current) => ({ ...current, ...patch }));
  }

  function updateItem(id: string, patch: Partial<ReceiptItemV1>) {
    setDoc((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addItem() {
    setDoc((current) => ({
      ...current,
      items: [...current.items, newReceiptItemV1()],
    }));
  }

  function removeItem(id: string) {
    setDoc((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((item) => item.id !== id)
          : current.items,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            ใบรับยอดผลิต V1
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production Receipt · รูปแบบเอกสาร iTECH
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium">
          UI DRAFT
        </span>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "form" | "history")}
        className="space-y-5"
      >
        <div className="flex justify-center">
          <TabsList className="h-auto w-full max-w-xl rounded-full border border-border bg-card p-1 shadow-sm">
            <TabsTrigger
              value="form"
              className="h-11 flex-1 gap-2 rounded-full px-4 text-sm"
            >
              <ClipboardList aria-hidden="true" className="size-4" />
              สร้างใบรับยอดผลิต
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="h-11 flex-1 gap-2 rounded-full px-4 text-sm"
            >
              <History aria-hidden="true" className="size-4" />
              ประวัติใบรับยอดผลิต
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="form" className="space-y-5">
          <SectionCard title="ใบรับยอดผลิต">
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="สถานที่"
                value={doc.location}
                onChange={(location) => updateDocument({ location })}
                placeholder="เลือกสถานที่ผลิต"
              />
              <Field
                label="วันที่เอกสาร"
                type="date"
                value={doc.documentDate}
                onChange={(documentDate) => updateDocument({ documentDate })}
              />
              <Field
                label="เอกสารเลขที่"
                value={doc.documentNumber}
                readOnly
                placeholder="รอเชื่อมระบบสร้างเลขเอกสาร"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="เอกสารอ้างอิง"
            subtitle="เตรียมเชื่อมกับใบสั่งผลิตสินค้า V1 ของ iTECH"
          >
            <Field
              label="ใบสั่งผลิตที่อ้างอิง"
              value={doc.productionOrderNumber}
              readOnly
              placeholder="ยังไม่ได้เชื่อมใบสั่งผลิต"
            />
          </SectionCard>

          <SectionCard
            title="รายละเอียดวัสดุ / สินค้า"
            subtitle="โครงตารางตามใบรับยอดผลิต iTECH"
          >
            <div
              role="region"
              tabIndex={0}
              aria-label="ตารางรายละเอียดใบรับยอดผลิต V1 เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"
              className="rounded-lg border border-border"
            >
              <Table className="min-w-[1100px] border-collapse">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className="h-auto w-14 border-r p-3 text-center"
                    >
                      No.
                    </TableHead>
                    <TableHead
                      colSpan={2}
                      className="h-auto border-r p-3 text-center"
                    >
                      รายละเอียดวัสดุ
                    </TableHead>
                    <TableHead rowSpan={2} className="h-auto border-r p-3">
                      จำนวน
                    </TableHead>
                    <TableHead rowSpan={2} className="h-auto border-r p-3">
                      หน่วยนับ
                    </TableHead>
                    <TableHead rowSpan={2} className="h-auto border-r p-3">
                      Lot
                    </TableHead>
                    <TableHead rowSpan={2} className="h-auto border-r p-3">
                      หมายเหตุ
                    </TableHead>
                    <TableHead rowSpan={2} className="h-auto w-14 p-3">
                      <span className="sr-only">จัดการ</span>
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="h-auto border-r p-3 text-left">
                      รายการ
                    </TableHead>
                    <TableHead className="h-auto border-r p-3 text-left">
                      ขนาด (kg)
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {doc.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="border-r p-2 text-center">
                        {index + 1}
                      </TableCell>
                      <TableCell className="min-w-56 border-r p-2">
                        <Input
                          aria-label={`รายการ ${index + 1}`}
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.id, { name: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-32 border-r p-2">
                        <Input
                          aria-label={`ขนาด ${index + 1}`}
                          type="number"
                          min="0"
                          step="any"
                          value={item.sizeKg}
                          onChange={(event) =>
                            updateItem(item.id, { sizeKg: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-32 border-r p-2">
                        <Input
                          aria-label={`จำนวน ${index + 1}`}
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, { quantity: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-32 border-r p-2">
                        <Input
                          aria-label={`หน่วย ${index + 1}`}
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(item.id, { unit: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-36 border-r p-2">
                        <Input
                          aria-label={`Lot ${index + 1}`}
                          value={item.lot}
                          onChange={(event) =>
                            updateItem(item.id, { lot: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="min-w-40 border-r p-2">
                        <Input
                          aria-label={`หมายเหตุ ${index + 1}`}
                          value={item.note}
                          onChange={(event) =>
                            updateItem(item.id, { note: event.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="p-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`ลบรายการ ${index + 1}`}
                          disabled={doc.items.length === 1}
                          onClick={() => removeItem(item.id)}
                          className="size-11"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                จำนวนรายการ: {doc.items.length}
              </p>
              <Button type="button" variant="outline" onClick={addItem}>
                <Plus aria-hidden="true" className="size-4" />
                เพิ่มรายการ
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="รายละเอียดการผลิต"
            subtitle="รอข้อมูลจริงจากใบสั่งผลิตและรายงานการผลิต iTECH"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="P1 รวม" value={doc.p1Total} readOnly placeholder="รอข้อมูลต้นทาง" />
              <Field label="P2 รวม" value={doc.p2Total} readOnly placeholder="รอข้อมูลต้นทาง" />
              <Field label="ยอดผลิตปั้น รวม" value={doc.moldingTotal} readOnly placeholder="รอข้อมูลต้นทาง" />
            </div>
          </SectionCard>

          <SectionCard title="รายชื่อผู้ลงนาม">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="เจ้าหน้าที่คลังสินค้า / จ่ายสินค้า"
                value={doc.warehouseOfficer}
                onChange={(warehouseOfficer) =>
                  updateDocument({ warehouseOfficer })
                }
                placeholder="ชื่อผู้รับผิดชอบ"
              />
              <Field
                label="ผู้ตรวจสอบ (เจ้าหน้าที่คลังสินค้า)"
                value={doc.inspector}
                onChange={(inspector) => updateDocument({ inspector })}
                placeholder="ชื่อผู้ตรวจสอบ"
              />
            </div>
          </SectionCard>

          <SectionCard title="หมายเหตุ">
            <Label htmlFor="production-receipt-v1-note" className="sr-only">
              หมายเหตุ
            </Label>
            <Textarea
              id="production-receipt-v1-note"
              value={doc.note}
              onChange={(event) => updateDocument({ note: event.target.value })}
              placeholder="รายละเอียดเพิ่มเติม..."
              className="min-h-28"
            />
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle aria-hidden="true" className="size-4" />
              หน้านี้ยังไม่บันทึกข้อมูลจริง
            </p>
            <Button type="button" disabled>
              <FileText aria-hidden="true" className="size-4" />
              บันทึก (รอเชื่อม PostgreSQL)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <SectionCard title="ประวัติใบรับยอดผลิต V1">
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <History aria-hidden="true" className="size-8 text-muted-foreground" />
              <p className="font-medium">ยังไม่มีประวัติใบรับยอดผลิต V1</p>
              <p className="text-sm text-muted-foreground">
                ตารางประวัติจะเปิดใช้งานเมื่อมีระบบบันทึกข้อมูล V1
              </p>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
