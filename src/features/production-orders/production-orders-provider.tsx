"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ProductionOrder } from "@/src/lib/mock-data";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
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
  async function request(method = "GET", body?: unknown, hub = false): Promise<ProductionSnapshot> {
    let response: Response;
    try { response = await fetch(hub ? "/api/sales-hub/orders" : "http://127.0.0.1:4318/orders", { method, cache: "no-store", credentials: hub ? "same-origin" : "omit", headers: body ? { "Content-Type": "application/json", ...(hub ? { "x-csrf-token": await readFactoryCsrfToken() } : {}) } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) }); }
    catch { throw Error(hub ? "เชื่อมข้อมูลคำสั่งผลิตจาก Sales Hub ไม่สำเร็จ" : "เชื่อมต่อ Local Production Orders API ไม่ได้"); }
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw Error(result.error || "Production Orders PostgreSQL ไม่พร้อมใช้งาน");
    if (!Array.isArray(result.data?.orders) || !result.data.versions || !result.data.history) throw Error("ข้อมูลตอบกลับไม่ถูกต้อง");
    return result.data;
  }
  function combine(hub: ProductionSnapshot, local: ProductionSnapshot): ProductionSnapshot {
    return {
      orders: [...hub.orders, ...local.orders.filter((order) => !hub.versions[order.id])],
      versions: { ...local.versions, ...hub.versions },
      history: { ...local.history, ...hub.history },
    };
  }
  async function loadOrders() {
    const [hub, local] = await Promise.all([
      request("GET", undefined, true),
      process.env.NODE_ENV === "development" ? request().catch(() => initial) : initial,
    ]);
    return combine(hub, local);
  }
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    loadOrders().then((next) => { if (active) { current.current = next; setData(next); } })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่ได้"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  async function mutate(method: string, body: unknown, hub = false) {
    if (locked.current) throw Error("กำลังบันทึก กรุณารอ");
    locked.current = true; setBusy(true); setError("");
    try { await request(method, body, hub); const next = await loadOrders(); current.current = next; setData(next); }
    catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่ได้"); throw e; }
    finally { locked.current = false; setBusy(false); }
  }
  const save = (order: ProductionOrder, expectedVersion: string | null = current.current.versions[order.id] ?? null) => mutate("POST", { order, expectedVersion });
  return <ProductionContext.Provider value={{ ...data, loading, busy, error, refresh: () => setRevision((n) => n + 1), save,
    updateOrder: async (id, patch, description) => {
      const old = current.current.orders.find((row) => row.id === id);
      if (!old) throw Error("ไม่พบเอกสาร");
      const expectedVersion = current.current.versions[id];
      if (expectedVersion?.startsWith("hub:")) {
        await mutate("POST", { id, expectedVersion, status: patch.material ?? patch.approval ?? patch.production, reason: description?.split(": ").slice(1).join(": ") }, true);
      } else await mutate("POST", { order: { ...old, ...patch }, expectedVersion, description });
    },
    remove: (id) => mutate("DELETE", { id, expectedVersion: current.current.versions[id] }),
  }}>{children}</ProductionContext.Provider>;
}
export function useProductionOrders() { const context = useContext(ProductionContext); if (!context) throw Error("ProductionOrdersProvider required"); return context; }
