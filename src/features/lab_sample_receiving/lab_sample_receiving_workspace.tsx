
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

import {
  PageHeader,
  StatusBadge,
} from "@/src/components/factory/patterns";

import { demoLabSampleReceivingSheets } from "@/src/lib/mock-data/lab-sample-receiving";

import {
  blankLabSheet,
  saveLabSheet,
  validateLabSheet,
  deleteLabSheet,
  type LabSampleReceivingSheet,
  type LabSampleErrors,
} from "./lab_sample_receiving_domain";

import { LabSampleReceivingForm } from "./lab_sample_receiving_form";
import { LabSampleReceivingHistory } from "./lab_sample_receiving_history";
import { LabSampleReceivingDetail } from "./lab_sample_receiving_detail";

/* ---------------- types ---------------- */

type TabKey = "form" | "history";

type ActiveView = {
  id: string;
  print: boolean;
};

/* ---------------- initial state ---------------- */

const INITIAL_ROW_ID = "initial-lab-row";

/* ---------------- component ---------------- */

export function LabSampleReceivingWorkspace() {
  /* ---------------- document state ---------------- */

  const [records, setRecords] = useState<
    LabSampleReceivingSheet[]
  >(() => structuredClone(demoLabSampleReceivingSheets));

  const [draft, setDraft] =
    useState<LabSampleReceivingSheet>(() =>
      blankLabSheet(INITIAL_ROW_ID),
    );

  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankLabSheet(INITIAL_ROW_ID)),
  );

  /* ---------------- UI state ---------------- */

  const [tab, setTab] = useState<TabKey>("form");

  const [errors, setErrors] =
    useState<LabSampleErrors>({});

  const [message, setMessage] = useState("");

  const [pendingSheet, setPendingSheet] =
    useState<LabSampleReceivingSheet | null>(null);

  const [deleteSheet, setDeleteSheet] =
    useState<LabSampleReceivingSheet | null>(null);

  const [activeView, setActiveView] =
    useState<ActiveView | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  /* ---------------- derived state ---------------- */

  const isEditing = Boolean(draft.id);

  const hasUnsavedChanges =
    JSON.stringify(draft) !== baseline;

  const activeSheet = activeView
    ? records.find(
        (sheet) => sheet.id === activeView.id,
      ) ?? null
    : null;

  /* ---------------- open document ---------------- */

  function openSheet(sheet: LabSampleReceivingSheet) {
    const next = structuredClone(sheet);

    setDraft(next);
    setBaseline(JSON.stringify(next));

    setErrors({});
    setMessage("");
    setTab("form");
  }

  function requestOpenSheet(
    sheet: LabSampleReceivingSheet,
  ) {
    if (hasUnsavedChanges) {
      setPendingSheet(structuredClone(sheet));
      return;
    }

    openSheet(sheet);
  }

  /* ---------------- new document ---------------- */

  function handleNew() {
    requestOpenSheet(
      blankLabSheet(crypto.randomUUID()),
    );
  }

  /* ---------------- save ---------------- */

  function handleSave() {
    const validationErrors = validateLabSheet(draft);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage(
        "ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ",
      );

      errorSummaryRef.current?.focus();

      return;
    }

    try {
      const result = saveLabSheet(
        records,
        draft,
        crypto.randomUUID(),
        new Date().toISOString(),
      );

      setRecords(result.records);
      setDraft(result.saved);

      setBaseline(JSON.stringify(result.saved));

      setErrors({});

      setMessage(
        "บันทึกข้อมูลจำลองเรียบร้อยแล้ว",
      );

      setTab("history");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกข้อมูลได้",
      );
    }
  }

  /* ---------------- edit ---------------- */

  function handleEdit(sheet: LabSampleReceivingSheet) {
    setActiveView(null);
    requestOpenSheet(sheet);
  }

  /* ---------------- view ---------------- */

  function handleView(sheet: LabSampleReceivingSheet) {
    setActiveView({
      id: sheet.id,
      print: false,
    });
  }

  /* ---------------- print ---------------- */

  function handlePrint(sheet: LabSampleReceivingSheet) {
    setActiveView({
      id: sheet.id,
      print: true,
    });
  }

  /* ---------------- delete ---------------- */

  function handleDeleteConfirm() {
    if (!deleteSheet) {
      return;
    }

    const deletedId = deleteSheet.id;

    setRecords((current) =>
      deleteLabSheet(current, deletedId),
    );

    if (draft.id === deletedId) {
      const next = blankLabSheet(
        crypto.randomUUID(),
      );

      setDraft(next);
      setBaseline(JSON.stringify(next));

      setErrors({});
    }

    if (activeView?.id === deletedId) {
      setActiveView(null);
    }

    setDeleteSheet(null);

    setMessage(
      "ลบข้อมูลจำลองเรียบร้อยแล้ว",
    );
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-w-0 space-y-5">
      {/* Page Header */}

      <PageHeader
        title="i-Lab แบบบันทึกรับตัวอย่าง"
        description="จัดการข้อมูลการรับตัวอย่างเพื่อตรวจวิเคราะห์"
        actions={
          <StatusBadge tone="info">
            UI MOCK · ไม่เชื่อมระบบจริง
          </StatusBadge>
        }
      />

      {/* Tabs */}

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(
            value === "history" ? "history" : "form",
          )
        }
        className="min-w-0"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="เมนูแบบบันทึกรับตัวอย่าง">
            <TabsTrigger value="form">
              กรอกข้อมูล
            </TabsTrigger>

            <TabsTrigger value="history">
              ดูประวัติ
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Message */}

        {message && (
          <p
            role="status"
            className="text-sm text-primary"
          >
            {message}
          </p>
        )}

        {/* Form Tab */}

        <TabsContent
          value="form"
          className="mt-3 min-w-0 space-y-4"
        >
          {isEditing && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <div className="text-sm text-foreground">
                กำลังแก้ไขแบบบันทึก
                <span className="ml-2 font-semibold">
                  {draft.id}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleNew}
              >
                สร้างแบบบันทึกใหม่
              </Button>
            </div>
          )}

          {/* Error Summary */}

          {Object.keys(errors).length > 0 && (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              role="alert"
              className="scroll-mt-20 rounded-lg border border-danger/30 bg-danger/5 p-4 outline-none"
            >
              <p className="font-medium text-danger">
                กรุณาตรวจสอบข้อมูลต่อไปนี้
              </p>

              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger">
                {Object.entries(errors).map(
                  ([key, error]) => (
                    <li key={key}>
                      {error}
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}

          {/* Form Component */}

          <LabSampleReceivingForm
            sheet={draft}
            errors={errors}
            onChange={(nextSheet) => {
              setDraft(nextSheet);
              setMessage("");
            }}
            onSave={handleSave}
            onReset={handleNew}
          />
        </TabsContent>

        {/* History Tab */}

        <TabsContent
          value="history"
          className="mt-3 min-w-0"
        >
          <LabSampleReceivingHistory
            records={records}
            onEdit={handleEdit}
            onView={handleView}
            onPrint={handlePrint}
            onDelete={(sheet) =>
              setDeleteSheet(sheet)
            }
          />
        </TabsContent>
      </Tabs>

      {/* Confirm Unsaved Changes */}

      <AlertDialog
        open={pendingSheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingSheet(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ต้องการละทิ้งข้อมูลที่ยังไม่ได้บันทึก?
            </AlertDialogTitle>

            <AlertDialogDescription>
              คุณมีข้อมูลที่แก้ไขค้างอยู่
              หากดำเนินการต่อ
              การเปลี่ยนแปลงที่ยังไม่ได้บันทึกจะหายไป
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              กลับไปแก้ไข
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                if (pendingSheet) {
                  openSheet(pendingSheet);
                }

                setPendingSheet(null);
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete */}

      <AlertDialog
        open={deleteSheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSheet(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ต้องการลบแบบบันทึกนี้หรือไม่?
            </AlertDialogTitle>

            <AlertDialogDescription>
              ข้อมูลนี้จะถูกลบออกจากรายการจำลอง
              และไม่สามารถเรียกคืนจากสถานะปัจจุบันได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDeleteConfirm}
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View / Print Modal */}

      <LabSampleReceivingDetail
        sheet={activeSheet}
        print={activeView?.print ?? false}
        onClose={() => setActiveView(null)}
        onEdit={handleEdit}
        onPrint={handlePrint}
      />
    </div>
  );
}
