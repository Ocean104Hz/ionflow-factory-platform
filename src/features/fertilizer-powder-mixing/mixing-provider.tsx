"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  demoMixingReports,
  mixingCatalog,
} from "@/src/lib/mock-data/fertilizer-powder-mixing";
import {
  saveReport,
  copyReport,
  deleteReport,
  importReports,
  type MixingReport,
} from "./mixing-domain";
import { useMasterData } from "@/src/features/master-data/master-provider";
import {
  mixingFields,
  fieldsForSave,
} from "@/src/features/master-data/internal-references";
type Context = {
  records: MixingReport[];
  save: (row: MixingReport) => void;
  copy: (id: string) => void;
  remove: (id: string) => void;
  importRows: (rows: MixingReport[]) => void;
};
const MixingContext = createContext<Context | null>(null);
export function MixingProvider({ children }: { children: ReactNode }) {
  const masters = useMasterData();
  const [records, setRecords] = useState<MixingReport[]>(() =>
    structuredClone(demoMixingReports).map((row) => ({
      ...row,
      masterRefs: masters.capture(mixingFields(row), {}, true),
    })),
  );
  const current = useRef(records);
  useEffect(() => {
    for (const row of records) masters.retain(row.masterRefs ?? {});
  }, [records]);
  function commit(next: MixingReport[]) {
    current.current = next;
    setRecords(next);
  }
  return (
    <MixingContext.Provider
      value={{
        records,
        save(row) {
          const old = current.current.find((r) => r.id === row.id);
          row = {
            ...row,
            masterRefs: masters.capture(
              fieldsForSave(
                mixingFields(row),
                old ? mixingFields(old) : {},
                old?.masterRefs,
              ),
              old?.masterRefs,
            ),
          };
          const vehicle = masters.state.rows.find(
            (r) => r.id === row.masterRefs?.loader_no?.id,
          );
          if (
            vehicle &&
            old?.masterRefs?.loader_no?.id !== vehicle.id &&
            !masters.state.rows.some(
              (r) =>
                r.id === vehicle.typeId &&
                r.kind === "vehicleTypes" &&
                r.type === "รถตัก" &&
                r.active,
            )
          )
            throw new Error("กรุณาเลือกรถประเภท รถตัก ที่เปิดใช้งาน");
          commit(
            saveReport(
              current.current,
              row,
              crypto.randomUUID(),
              new Date().toISOString(),
              mixingCatalog,
            ),
          );
        },
        copy(id) {
          commit(
            copyReport(
              current.current,
              id,
              crypto.randomUUID(),
              new Date().toISOString(),
              mixingCatalog,
            ),
          );
        },
        remove(id) {
          commit(deleteReport(current.current, id));
        },
        importRows(rows) {
          commit(
            importReports(
              current.current,
              rows.map((row) => ({
                ...row,
                masterRefs: masters.capture(mixingFields(row), {}, true),
              })),
              rows.map(() => crypto.randomUUID()),
              new Date().toISOString(),
              mixingCatalog,
            ),
          );
        },
      }}
    >
      {children}
    </MixingContext.Provider>
  );
}
export function useMixing() {
  const value = useContext(MixingContext);
  if (!value) throw new Error("MixingProvider is required");
  return value;
}
