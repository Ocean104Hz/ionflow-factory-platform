import {
  Boxes,
  Calculator,
  Factory,
  PackageMinus,
  PackagePlus,
  SlidersHorizontal,
  Trash2,
  Warehouse,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import {
  isValidStockRmNumber,
  type StockRmRow,
  type StockRmSummaryField,
} from "./stock_rm_ff_domain";

/**
 * Stock RM FF: UI MOCK ONLY.
 *
 * Each total reads its own saved Excel column from the currently visible rows.
 * It does not recalculate balances, sum average prices, or combine source
 * columns that merely look equivalent (such as the main and Sum sections).
 * Blank cells are not interpreted as entered zeroes.
 */

export interface StockRmSummaryAmount {
  /** null = no populated cells, or a populated cell was invalid. */
  value: number | null;
  invalidCount: number;
}

export interface StockRmSummaryPair {
  weight: StockRmSummaryAmount;
  value: StockRmSummaryAmount;
}

type MainGroup = "opening" | "received" | "combined" | "issued" | "closing";

export interface StockRmSummaryTotals {
  itemCount: number;
  main: Record<MainGroup, StockRmSummaryPair>;
  sumReceived: StockRmSummaryPair;
  sumIssuedProduction: StockRmSummaryAmount;
  sumIssuedAdjustment: StockRmSummaryAmount;
  sumIssuedDiscarded: StockRmSummaryAmount;
  sumIssuedTotal: StockRmSummaryAmount;
}

const MAIN_CARDS = [
  { key: "opening", title: "ยอดยกมา", Icon: Warehouse },
  { key: "received", title: "รับเข้า", Icon: PackagePlus },
  { key: "combined", title: "รวม", Icon: Calculator },
  { key: "issued", title: "จ่ายออก", Icon: PackageMinus },
  { key: "closing", title: "คงเหลือ", Icon: Boxes },
] as const satisfies readonly {
  key: MainGroup;
  title: string;
  Icon: typeof Boxes;
}[];

const SUM_ISSUE_CARDS = [
  { key: "sumIssuedProduction", title: "จ่ายเพื่อผลิต", Icon: Factory },
  { key: "sumIssuedAdjustment", title: "จ่ายปรับค่า", Icon: SlidersHorizontal },
  { key: "sumIssuedDiscarded", title: "จ่ายทิ้ง", Icon: Trash2 },
  { key: "sumIssuedTotal", title: "จ่ายรวมตาม Sum", Icon: PackageMinus },
] as const satisfies readonly {
  key: "sumIssuedProduction" | "sumIssuedAdjustment" | "sumIssuedDiscarded" | "sumIssuedTotal";
  title: string;
  Icon: typeof Boxes;
}[];

const WEIGHT_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 4,
});

const VALUE_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 2,
});

/** Never show a partial total if any source cell is invalid. */
export function sumStockRmColumns(
  rows: readonly StockRmRow[],
  fields: readonly StockRmSummaryField[],
): StockRmSummaryAmount {
  let total = 0;
  let hasNumber = false;
  let invalidCount = 0;

  for (const row of rows) {
    for (const field of fields) {
      const raw = row.summary[field];

      if (typeof raw !== "string") {
        invalidCount += 1;
        continue;
      }

      const text = raw.trim();
      if (text === "") {
        continue;
      }

      const number = Number(text);
      if (!isValidStockRmNumber(text) || !Number.isFinite(number)) {
        invalidCount += 1;
        continue;
      }

      total += number;
      hasNumber = true;
    }
  }

  if (!Number.isFinite(total)) {
    invalidCount += 1;
  }

  return {
    value: invalidCount > 0 || !hasNumber ? null : total,
    invalidCount,
  };
}

function sumPair(
  rows: readonly StockRmRow[],
  weightField: StockRmSummaryField,
  valueField: StockRmSummaryField,
): StockRmSummaryPair {
  return {
    weight: sumStockRmColumns(rows, [weightField]),
    value: sumStockRmColumns(rows, [valueField]),
  };
}

/** Only rows after the active search filter should be passed in. */
export function summarizeStockRmRows(
  rows: readonly StockRmRow[],
): StockRmSummaryTotals {
  return {
    itemCount: rows.length,
    main: {
      opening: sumPair(rows, "opening_weight", "opening_value"),
      received: sumPair(rows, "received_weight", "received_value"),
      combined: sumPair(rows, "combined_weight", "combined_value"),
      issued: sumPair(rows, "issued_weight", "issued_value"),
      closing: sumPair(rows, "closing_weight", "closing_value"),
    },
    // The separate Sum columns are shown independently, not added to main.
    sumReceived: sumPair(rows, "total_received_weight", "total_received_value"),
    sumIssuedProduction: sumStockRmColumns(rows, ["total_issued_for_production"]),
    sumIssuedAdjustment: sumStockRmColumns(rows, ["total_issued_adjustment"]),
    sumIssuedDiscarded: sumStockRmColumns(rows, ["total_issued_discarded"]),
    sumIssuedTotal: sumStockRmColumns(rows, ["total_issued_weight"]),
  };
}

