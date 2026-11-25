"use client";

import { OrganicLoadStatus, useOrganicDocuments } from "../organic-documents/use-organic-documents";
import { useEffect, useRef, useState } from "react";

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
import { DocumentViewActions, PageHeader } from "@/src/components/factory/patterns";

import {
  ORGANIC_EXTRACTION_FORM_TITLE,
  blankOrganicExtractionSheet,
  validateOrganicExtractionSheet,
  type OrganicExtractionErrors,
  type OrganicExtractionTemperatureSheet,
} from "./organic_extraction_temperature_domain";
import { OrganicExtractionTemperatureForm } from "./organic_extraction_temperature_form";
import { OrganicExtractionTemperatureHistory } from "./organic_extraction_temperature_history";
import { OrganicExtractionTemperatureDetail } from "./organic_extraction_temperature_detail";

type TabKey = "form" | "history";
type MessageKind = "success" | "error";

type ActiveView = {
  id: string;
  print: boolean;
};

export function OrganicExtractionTemperatureWorkspace() {
  const documents = useOrganicDocuments<OrganicExtractionTemperatureSheet>("organic_extraction_temperature");
  const { records, busy, loading, loadError } = documents;
  const [draft, setDraft] = useState<OrganicExtractionTemperatureSheet>(
    blankOrganicExtractionSheet,
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankOrganicExtractionSheet()),
  );
  const [tab, setTab] = useState<TabKey>("history");
  const [errors, setErrors] = useState<OrganicExtractionErrors>({});
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("success");
  const [pendingSheet, setPendingSheet] =
    useState<OrganicExtractionTemperatureSheet | null>(null);
  const [deleteSheet, setDeleteSheet] =
    useState<OrganicExtractionTemperatureSheet | null>(null);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const isEditing = Boolean(draft.id);
  const hasUnsavedChanges = JSON.stringify(draft) !== baseline;
  const activeSheet = activeView
    ? (records.find((sheet) => sheet.id === activeView.id) ?? null)
    : null;

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [errors]);

  function openSheet(sheet: OrganicExtractionTemperatureSheet) {
    const next = structuredClone(sheet);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setErrors({});
    setMessage("");
    setTab("form");
  }

  function requestOpenSheet(sheet: OrganicExtractionTemperatureSheet) {
    if (hasUnsavedChanges) {
      setPendingSheet(structuredClone(sheet));
      return;
    }

    openSheet(sheet);
  }

  function handleNew() {
    requestOpenSheet(blankOrganicExtractionSheet());
  }

  async function handleSave() {
    if (busy || loading || loadError) return;
    const validationErrors = validateOrganicExtractionSheet(draft);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessageKind("error");
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ");
      setTab("form");
      return;
    }

    try {
      const saved = await documents.save(draft);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      setErrors({});
      setMessageKind("success");
      setMessage("บันทึกเอกสารเรียบร้อยแล้ว");
      setTab("history");
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
      );
      setTab("form");
    }
  }

  function handleEdit(sheet: OrganicExtractionTemperatureSheet) {
    setActiveView(null);
    requestOpenSheet(sheet);
  }

  function handleView(sheet: OrganicExtractionTemperatureSheet) {
    setActiveView({ id: sheet.id, print: false });
  }

  function handlePrint(sheet: OrganicExtractionTemperatureSheet) {
    setActiveView({ id: sheet.id, print: true });
  }

  async function handleDeleteConfirm() {
    if (!deleteSheet || busy || loading || loadError) {
      return;
    }

    const deletedId = deleteSheet.id;
    try {
      await documents.remove(deleteSheet);
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "ไม่สามารถลบเอกสารได้");
      return;
    }

    if (draft.id === deletedId) {
      const next = blankOrganicExtractionSheet();
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setErrors({});
    }

    if (activeView?.id === deletedId) {
      setActiveView(null);
    }

    setDeleteSheet(null);
    setMessageKind("success");
    setMessage("ลบเอกสารออกจากประวัติแล้ว");
  }

  return (
    <div className="min-w-0 space-y-5">
      <OrganicLoadStatus {...documents} />
      <PageHeader
        title={ORGANIC_EXTRACTION_FORM_TITLE}
        description="บันทึกการใช้วัตถุดิบ อุณหภูมิ และ pH แยก 2 รอบการผลิต"
        actions={<DocumentViewActions showingForm={tab === "form"} createLabel="สร้างเอกสารใหม่" onCreate={handleNew} onHistory={() => setTab("history")} />}
      />

      <div className="min-w-0">


        {message && (
          <p
            role={messageKind === "error" ? "alert" : "status"}
            className={
              messageKind === "error"
                ? "mt-3 text-sm text-danger"
                : "mt-3 text-sm text-primary"
            }
          >
            {message}
          </p>
        )}

        {tab === "form" && (<div className="mt-3 min-w-0 space-y-4">
          {isEditing && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
              <p className="min-w-0 wrap-break-word text-sm text-foreground">
                กำลังแก้ไขเอกสาร
                <span className="ml-2 font-semibold">{draft.id}</span>
              </p>
              <Button type="button" variant="outline" onClick={handleNew}>
                สร้างเอกสารใหม่
              </Button>
            </div>
          )}

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
                {Object.entries(errors).map(([key, error]) => (
                  <li key={key}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <fieldset disabled={busy || loading || Boolean(loadError)} className="min-w-0">
            <OrganicExtractionTemperatureForm
              sheet={draft}
              errors={errors}
              onChange={(nextSheet: OrganicExtractionTemperatureSheet) => {
                setDraft(nextSheet);
                setMessage("");
                if (Object.keys(errors).length > 0) {
                  setErrors({});
                }
              }}
              onSave={handleSave}
              onReset={handleNew}
            />
          </fieldset>
        </div>)}

        {tab === "history" && (<div className="mt-3 min-w-0">
          <OrganicExtractionTemperatureHistory
            records={records}
            onEdit={handleEdit}
            onView={handleView}
            onPrint={handlePrint}
            onDelete={(sheet: OrganicExtractionTemperatureSheet) =>
              setDeleteSheet(sheet)
            }
          />
        </div>)}
      </div>

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
              ข้อมูลที่แก้ไขค้างอยู่จะหายไปเมื่อเปิดเอกสารอื่นหรือเริ่มเอกสารใหม่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปแก้ไข</AlertDialogCancel>
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
              ต้องการลบใบบันทึกการใช้วัตถุสกัดนี้หรือไม่?
            </AlertDialogTitle>
            <AlertDialogDescription>
              เอกสารนี้จะไม่แสดงในประวัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction disabled={busy || loading || Boolean(loadError)} onClick={() => void handleDeleteConfirm()}>
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrganicExtractionTemperatureDetail
        sheet={activeSheet}
        print={activeView?.print ?? false}
        onClose={() => setActiveView(null)}
        onEdit={handleEdit}
        onPrint={handlePrint}
      />
    </div>
  );
}
