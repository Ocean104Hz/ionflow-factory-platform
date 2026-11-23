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
  isValidStockMaterialNumber,
  type StockMaterialRow,
  type StockMaterialSummaryField,
} from "./stock_remaining_materials_ff_domain";

/**
 * Remaining Materials FF: UI MOCK ONLY.
 *
 * Read the stored Excel snapshot for the currently displayed month/rows.
 * No recalculation, subtotal lines, merged units or database writes.
 * Unit prices are intentionally excluded from any summation.
 */
export interface StockRemainingMaterialsFfAmount {
  /** Null means all cells are blank, or at least one source value is invalid. */
  value: number | null;
  invalidCount: number;
}

export interface StockRemainingMaterialsFfUnitSummary {
  unit: string | null;
  itemCount: number;
  opening: StockRemainingMaterialsFfAmount;
  purchased: StockRemainingMaterialsFfAmount;
  transferred: StockRemainingMaterialsFfAmount;
  issued: StockRemainingMaterialsFfAmount;
  closing: StockRemainingMaterialsFfAmount;
  purchasedValue: StockRemainingMaterialsFfAmount;
  transferredValue: StockRemainingMaterialsFfAmount;
  issuedProduction: StockRemainingMaterialsFfAmount;
  issuedDamaged: StockRemainingMaterialsFfAmount;
  issuedBio: StockRemainingMaterialsFfAmount;
  issuedOther: StockRemainingMaterialsFfAmount;
}

type MainMetric =
  | "opening"
  | "purchased"
  | "transferred"
  | "issued"
  | "closing";

type IssueMetric =
  | "issuedProduction"
  | "issuedDamaged"
  | "issuedBio"
  | "issuedOther";

const MAIN_CARDS: readonly {
  key: MainMetric;
  title: string;
  description: string;
  Icon: typeof Boxes;
}[] = [
  {
    key: "opening",
    title: "ยอดยกมา",
    description: "จำนวนยกมาจาก Excel",
    Icon: Warehouse,
  },
  {
    key: "purchased",
    title: "รับซื้อ (+)",
    description: "จำนวนที่รับซื้อ",
    Icon: PackagePlus,
  },
  {
    key: "transferred",
    title: "รับโอน (+)",
    description: "จำนวนที่รับโอน",
    Icon: ArrowLeftRight,
  },
  {
    key: "issued",
    title: "จ่ายออก (-)",
    description: "จำนวนรวมจ่ายจาก Excel (คอลัมน์ T)",
    Icon: PackageMinus,
  },
  {
    key: "closing",
    title: "คงเหลือ",
    description: "จำนวนคงเหลือจาก Excel",
    Icon: Boxes,
  },
];

const ISSUE_DETAILS: readonly { key: IssueMetric; title: string }[] = [
  { key: "issuedProduction", title: "จ่ายผลิต" },
  { key: "issuedDamaged", title: "จ่ายชำรุด" },
  { key: "issuedBio", title: "โอน BIO" },
  { key: "issuedOther", title: "จ่ายอื่น ๆ" },
];

const QUANTITY_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 6,
});

const VALUE_FORMATTER = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 2,
});

const UNIT_COMPARATOR = new Intl.Collator("th-TH", {
  numeric: true,
  sensitivity: "variant",
});

/** Refuse partial totals instead of silently ignoring invalid cells. */
export function sumStockRemainingMaterialsFfColumn(
  rows: readonly StockMaterialRow[],
  field: StockMaterialSummaryField,
): StockRemainingMaterialsFfAmount {
  let total = 0;
  let hasValue = false;
  let invalidCount = 0;

  for (const row of rows) {
    const raw: unknown = row.summary[field];

    if (typeof raw !== "string") {
      invalidCount += 1;
      continue;
    }

    const value = raw.trim();
    if (value === "") {
      continue;
    }

    const numericValue = Number(value);
    if (!isValidStockMaterialNumber(value) || !Number.isFinite(numericValue)) {
      invalidCount += 1;
      continue;
    }

    total += numericValue;
    hasValue = true;
  }

  if (!Number.isFinite(total)) {
    invalidCount += 1;
  }

  return {
    value: invalidCount > 0 || !hasValue ? null : total,
    invalidCount,
  };
}

