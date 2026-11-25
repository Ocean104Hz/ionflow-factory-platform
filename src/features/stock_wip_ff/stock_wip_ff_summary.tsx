import type { FC } from "react";

import type { StockWipRow } from "./stock_wip_ff_domain";

/**
 * Stock WIP FF: UI MOCK ONLY.
 * The summary cards are intentionally not displayed.
 * No totals or stock balances are calculated by this component.
 */
export interface StockWipSummaryProps {
  rows: readonly StockWipRow[];
}

export const StockWipSummary: FC<StockWipSummaryProps> = () => (
  <section
    aria-label="สรุป Stock WIP"
    className="min-w-0 space-y-4"
  >
    <p className="text-xs leading-relaxed text-muted-foreground">
      ข้อมูลที่แสดงอ้างอิงจาก Excel จำลอง ไม่ปรับยอดคงเหลือจากสูตรใหม่
      และช่องว่างไม่ถือเป็นศูนย์ ส่วนข้อมูลการโอนเป็นค่าตาม Excel
      ไม่ใช่ยอดสุทธิรับเข้า-จ่ายออก
    </p>
  </section>
);