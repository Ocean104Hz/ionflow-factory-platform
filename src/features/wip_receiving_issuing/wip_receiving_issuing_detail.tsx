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
  WIP_FORM_CODE,
  WIP_MASTER_ITEMS,
  calculateWipClosingBalance,
  formatWipDate,
  formatWipDateTime,
  getWipItemDisplayName,
  type WipReceivingIssuingSheet,
} from "./wip_receiving_issuing_domain";
import { WipReceivingIssuingPaper } from "./wip_receiving_issuing_paper";

/* ---------------- types ---------------- */

type Props = {
  sheet: WipReceivingIssuingSheet | null;
  print: boolean;
  onClose: () => void;
  onEdit: (sheet: WipReceivingIssuingSheet) => void;
  onPrint: (sheet: WipReceivingIssuingSheet) => void;
};

/* ---------------- labels ---------------- */

const labels = {
  detailTitle: "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e23\u0e31\u0e1a-\u0e08\u0e48\u0e32\u0e22 WIP",
  printTitle: "\u0e1e\u0e23\u0e35\u0e27\u0e34\u0e27\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23 WIP",
  detailDescription: "\u0e41\u0e2a\u0e14\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e41\u0e1a\u0e1a\u0e2d\u0e48\u0e32\u0e19\u0e2d\u0e22\u0e48\u0e32\u0e07\u0e40\u0e14\u0e35\u0e22\u0e27",
  printDescription: "\u0e1e\u0e23\u0e35\u0e27\u0e34\u0e27\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e01\u0e48\u0e2d\u0e19\u0e1e\u0e34\u0e21\u0e1e\u0e4c",
  mock: "UI MOCK \u0e44\u0e21\u0e48\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e10\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e08\u0e23\u0e34\u0e07",
  document: "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e23\u0e31\u0e1a-\u0e08\u0e48\u0e32\u0e22 WIP",
  documentDate: "\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23",
  documentId: "\u0e23\u0e2b\u0e31\u0e2a\u0e40\u0e2d\u0e01\u0e2a\u0e32\u0e23\u0e20\u0e32\u0e22\u0e43\u0e19",
  count: "\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23 WIP",
  prepared: "\u0e1c\u0e39\u0e49\u0e08\u0e31\u0e14\u0e17\u0e33",
  checked: "\u0e1c\u0e39\u0e49\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a",
  created: "\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01",
  updated: "\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14",
  number: "\u0e25\u0e33\u0e14\u0e31\u0e1a",
  item: "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23",
  unit: "\u0e2b\u0e19\u0e48\u0e27\u0e22",
  opening: "\u0e22\u0e2d\u0e14\u0e22\u0e01\u0e21\u0e32",
  received: "\u0e23\u0e31\u0e1a",
  issued: "\u0e08\u0e48\u0e32\u0e22 (-)",
  production: "\u0e1c\u0e25\u0e34\u0e15",
  product: "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
  transfer: "\u0e42\u0e2d\u0e19",
  closing: "\u0e04\u0e07\u0e40\u0e2b\u0e25\u0e37\u0e2d",
  remark: "\u0e2b\u0e21\u0e32\u0e22\u0e40\u0e2b\u0e15\u0e38",
  edit: "\u0e41\u0e01\u0e49\u0e44\u0e02",
  preview: "\u0e1e\u0e23\u0e35\u0e27\u0e34\u0e27\u0e01\u0e48\u0e2d\u0e19\u0e1e\u0e34\u0e21\u0e1e\u0e4c",
  close: "\u0e1b\u0e34\u0e14",
} as const;

/* ---------------- styles ---------------- */

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold text-foreground whitespace-normal";

const cellClass = "border border-border p-2 align-middle text-sm";
const numberCellClass = `${cellClass} text-right tabular-nums`;

/* ---------------- helpers ---------------- */

function displayText(value: string): string {
  return value.trim() || "-";
}

function displayQuantity(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "-";
  }

  const normalized = trimmed.replaceAll(",", "");
  const [whole, fraction] = normalized.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}

/* ---------------- component ---------------- */

