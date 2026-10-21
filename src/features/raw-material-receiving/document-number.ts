export const INB_MOCK_COUNTER_KEY = "ionflow.factory.inbound.mock-counters.v1";
type CounterStorage = Pick<Storage, "getItem">;

export interface InboundNumberPreview {
  documentNo: string;
  period: string;
  year: number;
  month: number;
  sequence: number;
}
export interface InboundReservation extends InboundNumberPreview {
  token: string;
  reservedAt: string;
  expiresAt: string;
  status: "reserved" | "used";
}

export function isValidIsoDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function todayInBangkok(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}

export function formatThaiBuddhistDate(value: string): string {
  if (!isValidIsoDate(value)) return "";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+07:00`));
}

export function inboundNumberPreview(
  date: string,
  sequence: number,
): InboundNumberPreview {
  if (!isValidIsoDate(date))
    throw new Error("กรุณาระบุวันที่รับเข้าที่ถูกต้อง");
  if (!Number.isSafeInteger(sequence) || sequence < 1)
    throw new Error("ลำดับเลข INB ไม่ถูกต้อง");
  const period = date.slice(0, 7),
    shortPeriod = date.slice(2, 4) + date.slice(5, 7);
  return {
    documentNo: `INB-${shortPeriod}${String(sequence).padStart(3, "0")}`,
    period,
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    sequence,
  };
}

// Old counters remain read-only high-water marks; unknown old allocations are not reused.
export function legacyInboundCounters(
  storage: CounterStorage,
): Record<string, number> {
  const raw = storage.getItem(INB_MOCK_COUNTER_KEY);
  let parsed: unknown = {};
  if (raw !== null) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("ตัวนับเลข INB ทดลองเสียหาย ระบบจะไม่เขียนทับข้อมูลเดิม");
    }
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.entries(parsed).some(
      ([key, value]) =>
        !/^\d{2}(0[1-9]|1[0-2])$/.test(key) ||
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 0,
    )
  )
    throw new Error(
      "ตัวนับเลข INB ทดลองไม่ถูกต้อง ระบบจะไม่เริ่มเลขใหม่ทับข้อมูลเดิม",
    );
  return parsed as Record<string, number>;
}
