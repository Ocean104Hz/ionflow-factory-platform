"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoPackagingReports } from "@/src/lib/mock-data/packaging-reports";
import {
  saveReport,
  deleteReport,
  type PackagingReport,
} from "./packaging-domain";
const Context = createContext<{
  records: PackagingReport[];
  save: (r: PackagingReport) => PackagingReport;
  remove: (id: string) => void;
} | null>(null);
export function PackagingProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState(() =>
    structuredClone(demoPackagingReports),
  );
  const current = useRef(records);
  function commit(rows: PackagingReport[]) {
    current.current = rows;
    setRecords(rows);
  }
  return (
    <Context.Provider
      value={{
        records,
        save(input) {
          const next = saveReport(
            current.current,
            input,
            crypto.randomUUID(),
            new Date().toISOString(),
          );
          commit(next.records);
          return structuredClone(next.record);
        },
        remove(id) {
          commit(deleteReport(current.current, id));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePackaging() {
  const context = useContext(Context);
  if (!context) throw new Error("PackagingProvider is missing");
  return context;
}