export function WipReceivingIssuingDetail({
  sheet,
  print,
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
      <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-none flex-col gap-4 overflow-hidden p-4 sm:max-w-350 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>{print ? labels.printTitle : labels.detailTitle}</DialogTitle>
          <DialogDescription>
            {print ? labels.printDescription : labels.detailDescription}
            {" \u00b7 "}
            {labels.mock}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {sheet &&
            (print ? (
              <div className="min-w-max">
                <WipReceivingIssuingPaper sheet={sheet} />
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{labels.document}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {WIP_FORM_CODE}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {labels.documentDate}: {formatWipDate(sheet.document_date) || "-"}
                    </p>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      { label: labels.documentId, value: sheet.id },
                      { label: labels.prepared, value: sheet.prepared_by },
                      { label: labels.checked, value: sheet.checked_by },
                      { label: labels.created, value: formatWipDateTime(sheet.created_at) },
                      { label: labels.updated, value: formatWipDateTime(sheet.updated_at) },
                      { label: labels.count, value: String(sheet.rows.length) },
                    ].map((field) => (
                      <div key={field.label} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{field.label}</dt>
                        <dd className="mt-1 wrap-break-word font-medium">
                          {displayText(field.value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="min-w-0 rounded-lg border border-border bg-surface p-4">
                  <h3 className="mb-3 font-semibold">{labels.count}</h3>
                  <div className="max-w-full overflow-x-auto rounded-lg border border-border">
                    <Table className="w-full min-w-275 table-fixed border-collapse">
                      <caption className="sr-only">{labels.document}</caption>
                      <colgroup>
                        <col className="w-[5%]" />
                        <col className="w-[14%]" />
                        <col className="w-[7%]" />
                        <col className="w-[10%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[9%]" />
                        <col className="w-[10%]" />
                        <col className="w-[18%]" />
                      </colgroup>
                      <TableHeader>
                        <TableRow>
                          <TableHead rowSpan={2} className={headerClass}>{labels.number}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.item}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.unit}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.opening}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.received}</TableHead>
                          <TableHead colSpan={3} className={headerClass}>{labels.issued}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.closing}</TableHead>
                          <TableHead rowSpan={2} className={headerClass}>{labels.remark}</TableHead>
                        </TableRow>
                        <TableRow>
                          <TableHead className={headerClass}>{labels.production}</TableHead>
                          <TableHead className={headerClass}>{labels.product}</TableHead>
                          <TableHead className={headerClass}>{labels.transfer}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {WIP_MASTER_ITEMS.map((item, index) => {
                          const row = sheet.rows.find((entry) => entry.item_id === item.id);
                          const balance = row
                            ? calculateWipClosingBalance(row)
                            : null;

                          return (
                            <TableRow key={item.id} className="align-middle">
                              <TableCell className={`${cellClass} text-center tabular-nums`}>
                                {index + 1}
                              </TableCell>
                              <TableCell className={`${cellClass} wrap-break-word`}>
                                {getWipItemDisplayName(item.id)}
                              </TableCell>
                              <TableCell className={`${cellClass} text-center`}>
                                {item.unit}
                              </TableCell>
                              <TableCell className={numberCellClass}>
                                {displayQuantity(row?.opening_balance ?? "")}
                              </TableCell>
                              <TableCell className={numberCellClass}>
                                {displayQuantity(row?.received ?? "")}
                              </TableCell>
                              <TableCell className={numberCellClass}>
                                {displayQuantity(row?.issued_for_production ?? "")}
                              </TableCell>
                              <TableCell className={numberCellClass}>
                                {displayQuantity(row?.issued_as_product ?? "")}
                              </TableCell>
                              <TableCell className={numberCellClass}>
                                {displayQuantity(row?.transferred_out ?? "")}
                              </TableCell>
                              <TableCell className={`${numberCellClass} font-semibold`}>
                                {displayQuantity(balance ?? "")}
                              </TableCell>
                              <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                                {displayText(row?.remark ?? "")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </section>
              </div>
            ))}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          {sheet && (
            <>
              <Button type="button" variant="outline" onClick={() => onEdit(sheet)}>
                <Pencil className="size-4" aria-hidden="true" />
                {labels.edit}
              </Button>
              {!print && (
                <Button type="button" onClick={() => onPrint(sheet)}>
                  <Printer className="size-4" aria-hidden="true" />
                  {labels.preview}
                </Button>
              )}
            </>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="size-4" aria-hidden="true" />
              {labels.close}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
