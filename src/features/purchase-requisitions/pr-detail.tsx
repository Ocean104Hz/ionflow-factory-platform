"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  PageHeader,
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
  FactoryDataTable,
} from "@/src/components/factory/patterns";
import { usePR } from "./pr-provider";
import {
  actionLabel,
  actionRules,
  priorityLabel,
  statusLabel,
  statusTone,
  type PRAction,
} from "./pr-domain";
import {
  PRCommand,
  PRCreatePO,
  PRItemsTable,
  PRPreview,
  PRTotals,
  prDate,
} from "./pr-components";

export function PRDetail({
  id,
  onEdit,
  onClose,
}: {
  id: string;
  onEdit?: (id: string) => void;
  onClose?: () => void;
}) {
  const { records, act, remove, copy } = usePR();
  const pr = records.find((row) => row.id === id);
  const router = useRouter();
  const [error, setError] = useState("");
  if (!pr)
    return (
      <div className="space-y-3">
        <p role="alert">
          ไม่พบ PR ในหน่วยความจำ · เอกสารที่สร้างเองจะหายเมื่อโหลดแอปใหม่
        </p>
        <Button asChild variant="outline">
          <Link href="/pr">กลับรายการ</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-5">
      <PageHeader
        title={pr.number}
        description={`รายละเอียดใบขอซื้อสาธิต · Rev. ${pr.revision}`}
        parent={onEdit ? undefined : { title: "รายการ PR", href: "/pr" }}
        actions={
          <StatusBadge tone={statusTone[pr.status]}>
            {statusLabel[pr.status]}
          </StatusBadge>
        }
      />
      <div className="flex flex-wrap gap-2">
        {["draft", "rejected"].includes(pr.status) &&
          (onEdit ? (
            <Button variant="outline" onClick={() => onEdit(id)}>
              แก้ไข
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link href={`/pr/${id}/edit`}>แก้ไข</Link>
            </Button>
          ))}
        <Button
          variant="outline"
          onClick={() => {
            try {
              const copiedId = copy(id);
              if (onEdit) onEdit(copiedId);
              else router.push(`/pr/${copiedId}/edit`);
            } catch (issue) {
              setError(issue instanceof Error ? issue.message : "คัดลอกไม่ได้");
            }
          }}
        >
          คัดลอกเป็นฉบับร่าง
        </Button>
        {(Object.keys(actionRules) as PRAction[])
          .filter((action) => actionRules[action].from.includes(pr.status))
          .map((action) => (
            <PRCommand
              key={action}
              title={`${actionLabel[action]} PR`}
              description={
                action === "cancel" && pr.purchaseOrders.length
                  ? "ยกเลิกยอดค้างซื้อของ PR เท่านั้น PO สาธิตที่ออกแล้วคงอยู่ ไม่ได้ยกเลิกตาม"
                  : action === "approve" || action === "reject"
                    ? `ผู้อนุมัติที่กำหนด: ${pr.approver} · ผู้ใช้ปัจจุบันในต้นแบบเป็นผู้ดูแลสาธิต`
                    : "ตรวจสอบข้อมูลก่อนยืนยัน"
              }
              requiresReason={action === "reject" || action === "cancel"}
              trigger={
                <Button
                  variant={action === "cancel" ? "destructive" : "outline"}
                >
                  {actionLabel[action]}
                </Button>
              }
              onConfirm={(note) => act(id, action, note)}
            />
          ))}
        {["approved", "partial_po_created"].includes(pr.status) && (
          <PRCreatePO key={`${id}-${pr.revision}`} pr={pr} />
        )}
        {pr.status === "draft" && (
          <PRCommand
            title="ลบฉบับร่าง PR"
            description="ลบออกจากรายการสาธิต ประวัติการลบยังอยู่จนโหลดแอปใหม่"
            trigger={<Button variant="destructive">ลบฉบับร่าง</Button>}
            onConfirm={() => {
              remove(id);
              if (onClose) onClose();
              else router.push("/pr");
            }}
          />
        )}
        <PRPreview records={[pr]} mode="print" />
        <PRPreview records={[pr]} mode="excel" />
      </div>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <SectionCard title="ข้อมูลหัวเอกสาร">
        <InfoGrid>
          {[
            ["วันที่เอกสาร", prDate(pr.date)],
            ["ผู้ขอซื้อ", pr.requester],
            ["ฝ่าย/แผนก", pr.department],
            ["คลัง / Site", `${pr.warehouseCode} ${pr.warehouseName}`],
            ["ประเภท", pr.category],
            ["ประเภทธุรกรรม", pr.transactionType],
            ["เลขอ้างอิง", pr.referenceNo],
            ["กำหนดใช้", prDate(pr.neededDate)],
            ["ความเร่งด่วน", priorityLabel[pr.priority]],
            ["ผู้อนุมัติที่กำหนด", pr.approver],
            ["วัตถุประสงค์", pr.purpose],
            ["หมายเหตุ", pr.remarks],
          ].map(([label, value]) => (
            <InfoRow key={label} label={label}>
              {value || "—"}
            </InfoRow>
          ))}
        </InfoGrid>
      </SectionCard>
      <SectionCard title="รายการขอซื้อ">
        <PRItemsTable pr={pr} />
        <PRTotals pr={pr} />
      </SectionCard>
      <SectionCard
        title="PO สาธิตที่เกี่ยวข้อง"
        subtitle="ติดตามจำนวนที่ออกซื้อเท่านั้น ไม่ใช่โมดูลใบสั่งซื้อจริง"
      >
        <FactoryDataTable
          rows={pr.purchaseOrders}
          rowKey={(po) => po.id}
          minWidth={800}
          columns={[
            { key: "number", label: "เลข PO สาธิต", render: (po) => po.number },
            { key: "at", label: "วันที่", render: (po) => prDate(po.at) },
            { key: "actor", label: "ผู้ดำเนินการ", render: (po) => po.actor },
            {
              key: "items",
              label: "รายการ / จำนวน",
              render: (po) =>
                po.lines
                  .map((line) => {
                    const item = pr.items.find((row) => row.id === line.itemId);
                    return `${item?.name} ${line.quantity} ${item?.unit}`;
                  })
                  .join(" · "),
            },
          ]}
        />
        {pr.status === "cancelled" && pr.purchaseOrders.length > 0 && (
          <p className="mt-3 text-sm text-warning">
            PR ถูกยกเลิก แต่ PO สาธิตที่ออกก่อนหน้ายังคงอยู่
          </p>
        )}
      </SectionCard>
      <SectionCard
        title="ประวัติการดำเนินการ"
        subtitle="ผู้ดำเนินการจริงในโหมดสาธิต พร้อมสถานะและค่าก่อน–หลัง"
      >
        {!pr.history.length ? (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีเหตุการณ์สาธิต
          </p>
        ) : (
          <ol className="space-y-4">
            {[...pr.history].reverse().map((event) => (
              <li
                key={event.id}
                className="space-y-2 border-b pb-4 last:border-0"
              >
                <h3 className="text-sm font-semibold">
                  {actionLabel[event.action] ?? event.action}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {event.actor} ·{" "}
                  {new Intl.DateTimeFormat("th-TH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Bangkok",
                  }).format(new Date(event.at))}
                </p>
                <p className="text-sm">
                  {event.from ? statusLabel[event.from] : "เริ่มต้น"} →{" "}
                  {statusLabel[event.to]}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
                {event.changes.length > 0 && (
                  <FactoryDataTable
                    rows={event.changes}
                    rowKey={(change) => change.field}
                    minWidth={600}
                    columns={[
                      {
                        key: "field",
                        label: "ข้อมูล",
                        render: (change) => change.field,
                      },
                      {
                        key: "before",
                        label: "ก่อน",
                        render: (change) => change.before,
                      },
                      {
                        key: "after",
                        label: "หลัง",
                        render: (change) => change.after,
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
        <Button asChild variant="link" className="mt-3 px-0">
          <Link href="/audit_log">ดูประวัติการแก้ไขรวม</Link>
        </Button>
      </SectionCard>
    </div>
  );
}
