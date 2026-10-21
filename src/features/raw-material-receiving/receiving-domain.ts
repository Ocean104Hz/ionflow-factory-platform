import type { ReceivingHeaderValues } from "./receiving-header";
import { isValidIsoDate } from "./document-number";

/** Every receipt line has independent input state. No live PO/inventory side effects. */
export type ReceivingItem = {
  id: string;
  source: "manual";
  quantity: string;
  unit: string;
  description: string;
  orderNoticeDate: string;
  materialCode: string;
  unitPrice: string;
};

export type ReceivingSigners = {
  issuerName: string;
  approverName: string;
  recorderName: string;
  inspectorName: string;
};

export type ReceivingItemField =
  | "quantity"
  | "unit"
  | "description"
  | "orderNoticeDate"
  | "materialCode"
  | "unitPrice";
export type ReceivingHeaderField =
  | "documentNo"
  | "receiveDate"
  | "poDate"
  | "location"
  | "supplierName"
  | "warehouseCode";

export type ReceivingValidation = {
  header: Partial<Record<ReceivingHeaderField, string>>;
  items: Record<string, Partial<Record<ReceivingItemField, string>>>;
  general: string | null;
  valid: boolean;
};

export const RECEIVING_UNITS = [
  "กระสอบ",
  "กิโลกรัม",
  "ตัน",
  "ถุง",
  "Bag",
] as const;

export function blankReceivingItem(id: string, orderNoticeDate: string): ReceivingItem {
  return {
    id,
    source: "manual",
    quantity: "",
    unit: "กระสอบ",
    description: "",
    orderNoticeDate,
    materialCode: "",
    unitPrice: "",
  };
}

export function blankReceivingSigners(): ReceivingSigners {
  return {
    issuerName: "",
    approverName: "",
    recorderName: "",
    inspectorName: "",
  };
}

/** Convert a nonnegative decimal string to integer fixed-point units without binary floating-point. */
function parseFixedPoint(value: string, decimals: number): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const [whole, part = ""] = trimmed.split(".");
  if (part.length > decimals) return null;
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(part.padEnd(decimals, "0") || "0");
}

/** Round at half a satang? No: quantities use 4 decimals; money rounds to satang, half up. */
export function itemAmountCents(item: ReceivingItem): bigint | null {
  const quantity = parseFixedPoint(item.quantity, 4);
  const unitPriceCents = parseFixedPoint(item.unitPrice, 2);
  if (quantity === null || unitPriceCents === null) return null;
  const divisor = BigInt(10000);
  return (quantity * unitPriceCents + divisor / BigInt(2)) / divisor;
}

export function formatMoneyCents(cents: bigint): string {
  const negative = cents < BigInt(0);
  const absolute = negative ? -cents : cents;
  const whole = (absolute / BigInt(100)).toLocaleString("th-TH");
  const fraction = String(absolute % BigInt(100)).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function formatQuantityUnits(quantity: bigint): string {
  const whole = quantity / BigInt(10000);
  const fractional = String(quantity % BigInt(10000))
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${whole.toLocaleString("th-TH")}${fractional ? `.${fractional}` : ""}`;
}

export type ReceivingTotals = {
  amountCents: bigint;
  amountDisplay: string;
  quantities: { unit: string; quantity: string }[];
};

export function calculateReceivingTotals(items: readonly ReceivingItem[]): ReceivingTotals {
  let amountCents = BigInt(0);
  const quantities = new Map<string, bigint>();
  for (const item of items) {
    const cents = itemAmountCents(item);
    if (cents !== null) amountCents += cents;
    const quantity = parseFixedPoint(item.quantity, 4);
    if (quantity !== null) {
      const unit = item.unit.trim();
      if (unit) quantities.set(unit, (quantities.get(unit) ?? BigInt(0)) + quantity);
    }
  }
  return {
    amountCents,
    amountDisplay: formatMoneyCents(amountCents),
    quantities: [...quantities].map(([unit, quantity]) => ({
      unit,
      quantity: formatQuantityUnits(quantity),
    })),
  };
}

/** The mock form does not require PO/QC/signatures, since those workflows are not connected. */
export function validateReceivingDraft(
  header: ReceivingHeaderValues,
  items: readonly ReceivingItem[],
): ReceivingValidation {
  const headerErrors: ReceivingValidation["header"] = {};
  const itemErrors: ReceivingValidation["items"] = {};
  if (!header.location.trim()) headerErrors.location = "กรุณาระบุสถานที่รับสินค้า";
  if (header.poDate && !isValidIsoDate(header.poDate)) headerErrors.poDate = "วันที่ PO ไม่ถูกต้อง กรุณาตรวจสอบวันที่ PO";
  if (!isValidIsoDate(header.receiveDate)) headerErrors.receiveDate = "กรุณาระบุวันที่รับเข้าที่ถูกต้อง";
  if (!header.supplierName.trim()) headerErrors.supplierName = "กรุณากรอกชื่อผู้จำหน่าย";
  if (!header.warehouseCode.trim()) headerErrors.warehouseCode = "กรุณาระบุรหัสคลัง";
  if (!/^INB-\d{7,}$/.test(header.documentNo)) {
    headerErrors.documentNo = "กรุณากดสร้างเลข INB ก่อนบันทึก";
  } else if (
    isValidIsoDate(header.receiveDate) &&
    header.documentNo.slice(4, 8) !== `${header.receiveDate.slice(2, 4)}${header.receiveDate.slice(5, 7)}`
  ) {
    headerErrors.documentNo = "เลข INB ไม่ตรงกับเดือนของวันที่รับเข้า";
  }
  for (const item of items) {
    const row: Partial<Record<ReceivingItemField, string>> = {};
    const quantity = parseFixedPoint(item.quantity, 4);
    if (quantity === null || quantity <= BigInt(0)) row.quantity = "จำนวนต้องมากกว่า 0 และมีทศนิยมไม่เกิน 4 ตำแหน่ง";
    if (!item.unit.trim()) row.unit = "กรุณาเลือกหน่วยนับ";
    if (!item.description.trim()) row.description = "กรุณากรอกรายการวัตถุดิบ";
    if (!isValidIsoDate(item.orderNoticeDate)) row.orderNoticeDate = "กรุณาเลือกวันที่แจ้งสั่งซื้อ";
    if (!item.materialCode.trim()) row.materialCode = "กรุณากรอกรหัสวัตถุดิบ";
    const price = parseFixedPoint(item.unitPrice, 2);
    if (price === null || price <= BigInt(0)) row.unitPrice = "ราคาต่อหน่วยต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง";
    if (Object.keys(row).length > 0) itemErrors[item.id] = row;
  }
  const general = items.length === 0 ? "กรุณาเพิ่มรายการวัตถุดิบอย่างน้อย 1 รายการ" : items.some(item=>!item.id.trim()) || new Set(items.map(item=>item.id)).size!==items.length ? "รหัสแถวสินค้าไม่ถูกต้องหรือซ้ำ กรุณาตรวจสอบรายการ" : null;
  return {
    header: headerErrors,
    items: itemErrors,
    general,
    valid: !general && Object.keys(headerErrors).length === 0 && Object.keys(itemErrors).length === 0,
  };
}
