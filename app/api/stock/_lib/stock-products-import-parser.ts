import "server-only";

import { Workbook, type Cell, type Worksheet } from "exceljs";

import {
  STOCK_PRODUCTS_DAILY_FIELDS,
  STOCK_PRODUCTS_EXCEL_STOCK_COLUMNS,
  STOCK_PRODUCTS_EXCEL_SO_COLUMNS,
  STOCK_PRODUCTS_SO_SHEET_NAMES,
  STOCK_PRODUCTS_SUMMARY_FIELDS,
  blankStockProductsDaily,
  blankStockProductsSummary,
  datesInStockProductsMonth,
  isValidStockProductsAddedDate,
  stockProductsExcelDailyColumn,
  type StockProductsMonth,
  type StockProductsStockRow,
  type StockProductsStockSheet,
  type StockProductsRawCell,
  type StockProductsSoRow,
  type StockProductsSoSheetName,
  type StockProductsWorkbook,
} from "@/src/features/stock_products/stock_products_domain";

const stockSheetName = "สรุปสินค้าสำเร็จรูปคงเหลือ FF";
const firstDataRow = 7;
const maxSheetRows = 10_000;
const columns = STOCK_PRODUCTS_EXCEL_STOCK_COLUMNS;
const soColumns = STOCK_PRODUCTS_EXCEL_SO_COLUMNS;
const firstSoDataRow = 4;

const thaiMonths = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

const stockHeaders = [
  ["A4", "ลำดับ"],
  ["C4", "รหัส"],
  ["D4", "รายละเอียด"],
  ["E4", "หน่วย"],
  ["F4", "ยอด"],
  ["G4", "รับ"],
  ["I4", "จ่าย"],
  ["G5", "เข้า"],
  ["H5", "คืน"],
  ["I5", "ลูกค้า"],
  ["J5", "ส่งเสริม"],
  ["K5", "ออฟฟิศ"],
  ["L5", "อื่นๆ"],
  ["M4", "ชำรุด"],
  ["N4", "คงเหลือ"],
  ["O4", "ตรวจนับ"],
  ["P4", "ผลต่าง"],
  ["Q4", "หมายเหตุ"],
  ["J6", "การขาย"],
  ["K6", "ตัวอย่าง"],
] as const;

const dailyHeaders = [
  "รับเข้า",
  "รับคืน",
  "ลูกค้า",
  "ส่งเสริม",
  "ออฟฟิศ",
  "อื่นๆ",
  "ชำรุด",
] as const;

export class StockProductsExcelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cell?: string,
    public readonly sheet_name?: string,
  ) {
    super(message);
    this.name = "StockProductsExcelError";
  }
}

function invalidCell(cell: Cell, code: string, message: string): never {
  throw new StockProductsExcelError(
    code,
    `${cell.worksheet.name}!${cell.address}: ${message}`,
    cell.address,
    cell.worksheet.name,
  );
}

function scalar(value: unknown, cell: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && !value.includes("\0")) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return invalidCell(
    cell,
    "INVALID_CELL",
    "ชนิดข้อมูลหรือค่าของเซลล์ไม่ถูกต้อง",
  );
}

// Read the saved result of formulas, never evaluate formulas or external links.
function cellText(cell: Cell): string {
  const value = cell.value;

  if (value !== null && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      const result = cell.result;

      if (result === null || result === undefined) {
        return invalidCell(
          cell,
          "FORMULA_VALUE_MISSING",
          "สูตรไม่มีผลลัพธ์ที่บันทึกไว้",
        );
      }

      return scalar(result, cell);
    }

    if ("richText" in value) {
      return scalar(value.richText.map((part) => part.text).join(""), cell);
    }
  }

  return scalar(value, cell);
}

function nullableText(cell: Cell): string | null {
  return cellText(cell).trim() || null;
}

function numericText(cell: Cell): string {
  const raw = cellText(cell);
  const value = raw.trim();
  if (!value) return "";

  if (
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ||
    !Number.isFinite(Number(value))
  ) {
    return invalidCell(cell, "INVALID_NUMBER", "กรุณาตรวจสอบค่าตัวเลขใน Excel");
  }

  return raw;
}

function normalizedHeader(value: string): string {
  return value.replace(/\s+/g, "");
}

