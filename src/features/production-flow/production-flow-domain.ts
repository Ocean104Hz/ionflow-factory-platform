import type { BOMState } from "@/src/features/bom/bom-domain";
import type {
  BulkOrder,
  BulkRow,
} from "@/src/features/bulk-production-orders/bulk-production-domain";
import type {
  InventoryItem,
  InventorySite,
  InventoryStatus,
  InventoryWarehouse,
} from "@/src/features/inventory/inventory-domain";

export type FormulaMaterialSnapshot = {
  materialId: string;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  remarks: string;
};

export type FormulaLineSnapshot = {
  orderLineId: string;
  inventoryItemId: string;
  productCode: string;
  productName: string;
  lot: string;
  plannedQuantity: number;
  plannedUnit: string;
  formulaId: string;
  formulaCode: string;
  formulaName: string;
  formulaVersion: string;
  batchSize: number;
  batchUnit: string;
  batchCount: number;
  ingredients: FormulaMaterialSnapshot[];
  packaging: FormulaMaterialSnapshot[];
};

export type ProductionFormulaSheet = {
  id: string;
  orderId: string;
  orderNumber: string;
  orderDate: string;
  issuedAt: string;
  issuedBy: string;
  lines: FormulaLineSnapshot[];
};

export type ProductionMaterialActual = FormulaMaterialSnapshot & {
  actualQuantity: number | null;
};

export type ProductionReport = {
  id: string;
  documentNumber: string;
  formulaSheetId: string;
  orderId: string;
  orderLineId: string;
  reportDate: string;
  shift: string;
  productionLine: string;
  startTime: string;
  endTime: string;
  goodQuantity: number | null;
  wasteQuantity: number | null;
  unit: string;
  operator: string;
  note: string;
  status: "DRAFT" | "RECORDED";
  materials: ProductionMaterialActual[];
  createdAt: string;
  updatedAt: string;
};

