"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { demoQualityInspections } from "@/src/lib/mock-data/production-quality";
import {
  deleteInspection,
  saveInspection,
  type Inspection,
} from "./production-quality-domain";

const QualityContext = createContext<{
  records: Inspection[];
  save: (row: Inspection) => Inspection;
  remove: (id: string) => void;
} | null>(null);
export function ProductionQualityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [records, setRecords] = useState<Inspection[]>(() =>
    structuredClone(demoQualityInspections),
  );
  const current = useRef(records);
  function commit(rows: Inspection[]) {
    current.current = rows;
    setRecords(rows);
  }
  return (
    <QualityContext.Provider
      value={{
        records,
        save(row) {
          const next = saveInspection(
            current.current,
            row,
            crypto.randomUUID(),
            new Date().toISOString(),
          );
          commit(next.records);
          return structuredClone(next.record);
        },
        remove(id) {
          commit(deleteInspection(current.current, id));
        },
      }}
    >
      {children}
    </QualityContext.Provider>
  );
}
export function useProductionQuality() {
  const context = useContext(QualityContext);
  if (!context) throw new Error("ProductionQualityProvider is missing");
  return context;
}
