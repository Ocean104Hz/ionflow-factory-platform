export const THAI_MONTHS = [
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

export const THAI_WEEKDAYS = [
  "อา",
  "จ",
  "อ",
  "พ",
  "พฤ",
  "ศ",
  "ส",
] as const;

export type CalendarDayCell = {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
};

function isValidYmd(
  year: number,
  month: number,
  day: number,
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function buildIso(
  year: number,
  month: number,
  day: number,
): string {
  if (!isValidYmd(year, month, day)) return "";

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function toISO10(
  value?: string | null,
): string {
  if (!value) return "";

  const trimmed = String(value).trim();

  if (!trimmed) return "";

  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/,
  );

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    return buildIso(year, month, day);
  }

  const dmyMatch = trimmed.match(
    /^(\d{2})[-/](\d{2})[-/](\d{4})$/,
  );

  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);

    return buildIso(year, month, day);
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed.slice(0, 10);
  }

  return toLocalISODate(parsed);
}

export function parseISODateString(
  value: string,
): Date | null {
  const iso = toISO10(value);

  if (!iso) return null;

  const [yearText, monthText, dayText] =
    iso.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!isValidYmd(year, month, day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function formatThaiDate(
  value?: string | null,
): string {
  const iso = toISO10(value);

  if (!iso) return "";

  const [yearText, monthText, dayText] =
    iso.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return iso;
  }

  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year + 543}`;
}

export function formatDateForPrint(
  value?: string | null,
): string {
  return formatThaiDate(value);
}

export function buildCalendarDays(
  year: number,
  monthIndex: number,
): CalendarDayCell[] {
  const firstDayOfMonth = new Date(
    year,
    monthIndex,
    1,
  );

  const firstWeekday =
    firstDayOfMonth.getDay();

  const daysInCurrentMonth = new Date(
    year,
    monthIndex + 1,
    0,
  ).getDate();

  const daysInPreviousMonth = new Date(
    year,
    monthIndex,
    0,
  ).getDate();

  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < 42; i += 1) {
    if (i < firstWeekday) {
      const day =
        daysInPreviousMonth -
        firstWeekday +
        i +
        1;

      const cellDate = new Date(
        year,
        monthIndex - 1,
        day,
      );

      cells.push({
        iso: toLocalISODate(cellDate),
        day: cellDate.getDate(),
        inCurrentMonth: false,
      });

      continue;
    }

    if (
      i <
      firstWeekday + daysInCurrentMonth
    ) {
      const day = i - firstWeekday + 1;

      const cellDate = new Date(
        year,
        monthIndex,
        day,
      );

      cells.push({
        iso: toLocalISODate(cellDate),
        day: cellDate.getDate(),
        inCurrentMonth: true,
      });

      continue;
    }

    const day =
      i -
      (firstWeekday + daysInCurrentMonth) +
      1;

    const cellDate = new Date(
      year,
      monthIndex + 1,
      day,
    );

    cells.push({
      iso: toLocalISODate(cellDate),
      day: cellDate.getDate(),
      inCurrentMonth: false,
    });
  }

  return cells;
}

export function todayInBangkok(
  date: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Bangkok",
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(date);

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;

  const month = parts.find(
    (part) => part.type === "month",
  )?.value;

  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}