/**
 * Group by the Excel unit exactly, without silently merging e.g. กก. / ก.ก.
 * Missing unit cells are grouped as null, never counted with known units.
 */
export function summarizeStockRemainingMaterialsFfRows(
  rows: readonly StockMaterialRow[],
): StockRemainingMaterialsFfUnitSummary[] {
  const grouped = new Map<string | null, StockMaterialRow[]>();

  for (const row of rows) {
    const unit = row.item.unit?.trim() ? row.item.unit : null;
    const group = grouped.get(unit) ?? [];
    group.push(row);
    grouped.set(unit, group);
  }

  return Array.from(grouped, ([unit, unitRows]) => ({
    unit,
    itemCount: unitRows.length,
    opening: sumStockRemainingMaterialsFfColumn(unitRows, "opening_quantity"),
    purchased: sumStockRemainingMaterialsFfColumn(unitRows, "purchased_quantity"),
    transferred: sumStockRemainingMaterialsFfColumn(
      unitRows,
      "transfer_received_quantity",
    ),
    issued: sumStockRemainingMaterialsFfColumn(unitRows, "total_issued_quantity"),
    closing: sumStockRemainingMaterialsFfColumn(unitRows, "closing_quantity"),
    purchasedValue: sumStockRemainingMaterialsFfColumn(unitRows, "purchased_value"),
    transferredValue: sumStockRemainingMaterialsFfColumn(
      unitRows,
      "transfer_received_value",
    ),
    issuedProduction: sumStockRemainingMaterialsFfColumn(
      unitRows,
      "issued_for_production",
    ),
    issuedDamaged: sumStockRemainingMaterialsFfColumn(unitRows, "issued_damaged"),
    issuedBio: sumStockRemainingMaterialsFfColumn(unitRows, "issued_to_bio"),
    issuedOther: sumStockRemainingMaterialsFfColumn(unitRows, "issued_other"),
  })).sort((left, right) => {
    if (left.unit === null) return 1;
    if (right.unit === null) return -1;
    return UNIT_COMPARATOR.compare(left.unit, right.unit);
  });
}

function formatAmount(
  amount: StockRemainingMaterialsFfAmount,
  format: "quantity" | "value" = "quantity",
): string {
  if (amount.invalidCount > 0) return "ตรวจสอบ";
  if (amount.value === null) return "–";
  return format === "value"
    ? VALUE_FORMATTER.format(amount.value)
    : QUANTITY_FORMATTER.format(amount.value);
}

function AmountNote({
  amount,
  emptyDescription,
}: {
  amount: StockRemainingMaterialsFfAmount;
  emptyDescription?: string;
}) {
  if (amount.invalidCount > 0) {
    return (
      <p role="alert" className="text-xs leading-relaxed text-danger">
        พบข้อมูลตัวเลขไม่ถูกต้อง {amount.invalidCount} ช่อง
      </p>
    );
  }

  if (amount.value === null && emptyDescription) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        {emptyDescription}
      </p>
    );
  }

  return null;
}

export interface StockRemainingMaterialsFfSummaryProps {
  /** Only the filtered item rows of one selected Excel monthly sheet. */
  rows: readonly StockMaterialRow[];
}