function requireHeader(cell: Cell, expected: string): void {
  if (normalizedHeader(cellText(cell)) !== normalizedHeader(expected)) {
    invalidCell(cell, "INVALID_HEADER", `หัวคอลัมน์ต้องเป็น ${expected}`);
  }
}

function validateHeaders(sheet: Worksheet): void {
  for (const [address, expected] of stockHeaders) {
    requireHeader(sheet.getCell(address), expected);
  }

  for (let day = 1; day <= columns.last_day; day += 1) {
    const start = stockProductsExcelDailyColumn(
      day,
      STOCK_PRODUCTS_DAILY_FIELDS[0],
    );
    requireHeader(sheet.getCell(1, start), `วันที่ ${day}`);

    for (const [index, field] of STOCK_PRODUCTS_DAILY_FIELDS.entries()) {
      const column = stockProductsExcelDailyColumn(day, field);
      requireHeader(sheet.getCell(4, column), dailyHeaders[index]);
    }
    requireHeader(sheet.getCell(6, start + 3), "การขาย");
    requireHeader(sheet.getCell(6, start + 4), "ตัวอย่าง");
  }
}

function validatePeriod(sheet: Worksheet, period: StockProductsMonth): string {
  const cell = sheet.getCell("A2");
  const caption = cellText(cell).trim();
  const match =
    /^ณ\s*วันที่\s*(\d{1,2})\s+([^\s]+)\s+(?:(ค\.ศ\.|พ\.ศ\.)\s*)?(\d{4,5})$/.exec(
      caption,
    );
  if (!match)
    return invalidCell(cell, "INVALID_HEADER", "ไม่พบวัน เดือน ปีของรายงาน");

  const [, dayText, monthText, era, yearText] = match;
  const month = thaiMonths.findIndex((name) => name === monthText) + 1;
  const year = Number(yearText);
  const expectedYearAd = period.year_be - 543;

  // Compare against the selected period, not the current year or a guessed era.
  const matchesYear =
    era === "ค.ศ."
      ? year === expectedYearAd
      : era === "พ.ศ."
        ? year === period.year_be
        : year === expectedYearAd || year === period.year_be;

  if (month !== period.month || !matchesYear) {
    return invalidCell(
      cell,
      "PERIOD_MISMATCH",
      "งวดรายงานใน Excel ไม่ตรงกับเดือนที่เลือก",
    );
  }
  const dates = datesInStockProductsMonth(period);
  const day = Number(dayText);
  if (!dates.length || day < 1 || day > dates.length) {
    return invalidCell(cell, "INVALID_DATE", "วันที่หัวรายงานไม่ถูกต้อง");
  }

  return caption;
}

function parseRow(
  sheet: Worksheet,
  sourceRow: number,
  dates: readonly string[],
): StockProductsStockRow {
  const row = sheet.getRow(sourceRow);
  const noCell = row.getCell(columns.item_no);
  const noText = cellText(noCell).trim();
  const no = Number(noText);
  if (!/^\d+$/.test(noText) || !Number.isSafeInteger(no) || no < 1) {
    return invalidCell(
      noCell,
      "INVALID_ROW",
      "ลำดับสินค้าต้องเป็นจำนวนเต็มบวก",
    );
  }
  const nameCell = row.getCell(columns.name);
  const name = cellText(nameCell).trim();
  if (!name)
    return invalidCell(nameCell, "INVALID_ITEM_NAME", "ไม่พบชื่อสินค้า");

  // Read explicit values and merge masters first; bounded frames are resolved later.
  const groupCell = row.getCell(columns.group);
  const group = nullableText(groupCell.isMerged ? groupCell.master : groupCell);

  const summary = blankStockProductsSummary();
  for (const [index, field] of STOCK_PRODUCTS_SUMMARY_FIELDS.entries()) {
    summary[field] = numericText(row.getCell(columns.summary_first + index));
  }

  const daily: StockProductsStockRow["daily"] = [];
  for (let day = 1; day <= columns.last_day; day += 1) {
    const values = blankStockProductsDaily();
    for (const field of STOCK_PRODUCTS_DAILY_FIELDS) {
      values[field] = numericText(
        row.getCell(stockProductsExcelDailyColumn(day, field)),
      );
    }
    if (!STOCK_PRODUCTS_DAILY_FIELDS.some((field) => values[field] !== ""))
      continue;

    const date = dates[day - 1];
    if (!date) {
      return invalidCell(
        row.getCell(
          stockProductsExcelDailyColumn(day, STOCK_PRODUCTS_DAILY_FIELDS[0]),
        ),
        "INVALID_DATE",
        "พบข้อมูลรับ-จ่ายนอกวันที่ของงวดรายงาน",
      );
    }
    daily.push({ date, values });
  }

  return {
    item: {
      added_date: null,
      source_row: sourceRow,
      no,
      group,
      code: nullableText(row.getCell(columns.code)),
      name,
      unit: nullableText(row.getCell(columns.unit)),
    },
    summary,
    remark: cellText(row.getCell(columns.remark)),
    daily,
  };
}

