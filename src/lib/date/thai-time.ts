export const THAI_TIME_HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export const THAI_TIME_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export type ThaiTimePart = "hour" | "minute";

export function parseThaiTime(
  value: string,
): { hour: string; minute: string } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match || match[0] !== value) return null;

  return {
    hour: match[1],
    minute: match[2],
  };
}

export function isValidThaiTime(value: string): boolean {
  return parseThaiTime(value) !== null;
}

// Keep the other part unchanged. Empty input is never populated on render.
export function setThaiTimePart(
  value: string,
  part: ThaiTimePart,
  selection: string,
): string | null {
  if (selection === "") return "";

  const options =
    part === "hour" ? THAI_TIME_HOURS : THAI_TIME_MINUTES;

  if (!options.includes(selection)) return null;

  const current = parseThaiTime(value);

  const hour =
    part === "hour" ? selection : (current?.hour ?? "00");

  const minute =
    part === "minute" ? selection : (current?.minute ?? "00");

  return `${hour}:${minute}`;
}

export function timeInBangkok(date: Date = new Date()): string {
  if (!Number.isFinite(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    numberingSystem: "latn",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  const value = `${hour ?? ""}:${minute ?? ""}`;

  return isValidThaiTime(value) ? value : "";
}