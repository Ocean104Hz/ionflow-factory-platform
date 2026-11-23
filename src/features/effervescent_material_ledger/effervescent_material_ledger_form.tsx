"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Textarea } from "@/src/components/ui/textarea";
import { SectionCard } from "@/src/components/factory/patterns";

import {
  EFFERVESCENT_MATERIAL_FIELD_LABELS,
  EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT,
  EFFERVESCENT_MATERIAL_QUANTITY_FIELDS,
  type EffervescentMaterialLedgerRow,
  type EffervescentMaterialLedgerSheet,
  type EffervescentMaterialQuantityField,
} from "./effervescent_material_ledger_domain";

type Props = {
  sheet: EffervescentMaterialLedgerSheet;
  onChange: (sheet: EffervescentMaterialLedgerSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type DocumentField =
  | "record_date"
  | "production_list"
  | "prepared_by"
  | "checked_by";

const headerClass =
  "h-auto border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold " +
  "whitespace-normal text-foreground";

const cellClass =
  "border border-border px-2 py-2 align-middle whitespace-normal";

function QuantityInput({
  row,
  field,
  onChange,
}: {
  row: EffervescentMaterialLedgerRow;
  field: EffervescentMaterialQuantityField;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={`${row.code} ${EFFERVESCENT_MATERIAL_FIELD_LABELS[field]}`}
      value={row[field]}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder="-"
      className="h-9 min-w-0 bg-surface text-right text-sm tabular-nums"
    />
  );
}

export function EffervescentMaterialLedgerForm({
  sheet,
  onChange,
  onSave,
  onReset,
}: Props) {
  function updateDocument(field: DocumentField, value: string) {
    onChange({
      ...sheet,
      [field]: value,
    });
  }

  function updateQuantity(
    rowId: string,
    field: EffervescentMaterialQuantityField,
    value: string,
  ) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    });
  }

  function updateRemark(rowId: string, value: string) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.id === rowId ? { ...row, remark: value } : row,
      ),
    });
  }

  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SectionCard
        title="ข้อมูลแบบบันทึก"
        subtitle="แบบบันทึกการรับ - จ่าย วัตถุดิบเม็ดฟู่ (ข้อมูลจำลอง)"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.company_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.title}
              </p>
            </div>
            <span className="rounded-md border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              {EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.form_code}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* วันที่บันทึก */}
            <div className="min-w-0 space-y-2">
              <Label htmlFor="effervescent-record-date">วันที่บันทึก</Label>
              <Input
                id="effervescent-record-date"
                type="date"
                value={sheet.record_date}
                onChange={(event) =>
                  updateDocument("record_date", event.currentTarget.value)
                }
                className="bg-surface"
              />
            </div>

            {/* รหัสแบบฟอร์ม */}
            <div className="min-w-0 space-y-2">
              <Label htmlFor="effervescent-form-code">รหัสแบบฟอร์ม</Label>
              <Input
                id="effervescent-form-code"
                type="text"
                value={EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.form_code}
                readOnly
                className="bg-muted/40 font-medium text-foreground"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="รายการรับ - จ่าย วัตถุดิบเม็ดฟู่"
        subtitle="กรอกปริมาณตามแบบฟอร์ม Excel โดยไม่มีการคำนวณยอดคงเหลืออัตโนมัติ"
      >
        <div className="min-w-0 space-y-3">
          <p className="text-xs text-muted-foreground">
            ตารางสามารถเลื่อนในแนวนอนได้เมื่อหน้าจอแคบ
            และยอดคงเหลือเป็นช่องกรอกด้วยตนเอง
          </p>
          <div className="min-w-0 overflow-hidden rounded-lg border border-border">
            <Table className="min-w-[1660px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-36" />
                <col className="w-64" />
                <col className="w-18" />
                {EFFERVESCENT_MATERIAL_QUANTITY_FIELDS.map((field) => (
                  <col key={field} className="w-36" />
                ))}
                <col className="w-60" />
              </colgroup>

              <TableHeader>
                <TableRow>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    No.
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    CODE
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    รายชื่อวัตถุดิบ
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    หน่วย
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    ยอดยกมา
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    รับเข้า (+)
                  </TableHead>
                  <TableHead
                    scope="colgroup"
                    colSpan={3}
                    className={headerClass}
                  >
                    จ่าย (-)
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    ยอดคงเหลือ
                  </TableHead>
                  <TableHead scope="col" rowSpan={2} className={headerClass}>
                    หมายเหตุ
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead scope="col" className={headerClass}>
                    ใช้ผลิต
                  </TableHead>
                  <TableHead scope="col" className={headerClass}>
                    ปรับค่า
                  </TableHead>
                  <TableHead scope="col" className={headerClass}>
                    ทิ้ง (เสีย)
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sheet.rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-8 text-center text-muted-foreground"
                    >
                      ยังไม่มีรายการวัตถุดิบในเอกสารนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  sheet.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell
                        className={`${cellClass} text-center tabular-nums`}
                      >
                        {row.no}
                      </TableCell>
                      <TableCell className={`${cellClass} font-medium`}>
                        {row.code}
                      </TableCell>
                      <TableCell className={cellClass}>
                        {row.material_name}
                      </TableCell>
                      <TableCell className={`${cellClass} text-center`}>
                        {row.unit}
                      </TableCell>

                      {EFFERVESCENT_MATERIAL_QUANTITY_FIELDS.map((field) => (
                        <TableCell key={field} className={cellClass}>
                          <QuantityInput
                            row={row}
                            field={field}
                            onChange={(value) =>
                              updateQuantity(row.id, field, value)
                            }
                          />
                        </TableCell>
                      ))}

                      <TableCell className={cellClass}>
                        <Input
                          type="text"
                          aria-label={`${row.code} หมายเหตุ`}
                          value={row.remark}
                          onChange={(event) =>
                            updateRemark(row.id, event.currentTarget.value)
                          }
                          placeholder="ระบุหมายเหตุ"
                          className="bg-surface text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="รายการผลิตและการลงชื่อ"
        subtitle="ข้อมูลส่วนท้ายตามแบบฟอร์มต้นฉบับ"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="effervescent-production-list">รายการผลิต</Label>
            <Textarea
              id="effervescent-production-list"
              value={sheet.production_list}
              onChange={(event) =>
                updateDocument("production_list", event.currentTarget.value)
              }
              rows={3}
              placeholder="ระบุรายการผลิต"
              className="min-h-24 resize-y bg-surface"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="effervescent-prepared-by">ผู้จัดทำ</Label>
              <Input
                id="effervescent-prepared-by"
                value={sheet.prepared_by}
                onChange={(event) =>
                  updateDocument("prepared_by", event.currentTarget.value)
                }
                placeholder="ชื่อผู้จัดทำ"
                className="bg-surface"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="effervescent-checked-by">ผู้ตรวจสอบ</Label>
              <Input
                id="effervescent-checked-by"
                value={sheet.checked_by}
                onChange={(event) =>
                  updateDocument("checked_by", event.currentTarget.value)
                }
                placeholder="ชื่อผู้ตรวจสอบ"
                className="bg-surface"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {sheet.id ? "ยกเลิกการแก้ไข / เริ่มใหม่" : "ล้างข้อมูล"}
        </Button>
        <Button type="submit">
          {sheet.id ? "บันทึกการแก้ไข (Mock)" : "บันทึกข้อมูล (Mock)"}
        </Button>
      </div>
    </form>
  );
}
