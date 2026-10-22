"use client";

import { useId, useState, type HTMLInputTypeAttribute } from "react";
import {
  AlertCircle,
  ClipboardList,
  FileText,
  History,
} from "lucide-react";
import { SectionCard } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useSettingsPostgres } from "@/src/components/factory/use-settings-postgres";
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
  type ReceiptGroupV1,
} from "./production-receipt-v1-types";
import { ProductionReceiptV1Table } from "./production-receipt-v1-table";

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

  const {
    state: settings,
    loading: unitsLoading,
    loadError: unitsError,
    retry: retryUnits,
  } = useSettingsPostgres();

  const unitOptions = settings.rows
    .filter((row) => row.kind === "units" && row.active)
    .map((row) => ({
      value: row.name,
      label: `${row.code} · ${row.name}`,
    }));

  const groupKeys = {
    P1: "p1Items",
    P2: "p2Items",
    MOLDING: "moldingItems",
  } as const;

  function updateItem(
    group: ReceiptGroupV1,
    id: string,
    patch: Partial<ReceiptItemV1>,
  ) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]: current[key].map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addItem(group: ReceiptGroupV1) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]: [...current[key], newReceiptItemV1()],
    }));
  }

  function removeItem(group: ReceiptGroupV1, id: string) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]:
        current[key].length > 1
          ? current[key].filter((item) => item.id !== id)
          : current[key],
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

          {unitsLoading && (
            <div
              role="status"
              className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
            >
              กำลังโหลดหน่วยนับจากตั้งค่าระบบ...
            </div>
          )}

          {unitsError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
              <p className="text-sm text-destructive">
                โหลดหน่วยนับไม่สำเร็จ: {unitsError}
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryUnits}
              >
                ลองใหม่
              </Button>
            </div>
          )}

          {!unitsLoading && !unitsError && unitOptions.length === 0 && (
            <p
              role="status"
              className="rounded-lg border p-3 text-sm text-muted-foreground"
            >
              ยังไม่มีหน่วยนับที่เปิดใช้งาน กรุณาเพิ่มข้อมูลในตั้งค่าระบบ
            </p>
          )}

          <ProductionReceiptV1Table
            title="กระสอบปุ๋ยอินทรีย์ / สารปรับสภาพดิน (P1)"
            items={doc.p1Items}
            unitOptions={unitOptions}
            onAdd={() => addItem("P1")}
            onRemove={(id) => removeItem("P1", id)}
            onUpdate={(id, patch) => updateItem("P1", id, patch)}
          />

          <ProductionReceiptV1Table
            title="กระสอบปุ๋ยอินทรีย์ / สารปรับสภาพดิน (P2)"
            items={doc.p2Items}
            unitOptions={unitOptions}
            onAdd={() => addItem("P2")}
            onRemove={(id) => removeItem("P2", id)}
            onUpdate={(id, patch) => updateItem("P2", id, patch)}
          />

          <ProductionReceiptV1Table
            title="ยอดผลิตปั้น"
            items={doc.moldingItems}
            unitOptions={unitOptions}
            onAdd={() => addItem("MOLDING")}
            onRemove={(id) => removeItem("MOLDING", id)}
            onUpdate={(id, patch) => updateItem("MOLDING", id, patch)}
          />

          <SectionCard title="สรุปรายการรับยอดผลิต">
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  {
                    label: "P1 รวม",
                    items: doc.p1Items,
                  },
                  {
                    label: "P2 รวม",
                    items: doc.p2Items,
                  },
                  {
                    label: "ยอดผลิตปั้น รวม",
                    items: doc.moldingItems,
                  },
                ] as const
              ).map(({ label, items }) => {
                const total = items.reduce((sum, item) => {
                  const qty = Number(item.quantity);

                  return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
                }, 0);

                return (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-muted/20 p-5"
                  >
                    <p className="text-sm text-muted-foreground">{label}</p>

                    <p className="mt-3 text-2xl font-semibold tabular-nums">
                      {total.toLocaleString("th-TH")}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      รวมจำนวนตามรายการที่กรอก
                    </p>
                  </div>
                );
              })}
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
              <History
                aria-hidden="true"
                className="size-8 text-muted-foreground"
              />
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
