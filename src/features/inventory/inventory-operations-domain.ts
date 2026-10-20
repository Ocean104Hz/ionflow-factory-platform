import { inventoryStatuses } from "./inventory-domain";
import {
  ledgerCutoff,
  replayLedger,
  stockKey,
  type LedgerContext,
  type StockLedgerEvent,
  type StockPosting,
  type StockPosition,
} from "./inventory-ledger-domain";
import { quantityDecimal, quantityUnits } from "./inventory-quantity";

export const stockOperations = {
  RECEIVE: "รับสินค้าเข้าคลัง",
  ISSUE: "เบิกสินค้าออกจากคลัง",
  TRANSFER: "โอนย้ายสินค้า",
  ADJUST: "ตรวจนับและปรับยอด",
} as const;
export type OperationType = keyof typeof stockOperations;
type Metadata = Readonly<{
  operationId: string;
  documentNo: string;
  postedAt: string;
  actor: string;
  note: string;
}>;
export type ReceiptPosition = Omit<StockPosition, "id">;
export type StockCommand = Metadata &
  (
    | { type: "RECEIVE"; destination: ReceiptPosition; quantity: string }
    | { type: "ISSUE"; sourceKey: string; quantity: string }
    | {
        type: "TRANSFER";
        sourceKey: string;
        warehouseId: string;
        locationLabel: string;
        quantity: string;
      }
    | {
        type: "ADJUST";
        sourceKey: string;
        countedQuantity: string;
        reviewedQuantity: string;
        reason: string;
      }
  );
export type OperationResult =
  | {
      ok: true;
      events: readonly StockLedgerEvent[];
      event: StockLedgerEvent;
      duplicate: boolean;
    }
  | {
      ok: false;
      code: "INVALID" | "CONFLICT" | "STALE";
      errors: Record<string, string>;
      latestQuantity?: string;
    };
const prefixes = {
  RECEIVE: "RCV",
  ISSUE: "ISS",
  TRANSFER: "TRF",
  ADJUST: "ADJ",
};
const zero = BigInt(0);

export function nextOperationDocument(
  events: readonly StockLedgerEvent[],
  type: OperationType,
) {
  const used = new Set(events.map((event) => event.documentNo));
  let serial = 1;
  while (used.has(`${prefixes[type]}-${String(serial).padStart(6, "0")}`))
    serial++;
  return `${prefixes[type]}-${String(serial).padStart(6, "0")}`;
}

// Locations are inventory-only demo references, not a second editable Settings master.
export function operationLocations(
  context: LedgerContext,
  warehouseId: string,
) {
  return [
    ...new Set(
      context.positions
        .filter((p) => p.warehouseId === warehouseId)
        .map((p) => p.locationLabel),
    ),
  ];
}
function payload(command: StockCommand) {
  const common = [
    command.type,
    command.documentNo,
    command.postedAt,
    command.actor,
    command.note,
  ];
  switch (command.type) {
    case "RECEIVE":
      return JSON.stringify([
        ...common,
        stockKey(command.destination),
        command.destination.unit,
        command.quantity,
      ]);
    case "ISSUE":
      return JSON.stringify([...common, command.sourceKey, command.quantity]);
    case "TRANSFER":
      return JSON.stringify([
        ...common,
        command.sourceKey,
        command.warehouseId,
        command.locationLabel,
        command.quantity,
      ]);
    case "ADJUST":
      return JSON.stringify([
        ...common,
        command.sourceKey,
        command.countedQuantity,
        command.reviewedQuantity,
        command.reason,
      ]);
  }
}
function fail(field: string, message: string): never {
  throw Object.assign(new Error(message), { field });
}
function parse(value: string, field: string) {
  try {
    return quantityUnits(value);
  } catch {
    return fail(field, "ระบุจำนวนที่ถูกต้อง ทศนิยมไม่เกิน 6 ตำแหน่ง");
  }
}

