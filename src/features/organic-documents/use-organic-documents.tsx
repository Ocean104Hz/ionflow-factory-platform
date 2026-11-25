"use client";

import { useEffect, useRef, useState } from "react";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import { Button } from "@/src/components/ui/button";
import type { OrganicKind } from "@/src/server/organic-documents";

type Identity = { id: string; updated_at: string };
type Command<T> = { action: "save"; document: T } | ({ action: "delete" } & Identity);

async function request<T>(kind: OrganicKind, command?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/organic-documents?kind=${kind}`, {
    cache: "no-store", signal,
    ...(command ? {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
      body: JSON.stringify(command),
    } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message || "เชื่อมต่อข้อมูลชุดอินทรีย์ไม่สำเร็จ");
  return result.data as T;
}

export function useOrganicDocuments<T extends Identity>(kind: OrganicKind) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void request<T[]>(kind, undefined, controller.signal)
      .then((rows) => { if (!controller.signal.aborted) setRecords(rows); })
      .catch((error: Error) => { if (!controller.signal.aborted) setLoadError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, reload]);

  async function mutate<R>(command: Command<T>) {
    if (loading || loadError) throw new Error(loadError || "กำลังโหลดประวัติเอกสาร กรุณาลองอีกครั้ง");
    if (pending.current) throw new Error("กำลังบันทึก กรุณารอสักครู่");
    pending.current = true;
    setBusy(true);
    try { return await request<R>(kind, command); }
    finally { pending.current = false; setBusy(false); }
  }

  return {
    records, busy, loading, loadError,
    retry() { setLoading(true); setLoadError(""); setReload((value) => value + 1); },
    async save(document: T) {
      const saved = await mutate<T>({ action: "save", document });
      setRecords((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
      return saved;
    },
    async remove(document: T) {
      await mutate<null>({ action: "delete", id: document.id, updated_at: document.updated_at });
      setRecords((rows) => rows.filter((row) => row.id !== document.id));
    },
  };
}

export function OrganicLoadStatus({ loading, loadError, retry }: {
  loading: boolean; loadError: string; retry: () => void;
}) {
  if (loading) return <p role="status">กำลังโหลดประวัติเอกสาร…</p>;
  if (!loadError) return null;
  return (
    <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
      <span>{loadError}</span>
      <Button type="button" variant="outline" onClick={retry}>ลองใหม่</Button>
    </div>
  );
}
