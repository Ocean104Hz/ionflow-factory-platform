import { inventoryStatuses } from "./inventory-domain";
import {
  replayLedger,
  stockKey,
  type LedgerContext,
  type StockLedgerEvent,
  type StockPosting,
} from "./inventory-ledger-domain";
import { operationLocations } from "./inventory-operations-domain";
import { quantityDecimal, quantityUnits } from "./inventory-quantity";
import {
  sourceDocumentTypes,
  type IntegrationScenario,
  type SourceDocumentReference,
  type KnownSourceAction,
  type IntegrationPreviewResult,
  type PreviewPosition,
} from "./inventory-integration-contracts";

export function integrationSourceKey(source: SourceDocumentReference) {
  return JSON.stringify([
    "inventory-source-v1",
    source.workspaceId,
    source.sourceApplication,
    source.sourceDocumentType,
    source.sourceDocumentId,
    source.sourceLineId ?? null,
    source.businessMilestone,
    source.sourceRevision ?? null,
  ]);
}
export function integrationLedgerVersion(events: readonly StockLedgerEvent[]) {
  return JSON.stringify(
    events.map((event) => [
      event.id,
      event.postedAt,
      event.order,
      event.postings.map((posting) => [
        stockKey(posting),
        posting.quantityDelta,
      ]),
    ]),
  );
}
export function integrationPayloadFingerprint(scenario: IntegrationScenario) {
  const intent = scenario.intent;
  const effect =
    "position" in intent
      ? [
          intent.effectType,
          stockKey(intent.position),
          intent.position.unit,
          quantityDecimal(quantityUnits(intent.quantity)),
          intent.effectType === "QC_STATUS_CHANGE"
            ? intent.destinationStatus
            : null,
        ]
      : [intent.effectType, intent.reason];
  return JSON.stringify([
    integrationSourceKey(scenario.sourceReference),
    scenario.evidence,
    scenario.physicalMovementId ?? null,
    effect,
  ]);
}
const allowedEffects = {
  RECEIVING: ["RECEIPT_CONFIRMED", "RECEIPT"],
  MATERIAL_ISSUE: ["ISSUE_CONFIRMED", "ISSUE"],
  RAW_QC: ["QC_DISPOSITION_CONFIRMED", "QC_STATUS_CHANGE"],
  PRODUCTION_RECEIPT: ["OUTPUT_CONFIRMED", "RECEIPT"],
  DELIVERY: ["DISPATCH_CONFIRMED", "ISSUE"],
  PACKING: ["CONVERSION_REQUESTED", "MANUFACTURING_CONVERSION"],
} as const;
const noEffectModules = [
  "PR",
  "PO",
  "BOM",
  "MIXING",
  "PRODUCTION_ORDER",
  "INVOICE",
];

