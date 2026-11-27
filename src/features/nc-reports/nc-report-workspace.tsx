"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";
import { useQcDocuments } from "@/src/features/qc-documents/use-qc-documents";
import {
  blankNC,
  validateNC,
} from "./nc-report-mock-helpers";
import type { NCReport, NCErrors } from "./nc-report-types";
import { NCReportForm } from "./nc-report-form";
import { NCReportHistory } from "./nc-report-history";
import { NCReportDetail } from "./nc-report-detail";
import { NCReportPrintPreview } from "./nc-report-print-preview";

export function NCReportWorkspace() {
  const { records, persist, remove, loading, loadError, busy } = useQcDocuments<NCReport>("nc_reports");
  const [report, setReport] = useState(blankNC),
    [baseline, setBaseline] = useState(() => JSON.stringify(blankNC()));
  const [tab, setTab] = useState("form"),
    [errors, setErrors] = useState<NCErrors>({}),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<NCReport | null>(null),
    [viewId, setViewId] = useState<string | null>(null),
    [printId, setPrintId] = useState<string | null>(null);
  const dirty = JSON.stringify(report) !== baseline;
  function open(r: NCReport) {
    setReport(structuredClone(r));
    setBaseline(JSON.stringify(r));
    setErrors({});
    setMessage("");
    setTab("form");
  }
  function request(r: NCReport) {
    if (dirty) setPending(r);
    else open(r);
  }
  function changeTab(value: string) {
    if (busy || loading || loadError) return;
    if (value === "form" && tab !== "form") request(blankNC());
    else if (value === "history") setTab("history");
  }
  async function save() {
    const nextErrors = validateNC(report, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
      return;
    }
    try {
      await persist(report);
      const next = blankNC();
      setReport(next);
      setBaseline(JSON.stringify(next));
      setErrors({});
      setTab("history");
      setMessage("บันทึกเอกสารแล้ว");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกเอกสารไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-3 pt-3">
      {loading && <p role="status">กำลังโหลดเอกสาร…</p>}
      {loadError && <p role="alert" className="text-danger">{loadError} กรุณารีเฟรชหน้าเพื่อโหลดอีกครั้ง</p>}
      <fieldset disabled={busy} className="min-w-0">
        <Tabs value={tab} onValueChange={changeTab} activationMode="manual" className="min-w-0 gap-3">
          <TabsList aria-label="ใบ NC" className="mx-auto w-full max-w-xl rounded-full border bg-card p-1 shadow-sm group-data-[orientation=horizontal]/tabs:h-11">
            <TabsTrigger value="form" disabled={busy || loading || !!loadError} className="rounded-full px-4" style={tab === "form" ? { backgroundColor: "#173b63", color: "#ffffff" } : undefined}>
              สร้างเอกสาร
            </TabsTrigger>
            <TabsTrigger value="history" disabled={busy || loading || !!loadError} className="rounded-full px-4" style={tab === "history" ? { backgroundColor: "#173b63", color: "#ffffff" } : undefined}>
              ประวัติ
            </TabsTrigger>
          </TabsList>
          <p role="status" className="text-sm text-primary empty:hidden">{message}</p>
          <TabsContent value="form" className="min-w-0">
            <NCReportForm
              report={report}
              errors={errors}
              disabled={busy || loading || !!loadError}
              onChange={(r) => {
                setReport(r);
                setMessage("");
              }}
              onSave={save}
              onCancel={() => request(blankNC())}
            />
          </TabsContent>
          <TabsContent value="history" className="min-w-0">
            <NCReportHistory
              records={records}
              onEdit={request}
              onView={(r) => setViewId(r.id)}
              onPrint={(r) => setPrintId(r.id)}
              onDelete={async (r) => {
                try { await remove(r.id); }
                catch (error) {
                  setMessage(error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ");
                  return;
                }
                if (report.id === r.id) open(blankNC());
                if (viewId === r.id) setViewId(null);
                if (printId === r.id) setPrintId(null);
                setMessage("ลบเอกสารจากรายการแล้ว");
              }}
            />
          </TabsContent>
        </Tabs>
      </fieldset>
      <AlertDialog
        open={!!pending}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ละทิ้งข้อมูลที่ยังไม่บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>
              การเปิดหรือล้างแบบฟอร์มจะทิ้งการแก้ไขปัจจุบัน
              ไม่มีการบันทึกอัตโนมัติ การสลับแท็บอย่างเดียวไม่ล้างข้อมูล
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) open(pending);
                setPending(null);
              }}
            >
              ยืนยันละทิ้งข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <NCReportDetail
        report={records.find((r) => r.id === viewId) ?? null}
        onClose={() => setViewId(null)}
      />
      <NCReportPrintPreview
        report={records.find((r) => r.id === printId) ?? null}
        onClose={() => setPrintId(null)}
      />
    </div>
  );
}
