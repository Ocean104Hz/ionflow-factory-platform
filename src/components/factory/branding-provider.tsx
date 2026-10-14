"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  brandingStorageKey,
  defaultBranding,
  parseBranding,
  readBranding,
  themeVariables,
  type FactoryBranding,
} from "@/src/lib/branding";

const initialSnapshot = JSON.stringify(defaultBranding);
let memorySnapshot = initialSnapshot;
let sessionOverride: string | null = null;
const changeEvent = "ionflow-branding-change";
function snapshot() {
  if (sessionOverride !== null) return sessionOverride;
  try {
    return window.localStorage.getItem(brandingStorageKey) ?? memorySnapshot;
  } catch {
    return memorySnapshot;
  }
}
function subscribe(onChange: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === brandingStorageKey || event.key === null) {
      memorySnapshot = initialSnapshot;
      sessionOverride = null;
      onChange();
    }
  };
  window.addEventListener("storage", storage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener(changeEvent, onChange);
  };
}
const BrandingContext = createContext<{
  branding: FactoryBranding;
  updateBranding: (value: FactoryBranding) => boolean;
} | null>(null);
export function BrandingProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => initialSnapshot);
  const branding = useMemo(() => readBranding(raw), [raw]);
  useEffect(() => {
    for (const [key, value] of Object.entries(
      themeVariables(branding.primaryColor),
    ))
      document.documentElement.style.setProperty(key, value);
  }, [branding.primaryColor]);
  function updateBranding(value: FactoryBranding) {
    memorySnapshot = JSON.stringify(parseBranding(value));
    let saved = true;
    try {
      window.localStorage.setItem(brandingStorageKey, memorySnapshot);
      sessionOverride = null;
    } catch {
      saved = false;
      sessionOverride = memorySnapshot;
    }
    window.dispatchEvent(new Event(changeEvent));
    return saved;
  }
  return (
    <BrandingContext.Provider value={{ branding, updateBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}
export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error("BrandingProvider is required");
  return context;
}
