// NAN_QC_WEIGHT_ITECH_V1
"use client";

import { useRef, useState } from "react";

import { Button } from "@/src/components/ui/button";


import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";

import { useQcDocuments } from "@/src/features/qc-documents/use-qc-documents";
import { todayInBangkok } from "@/src/lib/date/thai-date";
import {
  blankQcWeightEntryDocument,
  validateQcWeightDocument,
  type QcProductWeightCheckDocument,
  type QcWeightErrors,
} from "./qc_product_weight_check_domain";

import { QcProductWeightCheckForm } from "./qc_product_weight_check_form";
import { QcProductWeightCheckHistory } from "./qc_product_weight_check_history";
import { QcProductWeightCheckDetail } from "./qc_product_weight_check_detail";

/* ---------------- types ---------------- */

type TabKey = "form" | "history";

type ActiveView = {
  id: string;
  print: boolean;
};

/* ---------------- constants ---------------- */

const INITIAL_ROW_ID = "qc-weight-initial-row";
function createNewDocument(
  rowId: string,
): QcProductWeightCheckDocument {
  const today = todayInBangkok();

  return {
    ...blankQcWeightEntryDocument(rowId),
    doc_no: "",
    doc_date: today,
    prepared_date: today,
    checked_date: today,
  };
}
export function QcProductWeightCheckWorkspace() {
  /* ---------------- document state ---------------- */

  const { records, persist, remove, loading, loadError, busy } = useQcDocuments<QcProductWeightCheckDocument>("qc_product_weight_check");

  const [draft, setDraft] =
    useState<QcProductWeightCheckDocument>(() =>
      createNewDocument(INITIAL_ROW_ID),
    );

  /* ---------------- UI state ---------------- */

  const [tab, setTab] = useState<TabKey>("form");

  const [errors, setErrors] =
    useState<QcWeightErrors>({});

  const [message, setMessage] = useState("");

  const [documentToDelete, setDocumentToDelete] =
    useState<QcProductWeightCheckDocument | null>(
      null,
    );

  const [activeView, setActiveView] =
    useState<ActiveView | null>(null);

  const errorSummaryRef = useRef<HTMLDivElement>(null);

  /* ---------------- derived state ---------------- */

  const isEditing = Boolean(draft.id);

  const activeDocument = activeView
    ? (records.find(
      (document) => document.id === activeView.id,
    ) ?? null)
    : null;

  /* ---------------- open document ---------------- */

  function openDocument(
    document: QcProductWeightCheckDocument,
  ) {
    const next = structuredClone(document);

    setDraft(next);

    setErrors({});
    setMessage("");
    setTab("form");
  }

  function requestOpenDocument(
    document: QcProductWeightCheckDocument,
  ) {
    openDocument(document);
  }

  /* ---------------- new document ---------------- */

  function handleNew() {
    requestOpenDocument(
      createNewDocument(crypto.randomUUID()),
    );
  }

  /* ---------------- save document ---------------- */

  async function handleSave() {
    const validationErrors =
      validateQcWeightDocument(draft, records);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessage(
        "ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ",
      );

      errorSummaryRef.current?.focus();
      return;
    }

    try {
      const saved = await persist(draft);
      setDraft(saved);


      setErrors({});
      setMessage(
        "บันทึกเอกสารแล้ว",
      );

      setTab("history");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกเอกสารได้",
      );
    }
  }

  /* ---------------- edit document ---------------- */

  function handleEdit(
    document: QcProductWeightCheckDocument,
  ) {
    setActiveView(null);
    requestOpenDocument(document);
  }

  /* ---------------- view document ---------------- */

  function handleView(
    document: QcProductWeightCheckDocument,
  ) {
    setActiveView({
      id: document.id,
      print: false,
    });
  }

  /* ---------------- print preview ---------------- */

  function handlePrint(
    document: QcProductWeightCheckDocument,
  ) {
    setActiveView({
      id: document.id,
      print: true,
    });
  }

  /* ---------------- delete document ---------------- */

  async function handleDeleteConfirm() {
    if (!documentToDelete) {
      return;
    }

    const deletedId = documentToDelete.id;

    try { await remove(deletedId); }
    catch (error) {
      setMessage(error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ");
      return;
    }

    if (draft.id === deletedId) {
      const next = blankQcWeightEntryDocument(
        crypto.randomUUID(),
      );

      setDraft(next);
      setErrors({});
    }

    if (activeView?.id === deletedId) {
      setActiveView(null);
    }

    setDocumentToDelete(null);
    setMessage("ลบเอกสารจากรายการแล้ว");
  }

  /* ---------------- render ---------------- */

  return (
    <div className="factory-itech-theme min-w-0 space-y-3 pt-3">
      {loading && <p role="status">กำลังโหลดเอกสาร…</p>}
      {loadError && <p role="alert" className="text-danger">{loadError} กรุณารีเฟรชหน้าเพื่อโหลดอีกครั้ง</p>}
      <fieldset disabled={busy} className="min-w-0">
        <Tabs value={tab} activationMode="manual" className="min-w-0 gap-3" onValueChange={(value) => {
          if (busy || loading || loadError) return;
          if (value === "form") setTab("form");
          else if (value === "history") setTab("history");
        }}>
          <TabsList aria-label="ใบบันทึกการตรวจเช็ค QC น้ำหนักผลิตภัณฑ์" className="factory-itech-tabs">
            <TabsTrigger value="form" disabled={busy || loading || !!loadError}>กรอกข้อมูล</TabsTrigger>
            <TabsTrigger value="history" disabled={busy || loading || !!loadError}>ดูประวัติ</TabsTrigger>
          </TabsList>

          {/* Status Message */}

          {message && (
            <p
              role="status"
              className="text-sm text-primary"
            >
              {message}
            </p>
          )}

          {/* Form Tab */}

          <TabsContent value="form" className="min-w-0 space-y-4">
            {isEditing && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                <div className="min-w-0 text-sm text-foreground">
                  กำลังแก้ไขเอกสาร
                  <span className="ml-2 font-semibold">
                    {draft.doc_no}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleNew}
                >
                  สร้างเอกสารใหม่
                </Button>
              </div>
            )}

            {/* Error Summary */}

            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              className="scroll-mt-20 outline-none"
            >
              {Object.keys(errors).length > 0 && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger/5 p-4"
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
            </div>

            {/* Form */}

            <QcProductWeightCheckForm
              document={draft}
              errors={errors}
              onChange={(nextDocument) => {
                setDraft(nextDocument);
                setMessage("");
              }}
              onSave={handleSave}
            />
          </TabsContent>

          {/* History Tab */}

          <TabsContent value="history" className="min-w-0">
            <QcProductWeightCheckHistory
              records={records}
              onEdit={handleEdit}
              onView={handleView}
              onPrint={handlePrint}
              onDelete={(document) =>
                setDocumentToDelete(document)
              }
            />
          </TabsContent>
        </Tabs>
      </fieldset>

      {/* Confirm Delete */}

      <AlertDialog
        open={documentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDocumentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ต้องการลบเอกสารนี้หรือไม่?
            </AlertDialogTitle>

            <AlertDialogDescription>
              เอกสาร{" "}
              {documentToDelete?.doc_no || "-"}
              {" "}
              จะถูกนำออกจากรายการและเก็บประวัติการลบ
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

      {/* Detail / Print Preview */}

      <QcProductWeightCheckDetail
        document={activeDocument}
        print={activeView?.print ?? false}
        onClose={() => setActiveView(null)}
        onEdit={handleEdit}
        onPrint={handlePrint}
      />
    </div>
  );
}
