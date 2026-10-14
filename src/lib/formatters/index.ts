export const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export const quantity = (value: number) =>
  new Intl.NumberFormat("th-TH").format(value);
export const date = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
