"use client";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import Link from "next/link";
import { useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  BackButton,
  InfoGrid,
  InfoRow,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/src/components/factory/patterns";
import {
  ConfirmDialog,
  FormDialog,
} from "@/src/components/factory/confirm-dialog";
import { ItemTable } from "@/src/components/factory/item-table";
import { Button } from "@/src/components/ui/button";
import { Separator } from "@/src/components/ui/separator";
import { money, date, dateTime } from "@/src/lib/formatters";
import { total } from "@/src/lib/mock-data";
export function InvoiceDetail({ id }: { id: string }) {
  const { invoices, orders, updateDocument } = useDemo();
  const invoice = invoices.find((d) => d.id === id)!;
  const order = orders.find((o) => o.id === invoice.orderId)!;
  const [notice, setNotice] = useState("");
  const subtotal = total(order.items);
  const taxable = subtotal - invoice.discount;
  const tax = taxable * 0.07;
  return (
    <>
      <PageHeader
        title={invoice.number}
        description="ใบแจ้งหนี้ · เอกสารและยอดเงินสมมติ"
        parent={{ title: "ใบแจ้งหนี้", href: "/invoices" }}
        actions={
          <>
            <BackButton href="/invoices" />
            <ConfirmDialog
              title="พิมพ์ใบแจ้งหนี้ · UI demo"
              description="ยังไม่มีเอกสารพิมพ์จริงใน phase นี้"
              trigger={
                <Button variant="outline">
                  <Printer />
                  พิมพ์
                </Button>
              }
              onConfirm={() =>
                setNotice("ตัวอย่างการพิมพ์ · ไม่มีการออกเอกสารจริง")
              }
            />
            <ConfirmDialog
              title="Export Excel · UI demo"
              description="ยังไม่สร้างไฟล์ Excel ใน phase นี้"
              trigger={
                <Button variant="outline">
                  <Download />
                  Export Excel
                </Button>
              }
              onConfirm={() =>
                setNotice("ตัวอย่าง Export Excel · ไม่มีการสร้างไฟล์")
              }
            />
            <FormDialog
              title="ยกเลิกใบแจ้งหนี้"
              description="ระบุเหตุผล · ไม่ส่งข้อมูลไปยังระบบจริง"
              destructive
              trigger={
                <Button
                  variant="outline"
                  disabled={invoice.status === "ยกเลิกแล้ว"}
                >
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
              onSubmit={(v) => {
                updateDocument("invoice", id, {
                  status: "ยกเลิกแล้ว",
                  note: v.reason,
                  updated: new Date().toISOString(),
                });
                setNotice("ยกเลิกเฉพาะใบแจ้งหนี้สาธิตแล้ว");
              }}
            />
          </>
        }
      />
      {notice && (
        <Alert role="status" className="border-info/20 bg-info/5 text-info">
          <AlertDescription className="text-info">{notice}</AlertDescription>
        </Alert>
      )}
      <SectionCard title="ข้อมูลใบแจ้งหนี้">
        <InfoGrid>
          <InfoRow label="เลขที่ใบแจ้งหนี้">{invoice.number}</InfoRow>
          <InfoRow label="วันที่เอกสาร">{date(invoice.date)}</InfoRow>
          <InfoRow label="สถานะ">
            <StatusBadge>{invoice.status}</StatusBadge>
          </InfoRow>
          <InfoRow label="อัปเดตล่าสุด">{dateTime(invoice.updated)}</InfoRow>
          <InfoRow label="เงื่อนไขการชำระเงิน">30 วัน (สมมติ)</InfoRow>
          <InfoRow label="สกุลเงิน">THB · บาท</InfoRow>
          <InfoRow label="หมายเหตุ">{invoice.note}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="ข้อมูลลูกค้า">
        <InfoGrid>
          <InfoRow label="รหัสลูกค้า">{order.customerCode}</InfoRow>
          <InfoRow label="ชื่อลูกค้า">{order.customer}</InfoRow>
          <InfoRow label="ที่อยู่">อาคารตัวอย่าง เขตสาธิต (สมมติ)</InfoRow>
          <InfoRow label="โทรศัพท์">000-000-0000</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="ข้อมูลอ้างอิงคำสั่งการผลิต">
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
          <InfoRow label="วันที่เอกสาร">{date(order.date)}</InfoRow>
          <InfoRow label="Revision">{order.revision}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title="รายการสินค้า">
        <ItemTable items={order.items} />
      </SectionCard>
      <SectionCard
        title="สรุปยอด"
        subtitle="คำนวณจาก mock data · ไม่ใช่ใบกำกับภาษี"
      >
        <dl className="ml-auto max-w-md space-y-4">
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">ยอดรายการสินค้า</dt>
            <dd className="tabular-nums">{money(subtotal)} บาท</dd>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">ส่วนลด</dt>
              <dd className="tabular-nums">{money(invoice.discount)} บาท</dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">ยอดก่อนภาษี</dt>
            <dd className="tabular-nums">{money(taxable)} บาท</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">
              ภาษีมูลค่าเพิ่ม 7% (ตัวอย่าง)
            </dt>
            <dd className="tabular-nums">{money(tax)} บาท</dd>
          </div>
          <Separator />
          <div className="flex justify-between gap-6 rounded-lg bg-accent p-4 text-lg font-semibold text-primary">
            <dt>ยอดสุทธิ</dt>
            <dd className="tabular-nums">{money(taxable + tax)} บาท</dd>
          </div>
        </dl>
      </SectionCard>
    </>
  );
}
