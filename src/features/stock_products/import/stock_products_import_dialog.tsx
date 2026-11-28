"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Search,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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

import {
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  stockProductsSoRowKey,
  validateStockProductsImportedSoRow,
  type StockProductsMonth,
  type StockProductsRawCell,
  type StockProductsSoRow,
  type StockProductsSoSheetName,
  type StockProductsStockRow,
  type StockProductsSummaryField,
  type StockProductsSummaryValues,
} from "../stock_products_domain";

const STOCK_API = "/api/stock/products";
const CSRF_COOKIE = "ionflow_factory_csrf";
const MAX_IMPORT_REQUEST_BYTES = 4 * 1024 * 1024;
const ROW_PAGE_SIZE = 25;
const ISSUE_PAGE_SIZE = 10;
const IMPORT_SCOPE = "replace_stock_and_all_so";
const SO_REPLACE_WARNING_CODE = "ALL_SO_WILL_BE_REPLACED";
const SO_SUPPLEMENTARY_COLUMNS = ["H", "I", "J", "K", "L", "M", "N"] as const;

const SUMMARY_LABELS: Record<StockProductsSummaryField, string> = {
  balance_quantity: "ยอด (F)",
  received_in: "รับเข้า",
  received_return: "รับคืน",
  issued_customer: "จ่ายลูกค้า",
  issued_promotion: "ส่งเสริมฯ",
  issued_office_sample: "ตัวอย่าง",
  issued_other: "จ่ายอื่น",
  damaged: "ชำรุด",
  remaining_quantity: "คงเหลือ",
  physical_count: "ตรวจนับ",
  count_difference: "ผลต่าง",
};

// Show the most useful original Excel columns first, without aggregating them.
const PRIMARY_SUMMARY_FIELDS = [
  "received_in",
  "issued_customer",
  "remaining_quantity",
] as const satisfies readonly StockProductsSummaryField[];
const OTHER_SUMMARY_FIELDS = STOCK_PRODUCTS_SUMMARY_FIELDS.filter(
  (field) => !PRIMARY_SUMMARY_FIELDS.some((primary) => primary === field),
);

type ImportIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  source_row?: number;
  sheet_name?: string;
  cell?: string;
};

type PreviewRow = {
  source_row: number;
  source_no: string;
  item: Pick<
    StockProductsStockRow["item"],
    "code" | "name" | "group" | "unit"
  > & {
    added_date: null;
  };
  summary: StockProductsSummaryValues;
  remark: string;
  daily_count: number;
};

// The import API supplies both normalized and original SO dates. Do not
// import a server-only parser into this client component.
type PreviewSoRow = Omit<
  StockProductsSoRow,
  "id" | "stock_row_key" | "date_raw"
> & {
  date_raw: string;
  document_date: string | null;
  source_date_text: string;
};

type PreviewSoSheet = {
  name: StockProductsSoSheetName;
  rows: PreviewSoRow[];
};

type ImportResult = { stock: number; so: number };

type ImportPreview = {
  import_scope: typeof IMPORT_SCOPE;
  source: { file_name: string; sheet_name: string; file_sha256: string };
  period: StockProductsMonth;
  summary: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    warning_count: number;
    error_count: number;
  };
  so_summary: {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    sheet_count: number;
    invalid_date_count: number;
  };
  replacement: {
    existing_stock_rows: number;
    existing_so_rows: number;
    so_scope: "ALL_PERIODS";
  };
  rows: PreviewRow[];
  so_sheets: PreviewSoSheet[];
  issues: ImportIssue[];
} & (
  | { can_confirm: true; preview_token: string }
  | { can_confirm: false; preview_token: null }
);

type ImportAction = "import_preview" | "import_confirm";
type BusyAction = "preview" | "confirm" | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: StockProductsMonth;
  onImported: (inserted: number, insertedSo: number) => void;
  onReloadRequired: (message: string) => void;
};

class StockProductsImportError extends Error {
  constructor(
    message: string,
    readonly reloadRequired = false,
  ) {
    super(message);
    this.name = "StockProductsImportError";
  }
}

const INVALID_RESPONSE = "รูปแบบข้อมูลนำเข้าจาก API ไม่ถูกต้อง";
const UNCERTAIN_SAVE =
  "ไม่สามารถยืนยันผลการนำเข้าได้ กรุณาโหลดข้อมูลล่าสุดและตรวจสอบก่อนนำเข้าใหม่";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function matchesPeriod(value: unknown, period: StockProductsMonth): boolean {
  return (
    isRecord(value) &&
    value.year_be === period.year_be &&
    value.month === period.month
  );
}

