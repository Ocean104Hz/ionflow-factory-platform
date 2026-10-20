import { quantityNumber, quantityUnits } from "./inventory-quantity";

export const inventoryTypes = {
  RAW: "วัตถุดิบ",
  PACKAGING: "บรรจุภัณฑ์",
  WIP: "ระหว่างผลิต",
  FG: "สินค้าสำเร็จรูป",
  MRO: "อะไหล่และอุปกรณ์",
  OTHER: "อื่น ๆ",
} as const;
export type InventoryType = keyof typeof inventoryTypes;
export type InventoryClassification = InventoryType | "UNMAPPED";
export const inventoryStatuses = {
  AVAILABLE: "ผ่าน QC (สาธิต)",
  QC_HOLD: "รอตรวจ / กัก QC",
  BLOCKED: "ระงับใช้งาน",
} as const;
export type InventoryStatus = keyof typeof inventoryStatuses;
export type InventoryItem = {
  id: string;
  code: string;
  name: string;
  itemType: InventoryType | null;
  legacyClassification?: string;
  itemGroup: string;
  category: string;
  specification?: string;
  baseUnit: string;
  brand?: string;
  reorderPoint?: number;
  active: boolean;
};
export type InventoryBalanceSnapshot = {
  id: string;
  itemId: string;
  siteId: string;
  warehouseId: string;
  locationLabel: string;
  lotCode: string;
  inventoryStatus: InventoryStatus;
  onHandQty: number;
  unit: string;
  updatedAt: string;
};
export type InventorySite = { id: string; code: string; name: string };
export type InventoryWarehouse = InventorySite & { siteId: string };
export type InventoryScope = { siteId: string; warehouseId: string };
export type InventoryFilters = InventoryScope & {
  itemType: "ALL" | InventoryClassification;
  search: string;
  inventoryStatus: "ALL" | InventoryStatus;
  itemGroup: string;
  category: string;
  unit: string;
  brand: string;
  lowStock: "ALL" | "LOW" | "NOT_LOW";
  zeroBalance: "ALL" | "ZERO" | "NONZERO";
};
export const defaultInventoryFilters: InventoryFilters = {
  itemType: "ALL",
  search: "",
  siteId: "ALL",
  warehouseId: "ALL",
  inventoryStatus: "ALL",
  itemGroup: "ALL",
  category: "ALL",
  unit: "ALL",
  brand: "ALL",
  lowStock: "ALL",
  zeroBalance: "ALL",
};
export type InventoryRow = {
  item: InventoryItem;
  balances: InventoryBalanceSnapshot[];
  totalQty: number;
  availableQty: number;
  qcHeldQty: number;
  blockedQty: number;
  warehouseCount: number;
  lotCount: number;
  lowStock: boolean;
  scopeOnHandQty: number;
};
const norm = (text: string) => text.trim().toLocaleLowerCase("th-TH");
export function classifyInventory(
  value: string | null | undefined,
): InventoryClassification {
  const key = value?.trim().toUpperCase() ?? "";
  return Object.hasOwn(inventoryTypes, key)
    ? (key as InventoryType)
    : "UNMAPPED";
}
export function inventoryTypeLabel(value: string | null) {
  const type = classifyInventory(value);
  return type === "UNMAPPED" ? "ยังไม่จัดประเภท" : inventoryTypes[type];
}
export function isLowStock(item: InventoryItem, quantity: number) {
  return (
    item.reorderPoint !== undefined &&
    Number.isFinite(item.reorderPoint) &&
    item.reorderPoint >= 0 &&
    quantity < item.reorderPoint
  );
}
function balanceError(
  item: InventoryItem | undefined,
  row: InventoryBalanceSnapshot,
): string {
  if (!item) return "ไม่พบสินค้าอ้างอิง";
  if (!Number.isFinite(row.onHandQty) || row.onHandQty < 0)
    return "ยอดคงเหลือต้องเป็นจำนวนจำกัดและไม่ติดลบ";
  if (row.unit !== item.baseUnit)
    return "หน่วยไม่ตรงกับหน่วยหลัก ไม่มีการแปลงหน่วย";
  if (!Object.hasOwn(inventoryStatuses, row.inventoryStatus))
    return "สถานะคงคลังไม่ถูกต้อง";
  if (!Number.isFinite(Date.parse(row.updatedAt)))
    return "วันที่อัปเดตไม่ถูกต้อง";
  return "";
}
export function validateInventoryBalances(
  items: readonly InventoryItem[],
  balances: readonly InventoryBalanceSnapshot[],
  warehouses: readonly InventoryWarehouse[],
) {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const warehouseMap = new Map(warehouses.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const valid: InventoryBalanceSnapshot[] = [];
  const issues: { id: string; message: string }[] = [];
  for (const row of balances) {
    const warehouse = warehouseMap.get(row.warehouseId);
    const message =
      balanceError(itemMap.get(row.itemId), row) ||
      (seen.has(row.id) ? "รหัส snapshot ซ้ำ" : "") ||
      (!warehouse
        ? "ไม่พบคลังอ้างอิง"
        : warehouse.siteId !== row.siteId
          ? "คลังและโรงงานไม่สัมพันธ์กัน"
          : "");
    if (message) issues.push({ id: row.id, message });
    else {
      valid.push(row);
      seen.add(row.id);
    }
  }
  return { valid, issues };
}
function summarizeItem(
  item: InventoryItem,
  balances: InventoryBalanceSnapshot[],
): InventoryRow {
  const sum = (status?: InventoryStatus) =>
    quantityNumber(
      balances.reduce(
        (total, row) =>
          total +
          (!status || row.inventoryStatus === status
            ? quantityUnits(row.onHandQty)
            : BigInt(0)),
        BigInt(0),
      ),
    );
  const totalQty = sum();
  if (!Number.isFinite(totalQty))
    throw new Error("ยอดรวมเกินช่วงตัวเลขที่รองรับ");
  return {
    item,
    balances,
    totalQty,
    availableQty: sum("AVAILABLE"),
    qcHeldQty: sum("QC_HOLD"),
    blockedQty: sum("BLOCKED"),
    warehouseCount: new Set(balances.map((row) => row.warehouseId)).size,
    lotCount: new Set(balances.map((row) => row.lotCode).filter(Boolean)).size,
    lowStock: isLowStock(item, totalQty),
    scopeOnHandQty: totalQty,
  };
}
export function aggregateInventory(
  items: readonly InventoryItem[],
  balances: readonly InventoryBalanceSnapshot[],
  scope: InventoryScope = defaultInventoryFilters,
): InventoryRow[] {
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const grouped = new Map<string, InventoryBalanceSnapshot[]>();
  for (const row of balances) {
    const error = balanceError(itemMap.get(row.itemId), row);
    if (error || seen.has(row.id))
      throw new Error(error || "รหัส snapshot ซ้ำ");
    seen.add(row.id);
    if (
      (scope.siteId === "ALL" || row.siteId === scope.siteId) &&
      (scope.warehouseId === "ALL" || row.warehouseId === scope.warehouseId)
    ) {
      const group = grouped.get(row.itemId) ?? [];
      group.push(row);
      grouped.set(row.itemId, group);
    }
  }
  return items
    .filter(
      (item) =>
        (scope.siteId === "ALL" && scope.warehouseId === "ALL") ||
        grouped.has(item.id),
    )
    .map((item) => summarizeItem(item, grouped.get(item.id) ?? []));
}
export function filterInventory(
  rows: readonly InventoryRow[],
  filters: InventoryFilters,
): InventoryRow[] {
  const query = norm(filters.search);
  return rows.flatMap((row) => {
    const { item } = row;
    if (
      filters.itemType !== "ALL" &&
      classifyInventory(item.itemType) !== filters.itemType
    )
      return [];
    for (const [field, value] of [
      ["itemGroup", filters.itemGroup],
      ["category", filters.category],
      ["baseUnit", filters.unit],
      ["brand", filters.brand],
    ] as const) {
      if (value !== "ALL" && item[field] !== value) return [];
    }
    if (
      (filters.lowStock === "LOW" && !row.lowStock) ||
      (filters.lowStock === "NOT_LOW" && row.lowStock)
    )
      return [];
    let balances = row.balances.filter(
      (balance) =>
        filters.inventoryStatus === "ALL" ||
        balance.inventoryStatus === filters.inventoryStatus,
    );
    if (filters.inventoryStatus !== "ALL" && balances.length === 0) return [];
    const metadataMatches = norm(
      [item.code, item.name, item.specification, item.itemGroup, item.category]
        .filter(Boolean)
        .join(" "),
    ).includes(query);
    if (query && !metadataMatches) {
      balances = balances.filter((balance) =>
        norm(balance.lotCode).includes(query),
      );
      if (balances.length === 0) return [];
    }
    const result = summarizeItem(item, balances);
    if (
      (filters.zeroBalance === "ZERO" && result.totalQty !== 0) ||
      (filters.zeroBalance === "NONZERO" && result.totalQty === 0)
    )
      return [];
    // Low-stock uses all statuses/Lots in the selected site/warehouse, not a partial search result.
    return [
      { ...result, lowStock: row.lowStock, scopeOnHandQty: row.scopeOnHandQty },
    ];
  });
}
export function summarizeInventory(rows: readonly InventoryRow[]) {
  return {
    itemCount: rows.length,
    lowStockCount: rows.filter((row) => row.lowStock).length,
    qcHeldCount: rows.filter((row) => row.qcHeldQty > 0).length,
  };
}
export function inventoryTypeCounts(rows: readonly InventoryRow[]) {
  return Object.fromEntries(
    ["ALL", ...Object.keys(inventoryTypes), "UNMAPPED"].map((type) => [
      type,
      type === "ALL"
        ? rows.length
        : rows.filter((row) => classifyInventory(row.item.itemType) === type)
            .length,
    ]),
  );
}
export function paginateInventory<T>(
  rows: readonly T[],
  requestedPage: number,
  requestedSize: number,
) {
  const pageSize =
    Number.isInteger(requestedSize) && requestedSize > 0 ? requestedSize : 10;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(
    pages,
    Math.max(1, Number.isInteger(requestedPage) ? requestedPage : 1),
  );
  return {
    page,
    pageSize,
    total: rows.length,
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
  };
}
