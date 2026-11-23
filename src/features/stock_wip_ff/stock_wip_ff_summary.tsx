import {
  ArrowLeftRight,
  Boxes,
  PackageMinus,
  PackagePlus,
  Warehouse,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";

import {
  isValidStockWipQuantity,
  type StockWipRow,
  type StockWipSummaryField,
  type StockWipUnit,
} from "./stock_wip_ff_domain";

/**
 * Stock WIP FF: UI MOCK ONLY.
 * All totals below are sums of already-recorded Excel summary columns.
 * They never recalculate closing balances or combine different units.
 */

const ISSUE_FIELDS = [
  "used_for_production",
  "used_for_packaging",
  "other_issues",
] as const satisfies readonly StockWipSummaryField[];

const TRANSFER_FIELDS = [
  "transfer_kan_1",
  "transfer_kan_3",
  "transfer_ico",
  "transfer_bio",
] as const satisfies readonly StockWipSummaryField[];

const UNIT_LABELS: Record<StockWipUnit, string> = {
  L: "ลิตร (L)",
  "Pcs.": "ชิ้น (Pcs.)",
};

export interface StockWipSummaryAmount {
  /** null means all source cells were empty, or an invalid cell was found. */
  value: number | null;
  invalidCount: number;
}

export interface StockWipUnitSummary {
  unit: StockWipUnit;
  itemCount: number;
  opening: StockWipSummaryAmount;
  received: StockWipSummaryAmount;
  issued: StockWipSummaryAmount;
  transferred: StockWipSummaryAmount;
  closing: StockWipSummaryAmount;
}

type MetricKey = Exclude<keyof StockWipUnitSummary, "unit" | "itemCount">;

const METRICS = [
  {
    key: "opening",
    title: "ยอดยกมา",
    description: "ผลรวมช่องยอดยกมา",
    Icon: Warehouse,
  },
  {
    key: "received",
    title: "รับเข้า (+)",
    description: "ผลรวมช่องรับเข้า",
    Icon: PackagePlus,
  },
  {
    key: "issued",
    title: "จ่ายออก",
    description: "ใช้ผลิต + บรรจุสินค้า + อื่น ๆ",
    Icon: PackageMinus,
  },
  {
    key: "transferred",
    title: "โอนระหว่างโรงงาน",
    description: "กาญ 1 + กาญ 3 + ICO + BIO (เมื่อมีช่อง)",
    Icon: ArrowLeftRight,
  },
  {
    key: "closing",
    title: "ยอดคงเหลือ",
    description: "ผลรวมช่องคงเหลือจาก Excel",
    Icon: Boxes,
  },
] as const satisfies readonly {
  key: MetricKey;
  title: string;
  description: string;
  Icon: typeof Boxes;
}[];

const QUANTITY_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 6,
});

function sumSummaryColumns(
  rows: readonly StockWipRow[],
  fields: readonly StockWipSummaryField[],
): StockWipSummaryAmount {
  let total = 0;
  let hasValue = false;
  let invalidCount = 0;

  for (const row of rows) {
    for (const field of fields) {
      const raw = row.summary[field];

      // Keep blanks and absent BIO columns distinct from entered zero.
      if (raw === null || raw.trim() === "") {
        continue;
      }

      const numericValue = Number(raw);
      if (!isValidStockWipQuantity(raw) || !Number.isFinite(numericValue)) {
        invalidCount += 1;
        continue;
      }

      total += numericValue;
      hasValue = true;
    }
  }

  if (!Number.isFinite(total)) {
    invalidCount += 1;
  }

  // Never publish a partial total when one or more cells are invalid.
  return {
    value: invalidCount > 0 || !hasValue ? null : total,
    invalidCount,
  };
}

/**
 * Summarize only the rows currently displayed in the selected sheet.
 * Each unit gets an independent set of totals.
 */
export function summarizeStockWipRows(
  rows: readonly StockWipRow[],
): StockWipUnitSummary[] {
  const units: readonly StockWipUnit[] = ["L", "Pcs."];

  return units.flatMap((unit) => {
    const unitRows = rows.filter((row) => row.item.unit === unit);

    if (unitRows.length === 0) {
      return [];
    }

    return [
      {
        unit,
        itemCount: unitRows.length,
        opening: sumSummaryColumns(unitRows, ["opening_balance"]),
        received: sumSummaryColumns(unitRows, ["received"]),
        issued: sumSummaryColumns(unitRows, ISSUE_FIELDS),
        transferred: sumSummaryColumns(unitRows, TRANSFER_FIELDS),
        closing: sumSummaryColumns(unitRows, ["closing_balance"]),
      },
    ];
  });
}

export interface StockWipSummaryProps {
  /** Pass the filtered rows from the active year/month, not all sheets. */
  rows: readonly StockWipRow[];
}

export function StockWipSummary({ rows }: StockWipSummaryProps) {
  const groups = summarizeStockWipRows(rows);

  return (
    <section aria-label="สรุป Stock WIP" className="min-w-0 space-y-4">
      {/* <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          สรุปปริมาณ Stock WIP
        </h2>
        <p className="text-sm text-muted-foreground">
          สรุปจากรายการที่แสดงตามช่วงเวลาและตัวกรองที่เลือก
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center">
          <p className="font-medium text-foreground">ไม่พบรายการสินค้า</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ลองเปลี่ยนหมวดสินค้าหรือคำค้นหา
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section
              key={group.unit}
              aria-label={`สรุปสินค้า หน่วย${UNIT_LABELS[group.unit]}`}
              className="min-w-0 space-y-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  หน่วยนับ: {UNIT_LABELS[group.unit]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {group.itemCount.toLocaleString("th-TH")} รายการสินค้า
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {METRICS.map(({ key, title, description, Icon }) => {
                  const amount = group[key];
                  const hasInvalid = amount.invalidCount > 0;
                  const displayValue = hasInvalid
                    ? "ตรวจสอบ"
                    : amount.value === null
                      ? "—"
                      : QUANTITY_FORMATTER.format(amount.value);

                  return (
                    <Card
                      key={key}
                      className="min-w-0 gap-2 rounded-lg py-4 shadow-none"
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                        <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">
                          {title}
                        </CardTitle>
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </CardHeader>
                      <CardContent className="space-y-2 px-4">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span
                            className={`min-w-0 wrap-break-word text-2xl font-semibold tracking-tight tabular-nums ${
                              hasInvalid ? "text-danger" : "text-foreground"
                            }`}
                          >
                            {displayValue}
                          </span>
                          {!hasInvalid && amount.value !== null && (
                            <span className="text-xs text-muted-foreground">
                              {group.unit}
                            </span>
                          )}
                        </div>
                        {hasInvalid ? (
                          <p role="alert" className="text-xs leading-relaxed text-danger">
                            มีข้อมูลตัวเลขไม่ถูกต้อง {amount.invalidCount} ช่อง
                          </p>
                        ) : amount.value === null ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            ยังไม่มีข้อมูลในช่องนี้
                          </p>
                        ) : (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )} */}

      <p className="text-xs leading-relaxed text-muted-foreground">
        ยอดแสดงเป็นผลรวมของคอลัมน์ในข้อมูล Mock ตามหน่วยนับ
        ไม่รวมต่างหน่วย ไม่ปรับยอดคงเหลือจากสูตรใหม่ และช่องว่างไม่ถือเป็นศูนย์
        ส่วนยอดโอนคือผลรวมของช่องโอนตาม Excel ไม่ใช่ยอดสุทธิรับเข้า-จ่ายออก
      </p>
    </section>
  );
}