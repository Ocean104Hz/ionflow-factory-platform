"use client";

import { useId } from "react";
import { RotateCcw } from "lucide-react";

import { SelectField } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

import {
  STOCK_MATERIAL_FF_MONTHS_2569,
  type StockMaterialFilters as StockMaterialFilterValues,
  type StockMaterialMonth2569,
  type StockMaterialPeriod,
} from "./stock_remaining_materials_ff_domain";

type Props = {
  value: StockMaterialFilterValues;
  onChange: (next: StockMaterialFilterValues) => void;
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

const YEAR_OPTIONS = [
  { value: "2568", label: "2568 (ยอดยกมา)" },
  { value: "2569", label: "2569" },
];

const MONTH_OPTIONS_2568 = [{ value: "12", label: "ธันวาคม (ยอดยกมา)" }];

const MONTH_OPTIONS_2569 = STOCK_MATERIAL_FF_MONTHS_2569.map((month) => ({
  value: String(month),
  label: MONTH_LABELS[month - 1],
}));

/**
 * Controlled filters for the Stock Material FF Excel-based UI mock.
 * The workspace owns the filter state and any unsaved-edit confirmation.
 * The workbook has only December 2568 and January-October 2569;
 * no annual or November/December 2569 sheets are invented.
 */
export function StockMaterialFilters({ value, onChange, onReset }: Props) {
  const searchId = useId();
  const { period } = value;

  function changePeriod(nextPeriod: StockMaterialPeriod) {
    onChange({ ...value, period: nextPeriod });
  }

  function changeYear(nextYear: string) {
    if (nextYear === String(period.year_be)) {
      return;
    }

    if (nextYear === "2568") {
      changePeriod({ view: "MONTH", year_be: 2568, month: 12 });
      return;
    }

    if (nextYear === "2569") {
      changePeriod({ view: "MONTH", year_be: 2569, month: 1 });
    }
  }

  function changeMonth(nextMonth: string) {
    if (period.year_be !== 2569) {
      return;
    }

    const month: StockMaterialMonth2569 | undefined =
      STOCK_MATERIAL_FF_MONTHS_2569.find(
        (candidate) => String(candidate) === nextMonth,
      );

    if (month !== undefined && month !== period.month) {
      changePeriod({ view: "MONTH", year_be: 2569, month });
    }
  }

  return (
    <section
      aria-label="ตัวกรองวัสดุคงเหลือ FF"
      className="factory-filter min-w-0 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            ตัวกรองวัสดุคงเหลือ FF
          </h2>
          <p className="text-xs text-muted-foreground">
            เลือกเดือนและค้นหารายการวัสดุจากข้อมูล Excel จำลอง
          </p>
        </div>

        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          ล้างตัวกรอง
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SelectField
          label="ปี (พ.ศ.)"
          value={String(period.year_be)}
          onChange={changeYear}
          options={YEAR_OPTIONS}
        />

        <SelectField
          label="เดือน"
          value={String(period.month)}
          onChange={changeMonth}
          options={
            period.year_be === 2568 ? MONTH_OPTIONS_2568 : MONTH_OPTIONS_2569
          }
          disabled={period.year_be === 2568}
        />

        <div className="grid min-w-0 content-start gap-2 sm:col-span-2 xl:col-span-1">
          <Label htmlFor={searchId}>ค้นหาวัสดุ</Label>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            value={value.search}
            onChange={(event) =>
              onChange({ ...value, search: event.currentTarget.value })
            }
            placeholder="รหัสสินค้า ชื่อบรรจุภัณฑ์ หรือประเภท"
          />
        </div>
      </div>

      <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
        ปี 2568 มีเฉพาะชีตยอดยกมาเดือนธันวาคม ส่วนปี 2569 มีข้อมูลตั้งแต่
        มกราคมถึงตุลาคมเท่านั้น ยังไม่มีข้อมูลเดือนพฤศจิกายนและธันวาคมในไฟล์
        Excel การค้นหารองรับรหัสสินค้า ชื่อบรรจุภัณฑ์ ประเภท และหน่วยนับ
      </p>
    </section>
  );
}