// Pure projection only: no operation commands, event append, provider writes or saved preview cache.
export function previewInventoryIntegration(
  scenario: IntegrationScenario,
  events: readonly StockLedgerEvent[],
  context: LedgerContext,
  knownActions: readonly KnownSourceAction[] = [],
): IntegrationPreviewResult {
  const source = scenario.sourceReference;
  const intent = scenario.intent;
  const idempotencyKey = integrationSourceKey(source);
  const proposedEffect = { ...intent, sourceReference: source, idempotencyKey };
  const warnings = [
    "MOCK PREVIEW · ไม่บันทึก Stock Ledger และไม่ใช่การอนุมัติหรือสิทธิ์ทำรายการจริง",
  ];
  const stop = (
    state: "NO_STOCK_EFFECT" | "BLOCKED" | "DESIGN_PENDING",
    ...reasons: string[]
  ): IntegrationPreviewResult => ({
    state,
    sourceReference: source,
    proposedEffect,
    postingSupported: false,
    warnings:
      state === "NO_STOCK_EFFECT" ? [...warnings, ...reasons] : warnings,
    blockingReasons: state === "NO_STOCK_EFFECT" ? [] : reasons,
    positions: [],
    proposedPostings: [],
  });
  try {
    if (
      ![
        source.workspaceId,
        source.sourceApplication,
        source.sourceDocumentId,
        source.sourceDocumentNumber,
      ].every((value) => typeof value === "string" && value.trim())
    )
      return stop(
        "BLOCKED",
        "ต้องระบุ workspace, application, ID และเลขเอกสารต้นทาง",
      );
    if (
      [
        source.workspaceId,
        source.sourceApplication,
        source.sourceDocumentId,
        source.sourceLineId,
        source.sourceRevision,
      ].some((value) => value !== undefined && value !== value.trim())
    )
      return stop("BLOCKED", "Stable identifiers ต้องไม่มีช่องว่างหน้า/ท้าย");
    if (
      !Object.hasOwn(sourceDocumentTypes, source.sourceModule) ||
      sourceDocumentTypes[source.sourceModule] !== source.sourceDocumentType
    )
      return stop("BLOCKED", "ชนิดเอกสารไม่ตรงกับโมดูลต้นทาง");
    if (source.sourceRevision !== undefined && !source.sourceRevision.trim())
      return stop("BLOCKED", "posting revision ต้องไม่ว่าง");
    if (
      ![
        "CREATED",
        "SAVED",
        "FORMULA_SELECTED",
        "RECEIPT_CONFIRMED",
        "ISSUE_CONFIRMED",
        "QC_DISPOSITION_CONFIRMED",
        "OUTPUT_CONFIRMED",
        "DISPATCH_CONFIRMED",
        "CONVERSION_REQUESTED",
      ].includes(source.businessMilestone) ||
      !["DOCUMENT_ONLY", "DRAFT", "HYPOTHETICAL_CONFIRMED"].includes(
        scenario.evidence,
      ) ||
      !scenario.sourceLifecycle?.trim()
    )
      return stop(
        "DESIGN_PENDING",
        "DECISION_PENDING: ยังไม่มี lifecycle หรือจุดยืนยันทางธุรกิจที่กำหนดไว้",
      );
    if (noEffectModules.includes(source.sourceModule)) {
      if (intent.effectType !== "NONE")
        return stop(
          "BLOCKED",
          "เอกสารวางแผน/การเงิน/หลักฐานการผลิตไม่มีสิทธิ์เป็นเจ้าของการตัดหรือรับสต็อก",
        );
      return stop("NO_STOCK_EFFECT", intent.reason);
    }
    if (
      scenario.evidence === "DRAFT" ||
      scenario.evidence === "DOCUMENT_ONLY"
    ) {
      if (intent.effectType !== "NONE")
        return stop(
          "BLOCKED",
          "เอกสารร่างหรือการบันทึกเอกสารไม่ใช่การเคลื่อนไหวสินค้าที่ยืนยันแล้ว",
        );
      return stop("NO_STOCK_EFFECT", intent.reason);
    }
    if (intent.effectType === "NONE")
      return stop("NO_STOCK_EFFECT", intent.reason);
    const policy =
      allowedEffects[source.sourceModule as keyof typeof allowedEffects];
    if (
      !policy ||
      policy[0] !== source.businessMilestone ||
      policy[1] !== intent.effectType
    )
      return stop(
        "DESIGN_PENDING",
        "DECISION_PENDING: โมดูล / milestone / ผลกระทบนี้ยังไม่มีสัญญาที่ตรงกัน",
      );
    if (intent.effectType === "MANUFACTURING_CONVERSION")
      return stop(
        "DESIGN_PENDING",
        "Packing ต้องมี specialized conversion contract: การใช้ WIP/บรรจุภัณฑ์และผลผลิตต่างสินค้า/ต่างหน่วย ไม่ใช่ transfer",
      );
    if (!source.sourceLineId?.trim())
      return stop(
        "BLOCKED",
        "ต้องมี source line / allocation ID คงที่สำหรับตำแหน่งสต็อก",
      );
    if (!scenario.physicalMovementId?.trim())
      return stop(
        "BLOCKED",
        "ยังไม่มี physical movement ID เพื่อป้องกันตัดซ้ำข้ามเอกสาร",
      );
    const fingerprint = integrationPayloadFingerprint(scenario);
    const scopedActions = knownActions.filter(
      (action) => action.workspaceId === source.workspaceId,
    );
    const known = scopedActions.find(
      (action) => action.idempotencyKey === idempotencyKey,
    );
    if (known)
      return stop(
        "BLOCKED",
        known.payloadFingerprint === fingerprint
          ? "DUPLICATE_ACTION: การกระทำต้นทางนี้มีในชุดอ้างอิงสาธิตแล้ว ห้ามนับซ้ำ"
          : "IDEMPOTENCY_CONFLICT: source key เดิมแต่ payload ต่างกัน ต้องตรวจสอบ ไม่สร้างรายการใหม่",
      );
    if (
      scopedActions.some(
        (action) => action.physicalMovementId === scenario.physicalMovementId,
      )
    )
      return stop(
        "BLOCKED",
        "DUPLICATE_MOVEMENT: เอกสารอื่นอ้างถึงการเคลื่อนไหวเดียวกัน ต้องใช้เจ้าของ posting เพียงรายเดียว",
      );
    const projection = replayLedger(events, context);
    if (!projection.ok)
      return stop(
        "BLOCKED",
        ...projection.errors.map((error) => error.message),
      );
    if (!projection.supportedFrom)
      return stop(
        "BLOCKED",
        "ยังไม่มี Ledger ยอดตั้งต้น ไม่สามารถยืนยันยอดก่อนทำรายการ",
      );
    if (
      scenario.expectedLedgerVersion !== undefined &&
      scenario.expectedLedgerVersion !== integrationLedgerVersion(events)
    )
      return stop(
        "BLOCKED",
        "STALE_PROJECTION: ยอดอ้างอิงเปลี่ยนแล้ว ต้องอ่านยอดล่าสุดและตรวจใหม่",
      );
    const position = intent.position;
    const item = context.items.find((item) => item.id === position.itemId);
    const warehouse = context.warehouses.find(
      (warehouse) => warehouse.id === position.warehouseId,
    );
    const reasons: string[] = [];
    if (!item)
      reasons.push(
        "ยังไม่มี mapping ไป Inventory Item ID ที่ถูกต้อง (ห้ามเดาจาก SKU หรือชื่อ)",
      );
    if (
      !warehouse ||
      !context.sites.some((site) => site.id === position.siteId) ||
      warehouse.siteId !== position.siteId
    )
      reasons.push("คลัง / Site อ้างอิงไม่ถูกต้องหรืออยู่คนละโรงงาน");
    if (
      !operationLocations(context, position.warehouseId).includes(
        position.locationLabel,
      )
    )
      reasons.push("ไม่พบตำแหน่งจัดเก็บในคลังที่เลือก");
    if (
      !position.lotCode?.trim() ||
      position.lotCode !== position.lotCode.trim()
    )
      reasons.push("ต้องระบุ Lot ให้ชัดเจน ไม่มีช่องว่างหน้า/ท้าย");
    if (!Object.hasOwn(inventoryStatuses, position.inventoryStatus))
      reasons.push("สถานะคงคลังไม่ถูกต้อง");
    if (item && position.unit !== item.baseUnit)
      reasons.push("หน่วยไม่ตรงกับ base unit ไม่มีการแปลงหน่วยอัตโนมัติ");
    const amount = quantityUnits(intent.quantity);
    if (amount <= BigInt(0))
      reasons.push("จำนวนต้องมากกว่าศูนย์และทศนิยมไม่เกิน 6 ตำแหน่ง");
    if (
      source.sourceModule === "PRODUCTION_RECEIPT" &&
      item?.itemType !== "WIP" &&
      item?.itemType !== "FG"
    )
      reasons.push("รับยอดผลิตตัวอย่างรองรับผลผลิต WIP/FG เท่านั้น");
    if (source.sourceModule === "DELIVERY" && item?.itemType !== "FG")
      reasons.push(
        "การจ่ายตาม dispatch ตัวอย่างต้องมี mapping สินค้าสำเร็จรูป FG",
      );
    if (
      intent.effectType === "ISSUE" &&
      position.inventoryStatus !== "AVAILABLE"
    )
      reasons.push("เบิก/จ่ายได้เฉพาะ AVAILABLE ไม่ใช่ QC_HOLD หรือ BLOCKED");
    if (
      intent.effectType === "QC_STATUS_CHANGE" &&
      (position.inventoryStatus !== "QC_HOLD" ||
        !["AVAILABLE", "BLOCKED"].includes(intent.destinationStatus))
    )
      reasons.push(
        "QC disposition ต้องย้าย QC_HOLD ไป AVAILABLE หรือ BLOCKED โดยคงยอดรวม",
      );
    const sourceBalance = projection.balances.find(
      (balance) => stockKey(balance) === stockKey(position),
    );
    if (intent.effectType !== "RECEIPT" && !sourceBalance)
      reasons.push("ไม่พบตำแหน่ง / Lot ต้นทางที่อ้างอิง");
    if (
      intent.effectType !== "RECEIPT" &&
      quantityUnits(sourceBalance?.onHandQty ?? 0) < amount
    )
      reasons.push("ยอดคงเหลือไม่เพียงพอสำหรับรายการที่เสนอ");
    if (reasons.length) return stop("BLOCKED", ...reasons);
    const positions: PreviewPosition[] = [];
    const add = (reference: typeof position, delta: bigint) => {
      const before = quantityUnits(
        projection.balances.find(
          (balance) => stockKey(balance) === stockKey(reference),
        )?.onHandQty ?? 0,
      );
      const after = before + delta;
      if (after < BigInt(0)) throw new Error("ยอดหลังจำลองต้องไม่ติดลบ");
      positions.push({
        position: { ...reference },
        before: quantityDecimal(before),
        delta: quantityDecimal(delta),
        after: quantityDecimal(after),
      });
    };
    add(position, intent.effectType === "RECEIPT" ? amount : -amount);
    if (intent.effectType === "QC_STATUS_CHANGE")
      add({ ...position, inventoryStatus: intent.destinationStatus }, amount);
    const proposedPostings: StockPosting[] = positions.map((row, index) => ({
      ...row.position,
      id: `preview-only:${idempotencyKey}:${index}`,
      quantityDelta: row.delta,
    }));
    warnings.push(
      "อ้างอิงยอด Ledger ล่าสุดในเซสชันนี้เท่านั้น ระบบจริงต้องตรวจซ้ำใน transaction พร้อมสิทธิ์และหลักฐานที่ยืนยันแล้ว",
    );
    warnings.push(
      "Milestone ที่ยืนยันในตัวอย่างเป็นสมมติ ไม่ได้เพิ่ม lifecycle นี้ให้โมดูลจริง",
    );
    return {
      state: "READY_TO_PREVIEW",
      sourceReference: source,
      proposedEffect,
      postingSupported: false,
      positions,
      proposedPostings,
      blockingReasons: [],
      warnings,
    };
  } catch (error) {
    return stop(
      "BLOCKED",
      error instanceof Error ? error.message : "ข้อมูลตัวอย่างไม่ถูกต้อง",
    );
  }
}
