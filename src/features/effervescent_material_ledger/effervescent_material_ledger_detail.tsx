"use client";

import { Pencil, Printer, X } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
  EFFERVESCENT_MATERIAL_FIELD_LABELS,
  EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT,
  EFFERVESCENT_MATERIAL_QUANTITY_FIELDS,
  type EffervescentMaterialLedgerSheet,
} from "./effervescent_material_ledger_domain";

/**
 * UI MOCK ONLY
 *
 * หน้ารายละเอียดแบบอ่านอย่างเดียว
 * ไม่เรียก API, ไม่แก้ไขข้อมูล และไม่คำนวณยอดคงเหลือ
 * การแก้ไขและพรีวิวก่อนพิมพ์เป็นหน้าที่ของ Workspace
 */

type Props = {
  sheet: EffervescentMaterialLedgerSheet | null;
  onClose: () => void;
  onEdit: (sheet: EffervescentMaterialLedgerSheet) => void;
  onPrint: (sheet: EffervescentMaterialLedgerSheet) => void;
};

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Bangkok",
});

const headerClass =
  "h-auto border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold " +
  "whitespace-normal text-foreground";

const cellClass =
  "border border-border px-3 py-2 align-middle whitespace-normal";

function displayText(value: string): string {
  return value.trim() || "-";
}

function formatRecordDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return "-";
  }

  return dateFormatter.format(date);
}

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? dateTimeFormatter.format(date)
    : "-";
}

export function EffervescentMaterialLedgerDetail({
  sheet,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  return (
    <Dialog
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className={
          "flex max-h-[94dvh] w-[96vw] max-w-none " +
          "flex-col gap-4 overflow-hidden p-4 " +
          "sm:max-w-350 sm:p-6"
        }
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            รายละเอียดการรับ - จ่าย วัตถุดิบเม็ดฟู่
          </DialogTitle>
          <DialogDescription>
            แสดงข้อมูลแบบอ่านอย่างเดียว · UI Mock ไม่เชื่อมฐานข้อมูล
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
          {sheet && (
            <>
              <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="space-y-1">
                    <h2 className="font-semibold text-foreground">
                      {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.company_name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.title}
                    </p>
                  </div>
                  <span className="rounded-md border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
                    {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.form_code}
                  </span>
                </div>

                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">รหัสเอกสาร (Mock)</dt>
                    <dd className="break-all font-medium">
                      {displayText(sheet.id)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">วันที่บันทึก</dt>
                    <dd className="font-medium tabular-nums">
                      {formatRecordDate(sheet.record_date)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">จำนวนวัตถุดิบ</dt>
                    <dd className="font-medium tabular-nums">
                      {sheet.rows.length} รายการ
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">แก้ไขล่าสุด</dt>
                    <dd className="font-medium tabular-nums">
                      {formatDateTime(sheet.updated_at)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
                <div>
                  <h3 className="font-semibold text-foreground">
                    รายการรับ - จ่าย วัตถุดิบ
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ค่าทุกช่องแสดงตามที่บันทึกไว้ ไม่คำนวณยอดคงเหลือและไม่ตีความช่องปรับค่า
                  </p>
                </div>

                <div
                  tabIndex={0}
                  role="region"
                  aria-label="ตารางรายละเอียดวัตถุดิบ เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"
                  className="min-w-0 overflow-x-auto rounded-lg border border-border"
                >
                  <Table className="min-w-[1540px] table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-14" />
                      <col className="w-36" />
                      <col className="w-64" />
                      <col className="w-16" />
                      {EFFERVESCENT_MATERIAL_QUANTITY_FIELDS.map((field) => (
                        <col key={field} className="w-36" />
                      ))}
                      <col className="w-56" />
                    </colgroup>

                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          No.
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          CODE
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          รายชื่อวัตถุดิบ
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          หน่วย
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          ยอดยกมา
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          รับเข้า (+)
                        </TableHead>
                        <TableHead colSpan={3} scope="colgroup" className={headerClass}>
                          จ่าย (-)
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          ยอดคงเหลือ
                        </TableHead>
                        <TableHead rowSpan={2} scope="col" className={headerClass}>
                          หมายเหตุ
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        {([
                          "production_use",
                          "adjustment",
                          "discarded",
                        ] as const).map((field) => (
                          <TableHead key={field} scope="col" className={headerClass}>
                            {EFFERVESCENT_MATERIAL_FIELD_LABELS[field]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {sheet.rows.length > 0 ? (
                        sheet.rows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className={`${cellClass} text-center tabular-nums`}>
                              {row.no}
                            </TableCell>
                            <TableCell className={`${cellClass} font-medium`}>
                              {displayText(row.code)}
                            </TableCell>
                            <TableCell className={cellClass}>
                              {displayText(row.material_name)}
                            </TableCell>
                            <TableCell className={`${cellClass} text-center`}>
                              {displayText(row.unit)}
                            </TableCell>
                            {EFFERVESCENT_MATERIAL_QUANTITY_FIELDS.map((field) => (
                              <TableCell
                                key={field}
                                className={`${cellClass} text-right tabular-nums`}
                              >
                                {displayText(row[field])}
                              </TableCell>
                            ))}
                            <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                              {displayText(row.remark)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="px-4 py-8 text-center text-sm text-muted-foreground"
                          >
                            ไม่มีรายการวัตถุดิบ
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
                <h3 className="font-semibold text-foreground">
                  รายการผลิตและผู้ลงนาม
                </h3>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0 space-y-1 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">รายการผลิต</dt>
                    <dd className="whitespace-pre-wrap wrap-break-word font-medium">
                      {displayText(sheet.production_list)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">ผู้จัดทำ</dt>
                    <dd className="whitespace-pre-wrap wrap-break-word font-medium">
                      {displayText(sheet.prepared_by)}
                    </dd>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs text-muted-foreground">ผู้ตรวจสอบ</dt>
                    <dd className="whitespace-pre-wrap wrap-break-word font-medium">
                      {displayText(sheet.checked_by)}
                    </dd>
                  </div>
                </dl>
              </section>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          {sheet && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onEdit(sheet)}
              >
                <Pencil className="size-4" aria-hidden="true" />
                แก้ไข
              </Button>
              <Button type="button" onClick={() => onPrint(sheet)}>
                <Printer className="size-4" aria-hidden="true" />
                พรีวิวก่อนพิมพ์
              </Button>
            </>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="size-4" aria-hidden="true" />
              ปิด
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
