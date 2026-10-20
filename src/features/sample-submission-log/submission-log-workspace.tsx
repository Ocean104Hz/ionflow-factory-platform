"use client";
import { useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
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
import { PageHeader, StatusBadge } from "@/src/components/factory/patterns";
import { demoSubmissionLogs } from "@/src/lib/mock-data/sample-submission-log";
import {
  blankLog,
  saveLog,
  validateLog,
  deleteLog,
  type SubmissionLog,
  type LogErrors,
} from "./submission-log-domain";
import { SubmissionLogSections } from "./submission-log-form";
import { SubmissionLogHistory } from "./submission-log-history";
import { SubmissionLogDetail } from "./submission-log-detail";

export function SubmissionLogWorkspace() {
  const [records, setRecords] = useState(() =>
      structuredClone(demoSubmissionLogs),
    ),
    [row, setRow] = useState(blankLog),
    [baseline, setBaseline] = useState(() => JSON.stringify(blankLog()));
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
  function save() {
    const issues = validateLog(row, records);
    setErrors(issues);
    if (Object.keys(issues).length) {
      setMessage("ยังบันทึกไม่ได้ กรุณาแก้ไขช่องที่ระบุ");
      summary.current?.focus();
      return;
    }
    try {
      const result = saveLog(records, row, crypto.randomUUID());
      setRecords(result.records);
      setRow(result.saved);
      setBaseline(JSON.stringify(result.saved));
      setMessage(
        "บันทึกข้อมูลตัวอย่างแล้ว · ไม่ใช่การรับงานจริงและไม่เปลี่ยนสต็อก",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกข้อมูลตัวอย่างไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="แบบบันทึกการส่งตัวอย่าง"
        description="บันทึกข้อมูลการนำส่งตัวอย่างเพื่อตรวจวิเคราะห์"
        actions={
          <StatusBadge tone="info">UI MOCK · ไม่เชื่อมระบบจริง</StatusBadge>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="มุมมองแบบบันทึกการส่งตัวอย่าง">
            <TabsTrigger value="form">สร้างแบบบันทึก</TabsTrigger>
            <TabsTrigger value="history">ประวัติแบบบันทึก</TabsTrigger>
          </TabsList>
        </div>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        <TabsContent value="form" className="mt-3 min-w-0">
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            {row.id && (
              <p className="break-all text-sm text-primary">
                กำลังแก้ไขข้อมูลสาธิต: {row.doc_no}
              </p>
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
              onChange={(r) => {
                setRow(r);
                setMessage("");
              }}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => request(blankLog())}
              >
                {row.id ? "ยกเลิกการแก้ไข / เริ่มใหม่" : "ล้างข้อมูล"}
              </Button>
              <Button type="submit">บันทึกข้อมูลตัวอย่าง</Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="history" className="mt-3 min-w-0">
          <SubmissionLogHistory
            records={records}
            onEdit={request}
            onView={(r) => setView({ id: r.id, print: false })}
            onPrint={(r) => setView({ id: r.id, print: true })}
            onDelete={(r) => {
              setRecords((current) => deleteLog(current, r.id));
              if (row.id === r.id) open(blankLog());
              if (view?.id === r.id) setView(null);
              setMessage("ลบข้อมูลตัวอย่างแล้ว");
            }}
          />
        </TabsContent>
      </Tabs>
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
