"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultBranding, themeVariables, type FactoryBranding } from "@/src/lib/branding";
import { readFactoryCsrfToken } from "./use-settings-postgres";

type Snapshot = { branding: FactoryBranding; version: string | null };
const BrandingContext = createContext<{
  branding: FactoryBranding;
  loading: boolean;
  error: string;
  updateBranding: (value: FactoryBranding) => Promise<void>;
} | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>({ branding: defaultBranding, version: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const branding = snapshot.branding;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/branding", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("โหลดหน้าตาโรงงานไม่สำเร็จ");
        const result = await response.json();
        if (!controller.signal.aborted) setSnapshot({ branding: result.branding, version: result.version });
      })
      .catch(() => { if (!controller.signal.aborted) setError("โหลดหน้าตาโรงงานไม่สำเร็จ กรุณาเปิดหน้าใหม่"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    for (const [key, value] of Object.entries(themeVariables(branding.primaryColor))) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [branding.primaryColor]);

  async function updateBranding(value: FactoryBranding) {
    const response = await fetch("/api/settings/branding", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
      body: JSON.stringify({ branding: value, version: snapshot.version }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.message || "บันทึกหน้าตาโรงงานไม่สำเร็จ");
    setSnapshot({ branding: result.branding, version: result.version });
  }
  return <BrandingContext.Provider value={{ branding, loading, error, updateBranding }}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const value = useContext(BrandingContext);
  if (!value) throw new Error("BrandingProvider is required");
  return value;
}
