"use client";
import { useEffect, useRef, useState } from "react";
import type { MasterRow, MasterState } from "@/src/features/master-data/master-domain";

type Snapshot = { rows: MasterRow[]; versions: Record<string, string> };
const endpoint = "http://127.0.0.1:4317/masters";
export function useSettingsPostgres() {
  const [snapshot, setSnapshot] = useState<Snapshot>({ rows: [], versions: {} });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const current = useRef(snapshot);
  const saving = useRef(false);
  async function request(method = "GET", body?: unknown): Promise<Snapshot> {
    let response: Response;
    try {
      response = await fetch(endpoint, { method, cache: "no-store", credentials: "omit",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    } catch { throw new Error("เชื่อมต่อ Local Settings API ไม่ได้ โปรดตรวจ server และ write role"); }
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || "Settings PostgreSQL ไม่พร้อมใช้งาน");
    if (!Array.isArray(result.data?.rows) || !result.data.versions) throw new Error("ข้อมูล Settings ตอบกลับไม่ถูกต้อง");
    return result.data;
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError("");
    request().then((next) => {
      if (active) { current.current = next; setSnapshot(next); }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "โหลด Settings ไม่สำเร็จ");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const state: MasterState = { rows: snapshot.rows, personnel: [], used: [] };
  return {
    state, loading, loadError, busy, retry: () => setReload((value) => value + 1),
    async save(row: MasterRow) {
      if (saving.current) throw new Error("กำลังบันทึก กรุณารอ");
      saving.current = true; setBusy(true);
      try {
        const next = await request("POST", { row, expectedVersion: current.current.versions[row.id] ?? null });
        current.current = next; setSnapshot(next);
      } finally { saving.current = false; setBusy(false); }
    },
    async remove(_id: string): Promise<void> { await request("DELETE"); },
  };
}
