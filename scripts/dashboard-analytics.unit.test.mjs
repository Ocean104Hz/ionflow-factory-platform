import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compiled = ts.transpileModule(read("src/lib/mock-data/dashboard.ts"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { periodRange, validRange, dashboardAnalytics, createAnalytics } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
const anchor = "2026-10-14";
test("today and seven days use exact daily buckets", () => {
  assert.deepEqual(periodRange("today", anchor), { from: anchor, to: anchor });
  const today = dashboardAnalytics(periodRange("today", anchor), anchor);
  assert.equal(today.rows.length, 1);
  const week = dashboardAnalytics(periodRange("week", anchor), anchor);
  assert.equal(week.rows.length, 7);
  assert.equal(week.rows[0].date, "2026-10-08");
  assert.equal(week.rows[6].date, anchor);
});
test("month keeps every calendar date and future days are zero", () => {
  const result = dashboardAnalytics(periodRange("month", anchor), anchor);
  assert.equal(result.rows.length, 31);
  assert.equal(result.rows[0].date, "2026-10-01");
  assert.equal(result.rows.at(-1).date, "2026-10-31");
  assert.equal(result.rows[14].productionOrderCount, 0);
  assert.equal(
    dashboardAnalytics(periodRange("month", "2024-02-14"), "2024-02-14").rows
      .length,
    29,
  );
});
test("year has twelve monthly buckets with conserved totals", () => {
  const result = dashboardAnalytics(periodRange("year", anchor), anchor, true);
  assert.equal(result.rows.length, 12);
  assert.equal(result.rows[9].date, "2026-10");
  assert.equal(result.rows[10].totalQuantity, 0);
  assert.equal(
    result.orderCount,
    createAnalytics(anchor).reduce(
      (sum, row) => sum + row.productionOrderCount,
      0,
    ),
  );
});
test("custom monthly aggregation does not include days outside exact range", () => {
  const range = { from: "2026-08-15", to: "2026-10-16" };
  const result = dashboardAnalytics(range, anchor);
  assert.equal(result.granularity, "month");
  const expected = createAnalytics(anchor).filter(
    (row) => row.date >= range.from && row.date <= range.to,
  );
  assert.equal(
    result.orderCount,
    expected.reduce((sum, row) => sum + row.productionOrderCount, 0),
  );
});
test("invalid dates rejected; out-of-fixture ranges retain zero buckets", () => {
  for (const range of [
    { from: "2026-02-30", to: anchor },
    { from: anchor, to: "2026-01-01" },
    { from: "", to: anchor },
  ]) {
    assert.equal(validRange(range), false);
    assert.throws(() => dashboardAnalytics(range, anchor));
  }
  const result = dashboardAnalytics(
    { from: "2027-01-01", to: "2027-01-03" },
    anchor,
  );
  assert.equal(result.hasData, false);
  assert.equal(result.rows.length, 3);
  assert.ok(result.rows.every((row) => row.totalQuantity === 0));
});
test("top five fictional products sorted, quantities reconcile and change with period", () => {
  const week = dashboardAnalytics(periodRange("week", anchor), anchor);
  assert.equal(week.topProducts.length, 5);
  assert.ok(
    week.topProducts.every((product) => product.sku.startsWith("DEMO-")),
  );
  assert.ok(
    week.topProducts.every(
      (product, index, products) =>
        index === 0 || products[index - 1].quantity >= product.quantity,
    ),
  );
  assert.equal(
    week.topProducts.reduce((sum, product) => sum + product.quantity, 0),
    week.rows.reduce((sum, row) => sum + row.totalQuantity, 0),
  );
  assert.notDeepEqual(
    week.topProducts,
    dashboardAnalytics(periodRange("today", anchor), anchor).topProducts,
  );
});
test("top products donut uses shared chart, actual quantities and a non-color-only legend", () => {
  const source = read("src/features/dashboard/top-ordered-products.tsx");
  for (const token of [
    "@/src/components/ui/chart",
    "<ChartContainer",
    "<PieChart accessibilityLayer",
    "<ChartTooltipContent",
    "innerRadius=",
    'dataKey="quantity"',
    "isAnimationActive={false}",
    "<ol",
    "product.sku",
    "product.quantity",
    "toFixed(1)",
    "total > 0",
    "ไม่มีสินค้าสั่งผลิต",
    "var(--chart-",
    "products.slice(0, 5)",
  ])
    assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /<Progress|<svg|fetch\(|\bany\b/);
  assert.match(
    source,
    /reduce\(\(sum, product\) => sum \+ product.quantity, 0\)/,
  );
});

test("dashboard analytics cards stretch together while the bar chart fills remaining desktop height", () => {
  const dashboard = read("src/features/dashboard/dashboard.tsx");
  const chart = read("src/features/dashboard/factory-daily-overview-chart.tsx");
  const donut = read("src/features/dashboard/top-ordered-products.tsx");
  const patterns = read("src/components/factory/patterns.tsx");
  assert.match(dashboard, /grid items-stretch gap-4 xl:grid-cols/);
  assert.equal(
    (dashboard.match(/min-w-0 xl:flex xl:flex-col/g) ?? []).length,
    2,
  );
  for (const source of [chart, donut])
    assert.match(source, /className="xl:flex-1"/);
  assert.match(donut, /relative mx-auto mb-4 w-full max-w-\[240px\]/);
  assert.doesNotMatch(donut, /relative mx-auto mb-4 size-full/);
  assert.match(chart, /contentClassName="xl:flex xl:flex-1 xl:flex-col"/);
  assert.match(chart, /relative min-h-64 overflow-x-auto/);
  assert.match(
    chart,
    /h-64 w-full aspect-auto xl:absolute xl:inset-0 xl:h-full/,
  );
  assert.match(patterns, /cn\("px-5", contentClassName\)/);
});

test("Dashboard composes shared shadcn charts, accessible values, branding and latest orders without backend", () => {
  const dashboard = read("src/features/dashboard/dashboard.tsx");
  const chart = read("src/features/dashboard/factory-daily-overview-chart.tsx");
  const filter = read("src/features/dashboard/period-filter.tsx");
  for (const option of ["วันนี้", "7 วัน", "เดือนนี้", "ปีนี้", "กำหนดเอง"])
    assert.ok(filter.includes(option));
  assert.ok(chart.includes("@/src/components/ui/chart"));
  for (const feature of [
    "accessibilityLayer",
    "ChartTooltipContent",
    "ChartLegendContent",
    "onMouseMove",
    "onClick",
    "SelectTrigger",
    "<Table",
    "var(--primary)",
    "var(--success)",
    "var(--info)",
  ])
    assert.ok(chart.includes(feature), feature);
  assert.ok(dashboard.includes("branding.factoryName"));
  assert.ok(dashboard.includes("คำสั่งการผลิตล่าสุด"));
  assert.ok(dashboard.includes("TopOrderedProducts"));
  assert.ok(dashboard.includes("ProductionStatusOverview"));
  assert.ok(dashboard.includes('href="/production-orders"'));
  for (const source of [
    dashboard,
    chart,
    filter,
    read("src/lib/mock-data/dashboard.ts"),
  ])
    assert.doesNotMatch(source, /fetch\(|axios|\/api\/|prisma|\bany\b/);
});
