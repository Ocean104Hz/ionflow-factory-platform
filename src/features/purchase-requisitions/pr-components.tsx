"use client";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  FactoryDataTable,
  type Column,
} from "@/src/components/factory/patterns";
import {
  lineAmounts,
  prAmounts,
  remainingQuantity,
  statusLabel,
  type PR,
  type PRItem,
} from "./pr-domain";
import { usePR } from "./pr-provider";
import { PRPrintPreview } from "./pr-print-preview";

export const money = (value: number | null | undefined) =>
  value == null
    ? "ไม่ระบุ"
    : value.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
export const prDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(value))
    : "—";
export function PRCommand({
  title,
  description,
  trigger,
  onConfirm,
  requiresReason = false,
  children,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  onConfirm: (reason: string) => void;
  requiresReason?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setError("");
        if (value) setReason("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} · เปลี่ยนเฉพาะข้อมูลสาธิตในหน่วยความจำ
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (requiresReason && !reason.trim())
                throw new Error("กรุณาระบุเหตุผล");
              onConfirm(reason.trim());
              setOpen(false);
            } catch (issue) {
              setError(
                issue instanceof Error ? issue.message : "ดำเนินการไม่สำเร็จ",
              );
            }
          }}
        >
          {children}
          {requiresReason && (
            <div className="grid gap-2">
              <Label htmlFor={id}>เหตุผล *</Label>
              <Textarea
                id={id}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                aria-describedby={error ? `${id}-error` : undefined}
              />
            </div>
          )}
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                กลับ
              </Button>
            </DialogClose>
            <Button type="submit">ยืนยัน</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function PRItemsTable({ pr }: { pr: PR }) {
  const columns: Column<PRItem>[] = [
    {
      key: "code",
      label: "รหัส / สินค้า",
      render: (item) => (
        <div>
          <p className="font-medium">{item.name || "ยังไม่ระบุ"}</p>
          <p className="text-xs text-muted-foreground">{item.code || "—"}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      label: "ผู้ขาย",
      render: (item) => item.supplierName || "—",
    },
    { key: "spec", label: "สเปก", render: (item) => item.specification || "—" },
    {
      key: "quantity",
      label: "จำนวนขอซื้อ",
      numeric: true,
      render: (item) => `${item.quantity} ${item.unit}`,
    },
    {
      key: "ordered",
      label: "ออก PO แล้ว",
      numeric: true,
      render: (item) => `${item.orderedQuantity} ${item.unit}`,
    },
    {
      key: "remaining",
      label: "ค้างซื้อ",
      numeric: true,
      render: (item) => `${remainingQuantity(item)} ${item.unit}`,
    },
    {
      key: "price",
      label: "ราคา/หน่วย",
      numeric: true,
      render: (item) => money(item.price),
    },
    {
      key: "subtotal",
      label: "ก่อนภาษี",
      numeric: true,
      render: (item) => money(lineAmounts(item, pr.transactionType)?.subtotal),
    },
    {
      key: "tax",
      label: "ภาษี",
      numeric: true,
      render: (item) => money(lineAmounts(item, pr.transactionType)?.tax),
    },
    {
      key: "total",
      label: "รวม",
      numeric: true,
      render: (item) => money(lineAmounts(item, pr.transactionType)?.total),
    },
    { key: "note", label: "หมายเหตุ", render: (item) => item.remarks || "—" },
  ];
  return (
    <FactoryDataTable
      columns={columns}
      rows={pr.items}
      rowKey={(item) => item.id}
      minWidth={1450}
    />
  );
}
export function PRTotals({ pr }: { pr: PR }) {
  const totals = prAmounts(pr);
  return (
    <div className="mt-4 space-y-2">
      <dl className="ml-auto grid max-w-sm grid-cols-2 gap-2 text-sm">
        <dt>ยอดก่อนภาษีที่ระบุแล้ว</dt>
        <dd className="text-right tabular-nums">
          {money(totals.subtotal)} บาท
        </dd>
        <dt>ภาษีสาธิต {pr.transactionType === "VAT" ? "7%" : "0%"}</dt>
        <dd className="text-right tabular-nums">{money(totals.tax)} บาท</dd>
        <dt className="font-semibold">ยอดสุทธิประมาณ</dt>
        <dd className="text-right font-semibold tabular-nums">
          {totals.complete ? `${money(totals.total)} บาท` : "ยังคำนวณครบไม่ได้"}
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        ราคาก่อนภาษี · ปัดเป็นสตางค์รายบรรทัด ·{" "}
        {totals.missing
          ? `ยังไม่ระบุราคา/ค่าไม่ถูกต้อง ${totals.missing} รายการ ไม่ถือว่ายอดบางส่วนเป็นยอดครบ`
          : "ข้อมูลสาธิต ไม่ใช่เอกสารทางบัญชี"}
      </p>
    </div>
  );
}
export function PRCreatePO({ pr }: { pr: PR }) {
  const { order } = usePR();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  return (
    <PRCommand
      title="สร้าง PO สาธิตจาก PR"
      description="เลือกจำนวนซื้อครั้งนี้ ไม่เกินยอดค้างซื้อ ไม่มีการสร้างใบสั่งซื้อจริงหรือส่งผู้ขาย"
      trigger={<Button>สร้าง PO สาธิต</Button>}
      onConfirm={() =>
        order(
          pr.id,
          Object.fromEntries(
            pr.items.map((item) => [
              item.id,
              quantities[item.id] ?? remainingQuantity(item),
            ]),
          ),
        )
      }
    >
      <FactoryDataTable
        rows={pr.items}
        rowKey={(item) => item.id}
        minWidth={450}
        columns={[
          { key: "name", label: "สินค้า", render: (item) => item.name },
          {
            key: "remaining",
            label: "ค้างซื้อ",
            render: (item) => `${remainingQuantity(item)} ${item.unit}`,
          },
          {
            key: "quantity",
            label: "ซื้อครั้งนี้",
            render: (item) => (
              <Input
                aria-label={`จำนวนออก PO ${item.code}`}
                type="number"
                min="0"
                max={remainingQuantity(item)}
                step="0.0001"
                disabled={remainingQuantity(item) === 0}
                value={quantities[item.id] ?? remainingQuantity(item)}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [item.id]: Number(event.target.value),
                  }))
                }
              />
            ),
          },
        ]}
      />
    </PRCommand>
  );
}
export function PRPreview({
  records,
  mode,
}: {
  records: PR[];
  mode: "print" | "excel";
}) {
  if (mode === "print") return <PRPrintPreview records={records} />;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!records.length}>
          Export Excel (สาธิต)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>พรีวิวข้อมูลสำหรับ Excel</DialogTitle>
          <DialogDescription>
            แสดง {records.length} เอกสารที่เลือกหรือผลกรอง · ข้อมูลสาธิตเท่านั้น
            ไม่สร้างหรือดาวน์โหลดไฟล์ Excel
          </DialogDescription>
        </DialogHeader>
        {records.map((pr) => (
          <section key={pr.id} className="min-w-0 space-y-3 border-t pt-4">
            <h2 className="font-semibold">
              {pr.number} · {statusLabel[pr.status]}
            </h2>
            <p className="text-sm">
              {prDate(pr.date)} · {pr.requester || "ยังไม่ระบุ"} ·{" "}
              {pr.warehouseName || "ยังไม่ระบุคลัง"}
            </p>
            <PRItemsTable pr={pr} />
            <PRTotals pr={pr} />
          </section>
        ))}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">ปิดพรีวิว</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
