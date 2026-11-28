import { isValidThaiTime } from "./thai-time";

export const THAI_TIME_15_OPTIONS: readonly string[] = Array.from(
  { length: 96 },
  (_, index) => {
    const totalMinutes = index * 15;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  },
);

export function getThaiTime15Options(currentValue = ""): string[] {
  const options = [...THAI_TIME_15_OPTIONS];

  if (isValidThaiTime(currentValue) && !options.includes(currentValue)) {
    options.push(currentValue);
    options.sort();
  }

  return options;
}
