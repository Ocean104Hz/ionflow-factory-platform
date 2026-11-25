"use client";

import {
  CalendarDays,
  ClipboardCheck,
  Package,
  Pencil,
  Plus,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  CUSTOMER_MATERIALS_DAILY_FIELDS,
  CUSTOMER_MATERIALS_DAILY_LABELS,
  CUSTOMER_MATERIALS_PERIODS,
  CUSTOMER_MATERIALS_SUMMARY_FIELDS,
  CUSTOMER_MATERIALS_SUMMARY_LABELS,
  customerMaterialsDateForDay,
  customerMaterialsDaysInPeriod,
  type CustomerMaterialsRow,
} from "./stock_customer_materials_domain";

/* ---------------- types ---------------- */

interface CustomerMaterialsDetailProps {
  row: CustomerMaterialsRow;
  readOnly: boolean;
  onEditMaterial: () => void;
  onEditDaily: (day: number) => void;
  onEditCount: () => void;
  onClose: () => void;
}

/* ---------------- helpers ---------------- */

function displayValue(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "-" : value;
}

/* ---------------- component ---------------- */

/** Display the current workspace row. Dedicated forms stage changes; the workspace persists them. */
export function CustomerMaterialsDetail({
  row,
  readOnly,
  onEditMaterial,
  onEditDaily,
  onEditCount,
  onClose,
}: CustomerMaterialsDetailProps) {
  const period = CUSTOMER_MATERIALS_PERIODS[row.sheet_name];
  const isCarryover = period.month === null;
  const editableDays = customerMaterialsDaysInPeriod(row.sheet_name);
  const editableDaySet = new Set(editableDays);
  const dailyByDay = new Map(row.daily.map((entry) => [entry.day, entry]));

  // Retain source entries outside the calendar month for inspection, but do
  // not permit editing those slots or invent a date for them.
  const days = [...new Set([...editableDays, ...dailyByDay.keys()])].sort(
    (left, right) => left - right,
  );

  const materialFields = [
    { label: "ฝ่ายขาย / ลูกค้า", value: row.item.sales_customer },
    { label: "ประเภทวัสดุ", value: row.item.material_type },
    { label: "รหัสสินค้า", value: row.item.code },
    { label: "No.", value: row.item.no },
    { label: "หน่วยนับ", value: row.item.unit },
    { label: "รายละเอียด", value: row.item.description, wide: true },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
        <div className="space-y-1 pr-6">
          <DialogTitle>รายละเอียดวัสดุคงเหลือลูกค้า</DialogTitle>
          <DialogDescription>
            ข้อมูลวัสดุ ยอดสรุป และรายการรับ-จ่ายของงวดที่เลือก
            รวมถึงการแก้ไขในฉบับร่างที่ยังไม่ได้บันทึกลงฐานข้อมูล
          </DialogDescription>
        </div>

        <div className="min-w-0 space-y-5">
          {readOnly ? (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
            >
              ขณะนี้สามารถเปิดดูข้อมูลได้เท่านั้น
              ไม่สามารถแก้ไขหรือบันทึกข้อมูลได้
            </p>
          ) : (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              การแก้ไขผ่านฟอร์มจะอยู่ในฉบับร่าง กรุณากดบันทึกข้อมูลจากหน้าหลัก
              เพื่อจัดเก็บลงฐานข้อมูล
            </p>
          )}

          <section className="space-y-3 rounded-xl border border-border bg-muted/25 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold">ข้อมูลวัสดุ</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={readOnly}
                onClick={onEditMaterial}
              >
                <Pencil className="size-4" aria-hidden="true" />
                แก้ไขวัสดุ
              </Button>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">งวดข้อมูล</dt>
                <dd className="mt-1 wrap-break-word text-sm font-medium">
                  {period.label} ({row.sheet_name})
                </dd>
              </div>
              {materialFields.map((field) => (
                <div
                  key={field.label}
                  className={
                    field.wide
                      ? "min-w-0 sm:col-span-2 lg:col-span-3"
                      : "min-w-0"
                  }
                >
                  <dt className="text-xs text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap wrap-break-word text-sm font-medium">
                    {displayValue(field.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold">ยอดสรุปและตรวจนับ</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={readOnly}
                onClick={onEditCount}
              >
                <ClipboardCheck className="size-4" aria-hidden="true" />
                บันทึกตรวจนับ
              </Button>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CUSTOMER_MATERIALS_SUMMARY_FIELDS.map((field) => (
                <div
                  key={field}
                  className="min-w-0 space-y-1 rounded-lg border border-border bg-background p-3"
                >
                  <dt className="text-xs text-muted-foreground">
                    {CUSTOMER_MATERIALS_SUMMARY_LABELS[field]}
                  </dt>
                  <dd className="whitespace-pre-wrap wrap-break-word text-base font-semibold tabular-nums">
                    {displayValue(row.summary[field])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              หน่วยนับ: {displayValue(row.item.unit)} ·
              แสดงยอดตามข้อมูลปัจจุบันของรายการ
              ไม่คำนวณยอดคงเหลือหรือผลต่างอัตโนมัติ
            </p>
            <div className="min-w-0 rounded-lg border border-border bg-muted/25 p-3">
              <h4 className="text-xs font-medium text-muted-foreground">
                หมายเหตุ
              </h4>
              <p className="mt-1 whitespace-pre-wrap wrap-break-word text-sm">
                {displayValue(row.remark)}
              </p>
            </div>
          </section>

          <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <h3 className="text-sm font-semibold">รับ-จ่ายรายวัน</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {row.daily.length} ช่องวันที่มีข้อมูล
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCarryover
                ? "ชีตยอดยกมาแสดงตามช่องวันที่ 1–31 ใน Excel โดยไม่สมมติเดือนหรือวันที่จริง"
                : "แสดงวันตามปฏิทินของงวดนี้ หากมีข้อมูลต้นฉบับนอกงวดจะแสดงไว้เพื่ออ้างอิงเท่านั้น"}
            </p>
            {row.daily.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                {readOnly
                  ? "ยังไม่มีข้อมูลรับ-จ่ายในงวดนี้"
                  : "ยังไม่มีข้อมูลรับ-จ่ายในงวดนี้ สามารถเลือกวันที่เพื่อเพิ่มลงฉบับร่างได้"}
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className="min-w-165 text-xs">
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="min-w-36">
                      {isCarryover ? "ช่องวันที่ตาม Excel" : "วันที่"}
                    </TableHead>
                    {CUSTOMER_MATERIALS_DAILY_FIELDS.map((field) => (
                      <TableHead key={field} className="min-w-24 text-right">
                        {CUSTOMER_MATERIALS_DAILY_LABELS[field]}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-24 text-center">
                      จัดการ
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {days.map((day) => {
                    const entry = dailyByDay.get(day);
                    const isEditableDay = editableDaySet.has(day);
                    const date = customerMaterialsDateForDay(
                      row.sheet_name,
                      day,
                    );
                    const dayLabel = isCarryover
                      ? `ช่องวันที่ ${day}`
                      : (date ?? `ช่องวันที่ ${day} (นอกงวด)`);

                    return (
                      <TableRow
                        key={day}
                        className={entry ? "bg-primary/5" : undefined}
                      >
                        <TableCell className="whitespace-nowrap font-medium tabular-nums">
                          {dayLabel}
                        </TableCell>
                        {CUSTOMER_MATERIALS_DAILY_FIELDS.map((field) => (
                          <TableCell
                            key={field}
                            className="whitespace-pre-wrap wrap-break-word text-right tabular-nums"
                          >
                            {displayValue(entry?.values[field])}
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {isEditableDay ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={readOnly}
                              aria-label={`${entry ? "แก้ไข" : "บันทึก"}รับ-จ่าย ${dayLabel}`}
                              onClick={() => onEditDaily(day)}
                            >
                              {entry ? (
                                <Pencil className="size-4" aria-hidden="true" />
                              ) : (
                                <Plus className="size-4" aria-hidden="true" />
                              )}
                              {entry ? "แก้ไข" : "บันทึก"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              ดูเท่านั้น
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              ปิด
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
