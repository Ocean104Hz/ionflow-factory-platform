import { createStockMaterialMockSheets } from "@/src/lib/mock-data/stock_remaining_materials_ff";

import {
  stockMaterialRowRef,
} from "@/src/features/stock_remaining_materials_ff/stock_remaining_materials_ff_domain";

export type MaterialIssueStockItem = {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  remainingQuantity: string;
};

// ใช้ข้อมูลเดือนตุลาคม 2569
// ซึ่งเป็นเดือนล่าสุดในชุดข้อมูลสต็อก FF
const stockSheets = createStockMaterialMockSheets();

const latestStockSheet = stockSheets.find(
  (sheet) =>
    sheet.period.year_be === 2569 &&
    sheet.period.month === 10,
);

export const MOCK_MATERIAL_STOCK:
  MaterialIssueStockItem[] = (
    latestStockSheet?.rows ?? []
  )
    .filter(
      (row) =>
        Boolean(row.item.code?.trim()) &&
        Boolean(row.item.name.trim()),
    )
    .map((row) => ({
      id: `${latestStockSheet?.id}-${stockMaterialRowRef(row)}`,

      materialCode:
        row.item.code?.trim() ?? "",

      materialName:
        row.item.name.trim(),

      unit:
        row.item.unit?.trim() ?? "",

      remainingQuantity:
        row.summary.closing_quantity,
    }));