"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BOMState, Formula, Master } from "./bom-domain";
import { productionRequest } from "../production-flow/production-v1-client";

type Snapshot = { state: BOMState; savedId?: string };
function useProductionBom(enabled: boolean) {
  const [state, setState] = useState<BOMState>({ masters: [], formulas: [] });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const saving = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    productionRequest<Snapshot>("bom", undefined, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState(data.state); })
      .catch((error) => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [enabled, reload]);
  async function mutate(command: Record<string, unknown>) {
    if (saving.current) throw new Error("กำลังบันทึก กรุณารอสักครู่");
    saving.current = true;
    try {
      const result = await productionRequest<Snapshot>("bom", command);
      setState(result.state);
      return result.savedId ?? "";
    } finally { saving.current = false; }
  }
  return {
    state, loading, error,
    retry: () => { setLoading(true); setError(""); setReload((value) => value + 1); },
    saveMaster: (row: Master) => mutate({ action: "master", row }),
    saveFormula: (row: Formula, selected: boolean) => mutate({ action: "formula", row, default: selected }),
    setDefault: (masterId: string, formulaId: string | null) => mutate({ action: "default", masterId, formulaId }),
    removeMaster: (id: string) => mutate({ action: "delete-master", id }),
    removeFormula: (id: string) => mutate({ action: "delete-formula", id }),
  };
}

const BOMContext = createContext<ReturnType<typeof useProductionBom> | null>(null);
export function BOMProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const value = useProductionBom(enabled);
  return <BOMContext.Provider value={value}>{children}</BOMContext.Provider>;
}
export function useBOM() {
  const context = useContext(BOMContext);
  if (!context) throw new Error("BOMProvider is required");
  return context;
}
