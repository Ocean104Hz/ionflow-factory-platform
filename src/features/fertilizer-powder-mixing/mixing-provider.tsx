"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  masterKinds,
  type MasterReferences,
  type MasterSnapshot,
} from "@/src/features/master-data/master-domain";
import {
  mixingApi,
  MixingApiError,
  type MixingApiRecord,
  type MixingCatalogItem,
} from "./mixing-api";
import {
  MixingValidationError,
  nextDocumentNumber,
  validateReport,
  type MixingReport,
} from "./mixing-domain";

type Context = {
  records: MixingReport[];
  catalog: MixingCatalogItem[];
  loading: boolean;
  busy: boolean;
  error: string;
  reload: () => void;
  save: (row: MixingReport) => Promise<void>;
  copy: (id: string) => Promise<void>;
  remove: (id: string, version: string) => Promise<void>;
  importRows: (rows: MixingReport[]) => void;
};

const MixingContext = createContext<Context | null>(null);
const MODULE_PATH = "/fertilizer-powder-mixing";

function isSnapshot(value: unknown): value is MasterSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.kind === "string" &&
    (row.kind === "personnel" || Object.hasOwn(masterKinds, row.kind)) &&
    typeof row.code === "string" &&
    typeof row.name === "string" &&
    typeof row.value === "string"
  );
}

function toReport(record: MixingApiRecord): MixingReport {
  const masterRefs: MasterReferences = {};
  for (const [key, value] of Object.entries(record.masterRefs)) {
    if (key !== "__proto__" && key !== "constructor" && isSnapshot(value)) {
      masterRefs[key] = value;
    }
  }
  return { ...record, masterRefs };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "ไม่สามารถดำเนินการได้";
}

function requireVersion(row: MixingReport): string {
  if (!row.version) {
    throw new Error("ไม่พบเวอร์ชันเอกสาร กรุณาโหลดข้อมูลใหม่");
  }
  return row.version;
}

export function MixingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [records, setRecords] = useState<MixingReport[]>([]);
  const [catalog, setCatalog] = useState<MixingCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const current = useRef<MixingReport[]>([]);
  const currentCatalog = useRef<MixingCatalogItem[]>([]);
  const ready = useRef(false);
  const writing = useRef(false);

  // The provider is mounted in the shared factory layout. Load only on this page.
  useEffect(() => {
    if (pathname !== MODULE_PATH || ready.current) return;
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        const [reports, materials] = await Promise.all([
          mixingApi.list(signal),
          mixingApi.catalog(signal),
        ]);
        if (signal.aborted) return;
        const next = reports.map(toReport);
        current.current = next;
        currentCatalog.current = materials;
        ready.current = true;
        setRecords(next);
        setCatalog(materials);
        setError("");
      } catch (cause: unknown) {
        if (signal.aborted) return;
        ready.current = false;
        setError(errorMessage(cause));
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [pathname, revision]);

  function reload() {
    if (writing.current || pathname !== MODULE_PATH) return;
    ready.current = false;
    setLoading(true);
    setError("");
    setRevision((value) => value + 1);
  }

  function commit(next: MixingReport[]) {
    current.current = next;
    setRecords(next);
  }

  function upsert(record: MixingApiRecord) {
    const saved = toReport(record);
    const existing = current.current.some((row) => row.id === saved.id);
    commit(
      existing
        ? current.current.map((row) => (row.id === saved.id ? saved : row))
        : [saved, ...current.current],
    );
  }

  async function mutate(action: () => Promise<void>): Promise<void> {
    if (!ready.current) {
      throw new Error("ยังโหลดข้อมูลไม่สำเร็จ กรุณาโหลดข้อมูลใหม่");
    }
    if (writing.current) {
      throw new Error("กำลังดำเนินการ กรุณารอให้รายการก่อนหน้าเสร็จสิ้น");
    }
    writing.current = true;
    setBusy(true);
    try {
      await action();
    } catch (cause: unknown) {
      if (cause instanceof MixingApiError && cause.field) {
        throw new MixingValidationError({ [cause.field]: cause.message });
      }
      throw cause;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  function validate(row: MixingReport) {
    const errors = validateReport(row, current.current, currentCatalog.current);
    if (Object.keys(errors).length) throw new MixingValidationError(errors);
  }

  async function save(row: MixingReport): Promise<void> {
    await mutate(async () => {
      validate(row);
      if (row.id) {
        // Use the version from the draft, not a newer version from the list.
        upsert(await mixingApi.update(row.id, requireVersion(row), row));
      } else {
        upsert(await mixingApi.create(row));
      }
    });
  }

  async function copy(id: string): Promise<void> {
    await mutate(async () => {
      const source = current.current.find((row) => row.id === id);
      if (!source) throw new Error("ไม่พบรายงานต้นฉบับ");
      const draft: MixingReport = {
        ...structuredClone(source),
        id: "",
        version: undefined,
        doc_no: nextDocumentNumber(current.current, `${source.doc_no}-COPY`),
        inspector: "",
        inspector_date: "",
        production: "",
        factory_qa: "",
        mix_rounds: source.mix_rounds.map((round) => ({
          ...round,
          is_pass: null,
        })),
      };
      validate(draft);
      upsert(await mixingApi.create(draft));
    });
  }

  async function remove(id: string, version: string): Promise<void> {
    await mutate(async () => {
      await mixingApi.archive(id, version);
      commit(current.current.filter((row) => row.id !== id));
    });
  }

  function importRows(_rows: MixingReport[]): void {
    // The current Import Preview supplies demo rows, not parsed Excel data.
    // Never persist those rows to the real database.
    throw new Error("ยังไม่รองรับการนำเข้าไฟล์จริง ไม่สามารถบันทึกข้อมูลตัวอย่างได้");
  }

  return (
    <MixingContext.Provider
      value={{ records, catalog, loading, busy, error, reload, save, copy, remove, importRows }}
    >
      {children}
    </MixingContext.Provider>
  );
}

export function useMixing() {
  const value = useContext(MixingContext);
  if (!value) throw new Error("MixingProvider is required");
  return value;
}