// Some category blocks use borders instead of merged cells. Only inherit a
// category inside a complete, unambiguous column-B frame.
function fillBorderedStockGroups(
  sheet: Worksheet,
  rows: readonly StockProductsStockRow[],
): StockProductsStockRow[] {
  const inherited = new Map<number, string>();
  const hasSides = (cell: Cell): boolean =>
    cell.border?.left?.style === "thin" && cell.border?.right?.style === "thin";

  for (const [index, start] of rows.entries()) {
    const group = start.item.group;
    if (!group) continue;

    const first = sheet.getRow(start.item.source_row).getCell(columns.group);
    const firstBottom = first.border?.bottom?.style ?? null;
    if (
      first.isMerged ||
      !hasSides(first) ||
      first.border?.top?.style !== "thin" ||
      (firstBottom !== null && firstBottom !== "hair")
    ) {
      continue;
    }

    const pending: number[] = [];
    let previousRow = start.item.source_row;
    let previousBottom = firstBottom;

    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      if (
        next.item.source_row !== previousRow + 1 ||
        next.item.group !== null
      ) {
        break;
      }

      const cell = sheet.getRow(next.item.source_row).getCell(columns.group);
      const top = cell.border?.top?.style ?? null;
      const bottom = cell.border?.bottom?.style ?? null;
      if (cell.isMerged || !hasSides(cell) || top !== previousBottom) {
        break;
      }
      pending.push(next.item.source_row);

      if (bottom === "thin") {
        // Do not apply any inference until the closing border is found.
        for (const sourceRow of pending) inherited.set(sourceRow, group);
        break;
      }
      if (bottom !== null && bottom !== "hair") break;
      previousRow = next.item.source_row;
      previousBottom = bottom;
    }
  }

  return rows.map((row) => {
    const group = inherited.get(row.item.source_row);
    return group === undefined ? row : { ...row, item: { ...row.item, group } };
  });
}

async function loadStockWorkbook(
  bytes: ArrayBuffer,
  period: StockProductsMonth,
): Promise<Workbook> {
  if (
    !Number.isInteger(period.year_be) ||
    period.year_be < 544 ||
    period.year_be > 10542 ||
    !Number.isInteger(period.month) ||
    period.month < 1 ||
    period.month > 12
  ) {
    throw new StockProductsExcelError("INVALID_DATE", "งวดรายงานไม่ถูกต้อง");
  }

  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(bytes);
  } catch {
    throw new StockProductsExcelError(
      "INVALID_FILE",
      "ไม่สามารถอ่านไฟล์ Excel .xlsx ได้",
    );
  }

  return workbook;
}

