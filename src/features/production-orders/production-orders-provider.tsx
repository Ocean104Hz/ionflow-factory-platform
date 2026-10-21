"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ProductionOrder } from "@/src/lib/mock-data";
import type { ProductionSnapshot } from "@/src/server/production-orders-postgres";

const initial: ProductionSnapshot = { orders: [], versions: {}, history: {} };
type Context = ProductionSnapshot & { loading: boolean; busy: boolean; error: string; refresh: () => void; save: (order: ProductionOrder, expectedVersion?: string | null) => Promise<void>; updateOrder: (id: string, patch: Partial<ProductionOrder>, description?: string) => Promise<void>; remove: (id: string) => Promise<void> };
const ProductionContext = createContext<Context | null>(null);
export function ProductionOrdersProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initial);
  const current = useRef(data);
  const locked = useRef(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  async function request(method = "GET", body?: unknown): Promise<ProductionSnapshot> {
    let response: Response;
    try { response = await fetch("http://127.0.0.1:4318/orders", { method, cache: "no-store", credentials: "omit", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) }); }
    catch { throw Error("เชื่อมต่อ Local Production Orders API ไม่ได้"); }
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw Error(result.error || "Production Orders PostgreSQL ไม่พร้อมใช้งาน");
    if (!Array.isArray(result.data?.orders) || !result.data.versions || !result.data.history) throw Error("ข้อมูลตอบกลับไม่ถูกต้อง");
    return result.data;
  }
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    request().then((next) => { if (active) { current.current = next; setData(next); } })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่ได้"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  async function mutate(method: string, body: unknown) {
    if (locked.current) throw Error("กำลังบันทึก กรุณารอ");
    locked.current = true; setBusy(true); setError("");
    try { const next = await request(method, body); current.current = next; setData(next); }
    catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่ได้"); throw e; }
    finally { locked.current = false; setBusy(false); }
  }
  const save = (order: ProductionOrder, expectedVersion: string | null = current.current.versions[order.id] ?? null) => mutate("POST", { order, expectedVersion });
  return <ProductionContext.Provider value={{ ...data, loading, busy, error, refresh: () => setRevision((n) => n + 1), save,
    updateOrder: async (id, patch, description) => { const old = current.current.orders.find((r) => r.id === id); if (!old) throw Error("ไม่พบเอกสาร"); await mutate("POST", { order: { ...old, ...patch }, expectedVersion: current.current.versions[id], description }); },
    remove: (id) => mutate("DELETE", { id, expectedVersion: current.current.versions[id] }),
  }}>{children}</ProductionContext.Provider>;
}
export function useProductionOrders() { const context = useContext(ProductionContext); if (!context) throw Error("ProductionOrdersProvider required"); return context; }
