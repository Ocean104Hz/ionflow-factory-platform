"use client";

import { useId, useMemo, useState } from "react";
import { Boxes, CalendarDays, ClipboardList, Search } from "lucide-react";

import { PageHeader, SelectField } from "@/src/components/factory/patterns";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/src/components/ui/dialog";
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
import { stockProductsMockWorkbook } from "@/src/lib/mock-data/stock_products";

import {
  datesInStockProductsMonth,
  filterStockProductsRows,
  filterStockProductsSoRows,
  stockProductsRowKey,
  stockProductsSoRowKey,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  type StockProductsDailyField,
  type StockProductsDailyValues,
  type StockProductsSoSheetName,
  type StockProductsStockRow,
  type StockProductsSummaryField,
} from "./stock_products_domain";

/**
 * FF finished-goods workbook: read-only UI mock.
 *
 * The original Excel stock snapshot and all sixteen SO worksheets are shown
 * independently. Nothing in this workspace recalculates or deducts stock,
 * matches SO products to stock records, or persists data outside this module.
 * Stock and SO identities use original sheet/row positions, never product code.
 */

const COPY = {
  title: "สต็อกสินค้า",
  desc: "ข้อมูลสต็อกสินค้าจาก Excel พร้อมรายการ SO ทั้ง 16 ชีต",
  readonly: "UI MOCK · อ่านอย่างเดียว",
  source: "ข้อมูลต้นฉบับ",
  stock: "สต็อกสินค้าคงเหลือ",
  so: "รายการ SO",
  productCount: "รายการสินค้า",
  dailyCount: "รายการรับ-จ่ายรายวัน",
  soCount: "บรรทัดรายการ SO",
  soSheets: "ชีต SO",
  stockSearch: "ค้นหาสินค้า",
  stockPlaceholder: "ค้นหารหัสสินค้า ชื่อ หรือประเภท",
  soSearch: "ค้นหารายการ SO",
  soPlaceholder: "ชื่อลูกค้า เลข SO หรือชื่อสินค้า",
  pickSheet: "เลือกชีต SO",
  allSheets: "ทุกชีต",
  noStock: "ไม่พบรายการสินค้าที่ตรงกับการค้นหา",
  noSo: "ไม่พบรายการ SO ในชีตหรือตัวกรองที่เลือก",
  dailyButton: "ดูรายวัน",
  dailyTitle: "รายละเอียดรับ-จ่ายรายวัน",
  dateRaw: "วันที่ต้นฉบับ",
  totalF: "ยอด (F)",
  received: "รับเข้า",
  receivedReturn: "รับคืน",
  issuedCustomer: "จ่ายลูกค้า",
  promotion: "ส่งเสริมฯ",
  office: "ตัวอย่าง",
  other: "จ่ายอื่น",
  damaged: "ชำรุด",
  remaining: "คงเหลือ",
  count: "ตรวจนับ",
  difference: "ผลต่าง",
  remark: "หมายเหตุ",
  group: "ประเภท",
  code: "รหัสสินค้า",
  productName: "ชื่อสินค้า",
  unit: "หน่วย",
  soNumber: "เลข SO",
  customer: "ลูกค้า",
  quantity: "จำนวน",
  empty: "ไม่มีข้อมูล",
  showing: "แสดง",
  from: "จาก",
  page: "หน้า",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  close: "ปิด",
  date: "วันที่",
  period: "ประจำเดือน",
  summary: "ยอดสรุปตาม Excel",
  stockHint: "ยอดในตารางแสดงค่าจาก Excel โดยไม่คำนวณใหม่",
  soHint: "รายการ SO ใช้ดูและค้นหาเท่านั้น ไม่หักยอดสต็อค",
  mockHint: "ข้อมูลจำลอง ไม่มี API ฐานข้อมูล หรือการบันทึกถาวร",
  dateHint: "วันที่ SO แสดงค่าดิบจาก Excel อาจเป็นตัวเลข ไม่แปลงโดยการเดา",
  dailyHint: "แสดงครบทุกวันในเดือน รวมวันที่ไม่มีการเคลื่อนไหว",
  stockDetail: "ข้อมูลสินค้า",
  dailyRows: "วันที่มีรายการ",
} as const;