export function commitStockOperation(
  events: readonly StockLedgerEvent[],
  command: StockCommand,
  context: LedgerContext,
): OperationResult {
  try {
    if (!Object.hasOwn(stockOperations, command.type))
      fail("type", "ไม่พบประเภทรายการ");
    if (!command.operationId?.trim())
      fail("operationId", "ไม่พบรหัสการทำรายการ");
    const fingerprint = payload(command);
    const prior = events.find(
      (event) => event.operation?.id === command.operationId,
    );
    if (prior)
      return prior.operation?.payload === fingerprint
        ? { ok: true, events, event: prior, duplicate: true }
        : {
            ok: false,
            code: "CONFLICT",
            errors: {
              form: "รหัสรายการนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาเปิดรายการใหม่",
            },
          };
    if (!command.actor?.trim()) fail("actor", "กรุณาระบุผู้ทำรายการสาธิต");
    if (
      !new RegExp(`^${prefixes[command.type]}-\\d{6,}$`).test(
        command.documentNo,
      )
    )
      fail("documentNo", "เลขเอกสารไม่ตรงกับประเภทรายการ");
    if (events.some((event) => event.documentNo === command.documentNo))
      fail("documentNo", "เลขเอกสารถูกใช้แล้ว กรุณาเปิดรายการใหม่");
    const current = replayLedger(events, context);
    if (!current.ok)
      fail("form", current.errors.map((e) => e.message).join(" · "));
    if (!current.supportedFrom)
      fail("form", "ยังไม่มี Ledger ยอดตั้งต้นที่ถูกต้อง");
    const timestamp = ledgerCutoff(command.postedAt);
    if (
      !command.postedAt.includes("T") ||
      timestamp < ledgerCutoff(current.supportedFrom)
    )
      fail("postedAt", "ไม่อนุญาตลงรายการย้อนหลัง ก่อนยอดตั้งต้น");
    const eventId = `operation:${command.operationId}`;
    const postings: StockPosting[] = [];
    const post = (position: ReceiptPosition, delta: bigint) => {
      const {
        itemId,
        siteId,
        warehouseId,
        locationLabel,
        lotCode,
        inventoryStatus,
        unit,
      } = position;
      postings.push(
        Object.freeze({
          itemId,
          siteId,
          warehouseId,
          locationLabel,
          lotCode,
          inventoryStatus,
          unit,
          id: `${eventId}:${postings.length + 1}`,
          quantityDelta: quantityDecimal(delta),
        }),
      );
    };
    const validDestination = (position: ReceiptPosition) => {
      const warehouse = context.warehouses.find(
        (w) => w.id === position.warehouseId,
      );
      if (!warehouse || warehouse.siteId !== position.siteId)
        fail("warehouseId", "คลังสินค้าไม่อยู่ในโรงงานที่เลือก");
      if (
        !operationLocations(context, position.warehouseId).includes(
          position.locationLabel,
        )
      )
        fail("locationLabel", "ไม่พบตำแหน่งจัดเก็บในคลังที่เลือก");
    };
    if (command.type === "RECEIVE") {
      const destination = command.destination;
      const item = context.items.find((item) => item.id === destination.itemId);
      if (!item) fail("itemId", "ไม่พบสินค้าอ้างอิง");
      if (item?.baseUnit !== destination.unit)
        fail("unit", "หน่วยต้องตรงกับหน่วยหลักของสินค้า");
      validDestination(destination);
      if (
        !destination.lotCode?.trim() ||
        destination.lotCode !== destination.lotCode.trim()
      )
        fail("lotCode", "กรุณาระบุ Lot โดยไม่มีช่องว่างหน้า/ท้าย");
      if (!Object.hasOwn(inventoryStatuses, destination.inventoryStatus))
        fail("inventoryStatus", "สถานะคงคลังไม่ถูกต้อง");
      const amount = parse(command.quantity, "quantity");
      if (amount <= zero) fail("quantity", "จำนวนรับเข้าต้องมากกว่าศูนย์");
      post(destination, amount);
    } else {
      const source = current.balances.find(
        (p) => stockKey(p) === command.sourceKey,
      );
      if (!source)
        fail("sourceKey", "ไม่พบตำแหน่งสต็อก / Lot ที่เลือกในยอดปัจจุบัน");
      const balance = quantityUnits(source.onHandQty);
      if (command.type === "ADJUST") {
        if (!command.reason.trim()) fail("reason", "กรุณาระบุเหตุผลการปรับยอด");
        const counted = parse(command.countedQuantity, "countedQuantity");
        if (counted < zero) fail("countedQuantity", "จำนวนตรวจนับต้องไม่ติดลบ");
        if (parse(command.reviewedQuantity, "reviewedQuantity") !== balance)
          return {
            ok: false,
            code: "STALE",
            latestQuantity: quantityDecimal(balance),
            errors: {
              reviewedQuantity:
                "ยอดระบบเปลี่ยนแล้ว กรุณาตรวจทานยอดล่าสุดและยืนยันใหม่",
            },
          };
        const delta = counted - balance;
        if (delta === zero)
          fail(
            "countedQuantity",
            "ยอดตรวจนับเท่ากับยอดระบบ ไม่มีรายการปรับยอด",
          );
        post(source, delta);
      } else {
        if (command.type === "ISSUE" && source.inventoryStatus !== "AVAILABLE")
          fail(
            "sourceKey",
            "เบิกได้เฉพาะสต็อก AVAILABLE ไม่สามารถเบิกยอดกัก QC หรือระงับใช้งาน",
          );
        if (command.type === "TRANSFER" && source.inventoryStatus === "BLOCKED")
          fail("sourceKey", "ไม่อนุญาตโอนสต็อกที่ระงับใช้งาน");
        const amount = parse(command.quantity, "quantity");
        if (amount <= zero) fail("quantity", "จำนวนต้องมากกว่าศูนย์");
        if (amount > balance)
          fail(
            "quantity",
            command.type === "ISSUE"
              ? "ยอดคงเหลือไม่เพียงพอสำหรับการเบิก"
              : "ยอดคงเหลือไม่เพียงพอสำหรับการโอน",
          );
        post(source, -amount);
        if (command.type === "TRANSFER") {
          const destination = {
            ...source,
            warehouseId: command.warehouseId,
            locationLabel: command.locationLabel,
          };
          validDestination(destination);
          if (stockKey(destination) === stockKey(source))
            fail("locationLabel", "ต้นทางและปลายทางต้องเป็นคนละตำแหน่ง");
          post(destination, amount);
        }
      }
    }
    const event: StockLedgerEvent = Object.freeze({
      id: eventId,
      eventType:
        command.type === "RECEIVE"
          ? "RECEIPT"
          : command.type === "ADJUST"
            ? "ADJUSTMENT"
            : command.type,
      documentNo: command.documentNo,
      // A form may predate another commit; append after the latest event, never back-post.
      postedAt: new Date(
        Math.max(
          timestamp,
          ...current.events.map((event) => ledgerCutoff(event.postedAt)),
        ),
      ).toISOString(),
      order: Math.max(0, ...events.map((e) => e.order)) + 1,
      reason:
        command.type === "ADJUST" ? command.reason.trim() : command.note.trim(),
      operation: Object.freeze({
        id: command.operationId,
        payload: fingerprint,
        actor: command.actor,
        type: command.type,
        note: command.note,
        ...(command.type === "ADJUST"
          ? {
              countedQuantity: command.countedQuantity,
              reviewedQuantity: command.reviewedQuantity,
            }
          : {}),
      }),
      postings: Object.freeze(postings),
    });
    const next = Object.freeze([...events, event]);
    const projected = replayLedger(next, context);
    if (!projected.ok)
      fail("form", projected.errors.map((e) => e.message).join(" · "));
    return { ok: true, events: next, event, duplicate: false };
  } catch (cause) {
    const field =
      cause instanceof Error && "field" in cause ? String(cause.field) : "form";
    return {
      ok: false,
      code: "INVALID",
      errors: {
        [field]:
          cause instanceof Error ? cause.message : "ไม่สามารถทำรายการได้",
      },
    };
  }
}

// Synchronous commits serialize commands against the latest immutable event array.
export function createStockSession(
  initial: readonly StockLedgerEvent[],
  context: LedgerContext,
) {
  let events = Object.freeze([...initial]);
  return {
    getEvents: () => events,
    commit(command: StockCommand) {
      const result = commitStockOperation(events, command, context);
      if (result.ok) events = result.events;
      return result;
    },
  };
}
