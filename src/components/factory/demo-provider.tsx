"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  productionOrders,
  products,
  deliveryOrders,
  invoices,
  type ProductionOrder,
  type Product,
  type SalesDocument,
} from "@/src/lib/mock-data";
interface DemoState {
  orders: ProductionOrder[];
  products: Product[];
  deliveries: SalesDocument[];
  invoices: SalesDocument[];
  updateOrder: (id: string, patch: Partial<ProductionOrder>) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  updateDocument: (
    kind: "delivery" | "invoice",
    id: string,
    patch: Partial<SalesDocument>,
  ) => void;
}
const DemoContext = createContext<DemoState | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState(productionOrders);
  const [productRows, setProducts] = useState(products);
  const [deliveries, setDeliveries] = useState(deliveryOrders);
  const [invoiceRows, setInvoices] = useState(invoices);
  return (
    <DemoContext.Provider
      value={{
        orders,
        products: productRows,
        deliveries,
        invoices: invoiceRows,
        updateOrder: (id, patch) =>
          setOrders((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          ),
        updateProduct: (id, patch) =>
          setProducts((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          ),
        updateDocument: (kind, id, patch) =>
          (kind === "delivery" ? setDeliveries : setInvoices)((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
          ),
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const state = useContext(DemoContext);
  if (!state) throw new Error("DemoProvider is required");
  return state;
}
