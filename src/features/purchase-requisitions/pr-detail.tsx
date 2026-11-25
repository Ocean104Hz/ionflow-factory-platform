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
  variant = "page",
}: {
  id: string;
  onEdit?: (id: string) => void;
  onClose?: () => void;
  variant?: "page" | "dialog";
}) {
  const { records, act, remove, copy, loading, loadError, retry, canApprove } = usePR();
  const pr = records.find((row) => row.id === id);
  const router = useRouter();
  const [error, setError] = useState("");
  if (loading) return <p role="status">กำลังโหลดใบขอซื้อ…</p>;
  if (loadError) return <div><p role="alert">{loadError}</p><Button onClick={retry}>ลองอีกครั้ง</Button></div>;
  if (!pr)
    return (
      <div className="space-y-3">
        <p role="alert">
          ไม่พบใบขอซื้อ
        </p>
        <Button asChild variant="outline">
          <Link href="/pr">กลับรายการ</Link>
        </Button>
      </div>
    );
  const headerFields = [
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
  ];
  return (
    <div className={variant === "dialog" ? "min-w-0 space-y-6" : "space-y-5"}>
      {variant === "dialog" ? (
        <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/20 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Purchase Requisition
            </p>
            <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight">
              {pr.number}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              รายละเอียดใบขอซื้อ · Rev. {pr.revision}
            </p>
          </div>
          <StatusBadge tone={statusTone[pr.status]}>
            {statusLabel[pr.status]}
          </StatusBadge>
        </div>
      ) : (
        <PageHeader
          title={pr.number}
          description={`รายละเอียดใบขอซื้อ · Rev. ${pr.revision}`}
          parent={onEdit ? undefined : { title: "รายการ PR", href: "/pr" }}
          actions={
            <StatusBadge tone={statusTone[pr.status]}>
              {statusLabel[pr.status]}
            </StatusBadge>
          }
        />
      )}
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
          onClick={async () => {
            try {
              const copiedId = await copy(id);
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
          .filter((action) => canApprove || !["approve", "reject"].includes(action))
          .filter((action) => actionRules[action].from.includes(pr.status))
          .map((action) => (
            <PRCommand
              key={action}
              title={`${actionLabel[action]} PR`}
              description={
                action === "cancel" && pr.purchaseOrders.length
                  ? "ยกเลิกยอดค้างซื้อของ PR โดยเก็บใบสั่งซื้อเดิมไว้"
                  : action === "approve" || action === "reject"
                    ? `ผู้อนุมัติที่กำหนด: ${pr.approver}`
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
            description="นำฉบับร่างออกจากรายการและเก็บประวัติการลบ"
            trigger={<Button variant="destructive">ลบฉบับร่าง</Button>}
            onConfirm={async () => {
              await remove(id);
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
      <SectionCard
        title={variant === "dialog" ? "ข้อมูลเอกสารและผู้ขอซื้อ" : "ข้อมูลหัวเอกสาร"}
        contentClassName="min-w-0"
      >
        <InfoGrid>
          {headerFields.map(([label, value], index) => (
            <div
              key={label}
              className={variant === "dialog" && index >= 10 ? "sm:col-span-2" : undefined}
            >
              <InfoRow label={label}>{value || "—"}</InfoRow>
            </div>
          ))}
        </InfoGrid>
      </SectionCard>
      <SectionCard title="รายการขอซื้อ">
        <PRItemsTable pr={pr} variant={variant === "dialog" ? "detail" : "default"} />
        <PRTotals pr={pr} variant={variant === "dialog" ? "detail" : "default"} />
      </SectionCard>
      <SectionCard
        title="PO ที่เกี่ยวข้อง"
        subtitle="ติดตามจำนวนที่ออกซื้อเท่านั้น ไม่ใช่โมดูลใบสั่งซื้อจริง"
      >
        <FactoryDataTable
          rows={pr.purchaseOrders}
          rowKey={(po) => po.id}
          minWidth={800}
          columns={[
            { key: "number", label: "เลข PO ", render: (po) => po.number },
            { key: "at", label: "วันที่", render: (po) => prDate(po.at) },
            { key: "actor", label: "ผู้ดำเนินการ", render: (po) => po.actor },
            {
              key: "items",
              label: "รายการ / จำนวน",
              render: (po) => (
                <span className={variant === "dialog" ? "block min-w-72 whitespace-normal break-words leading-relaxed" : undefined}>
                  {po.lines
                    .map((line) => {
                      const item = pr.items.find((row) => row.id === line.itemId);
                      return `${item?.name} ${line.quantity} ${item?.unit}`;
                    })
                    .join(" · ")}
                </span>
              ),
            },
          ]}
        />
        {pr.status === "cancelled" && pr.purchaseOrders.length > 0 && (
          <p className="mt-3 text-sm text-warning">
            PR ถูกยกเลิก แต่ PO ที่ออกก่อนหน้ายังคงอยู่
          </p>
        )}
      </SectionCard>
      <SectionCard
        title="ประวัติการดำเนินการ"
        subtitle="ผู้ดำเนินการจริงในโหมด พร้อมสถานะและค่าก่อน–หลัง"
      >
        {!pr.history.length ? (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีเหตุการณ์
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
                <p className="break-words text-sm leading-relaxed">
                  {event.from ? statusLabel[event.from] : "เริ่มต้น"} →{" "}
                  {statusLabel[event.to]}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
                {event.changes.length > 0 && (
                  <FactoryDataTable variant="history"
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
