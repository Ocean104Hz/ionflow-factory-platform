"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useBOM } from "@/src/features/bom/bom-provider";
import {
  deleteBulkOrder,
  saveBulkOrder,
  type BulkErrors,
  type BulkOrder,
} from "@/src/features/bulk-production-orders/bulk-production-domain";
import { useInventoryOperations } from "@/src/features/inventory/inventory-operations-provider";
import { ledgerContext } from "@/src/features/inventory/inventory-ledger-data";
import {
  operationLocations,
} from "@/src/features/inventory/inventory-operations-domain";
import { bulkOrders } from "@/src/lib/mock-data/bulk-production-orders";
import {
  issueFormulaSheet,
  newProductionReceipt,
  newProductionReport,
  nextProductionDocument,
  productionOrderProgress,
  saveProductionReceipt,
  saveProductionReport,
  type ProductionFlowErrors,
  type ProductionFormulaSheet,
  type ProductionReceipt,
  type ProductionReport,
} from "./production-flow-domain";

type Context = {
  orders: BulkOrder[];
  formulaSheets: ProductionFormulaSheet[];
  reports: ProductionReport[];
  receipts: ProductionReceipt[];
  saveOrder: (order: BulkOrder) => {
    saved?: BulkOrder;
    errors: BulkErrors;
  };
  removeOrder: (id: string) => void;
  issueFormula: (orderId: string) => ProductionFormulaSheet;
  orderProgress: (order: BulkOrder) => ReturnType<typeof productionOrderProgress>;
  createReport: (orderId: string, orderLineId: string) => ProductionReport;
  saveReport: (report: ProductionReport) => {
    saved?: ProductionReport;
    errors: ProductionFlowErrors;
  };
  createReceipt: (reportId: string) => ProductionReceipt;
  saveReceipt: (receipt: ProductionReceipt) => {
    saved?: ProductionReceipt;
    errors: ProductionFlowErrors;
  };
  confirmReceipt: (receipt: ProductionReceipt) => {
    saved?: ProductionReceipt;
    errors: ProductionFlowErrors;
    duplicate?: boolean;
  };
};

const ProductionFlowContext = createContext<Context | null>(null);

