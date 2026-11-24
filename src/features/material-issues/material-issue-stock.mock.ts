export type MaterialIssueStockItem = {
  materialCode: string;
  materialName: string;
  unit: string;
  remainingQuantity: number;
};

// Mock สำหรับ stock_remaining_materials_ff
export const MOCK_MATERIAL_STOCK: MaterialIssueStockItem[] = [
  {
    materialCode: "RM-001",
    materialName: "เม็ดพลาสติก",
    unit: "กก.",
    remainingQuantity: 500,
  },
  {
    materialCode: "RM-002",
    materialName: "ถุงบรรจุ",
    unit: "ใบ",
    remainingQuantity: 1000,
  },
  {
    materialCode: "RM-003",
    materialName: "กล่องบรรจุภัณฑ์",
    unit: "กล่อง",
    remainingQuantity: 250,
  },
];