const STOCK_COLUMNS = [
  { field: "balance_quantity", label: COPY.totalF },
  { field: "received_in", label: COPY.received },
  { field: "received_return", label: COPY.receivedReturn },
  { field: "issued_customer", label: COPY.issuedCustomer },
  { field: "issued_promotion", label: COPY.promotion },
  { field: "issued_office_sample", label: COPY.office },
  { field: "issued_other", label: COPY.other },
  { field: "damaged", label: COPY.damaged },
  { field: "remaining_quantity", label: COPY.remaining },
  { field: "physical_count", label: COPY.count },
  { field: "count_difference", label: COPY.difference },
] as const satisfies readonly {
  field: StockProductsSummaryField;
  label: string;
}[];

const DAILY_COLUMNS = [
  { field: "received_in", label: COPY.received },
  { field: "received_return", label: COPY.receivedReturn },
  { field: "issued_customer", label: COPY.issuedCustomer },
  { field: "issued_promotion", label: COPY.promotion },
  { field: "issued_office_sample", label: COPY.office },
  { field: "issued_other", label: COPY.other },
  { field: "damaged", label: COPY.damaged },
] as const satisfies readonly {
  field: StockProductsDailyField;
  label: string;
}[];

const SO_SHEET_OPTIONS = [
  { value: "ALL", label: COPY.allSheets },
  ...STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => ({
    value: name,
    label: name,
  })),
];

const PAGE_SIZE = 25;
const QUANTITY_CLASSES = "whitespace-nowrap text-right tabular-nums";

function originalCell(value: string | number | boolean | null): string {
  return value === null || value === "" ? "-" : String(value);
}

function monthLabel(yearBe: number, month: number): string {
  const monthName = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(yearBe - 543, month - 1, 1)));
  return `${monthName} ${yearBe}`;
}

interface PaginationProps {
  page: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}