function parseStockSheet(
  workbook: Workbook,
  period: StockProductsMonth,
): StockProductsStockSheet {
  const sheet = workbook.getWorksheet(stockSheetName);
  if (!sheet) {
    throw new StockProductsExcelError(
      "SHEET_NOT_FOUND",
      `ไม่พบ Sheet ${stockSheetName}`,
    );
  }
  if (sheet.rowCount > maxSheetRows) {
    throw new StockProductsExcelError(
      "INVALID_FILE",
      "จำนวนแถวเกินขอบเขตที่ระบบรองรับ",
    );
  }

  const reportCaption = validatePeriod(sheet, period);
  validateHeaders(sheet);
  const dates = datesInStockProductsMonth(period);
  const rows: StockProductsStockRow[] = [];
  let footerFound = false;

  for (
    let sourceRow = firstDataRow;
    sourceRow <= sheet.rowCount;
    sourceRow += 1
  ) {
    const row = sheet.getRow(sourceRow);
    const no = cellText(row.getCell(columns.item_no)).trim();
    const name = cellText(row.getCell(columns.name)).trim();
    const code = nullableText(row.getCell(columns.code));
    const unit = nullableText(row.getCell(columns.unit));

    if (footerFound) {
      const isSignature = /^\.+\s*ผู้จัดทำ$/.test(name);
      const isDatePlaceholder = /^\.+\s*\/\s*\.+\s*\/\s*\.+$/.test(name);
      if (
        no ||
        code !== null ||
        unit !== null ||
        (name && !isSignature && !isDatePlaceholder)
      ) {
        invalidCell(
          row.getCell(columns.item_no),
          "INVALID_ROW",
          "พบรายการสินค้าหลังแถวสรุปยอด ST",
        );
      }
      continue;
    }

    // ST is the unnumbered total row in this report, not a stock item.
    if (!no && name === "ST" && code === null && unit === null) {
      footerFound = true;
      continue;
    }

    if (!no) {
      // Ignore an entirely empty row, but never silently drop an incomplete item.
      for (let column = 1; column <= columns.daily_last; column += 1) {
        if (column === columns.group) continue;
        const cell = row.getCell(column);
        if (cellText(cell).trim()) {
          invalidCell(
            cell,
            "INVALID_ROW",
            "พบข้อมูลสินค้าแต่ไม่มีลำดับในคอลัมน์ A",
          );
        }
      }
      continue;
    }

    // Code and name are not unique identifiers. Preserve every numbered row.
    rows.push(parseRow(sheet, sourceRow, dates));
  }

  if (rows.length === 0) {
    throw new StockProductsExcelError(
      "EMPTY_SHEET",
      "ไม่พบรายการสินค้าใน Excel",
    );
  }

  return {
    source_sheet_name: sheet.name,
    report_caption: reportCaption,
    period,
    rows: fillBorderedStockGroups(sheet, rows),
  };
}

// Import-specific fields are separate from the legacy SO form contract.
// No item_id or stock_row_key is inferred from a product name.
export type StockProductsImportedSoRow = Omit<
  StockProductsSoRow,
  "id" | "stock_row_key" | "date_raw"
> & {
  date_raw: string;
  document_date: string | null;
  source_date_text: string;
};

export type StockProductsImportedSoSheet = {
  name: StockProductsSoSheetName;
  rows: StockProductsImportedSoRow[];
};

export type StockProductsWorkbookImportWarning = {
  severity: "warning";
  code: "SO_INVALID_DATE";
  message: string;
  sheet_name: StockProductsSoSheetName;
  source_row: number;
  cell: string;
};

export type StockProductsWorkbookImport = Omit<
  StockProductsWorkbook,
  "so_sheets"
> & {
  so_sheets: StockProductsImportedSoSheet[];
  issues: StockProductsWorkbookImportWarning[];
};

const soHeaders = [
  ["A1", "ว/ด/ป"],
  ["B1", "ชื่อลูกค้า"],
  ["C1", "เลขที่ SO"],
  ["E1", "รายการ"],
  ["E3", "รายละเอียดรายการ"],
  ["F3", "จำนวน"],
  ["H1", "ราคาต้นทุน"],
  ["H2", "ต้นทุนสินค้า"],
  ["I2", "ต้นทุนสินค้า"],
  ["J2", "ราคา"],
  ["K2", "ต้นทุน"],
  ["L2", "ค่าบรรจุ"],
  ["M2", "ต้นทุนค่าบรรจุ"],
  ["N2", "จำนวนตัน"],
] as const;

function validateSoHeaders(sheet: Worksheet): void {
  for (const [address, expected] of soHeaders) {
    requireHeader(sheet.getCell(address), expected);
  }
  const unit = sheet.getCell("G3");
  if (!["หน่วย", "หน่วยนับ"].includes(normalizedHeader(cellText(unit)))) {
    invalidCell(
      unit,
      "INVALID_HEADER",
      "หัวคอลัมน์ต้องเป็น หน่วย หรือ หน่วยนับ",
    );
  }
  // C3 is a printed group abbreviation, not a reliable worksheet identity.
  // For example, FTW and WM both display FW in the supplied workbook.
}

function soCellValue(cell: Cell): unknown {
  const master = cell.isMerged ? cell.master : cell;
  const value = master.value;
  if (value !== null && typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      const result = master.result;
      if (result === null || result === undefined) {
        return invalidCell(
          cell,
          "FORMULA_VALUE_MISSING",
          "สูตรไม่มีผลลัพธ์ที่บันทึกไว้",
        );
      }
      return result;
    }
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
  }
  return value;
}

function isBlankSoValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  );
}

function soSupplementaryValue(cell: Cell): StockProductsRawCell {
  const value = soCellValue(cell);
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && !value.includes("\0")) return value;
  return invalidCell(
    cell,
    "INVALID_CELL",
    "ชนิดข้อมูลเพิ่มเติมของ SO ไม่ถูกต้อง",
  );
}

function requiredSoText(cell: Cell, label: string): string {
  const value = scalar(soCellValue(cell), cell);
  if (!value.trim()) {
    return invalidCell(cell, "INVALID_SO_ROW", `ไม่พบ${label}`);
  }
  return value;
}

function isoSoDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidStockProductsAddedDate(iso) ? iso : null;
}

const englishMonths = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;
const thaiShortMonths = [
  "มค",
  "กพ",
  "มีค",
  "เมย",
  "พค",
  "มิย",
  "กค",
  "สค",
  "กย",
  "ตค",
  "พย",
  "ธค",
] as const;

function soMonthNumber(value: string): number {
  if (/^\d{1,2}$/.test(value)) return Number(value);
  const name = value.toLowerCase().replace(/\./g, "");
  const index = englishMonths.findIndex(
    (month) => name === month || name === month.slice(0, 3),
  );
  if (index !== -1) return index + 1;
  const thaiIndex = thaiMonths.findIndex(
    (month, i) => name === month || name === thaiShortMonths[i],
  );
  return thaiIndex + 1;
}

function soTextYear(year: string, era?: string): number | null {
  const numeric = Number(year);
  if (year.length === 2) {
    // This Thai report uses abbreviated Buddhist years (69 = 2569).
    // Explicit CE abbreviations are ambiguous, so preserve them as raw text.
    return era === "ค.ศ." ? null : 2500 + numeric - 543;
  }
  if (year.length !== 4) return null;
  if (era === "พ.ศ.") return numeric - 543;
  if (era === "ค.ศ.") return numeric;
  // Unmarked four-digit 25xx years in this Thai report are Buddhist years.
  return numeric >= 2500 && numeric <= 2599 ? numeric - 543 : numeric;
}

function parseSoTextDate(value: string): string | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const year = soTextYear(iso[1]);
    return year === null
      ? null
      : isoSoDate(year, Number(iso[2]), Number(iso[3]));
  }
  const numeric =
    /^(\d{1,2})([/.-])(\d{1,2})\2(?:(พ\.ศ\.|ค\.ศ\.)\s*)?(\d{2}|\d{4})$/.exec(
      text,
    );
  if (numeric) {
    const year = soTextYear(numeric[5], numeric[4]);
    return year === null
      ? null
      : isoSoDate(year, Number(numeric[3]), Number(numeric[1]));
  }
  const named =
    /^(\d{1,2})\s+([^\s]+)\s+(?:(พ\.ศ\.|ค\.ศ\.)\s*)?(\d{2}|\d{4})$/.exec(text);
  if (named) {
    const year = soTextYear(named[4], named[3]);
    return year === null
      ? null
      : isoSoDate(year, soMonthNumber(named[2]), Number(named[1]));
  }
  return null;
}

function isLegacyThaiDateFormat(format: string): boolean {
  // Exact Thai calendar marker found in the original workbook. A four-digit
  // CE format or an unrelated historical date is not a legacy short BE year.
  return (
    /\[\$-101041e\]/i.test(format) && /(?:^|[^y])yy(?:[^y]|$)/i.test(format)
  );
}

function normalizeSoExcelDate(date: Date, format: string): string | null {
  if (!Number.isFinite(date.getTime())) return null;
  let year = date.getUTCFullYear();
  if (isLegacyThaiDateFormat(format) && year >= 1930 && year <= 1999) {
    // Excel expanded a two-digit Buddhist year into a 19xx Gregorian year.
    year = 2500 + (year % 100) - 543;
  } else if (isLegacyThaiDateFormat(format) && year >= 2500 && year <= 2599) {
    year -= 543;
  }
  return isoSoDate(year, date.getUTCMonth() + 1, date.getUTCDate());
}

