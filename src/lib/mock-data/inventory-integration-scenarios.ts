import { inventoryBalances } from "./inventory";
import {
  sourceDocumentTypes,
  type IntegrationModule,
  type IntegrationScenario,
  type SourceDocumentReference,
  type InventoryReference,
  type StockEffectIntent,
  type BusinessMilestone,
  type KnownSourceAction,
} from "@/src/features/inventory/inventory-integration-contracts";
import {
  integrationPayloadFingerprint,
  integrationSourceKey,
} from "@/src/features/inventory/inventory-integration-preview-domain";

function reference(id: string): InventoryReference {
  const row = inventoryBalances.find((row) => row.id === id);
  return {
    itemId: row?.itemId ?? "",
    siteId: row?.siteId ?? "",
    warehouseId: row?.warehouseId ?? "",
    locationLabel: row?.locationLabel ?? "",
    lotCode: row?.lotCode ?? "",
    inventoryStatus: row?.inventoryStatus ?? "QC_HOLD",
    unit: row?.unit ?? "",
  };
}
function scenario(
  id: string,
  label: string,
  module: IntegrationModule,
  milestone: BusinessMilestone,
  intent: StockEffectIntent,
  evidence: IntegrationScenario["evidence"] = "HYPOTHETICAL_CONFIRMED",
): IntegrationScenario {
  return {
    id,
    label,
    intent,
    evidence,
    sourceReference: {
      sourceApplication: "factory-preview-demo",
      workspaceId: "workspace-demo",
      sourceModule: module,
      sourceDocumentType: sourceDocumentTypes[module],
      sourceDocumentId: `fictional:${id}`,
      sourceDocumentNumber: `PREVIEW-${module}-${id}`,
      sourceLineId: "mock-allocation-1",
      businessMilestone: milestone,
    } as SourceDocumentReference,
    sourceLifecycle:
      evidence === "DOCUMENT_ONLY"
        ? "เอกสารสาธิตเท่านั้น"
        : evidence === "DRAFT"
          ? "ฉบับร่างสาธิต"
          : "สมมติว่ามีหลักฐานยืนยันแล้ว (ไม่ใช่ lifecycle ที่ทำงานจริง)",
    physicalMovementId: `fictional-movement:${id}`,
  };
}
const none = (reason: string): StockEffectIntent => ({
  effectType: "NONE",
  reason,
});
const raw = reference("b01");
const held = reference("b02");
const fg = reference("b15");
const receipt = scenario(
  "raw-receipt",
  "รับวัตถุดิบยืนยัน (สมมติ) +100 kg",
  "RECEIVING",
  "RECEIPT_CONFIRMED",
  {
    effectType: "RECEIPT",
    position: {
      ...raw,
      inventoryStatus: "QC_HOLD",
      lotCode: "PREVIEW-NEW-LOT",
    },
    quantity: "100",
  },
);
const issue = scenario(
  "material-issue",
  "เบิกวัตถุดิบยืนยัน (สมมติ) −300 kg",
  "MATERIAL_ISSUE",
  "ISSUE_CONFIRMED",
  { effectType: "ISSUE", position: raw, quantity: "300" },
);
const duplicate = {
  ...issue,
  id: "duplicate-reference",
  label: "source action ซ้ำกับชุดอ้างอิงจำลอง",
};
const duplicateConflict: IntegrationScenario = {
  ...duplicate,
  id: "duplicate-conflict",
  label: "source key เดิม แต่จำนวนเปลี่ยน → conflict",
  intent: { effectType: "ISSUE", position: raw, quantity: "301" },
};
const scenarios: IntegrationScenario[] = [
  scenario(
    "pr-created",
    "สร้าง PR → ไม่มีผลต่อสต็อก",
    "PR",
    "CREATED",
    none("PR เป็นคำขอจัดซื้อ ไม่ใช่หลักฐานว่าสินค้ามาถึงแล้ว"),
    "DOCUMENT_ONLY",
  ),
  scenario(
    "po-created",
    "สร้าง PO → ไม่มีผลต่อสต็อก",
    "PO",
    "CREATED",
    none("สั่งซื้อยังไม่ใช่การรับสินค้าจริง; ปัจจุบันมีเพียง DemoPO ภายใน PR"),
    "DOCUMENT_ONLY",
  ),
  receipt,
  scenario(
    "qc-release",
    "ผล QC ยืนยัน (สมมติ): QC_HOLD → AVAILABLE",
    "RAW_QC",
    "QC_DISPOSITION_CONFIRMED",
    {
      effectType: "QC_STATUS_CHANGE",
      position: held,
      quantity: "50",
      destinationStatus: "AVAILABLE",
    },
  ),
  scenario(
    "bom-selected",
    "เลือกสูตร BOM → ไม่มีผลต่อสต็อก",
    "BOM",
    "FORMULA_SELECTED",
    none("สูตรเป็นแผนความต้องการวัตถุดิบ การเลือกสูตรไม่ใช่การเบิกหรือใช้จริง"),
    "DOCUMENT_ONLY",
  ),
  issue,
  scenario(
    "mixing-saved",
    "บันทึกรายงานผสม → ไม่มีผลต่อสต็อก",
    "MIXING",
    "SAVED",
    none(
      "รายงานผสมเป็นหลักฐานการผลิต; ต้องอ้างอิง physical material issue เดียวกัน ไม่ตัดซ้ำ",
    ),
    "DOCUMENT_ONLY",
  ),
  scenario(
    "production-created",
    "สร้างคำสั่งผลิต → ไม่มีผลต่อสต็อก",
    "PRODUCTION_ORDER",
    "CREATED",
    none(
      "เริ่มเอกสารหรือเปลี่ยนสถานะผลิตไม่ได้ยืนยันการใช้วัตถุดิบหรือรับผลผลิตจริง",
    ),
    "DOCUMENT_ONLY",
  ),
  scenario(
    "production-receipt",
    "รับผลผลิต FG ยืนยัน (สมมติ) +20 กระสอบ",
    "PRODUCTION_RECEIPT",
    "OUTPUT_CONFIRMED",
    {
      effectType: "RECEIPT",
      position: {
        ...fg,
        inventoryStatus: "QC_HOLD",
        lotCode: "PREVIEW-OUTPUT-LOT",
      },
      quantity: "20",
    },
  ),
  scenario(
    "packing-conversion",
    "Packing conversion → ต้องออกแบบเพิ่มเติม",
    "PACKING",
    "CONVERSION_REQUESTED",
    {
      effectType: "MANUFACTURING_CONVERSION",
      reason:
        "ใช้ WIP และบรรจุภัณฑ์ ผลิต FG ต่าง item/ต่างหน่วย ต้องมีสัญญาการแปรรูปเฉพาะ",
    },
  ),
  scenario(
    "delivery-draft",
    "ใบส่งสินค้าร่าง → ไม่มีผลต่อสต็อก",
    "DELIVERY",
    "CREATED",
    none(
      "การสร้าง แก้ไข พิมพ์ หรือสถานะพร้อมส่งยังไม่ใช่หลักฐาน dispatch ที่ยืนยัน",
    ),
    "DRAFT",
  ),
  scenario(
    "delivery-dispatch",
    "จ่ายสินค้าจริงตาม dispatch (สมมติ) −10 กระสอบ",
    "DELIVERY",
    "DISPATCH_CONFIRMED",
    { effectType: "ISSUE", position: fg, quantity: "10" },
  ),
  {
    ...issue,
    id: "insufficient-stock",
    label: "เบิกเกินยอดตำแหน่ง → BLOCKED",
    intent: { effectType: "ISSUE", position: raw, quantity: "999999" },
  },
  {
    ...receipt,
    id: "invalid-site",
    label: "คลังกับ Site ไม่ตรงกัน → BLOCKED",
    intent: {
      effectType: "RECEIPT",
      position: { ...raw, siteId: "inventory-site-east" },
      quantity: "10",
    },
  },
  duplicateConflict,
  duplicate,
  scenario(
    "qc-blocked",
    "QC ไม่ผ่าน (สมมติ): QC_HOLD → BLOCKED",
    "RAW_QC",
    "QC_DISPOSITION_CONFIRMED",
    {
      effectType: "QC_STATUS_CHANGE",
      position: held,
      quantity: "30",
      destinationStatus: "BLOCKED",
    },
  ),
  {
    ...issue,
    id: "held-issue",
    label: "เบิกยอดกัก QC → BLOCKED",
    intent: { effectType: "ISSUE", position: held, quantity: "10" },
  },
  {
    ...receipt,
    id: "missing-item",
    label: "ไม่มี mapping สินค้า → BLOCKED",
    intent: {
      effectType: "RECEIPT",
      position: { ...raw, itemId: "" },
      quantity: "10",
    },
  },
  {
    ...issue,
    id: "unknown-lifecycle",
    label: "ยังไม่ทราบ lifecycle → DESIGN_PENDING",
    evidence: "UNKNOWN",
    sourceLifecycle: "ยังไม่ทราบ / DECISION_PENDING",
  },
  scenario(
    "invoice-created",
    "สร้างใบแจ้งหนี้ → ไม่มีผลต่อสต็อก",
    "INVOICE",
    "CREATED",
    none("ใบแจ้งหนี้เป็นเอกสารการเงิน ไม่เป็นเจ้าของการตัดสินค้า"),
    "DOCUMENT_ONLY",
  ),
];
function freezeScenario(row: IntegrationScenario) {
  Object.freeze(row.sourceReference);
  if ("position" in row.intent) Object.freeze(row.intent.position);
  Object.freeze(row.intent);
  return Object.freeze(row);
}
export const inventoryIntegrationScenarios: readonly IntegrationScenario[] =
  Object.freeze(scenarios.map(freezeScenario));
// Synthetic evidence for duplicate-detection demonstrations, NOT records posted to the real/session ledger.
export const mockKnownSourceActions: readonly KnownSourceAction[] =
  Object.freeze([
    Object.freeze({
      workspaceId: issue.sourceReference.workspaceId,
      idempotencyKey: integrationSourceKey(issue.sourceReference),
      payloadFingerprint: integrationPayloadFingerprint(issue),
      physicalMovementId: issue.physicalMovementId!,
    }),
  ]);
// Normal issue is intentionally not checked against the duplicate fixture history.
export const scenarioKnownActions = (
  id: string,
): readonly KnownSourceAction[] =>
  id.startsWith("duplicate-") ? mockKnownSourceActions : [];
