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
import { demoNCReports } from "@/src/lib/mock-data/nc-reports";
import {
  blankNC,
  validateNC,
  saveNC,
  deleteNC,
} from "./nc-report-mock-helpers";
import type { NCReport, NCErrors } from "./nc-report-types";
import { NCReportForm } from "./nc-report-form";
import { NCReportHistory } from "./nc-report-history";
import { NCReportDetail } from "./nc-report-detail";
import { NCReportPrintPreview } from "./nc-report-print-preview";

export function NCReportWorkspace() {
  const [records, setRecords] = useState(() => structuredClone(demoNCReports));
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
  function save() {
    const nextErrors = validateNC(report, records);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessage("กรุณาแก้ไขข้อมูลที่ระบุก่อนบันทึก");
      return;
    }
    try {
      const result = saveNC(records, report, crypto.randomUUID());
      setRecords(result.records);
      setReport(result.saved);
      setBaseline(JSON.stringify(result.saved));
      setMessage(
        "บันทึกข้อมูลตัวอย่างแล้ว · ไม่มีการส่งข้อมูลหรือเปลี่ยนสต็อก",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "บันทึกข้อมูลตัวอย่างไม่ได้");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบ NC"
        description="บันทึกและติดตามรายงานข้อบกพร่องของสินค้าและกระบวนการผลิต"
        actions={
          <StatusBadge tone="info">UI MOCK · ไม่เชื่อมระบบจริง</StatusBadge>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList aria-label="มุมมองใบ NC">
          <TabsTrigger value="form">สร้างใบ NC</TabsTrigger>
          <TabsTrigger value="history">ประวัติใบ NC</TabsTrigger>
        </TabsList>
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
        <TabsContent value="form" className="mt-3 min-w-0">
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
        </TabsContent>
        <TabsContent value="history" className="mt-3 min-w-0">
          <NCReportHistory
            records={records}
            onEdit={request}
            onView={(r) => setViewId(r.id)}
            onPrint={(r) => setPrintId(r.id)}
            onDelete={(r) => {
              setRecords((current) => deleteNC(current, r.id));
              if (report.id === r.id) open(blankNC());
              if (viewId === r.id) setViewId(null);
              if (printId === r.id) setPrintId(null);
              setMessage("ลบข้อมูลตัวอย่างแล้ว · ไม่เปลี่ยนสต็อก");
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
