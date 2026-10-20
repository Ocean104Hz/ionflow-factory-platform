import {
  inventoryStatuses,
  type InventoryBalanceSnapshot,
  type InventoryItem,
  type InventorySite,
  type InventoryWarehouse,
} from "./inventory-domain";
import {
  quantityDecimal,
  quantityNumber,
  quantityUnits,
} from "./inventory-quantity";

export const ledgerEventTypes = {
  OPENING: "ยอดตั้งต้น",
  RECEIPT: "รับเข้า",
  ISSUE: "จ่ายออก",
  TRANSFER: "โอนย้าย",
  ADJUSTMENT: "ปรับยอด",
  STATUS_CHANGE: "เปลี่ยนสถานะ QC",
} as const;
export type LedgerEventType = keyof typeof ledgerEventTypes;
export type StockPosition = Readonly<
  Omit<InventoryBalanceSnapshot, "onHandQty" | "updatedAt">
>;
export type StockPosting = Readonly<
  Omit<StockPosition, "id"> & { id: string; quantityDelta: string }
>;
export type StockLedgerEvent = Readonly<{
  id: string;
  eventType: LedgerEventType;
  postedAt: string;
  order: number;
  documentNo: string;
  reason?: string;
  operation?: Readonly<{
    id: string;
    payload: string;
    actor: string;
    type: "RECEIVE" | "ISSUE" | "TRANSFER" | "ADJUST";
    note?: string;
    countedQuantity?: string;
    reviewedQuantity?: string;
  }>;
  postings: readonly StockPosting[];
}>;
export type LedgerContext = {
  items: readonly InventoryItem[];
  sites: readonly InventorySite[];
  warehouses: readonly InventoryWarehouse[];
  positions: readonly StockPosition[];
};
export type LedgerError = { eventId: string; message: string };
export type LedgerReplay =
  | {
      ok: true;
      balances: InventoryBalanceSnapshot[];
      events: StockLedgerEvent[];
      supportedFrom: string | null;
    }
  | { ok: false; kind: "INVALID" | "BEFORE_OPENING"; errors: LedgerError[] };
