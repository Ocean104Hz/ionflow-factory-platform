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
  open: controlledOpen,
  onOpenChange,
  size = "compact",
}: {
  title: string;
  description: string;
  trigger?: ReactNode;
  onConfirm: (reason: string) => void;
  requiresReason?: boolean;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "compact" | "wide";
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const open = controlledOpen ?? internalOpen;
  const changeOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
    setError("");
    if (value) setReason("");
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className={
          size === "wide"
            ? "flex max-h-[90dvh] min-h-0 w-[min(96vw,1100px)] max-w-none flex-col overflow-hidden sm:max-w-none"
            : "flex max-h-[85dvh] min-h-0 w-[min(calc(100vw-2rem),640px)] max-w-none flex-col overflow-hidden sm:max-w-none"
        }
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} · เปลี่ยนเฉพาะข้อมูลสาธิตในหน่วยความจำ
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              if (requiresReason && !reason.trim())
                throw new Error("กรุณาระบุเหตุผล");
              onConfirm(reason.trim());
              changeOpen(false);
            } catch (issue) {
              setError(
                issue instanceof Error ? issue.message : "ดำเนินการไม่สำเร็จ",
              );
            }
          }}
        >
          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto pr-1">
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
                  className="min-h-24"
                />
              </div>
            )}
          </div>
          {error && (
            <p
              id={`${id}-error`}
              role="alert"
              className="shrink-0 pt-3 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <DialogFooter className="shrink-0 border-t pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button type="submit">ยืนยัน</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function PRItemsTable({
  pr,
  variant = "default",
}: {
  pr: PR;
  variant?: "default" | "detail";
}) {
  if (variant === "detail") {
    const detailColumns: Column<PRItem>[] = [
      {
        key: "item",
        label: "สินค้า",
        render: (item) => (
          <div className="min-w-52 space-y-1">
            <p className="font-medium leading-relaxed">{item.name || "ยังไม่ระบุ"}</p>
            <p className="text-xs text-muted-foreground">รหัส {item.code || "—"}</p>
          </div>
        ),
      },
      {
        key: "details",
        label: "รายละเอียดรายการ",
        render: (item) => (
          <dl className="min-w-56 space-y-1 text-xs leading-relaxed">
            <div>
              <dt className="inline text-muted-foreground">ผู้ขาย: </dt>
              <dd className="inline break-words">{item.supplierName || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">สเปก: </dt>
              <dd className="inline break-words">{item.specification || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">หมายเหตุ: </dt>
              <dd className="inline break-words">{item.remarks || "—"}</dd>
            </div>
          </dl>
        ),
      },
      {
        key: "quantity",
        label: "จำนวนขอซื้อ",
        numeric: true,
        render: (item) => <span className="whitespace-nowrap">{item.quantity} {item.unit}</span>,
      },
      {
        key: "ordered",
        label: "ออก PO แล้ว",
        numeric: true,
        render: (item) => <span className="whitespace-nowrap">{item.orderedQuantity} {item.unit}</span>,
      },
      {
        key: "remaining",
        label: "ค้างซื้อ",
        numeric: true,
        render: (item) => <span className="whitespace-nowrap">{remainingQuantity(item)} {item.unit}</span>,
      },
      {
        key: "price",
        label: "ราคา/หน่วย",
        numeric: true,
        render: (item) => <span className="whitespace-nowrap">{money(item.price)}</span>,
      },
      {
        key: "amounts",
        label: "ก่อนภาษี / ภาษี",
        numeric: true,
        render: (item) => {
          const amounts = lineAmounts(item, pr.transactionType);
          return (
            <div className="space-y-1 whitespace-nowrap">
              <p>{money(amounts?.subtotal)}</p>
              <p className="text-xs text-muted-foreground">ภาษี {money(amounts?.tax)}</p>
            </div>
          );
        },
      },
      {
        key: "total",
        label: "รวม",
        numeric: true,
        render: (item) => (
          <span className="whitespace-nowrap font-semibold">
            {money(lineAmounts(item, pr.transactionType)?.total)}
          </span>
        ),
      },
    ];
    return (
      <FactoryDataTable
        columns={detailColumns}
        rows={pr.items}
        rowKey={(item) => item.id}
        minWidth={1120}
      />
    );
  }
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
export function PRTotals({
  pr,
  variant = "default",
}: {
  pr: PR;
  variant?: "default" | "detail";
}) {
  const totals = prAmounts(pr);
  if (variant === "detail") {
    return (
      <div className="mt-5 space-y-3">
        <dl className="ml-auto w-full max-w-md rounded-xl border bg-muted/20 p-5 text-sm">
          <div className="flex items-center justify-between gap-6 py-1.5">
            <dt className="text-muted-foreground">ยอดก่อนภาษีที่ระบุแล้ว</dt>
            <dd className="whitespace-nowrap text-right font-medium tabular-nums">
              {money(totals.subtotal)} บาท
            </dd>
          </div>
          <div className="flex items-center justify-between gap-6 py-1.5">
            <dt className="text-muted-foreground">
              ภาษีสาธิต {pr.transactionType === "VAT" ? "7%" : "0%"}
            </dt>
            <dd className="whitespace-nowrap text-right font-medium tabular-nums">
              {money(totals.tax)} บาท
            </dd>
          </div>
          <div className="mt-3 flex items-start justify-between gap-6 border-t pt-4">
            <dt className="font-semibold">ยอดสุทธิประมาณ</dt>
            <dd className="text-right text-lg font-semibold tabular-nums">
              {totals.complete ? `${money(totals.total)} บาท` : "ยังคำนวณครบไม่ได้"}
            </dd>
          </div>
        </dl>
        <p className="ml-auto max-w-md text-xs leading-relaxed text-muted-foreground">
          ราคาก่อนภาษี · ปัดเป็นสตางค์รายบรรทัด ·{" "}
          {totals.missing
            ? `ยังไม่ระบุราคา/ค่าไม่ถูกต้อง ${totals.missing} รายการ ไม่ถือว่ายอดบางส่วนเป็นยอดครบ`
            : "ข้อมูลสาธิต ไม่ใช่เอกสารทางบัญชี"}
        </p>
      </div>
    );
  }
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
export function PRCreatePO({
  pr,
  open,
  onOpenChange,
  trigger,
}: {
  pr: PR;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode | null;
}) {
  const { order } = usePR();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  return (
    <PRCommand
      title="สร้าง PO สาธิตจาก PR"
      description="เลือกจำนวนซื้อครั้งนี้ ไม่เกินยอดค้างซื้อ ไม่มีการสร้างใบสั่งซื้อจริงหรือส่งผู้ขาย"
      size="wide"
      trigger={
        trigger === undefined ? <Button>สร้าง PO สาธิต</Button> : trigger
      }
      open={open}
      onOpenChange={onOpenChange}
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
        minWidth={720}
        columns={[
          {
            key: "name",
            label: "สินค้า",
            render: (item) => (
              <div className="min-w-64">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.code}</p>
              </div>
            ),
          },
          {
            key: "remaining",
            label: "ค้างซื้อ",
            numeric: true,
            render: (item) => (
              <span className="whitespace-nowrap">
                {remainingQuantity(item)} {item.unit}
              </span>
            ),
          },
          {
            key: "quantity",
            label: "ซื้อครั้งนี้",
            numeric: true,
            render: (item) => (
              <Input
                aria-label={`จำนวนออก PO ${item.code}`}
                type="number"
                min="0"
                max={remainingQuantity(item)}
                step="0.0001"
                disabled={remainingQuantity(item) === 0}
                className="ml-auto max-w-44 text-right tabular-nums"
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
      <DialogContent className="flex max-h-[94dvh] min-h-0 w-[min(96vw,1250px)] max-w-none flex-col overflow-hidden sm:max-w-none">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>พรีวิวข้อมูลสำหรับ Excel</DialogTitle>
          <DialogDescription>
            แสดง {records.length} เอกสารที่เลือกหรือผลกรอง · ข้อมูลสาธิตเท่านั้น
            ไม่สร้างหรือดาวน์โหลดไฟล์ Excel
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto pr-1">
          {records.map((pr) => (
            <section key={pr.id} className="min-w-0 space-y-3 border-t pt-4 first:border-t-0 first:pt-0">
              <h2 className="break-words font-semibold">
                {pr.number} · {statusLabel[pr.status]}
              </h2>
              <p className="text-sm leading-relaxed">
                {prDate(pr.date)} · {pr.requester || "ยังไม่ระบุ"} ·{" "}
                {pr.warehouseName || "ยังไม่ระบุคลัง"}
              </p>
              <PRItemsTable pr={pr} variant="detail" />
              <PRTotals pr={pr} variant="detail" />
            </section>
          ))}
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <DialogClose asChild>
            <Button variant="outline">ปิดพรีวิว</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
