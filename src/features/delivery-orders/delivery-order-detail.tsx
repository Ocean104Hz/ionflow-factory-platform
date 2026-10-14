"use client";
import Link from "next/link";
import { useState } from "react";
import { Printer, Pencil, Check, X } from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  PageHeader,
  BackButton,
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
} from "@/src/components/factory/patterns";
import {
  ConfirmDialog,
  FormDialog,
} from "@/src/components/factory/confirm-dialog";
import { ItemTable } from "@/src/components/factory/item-table";
import {
  Timeline,
  type TimelineEntry,
} from "@/src/components/factory/timeline";
import { Button } from "@/src/components/ui/button";
import { date, dateTime } from "@/src/lib/formatters";
import type { SalesDocument } from "@/src/lib/mock-data";
export function DeliveryOrderDetail({ id }: { id: string }) {
  const { deliveries, orders, updateDocument } = useDemo();
  const doc = deliveries.find((d) => d.id === id)!;
  const order = orders.find((o) => o.id === doc.orderId)!;
  const [events, setEvents] = useState<TimelineEntry[]>([]);
  const active = doc.status !== "ยกเลิกแล้ว";
  const change = (patch: Partial<SalesDocument>, title: string) => {
    const at = new Date().toISOString();
    updateDocument("delivery", id, { ...patch, updated: at });
    setEvents((previous) => [
      { title, at, description: "บันทึกเฉพาะ demo state · ไม่ส่งระบบจริง" },
      ...previous,
    ]);
  };
  return (
    <>
      <PageHeader
        title={doc.number}
        description="ใบส่งสินค้า · ข้อมูลสาธิต"
        parent={{ title: "ใบส่งสินค้า", href: "/delivery-orders" }}
        actions={
          <>
            <BackButton href="/delivery-orders" />
            <ConfirmDialog
              title="พิมพ์ใบส่งสินค้า · UI demo"
              description="ยังไม่มีเอกสารพิมพ์จริงใน phase นี้"
              trigger={
                <Button variant="outline">
                  <Printer />
                  พิมพ์
                </Button>
              }
              onConfirm={() => change({}, "เปิดตัวอย่างการพิมพ์")}
            />
            <FormDialog
              title="แก้ไขข้อมูลการจัดส่ง"
              description="แก้ไขเฉพาะข้อมูล demo"
              trigger={
                <Button variant="outline" disabled={doc.status !== "ฉบับร่าง"}>
                  <Pencil />
                  แก้ไข
                </Button>
              }
              fields={[
                {
                  name: "driver",
                  label: "ชื่อคนขับ",
                  value: doc.driver,
                  required: true,
                },
                {
                  name: "vehicle",
                  label: "ทะเบียนรถ",
                  value: doc.vehicle,
                  required: true,
                },
                {
                  name: "note",
                  label: "หมายเหตุ",
                  type: "textarea",
                  value: doc.note,
                },
              ]}
              onSubmit={(v) =>
                change(
                  { driver: v.driver, vehicle: v.vehicle, note: v.note },
                  "แก้ไขใบส่งสินค้า",
                )
              }
            />
            <ConfirmDialog
              title="ยืนยันใบส่งสินค้า"
              description="เปลี่ยนเป็นพร้อมส่ง โดยไม่ส่งข้อมูลจริง"
              trigger={
                <Button disabled={doc.status !== "ฉบับร่าง"}>
                  <Check />
                  ยืนยัน
                </Button>
              }
              onConfirm={() =>
                change({ status: "พร้อมส่ง" }, "ยืนยันใบส่งสินค้า")
              }
            />
            <FormDialog
              title="ยกเลิกใบส่งสินค้า"
              description="ต้องระบุเหตุผลการยกเลิก"
              destructive
              trigger={
                <Button variant="outline" disabled={!active}>
                  <X />
                  ยกเลิก
                </Button>
              }
              fields={[
                {
                  name: "reason",
                  label: "เหตุผล",
                  type: "textarea",
                  required: true,
                },
              ]}
              onSubmit={(v) =>
                change(
                  { status: "ยกเลิกแล้ว", note: v.reason },
                  "ยกเลิกใบส่งสินค้า",
                )
              }
            />
          </>
        }
      />
      <SectionCard title="ข้อมูลใบส่งสินค้า">
        <InfoGrid>
          <InfoRow label="เลขที่ใบส่งสินค้า">{doc.number}</InfoRow>
          <InfoRow label="วันที่">{date(doc.date)}</InfoRow>
          <InfoRow label="สถานะ">
            <StatusBadge>{doc.status}</StatusBadge>
          </InfoRow>
          <InfoRow label="อัปเดตล่าสุด">{dateTime(doc.updated)}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="ข้อมูลคำสั่งการผลิต">
        <InfoGrid>
          <InfoRow label="เลขที่คำสั่งการผลิต">
            <Link
              href={`/production-orders/${order.id}`}
              className="text-primary hover:underline"
            >
              {order.number}
            </Link>
          </InfoRow>
          <InfoRow label="Sales Order">{order.salesOrder}</InfoRow>
          <InfoRow label="บริษัทต้นทาง">{order.company}</InfoRow>
          <InfoRow label="คลังสินค้า">{order.warehouse}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="ลูกค้า / ผู้รับ">
        <InfoGrid>
          <InfoRow label="ลูกค้า">{order.customer}</InfoRow>
          <InfoRow label="ผู้รับ">ผู้รับสินค้าสาธิต</InfoRow>
          <InfoRow label="ที่อยู่">อาคารตัวอย่าง เขตสาธิต (สมมติ)</InfoRow>
          <InfoRow label="โทรศัพท์">000-000-0000</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="รายการสินค้า">
        <ItemTable items={order.items} />
      </SectionCard>
      <SectionCard title="ข้อมูลการจัดส่ง">
        <InfoGrid>
          <InfoRow label="ประเภทการส่ง">{doc.deliveryType}</InfoRow>
          <InfoRow label="ชื่อคนขับ">{doc.driver}</InfoRow>
          <InfoRow label="ทะเบียนรถ">{doc.vehicle}</InfoRow>
          <InfoRow label="วันเวลารับสินค้า">{dateTime(order.pickup)}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="หมายเหตุ">
        <p className="leading-relaxed">{doc.note}</p>
      </SectionCard>
      <SectionCard title="ประวัติเอกสาร">
        <Timeline
          entries={[
            ...events,
            {
              title: "สร้างใบส่งสินค้า (จำลอง)",
              at: order.received,
              description: "ผู้ใช้งานสาธิต · สำเร็จ",
            },
          ]}
        />
      </SectionCard>
    </>
  );
}