const zero = BigInt(0);
export function stockKey(
  position: Pick<
    StockPosition,
    | "itemId"
    | "siteId"
    | "warehouseId"
    | "locationLabel"
    | "lotCode"
    | "inventoryStatus"
  >,
) {
  return JSON.stringify([
    position.itemId,
    position.siteId,
    position.warehouseId,
    position.locationLabel,
    position.lotCode,
    position.inventoryStatus,
  ]);
}
export function validLedgerDate(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day
  );
}
export function ledgerCutoff(value: string, endOfDay = true): number {
  if (validLedgerDate(value))
    return Date.parse(
      `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`,
    );
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-3]):[0-5]\d|[+-]14:00)$/.test(
      value,
    ) ||
    !validLedgerDate(value.slice(0, 10)) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("วันที่/เวลาไม่ถูกต้อง ต้องระบุเขตเวลา");
  return Date.parse(value);
}
export function ledgerBusinessDate(value: string) {
  return new Date(ledgerCutoff(value) + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function sortLedgerEvents(events: readonly StockLedgerEvent[]) {
  return [...events].sort(
    (a, b) =>
      ledgerCutoff(a.postedAt) - ledgerCutoff(b.postedAt) ||
      a.order - b.order ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
function positionError(
  position: Omit<StockPosition, "id">,
  context: LedgerContext,
) {
  const item = context.items.find((row) => row.id === position.itemId);
  const warehouse = context.warehouses.find(
    (row) => row.id === position.warehouseId,
  );
  if (!item) return "ไม่พบสินค้าอ้างอิง";
  if (
    !context.sites.some((row) => row.id === position.siteId) ||
    !warehouse ||
    warehouse.siteId !== position.siteId
  )
    return "โรงงานและคลังอ้างอิงไม่ถูกต้อง";
  if (item.baseUnit !== position.unit)
    return "หน่วยไม่ตรงกับหน่วยหลัก ไม่มีการแปลงหน่วย";
  if (!Object.hasOwn(inventoryStatuses, position.inventoryStatus))
    return "สถานะคงคลังไม่ถูกต้อง";
  if (
    typeof position.locationLabel !== "string" ||
    typeof position.lotCode !== "string"
  )
    return "ตำแหน่งหรือ Lot ไม่ถูกต้อง";
  return "";
}
export function validateLedgerEvents(
  events: readonly StockLedgerEvent[],
  context: LedgerContext,
): LedgerError[] {
  const errors: LedgerError[] = [];
  const eventIds = new Set<string>();
  const postingIds = new Set<string>();
  const positionIds = new Set<string>();
  const positionKeys = new Set<string>();
  if (events.filter((event) => event.eventType === "OPENING").length > 1)
    errors.push({
      eventId: "opening",
      message: "ชุดประวัติสาธิตต้องมียอดตั้งต้นเพียงเหตุการณ์เดียว",
    });
  for (const position of context.positions) {
    const error = positionError(position, context);
    if (
      error ||
      !position.id.trim() ||
      positionIds.has(position.id) ||
      positionKeys.has(stockKey(position))
    )
      errors.push({
        eventId: "positions",
        message: error || "ทะเบียนตำแหน่งซ้ำหรือไม่มีรหัส",
      });
    positionIds.add(position.id);
    positionKeys.add(stockKey(position));
  }
  for (const event of events) {
    try {
      if (!event.id.trim() || eventIds.has(event.id))
        throw new Error("รหัสเหตุการณ์ซ้ำหรือว่าง");
      eventIds.add(event.id);
      if (!Object.hasOwn(ledgerEventTypes, event.eventType))
        throw new Error("ประเภทเหตุการณ์ไม่ถูกต้อง");
      if (!event.documentNo.trim()) throw new Error("ต้องระบุเลขเอกสารอ้างอิง");
      if (!Number.isSafeInteger(event.order) || event.order < 0)
        throw new Error("ลำดับเหตุการณ์ไม่ถูกต้อง");
      ledgerCutoff(event.postedAt);
      if (validLedgerDate(event.postedAt))
        throw new Error("เวลาลงบัญชีต้องระบุเวลาและเขตเวลา");
      if (!event.postings.length)
        throw new Error("เหตุการณ์ต้องมี stock posting");
      if (event.eventType === "ADJUSTMENT" && !event.reason?.trim())
        throw new Error("การปรับยอดต้องมีเหตุผล");
      const conservation = new Map<
        string,
        { sum: bigint; keys: Set<string> }
      >();
      for (const posting of event.postings) {
        if (!posting.id.trim() || postingIds.has(posting.id))
          throw new Error("รหัส posting ซ้ำหรือว่าง");
        postingIds.add(posting.id);
        const error = positionError(posting, context);
        if (error) throw new Error(error);
        const quantity = quantityUnits(posting.quantityDelta);
        if (quantity === zero) throw new Error("posting ต้องไม่เป็นศูนย์");
        if (
          (event.eventType === "OPENING" || event.eventType === "RECEIPT") &&
          quantity < zero
        )
          throw new Error("ยอดตั้งต้น/รับเข้าต้องเป็นบวก");
        if (event.eventType === "ISSUE" && quantity > zero)
          throw new Error("จ่ายออกต้องเป็นลบ");
        if (
          event.eventType === "TRANSFER" ||
          event.eventType === "STATUS_CHANGE"
        ) {
          const groupKey =
            event.eventType === "TRANSFER"
              ? JSON.stringify([
                  posting.itemId,
                  posting.lotCode,
                  posting.inventoryStatus,
                ])
              : JSON.stringify([
                  posting.itemId,
                  posting.siteId,
                  posting.warehouseId,
                  posting.locationLabel,
                  posting.lotCode,
                ]);
          const group = conservation.get(groupKey) ?? {
            sum: zero,
            keys: new Set<string>(),
          };
          group.sum += quantity;
          group.keys.add(stockKey(posting));
          conservation.set(groupKey, group);
        }
      }
      for (const group of conservation.values())
        if (group.sum !== zero || group.keys.size < 2)
          throw new Error(
            "โอน/เปลี่ยนสถานะต้องรักษายอดต่อสินค้า Lot และมิติที่เกี่ยวข้อง พร้อมตำแหน่งต้นทาง/ปลายทางต่างกัน",
          );
    } catch (error) {
      errors.push({
        eventId: event.id,
        message: error instanceof Error ? error.message : "เหตุการณ์ไม่ถูกต้อง",
      });
    }
  }
  return errors;
}
export function replayLedger(
  events: readonly StockLedgerEvent[],
  context: LedgerContext,
  asOf?: string,
): LedgerReplay {
  if (asOf !== undefined) {
    const current = replayLedger(events, context);
    if (!current.ok) return current;
  }
  const errors = validateLedgerEvents(events, context);
  if (errors.length) return { ok: false, kind: "INVALID", errors };
  try {
    const sorted = sortLedgerEvents(events);
    const supportedFrom =
      sorted.find((event) => event.eventType === "OPENING")?.postedAt ?? null;
    const cutoff = asOf === undefined ? Infinity : ledgerCutoff(asOf);
    if (sorted.length && !supportedFrom)
      throw new Error("ยังไม่มีเหตุการณ์ยอดตั้งต้นที่รองรับประวัติ");
    if (
      supportedFrom &&
      sorted.some(
        (event) => ledgerCutoff(event.postedAt) < ledgerCutoff(supportedFrom),
      )
    )
      throw new Error("มีเหตุการณ์ก่อนยอดตั้งต้น");
    if (supportedFrom && cutoff < ledgerCutoff(supportedFrom))
      return {
        ok: false,
        kind: "BEFORE_OPENING",
        errors: [
          {
            eventId: "as-of",
            message: `มีประวัติตั้งแต่ ${ledgerBusinessDate(supportedFrom)} (Asia/Bangkok) ไม่สามารถสรุปยอดก่อนช่วงนี้ได้`,
          },
        ],
      };
    const positions = new Map(
      context.positions.map((position) => [stockKey(position), position]),
    );
    const balances = new Map<
      string,
      {
        position: Omit<StockPosition, "id">;
        quantity: bigint;
        updatedAt: string;
      }
    >();
    const included = sorted.filter(
      (event) => ledgerCutoff(event.postedAt) <= cutoff,
    );
    if (included.length && supportedFrom)
      for (const [key, position] of positions)
        balances.set(key, {
          position,
          quantity: zero,
          updatedAt: supportedFrom,
        });
    for (const event of included) {
      const deltas = new Map<
        string,
        { position: StockPosting; quantity: bigint }
      >();
      for (const posting of event.postings) {
        const key = stockKey(posting);
        const previous = deltas.get(key);
        deltas.set(key, {
          position: posting,
          quantity:
            (previous?.quantity ?? zero) + quantityUnits(posting.quantityDelta),
        });
      }
      const accepted: [
        string,
        { position: StockPosting; quantity: bigint; updatedAt: string },
      ][] = [];
      for (const [key, delta] of deltas) {
        const quantity = (balances.get(key)?.quantity ?? zero) + delta.quantity;
        if (quantity < zero)
          throw new Error(
            `${event.documentNo}: ยอดตำแหน่งติดลบ (${delta.position.itemId} / ${delta.position.lotCode})`,
          );
        quantityDecimal(quantity);
        accepted.push([
          key,
          { position: delta.position, quantity, updatedAt: event.postedAt },
        ]);
      }
      for (const [key, value] of accepted) {
        balances.set(key, value);
        // A session-created Lot remains visible at zero, only after its first event.
        if (event.operation && !positions.has(key))
          positions.set(key, { ...value.position, id: `ledger:${key}` });
      }
    }
    return {
      ok: true,
      supportedFrom,
      events: included,
      balances: [...balances]
        .filter(([key, value]) => value.quantity !== zero || positions.has(key))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => ({
          id: positions.get(key)?.id ?? `ledger:${key}`,
          itemId: value.position.itemId,
          siteId: value.position.siteId,
          warehouseId: value.position.warehouseId,
          locationLabel: value.position.locationLabel,
          lotCode: value.position.lotCode,
          inventoryStatus: value.position.inventoryStatus,
          unit: value.position.unit,
          onHandQty: quantityNumber(value.quantity),
          updatedAt: value.updatedAt,
        })),
    };
  } catch (error) {
    return {
      ok: false,
      kind: "INVALID",
      errors: [
        {
          eventId: "replay",
          message:
            error instanceof Error ? error.message : "ไม่สามารถคำนวณยอดได้",
        },
      ],
    };
  }
}
export function reconcileInventory(
  projected: readonly InventoryBalanceSnapshot[],
  expected: readonly InventoryBalanceSnapshot[],
) {
  const actual = new Map<string, bigint>();
  const target = new Map<string, bigint>();
  const fill = (
    rows: readonly InventoryBalanceSnapshot[],
    map: Map<string, bigint>,
  ) => {
    for (const row of rows) {
      const key = stockKey(row);
      if (map.has(key)) throw new Error("stock key ซ้ำในการเทียบยอด");
      map.set(key, quantityUnits(row.onHandQty));
    }
  };
  fill(projected, actual);
  fill(expected, target);
  const matching: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];
  const differences: {
    key: string;
    expected: string;
    actual: string;
    difference: string;
  }[] = [];
  for (const [key, quantity] of target) {
    if (!actual.has(key)) missing.push(key);
    else if (actual.get(key) === quantity) matching.push(key);
    else
      differences.push({
        key,
        expected: quantityDecimal(quantity),
        actual: quantityDecimal(actual.get(key)!),
        difference: quantityDecimal(actual.get(key)! - quantity),
      });
  }
  for (const key of actual.keys()) if (!target.has(key)) unexpected.push(key);
  return {
    ok: !missing.length && !unexpected.length && !differences.length,
    matching,
    missing,
    unexpected,
    differences,
  };
}
export type MovementFilters = {
  search: string;
  eventType: "ALL" | LedgerEventType;
  from: string;
  to: string;
  siteId: string;
  warehouseId: string;
  lot: string;
  itemId: string;
};
export const defaultMovementFilters: MovementFilters = {
  search: "",
  eventType: "ALL",
  from: "",
  to: "",
  siteId: "ALL",
  warehouseId: "ALL",
  lot: "",
  itemId: "ALL",
};
const norm = (value: string) => value.trim().toLocaleLowerCase("th-TH");
export function filterMovements(
  events: readonly StockLedgerEvent[],
  filters: MovementFilters,
  context: LedgerContext,
) {
  const from = filters.from ? ledgerCutoff(filters.from, false) : -Infinity;
  const to = filters.to ? ledgerCutoff(filters.to) : Infinity;
  if (from > to) throw new Error("วันที่เริ่มต้นต้องไม่หลังวันที่สิ้นสุด");
  return sortLedgerEvents(events)
    .filter((event) => {
      const time = ledgerCutoff(event.postedAt);
      if (
        time < from ||
        time > to ||
        (filters.eventType !== "ALL" && event.eventType !== filters.eventType)
      )
        return false;
      if (
        !event.postings.some(
          (posting) =>
            (filters.itemId === "ALL" || posting.itemId === filters.itemId) &&
            (filters.siteId === "ALL" || posting.siteId === filters.siteId) &&
            (filters.warehouseId === "ALL" ||
              posting.warehouseId === filters.warehouseId) &&
            norm(posting.lotCode).includes(norm(filters.lot)),
        )
      )
        return false;
      const text = [
        event.documentNo,
        event.reason,
        ...event.postings.flatMap((posting) => {
          const item = context.items.find((row) => row.id === posting.itemId);
          const warehouse = context.warehouses.find(
            (row) => row.id === posting.warehouseId,
          );
          return [
            item?.code,
            item?.name,
            warehouse?.code,
            warehouse?.name,
            posting.lotCode,
            posting.locationLabel,
          ];
        }),
      ]
        .filter(Boolean)
        .join(" ");
      return norm(text).includes(norm(filters.search));
    })
    .reverse();
}
export function summarizeLots(balances: readonly InventoryBalanceSnapshot[]) {
  const groups = new Map<
    string,
    {
      itemId: string;
      lotCode: string;
      unit: string;
      quantity: bigint;
      positions: number;
    }
  >();
  for (const row of balances) {
    const key = JSON.stringify([row.itemId, row.lotCode, row.unit]);
    const group = groups.get(key) ?? {
      itemId: row.itemId,
      lotCode: row.lotCode,
      unit: row.unit,
      quantity: zero,
      positions: 0,
    };
    group.quantity += quantityUnits(row.onHandQty);
    group.positions += 1;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    quantity: quantityDecimal(group.quantity),
  }));
}
export function aggregateWarehouseLocations(
  balances: readonly InventoryBalanceSnapshot[],
) {
  const groups = new Map<
    string,
    {
      itemId: string;
      siteId: string;
      warehouseId: string;
      locationLabel: string;
      inventoryStatus: InventoryBalanceSnapshot["inventoryStatus"];
      unit: string;
      quantity: bigint;
      lots: Set<string>;
    }
  >();
  for (const row of balances) {
    const key = JSON.stringify([
      row.itemId,
      row.siteId,
      row.warehouseId,
      row.locationLabel,
      row.inventoryStatus,
      row.unit,
    ]);
    const group = groups.get(key) ?? {
      itemId: row.itemId,
      siteId: row.siteId,
      warehouseId: row.warehouseId,
      locationLabel: row.locationLabel,
      inventoryStatus: row.inventoryStatus,
      unit: row.unit,
      quantity: zero,
      lots: new Set<string>(),
    };
    group.quantity += quantityUnits(row.onHandQty);
    group.lots.add(row.lotCode);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ lots, ...group }) => ({
    ...group,
    quantity: quantityDecimal(group.quantity),
    lotCount: lots.size,
  }));
}