function isIssue(value: unknown): value is ImportIssue {
  return (
    isRecord(value) &&
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (value.source_row === undefined ||
      (isCount(value.source_row) && value.source_row > 0)) &&
    (value.sheet_name === undefined || typeof value.sheet_name === "string") &&
    (value.cell === undefined || typeof value.cell === "string")
  );
}

function isPreviewRow(value: unknown): value is PreviewRow {
  if (!isRecord(value) || !isRecord(value.item) || !isRecord(value.summary)) {
    return false;
  }

  const { item, summary } = value;
  return (
    isCount(value.source_row) &&
    value.source_row > 0 &&
    typeof value.source_no === "string" &&
    typeof item.name === "string" &&
    Boolean(item.name.trim()) &&
    isNullableString(item.code) &&
    isNullableString(item.group) &&
    isNullableString(item.unit) &&
    item.added_date === null &&
    STOCK_PRODUCTS_SUMMARY_FIELDS.every(
      (field) => typeof summary[field] === "string",
    ) &&
    typeof value.remark === "string" &&
    isCount(value.daily_count) &&
    value.daily_count <= 31
  );
}

function isRawCell(value: unknown): value is StockProductsRawCell {
  return (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "string" && !value.includes("\0")) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isPreviewSoRow(value: unknown): value is PreviewSoRow {
  if (!isRecord(value)) return false;
  const sheetName = STOCK_PRODUCTS_SO_SHEET_NAMES.find(
    (name) => name === value.sheet_name,
  );
  if (
    !sheetName ||
    !isCount(value.source_row) ||
    value.source_row < 1 ||
    value.id !== undefined ||
    value.stock_row_key !== undefined ||
    typeof value.date_raw !== "string" ||
    !isNullableString(value.document_date) ||
    typeof value.source_date_text !== "string" ||
    typeof value.customer_name !== "string" ||
    typeof value.so_number !== "string" ||
    typeof value.product_name !== "string" ||
    typeof value.quantity !== "string" ||
    typeof value.unit !== "string" ||
    !Array.isArray(value.supplementary_cells) ||
    !value.supplementary_cells.every(isRawCell)
  ) {
    return false;
  }

  const row: PreviewSoRow = {
    sheet_name: sheetName,
    source_row: value.source_row,
    date_raw: value.date_raw,
    document_date: value.document_date,
    source_date_text: value.source_date_text,
    customer_name: value.customer_name,
    so_number: value.so_number,
    product_name: value.product_name,
    quantity: value.quantity,
    unit: value.unit,
    supplementary_cells: value.supplementary_cells,
  };
  return Object.keys(validateStockProductsImportedSoRow(row)).length === 0;
}

function isPreviewSoSheet(value: unknown): value is PreviewSoSheet {
  if (
    !isRecord(value) ||
    !STOCK_PRODUCTS_SO_SHEET_NAMES.some((name) => name === value.name) ||
    !Array.isArray(value.rows) ||
    !value.rows.every(isPreviewSoRow)
  ) {
    return false;
  }
  return (
    value.rows.every((row) => row.sheet_name === value.name) &&
    new Set(value.rows.map((row) => row.source_row)).size === value.rows.length
  );
}

function isPreview(
  value: unknown,
  period: StockProductsMonth,
  fileName: string,
): value is ImportPreview {
  if (
    !isRecord(value) ||
    !isRecord(value.source) ||
    !isRecord(value.summary) ||
    value.import_scope !== IMPORT_SCOPE ||
    !isRecord(value.so_summary) ||
    !isRecord(value.replacement) ||
    !matchesPeriod(value.period, period) ||
    value.source.file_name !== fileName ||
    typeof value.source.sheet_name !== "string" ||
    !isSha256(value.source.file_sha256) ||
    !Array.isArray(value.rows) ||
    !value.rows.every(isPreviewRow) ||
    !Array.isArray(value.so_sheets) ||
    !value.so_sheets.every(isPreviewSoSheet) ||
    !Array.isArray(value.issues) ||
    !value.issues.every(isIssue)
  ) {
    return false;
  }

  const { summary, rows, issues, so_summary: soSummary, replacement } = value;
  const soSheets = value.so_sheets;
  const soRows = soSheets.flatMap((sheet) => sheet.rows);
  const sheetNames = new Set(soSheets.map((sheet) => sheet.name));
  if (
    soSheets.length !== STOCK_PRODUCTS_SO_SHEET_NAMES.length ||
    sheetNames.size !== soSheets.length ||
    !STOCK_PRODUCTS_SO_SHEET_NAMES.every((name) => sheetNames.has(name)) ||
    soSummary.sheet_count !== soSheets.length ||
    !isCount(soSummary.total_rows) ||
    !isCount(soSummary.valid_rows) ||
    !isCount(soSummary.invalid_rows) ||
    soSummary.total_rows !== soRows.length ||
    soSummary.valid_rows + soSummary.invalid_rows !== soSummary.total_rows ||
    soSummary.invalid_date_count !==
      soRows.filter((row) => row.document_date === null).length ||
    replacement.so_scope !== "ALL_PERIODS" ||
    !isCount(replacement.existing_stock_rows) ||
    !isCount(replacement.existing_so_rows) ||
    !issues.some(
      (issue) =>
        issue.severity === "warning" && issue.code === SO_REPLACE_WARNING_CODE,
    )
  ) {
    return false;
  }
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;
  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  if (
    !isCount(summary.total_rows) ||
    !isCount(summary.valid_rows) ||
    !isCount(summary.invalid_rows) ||
    summary.total_rows !== rows.length ||
    summary.valid_rows + summary.invalid_rows !== summary.total_rows ||
    summary.warning_count !== warningCount ||
    summary.error_count !== errorCount ||
    new Set(rows.map((row) => row.source_row)).size !== rows.length
  ) {
    return false;
  }

  return value.can_confirm === true
    ? rows.length > 0 &&
        errorCount === 0 &&
        summary.invalid_rows === 0 &&
        soSummary.invalid_rows === 0 &&
        isSha256(value.preview_token)
    : value.can_confirm === false && value.preview_token === null;
}

function getCsrfToken(): string {
  try {
    const cookie = document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
    const token = cookie
      ? decodeURIComponent(cookie.slice(CSRF_COOKIE.length + 1))
      : "";
    if (token) return token;
  } catch {
    // Do not send a request without the CSRF cookie.
  }
  throw new StockProductsImportError("กรุณาเข้าสู่ระบบใหม่ ไม่พบ CSRF Token");
}

function issueLocation(issue: ImportIssue): string {
  return [
    issue.sheet_name ? `ชีต ${issue.sheet_name}` : "",
    issue.cell ? `เซลล์ ${issue.cell}` : "",
    issue.source_row === undefined ? "" : `แถว ${issue.source_row}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function errorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload) || typeof payload.message !== "string")
    return fallback;
  const issues: unknown = payload.issues;
  const issue = Array.isArray(issues) ? issues.find(isIssue) : undefined;
  const location = issue ? issueLocation(issue) : "";
  return location ? `${payload.message} (${location})` : payload.message;
}

async function requestImport(
  action: ImportAction,
  period: StockProductsMonth,
  file: File,
  previewToken?: string,
): Promise<Record<string, unknown>> {
  const confirming = action === "import_confirm";
  const csrfToken = getCsrfToken();
  const form = new FormData();
  form.set("action", action);
  form.set("import_scope", IMPORT_SCOPE);
  form.set("year_be", String(period.year_be));
  form.set("month", String(period.month));
  form.set("file", file);
  if (confirming && previewToken) form.set("preview_token", previewToken);

  let response: Response;
  try {
    response = await fetch(STOCK_API, {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
      credentials: "same-origin",
      cache: "no-store",
      body: form,
    });
  } catch {
    throw new StockProductsImportError(
      confirming
        ? UNCERTAIN_SAVE
        : "ไม่สามารถตรวจสอบไฟล์ Excel ได้ กรุณาลองใหม่",
      confirming,
    );
  }

  // The browser supplies the multipart Content-Type and its boundary.
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(payload) || payload.ok !== true) {
    const reloadRequired =
      confirming &&
      (response.ok ||
        !isRecord(payload) ||
        payload.ok !== false ||
        response.status >= 500 ||
        [401, 403, 404, 408, 409].includes(response.status) ||
        (isRecord(payload) && payload.code === "STOCK_WRITE_UNCERTAIN"));
    const message = errorMessage(
      payload,
      confirming ? UNCERTAIN_SAVE : "ไม่สามารถตรวจสอบไฟล์ Excel ได้",
    );
    throw new StockProductsImportError(message, reloadRequired);
  }
  return payload;
}

function periodLabel(period: StockProductsMonth): string {
  const month = new Intl.DateTimeFormat("th-TH", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, period.month - 1, 1)));
  return `${month} ${period.year_be}`;
}

function showCell(value: string | null): string {
  return value === null || value === "" ? "–" : value;
}

function showRawCell(value: StockProductsRawCell): string {
  return value === null || value === "" ? "–" : String(value);
}

function readImportResult(
  saved: Record<string, unknown>,
  checked: ImportPreview,
): ImportResult {
  if (
    saved.action !== "confirm" ||
    saved.import_scope !== IMPORT_SCOPE ||
    !matchesPeriod(saved.period, checked.period) ||
    !isCount(saved.inserted) ||
    saved.inserted !== checked.summary.total_rows ||
    !isCount(saved.inserted_so) ||
    saved.inserted_so !== checked.so_summary.total_rows
  ) {
    throw new StockProductsImportError(UNCERTAIN_SAVE, true);
  }
  return { stock: saved.inserted, so: saved.inserted_so };
}

function Pager({
  page,
  total,
  pageSize,
  disabled,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
      <p className="text-xs text-muted-foreground">
        แสดง {first.toLocaleString("th-TH")}-{last.toLocaleString("th-TH")} จาก{" "}
        {total.toLocaleString("th-TH")} รายการ · หน้า{" "}
        {page.toLocaleString("th-TH")} / {pageCount.toLocaleString("th-TH")}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ก่อนหน้า
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </div>
  );
}

function SoPreviewPanel({ preview }: { preview: ImportPreview }) {
  const searchId = useId();
  const [sheet, setSheet] = useState<StockProductsSoSheetName | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const matchingRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th-TH");
    return preview.so_sheets
      .filter((entry) => sheet === "ALL" || entry.name === sheet)
      .flatMap((entry) => entry.rows)
      .filter((row) =>
        [
          row.date_raw,
          row.source_date_text,
          row.customer_name,
          row.so_number,
          row.product_name,
          row.quantity,
          row.unit,
        ].some((value) => value.toLocaleLowerCase("th-TH").includes(query)),
      );
  }, [preview.so_sheets, sheet, search]);
  const rows = matchingRows.slice(
    (page - 1) * ROW_PAGE_SIZE,
    page * ROW_PAGE_SIZE,
  );
  const sheetFilters: {
    name: StockProductsSoSheetName | "ALL";
    count: number;
  }[] = [
    { name: "ALL", count: preview.so_summary.total_rows },
    ...preview.so_sheets.map((entry) => ({
      name: entry.name,
      count: entry.rows.length,
    })),
  ];

  return (
    <section
      className="overflow-hidden rounded-lg border"
      aria-label="รายการ SO จาก Excel"
    >
      <div className="space-y-1 border-b px-3 py-3">
        <h3 className="text-sm font-semibold">
          รายการ SO จาก Excel ทั้ง 16 ชีต
        </h3>
        <p className="text-xs text-muted-foreground">
          แสดงทุกเดือนและทุกปี ไม่จับคู่ Stock หรือคำนวณยอดใหม่
          ชีตที่ไม่มีรายการจะแสดงจำนวน 0 ตามไฟล์ต้นฉบับ
        </p>
        {preview.so_summary.invalid_date_count > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            พบวันที่ SO ที่ไม่สามารถกำหนดวันที่จริงได้{" "}
            {preview.so_summary.invalid_date_count.toLocaleString("th-TH")}{" "}
            รายการ ระบบจะรักษาข้อความวันที่ต้นฉบับไว้
          </p>
        )}
      </div>
      <div className="space-y-3 border-b p-3">
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"
          role="group"
          aria-label="เลือกชีต SO"
        >
          {sheetFilters.map((entry) => (
            <Button
              key={entry.name}
              type="button"
              variant={sheet === entry.name ? "default" : "outline"}
              size="sm"
              aria-pressed={sheet === entry.name}
              onClick={() => {
                setSheet(entry.name);
                setPage(1);
              }}
              className="h-auto min-w-0 justify-between gap-1 px-2 py-2 whitespace-normal"
            >
              <span className="min-w-0 wrap-break-word">
                {entry.name === "ALL" ? "ทั้งหมด" : entry.name}
              </span>
              <span className="shrink-0 tabular-nums">
                {entry.count.toLocaleString("th-TH")}
              </span>
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor={searchId}>ค้นหารายการ SO</Label>
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              className="pl-9"
              placeholder="ค้นหาเลข SO ลูกค้า สินค้า หรือวันที่"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          ชีต {sheet === "ALL" ? "ทั้งหมด" : sheet} · พบ{" "}
          {matchingRows.length.toLocaleString("th-TH")} รายการ
        </p>
      </div>
      <Table
        className="min-w-[1600px] text-xs"
        containerProps={{
          className: "max-h-[48dvh] overflow-auto",
          tabIndex: 0,
          role: "region",
          "aria-label": "ตารางรายการ SO จาก Excel",
        }}
      >
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead>ชีต</TableHead>
            <TableHead>แถว Excel</TableHead>
            <TableHead>วันที่ SO</TableHead>
            <TableHead>วันที่ต้นฉบับ</TableHead>
            <TableHead className="min-w-40">ลูกค้า</TableHead>
            <TableHead>เลข SO</TableHead>
            <TableHead className="min-w-64">ชื่อสินค้า</TableHead>
            <TableHead className="text-right">จำนวน</TableHead>
            <TableHead>หน่วย</TableHead>
            {SO_SUPPLEMENTARY_COLUMNS.map((column) => (
              <TableHead key={column}>Excel {column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={9 + SO_SUPPLEMENTARY_COLUMNS.length}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                ไม่พบรายการ SO ในชีตหรือคำค้นหาที่เลือก
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={stockProductsSoRowKey(row)}>
              <TableCell>{row.sheet_name}</TableCell>
              <TableCell className="tabular-nums">{row.source_row}</TableCell>
              <TableCell className="whitespace-nowrap">
                {showCell(row.date_raw)}
                {row.document_date === null && (
                  <span className="block text-[11px] text-amber-700 dark:text-amber-400">
                    ไม่มีวันที่จริง
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal wrap-break-word">
                {showCell(row.source_date_text)}
              </TableCell>
              <TableCell className="whitespace-normal wrap-break-word">
                {row.customer_name}
              </TableCell>
              <TableCell>{row.so_number}</TableCell>
              <TableCell className="whitespace-normal wrap-break-word">
                {row.product_name}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {showCell(row.quantity)}
              </TableCell>
              <TableCell>{showCell(row.unit)}</TableCell>
              {SO_SUPPLEMENTARY_COLUMNS.map((column, index) => (
                <TableCell
                  key={column}
                  className="whitespace-normal wrap-break-word"
                >
                  {showRawCell(row.supplementary_cells[index])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager
        page={page}
        total={matchingRows.length}
        pageSize={ROW_PAGE_SIZE}
        disabled={false}
        onPageChange={setPage}
      />
    </section>
  );
}

function PreviewDetails({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0 rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-3 text-sm font-medium hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">{title}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          {description}
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="min-w-0 border-t p-2 sm:p-3">{children}</div>
    </details>
  );
}

function ImportPreviewPanel({ preview }: { preview: ImportPreview }) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [rowPage, setRowPage] = useState(1);
  const [issuePage, setIssuePage] = useState(1);
  const matchingRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("th-TH");
    return preview.rows.filter((row) =>
      [row.item.code ?? "", row.item.name, row.item.group ?? ""].some((value) =>
        value.toLocaleLowerCase("th-TH").includes(query),
      ),
    );
  }, [preview.rows, search]);
  const rows = matchingRows.slice(
    (rowPage - 1) * ROW_PAGE_SIZE,
    rowPage * ROW_PAGE_SIZE,
  );
  const orderedIssues = [
    ...preview.issues.filter((issue) => issue.severity === "error"),
    ...preview.issues.filter((issue) => issue.severity === "warning"),
  ];
  const issues = orderedIssues.slice(
    (issuePage - 1) * ISSUE_PAGE_SIZE,
    issuePage * ISSUE_PAGE_SIZE,
  );
  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-lg border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Stock · {periodLabel(preview.period)}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {preview.summary.total_rows.toLocaleString("th-TH")}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              รายการ
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            เดิม{" "}
            {preview.replacement.existing_stock_rows.toLocaleString("th-TH")}{" "}
            รายการ
          </p>
        </div>
        <div className="min-w-0 rounded-lg border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">
            SO · ทุกเดือนทุกปี
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {preview.so_summary.total_rows.toLocaleString("th-TH")}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              รายการ
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            เดิม {preview.replacement.existing_so_rows.toLocaleString("th-TH")}{" "}
            รายการ · {preview.so_summary.sheet_count.toLocaleString("th-TH")}{" "}
            ชีต
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          className={
            preview.can_confirm
              ? "font-medium text-emerald-700 dark:text-emerald-400"
              : "font-medium text-destructive"
          }
        >
          {preview.can_confirm ? "ตรวจสอบไฟล์ผ่าน" : "ยังไม่สามารถนำเข้าได้"}
        </span>
        <span
          className={
            preview.summary.warning_count > 0
              ? "text-amber-700 dark:text-amber-400"
              : "text-muted-foreground"
          }
        >
          คำเตือน {preview.summary.warning_count.toLocaleString("th-TH")}
        </span>
        <span
          className={
            preview.summary.error_count > 0
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          ข้อผิดพลาด {preview.summary.error_count.toLocaleString("th-TH")}
        </span>
        {preview.so_summary.invalid_date_count > 0 && (
          <span className="text-amber-700 dark:text-amber-400">
            วันที่ SO ที่ต้องตรวจสอบ{" "}
            {preview.so_summary.invalid_date_count.toLocaleString("th-TH")}
          </span>
        )}
      </div>
      {!preview.can_confirm && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {orderedIssues.find((issue) => issue.severity === "error")?.message ??
            "ไม่สามารถนำเข้าได้ กรุณาตรวจสอบข้อผิดพลาดด้านล่าง"}
        </div>
      )}
      <PreviewDetails
        title="รายการสินค้า Stock"
        description={`${preview.summary.total_rows.toLocaleString("th-TH")} รายการ`}
      >
        <section
          className="min-w-0 overflow-hidden rounded-lg border"
          aria-label="รายการสินค้าจาก Excel"
        >
          <div className="border-b px-3 py-2">
            <p className="wrap-break-word text-xs text-muted-foreground">
              ชีต: {preview.source.sheet_name} · ขีด (–) คือช่องว่าง ไม่ใช่ 0
            </p>
          </div>
          <div className="space-y-2 border-b p-3">
            <Label htmlFor={searchId}>
              ค้นหารหัสสินค้า ชื่อสินค้า หรือประเภท
            </Label>
            <div className="relative max-w-xl">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.currentTarget.value);
                  setRowPage(1);
                }}
                className="pl-9"
                placeholder="ค้นหารหัสสินค้า ชื่อสินค้า หรือประเภท"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              แสดง {matchingRows.length.toLocaleString("th-TH")} จาก{" "}
              {preview.rows.length.toLocaleString("th-TH")} รายการ
            </p>
            <p className="text-xs text-muted-foreground">
              ตารางนี้แสดงค่าจากไฟล์ Excel ต้นฉบับ ไม่ใช่ยอดคำนวณใหม่
            </p>
          </div>
          <Table
            className="min-w-[1900px] text-xs"
            containerProps={{
              className: "max-h-[48dvh] overflow-auto",
              tabIndex: 0,
              role: "region",
              "aria-label": "ตารางรายการสินค้าจาก Excel",
            }}
          >
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>รหัสสินค้า</TableHead>
                <TableHead className="min-w-64">ชื่อสินค้า</TableHead>
                {PRIMARY_SUMMARY_FIELDS.map((field) => (
                  <TableHead
                    key={field}
                    className="whitespace-nowrap text-right"
                  >
                    {SUMMARY_LABELS[field]}
                  </TableHead>
                ))}
                <TableHead>ประเภท</TableHead>
                <TableHead>หน่วย</TableHead>
                {OTHER_SUMMARY_FIELDS.map((field) => (
                  <TableHead
                    key={field}
                    className="whitespace-nowrap text-right"
                  >
                    {SUMMARY_LABELS[field]}
                  </TableHead>
                ))}
                <TableHead>แถว Excel</TableHead>
                <TableHead>ลำดับ</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  วันที่มีรายการ
                </TableHead>
                <TableHead className="min-w-36">หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8 + STOCK_PRODUCTS_SUMMARY_FIELDS.length}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    ไม่พบรายการสินค้าที่ตรงกับการค้นหา
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row) => (
                <TableRow key={row.source_row}>
                  <TableCell>{showCell(row.item.code)}</TableCell>
                  <TableCell className="whitespace-normal wrap-break-word">
                    {row.item.name}
                  </TableCell>
                  {PRIMARY_SUMMARY_FIELDS.map((field) => (
                    <TableCell
                      key={field}
                      className="whitespace-nowrap text-right tabular-nums"
                    >
                      {showCell(row.summary[field])}
                    </TableCell>
                  ))}
                  <TableCell>{showCell(row.item.group)}</TableCell>
                  <TableCell>{showCell(row.item.unit)}</TableCell>
                  {OTHER_SUMMARY_FIELDS.map((field) => (
                    <TableCell
                      key={field}
                      className="whitespace-nowrap text-right tabular-nums"
                    >
                      {showCell(row.summary[field])}
                    </TableCell>
                  ))}
                  <TableCell className="tabular-nums">
                    {row.source_row}
                  </TableCell>
                  <TableCell>{showCell(row.source_no)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.daily_count}
                  </TableCell>
                  <TableCell className="whitespace-normal wrap-break-word">
                    {showCell(row.remark)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager
            page={rowPage}
            total={matchingRows.length}
            pageSize={ROW_PAGE_SIZE}
            disabled={false}
            onPageChange={setRowPage}
          />
        </section>
      </PreviewDetails>
      <PreviewDetails
        title="รายการ SO"
        description={`${preview.so_summary.total_rows.toLocaleString("th-TH")} รายการ`}
      >
        <SoPreviewPanel preview={preview} />
      </PreviewDetails>
      {preview.issues.length > 0 && (
        <PreviewDetails
          title="ผลการตรวจสอบ"
          description={`${preview.issues.length.toLocaleString("th-TH")} รายการ`}
        >
          <section
            className="min-w-0 overflow-hidden rounded-lg border"
            aria-label="ผลการตรวจสอบ"
          >
            <div className="divide-y">
              {issues.map((issue, index) => (
                <div
                  key={`${issue.code}:${issue.source_row ?? ""}:${(issuePage - 1) * ISSUE_PAGE_SIZE + index}`}
                  className="flex items-start gap-2 px-3 py-2 text-sm"
                >
                  <AlertCircle
                    aria-hidden="true"
                    className={`mt-0.5 size-4 shrink-0 ${issue.severity === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}
                  />
                  <div className="min-w-0 wrap-break-word">
                    <p>{issue.message}</p>
                    {issueLocation(issue) && (
                      <p className="text-xs text-muted-foreground">
                        {issueLocation(issue)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pager
              page={issuePage}
              total={preview.issues.length}
              pageSize={ISSUE_PAGE_SIZE}
              disabled={false}
              onPageChange={setIssuePage}
            />
          </section>
        </PreviewDetails>
      )}
    </div>
  );
}

function ImportDialogSession({
  onOpenChange,
  period,
  onImported,
  onReloadRequired,
}: Props) {
  const fileId = useId();
  const requestLock = useRef(false);
  const reloadLock = useRef(false);
  const completedLock = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const disabled = busy !== null || reloadRequired || result !== null;
  const canConfirm = Boolean(
    file &&
    preview?.can_confirm &&
    !disabled &&
    matchesPeriod(preview.period, period) &&
    preview.source.file_name === file.name,
  );

  async function selectFile(next: File | null) {
    if (requestLock.current || reloadLock.current || completedLock.current)
      return;
    setPreview(null);
    setFile(null);
    setError("");
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setError("กรุณาเลือกไฟล์ Excel นามสกุล .xlsx เท่านั้น");
      return;
    }
    if (next.size === 0 || next.size >= MAX_IMPORT_REQUEST_BYTES) {
      setError("ไฟล์ต้องไม่ว่าง และขนาดคำขอรวมต้องไม่เกิน 4 MiB");
      return;
    }
    if (next.name.length > 255) {
      setError("ชื่อไฟล์ Excel ต้องไม่เกิน 255 ตัวอักษร");
      return;
    }
    // Selecting a file only requests a read-only preview.
    requestLock.current = true;
    setFile(next);
    setBusy("preview");
    try {
      const payload = await requestImport("import_preview", period, next);
      if (
        payload.action !== "preview" ||
        !isPreview(payload.preview, period, next.name)
      ) {
        throw new StockProductsImportError(INVALID_RESPONSE);
      }
      setPreview(payload.preview);
    } catch (cause) {
      setError(
        cause instanceof StockProductsImportError
          ? cause.message
          : "ตรวจสอบ Excel ไม่สำเร็จ",
      );
    } finally {
      requestLock.current = false;
      setBusy(null);
    }
  }

  async function confirmImport() {
    if (
      requestLock.current ||
      reloadLock.current ||
      completedLock.current ||
      !file ||
      !preview?.can_confirm ||
      !matchesPeriod(preview.period, period) ||
      preview.source.file_name !== file.name
    ) {
      return;
    }

    // Only an explicit confirmation may start the database write.
    const checked = preview;
    requestLock.current = true;
    setError("");
    setBusy("confirm");
    let imported: ImportResult;
    try {
      const saved = await requestImport(
        "import_confirm",
        period,
        file,
        checked.preview_token,
      );
      imported = readImportResult(saved, checked);
      completedLock.current = true;
      setResult(imported);
    } catch (cause) {
      const message =
        cause instanceof StockProductsImportError
          ? cause.message
          : UNCERTAIN_SAVE;
      const needsReload =
        !(cause instanceof StockProductsImportError) || cause.reloadRequired;
      setError(message);
      if (needsReload) {
        reloadLock.current = true;
        setReloadRequired(true);
        onReloadRequired(message);
      }
      return;
    } finally {
      requestLock.current = false;
      setBusy(null);
    }

    // Refresh both Stock and SO from the API, not from the preview rows.
    onImported(imported.stock, imported.so);
  }

  function selectFiles(files: FileList | null) {
    if (requestLock.current || reloadLock.current || completedLock.current)
      return;
    if (!files || files.length === 0) return;
    if (files.length !== 1) {
      setError("กรุณาเลือกไฟล์ Excel ครั้งละ 1 ไฟล์");
      return;
    }
    void selectFile(files[0] ?? null);
  }

  function close() {
    if (!requestLock.current) onOpenChange(false);
  }

  const filePicker = (
    <div
      className="space-y-2 rounded-lg border border-dashed p-4"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        selectFiles(event.dataTransfer.files);
      }}
    >
      <Label htmlFor={fileId}>เลือกหรือลากไฟล์ Excel (.xlsx)</Label>
      <Input
        id={fileId}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled}
        onChange={(event) => {
          selectFiles(event.currentTarget.files);
          // Allow reselecting the same file after a safe rejection.
          event.currentTarget.value = "";
        }}
      />
      <p className="text-xs text-muted-foreground">
        ตรวจสอบก่อนยืนยันบันทึก · ขนาดคำขอรวมไม่เกิน 4 MiB
      </p>
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        variant={preview ? "preview" : "default"}
        className={
          preview
            ? "h-auto max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[92dvh] sm:max-w-6xl"
            : undefined
        }
        showCloseButton={busy === null}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (requestLock.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (requestLock.current) event.preventDefault();
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet
              aria-hidden="true"
              className="size-5 text-emerald-600 dark:text-emerald-400"
            />
            นำเข้า Excel
          </DialogTitle>
          <DialogDescription className="sr-only">
            ตรวจสอบไฟล์ Excel ก่อนยืนยันแทนที่ Stock งวดนี้และ SO ทุกงวด
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {file && (
            <div className="flex min-w-0 items-start gap-2 text-xs">
              <FileSpreadsheet
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <p className="min-w-0 wrap-break-word font-medium">
                {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MiB
              </p>
            </div>
          )}
          {result === null &&
            busy === null &&
            !reloadRequired &&
            (preview ? (
              <PreviewDetails title="เปลี่ยนไฟล์ Excel" description=".xlsx">
                {filePicker}
              </PreviewDetails>
            ) : (
              filePicker
            ))}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 wrap-break-word">
                <p>{error}</p>
                {reloadRequired && (
                  <p className="mt-1">
                    ปิดหน้าต่างแล้วโหลดข้อมูลล่าสุดก่อนลองนำเข้าอีกครั้ง
                  </p>
                )}
              </div>
            </div>
          )}
          {busy !== null && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-lg border bg-muted/25 p-3"
            >
              <Loader2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">
                  {busy === "preview"
                    ? "กำลังตรวจสอบไฟล์ Excel..."
                    : "กำลังบันทึก Stock และ SO จาก Excel ล่าสุด..."}
                </p>
                <p className="text-xs text-muted-foreground">
                  {busy === "preview"
                    ? "ระบบกำลังอ่านและตรวจสอบไฟล์"
                    : "ระบบกำลังบันทึก Stock และ SO พร้อมกัน"}
                </p>
                <p className="text-xs text-muted-foreground">
                  กรุณาอย่าปิดหน้าต่างหรือรีเฟรชหน้าจนกว่าการนำเข้าจะเสร็จสิ้น
                </p>
              </div>
            </div>
          )}
          {result !== null && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0"
              />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold">
                  แทนที่ Stock และ SO สำเร็จ
                </p>
                <p className="text-sm tabular-nums">
                  Stock {result.stock.toLocaleString("th-TH")} รายการ · SO{" "}
                  {result.so.toLocaleString("th-TH")} รายการ
                </p>
                <p className="text-xs">
                  แทนที่ Stock ของงวด {periodLabel(period)} และ SO ทุกเดือนทุกปี
                  ตามข้อมูลจาก Excel ล่าสุดเรียบร้อยแล้ว
                </p>
              </div>
            </div>
          )}
          {preview && (
            <>
              
              <ImportPreviewPanel
                key={preview.source.file_sha256}
                preview={preview}
              />
            </>
          )}
        </div>
        <DialogFooter>
        
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={close}
          >
            {busy === null ? "ปิดหน้าต่าง" : "กำลังนำเข้า..."}
          </Button>
          {preview?.can_confirm && result === null && !reloadRequired && (
            <Button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                void confirmImport();
              }}
            >
              {busy === "confirm" ? (
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              )}
              {busy === "confirm" ? "กำลังบันทึก..." : "ยืนยันแทนที่ข้อมูล"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StockProductsImportDialog(props: Props) {
  // Unmount the session when closed so a previous file/preview is never reused.
  return props.open ? <ImportDialogSession {...props} /> : null;
}
