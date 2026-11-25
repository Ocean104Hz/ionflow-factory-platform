"use client";
import { usePR } from "./pr-provider";
import { PREditor } from "./pr-editor";
export function PREditPage({ id }: { id: string }) {
  const { records, loading, loadError, retry } = usePR();
  if (loading) return <p role="status">กำลังโหลดใบขอซื้อ…</p>;
  if (loadError) return <div><p role="alert">{loadError}</p><button type="button" onClick={retry}>ลองอีกครั้ง</button></div>;
  const pr = records.find((row) => row.id === id);
  return pr ? <PREditor key={id} original={pr} /> : <p role="alert">ไม่พบใบขอซื้อ</p>;
}
