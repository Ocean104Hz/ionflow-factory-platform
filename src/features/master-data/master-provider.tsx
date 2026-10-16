"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { internalMasters } from "@/src/lib/mock-data/internal-masters";
import { validateDemoUser } from "@/src/lib/mock-data/settings";
import {
  saveMaster,
  deleteMaster,
  captureReferences,
  retainReferences,
  type MasterState,
  type MasterRow,
  type MasterReferences,
  type ReferenceField,
} from "./master-domain";
type Context = {
  state: MasterState;
  save: (row: MasterRow) => void;
  remove: (id: string) => void;
  capture: (
    fields: Record<string, ReferenceField>,
    previous?: MasterReferences,
    legacy?: boolean,
  ) => MasterReferences;
  retain: (refs: MasterReferences) => void;
  savePersonnel: (row: MasterState["personnel"][number]) => void;
};
const MasterContext = createContext<Context | null>(null);
export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MasterState>(() => ({
    ...structuredClone(internalMasters),
    used: internalMasters.rows
      .filter(
        (r) =>
          r.kind === "departments" &&
          internalMasters.personnel.some((p) =>
            [r.name, ...r.aliases].includes(p.department),
          ),
      )
      .map((r) => r.id),
  }));
  const current = useRef(state);
  function commit(next: MasterState) {
    current.current = next;
    setState(next);
  }
  return (
    <MasterContext.Provider
      value={{
        state,
        save: (row) => commit(saveMaster(current.current, row)),
        remove: (id) => commit(deleteMaster(current.current, id)),
        capture: (fields, previous, legacy) =>
          captureReferences(current.current, fields, previous, legacy),
        retain: (refs) => {
          const next = retainReferences(current.current, refs);
          if (next.used.length !== current.current.used.length) commit(next);
        },
        savePersonnel: (row) => {
          const old = current.current.personnel.find((p) => p.id === row.id);
          if (!old) throw new Error("ไม่พบผู้ใช้");
          const allowed = current.current.rows
            .filter((r) => r.kind === "departments" && r.active)
            .flatMap((r) => [r.name, ...r.aliases]);
          if (row.department === old.department) allowed.push(old.department);
          const error = validateDemoUser(
            row,
            current.current.personnel,
            allowed,
          );
          if (error) throw new Error(error);
          const department = captureReferences(
            current.current,
            { department: { kind: "departments", value: row.department } },
            {},
            row.department === old.department,
          );
          commit(
            retainReferences(
              {
                ...current.current,
                personnel: current.current.personnel.map((p) =>
                  p.id === row.id ? structuredClone(row) : p,
                ),
              },
              department,
            ),
          );
        },
      }}
    >
      {children}
    </MasterContext.Provider>
  );
}
export function useMasterData() {
  const value = useContext(MasterContext);
  if (!value) throw new Error("MasterDataProvider is required");
  return value;
}
