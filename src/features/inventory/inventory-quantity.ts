// Exact NUMERIC(20,6) arithmetic; number adapters reject lossy Step 1 conversions.
const scale = BigInt(1_000_000);
const zero = BigInt(0);
const limit = BigInt("99999999999999999999");
export function quantityUnits(value: string | number): bigint {
  const text = String(value);
  if (!/^[+-]?\d+(?:\.\d{1,6})?$/.test(text))
    throw new Error("จำนวนต้องเป็นทศนิยมไม่เกิน 6 ตำแหน่ง โดยไม่ปัดเศษ");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^[+-]/, "").split(".");
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0"));
  if (result > limit) throw new Error("จำนวนเกินช่วงตัวเลข NUMERIC(20,6)");
  return negative ? -result : result;
}
export function quantityDecimal(value: bigint): string {
  if (value > limit || value < -limit)
    throw new Error("ยอดรวมเกินช่วงตัวเลข NUMERIC(20,6)");
  const absolute = value < zero ? -value : value;
  const fraction = (absolute % scale)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${value < zero ? "-" : ""}${absolute / scale}${fraction ? `.${fraction}` : ""}`;
}
export function quantityNumber(value: bigint): number {
  const exact = quantityDecimal(value);
  const result = Number(exact);
  if (!Number.isFinite(result) || quantityUnits(result) !== value)
    throw new Error("ยอดเกินความแม่นยำของ number สำหรับหน้าสินค้าคงคลังเดิม");
  return result;
}
export function inventoryQuantity(value: string | number): string {
  const exact = quantityDecimal(quantityUnits(value));
  const [whole, fraction] = exact.replace(/^-/, "").split(".");
  return `${exact.startsWith("-") ? "-" : ""}${new Intl.NumberFormat("th-TH").format(BigInt(whole))}${fraction ? `.${fraction}` : ""}`;
}
