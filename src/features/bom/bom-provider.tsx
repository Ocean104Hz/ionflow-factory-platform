"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
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
import { useMasterData } from "@/src/features/master-data/master-provider";
import {
  bomFields,
  formulaFields,
  fieldsForSave,
} from "@/src/features/master-data/internal-references";
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
  const masters = useMasterData();
  const [state, setState] = useState<BOMState>(() => {
    const initial = structuredClone(demoBOM);
    initial.masters = initial.masters.map((row) => ({
      ...row,
      masterRefs: masters.capture(bomFields(row), {}, true),
    }));
    initial.formulas = initial.formulas.map((row) => ({
      ...row,
      masterRefs: masters.capture(formulaFields(row), {}, true),
    }));
    return initial;
  });
  const current = useRef(state);
  useEffect(() => {
    for (const row of [...state.masters, ...state.formulas])
      masters.retain(row.masterRefs ?? {});
  }, [state]);
  function commit(next: BOMState) {
    current.current = next;
    setState(next);
  }
  return (
    <BOMContext.Provider
      value={{
        state,
        saveMaster(row) {
          const old = current.current.masters.find((r) => r.id === row.id);
          row = {
            ...row,
            masterRefs: masters.capture(
              fieldsForSave(
                bomFields(row),
                old ? bomFields(old) : {},
                old?.masterRefs,
              ),
              old?.masterRefs,
            ),
          };
          const id = row.id || crypto.randomUUID();
          commit(
            saveMaster(current.current, row, id, new Date().toISOString()),
          );
          return id;
        },
        saveFormula(row, selected) {
          const old = current.current.formulas.find((r) => r.id === row.id);
          row = {
            ...row,
            masterRefs: masters.capture(
              fieldsForSave(
                formulaFields(row),
                old ? formulaFields(old) : {},
                old?.masterRefs,
              ),
              old?.masterRefs,
            ),
          };
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
          const next = importRows(
            current.current,
            rows,
            new Date().toISOString(),
          );
          next.masters = next.masters.map((row) =>
            row.masterRefs
              ? row
              : {
                  ...row,
                  masterRefs: masters.capture(bomFields(row), {}, true),
                },
          );
          next.formulas = next.formulas.map((row) =>
            row.masterRefs
              ? row
              : {
                  ...row,
                  masterRefs: masters.capture(formulaFields(row), {}, true),
                },
          );
          commit(next);
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
