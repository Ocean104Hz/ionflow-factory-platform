"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/src/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/src/components/ui/table";
import { SectionCard } from "@/src/components/factory/patterns";
import { formatThaiBuddhistDate } from "./document-number";
import {
  RECEIVING_UNITS,
  calculateReceivingTotals,
  formatMoneyCents,
  itemAmountCents,
  type ReceivingItem,
  type ReceivingItemField,
  type ReceivingValidation,
} from "./receiving-domain";

const headers = [
  "ประเภท", "ลำดับ", "จำนวน", "หน่วยนับ", "รายการ", "วันที่แจ้งสั่งซื้อ",
  "รหัสวัตถุดิบ", "จำนวนเงินต่อหน่วย (บาท)", "ราคารวม (บาท)", "จัดการ",
] as const;

const tableInput = "h-9 bg-surface text-sm";

export function ReceivingItemsSection({
  items,
  onChange,
  onAdd,
  note,
  onNoteChange,
  validation,
}: {
  items: ReceivingItem[];
  onChange: (items: ReceivingItem[]) => void;
  onAdd: () => void;
  note: string;
  onNoteChange: (note: string) => void;
  validation: ReceivingValidation | null;
}) {
  const totals = calculateReceivingTotals(items);

  function changeItem(id: string, patch: Partial<ReceivingItem>) {
    onChange(items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  const quantityLabel = totals.quantities.length === 0
    ? "0"
    : totals.quantities.map(({ unit, quantity }) => `${quantity} ${unit}`).join(" · ");

  return (
    <SectionCard
      title="รายการสินค้า"
      subtitle="เพิ่มรายการรับวัตถุดิบได้หลายแถว และระบบคำนวณราคาแต่ละแถวอัตโนมัติ"
      contentClassName="space-y-4"
    >
      {validation?.general ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {validation.general}
        </p>
      ) : null}

      <div role="region" tabIndex={0} aria-label="ตารางรายการสินค้า เลื่อนแนวนอนเพื่อดูทุกช่อง" className="w-full max-w-full overflow-x-auto">
        <Table className="min-w-[1540px]">
          <TableHeader className="bg-surface-muted">
            <TableRow>
              {headers.map((heading, i) => (
                <TableHead key={heading} className={`h-12 px-3 text-xs leading-relaxed font-medium whitespace-normal ${i === 9 ? "text-center" : i === 1 || i === 0 ? "text-center" : i >= 7 ? "text-right" : "text-left"}`}>
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const rowErrors = validation?.items[item.id];
              const amount = itemAmountCents(item);
              const error = (key: ReceivingItemField) => rowErrors?.[key];
              const rowLabel = `รายการที่ ${index + 1}`;
              return (
                <TableRow key={item.id} className="align-top">
                  <TableCell className="px-3 py-3 text-center">
                    <Badge variant="outline" className="mt-1 font-normal text-muted-foreground">manual</Badge>
                  </TableCell>
                  <TableCell className="px-3 py-3 text-center tabular-nums">{index + 1}</TableCell>
                  <TableCell className="w-[150px] min-w-[150px] px-2 py-3">
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      inputMode="decimal"
                      className={`${tableInput} tabular-nums`}
                      placeholder="0"
                      aria-label={`จำนวน ${rowLabel}`}
                      aria-invalid={Boolean(error("quantity"))}
                      value={item.quantity}
                      onChange={(event) => changeItem(item.id, { quantity: event.target.value })}
                    />
                    {error("quantity") && <p className="mt-1 text-xs text-destructive" role="alert">{error("quantity")}</p>}
                  </TableCell>
                  <TableCell className="w-[140px] min-w-[140px] px-2 py-3">
                    <Select value={item.unit} onValueChange={(unit) => changeItem(item.id, { unit })}>
                      <SelectTrigger aria-label={`หน่วยนับ ${rowLabel}`} className="w-full bg-surface">
                        <SelectValue placeholder="เลือกหน่วย" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECEIVING_UNITS.map((unit) => <SelectItem value={unit} key={unit}>{unit}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {error("unit") && <p className="mt-1 text-xs text-destructive" role="alert">{error("unit")}</p>}
                  </TableCell>
                  <TableCell className="w-[230px] min-w-[230px] px-2 py-3">
                    <Input
                      className={tableInput}
                      placeholder="ชื่อวัตถุดิบ"
                      aria-label={`รายการ ${rowLabel}`}
                      aria-invalid={Boolean(error("description"))}
                      value={item.description}
                      onChange={(event) => changeItem(item.id, { description: event.target.value })}
                    />
                    {error("description") && <p className="mt-1 text-xs text-destructive" role="alert">{error("description")}</p>}
                  </TableCell>
                  <TableCell className="w-[188px] min-w-[188px] px-2 py-3">
                    <Input
                      type="date"
                      lang="th-TH"
                      className={tableInput}
                      aria-label={`วันที่แจ้งสั่งซื้อ ${rowLabel}`}
                      aria-invalid={Boolean(error("orderNoticeDate"))}
                      value={item.orderNoticeDate}
                      onChange={(event) => changeItem(item.id, { orderNoticeDate: event.target.value })}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatThaiBuddhistDate(item.orderNoticeDate)}</p>
                    {error("orderNoticeDate") && <p className="mt-1 text-xs text-destructive" role="alert">{error("orderNoticeDate")}</p>}
                  </TableCell>
                  <TableCell className="w-[150px] min-w-[150px] px-2 py-3">
                    <Input
                      className={tableInput}
                      placeholder="เช่น RM-001"
                      aria-label={`รหัสวัตถุดิบ ${rowLabel}`}
                      aria-invalid={Boolean(error("materialCode"))}
                      value={item.materialCode}
                      onChange={(event) => changeItem(item.id, { materialCode: event.target.value })}
                    />
                    {error("materialCode") && <p className="mt-1 text-xs text-destructive" role="alert">{error("materialCode")}</p>}
                  </TableCell>
                  <TableCell className="w-[170px] min-w-[170px] px-2 py-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className={`${tableInput} text-right tabular-nums`}
                      placeholder="0.00"
                      aria-label={`จำนวนเงินต่อหน่วย ${rowLabel}`}
                      aria-invalid={Boolean(error("unitPrice"))}
                      value={item.unitPrice}
                      onChange={(event) => changeItem(item.id, { unitPrice: event.target.value })}
                    />
                    {error("unitPrice") && <p className="mt-1 text-xs text-destructive" role="alert">{error("unitPrice")}</p>}
                  </TableCell>
                  <TableCell className="w-[150px] min-w-[150px] px-2 py-3">
                    <Input
                      readOnly
                      tabIndex={-1}
                      value={formatMoneyCents(amount ?? BigInt(0))}
                      aria-label={`ราคารวม ${rowLabel}`}
                      className={`${tableInput} bg-muted/50 text-right font-medium tabular-nums`}
                    />
                  </TableCell>
                  <TableCell className="px-2 py-3 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      aria-label={`ลบ ${rowLabel}`}
                      onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={headers.length} className="py-7 text-center text-muted-foreground">
                  ยังไม่มีรายการ กด “เพิ่มแถว” เพื่อเริ่มกรอก
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="size-4" /> เพิ่มแถว
        </Button>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            รวมจำนวน <strong className="ml-1 font-semibold tabular-nums">{quantityLabel}</strong>
          </div>
          <div className="rounded-md border bg-muted/40 px-3 py-2">
            ราคารวมทั้งหมด <strong className="ml-1 font-semibold tabular-nums">{totals.amountDisplay}</strong> บาท
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t pt-4">
        <Label htmlFor="inbound-items-note">หมายเหตุ</Label>
        <Textarea
          id="inbound-items-note"
          rows={3}
          placeholder="หมายเหตุ..."
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      </div>
    </SectionCard>
  );
}
