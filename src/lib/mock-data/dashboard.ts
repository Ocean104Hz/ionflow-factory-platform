// Fictional historical analytics, separate from the interactive document workspace.
export type DashboardPeriod = "today" | "week" | "month" | "year" | "custom";
export type DateRange = { from: string; to: string };
export type AnalyticsRow = {
  date: string;
  productionOrderCount: number;
  totalQuantity: number;
  completedCount: number;
};
const dayMs = 86_400_000;
const iso = (value: Date) => value.toISOString().slice(0, 10);
const parse = (value: string) => new Date(`${value}T00:00:00Z`);
export const analyticsProducts = [
  { sku: "DEMO-P001", name: "เม็ดพลาสติกรีไซเคิลสำหรับงานอุตสาหกรรม" },
  { sku: "DEMO-P002", name: "แผ่นวัสดุกันกระแทกมาตรฐาน" },
  { sku: "DEMO-P003", name: "วัสดุผสมสูตรพิเศษสำหรับการผลิต" },
  { sku: "DEMO-P004", name: "บรรจุภัณฑ์อุตสาหกรรม" },
  { sku: "DEMO-P005", name: "ชิ้นส่วนขึ้นรูปอเนกประสงค์" },
];
export function validRange(range: DateRange) {
  return (
    [range.from, range.to].every(
      (value) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(parse(value).getTime()) &&
        iso(parse(value)) === value,
    ) && range.from <= range.to
  );
}
export function periodRange(
  period: Exclude<DashboardPeriod, "custom">,
  anchor: string,
): DateRange {
  const today = parse(anchor);
  if (period === "today") return { from: anchor, to: anchor };
  if (period === "week")
    return { from: iso(new Date(today.getTime() - 6 * dayMs)), to: anchor };
  const year = today.getUTCFullYear(),
    month = today.getUTCMonth();
  return period === "month"
    ? {
        from: iso(new Date(Date.UTC(year, month, 1))),
        to: iso(new Date(Date.UTC(year, month + 1, 0))),
      }
    : { from: `${year}-01-01`, to: `${year}-12-31` };
}
export function createAnalytics(anchor: string) {
  const start = parse(`${anchor.slice(0, 4)}-01-01`).getTime();
  return Array.from(
    { length: Math.floor((parse(anchor).getTime() - start) / dayMs) + 1 },
    (_, index) => {
      const quantities = analyticsProducts.map(
        (_, product) => 12 + ((index * (product + 3) + product * 7) % 55),
      );
      return {
        date: iso(new Date(start + index * dayMs)),
        productionOrderCount: 5 + (index % 8),
        totalQuantity: quantities.reduce((sum, quantity) => sum + quantity, 0),
        completedCount: 2 + (index % 4),
        quantities,
      };
    },
  );
}
export function dashboardAnalytics(
  range: DateRange,
  anchor: string,
  monthly = false,
) {
  if (!validRange(range)) throw new Error("Invalid dashboard date range");
  const history = createAnalytics(anchor).filter(
    (row) => row.date >= range.from && row.date <= range.to,
  );
  const days =
    (parse(range.to).getTime() - parse(range.from).getTime()) / dayMs + 1;
  // Long custom ranges retain exact bounds; only their display buckets are aggregated.
  const granularity = monthly || days > 62 ? "month" : "day";
  const buckets = new Map<string, AnalyticsRow>();
  let cursor = parse(range.from);
  while (iso(cursor) <= range.to) {
    const key = granularity === "month" ? iso(cursor).slice(0, 7) : iso(cursor);
    buckets.set(key, {
      date: key,
      productionOrderCount: 0,
      totalQuantity: 0,
      completedCount: 0,
    });
    cursor =
      granularity === "month"
        ? new Date(
            Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
          )
        : new Date(cursor.getTime() + dayMs);
  }
  for (const row of history) {
    const bucket = buckets.get(
      granularity === "month" ? row.date.slice(0, 7) : row.date,
    )!;
    bucket.productionOrderCount += row.productionOrderCount;
    bucket.totalQuantity += row.totalQuantity;
    bucket.completedCount += row.completedCount;
  }
  return {
    rows: [...buckets.values()],
    granularity,
    orderCount: history.reduce((sum, row) => sum + row.productionOrderCount, 0),
    topProducts: analyticsProducts
      .map((product, index) => ({
        ...product,
        quantity: history.reduce((sum, row) => sum + row.quantities[index], 0),
      }))
      .sort((a, b) => b.quantity - a.quantity),
    hasData: history.length > 0,
  };
}
