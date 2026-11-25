"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Inspection } from "./production-quality-domain";
import { qualityApi } from "./production-quality-api";
const QualityContext = createContext<{
  records: Inspection[];
  loaded: boolean;
  busy: boolean;
  loadError: string;
  refresh: () => Promise<void>;
  save: (row: Inspection) => Promise<Inspection>;
  remove: (row: Inspection) => Promise<void>;
} | null>(null);
export function ProductionQualityProvider({children}:{children:ReactNode}) {
  const [records,setRecords]=useState<Inspection[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [busy,setBusy]=useState(false);
  const [loadError,setLoadError]=useState("");
  const ready=useRef(false), locked=useRef(false);
  const refresh=useCallback(async()=>{
    if (locked.current) return;
    locked.current=true; ready.current=false; setLoaded(false); setBusy(true); setLoadError("");
    try { const rows=await qualityApi.list(); setRecords(rows); ready.current=true; setLoaded(true); }
    catch(e) { setRecords([]); setLoadError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); }
    finally { locked.current=false; setBusy(false); }
  },[]);
  async function run<T>(job:()=>Promise<T>):Promise<T> {
    if (!ready.current || locked.current) throw new Error("ข้อมูลยังไม่พร้อม กรุณาลองใหม่");
    locked.current=true; setBusy(true);
    try { return await job(); } finally { locked.current=false; setBusy(false); }
  }
  return <QualityContext.Provider value={{records,loaded,busy,loadError,refresh,
    save: (row)=>run(async()=>{
      const saved=await qualityApi.save(row);
      setRecords((old)=>old.some((r)=>r.id===saved.id) ? old.map((r)=>r.id===saved.id?saved:r) : [...old,saved]);
      return structuredClone(saved);
    }),
    remove:(row)=>run(async()=>{ await qualityApi.archive(row); setRecords((old)=>old.filter((r)=>r.id!==row.id)); }),
  }}>{children}</QualityContext.Provider>;
}
export function useProductionQuality() {
  const context=useContext(QualityContext);
  if (!context) throw new Error("ProductionQualityProvider is missing");
  return context;
}
