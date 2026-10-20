"use client";
import { useState } from "react";
import { PageHeader, StatusBadge } from "@/src/components/factory/patterns";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/src/components/ui/tabs";
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
import { demoSampleSubmissions } from "@/src/lib/mock-data/sample-submissions";
import {
  newSubmission,
  saveSubmission,
  validateSubmission,
  deleteSubmission,
  type SampleSubmission,
  type SampleErrors,
} from "./sample-submission-domain";
import { SampleSubmissionForm } from "./sample-submission-form";
import { SampleSubmissionHistory } from "./sample-submission-history";
import { SampleSubmissionDetail } from "./sample-submission-detail";

export function SampleSubmissionWorkspace() {
  const [records, setRecords] = useState(() =>
      structuredClone(demoSampleSubmissions),
    ),
    [report, setReport] = useState(newSubmission);
  const [baseline, setBaseline] = useState(() =>
      JSON.stringify(newSubmission()),
    ),
    [tab, setTab] = useState("form"),
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
  function save() {
    const nextErrors = validateSubmission(report, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
      return;
    }
    try {
      const result = saveSubmission(records, report, crypto.randomUUID());
      setRecords(result.records);
      setReport(result.saved);
      setBaseline(JSON.stringify(result.saved));
      setMessage("บันทึกข้อมูลตัวอย่างแล้ว · ไม่ส่งข้อมูลหรือเปลี่ยนสต็อก");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบส่งตัวอย่าง"
        description="จัดการตัวอย่างที่นำส่งวิเคราะห์และบันทึกผลรายตัวอย่าง"
        actions={
          <StatusBadge tone="info">UI MOCK · ไม่เชื่อมระบบจริง</StatusBadge>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="มุมมองใบส่งตัวอย่าง">
            <TabsTrigger value="form">สร้างใบส่งตัวอย่าง</TabsTrigger>
            <TabsTrigger value="history">ประวัติใบส่งตัวอย่าง</TabsTrigger>
          </TabsList>
        </div>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        <TabsContent value="form" className="mt-3 min-w-0">
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
        </TabsContent>
        <TabsContent value="history" className="mt-3 min-w-0">
          <SampleSubmissionHistory
            records={records}
            onEdit={request}
            onView={(r) => setView({ id: r.id, print: false })}
            onPrint={(r) => setView({ id: r.id, print: true })}
            onDelete={(r) => {
              setRecords((current) => deleteSubmission(current, r.id));
              if (report.id === r.id) open(newSubmission());
              if (view?.id === r.id) setView(null);
              setMessage("ลบข้อมูลตัวอย่างแล้ว");
            }}
          />
        </TabsContent>
      </Tabs>
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
