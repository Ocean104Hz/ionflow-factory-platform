"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type {
  MasterRow,
  MasterState,
} from "@/src/features/master-data/master-domain";

type Snapshot = {
  rows: MasterRow[];
  versions: Record<string, string>;
  personnel: MasterState["personnel"];
};

function useSettingsStore() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    rows: [],
    versions: {},
    personnel: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const current = useRef(snapshot);
  const saving = useRef(false);

  async function request(method = "GET", body?: unknown): Promise<Snapshot> {
    let response: Response;

    try {
      const headers = body ? {
        "Content-Type": "application/json",
        "x-csrf-token": await readFactoryCsrfToken(),
      } : undefined;
      response = await fetch("/api/settings/masters", {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error(
        "เชื่อมต่อระบบตั้งค่าไม่สำเร็จ กรุณาลองใหม่",
      );
    }

    const result = await response.json().catch(() => null);

    if (!response.ok || result?.ok !== true) {
      throw new Error(result?.error || result?.message || "Settings PostgreSQL ไม่พร้อมใช้งาน");
    }

    if (!Array.isArray(result.data?.rows) || !result.data.versions || !Array.isArray(result.data.personnel)) {
      throw new Error("ข้อมูล Settings ตอบกลับไม่ถูกต้อง");
    }

    return result.data;
  }

  useEffect(() => {
    let active = true;

    request()
      .then((next) => {
        if (!active) return;

        current.current = next;
        setSnapshot(next);
      })
      .catch((error: unknown) => {
        if (!active) return;

        setLoadError(
          error instanceof Error ? error.message : "โหลด Settings ไม่สำเร็จ",
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reload]);

  const state: MasterState = {
    rows: snapshot.rows,
    personnel: snapshot.personnel,
    used: [],
  };

  return {
    state,
    loading,
    loadError,
    busy,

    retry: () => {
      setLoading(true);
      setLoadError("");
      setReload((value) => value + 1);
    },

    async save(row: MasterRow): Promise<void> {
      if (saving.current) {
        throw new Error("กำลังบันทึก กรุณารอ");
      }

      saving.current = true;
      setBusy(true);

      try {
        const next = await request("POST", {
          row,
          expectedVersion: current.current.versions[row.id] ?? null,
        });

        current.current = next;
        setSnapshot(next);
      } finally {
        saving.current = false;
        setBusy(false);
      }
    },

    async remove(id: string): Promise<void> {
      void id;
      throw new Error("กรุณาปิดใช้งานข้อมูลหลักเพื่อเก็บการอ้างอิงของเอกสารเดิม");
    },
  };
}

const SettingsContext = createContext<ReturnType<typeof useSettingsStore> | null>(null);

export function SettingsPostgresProvider({ children }: { children: ReactNode }) {
  const store = useSettingsStore();
  return createElement(SettingsContext.Provider, { value: store }, children);
}

export function useSettingsPostgres() {
  const store = useContext(SettingsContext);
  if (!store) throw new Error("SettingsPostgresProvider is required");
  return store;
}

export async function readFactoryCsrfToken(): Promise<string> {
  const prefix = "ionflow_factory_csrf=";
  const token = document.cookie.split("; ").find((part) => part.startsWith(prefix))?.slice(prefix.length);
  if (token) return decodeURIComponent(token);
  const response = await fetch("/api/auth/csrf", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.csrfToken !== "string") throw new Error("เริ่มคำขอบันทึกไม่สำเร็จ");
  return body.csrfToken;
}
