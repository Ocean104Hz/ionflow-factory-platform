import type { StockPosition, StockPosting } from "./inventory-ledger-domain";

export const integrationModules = {
  PR: "ใบขอซื้อ (PR)",
  PO: "ใบสั่งซื้อ (PO)",
  RECEIVING: "รับสินค้าเข้าคลัง (อนาคต)",
  RAW_QC: "ตรวจสอบวัตถุดิบ",
  BOM: "สูตรผสมวัตถุดิบ",
  MATERIAL_ISSUE: "เบิกวัตถุดิบ (อนาคต)",
  MIXING: "รายงานผสมปุ๋ยผง",
  PRODUCTION_ORDER: "คำสั่งการผลิต",
  PRODUCTION_RECEIPT: "รับยอดผลิต (อนาคต)",
  PACKING: "บรรจุสินค้า (อนาคต)",
  DELIVERY: "ใบส่งสินค้า",
  INVOICE: "ใบแจ้งหนี้",
} as const;
export type IntegrationModule = keyof typeof integrationModules;
export const sourceDocumentTypes = {
  PR: "PURCHASE_REQUISITION",
  PO: "PURCHASE_ORDER",
  RECEIVING: "GOODS_RECEIPT",
  RAW_QC: "RAW_MATERIAL_INSPECTION",
  BOM: "BOM_FORMULA",
  MATERIAL_ISSUE: "MATERIAL_ISSUE",
  MIXING: "POWDER_MIXING_REPORT",
  PRODUCTION_ORDER: "PRODUCTION_ORDER",
  PRODUCTION_RECEIPT: "PRODUCTION_RECEIPT",
  PACKING: "PACKING_REPORT",
  DELIVERY: "DELIVERY_ORDER",
  INVOICE: "INVOICE",
} as const;
export type BusinessMilestone =
  | "CREATED"
  | "SAVED"
  | "FORMULA_SELECTED"
  | "RECEIPT_CONFIRMED"
  | "ISSUE_CONFIRMED"
  | "QC_DISPOSITION_CONFIRMED"
  | "OUTPUT_CONFIRMED"
  | "DISPATCH_CONFIRMED"
  | "CONVERSION_REQUESTED"
  | "UNKNOWN";
export type SourceDocumentReference = {
  [M in IntegrationModule]: Readonly<{
    sourceApplication: string;
    workspaceId: string;
    sourceModule: M;
    sourceDocumentType: (typeof sourceDocumentTypes)[M];
    sourceDocumentId: string;
    sourceDocumentNumber: string;
    sourceLineId?: string;
    // Only an independently approved posting revision belongs here, not every document edit.
    sourceRevision?: string;
    businessMilestone: BusinessMilestone;
  }>;
}[IntegrationModule];
export type InventoryReference = Omit<StockPosition, "id">;
export type StockEffectIntent =
  | Readonly<{ effectType: "NONE"; reason: string }>
  | Readonly<{
      effectType: "RECEIPT" | "ISSUE";
      position: InventoryReference;
      quantity: string;
    }>
  | Readonly<{
      effectType: "QC_STATUS_CHANGE";
      position: InventoryReference;
      quantity: string;
      destinationStatus: "AVAILABLE" | "BLOCKED";
    }>
  | Readonly<{ effectType: "MANUFACTURING_CONVERSION"; reason: string }>;
export type IntegrationScenario = Readonly<{
  id: string;
  label: string;
  sourceReference: SourceDocumentReference;
  sourceLifecycle: string;
  evidence: "DOCUMENT_ONLY" | "DRAFT" | "HYPOTHETICAL_CONFIRMED" | "UNKNOWN";
  intent: StockEffectIntent;
  physicalMovementId?: string;
  expectedLedgerVersion?: string;
}>;
export type ProposedStockEffect = StockEffectIntent &
  Readonly<{
    sourceReference: SourceDocumentReference;
    idempotencyKey: string;
  }>;
export type KnownSourceAction = Readonly<{
  workspaceId: string;
  idempotencyKey: string;
  payloadFingerprint: string;
  physicalMovementId: string;
}>;
export const integrationResultLabels = {
  NO_STOCK_EFFECT: "ไม่มีผลกระทบต่อสต็อก",
  READY_TO_PREVIEW: "พร้อมแสดงตัวอย่างเท่านั้น",
  BLOCKED: "ไม่สามารถจำลองรายการนี้ได้",
  DESIGN_PENDING: "ยังต้องกำหนดเงื่อนไขการเชื่อมต่อ",
} as const;
type PreviewData = Readonly<{
  sourceReference: SourceDocumentReference;
  proposedEffect: ProposedStockEffect;
  postingSupported: false;
  warnings: readonly string[];
}>;
export type PreviewPosition = Readonly<{
  position: InventoryReference;
  before: string;
  delta: string;
  after: string;
}>;
export type IntegrationPreviewResult = PreviewData &
  (
    | Readonly<{
        state: "READY_TO_PREVIEW";
        positions: readonly PreviewPosition[];
        proposedPostings: readonly StockPosting[];
        blockingReasons: readonly [];
      }>
    | Readonly<{
        state: "NO_STOCK_EFFECT" | "BLOCKED" | "DESIGN_PENDING";
        positions: readonly [];
        proposedPostings: readonly [];
        blockingReasons: readonly string[];
      }>
  );
