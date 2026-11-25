"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";

import { SelectField } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

import {
  STOCK_WIP_MONTHS,
  type StockWipFilters as StockWipFilterValues,
  type StockWipMonth,
  type StockWipPeriod,
} from "./stock_wip_ff_domain";

type Props = {
  value: StockWipFilterValues;
  onChange: (next: StockWipFilterValues) => void;
  onReset: () => void;
};

const MONTH_LABELS = [
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

const VIEW_OPTIONS = [
  { value: "MONTH", label: "รายเดือน" },
  { value: "YEAR", label: "รายปี" },
];

const MONTH_OPTIONS = STOCK_WIP_MONTHS.map((month) => ({
  value: String(month),
  label: MONTH_LABELS[month - 1],
}));

const YEAR_OPTIONS = [
  { value: "2568", label: "2568" },
  { value: "2569", label: "2569" },
];

/**
 * Controlled filters for the Excel-based Stock WIP UI mock.
 * The parent workspace owns filter state and applies it to the displayed rows.
 */
export function StockWipFilters({ value, onChange, onReset }: Props) {
  const searchId = useId();
  const { period } = value;

  function changePeriod(nextPeriod: StockWipPeriod) {
    onChange({ ...value, period: nextPeriod });
  }

  function changeView(nextView: string) {
    if (nextView === period.view) {
      return;
    }

    if (nextView === "YEAR") {
      changePeriod({ view: "YEAR", year_be: period.year_be });
      return;
    }

    if (nextView === "MONTH") {
      // The workbook only provides monthly worksheets for B.E. 2569.
      changePeriod({ view: "MONTH", year_be: 2569, month: 1 });
    }
  }

  function changeYear(nextYear: string) {
    if (period.view !== "YEAR") {
      return;
    }

    if (nextYear === "2568" || nextYear === "2569") {
      changePeriod({
        view: "YEAR",
        year_be: nextYear === "2568" ? 2568 : 2569,
      });
    }
  }

  function changeMonth(nextMonth: string) {
    if (period.view !== "MONTH") {
      return;
    }

    const month: StockWipMonth | undefined = STOCK_WIP_MONTHS.find(
      (candidate) => String(candidate) === nextMonth,
    );

    if (month !== undefined) {
      changePeriod({ view: "MONTH", year_be: 2569, month });
    }
  }

  return (
    <section
      aria-label="ตัวกรอง Stock WIP"
      className="factory-filter min-w-0 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            ตัวกรอง Stock WIP
          </h2>
          <p className="text-xs text-muted-foreground">
            เลือกช่วงเวลาและค้นหารายการจากข้อมูล Excel จำลอง
          </p>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          ล้างตัวกรอง
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid min-w-0 content-start gap-2">
          <Label htmlFor={searchId}>ค้นหาสินค้า</Label>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            value={value.search}
            onChange={(event) =>
              onChange({ ...value, search: event.currentTarget.value })
            }
            placeholder="Code New / Code Old / ชื่อสินค้า"
          />
        </div>
        <SelectField
          label="มุมมอง"
          value={period.view}
          onChange={changeView}
          options={VIEW_OPTIONS}
        />

        {period.view === "MONTH" ? (
          <SelectField
            label="เดือน"
            value={String(period.month)}
            onChange={changeMonth}
            options={MONTH_OPTIONS}
          />
        ) : (
          <SelectField
            label="เดือน"
            value="YEAR"
            onChange={() => undefined}
            options={[{ value: "YEAR", label: "ไม่ใช้กับรายปี" }]}
            disabled
          />
        )}

        <SelectField
          label="ปี (พ.ศ.)"
          value={String(period.year_be)}
          onChange={changeYear}
          options={
            period.view === "YEAR"
              ? YEAR_OPTIONS
              : [{ value: "2569", label: "2569" }]
          }
          disabled={period.view === "MONTH"}
        />
      </div>

      <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        ปี 2568 มีเฉพาะข้อมูลรายปี ส่วนข้อมูลรายเดือนมีเฉพาะปี 2569
        และการเปลี่ยนมุมมองจากรายปีเป็นรายเดือนจะเริ่มที่เดือนมกราคม
      </p>
    </section>
  );
}
