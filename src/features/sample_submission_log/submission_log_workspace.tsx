"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/src/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import { useQcDocuments } from "@/src/features/qc-documents/use-qc-documents";
import {
  newLogDraft,
  validateLog,
  type SubmissionLog,
  type LogErrors,
} from "./submission_log_domain";
import { SubmissionLogSections } from "./submission_log_form";
import { SubmissionLogHistory } from "./submission_log_history";
import { SubmissionLogDetail } from "./submission_log_detail";

// NAN_SAMPLE_LOG_DEFAULT_DATES_V6
// Initialize the current Bangkok day only after hydration, not during cached SSR.
const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
export function SubmissionLogWorkspace() {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  return hydrated ? <SubmissionLogWorkspaceContent /> : <p role="status">กำลังโหลดเอกสาร…</p>;
}

function SubmissionLogWorkspaceContent() {
  const { records, persist, remove, loading, loadError, busy } = useQcDocuments<SubmissionLog>("sample_submission_log");
  const
    [row, setRow] = useState(newLogDraft),
    [baseline, setBaseline] = useState(() => JSON.stringify(row));
  const [tab, setTab] = useState("form"),
    [errors, setErrors] = useState<LogErrors>({}),
    [message, setMessage] = useState("");
  const [pending, setPending] = useState<SubmissionLog | null>(null),
    [view, setView] = useState<{ id: string; print: boolean } | null>(null),
    summary = useRef<HTMLDivElement>(null);
  function open(r: SubmissionLog) {
    setRow(structuredClone(r));
    setBaseline(JSON.stringify(r));
    setErrors({});
    setMessage("");
    setTab("form");
  }
  function request(r: SubmissionLog) {
    if (JSON.stringify(row) !== baseline) setPending(r);
    else open(r);
  }
  function changeTab(value: string) {
    if (busy || loading || loadError) return;
    // Refresh only an untouched NEW draft when re-entering the form.
    // Existing or user-edited drafts must never be reset automatically.
    if (value === "form" && tab !== "form" && !row.id && JSON.stringify(row) === baseline) {
      const next = newLogDraft();
      setRow(next);
      setBaseline(JSON.stringify(next));
    }
    setTab(value);
  }
  async function save() {
    const issues = validateLog(row, records);
    setErrors(issues);
    if (Object.keys(issues).length) {
      setMessage("ยังบันทึกไม่ได้ กรุณาแก้ไขช่องที่ระบุ");
      summary.current?.focus();
      return;
    }
    try {
      await persist(row);
      const next = newLogDraft();
      setRow(next);
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
        {/* NAN_SUBMISSION_LOG_ICON_FORM_V1 */}
        <TabsList aria-label="แบบบันทึกการนำส่งตัวอย่างวิเคราะห์" className="mx-auto w-full max-w-xl rounded-full border bg-card p-1 shadow-sm group-data-[orientation=horizontal]/tabs:h-11">
          <TabsTrigger value="form" disabled={busy || loading || !!loadError} className="rounded-full px-4" style={tab === "form" ? { backgroundColor: "#173b63", color: "#ffffff" } : undefined}>กรอกข้อมูล</TabsTrigger>
          <TabsTrigger value="history" disabled={busy || loading || !!loadError} className="rounded-full px-4" style={tab === "history" ? { backgroundColor: "#173b63", color: "#ffffff" } : undefined}>ดูประวัติ</TabsTrigger>
        </TabsList>
        <p role="status" className="text-sm text-primary empty:hidden">{message}</p>
        <TabsContent value="form" className="min-w-0">
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {row.id && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
                <p className="break-all">กำลังแก้ไขเอกสาร: <span className="font-semibold">{row.doc_no}</span></p>
                <Button type="button" variant="ghost" size="sm" onClick={() => request(newLogDraft())}>ยกเลิกการแก้ไข</Button>
              </div>
            )}
            <div
              ref={summary}
              tabIndex={-1}
              className="scroll-mt-20 outline-none"
            >
              {Object.keys(errors).length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger"
                >
                  <p className="font-medium">
                    ยังบันทึกไม่ได้ กรุณาแก้ไขข้อมูลต่อไปนี้
                  </p>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {Object.entries(errors).map(([key, error]) => (
                      <li key={key}>
                        <a className="underline" href={`#log-${key}`}>
                          {error}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <SubmissionLogSections
              row={row}
              errors={errors}
              disabled={busy}
              onChange={(r) => {
                setRow(r);
                setMessage("");
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" disabled={busy || loading || !!loadError} className="bg-[#173b63] text-white hover:bg-[#173b63]/90">บันทึก</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="history" className="min-w-0">
          <SubmissionLogHistory
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
              if (row.id === r.id) open(newLogDraft());
              if (view?.id === r.id) setView(null);
              setMessage("ลบเอกสารจากรายการแล้ว");
            }}
          />
        </TabsContent>
      </Tabs>
      </fieldset>
      <AlertDialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) setPending(null);
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
      <SubmissionLogDetail
        row={records.find((r) => r.id === view?.id) ?? null}
        print={view?.print ?? false}
        onClose={() => setView(null)}
      />
    </div>
  );
}