function excelSerialDate(value: number, date1904: boolean): Date | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const days = Math.floor(value);
  // Excel's 1900 calendar contains the fictional 1900-02-29 (serial 60).
  if (!date1904 && (days === 0 || days === 60)) return null;
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31);
  const offset = date1904 || days < 60 ? days : days - 1;
  const date = new Date(base + offset * 86_400_000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function isSoDateFormat(format: string): boolean {
  const tokens = format.replace(/\[[^\]]*\]|"[^"]*"|\\./g, "");
  return /y/i.test(tokens) && /m/i.test(tokens) && /d/i.test(tokens);
}

function parseSoDate(
  cell: Cell,
  sheetName: StockProductsSoSheetName,
  sourceRow: number,
  date1904: boolean,
  issues: StockProductsWorkbookImportWarning[],
): Pick<
  StockProductsImportedSoRow,
  "date_raw" | "document_date" | "source_date_text"
> {
  const value = soCellValue(cell);
  const master = cell.isMerged ? cell.master : cell;
  const format = master.numFmt ?? "";
  let sourceDateText: string;
  let documentDate: string | null = null;
  if (value instanceof Date) {
    sourceDateText = Number.isFinite(value.getTime())
      ? value.toISOString().slice(0, 10)
      : String(value);
    documentDate = normalizeSoExcelDate(value, format);
  } else if (typeof value === "number" && Number.isFinite(value)) {
    sourceDateText = String(value);
    if (isSoDateFormat(format)) {
      const date = excelSerialDate(value, date1904);
      if (date) documentDate = normalizeSoExcelDate(date, format);
    }
  } else if (typeof value === "boolean") {
    sourceDateText = String(value);
  } else {
    sourceDateText = scalar(value, cell);
    documentDate = parseSoTextDate(sourceDateText);
  }
  if (documentDate === null) {
    issues.push({
      severity: "warning",
      code: "SO_INVALID_DATE",
      message: `${sheetName}!${cell.address}: วันที่ SO ไม่ถูกต้องหรือไม่สามารถระบุได้ จะเก็บข้อความเดิมโดยไม่กำหนดวันที่จริง`,
      sheet_name: sheetName,
      source_row: sourceRow,
      cell: cell.address,
    });
  }
  return {
    date_raw: documentDate ?? sourceDateText,
    document_date: documentDate,
    source_date_text: sourceDateText,
  };
}

function isSoTotalFormula(cell: Cell, sourceRow: number): boolean {
  const formula = cell.formula?.replace(/\s|\$/g, "").toUpperCase();
  const column = cell.address.replace(/\d+$/, "");
  return (
    formula === `SUM(${column}${firstSoDataRow}:${column}${sourceRow - 1})`
  );
}