export type ProductionReceipt = {
  id: string;
  documentNumber: string;
  reportId: string;
  orderId: string;
  orderLineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  lotCode: string;
  quantity: string;
  unit: string;
  siteId: string;
  warehouseId: string;
  locationLabel: string;
  inventoryStatus: InventoryStatus;
  note: string;
  status: "DRAFT" | "CONFIRMED";
  ledgerEventId: string;
  confirmedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductionFlowErrors = Record<string, string>;

const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const exactQuantity = (value: string) => /^\d+(?:\.\d{1,6})?$/.test(value.trim());

function outputKilograms(row: BulkRow) {
  if (row.qtyUnit === "ตัน") return (row.qty ?? 0) * 1000;
  return (row.qty ?? 0) * (row.size ?? 0);
}

export function issueFormulaSheet(
  order: BulkOrder,
  bom: BOMState,
  id: string,
  at: string,
): ProductionFormulaSheet {
  if (!order.id || !order.rows.length)
    throw new Error("ต้องบันทึกใบสั่งผลิตที่มีรายการก่อนออกใบสูตรผลิต");
  const lines = order.rows.map((row) => {
    const formula = bom.formulas.find(
      (candidate) => candidate.id === row.formulaId,
    );
    if (!formula || formula.status !== "ACTIVE")
      throw new Error(`รายการ ${row.productCode || row.product} ไม่มีสูตร Active ที่อ้างอิงได้`);
    const master = bom.masters.find((candidate) => candidate.id === formula.masterId);
    if (!master)
      throw new Error(`ไม่พบสินค้าต้นทางของสูตร ${formula.version}`);
    if (!row.inventoryItemId)
      throw new Error(`รายการ ${row.productCode || row.product} ยังไม่ได้ผูกสินค้า Inventory`);
    const batchCount = outputKilograms(row) / formula.batchSize;
    const materials = (components: typeof formula.ingredients) =>
      components.map((component) => {
        const material = bom.masters.find(
          (candidate) => candidate.id === component.materialId,
        );
        if (!material)
          throw new Error(`สูตร ${formula.version} อ้างวัตถุดิบที่ไม่พบ`);
        return {
          materialId: component.materialId,
          code: material.code,
          name: material.name,
          unit: component.unit,
          quantity: component.quantity * batchCount,
          remarks: component.remarks,
        };
      });
    return {
      orderLineId: row.id,
      inventoryItemId: row.inventoryItemId,
      productCode: row.productCode,
      productName: row.product,
      lot: row.lot,
      plannedQuantity: row.qty ?? 0,
      plannedUnit: row.qtyUnit,
      formulaId: formula.id,
      formulaCode: formula.code,
      formulaName: formula.name,
      formulaVersion: formula.version,
      batchSize: formula.batchSize,
      batchUnit: formula.unit,
      batchCount,
      ingredients: materials(formula.ingredients),
      packaging: materials(formula.packaging),
    };
  });
  return {
    id,
    orderId: order.id,
    orderNumber: order.header.docNo,
    orderDate: order.header.date,
    issuedAt: at,
    issuedBy: order.docSigners.issuer || "ผู้ใช้งานสาธิต",
    lines,
  };
}

export function nextProductionDocument(
  rows: readonly { documentNumber: string }[],
  prefix: string,
) {
  const used = new Set(rows.map((row) => row.documentNumber));
  let serial = 1;
  while (used.has(`${prefix}-${String(serial).padStart(6, "0")}`)) serial++;
  return `${prefix}-${String(serial).padStart(6, "0")}`;
}

export function newProductionReport(
  sheet: ProductionFormulaSheet,
  orderLineId: string,
  documentNumber: string,
): ProductionReport {
  const line = sheet.lines.find((candidate) => candidate.orderLineId === orderLineId);
  if (!line) throw new Error("ไม่พบรายการผลิตในใบสูตร");
  return {
    id: "",
    documentNumber,
    formulaSheetId: sheet.id,
    orderId: sheet.orderId,
    orderLineId,
    reportDate: "",
    shift: "",
    productionLine: "",
    startTime: "",
    endTime: "",
    goodQuantity: null,
    wasteQuantity: null,
    unit: line.plannedUnit,
    operator: "",
    note: "",
    status: "DRAFT",
    materials: line.ingredients.map((material) => ({
      ...structuredClone(material),
      actualQuantity: material.quantity,
    })),
    createdAt: "",
    updatedAt: "",
  };
}

export function productionReportErrors(
  report: ProductionReport,
  records: readonly ProductionReport[],
  sheets: readonly ProductionFormulaSheet[],
): ProductionFlowErrors {
  const errors: ProductionFlowErrors = {};
  const sheet = sheets.find((candidate) => candidate.id === report.formulaSheetId);
  const line = sheet?.lines.find(
    (candidate) => candidate.orderLineId === report.orderLineId,
  );
  if (!sheet || sheet.orderId !== report.orderId || !line)
    errors.source = "ไม่พบใบสูตรหรือรายการผลิตต้นทาง";
  if (!report.documentNumber.trim()) errors.documentNumber = "กรุณาระบุเลขที่เอกสาร";
  else if (
    records.some(
      (candidate) =>
        candidate.id !== report.id &&
        candidate.documentNumber.toLowerCase() === report.documentNumber.toLowerCase(),
    )
  )
    errors.documentNumber = "เลขที่รายงานซ้ำ";
  if (
    records.some(
      (candidate) =>
        candidate.id !== report.id && candidate.orderLineId === report.orderLineId,
    )
  )
    errors.source = "รายการใบสั่งผลิตนี้มีรายงานแล้ว กรุณาแก้ไขรายงานเดิม";
  if (report.status === "RECORDED") {
    for (const key of ["reportDate", "shift", "productionLine", "startTime", "endTime", "operator"] as const)
      if (!report[key].trim()) errors[key] = "กรุณาระบุข้อมูลนี้";
    if (report.goodQuantity === null || report.goodQuantity <= 0)
      errors.goodQuantity = "ยอดผลิตดีต้องมากกว่า 0";
  }
  if (report.reportDate && !validDate(report.reportDate))
    errors.reportDate = "วันที่รายงานไม่ถูกต้อง";
  for (const key of ["startTime", "endTime"] as const)
    if (report[key] && !validTime(report[key])) errors[key] = "เวลาไม่ถูกต้อง";
  for (const key of ["goodQuantity", "wasteQuantity"] as const) {
    const value = report[key];
    if (value !== null && (!Number.isFinite(value) || value < 0))
      errors[key] = "จำนวนต้องเป็นตัวเลขไม่ติดลบ";
  }
  if (line && (report.goodQuantity ?? 0) > line.plannedQuantity)
    errors.goodQuantity = "ยอดผลิตดีห้ามเกินจำนวนที่สั่งผลิต";
  if (line && report.unit !== line.plannedUnit)
    errors.unit = "หน่วยผลผลิตต้องตรงกับใบสั่งผลิต";
  const materialIds = new Set<string>();
  report.materials.forEach((material, index) => {
    const source = line?.ingredients.find(
      (candidate) => candidate.materialId === material.materialId,
    );
    if (!source || materialIds.has(material.materialId))
      errors[`materials.${index}`] = "วัตถุดิบไม่ตรงกับ snapshot สูตร";
    if (
      material.actualQuantity === null ||
      !Number.isFinite(material.actualQuantity) ||
      material.actualQuantity < 0
    )
      errors[`materials.${index}.actualQuantity`] = "จำนวนใช้จริงต้องไม่ติดลบ";
    materialIds.add(material.materialId);
  });
  if (line && report.materials.length !== line.ingredients.length)
    errors.materials = "รายการวัตถุดิบไม่ครบตาม snapshot สูตร";
  return errors;
}

export function saveProductionReport(
  records: readonly ProductionReport[],
  receipts: readonly ProductionReceipt[],
  report: ProductionReport,
  sheets: readonly ProductionFormulaSheet[],
  id: string,
  at: string,
) {
  const previous = records.find((candidate) => candidate.id === report.id);
  if (report.id && !previous) throw new Error("ไม่พบรายงานที่ต้องการแก้ไข");
  if (
    previous &&
    receipts.some(
      (receipt) => receipt.reportId === previous.id && receipt.status === "CONFIRMED",
    )
  )
    throw new Error("แก้รายงานไม่ได้ เนื่องจากมีการยืนยันรับยอดผลิตแล้ว");
  const errors = productionReportErrors(report, records, sheets);
  if (Object.keys(errors).length) return { records: [...records], errors };
  const saved = structuredClone({
    ...report,
    id: previous?.id || id,
    createdAt: previous?.createdAt || at,
    updatedAt: at,
  });
  return {
    records: previous
      ? records.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [saved, ...records],
    saved,
    errors: {},
  };
}

export function newProductionReceipt(
  report: ProductionReport,
  sheet: ProductionFormulaSheet,
  item: InventoryItem,
  documentNumber: string,
  siteId: string,
  warehouseId: string,
  locationLabel: string,
): ProductionReceipt {
  const line = sheet.lines.find(
    (candidate) => candidate.orderLineId === report.orderLineId,
  );
  if (!line || report.status !== "RECORDED")
    throw new Error("รายงานผลิตยังไม่พร้อมสำหรับรับยอด");
  return {
    id: "",
    documentNumber,
    reportId: report.id,
    orderId: report.orderId,
    orderLineId: report.orderLineId,
    itemId: item.id,
    itemCode: item.code,
    itemName: item.name,
    lotCode: line.lot,
    quantity: String(report.goodQuantity ?? ""),
    unit: report.unit,
    siteId,
    warehouseId,
    locationLabel,
    inventoryStatus: "AVAILABLE",
    note: "",
    status: "DRAFT",
    ledgerEventId: "",
    confirmedAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

export function productionReceiptErrors(
  receipt: ProductionReceipt,
  receipts: readonly ProductionReceipt[],
  reports: readonly ProductionReport[],
  items: readonly InventoryItem[],
  sites: readonly InventorySite[],
  warehouses: readonly InventoryWarehouse[],
  locations: readonly string[],
): ProductionFlowErrors {
  const errors: ProductionFlowErrors = {};
  const report = reports.find((candidate) => candidate.id === receipt.reportId);
  const item = items.find((candidate) => candidate.id === receipt.itemId);
  const warehouse = warehouses.find(
    (candidate) => candidate.id === receipt.warehouseId,
  );
  if (!report || report.status !== "RECORDED")
    errors.source = "ไม่พบรายงานผลิตที่บันทึกแล้ว";
  if (!item || !["WIP", "FG"].includes(item.itemType ?? ""))
    errors.itemId = "รับยอดผลิตได้เฉพาะสินค้า WIP/FG ที่ผูกไว้";
  if (item && (item.baseUnit !== receipt.unit || item.code !== receipt.itemCode))
    errors.itemId = "ข้อมูลสินค้า/หน่วยไม่ตรงกับทะเบียน Inventory";
  if (!receipt.documentNumber.trim()) errors.documentNumber = "ไม่พบเลขที่เอกสารรับ";
  else if (
    receipts.some(
      (candidate) =>
        candidate.id !== receipt.id &&
        candidate.documentNumber === receipt.documentNumber,
    )
  )
    errors.documentNumber = "เลขที่เอกสารรับซ้ำ";
  if (!receipt.lotCode.trim() || receipt.lotCode !== receipt.lotCode.trim())
    errors.lotCode = "กรุณาระบุ Lot โดยไม่มีช่องว่างหน้า/ท้าย";
  if (!exactQuantity(receipt.quantity) || Number(receipt.quantity) <= 0)
    errors.quantity = "จำนวนรับต้องมากกว่า 0 และทศนิยมไม่เกิน 6 ตำแหน่ง";
  const alreadyReceived = receipts
    .filter(
      (candidate) =>
        candidate.id !== receipt.id &&
        candidate.reportId === receipt.reportId &&
        candidate.status === "CONFIRMED",
    )
    .reduce((total, candidate) => total + Number(candidate.quantity), 0);
  if (
    report &&
    Number.isFinite(Number(receipt.quantity)) &&
    alreadyReceived + Number(receipt.quantity) > (report.goodQuantity ?? 0)
  )
    errors.quantity = "จำนวนรับรวมเกินยอดผลิตดีในรายงาน";
  if (!sites.some((candidate) => candidate.id === receipt.siteId))
    errors.siteId = "ไม่พบโรงงานที่เลือก";
  if (!warehouse || warehouse.siteId !== receipt.siteId)
    errors.warehouseId = "คลังสินค้าไม่อยู่ในโรงงานที่เลือก";
  if (!locations.includes(receipt.locationLabel))
    errors.locationLabel = "ไม่พบตำแหน่งจัดเก็บในคลังที่เลือก";
  if (!(["AVAILABLE", "QC_HOLD"] as const).includes(receipt.inventoryStatus as "AVAILABLE" | "QC_HOLD"))
    errors.inventoryStatus = "รับยอดได้เฉพาะสถานะผ่าน QC หรือกัก QC";
  return errors;
}

export function saveProductionReceipt(
  records: readonly ProductionReceipt[],
  receipt: ProductionReceipt,
  reports: readonly ProductionReport[],
  items: readonly InventoryItem[],
  sites: readonly InventorySite[],
  warehouses: readonly InventoryWarehouse[],
  locations: readonly string[],
  id: string,
  at: string,
) {
  const previous = records.find((candidate) => candidate.id === receipt.id);
  if (receipt.id && !previous) throw new Error("ไม่พบใบรับยอดที่ต้องการแก้ไข");
  if (previous?.status === "CONFIRMED")
    throw new Error("ใบรับที่ยืนยันแล้วแก้ไขไม่ได้ ให้ทำรายการกลับรายการแทน");
  const errors = productionReceiptErrors(
    receipt,
    records,
    reports,
    items,
    sites,
    warehouses,
    locations,
  );
  if (Object.keys(errors).length) return { records: [...records], errors };
  const saved = structuredClone({
    ...receipt,
    id: previous?.id || id,
    createdAt: previous?.createdAt || at,
    updatedAt: at,
  });
  return {
    records: previous
      ? records.map((candidate) => (candidate.id === saved.id ? saved : candidate))
      : [saved, ...records],
    saved,
    errors: {},
  };
}

export function receivedQuantity(
  reportId: string,
  receipts: readonly ProductionReceipt[],
) {
  return receipts
    .filter(
      (receipt) => receipt.reportId === reportId && receipt.status === "CONFIRMED",
    )
    .reduce((total, receipt) => total + Number(receipt.quantity), 0);
}

export function productionOrderProgress(
  order: BulkOrder,
  reports: readonly ProductionReport[],
) {
  const rows = order.rows.map((row) =>
    reports.find(
      (report) => report.orderId === order.id && report.orderLineId === row.id,
    ),
  );
  if (!rows.some(Boolean)) return "รอดำเนินการ" as const;
  if (rows.every((report) => report?.status === "RECORDED"))
    return "เสร็จสิ้น" as const;
  return "กำลังผลิต" as const;
}