function StockProductsPagination({
  page,
  total,
  itemLabel,
  onPageChange,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lastPage = Math.min(page, pages);
  const start = total === 0 ? 0 : (lastPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(lastPage * PAGE_SIZE, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
      <p className="text-muted-foreground">
        {COPY.showing} {start.toLocaleString("th-TH")}-
        {end.toLocaleString("th-TH")} {COPY.from}{" "}
        {total.toLocaleString("th-TH")} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lastPage <= 1}
          onClick={() => onPageChange(lastPage - 1)}
        >
          {COPY.previous}
        </Button>
        <span className="min-w-18 text-center tabular-nums">
          {COPY.page} {lastPage}/{pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lastPage >= pages}
          onClick={() => onPageChange(lastPage + 1)}
        >
          {COPY.next}
        </Button>
      </div>
    </div>
  );
}

/** Keep the 31-day ledger separate from source F:P summary totals. */
function StockProductsDailyView({ row }: { row: StockProductsStockRow }) {
  const { period } = stockProductsMockWorkbook.stock;
  const dates = datesInStockProductsMonth(period);
  const valuesByDate = new Map<string, StockProductsDailyValues>(
    row.daily.map((entry) => [entry.date, entry.values]),
  );

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-lg border border-border bg-muted/25 p-3 text-sm">
        <p className="font-semibold text-foreground">{row.item.name.trim()}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {COPY.code}: {originalCell(row.item.code)} · {COPY.unit}:{" "}
          {originalCell(row.item.unit)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{COPY.dailyHint}</p>
      </div>
      <div className="max-h-[55dvh] overflow-auto rounded-lg border border-border">
        <Table className="min-w-245 text-xs">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="min-w-28">{COPY.date}</TableHead>
              {DAILY_COLUMNS.map((column) => (
                <TableHead key={column.field} className="min-w-28 text-right">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {dates.map((date) => {
              const record = valuesByDate.get(date);
              return (
                <TableRow
                  key={date}
                  className={record ? "bg-primary/5" : undefined}
                >
                  <TableCell className="whitespace-nowrap font-medium tabular-nums">
                    {date}
                  </TableCell>
                  {DAILY_COLUMNS.map((column) => (
                    <TableCell key={column.field} className={QUANTITY_CLASSES}>
                      {originalCell(record?.[column.field] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{COPY.stockHint}</p>
    </div>
  );
}

export function StockProductsWorkspace() {
  const stockSearchId = useId();
  const soSearchId = useId();
  const [activeView, setActiveView] = useState<"STOCK" | "SO">("STOCK");
  const [stockSearch, setStockSearch] = useState("");
  const [soSearch, setSoSearch] = useState("");
  const [selectedSheet, setSelectedSheet] = useState<
    StockProductsSoSheetName | "ALL"
  >("ALL");
  const [stockPage, setStockPage] = useState(1);
  const [soPage, setSoPage] = useState(1);
  const [selectedStockRow, setSelectedStockRow] =
    useState<StockProductsStockRow | null>(null);

  const { stock, so_sheets: soSheets } = stockProductsMockWorkbook;
  const stockRows = useMemo(
    () => filterStockProductsRows(stock.rows, stockSearch),
    [stock.rows, stockSearch],
  );
  const soRows = useMemo(
    () =>
      filterStockProductsSoRows(soSheets, {
        sheet: selectedSheet,
        search: soSearch,
      }),
    [soSheets, selectedSheet, soSearch],
  );
  const stockPageRows = useMemo(
    () => stockRows.slice((stockPage - 1) * PAGE_SIZE, stockPage * PAGE_SIZE),
    [stockRows, stockPage],
  );
  const soPageRows = useMemo(
    () => soRows.slice((soPage - 1) * PAGE_SIZE, soPage * PAGE_SIZE),
    [soRows, soPage],
  );
  const movementDays = useMemo(
    () => stock.rows.reduce((sum, row) => sum + row.daily.length, 0),
    [stock.rows],
  );
  const soLineCount = useMemo(
    () => soSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
    [soSheets],
  );

  function chooseSoSheet(next: string) {
    if (next === "ALL") {
      setSelectedSheet("ALL");
      setSoPage(1);
      return;
    }
    const known = STOCK_PRODUCTS_SO_SHEET_NAMES.find((name) => name === next);
    if (known !== undefined) {
      setSelectedSheet(known);
      setSoPage(1);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title={COPY.title}
        description={COPY.desc}
        actions={<Badge variant="outline">{COPY.readonly}</Badge>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <Boxes className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {monthLabel(stock.period.year_be, stock.period.month)}
            </p>
            <p className="text-xs text-muted-foreground">
              {stock.source_sheet_name} · {stock.report_caption}
            </p>
          </div>
        </div>
        <Badge variant="secondary">{COPY.source}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: COPY.productCount, value: stock.rows.length, Icon: Boxes },
          { label: COPY.dailyCount, value: movementDays, Icon: CalendarDays },
          { label: COPY.soCount, value: soLineCount, Icon: ClipboardList },
          { label: COPY.soSheets, value: soSheets.length, Icon: Search },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <p className="text-xs font-medium">{label}</p>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">
              {value.toLocaleString("th-TH")}
            </p>
          </div>
        ))}
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Stock products view"
      >
        <Button
          type="button"
          variant={activeView === "STOCK" ? "default" : "outline"}
          aria-pressed={activeView === "STOCK"}
          onClick={() => setActiveView("STOCK")}
        >
          <Boxes className="size-4" aria-hidden="true" />
          {COPY.stock}
        </Button>
        <Button
          type="button"
          variant={activeView === "SO" ? "default" : "outline"}
          aria-pressed={activeView === "SO"}
          onClick={() => setActiveView("SO")}
        >
          <ClipboardList className="size-4" aria-hidden="true" />
          {COPY.so} ({soSheets.length})
        </Button>
      </div>

      {activeView === "STOCK" ? (
        <section className="min-w-0 space-y-4" aria-label={COPY.stock}>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2 sm:max-w-xl">
                <Label htmlFor={stockSearchId}>{COPY.stockSearch}</Label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    id={stockSearchId}
                    type="search"
                    autoComplete="off"
                    value={stockSearch}
                    onChange={(event) => {
                      setStockSearch(event.currentTarget.value);
                      setStockPage(1);
                    }}
                    placeholder={COPY.stockPlaceholder}
                    className="pl-9"
                  />
                </div>
              </div>
              <Badge variant="outline">
                {stockRows.length.toLocaleString("th-TH")}/
                {stock.rows.length.toLocaleString("th-TH")} {COPY.productCount}
              </Badge>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <p className="text-sm font-semibold">{COPY.stock}</p>
              <p className="text-xs text-muted-foreground">{COPY.stockHint}</p>
            </div>
            <div className="max-w-full overflow-x-auto border-t border-border">
              <Table className="min-w-520 text-xs">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="min-w-32">{COPY.code}</TableHead>
                    <TableHead className="min-w-80">
                      {COPY.productName}
                    </TableHead>
                    <TableHead className="min-w-24">{COPY.group}</TableHead>
                    <TableHead className="min-w-18">{COPY.unit}</TableHead>
                    {STOCK_COLUMNS.map((column) => (
                      <TableHead
                        key={column.field}
                        className="min-w-24 text-right"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-36">{COPY.remark}</TableHead>
                    <TableHead className="min-w-28">
                      {COPY.dailyButton}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockPageRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={17}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {COPY.noStock}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stockPageRows.map((row) => (
                      <TableRow key={stockProductsRowKey(row)}>
                        <TableCell className="font-mono text-xs">
                          {originalCell(row.item.code)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.item.name.trim()}
                        </TableCell>
                        <TableCell>{originalCell(row.item.group)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.item.unit)}
                        </TableCell>
                        {STOCK_COLUMNS.map((column) => (
                          <TableCell
                            key={column.field}
                            className={QUANTITY_CLASSES}
                          >
                            {originalCell(row.summary[column.field])}
                          </TableCell>
                        ))}
                        <TableCell
                          className="max-w-48 truncate"
                          title={row.remark}
                        >
                          {originalCell(row.remark)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStockRow(row)}
                          >
                            <CalendarDays
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            {COPY.dailyButton}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <StockProductsPagination
              page={stockPage}
              total={stockRows.length}
              itemLabel={COPY.productCount}
              onPageChange={setStockPage}
            />
          </div>
        </section>
      ) : (
        <section className="min-w-0 space-y-4" aria-label={COPY.so}>
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
            <SelectField
              label={COPY.pickSheet}
              value={selectedSheet}
              onChange={chooseSoSheet}
              options={SO_SHEET_OPTIONS}
            />
            <div className="space-y-2">
              <Label htmlFor={soSearchId}>{COPY.soSearch}</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id={soSearchId}
                  type="search"
                  autoComplete="off"
                  value={soSearch}
                  onChange={(event) => {
                    setSoSearch(event.currentTarget.value);
                    setSoPage(1);
                  }}
                  placeholder={COPY.soPlaceholder}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {COPY.so} ·{" "}
                  {selectedSheet === "ALL" ? COPY.allSheets : selectedSheet}
                </p>
                <p className="text-xs text-muted-foreground">{COPY.soHint}</p>
              </div>
              <Badge variant="outline">
                {soRows.length.toLocaleString("th-TH")} {COPY.soCount}
              </Badge>
            </div>
            <div className="max-w-full overflow-x-auto border-t border-border">
              <Table className="min-w-250 text-xs">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="min-w-22">{COPY.soSheets}</TableHead>
                    <TableHead className="min-w-28">{COPY.dateRaw}</TableHead>
                    <TableHead className="min-w-48">{COPY.customer}</TableHead>
                    <TableHead className="min-w-36">{COPY.soNumber}</TableHead>
                    <TableHead className="min-w-72">
                      {COPY.productName}
                    </TableHead>
                    <TableHead className="min-w-20 text-right">
                      {COPY.quantity}
                    </TableHead>
                    <TableHead className="min-w-16">{COPY.unit}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {soPageRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {COPY.noSo}
                      </TableCell>
                    </TableRow>
                  ) : (
                    soPageRows.map((row) => (
                      <TableRow key={stockProductsSoRowKey(row)}>
                        <TableCell className="font-medium">
                          {row.sheet_name}
                        </TableCell>
                        <TableCell
                          className="whitespace-nowrap font-mono"
                          title={COPY.dateHint}
                        >
                          {originalCell(row.date_raw)}
                        </TableCell>
                        <TableCell>{originalCell(row.customer_name)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.so_number)}
                        </TableCell>
                        <TableCell>{originalCell(row.product_name)}</TableCell>
                        <TableCell className={QUANTITY_CLASSES}>
                          {originalCell(row.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {originalCell(row.unit)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <StockProductsPagination
              page={soPage}
              total={soRows.length}
              itemLabel={COPY.soCount}
              onPageChange={setSoPage}
            />
          </div>
          <p className="text-xs text-muted-foreground">{COPY.dateHint}</p>
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {COPY.mockHint} · {COPY.stockHint} · {COPY.soHint}
      </p>

      <Dialog
        open={selectedStockRow !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setSelectedStockRow(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none overflow-y-auto sm:max-w-[calc(100vw-3rem)] lg:max-w-5xl">
          <div className="min-w-0 space-y-1 pr-6">
            <DialogTitle>{COPY.dailyTitle}</DialogTitle>
            <DialogDescription>
              {monthLabel(stock.period.year_be, stock.period.month)} ·{" "}
              {COPY.stockHint}
            </DialogDescription>
          </div>
          {selectedStockRow && (
            <StockProductsDailyView row={selectedStockRow} />
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedStockRow(null)}
            >
              {COPY.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
