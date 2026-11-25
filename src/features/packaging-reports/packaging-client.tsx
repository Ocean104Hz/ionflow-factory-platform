"use client";

import { useEffect, useRef, useState } from "react";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import { Button } from "@/src/components/ui/button";
import type { PackagingKind } from "@/src/server/packaging-documents";

async function request<T>(kind: PackagingKind, command?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/packaging-documents?kind=${kind}`, {
    cache: "no-store", signal,
    ...(command ? {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
      body: JSON.stringify(command),
    } : {}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message || "เชื่อมต่อข้อมูลบรรจุสินค้าไม่สำเร็จ");
  return result.data as T;
}

export function usePackagingData<T>(kind: PackagingKind, enabled = true) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void request<T>(kind, undefined, controller.signal)
      .then((value) => { if (!controller.signal.aborted) { setData(value); setError(""); } })
      .catch((issue: Error) => { if (!controller.signal.aborted) setError(issue.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, enabled, reload]);
  return {
    data, setData, error, loading, busy,
    retry() { setLoading(true); setError(""); setReload((number) => number + 1); },
    async mutate<R>(command: object) {
      if (loading || error) throw new Error(error || "กำลังโหลดประวัติเอกสาร");
      if (pending.current) throw new Error("กรุณารอให้ระบบบันทึกเอกสารเสร็จก่อน");
      pending.current = true;
      setBusy(true);
      try { return await request<R>(kind, command); }
      finally { pending.current = false; setBusy(false); }
    },
  };
}

export function PackagingLoadStatus({ loading, error, retry }: {
  loading: boolean; error: string; retry: () => void;
}) {
  if (loading) return <p role="status">กำลังโหลดประวัติเอกสาร…</p>;
  if (!error) return null;
  return (
    <div role="alert" className="flex items-center gap-3 text-sm text-danger">
      <span>{error}</span>
      <Button type="button" variant="outline" onClick={retry}>ลองใหม่</Button>
    </div>
  );
}
