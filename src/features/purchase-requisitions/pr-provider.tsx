"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import type { AuditEntry } from "@/src/lib/mock-data/audit-log";
import type { PR, PRAction } from "./pr-domain";
import type { PurchaseOrder, PoAction } from "../purchase-orders/po-domain";

type User = { id: string; displayName: string; modules: readonly string[] };
type Snapshot = {
  prs: PR[];
  pos: PurchaseOrder[];
  references: Pick<PR, "id" | "number" | "warehouseCode" | "neededDate" | "items">[];
  audit: AuditEntry[];
  canApprove: boolean;
};
const empty: Snapshot = { prs: [], pos: [], references: [], audit: [], canApprove: false };

function usePurchasing(user: User) {
  const enabled = ["pr", "purchase_orders", "audit_log"].some((module) => user.modules.includes(module));
  const [data, setData] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(enabled);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const pending = useRef(false);

  async function request(payload?: Record<string, unknown>, signal?: AbortSignal) {
    const response = await fetch("/api/purchasing", {
      cache: "no-store", signal,
      ...(payload && {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
        body: JSON.stringify(payload),
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.message || "เชื่อมต่อระบบจัดซื้อไม่สำเร็จ");
    return result as Snapshot & { createdId?: string };
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    request(undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((error) => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, reload]);

  async function command(kind: "pr" | "po", action: string, fields: Record<string, unknown>) {
    if (loading || loadError || pending.current) throw new Error(loadError || "กำลังดำเนินการ กรุณารอสักครู่");
    pending.current = true;
    try {
      const result = await request({ ...fields, kind, action });
      setData(result);
      return result.createdId ?? "";
    } finally { pending.current = false; }
  }
  return {
    ...data, user, records: data.prs, loading, loadError,
    retry: () => { setLoading(true); setLoadError(""); setReload((count) => count + 1); },
    create: (draft: PR, submit = false) => command("pr", "create", { draft, submit }),
    save: (draft: PR, submit = false) => command("pr", "save", { draft, submit }),
    act: (id: string, action: PRAction, note?: string) => command("pr", action, { ids: [id], note }),
    remove: (id: string) => command("pr", "delete", { ids: [id] }),
    copy: (id: string) => command("pr", "copy", { ids: [id] }),
    batch: (ids: string[], action: PRAction, note?: string) => command("pr", action, { ids, note }),
    savePO: (draft: PurchaseOrder, submit: boolean) => command("po", "save", { draft, submit }),
    actPO: (ids: string[], action: PoAction) => command("po", action, { ids }),
  };
}

const PRContext = createContext<ReturnType<typeof usePurchasing> | null>(null);

export function PRProvider({ children, user }: { children: ReactNode; user: User }) {
  const value = usePurchasing(user);
  return <PRContext.Provider value={value}>{children}</PRContext.Provider>;
}

export function usePR() {
  const value = useContext(PRContext);
  if (!value) throw new Error("PRProvider is required");
  return value;
}
