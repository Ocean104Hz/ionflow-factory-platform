"use client";

import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";

export async function warehouseRequest<T>(kind: "receiving" | "requisition", command?: object, date?: string, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ kind });
  if (date !== undefined) query.set("date", date);
  const response = await fetch(`/api/warehouse-documents?${query}`, {
    cache: "no-store", signal,
    ...(command ? {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
      body: JSON.stringify(command),
    } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.message ?? "เชื่อมฐานข้อมูลคลังสินค้าไม่สำเร็จ");
  return data.data as T;
}
