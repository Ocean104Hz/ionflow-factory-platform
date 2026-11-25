"use client";
import { useState } from "react";
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
  newSubmission,
  validateSubmission,
  type SampleSubmission,
  type SampleErrors,
} from "./sample-submission-domain";
import { SampleSubmissionForm } from "./sample-submission-form";
import { SampleSubmissionHistory } from "./sample-submission-history";
import { SampleSubmissionDetail } from "./sample-submission-detail";

export function SampleSubmissionWorkspace() {
  const { records, persist, remove, loading, loadError, busy } = useQcDocuments<SampleSubmission>("sample_submissions");
  const
    [report, setReport] = useState(newSubmission);
  const [baseline, setBaseline] = useState(() =>
      JSON.stringify(newSubmission()),
    ),
    [tab, setTab] = useState("history"),
    [errors, setErrors] = useState<SampleErrors>({}),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<SampleSubmission | null>(null),
    [view, setView] = useState<{ id: string; print: boolean } | null>(null);
  function open(r: SampleSubmission) {
    setReport(structuredClone(r));
    setBaseline(JSON.stringify(r));
    setErrors({});
    setMessage("");
    setTab("form");
  }
  function request(r: SampleSubmission) {
    if (JSON.stringify(report) !== baseline) setPending(r);
    else open(r);
  }
  async function save() {
    const nextErrors = validateSubmission(report, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
      return;
    }
    try {
      const saved = await persist(report);
      setReport(saved);
      setBaseline(JSON.stringify(saved));
      setMessage("บันทึกเอกสารแล้ว");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบส่งตัวอย่าง"
        description="จัดการตัวอย่างที่นำส่งวิเคราะห์และบันทึกผลรายตัวอย่าง"
        actions={<DocumentViewActions showingForm={tab === "form"} createLabel="สร้างใบส่งตัวอย่าง" disabled={busy || loading || !!loadError} onCreate={() => request(newSubmission())} onHistory={() => setTab("history")} />}
      />
      {loading && <p role="status">กำลังโหลดเอกสาร…</p>}
      {loadError && <p role="alert" className="text-danger">{loadError} กรุณารีเฟรชหน้าเพื่อโหลดอีกครั้ง</p>}
      <fieldset disabled={busy} className="min-w-0">
      <div className="min-w-0">

        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        {tab === "form" && (<div className="mt-3 min-w-0">
          <SampleSubmissionForm
            report={report}
            errors={errors}
            onChange={(r) => {
              setReport(r);
              setMessage("");
            }}
            onSave={save}
            onReset={() => request(newSubmission())}
          />
        </div>)}
        {tab === "history" && (<div className="mt-3 min-w-0">
          <SampleSubmissionHistory
            records={records}
            onEdit={request}
            onView={(r) => setView({ id: r.id, print: false })}
            onPrint={(r) => setView({ id: r.id, print: true })}
            onDelete={async (r) => {
              try { await remove(r.id); }
              catch (error) {
                setMessage(error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ");
                return;
              }
              if (report.id === r.id) open(newSubmission());
              if (view?.id === r.id) setView(null);
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
      <SampleSubmissionDetail
        report={records.find((r) => r.id === view?.id) ?? null}
        print={view?.print ?? false}
        onClose={() => setView(null)}
      />
    </div>
  );
}
