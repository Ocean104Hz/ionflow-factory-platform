"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  actionLabel,
  batchPRRecords,
  copyPR,
  createDemoPO,
  createPRRecord,
  deletePREvent,
  demoPRs,
  demoPRUser,
  prUsers,
  savePRRecord,
  transitionPR,
  type PR,
  type PRAction,
  type PREvent,
} from "./pr-domain";
import type { AuditEntry } from "@/src/lib/mock-data/audit-log";
type PRContextValue = {
  records: PR[];
  audit: AuditEntry[];
  create: (draft: PR, submit?: boolean, imported?: boolean) => string;
  save: (draft: PR, submit?: boolean) => void;
  act: (id: string, action: PRAction, note?: string) => void;
  order: (id: string, quantities: Record<string, number>) => void;
  remove: (id: string) => void;
  copy: (id: string) => string;
  batch: (ids: string[], action: PRAction, note?: string) => void;
};
const PRContext = createContext<PRContextValue | null>(null);
function auditEvent(pr: PR, event: PREvent): AuditEntry {
  return {
    id: `PR-${event.id}`,
    occurredAt: event.at,
    user: event.actor,
    email:
      (event.actor === demoPRUser.name
        ? demoPRUser.email
        : prUsers.find((user) => user.name === event.actor)?.email) ??
      "demo@example.com",
    action:
      event.action === "delete"
        ? "DELETE"
        : event.action === "create" || event.action === "import"
          ? "CREATE"
          : "UPDATE",
    module: "ใบขอซื้อ (PR)",
    reference: pr.number,
    summary: `${actionLabel[event.action] ?? event.action}${event.note ? ` · ${event.note}` : ""}`,
    ipAddress: "192.0.2.10",
    changes: event.changes,
  };
}
export function PRProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ records: PR[]; audit: AuditEntry[] }>({
    records: demoPRs,
    audit: [],
  });
  const current = useRef(state);
  const actor = demoPRUser.name;
  // Synchronous snapshot prevents rapid demo commands from reading stale React state.
  function commit(records: PR[], events: AuditEntry[]) {
    current.current = { records, audit: [...events, ...current.current.audit] };
    setState(current.current);
  }
  function get(id: string) {
    const pr = current.current.records.find((row) => row.id === id);
    if (!pr) throw new Error("ไม่พบ PR");
    return pr;
  }
  function replace(pr: PR, old: PR) {
    commit(
      current.current.records.map((row) => (row.id === pr.id ? pr : row)),
      pr.history
        .slice(old.history.length)
        .map((event) => auditEvent(pr, event)),
    );
  }
  function create(draft: PR, submit = false, imported = false) {
    if (
      imported &&
      current.current.records.some((pr) => pr.referenceNo === draft.referenceNo)
    )
      throw new Error("นำเข้าข้อมูลตัวอย่างนี้แล้ว ไม่สร้างรายการซ้ำ");
    // Deleted numbers remain reserved in this demo session's audit trail.
    const reserved = current.current.audit
      .filter((event) => event.action === "DELETE")
      .map((event) => ({ ...draft, number: event.reference }));
    const pr = createPRRecord(
      draft,
      [...current.current.records, ...reserved],
      actor,
      submit,
      imported,
    );
    commit(
      [pr, ...current.current.records],
      pr.history.map((event) => auditEvent(pr, event)),
    );
    return pr.id;
  }
  function save(draft: PR, submit = false) {
    const old = get(draft.id);
    replace(savePRRecord(old, draft, actor, submit), old);
  }
  function act(id: string, action: PRAction, note = "") {
    const old = get(id);
    replace(transitionPR(old, action, actor, note), old);
  }
  function order(id: string, quantities: Record<string, number>) {
    const old = get(id);
    replace(createDemoPO(old, quantities, actor), old);
  }
  function remove(id: string) {
    const old = get(id);
    const event = deletePREvent(old, actor);
    commit(
      current.current.records.filter((row) => row.id !== id),
      [auditEvent(old, event)],
    );
  }
  function batch(ids: string[], action: PRAction, note = "") {
    const old = current.current.records;
    const next = batchPRRecords(old, ids, action, actor, note);
    // Validate every selected document before committing any, never partly apply a batch.
    commit(
      next,
      next.flatMap((pr) =>
        pr.history
          .slice(old.find((row) => row.id === pr.id)!.history.length)
          .map((event) => auditEvent(pr, event)),
      ),
    );
  }
  return (
    <PRContext.Provider
      value={{
        ...state,
        create,
        save,
        act,
        order,
        remove,
        copy: (id) => create(copyPR(get(id))),
        batch,
      }}
    >
      {children}
    </PRContext.Provider>
  );
}
export function usePR() {
  const context = useContext(PRContext);
  if (!context) throw new Error("PRProvider is required");
  return context;
}
