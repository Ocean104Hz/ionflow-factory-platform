"use client";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { PackagingReport } from "./packaging-domain";
import { usePackagingData } from "./packaging-client";
const Context = createContext<{
  records: PackagingReport[];
  save: (r: PackagingReport) => Promise<PackagingReport>;
  remove: (r: PackagingReport) => Promise<void>;
  loading: boolean;
  error: string;
  busy: boolean;
  retry: () => void;
} | null>(null);
export function PackagingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = usePackagingData<{ records: PackagingReport[] }>("packaging_report", pathname === "/packaging-report");
  return (
    <Context.Provider
      value={{
        records: state.data?.records ?? [],
        loading: state.loading, error: state.error, busy: state.busy, retry: state.retry,
        async save(document) {
          const saved = await state.mutate<PackagingReport>({ action: "save", document });
          state.setData((current) => ({ records: [saved, ...(current?.records ?? []).filter((r) => r.id !== saved.id)] }));
          return saved;
        },
        async remove(report) {
          await state.mutate({ action: "delete", id: report.id, updatedAt: report.updatedAt });
          state.setData((current) => ({ records: (current?.records ?? []).filter((r) => r.id !== report.id) }));
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