export function ProductionFlowProvider({ children }: { children: ReactNode }) {
  const bom = useBOM();
  const inventory = useInventoryOperations();
  const [orders, setOrders] = useState(() => structuredClone(bulkOrders));
  const [formulaSheets, setFormulaSheets] = useState<ProductionFormulaSheet[]>([]);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [receipts, setReceipts] = useState<ProductionReceipt[]>([]);
  const current = useRef({ orders, formulaSheets, reports, receipts });
  const replace = <K extends keyof typeof current.current>(
    key: K,
    value: (typeof current.current)[K],
  ) => {
    current.current[key] = value;
    if (key === "orders") setOrders(value as BulkOrder[]);
    if (key === "formulaSheets") setFormulaSheets(value as ProductionFormulaSheet[]);
    if (key === "reports") setReports(value as ProductionReport[]);
    if (key === "receipts") setReceipts(value as ProductionReceipt[]);
  };
  return (
    <ProductionFlowContext.Provider
      value={{
        orders,
        formulaSheets,
        reports,
        receipts,
        saveOrder(order) {
          const original = current.current.orders.find((row) => row.id === order.id);
          if (
            original &&
            current.current.formulaSheets.some((sheet) => sheet.orderId === order.id) &&
            JSON.stringify(original) !== JSON.stringify(order)
          )
            return {
              errors: {
                document:
                  "ใบสั่งผลิตถูกออกใบสูตรแล้วและถูกล็อก กรุณาสร้างใบสั่งผลิตใหม่เมื่อต้องเปลี่ยนสูตรหรือจำนวน",
              },
            };
          const result = saveBulkOrder(
            current.current.orders,
            order,
            crypto.randomUUID(),
            new Date().toISOString(),
          );
          if (result.saved) replace("orders", result.records);
          return { saved: result.saved, errors: result.errors };
        },
        removeOrder(id) {
          if (
            current.current.formulaSheets.some((sheet) => sheet.orderId === id) ||
            current.current.reports.some((report) => report.orderId === id)
          )
            throw new Error("ลบใบสั่งผลิตไม่ได้ เพราะมีใบสูตรหรือรายงานอ้างอิงแล้ว");
          replace("orders", deleteBulkOrder(current.current.orders, id));
        },
        issueFormula(orderId) {
          const existing = current.current.formulaSheets.find(
            (sheet) => sheet.orderId === orderId,
          );
          if (existing) return existing;
          const order = current.current.orders.find((row) => row.id === orderId);
          if (!order) throw new Error("ไม่พบใบสั่งผลิต");
          const sheet = issueFormulaSheet(
            order,
            bom.state,
            crypto.randomUUID(),
            new Date().toISOString(),
          );
          replace("formulaSheets", [sheet, ...current.current.formulaSheets]);
          return sheet;
        },
        orderProgress(order) {
          return productionOrderProgress(order, current.current.reports);
        },
        createReport(orderId, orderLineId) {
          const sheet = current.current.formulaSheets.find(
            (candidate) => candidate.orderId === orderId,
          );
          if (!sheet) throw new Error("กรุณาออกใบสูตรผลิตจากใบสั่งผลิตก่อน");
          return newProductionReport(
            sheet,
            orderLineId,
            nextProductionDocument(current.current.reports, "PRD"),
          );
        },
        saveReport(report) {
          try {
            const result = saveProductionReport(
              current.current.reports,
              current.current.receipts,
              report,
              current.current.formulaSheets,
              crypto.randomUUID(),
              new Date().toISOString(),
            );
            if (result.saved) replace("reports", result.records);
            return result;
          } catch (error) {
            return {
              errors: {
                form: error instanceof Error ? error.message : "บันทึกรายงานไม่ได้",
              },
            };
          }
        },
        createReceipt(reportId) {
          const report = current.current.reports.find((row) => row.id === reportId);
          const sheet = current.current.formulaSheets.find(
            (row) => row.id === report?.formulaSheetId,
          );
          const line = sheet?.lines.find(
            (row) => row.orderLineId === report?.orderLineId,
          );
          const item = ledgerContext.items.find((row) => row.id === line?.inventoryItemId);
          const site = ledgerContext.sites[0];
          const warehouse = ledgerContext.warehouses.find(
            (row) => row.siteId === site?.id,
          );
          const location = warehouse
            ? operationLocations(ledgerContext, warehouse.id)[0]
            : undefined;
          if (!report || !sheet || !item || !site || !warehouse || !location)
            throw new Error("ข้อมูลรายงาน สินค้า หรือปลายทางคลังยังไม่ครบ");
          return newProductionReceipt(
            report,
            sheet,
            item,
            nextProductionDocument(
              [
                ...current.current.receipts,
                ...inventory.events.map((event) => ({
                  documentNumber: event.documentNo,
                })),
              ],
              "RCV",
            ),
            site.id,
            warehouse.id,
            location,
          );
        },
        saveReceipt(receipt) {
          try {
            const locations = operationLocations(ledgerContext, receipt.warehouseId);
            const result = saveProductionReceipt(
              current.current.receipts,
              { ...receipt, status: "DRAFT" },
              current.current.reports,
              ledgerContext.items,
              ledgerContext.sites,
              ledgerContext.warehouses,
              locations,
              crypto.randomUUID(),
              new Date().toISOString(),
            );
            if (result.saved) replace("receipts", result.records);
            return result;
          } catch (error) {
            return {
              errors: {
                form: error instanceof Error ? error.message : "บันทึกใบรับยอดไม่ได้",
              },
            };
          }
        },
        confirmReceipt(receipt) {
          const existingConfirmed = current.current.receipts.find(
            (row) => row.id === receipt.id && row.status === "CONFIRMED",
          );
          if (existingConfirmed)
            return { saved: existingConfirmed, errors: {}, duplicate: true };
          const now = new Date().toISOString();
          const locations = operationLocations(ledgerContext, receipt.warehouseId);
          const result = saveProductionReceipt(
            current.current.receipts,
            { ...receipt, status: "DRAFT" },
            current.current.reports,
            ledgerContext.items,
            ledgerContext.sites,
            ledgerContext.warehouses,
            locations,
            receipt.id || crypto.randomUUID(),
            now,
          );
          if (!result.saved) return result;
          const saved = result.saved;
          const stock = inventory.commit({
            type: "RECEIVE",
            operationId: `production-receipt:${saved.id}`,
            documentNo: saved.documentNumber,
            postedAt: now,
            actor: "ผู้ใช้งานสาธิต",
            note: saved.note || `รับยอดผลิตจาก ${saved.reportId}`,
            destination: {
              itemId: saved.itemId,
              siteId: saved.siteId,
              warehouseId: saved.warehouseId,
              locationLabel: saved.locationLabel,
              lotCode: saved.lotCode,
              inventoryStatus: saved.inventoryStatus,
              unit: saved.unit,
            },
            quantity: saved.quantity,
          });
          if (!stock.ok) return { errors: stock.errors };
          const confirmed: ProductionReceipt = {
            ...saved,
            status: "CONFIRMED",
            ledgerEventId: stock.event.id,
            confirmedAt: now,
            updatedAt: now,
          };
          replace(
            "receipts",
            result.records.map((row) => (row.id === confirmed.id ? confirmed : row)),
          );
          return { saved: confirmed, errors: {}, duplicate: stock.duplicate };
        },
      }}
    >
      {children}
    </ProductionFlowContext.Provider>
  );
}

export function useProductionFlow() {
  const context = useContext(ProductionFlowContext);
  if (!context) throw new Error("ProductionFlowProvider is required");
  return context;
}
