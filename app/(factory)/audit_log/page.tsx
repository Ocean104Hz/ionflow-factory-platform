import { Suspense } from "react";
import { AuditLog } from "@/src/features/audit-log/audit-log";
import { requireAuthenticatedFactoryModule } from "@/src/server/auth/server-auth";
import { readFactoryAudit } from "@/src/server/qc-documents";

async function AuditData() {
  const user = await requireAuthenticatedFactoryModule("audit_log");
  const entries = await readFactoryAudit(user).catch(() => null);
  return <AuditLog entries={entries ?? []} loadError={entries ? undefined : "โหลดประวัติการแก้ไขไม่สำเร็จ กรุณากดรีเฟรช"} />;
}

export default function Page() {
  return <Suspense fallback={<p role="status">กำลังโหลดประวัติการแก้ไข…</p>}><AuditData /></Suspense>;
}
