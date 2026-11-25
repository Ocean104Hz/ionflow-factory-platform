"use client";

import { useEffect, useRef, useState } from "react";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import type { QcKind, QcSnapshot } from "@/src/server/qc-documents";

export function useQcDocuments<T extends { id: string }>(kind: QcKind) {
  const [data, setData] = useState<QcSnapshot<T>>({ records: [], versions: {} });
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);

  async function request<R>(command?: object, signal?: AbortSignal): Promise<R> {
    const response = await fetch(`/api/qc-documents?kind=${kind}`, {
      cache: "no-store", signal,
      ...(command ? { method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() }, body: JSON.stringify(command) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.message || "เชื่อมฐานข้อมูล QC ไม่สำเร็จ");
    return result.data as R;
  }

  useEffect(() => {
    const controller = new AbortController();
    request<QcSnapshot<T>>(undefined, controller.signal)
      .then(setData)
      .catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "โหลดข้อมูล QC ไม่สำเร็จ"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The module is fixed for the lifetime of its workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  async function write(command: object) {
    if (loading || loadError || writing.current) throw new Error(loadError || "กำลังโหลดหรือบันทึกข้อมูล กรุณารอสักครู่");
    writing.current = true;
    setBusy(true);
    try { return await request<{ saved: T; version: number } | null>(command); }
    finally { writing.current = false; setBusy(false); }
  }

  return {
    records: data.records, loading, loadError, busy,
    async persist(document: T) {
      const result = await write({ action: "save", document, version: document.id ? data.versions[document.id] : null });
      if (!result) throw new Error("ระบบไม่คืนเอกสารที่บันทึก");
      const { saved, version } = result;
      setData(current => ({
        records: [saved, ...current.records.filter(row => row.id !== saved.id)],
        versions: { ...current.versions, [saved.id]: version },
      }));
      return saved;
    },
    async remove(id: string) {
      await write({ action: "delete", id, version: data.versions[id] });
      setData(current => ({ ...current, records: current.records.filter(row => row.id !== id) }));
    },
  };
}
