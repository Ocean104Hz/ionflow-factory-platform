"use client";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { SectionCard } from "@/src/components/factory/patterns";

import {
  WIP_FORM_CODE,
  WIP_MASTER_ITEMS,
  WIP_QUANTITY_FIELDS,
  calculateWipClosingBalance,
  getWipItemDisplayName,
  type WipErrors,
  type WipItemId,
  type WipQuantityField,
  type WipReceivingIssuingSheet,
  type WipRowField,
} from "./wip_receiving_issuing_domain";

type Props = {
  sheet: WipReceivingIssuingSheet;
  errors: WipErrors;
  onChange: (sheet: WipReceivingIssuingSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type QuantityFieldProps = {
  itemId: WipItemId;
  field: WipQuantityField;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const text = {
  title: "บันทึกการรับ-จ่าย WIP",
  subtitle: "",
  date: "วันที่เอกสาร",
  code: "รหัสแบบฟอร์ม",
  number: "ลำดับ",
  item: "รายการ",
  unit: "หน่วย",
  opening: "ยอดยกมา",
  received: "รับ",
  issued: "จ่าย (-)",
  production: "ผลิต",
  product: "สินค้า",
  transfer: "โอน",
  closing: "คงเหลือ",
  remark: "หมายเหตุ",
  remarkPlaceholder: "ระบุหมายเหตุ",
  prepared: "ผู้จัดทำ",
  checked: "ผู้ตรวจสอบ",
  preparedPlaceholder: "ระบุชื่อผู้จัดทำ",
  checkedPlaceholder: "ระบุชื่อผู้ตรวจสอบ",
  note: "",
  fixed: "",
  uncertain: "",
  missing: "",
  save: "บันทึกข้อมูล",
  saveEdit: "บันทึกการแก้ไข",
  reset: "ล้างข้อมูล",
  cancel: "ยกเลิกการแก้ไข / เริ่มใหม่",
  mock: "ข้อมูลจะบันทึกเมื่อกดบันทึกเอกสาร",
} as const;

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle";
const numberClass =
  "w-full min-w-0 border-border bg-surface text-right text-sm tabular-nums";

const quantityColumns: readonly {
  field: WipQuantityField;
  label: string;
}[] = [
  { field: "opening_balance", label: text.opening },
  { field: "received", label: text.received },
  { field: "issued_for_production", label: text.production },
  { field: "issued_as_product", label: text.product },
  { field: "transferred_out", label: text.transfer },
];

function formatBalance(balance: string): string {
  const [whole, fraction] = balance.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

function QuantityField({
  itemId,
  field,
  label,
  value,
  error,
  onChange,
}: QuantityFieldProps) {
  const id = `wip-${itemId}-${field}`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 space-y-1">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={`${getWipItemDisplayName(itemId)}: ${label}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="0"
        className={numberClass}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function WipReceivingIssuingForm({
  sheet,
  errors,
  onChange,
  onSave,
  onReset,
}: Props) {
  function updateRow(itemId: WipItemId, field: WipRowField, value: string) {
    onChange({
      ...sheet,
      rows: sheet.rows.map((row) =>
        row.item_id === itemId ? { ...row, [field]: value } : row,
      ),
    });
  }

  const hasUnconfirmedNames = WIP_MASTER_ITEMS.some(
    (item) => item.name === null,
  );

  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SectionCard title={text.title} subtitle={text.subtitle}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="wip-document-date"
                className="block text-sm font-medium leading-5"
              >
                {text.date} <span className="text-danger">*</span>
              </label>
              <Input
                id="wip-document-date"
                type="date"
                value={sheet.document_date}
                aria-invalid={Boolean(errors.document_date)}
                aria-describedby={
                  errors.document_date ? "wip-document-date-error" : undefined
                }
                onChange={(event) =>
                  onChange({
                    ...sheet,
                    document_date: event.currentTarget.value,
                  })
                }
                className="h-9 w-full border-border bg-surface"
              />
              {errors.document_date && (
                <p
                  id="wip-document-date-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.document_date}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-sm font-medium leading-5">{text.code}</p>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium">
                {WIP_FORM_CODE}
              </div>
            </div>
          </div>

          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{text.fixed}</p>
            <p>{text.note}</p>
            {hasUnconfirmedNames && (
              <p className="font-medium text-warning" role="status">
                {text.uncertain}
              </p>
            )}
          </div>

          {errors.rows && (
            <p role="alert" className="text-sm text-danger">
              {errors.rows}
            </p>
          )}

          <div className="min-w-0 rounded-lg border border-border">
            <Table className="w-full min-w-377.5 table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-14" />
                <col className="w-54" />
                <col className="w-20" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-36" />
                <col className="w-56" />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.number}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.item}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.unit}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.opening}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.received}
                  </TableHead>
                  <TableHead colSpan={3} className={headerClass}>
                    {text.issued}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.closing}
                  </TableHead>
                  <TableHead rowSpan={2} className={headerClass}>
                    {text.remark}
                  </TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className={headerClass}>
                    {text.production}
                  </TableHead>
                  <TableHead className={headerClass}>{text.product}</TableHead>
                  <TableHead className={headerClass}>{text.transfer}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WIP_MASTER_ITEMS.map((item, index) => {
                  const row = sheet.rows[index];

                  if (!row || row.item_id !== item.id) {
                    return (
                      <TableRow key={item.id}>
                        <TableCell colSpan={10} className={cellClass}>
                          <p role="alert" className="text-danger">
                            {text.missing}
                          </p>
                          {errors[`rows.${index}.item_id`] && (
                            <p className="text-xs text-danger">
                              {errors[`rows.${index}.item_id`]}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const balance = calculateWipClosingBalance(row);
                  const hasAmounts = WIP_QUANTITY_FIELDS.some(
                    (field) => row[field].trim() !== "",
                  );
                  const balanceError = errors[`rows.${index}.closing_balance`];
                  const isNegative =
                    balance !== null && balance.startsWith("-");

                  return (
                    <TableRow key={item.id} className="align-middle">
                      <TableCell
                        className={`${cellClass} text-center tabular-nums`}
                      >
                        {index + 1}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <div className="font-medium">
                          {getWipItemDisplayName(item.id)}
                        </div>
                      </TableCell>
                      <TableCell className={`${cellClass} text-center`}>
                        {item.unit}
                      </TableCell>
                      {quantityColumns.map((column) => (
                        <TableCell key={column.field} className={cellClass}>
                          <QuantityField
                            itemId={item.id}
                            field={column.field}
                            label={column.label}
                            value={row[column.field]}
                            error={errors[`rows.${index}.${column.field}`]}
                            onChange={(value) =>
                              updateRow(item.id, column.field, value)
                            }
                          />
                        </TableCell>
                      ))}
                      <TableCell
                        className={`${cellClass} text-right align-middle`}
                      >
                        <output
                          aria-label={`${getWipItemDisplayName(item.id)}: ${text.closing}`}
                          className={[
                            "block font-semibold tabular-nums",
                            isNegative || balanceError
                              ? "text-danger"
                              : "text-foreground",
                          ].join(" ")}
                        >
                          {hasAmounts && balance !== null
                            ? formatBalance(balance)
                            : "-"}
                        </output>
                        {balanceError && (
                          <p
                            role="alert"
                            className="mt-1 text-left text-xs text-danger"
                          >
                            {balanceError}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={cellClass}>
                        <Textarea
                          id={`wip-${item.id}-remark`}
                          aria-label={`${getWipItemDisplayName(item.id)}: ${text.remark}`}
                          value={row.remark}
                          onChange={(event) =>
                            updateRow(
                              item.id,
                              "remark",
                              event.currentTarget.value,
                            )
                          }
                          placeholder={text.remarkPlaceholder}
                          rows={2}
                          className="min-h-10 w-full min-w-0 resize-y border-border bg-surface text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`${text.prepared} / ${text.checked}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label htmlFor="wip-prepared-by" className="text-sm font-medium">
              {text.prepared}
            </label>
            <Input
              id="wip-prepared-by"
              value={sheet.prepared_by}
              onChange={(event) =>
                onChange({ ...sheet, prepared_by: event.currentTarget.value })
              }
              placeholder={text.preparedPlaceholder}
              className="w-full border-border bg-surface"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label htmlFor="wip-checked-by" className="text-sm font-medium">
              {text.checked}
            </label>
            <Input
              id="wip-checked-by"
              value={sheet.checked_by}
              onChange={(event) =>
                onChange({ ...sheet, checked_by: event.currentTarget.value })
              }
              placeholder={text.checkedPlaceholder}
              className="w-full border-border bg-surface"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {sheet.id ? text.cancel : text.reset}
        </Button>
        <Button type="submit">{sheet.id ? text.saveEdit : text.save}</Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{text.mock}</p>
    </form>
  );
}
