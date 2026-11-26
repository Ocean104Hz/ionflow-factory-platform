"use client";
import { useState } from "react";
import { useLocalTablePreview } from "@/src/components/factory/use-local-table-preview";
import { localNCExamples } from "@/src/features/qc-documents/local-history-examples";
import { DocumentViewActions, PageHeader } from "@/src/components/factory/patterns";
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
  const localPreview = useLocalTablePreview() && !loading && !loadError && records.length === 0;
  const historyRecords = localPreview ? localNCExamples : records;
  const [report, setReport] = useState(blankNC),
    [baseline, setBaseline] = useState(() => JSON.stringify(blankNC()));
  const [tab, setTab] = useState("history"),
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
  async function save() {
    const nextErrors = validateNC(report, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
      return;
    }
    try {
      const saved = await persist(report);
      setReport(saved);
      setBaseline(JSON.stringify(saved));
      setMessage(
        "บันทึกเอกสารแล้ว",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกเอกสารไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบ NC"
        description="บันทึกและติดตามรายงานข้อบกพร่องของสินค้าและกระบวนการผลิต"
        actions={<DocumentViewActions showingForm={tab === "form"} createLabel="สร้างใบ NC" disabled={busy || loading || !!loadError} onCreate={() => request(blankNC())} onHistory={() => setTab("history")} />}
      />
      {loading && <p role="status">กำลังโหลดเอกสาร…</p>}
      {loadError && <p role="alert" className="text-danger">{loadError} กรุณารีเฟรชหน้าเพื่อโหลดอีกครั้ง</p>}
      <fieldset disabled={busy} className="min-w-0">
      <div className="min-w-0">

        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        {tab === "form" && (<div className="mt-3 min-w-0">
          <NCReportForm
            report={report}
            errors={errors}
            onChange={(r) => {
              setReport(r);
              setMessage("");
            }}
            onSave={save}
            onReset={() => request(blankNC())}
            onCancel={() => request(blankNC())}
          />
        </div>)}
        {tab === "history" && (<div className="mt-3 min-w-0">
          <NCReportHistory
            records={historyRecords}
            readOnly={localPreview}
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
        </div>)}
      </div>
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
        report={historyRecords.find((r) => r.id === viewId) ?? null}
        onClose={() => setViewId(null)}
      />
      <NCReportPrintPreview
        report={historyRecords.find((r) => r.id === printId) ?? null}
        onClose={() => setPrintId(null)}
      />
    </div>
  );
}