function parseSoSheet(
  sheet: Worksheet,
  name: StockProductsSoSheetName,
  date1904: boolean,
  issues: StockProductsWorkbookImportWarning[],
): StockProductsImportedSoSheet {
  if (sheet.rowCount > maxSheetRows) {
    throw new StockProductsExcelError(
      "INVALID_FILE",
      `${name}: จำนวนแถวเกินขอบเขตที่ระบบรองรับ`,
      undefined,
      name,
    );
  }
  validateSoHeaders(sheet);
  const rows: StockProductsImportedSoRow[] = [];
  let footerFound = false;
  const lastColumn = soColumns.supplementary_last;
  const rowCount = sheet.rowCount;
  for (let sourceRow = firstSoDataRow; sourceRow <= rowCount; sourceRow += 1) {
    const row = sheet.getRow(sourceRow);
    const dateCell = row.getCell(soColumns.date);
    const customerCell = row.getCell(soColumns.customer_name);
    const soCell = row.getCell(soColumns.so_number);
    const productCell = row.getCell(soColumns.product_name);
    const quantityCell = row.getCell(soColumns.quantity);
    const unitCell = row.getCell(soColumns.unit);
    const mergedSoCell = row.getCell(soColumns.so_number + 1);
    if (
      !(
        mergedSoCell.isMerged && mergedSoCell.master.address === soCell.address
      ) &&
      !isBlankSoValue(soCellValue(mergedSoCell))
    ) {
      invalidCell(
        mergedSoCell,
        "INVALID_SO_ROW",
        "พบข้อมูลในคอลัมน์ D ที่ไม่ได้รวมกับเลข SO",
      );
    }
    // Read the date without converting it here so that a blank or total row
    // never creates a date warning. Skip actual merged followers when checking
    // whether a row contains its own data.
    const ownCells: Cell[] = [];
    for (
      let column = 1;
      column <= Math.max(lastColumn, row.cellCount);
      column += 1
    ) {
      const cell = row.getCell(column);
      if (!cell.isMerged || cell.master.address === cell.address)
        ownCells.push(cell);
    }
    const dateValue = soCellValue(dateCell);
    const totalLabel =
      typeof dateValue === "string" && dateValue.trim() === "รวม";
    const totalFormula = isSoTotalFormula(quantityCell, sourceRow);
    const identityBlank = [customerCell, soCell, productCell, unitCell].every(
      (cell) => isBlankSoValue(soCellValue(cell)),
    );
    const totalOnly = ownCells.every((cell) => {
      if (
        cell.address === dateCell.address ||
        cell.address === quantityCell.address
      )
        return true;
      return (
        isSoTotalFormula(cell, sourceRow) || isBlankSoValue(soCellValue(cell))
      );
    });
    // ODM-OLM has an unlabelled SUM footer. Never discard an arbitrary
    // quantity-only row just because its product name is missing.
    if (
      !footerFound &&
      identityBlank &&
      totalOnly &&
      (totalLabel || (isBlankSoValue(dateValue) && totalFormula))
    ) {
      if (!totalFormula && !isBlankSoValue(soCellValue(quantityCell))) {
        numericText(quantityCell);
      }
      footerFound = true;
      continue;
    }
    const populated = ownCells.filter(
      (cell) => !isBlankSoValue(soCellValue(cell)),
    );
    if (populated.length === 0) continue;
    if (footerFound) {
      invalidCell(populated[0], "INVALID_SO_ROW", "พบข้อมูลหลังแถวรวมของ SO");
    }
    const extra = populated.find((cell) => Number(cell.col) > lastColumn);
    if (extra)
      invalidCell(extra, "INVALID_SO_ROW", "พบข้อมูลนอกคอลัมน์ A ถึง N ของ SO");
    const customerName = requiredSoText(customerCell, "ชื่อลูกค้า");
    const soNumber = requiredSoText(soCell, "เลข SO");
    const productName = requiredSoText(productCell, "ชื่อสินค้า");
    const quantity = numericText(quantityCell);
    if (!quantity.trim())
      invalidCell(quantityCell, "INVALID_SO_ROW", "ไม่พบจำนวนสินค้า");
    const supplementaryCells: StockProductsRawCell[] = [];
    for (
      let column = soColumns.supplementary_first;
      column <= lastColumn;
      column += 1
    ) {
      supplementaryCells.push(soSupplementaryValue(row.getCell(column)));
    }
    rows.push({
      sheet_name: name,
      source_row: sourceRow,
      ...parseSoDate(dateCell, name, sourceRow, date1904, issues),
      customer_name: customerName,
      so_number: soNumber,
      product_name: productName,
      quantity,
      unit: scalar(soCellValue(unitCell), unitCell),
      supplementary_cells: supplementaryCells,
    });
  }
  return { name, rows };
}

// Keep the existing Stock-only API working while its callers are migrated.
export async function parseStockProductsExcel(
  bytes: ArrayBuffer,
  period: StockProductsMonth,
): Promise<StockProductsStockSheet> {
  const workbook = await loadStockWorkbook(bytes, period);
  return parseStockSheet(workbook, period);
}

// A2: read all SO worksheets, irrespective of their transaction dates.
// Missing worksheets fail closed; a present, valid empty worksheet is allowed.
export async function parseStockProductsWorkbookExcel(
  bytes: ArrayBuffer,
  period: StockProductsMonth,
): Promise<StockProductsWorkbookImport> {
  const workbook = await loadStockWorkbook(bytes, period);
  const stock = parseStockSheet(workbook, period);
  const issues: StockProductsWorkbookImportWarning[] = [];
  const sheets = STOCK_PRODUCTS_SO_SHEET_NAMES.map((name) => {
    const sheet = workbook.getWorksheet(name);
    if (!sheet || sheet.name !== name) {
      throw new StockProductsExcelError(
        "SO_SHEET_NOT_FOUND",
        `ไม่พบชีต SO ${name}`,
        undefined,
        name,
      );
    }
    return parseSoSheet(
      sheet,
      name,
      workbook.properties.date1904 === true,
      issues,
    );
  });
  return { stock, so_sheets: sheets, issues };
}
