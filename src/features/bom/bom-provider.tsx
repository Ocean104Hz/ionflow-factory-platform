"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoBOM } from "@/src/lib/mock-data/bom";
import {
  saveMaster,
  saveFormula,
  selectDefault,
  deleteMaster,
  deleteFormula,
  importRows,
  type BOMState,
  type Master,
  type Formula,
  type ImportRow,
} from "./bom-domain";
type Context = {
  state: BOMState;
  saveMaster: (row: Master) => string;
  saveFormula: (row: Formula, isDefault: boolean) => string;
  setDefault: (masterId: string, formulaId: string | null) => void;
  removeMaster: (id: string) => void;
  removeFormula: (id: string) => void;
  importRows: (rows: ImportRow[]) => void;
};
const BOMContext = createContext<Context | null>(null);
export function BOMProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BOMState>(() => structuredClone(demoBOM));
  const current = useRef(state);
  function commit(next: BOMState) {
    current.current = next;
    setState(next);
  }
  return (
    <BOMContext.Provider
      value={{
        state,
        saveMaster(row) {
          const id = row.id || crypto.randomUUID();
          commit(
            saveMaster(current.current, row, id, new Date().toISOString()),
          );
          return id;
        },
        saveFormula(row, selected) {
          const id = row.id || crypto.randomUUID();
          commit(
            saveFormula(
              current.current,
              row,
              selected,
              id,
              new Date().toISOString(),
            ),
          );
          return id;
        },
        setDefault(masterId, formulaId) {
          commit(
            selectDefault(
              current.current,
              masterId,
              formulaId,
              new Date().toISOString(),
            ),
          );
        },
        removeMaster(id) {
          commit(deleteMaster(current.current, id));
        },
        removeFormula(id) {
          commit(deleteFormula(current.current, id, new Date().toISOString()));
        },
        importRows(rows) {
          commit(importRows(current.current, rows, new Date().toISOString()));
        },
      }}
    >
      {children}
    </BOMContext.Provider>
  );
}
export function useBOM() {
  const context = useContext(BOMContext);
  if (!context) throw new Error("BOMProvider is required");
  return context;
}
