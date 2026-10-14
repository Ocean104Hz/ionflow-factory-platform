"use client";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import Link from "next/link";
import { useState } from "react";
import { CalendarPlus, Check, Play, X, ArrowUpRight } from "lucide-react";
import { useDemo } from "@/src/components/factory/demo-provider";
import {
  BackButton,
  PageHeader,
  RefreshButton,
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
  EmptyState,
} from "@/src/components/factory/patterns";
import {
  ConfirmDialog,
  FormDialog,
} from "@/src/components/factory/confirm-dialog";
import { AttachmentGallery } from "@/src/components/factory/attachment-gallery";
import { ItemTable } from "@/src/components/factory/item-table";
import {
  Timeline,
  type TimelineEntry,
} from "@/src/components/factory/timeline";
import { Button } from "@/src/components/ui/button";
import { productionSections } from "@/src/lib/constants/status";
import { date, dateTime } from "@/src/lib/formatters";
import type { ProductionOrder } from "@/src/lib/mock-data";

export function ProductionOrderDetail({ id }: { id: string }) {
  const { orders, updateOrder } = useDemo();
  const order = orders.find((row) => row.id === id)!;
  const [events, setEvents] = useState<TimelineEntry[]>([]);
  const [notice, setNotice] = useState("");
  const change = (
    patch: Partial<ProductionOrder>,
    title: string,
    reason = "บันทึกใน demo state เท่านั้น",
  ) => {
    const at = new Date().toISOString();
    updateOrder(id, { ...patch, updated: at });
    setEvents((previous) => [{ title, at, description: reason }, ...previous]);
    setNotice(`${title} · ไม่ส่งข้อมูลไปยังระบบจริง`);
  };
  const active = order.document !== "ยกเลิกแล้ว";
  const canReview = active && order.production === "ยังไม่เริ่มผลิต";
  const approveReady =
    canReview &&
    order.material === "วัตถุดิบพร้อม" &&
    order.approval === "รอการอนุมัติจากโรงงาน";
  const cancellation = order.cancellation;
  return (
    <>
      <PageHeader
        title={order.number}
        description={`${order.source} · รับข้อมูล ${dateTime(order.received)} · ข้อมูลสมมติ`}
        parent={{ title: "คำสั่งการผลิต", href: "/production-orders" }}
        actions={
          <>
            <BackButton href="/production-orders" />
            <RefreshButton />
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge>{order.document}</StatusBadge>
        <StatusBadge>{order.production}</StatusBadge>
        <StatusBadge tone="neutral">{order.source}</StatusBadge>
      </div>
      {notice && (
        <Alert role="status" className="border-info/20 bg-info/5 text-info">
          <AlertDescription className="text-info">{notice}</AlertDescription>
        </Alert>
      )}
      <SectionCard title={productionSections[0]}>
        <InfoGrid>
          <InfoRow label="เลขที่คำสั่งการผลิต">{order.number}</InfoRow>
          <InfoRow label="Sales Order">{order.salesOrder}</InfoRow>
          <InfoRow label="บริษัทต้นทาง">{order.company}</InfoRow>
          <InfoRow label="วันที่เอกสาร">{date(order.date)}</InfoRow>
          <InfoRow label="Revision">{order.revision}</InfoRow>
          <InfoRow label="คลัง">{order.warehouse}</InfoRow>
          <InfoRow label="สถานะเอกสาร">
            <StatusBadge>{order.document}</StatusBadge>
          </InfoRow>
          <InfoRow label="รับข้อมูลเมื่อ">{dateTime(order.received)}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard
        title={productionSections[1]}
        subtitle="คำขอเดิมจะยังคงอยู่เมื่อเสนอวันใหม่"
        action={
          <FormDialog
            title="เสนอวันใหม่"
            description="กำหนดการของโรงงาน · ข้อมูลสาธิตเท่านั้น"
            trigger={
              <Button variant="outline" disabled={!active}>
                <CalendarPlus />
                เสนอวันใหม่
              </Button>
            }
            fields={[
              {
                name: "completion",
                label: "วันที่ผลิตเสร็จที่เสนอ",
                type: "date",
                value: order.proposal?.completion ?? order.requestedDate,
                min: order.requestedDate,
                required: true,
              },
              {
                name: "pickup",
                label: "วันเวลารับสินค้าที่เสนอ",
                type: "datetime-local",
                value:
                  order.proposal?.pickup.slice(0, 16) ??
                  order.pickup.slice(0, 16),
                min: `${order.requestedDate}T00:00`,
                required: true,
              },
              {
                name: "reason",
                label: "เหตุผล",
                type: "textarea",
                required: true,
              },
            ]}
            validate={(values) =>
              values.pickup.slice(0, 10) < values.completion
                ? "วันรับสินค้าต้องไม่ก่อนวันผลิตเสร็จ"
                : null
            }
            onSubmit={(values) =>
              change(
                {
                  proposal: {
                    completion: values.completion,
                    pickup: `${values.pickup}:00+07:00`,
                    reason: values.reason,
                    at: new Date().toISOString(),
                  },
                },
                "เสนอวันผลิตใหม่",
                values.reason,
              )
            }
          />
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-5 rounded-lg border p-5">
            <h3 className="font-semibold">คำขอเดิมของฝ่ายขาย</h3>
            <dl className="space-y-4">
              <InfoRow label="วันที่ต้องการให้ผลิตเสร็จ">
                {date(order.requestedDate)}
              </InfoRow>
              <InfoRow label="วันเวลารับสินค้า">
                {dateTime(order.pickup)}
              </InfoRow>
            </dl>
          </div>
          <div className="space-y-5 rounded-lg border bg-surface-muted p-5">
            <h3 className="font-semibold">กำหนดการที่โรงงานเสนอ</h3>
            {order.proposal ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="วันที่ผลิตเสร็จ">
                  {date(order.proposal.completion)}
                </InfoRow>
                <InfoRow label="วันเวลารับสินค้า">
                  {dateTime(order.proposal.pickup)}
                </InfoRow>
                <InfoRow label="เหตุผล">{order.proposal.reason}</InfoRow>
                <InfoRow label="เสนอเมื่อ">
                  {dateTime(order.proposal.at)}
                </InfoRow>
              </dl>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">
                ยังไม่มีข้อเสนอปรับกำหนดการ
              </p>
            )}
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title={productionSections[2]}
        subtitle="ตัวอย่าง workflow · ทุกการยืนยันเปลี่ยนเฉพาะข้อมูล demo"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: "วัตถุดิบ", value: order.material },
            { label: "การอนุมัติ", value: order.approval },
            { label: "การผลิต", value: order.production },
          ].map((s) => (
            <div
              key={s.label}
              className="space-y-3 rounded-lg border bg-surface-muted p-4"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <StatusBadge>{s.value}</StatusBadge>
            </div>
          ))}
        </div>
        <div className="no-print mt-5 flex flex-wrap gap-2">
          <ConfirmDialog
            title="ยืนยันวัตถุดิบพร้อม"
            description="เปลี่ยนสถานะวัตถุดิบพร้อม"
            trigger={
              <Button
                variant="outline"
                disabled={!canReview || order.material === "วัตถุดิบพร้อม"}
              >
                <Check />
                วัตถุดิบพร้อม
              </Button>
            }
            onConfirm={() =>
              change({ material: "วัตถุดิบพร้อม" }, "วัตถุดิบพร้อม")
            }
          />
          <FormDialog
            title="วัตถุดิบไม่พร้อม"
            description="ระบุเหตุผลประกอบการตัดสินใจ"
            destructive
            submitLabel="ยืนยัน"
            trigger={
              <Button variant="outline" disabled={!canReview}>
                <X />
                วัตถุดิบไม่พร้อม
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
                { material: "วัตถุดิบไม่พร้อม" },
                "วัตถุดิบไม่พร้อม",
                v.reason,
              )
            }
          />
          <ConfirmDialog
            title="อนุมัติคำสั่งการผลิต"
            description="ยืนยันการอนุมัติจากโรงงาน"
            trigger={
              <Button disabled={!approveReady}>อนุมัติคำสั่งการผลิต</Button>
            }
            onConfirm={() =>
              change({ approval: "โรงงานอนุมัติ" }, "โรงงานอนุมัติ")
            }
          />
          <FormDialog
            title="ปฏิเสธคำสั่งการผลิต"
            description="ระบุเหตุผลการปฏิเสธ"
            destructive
            submitLabel="ยืนยันการปฏิเสธ"
            trigger={
              <Button
                variant="outline"
                disabled={
                  !canReview || order.approval !== "รอการอนุมัติจากโรงงาน"
                }
              >
                ปฏิเสธคำสั่งการผลิต
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
              change({ approval: "โรงงานปฏิเสธ" }, "โรงงานปฏิเสธ", v.reason)
            }
          />
          <ConfirmDialog
            title="เริ่มผลิต"
            description="เริ่มการผลิตตามคำสั่งที่อนุมัติแล้ว"
            trigger={
              <Button
                disabled={
                  !active ||
                  order.material !== "วัตถุดิบพร้อม" ||
                  order.approval !== "โรงงานอนุมัติ" ||
                  order.production !== "ยังไม่เริ่มผลิต"
                }
              >
                <Play />
                เริ่มผลิต
              </Button>
            }
            onConfirm={() => change({ production: "กำลังผลิต" }, "เริ่มผลิต")}
          />
          {order.production === "กำลังผลิต" && (
            <ConfirmDialog
              title="ผลิตเสร็จแล้ว"
              description="บันทึกผลผลิตเสร็จใน demo"
              trigger={
                <Button variant="outline" disabled={!active}>
                  ผลิตเสร็จแล้ว
                </Button>
              }
              onConfirm={() =>
                change({ production: "ผลิตเสร็จแล้ว" }, "ผลิตเสร็จแล้ว")
              }
            />
          )}
          {order.production === "ผลิตเสร็จแล้ว" && (
            <ConfirmDialog
              title="พร้อมรับสินค้า"
              description="ยืนยันความพร้อมรับสินค้า"
              trigger={
                <Button variant="outline" disabled={!active}>
                  พร้อมรับสินค้า
                </Button>
              }
              onConfirm={() =>
                change({ production: "พร้อมรับสินค้า" }, "พร้อมรับสินค้า")
              }
            />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          อนุมัติได้เมื่อวัตถุดิบพร้อม · เริ่มผลิตได้เมื่อโรงงานอนุมัติแล้ว
        </p>
      </SectionCard>
      <SectionCard title={productionSections[3]}>
        <ItemTable items={order.items} />
      </SectionCard>
      <SectionCard title={productionSections[4]}>
        <InfoGrid>
          <InfoRow label="รหัสลูกค้า">{order.customerCode}</InfoRow>
          <InfoRow label="ชื่อลูกค้า">{order.customer}</InfoRow>
          <InfoRow label="โทรศัพท์">000-000-0000 (สมมติ)</InfoRow>
          <InfoRow label="ผู้ติดต่อ">ผู้ประสานงานสาธิต</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard title={productionSections[5]}>
        <InfoGrid>
          <InfoRow label="ชื่อผู้รับ">ผู้รับสินค้าสาธิต</InfoRow>
          <InfoRow label="ที่อยู่">
            อาคารตัวอย่าง เขตสาธิต ประเทศไทย (สมมติ)
          </InfoRow>
          <InfoRow label="โทรศัพท์">000-000-0000 (สมมติ)</InfoRow>
          <InfoRow label="คลังสินค้า">{order.warehouse}</InfoRow>
        </InfoGrid>
      </SectionCard>
      <SectionCard
        title={productionSections[6]}
        subtitle="ภาพจำลองในโปรเจกต์ · กดเพื่อเปิดภาพตัวอย่าง"
      >
        <AttachmentGallery />
      </SectionCard>
      <SectionCard
        title={productionSections[7]}
        subtitle="มีทั้งตัวอย่างไม่มีคำขอและคำขอรอพิจารณา"
      >
        {cancellation ? (
          <>
            <InfoGrid>
              <InfoRow label="เหตุผล">{cancellation.reason}</InfoRow>
              <InfoRow label="ผู้ขอ">{cancellation.requester}</InfoRow>
              <InfoRow label="วันที่ขอ">{dateTime(cancellation.at)}</InfoRow>
              <InfoRow label="สถานะ">
                <StatusBadge>{cancellation.status}</StatusBadge>
              </InfoRow>
              <InfoRow label="ผลการตัดสินใจ">{cancellation.decision}</InfoRow>
              <InfoRow label="ผู้ตัดสินใจ">{cancellation.by}</InfoRow>
              <InfoRow label="วันที่ตัดสินใจ">
                {cancellation.decidedAt
                  ? dateTime(cancellation.decidedAt)
                  : "—"}
              </InfoRow>
            </InfoGrid>
            {cancellation.status === "รอพิจารณา" && (
              <div className="no-print mt-5 flex flex-wrap gap-2">
                <FormDialog
                  title="ยอมรับการยกเลิก"
                  description="คำสั่งสาธิตนี้จะเปลี่ยนเป็นยกเลิกแล้ว"
                  destructive
                  trigger={
                    <Button variant="destructive">ยอมรับการยกเลิก</Button>
                  }
                  fields={[
                    {
                      name: "reason",
                      label: "เหตุผลการตัดสินใจ",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                  onSubmit={(v) =>
                    change(
                      {
                        document: "ยกเลิกแล้ว",
                        cancellation: {
                          ...cancellation,
                          status: "ยกเลิกแล้ว",
                          decision: `ยอมรับ: ${v.reason}`,
                          by: "ผู้ใช้งานสาธิต",
                          decidedAt: new Date().toISOString(),
                        },
                      },
                      "ยอมรับการยกเลิก",
                    )
                  }
                />
                <FormDialog
                  title="ปฏิเสธการยกเลิก"
                  description="ระบุเหตุผลการปฏิเสธ"
                  trigger={<Button variant="outline">ปฏิเสธการยกเลิก</Button>}
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
                      {
                        cancellation: {
                          ...cancellation,
                          status: "โรงงานปฏิเสธ",
                          decision: v.reason,
                          by: "ผู้ใช้งานสาธิต",
                          decidedAt: new Date().toISOString(),
                        },
                      },
                      "ปฏิเสธการยกเลิก",
                    )
                  }
                />
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="ไม่มีคำขอยกเลิก"
            description="ตัวอย่างคำขอรอพิจารณาอยู่ใน PDO-DEMO-0002"
            action={
              <Button variant="outline" asChild>
                <Link href="/production-orders/po-02">
                  ดูตัวอย่างคำขอ
                  <ArrowUpRight />
                </Link>
              </Button>
            }
          />
        )}
      </SectionCard>
      <SectionCard
        title={productionSections[8]}
        subtitle="แสดงข้อมูลสมมติและเลขประจำตัวที่ปกปิดเท่านั้น"
      >
        {order.source === "Sales Hub" ? (
          <InfoGrid>
            <InfoRow label="ชื่อคนขับ">คนขับสาธิต</InfoRow>
            <InfoRow label="โทรศัพท์">000-000-0000</InfoRow>
            <InfoRow label="เลขประจำตัว (ปกปิด)">1-****-*****-**-9</InfoRow>
            <InfoRow label="ทะเบียนรถ">DEMO-0001</InfoRow>
            <InfoRow label="ที่อยู่">ที่อยู่สาธิต (สมมติ)</InfoRow>
          </InfoGrid>
        ) : (
          <p className="text-muted-foreground">
            คำสั่งจาก Datalink ไม่มีข้อมูลคนขับจาก Sales Hub
          </p>
        )}
      </SectionCard>
      <SectionCard title={productionSections[9]}>
        <Timeline
          entries={[
            ...events,
            {
              title: "ส่งสถานะกลับ Sales Hub (จำลอง)",
              at: order.updated,
              description: "ตัวอย่างผลสำเร็จ · ไม่มี network request",
            },
            {
              title: "แก้ไขข้อมูล (จำลอง)",
              at: order.received,
              description: `Revision ${order.revision} · สำเร็จ`,
            },
            {
              title: `รับข้อมูลจาก ${order.source} (จำลอง)`,
              at: order.received,
              description: "รับเอกสารสำเร็จ · mock data",
            },
          ]}
        />
      </SectionCard>
      <SectionCard title={productionSections[10]}>
        <div className="grid gap-6 md:grid-cols-2">
          <dl>
            <InfoRow label="หมายเหตุ">{order.note}</InfoRow>
          </dl>
          <div className="rounded-lg border border-dashed p-5">
            <p className="text-xs text-muted-foreground">
              ผู้อนุมัติ / ลายเซ็นตัวอย่าง
            </p>
            <p className="mt-3 font-semibold">
              {order.approval === "โรงงานอนุมัติ"
                ? "ผู้อนุมัติสาธิต"
                : "ยังไม่มีผู้อนุมัติ"}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              ไม่ใช่ลายเซ็นจริง
            </p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