export function StockRemainingMaterialsFfSummary({
  rows,
}: StockRemainingMaterialsFfSummaryProps) {
  const groups = summarizeStockRemainingMaterialsFfRows(rows);

  return (
    <section
      aria-label="สรุปวัสดุคงเหลือ FF"
      className="min-w-0 space-y-4"
    >
      {/* <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            สรุปวัสดุคงเหลือ FF
          </h2>
          <p className="text-sm text-muted-foreground">
            ผลรวมจากรายการในเดือนและตัวกรองที่เลือก แยกตามหน่วยนับใน Excel
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {rows.length.toLocaleString("th-TH")} รายการวัสดุ
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-4 py-8 text-center">
          <p className="font-medium text-foreground">ไม่พบรายการวัสดุ</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ลองเลือกเดือนอื่นหรือเปลี่ยนคำค้นหา
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const unitLabel = group.unit ?? "ไม่ระบุหน่วยใน Excel";

            return (
              <section
                key={group.unit ?? "__blank_unit__"}
                aria-label={`สรุปวัสดุหน่วย ${unitLabel}`}
                className="min-w-0 space-y-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    หน่วยนับ: {unitLabel}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {group.itemCount.toLocaleString("th-TH")} รายการ
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                  {MAIN_CARDS.map(({ key, title, description, Icon }) => {
                    const amount = group[key];
                    const valueAmount =
                      key === "purchased"
                        ? group.purchasedValue
                        : key === "transferred"
                          ? group.transferredValue
                          : null;

                    return (
                      <Card key={key} className="min-w-0 gap-2 rounded-lg py-4 shadow-none">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 px-4">
                          <CardTitle className="text-sm font-medium leading-snug text-muted-foreground">
                            {title}
                          </CardTitle>
                          <Icon
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </CardHeader>
                        <CardContent className="min-w-0 space-y-2 px-4">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span
                              className={`min-w-0 break-all text-2xl font-semibold tracking-tight tabular-nums ${
                                amount.invalidCount > 0 ? "text-danger" : "text-foreground"
                              }`}
                            >
                              {formatAmount(amount)}
                            </span>
                            {amount.invalidCount === 0 && amount.value !== null && group.unit && (
                              <span className="text-xs text-muted-foreground">
                                {group.unit}
                              </span>
                            )}
                          </div>
                          <AmountNote amount={amount} emptyDescription="ไม่มีข้อมูลในช่องนี้" />
                          {amount.value !== null && amount.invalidCount === 0 && (
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {description}
                            </p>
                          )}
                          {valueAmount && (
                            <div className="space-y-1 border-t pt-2 text-xs">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-muted-foreground">รวมราคา</span>
                                <span
                                  className={`font-medium tabular-nums ${
                                    valueAmount.invalidCount > 0
                                      ? "text-danger"
                                      : "text-foreground"
                                  }`}
                                >
                                  {formatAmount(valueAmount, "value")}
                                </span>
                              </div>
                              <AmountNote amount={valueAmount} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="space-y-2 rounded-lg border bg-card px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">
                    รายละเอียดจ่ายออกตาม Excel (ไม่บวกรวมซ้ำ)
                  </p>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {ISSUE_DETAILS.map(({ key, title }) => {
                      const amount = group[key];
                      return (
                        <div key={key} className="min-w-0 space-y-1">
                          <dt className="text-xs text-muted-foreground">{title}</dt>
                          <dd
                            className={`text-sm font-semibold tabular-nums ${
                              amount.invalidCount > 0 ? "text-danger" : "text-foreground"
                            }`}
                          >
                            {formatAmount(amount)}
                            {amount.invalidCount === 0 && amount.value !== null && group.unit && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                {group.unit}
                              </span>
                            )}
                          </dd>
                          <AmountNote amount={amount} />
                        </div>
                      );
                    })}
                  </dl>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        เป็นผลรวมช่องของรายการวัสดุที่เลือก ไม่รวมแถว ST/GT ของ Excel
        และไม่รวมปริมาณคนละหน่วยเข้าด้วยกัน ตัวเลขรวมจ่ายและคงเหลืออ่านตามต้นฉบับ
        ไม่คำนวณขึ้นใหม่ ไม่รวมราคาต่อชิ้นจากรายการต่างชนิด
        ช่องว่างไม่ถูกแทนด้วยเลขศูนย์
      </p> */}
    </section>
  );
}
