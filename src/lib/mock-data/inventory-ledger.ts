import { inventoryBalances } from "./inventory";
import {
  quantityDecimal,
  quantityUnits,
} from "@/src/features/inventory/inventory-quantity";
import {
  stockKey,
  type StockPosition,
  type StockPosting,
  type StockLedgerEvent,
  type LedgerEventType,
} from "@/src/features/inventory/inventory-ledger-domain";

// Identity-only registry: zero positions stay visible without injecting snapshot quantities.
export const inventoryPositions: readonly StockPosition[] = Object.freeze(
  inventoryBalances.map(
    ({ onHandQty: _quantity, updatedAt: _updated, ...position }) =>
      Object.freeze(position),
  ),
);
const position = (id: string) =>
  inventoryPositions.find((row) => row.id === id)!;
const rawHold = { ...position("b01"), inventoryStatus: "QC_HOLD" as const };
const wipSource = {
  ...position("b13"),
  warehouseId: "wh-1",
  locationLabel: "DEMO โซนรับกึ่งสำเร็จ",
};
const posting = (
  id: string,
  source: StockPosition,
  quantityDelta: string,
): StockPosting => {
  const { id: _positionId, ...key } = source;
  return Object.freeze({ ...key, id, quantityDelta });
};
const event = (
  id: string,
  eventType: LedgerEventType,
  postedAt: string,
  order: number,
  documentNo: string,
  reason: string,
  postings: StockPosting[],
): StockLedgerEvent =>
  Object.freeze({
    id,
    eventType,
    postedAt,
    order,
    documentNo,
    reason,
    postings: Object.freeze(postings),
  });
const history: readonly StockLedgerEvent[] = [
  event(
    "receipt-raw",
    "RECEIPT",
    "2026-10-02T02:00:00Z",
    1,
    "DEMO-GR-001",
    "รับวัตถุดิบตัวอย่าง ไม่มีการเชื่อมเอกสารจริง",
    [posting("p-r1", position("b01"), "200")],
  ),
  event(
    "issue-raw",
    "ISSUE",
    "2026-10-03T02:00:00Z",
    2,
    "DEMO-GI-001",
    "จ่ายวัตถุดิบตัวอย่างเพื่อการผลิต",
    [posting("p-i1", position("b01"), "-80")],
  ),
  event(
    "transfer-raw",
    "TRANSFER",
    "2026-10-04T02:00:00Z",
    3,
    "DEMO-TR-001",
    "โอน Lot เดียวกันระหว่าง WH01 และ WH02",
    [
      posting("p-t1", position("b01"), "-50"),
      posting("p-t2", position("b03"), "50"),
    ],
  ),
  event(
    "qc-hold",
    "STATUS_CHANGE",
    "2026-10-05T02:00:00Z",
    4,
    "DEMO-QC-HOLD-001",
    "กักตรวจ Lot A ตัวอย่าง",
    [posting("p-q1", position("b01"), "-60"), posting("p-q2", rawHold, "60")],
  ),
  event(
    "receipt-wip",
    "RECEIPT",
    "2026-10-05T02:00:00Z",
    5,
    "DEMO-WIP-IN-001",
    "รับกึ่งสำเร็จรูปตัวอย่างเข้าพื้นที่พัก",
    [posting("p-w1", wipSource, "40")],
  ),
  event(
    "qc-release",
    "STATUS_CHANGE",
    "2026-10-07T02:00:00Z",
    6,
    "DEMO-QC-RELEASE-001",
    "ปล่อย Lot A จากการกักตรวจ (สาธิต)",
    [posting("p-q3", rawHold, "-60"), posting("p-q4", position("b01"), "60")],
  ),
  event(
    "transfer-wip",
    "TRANSFER",
    "2026-10-08T02:00:00Z",
    7,
    "DEMO-WIP-TR-001",
    "ย้ายกึ่งสำเร็จรูปจากพื้นที่พักไปโซนรอผลตรวจ",
    [posting("p-w2", wipSource, "-40"), posting("p-w3", position("b13"), "40")],
  ),
  event(
    "receipt-fg",
    "RECEIPT",
    "2026-10-09T02:00:00Z",
    8,
    "DEMO-FG-IN-001",
    "รับสินค้าสำเร็จรูปตัวอย่าง",
    [posting("p-f1", position("b15"), "30")],
  ),
  event(
    "adjust-label",
    "ADJUSTMENT",
    "2026-10-10T02:00:00Z",
    9,
    "DEMO-ADJ-001",
    "ตรวจนับตัวอย่างพบฉลากเพิ่มเติม 20 ใบ",
    [posting("p-a1", position("b11"), "20")],
  ),
  event(
    "issue-spare",
    "ISSUE",
    "2026-10-11T02:00:00Z",
    10,
    "DEMO-MRO-OUT-001",
    "เบิกอะไหล่สาธิต 2 ชิ้น",
    [posting("p-m1", position("b18"), "-2")],
  ),
  event(
    "receipt-additive",
    "RECEIPT",
    "2026-10-16T03:30:00Z",
    11,
    "DEMO-GR-002",
    "รับสารเติมแต่งสาธิต 5 กิโลกรัม",
    [posting("p-r2", position("b05"), "5")],
  ),
];
function openingEvent(): StockLedgerEvent {
  const net = new Map<string, bigint>();
  for (const row of history)
    for (const line of row.postings) {
      const key = stockKey(line);
      net.set(
        key,
        (net.get(key) ?? BigInt(0)) + quantityUnits(line.quantityDelta),
      );
    }
  const postings: StockPosting[] = [];
  for (const snapshot of inventoryBalances) {
    const opening =
      quantityUnits(snapshot.onHandQty) -
      (net.get(stockKey(snapshot)) ?? BigInt(0));
    if (opening < BigInt(0))
      throw new Error(`ยอดตั้งต้นไม่ถูกต้อง: ${snapshot.id}`);
    if (opening > BigInt(0))
      postings.push(
        posting(
          `opening-${snapshot.id}`,
          position(snapshot.id),
          quantityDecimal(opening),
        ),
      );
    net.delete(stockKey(snapshot));
  }
  if ([...net.values()].some((quantity) => quantity !== BigInt(0)))
    throw new Error("ประวัติมีตำแหน่งที่ไม่คืนยอดตาม Step 1");
  return event(
    "opening-20261001",
    "OPENING",
    "2026-10-01T01:00:00Z",
    0,
    "DEMO-OPEN-20261001",
    "ยอดตั้งต้นจำลอง = ยอด Step 1 ลบผลสุทธิของประวัติ ไม่ใช่การรับเข้าปกติ",
    postings,
  );
}
// Built once, never appended to React state; repeated replay is idempotent.
export const inventoryLedger: readonly StockLedgerEvent[] = Object.freeze([
  openingEvent(),
  ...history,
]);
