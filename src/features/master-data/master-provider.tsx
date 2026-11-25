"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useSettingsPostgres } from "@/src/components/factory/use-settings-postgres";
import { captureReferences, retainReferences, type MasterReferences, type MasterState, type ReferenceField } from "./master-domain";

type Context = {
  state: MasterState;
  loading: boolean;
  loadError: string;
  retry: () => void;
  capture: (fields: Record<string, ReferenceField>, previous?: MasterReferences, legacy?: boolean) => MasterReferences;
  retain: (refs: MasterReferences) => void;
};
const MasterContext = createContext<Context | null>(null);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const { state, loading, loadError, retry } = useSettingsPostgres();
  const used = useRef<string[]>([]);
  return (
    <MasterContext.Provider value={{
      state, loading, loadError, retry,
      capture: (fields, previous, legacy) => captureReferences(state, fields, previous, legacy),
      retain: (refs) => { used.current = retainReferences({ ...state, used: used.current }, refs).used; },
    }}>
      {children}
    </MasterContext.Provider>
  );
}

export function useMasterData() {
  const value = useContext(MasterContext);
  if (!value) throw new Error("MasterDataProvider is required");
  return value;
}
