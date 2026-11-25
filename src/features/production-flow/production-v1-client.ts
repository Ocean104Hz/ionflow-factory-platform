"use client";

import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import { useEffect, useState } from "react";

export async function productionRequest<T>(area: "bom" | "order" | "report" | "receipt", command?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/production-v1?area=${area}`, {
    cache: "no-store", signal,
    ...(command && {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
      body: JSON.stringify(command),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message || "เชื่อมต่อระบบการผลิตไม่สำเร็จ");
  return result.data as T;
}

export function useProductionV1Data<T>(area: "order" | "report" | "receipt") {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    productionRequest<T>(area, undefined, controller.signal)
      .then((value) => { if (!controller.signal.aborted) setData(value); })
      .catch((issue) => { if (!controller.signal.aborted) setError(issue.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [area, reload]);
  return {
    data, setData, error, loading,
    refresh: () => { setLoading(true); setError(""); setReload((current) => current + 1); },
  };
}