function formatAmount(
  amount: StockRmSummaryAmount,
  metric: "weight" | "value",
): string {
  if (amount.invalidCount > 0) {
    return "ตรวจสอบ";
  }
  if (amount.value === null) {
    return "—";
  }
  return metric === "weight"
    ? WEIGHT_FORMATTER.format(amount.value)
    : VALUE_FORMATTER.format(amount.value);
}

function AmountLine({
  label,
  amount,
  metric,
}: {
  label: string;
  amount: StockRmSummaryAmount;
  metric: "weight" | "value";
}) {
  const invalid = amount.invalidCount > 0;

  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span
        className={`min-w-0 break-all text-right text-lg font-semibold tabular-nums ${
          invalid ? "text-danger" : "text-foreground"
        }`}
        title={
          invalid
            ? `พบข้อมูลไม่ถูกต้อง ${amount.invalidCount} ช่อง`
            : undefined
        }
      >
        {formatAmount(amount, metric)}
      </span>
    </div>
  );
}

function ErrorNote({
  amounts,
}: {
  amounts: readonly StockRmSummaryAmount[];
}) {
  const invalidCount = amounts.reduce(
    (sum, amount) => sum + amount.invalidCount,
    0,
  );

  return invalidCount > 0 ? (
    <p role="alert" className="text-xs leading-relaxed text-danger">
      มีช่องตัวเลขไม่ถูกต้อง {invalidCount} ช่อง กรุณาตรวจสอบในตาราง
    </p>
  ) : null;
}

export interface StockRmSummaryProps {
  /** Filtered rows of one selected year or month, never all sheets together. */
  rows: readonly StockRmRow[];
}

export function StockRmSummary({ rows }: StockRmSummaryProps) {
  const totals = summarizeStockRmRows(rows);

  return (
    <section aria-label="สรุป Stock RM FF" className="min-w-0 space-y-4">
      {/* <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            สรุป Stock RM FF
          </h2>
          <p className="text-sm text-muted-foreground">
            ผลรวมจากคอลัมน์ที่บันทึกใน Excel ตามช่วงเวลาและรายการที่กรอง
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {totals.itemCount.toLocaleString("th-TH")} รายการวัตถุดิบ
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center">
          <p className="font-medium text-foreground">ไม่พบรายการวัตถุดิบ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ลองเปลี่ยนปี เดือน หรือรหัสที่ค้นหา
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {MAIN_CARDS.map(({ key, title, Icon }) => {
              const pair = totals.main[key];

              return (
                <Card key={key} className="min-w-0 gap-2 rounded-lg py-4 shadow-none">
                  <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {title}
                    </CardTitle>
                    <Icon
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </CardHeader>
                  <CardContent className="min-w-0 space-y-2 px-4">
                    <AmountLine label="น้ำหนัก" amount={pair.weight} metric="weight" />
                    <AmountLine label="มูลค่า" amount={pair.value} metric="value" />
                    <ErrorNote amounts={[pair.weight, pair.value]} />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <section aria-label="สรุปส่วน Sum จาก Excel" className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                รายละเอียดรับและจ่าย (ส่วน Sum ใน Excel)
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                แสดงแยกจากยอดหลัก ไม่บวกยอดซ้ำเข้ากับการ์ดด้านบน
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              <Card className="min-w-0 gap-2 rounded-lg py-4 shadow-none">
                <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    รับเข้าตาม Sum
                  </CardTitle>
                  <PackagePlus
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </CardHeader>
                <CardContent className="space-y-2 px-4">
                  <AmountLine
                    label="น้ำหนัก"
                    amount={totals.sumReceived.weight}
                    metric="weight"
                  />
                  <AmountLine
                    label="มูลค่า"
                    amount={totals.sumReceived.value}
                    metric="value"
                  />
                  <ErrorNote
                    amounts={[totals.sumReceived.weight, totals.sumReceived.value]}
                  />
                </CardContent>
              </Card>

              {SUM_ISSUE_CARDS.map(({ key, title, Icon }) => {
                const amount = totals[key];
                return (
                  <Card key={key} className="min-w-0 gap-2 rounded-lg py-4 shadow-none">
                    <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                      </CardTitle>
                      <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </CardHeader>
                    <CardContent className="min-w-0 space-y-2 px-4">
                      <AmountLine label="น้ำหนัก" amount={amount} metric="weight" />
                      <ErrorNote amounts={[amount]} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        ตัวเลขเหล่านี้เป็นผลรวมของช่องน้ำหนักและมูลค่าในข้อมูล Mock ที่เลือก
        โดยไม่คำนวณยอดคงเหลือใหม่ ไม่รวมราคาเฉลี่ยของวัตถุดิบต่างชนิด
        และไม่รวมยอดจากส่วน Sum ซ้ำเข้าในยอดหลัก ช่องว่างแสดงเป็น “—” ไม่ใช่ศูนย์
        ทั้งนี้ไฟล์ต้นฉบับไม่ได้ระบุหน่วยน้ำหนักรวมอย่างชัดเจน
      </p> */}
    </section>
  );
}
