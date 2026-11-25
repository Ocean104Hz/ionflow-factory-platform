"use client";

import { OrganicLoadStatus, useOrganicDocuments } from "../organic-documents/use-organic-documents";
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
} from "@/src/components/factory/patterns";


import {
  ORGANIC_RAW_MATERIAL_FORM_TITLE,
  blankOrganicRawMaterialSheet,
  validateOrganicRawMaterialSheet,
  type OrganicRawMaterialReceivingSheet,
  type OrganicRawMaterialErrors,
} from "./organic_raw_material_receiving_domain";

import { OrganicRawMaterialReceivingForm } from "./organic_raw_material_receiving_form";
import { OrganicRawMaterialReceivingHistory } from "./organic_raw_material_receiving_history";
import { OrganicRawMaterialReceivingDetail } from "./organic_raw_material_receiving_detail";

/* ---------------- types ---------------- */

type TabKey = "form" | "history";

type MessageKind = "success" | "error";

type ActiveView = {
  id: string;
  print: boolean;
};

/* ---------------- component ---------------- */

export function OrganicRawMaterialReceivingWorkspace() {
  /* ---------------- document state ---------------- */

  const documents = useOrganicDocuments<OrganicRawMaterialReceivingSheet>("organic_raw_material_receiving");
  const { records, busy, loading, loadError } = documents;
  const [draft, setDraft] =
    useState<OrganicRawMaterialReceivingSheet>(() =>
      blankOrganicRawMaterialSheet(),
    );

  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankOrganicRawMaterialSheet()),
  );

  /* ---------------- UI state ---------------- */

  const [tab, setTab] = useState<TabKey>("form");

  const [errors, setErrors] =
    useState<OrganicRawMaterialErrors>({});

  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("success");

  const [pendingSheet, setPendingSheet] =
    useState<OrganicRawMaterialReceivingSheet | null>(null);

  const [deleteSheet, setDeleteSheet] =
    useState<OrganicRawMaterialReceivingSheet | null>(null);

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

  function openSheet(sheet: OrganicRawMaterialReceivingSheet) {
    const next = structuredClone(sheet);

    setDraft(next);
    setBaseline(JSON.stringify(next));

    setErrors({});
    setMessage("");
    setTab("form");
  }

  function requestOpenSheet(
    sheet: OrganicRawMaterialReceivingSheet,
  ) {
    if (hasUnsavedChanges) {
      setPendingSheet(structuredClone(sheet));
      return;
    }

    openSheet(sheet);
  }

  /* ---------------- new document ---------------- */

  function handleNew() {
    requestOpenSheet(blankOrganicRawMaterialSheet());
  }

  /* ---------------- save ---------------- */

  async function handleSave() {
    if (busy || loading || loadError) return;
    const validationErrors = validateOrganicRawMaterialSheet(draft);

    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessageKind("error");
      setMessage(
        "ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ",
      );

      errorSummaryRef.current?.focus();

      return;
    }

    try {
      const saved = await documents.save(draft);
      setDraft(saved);

      setBaseline(JSON.stringify(saved));

      setErrors({});

      setMessageKind("success");
      setMessage(
        "บันทึกเอกสารเรียบร้อยแล้ว",
      );

      setTab("history");
    } catch (error) {
      setMessageKind("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกข้อมูลได้",
      );
    }
  }

  /* ---------------- edit ---------------- */

  function handleEdit(sheet: OrganicRawMaterialReceivingSheet) {
    setActiveView(null);
    requestOpenSheet(sheet);
  }

  /* ---------------- view ---------------- */

  function handleView(sheet: OrganicRawMaterialReceivingSheet) {
    setActiveView({
      id: sheet.id,
      print: false,
    });
  }

  /* ---------------- print ---------------- */

  function handlePrint(sheet: OrganicRawMaterialReceivingSheet) {
    setActiveView({
      id: sheet.id,
      print: true,
    });
  }

  /* ---------------- delete ---------------- */

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
      const next = blankOrganicRawMaterialSheet();

      setDraft(next);
      setBaseline(JSON.stringify(next));

      setErrors({});
    }

    if (activeView?.id === deletedId) {
      setActiveView(null);
    }

    setDeleteSheet(null);

    setMessageKind("success");
    setMessage(
      "ลบเอกสารออกจากประวัติแล้ว",
    );
  }

  /* ---------------- render ---------------- */

  return (
    <div className="min-w-0 space-y-5">
      <OrganicLoadStatus {...documents} />
      {/* Page Header */}

      <PageHeader
        title={ORGANIC_RAW_MATERIAL_FORM_TITLE}
        description="ตรวจรับและบันทึกวัตถุดิบประจำวัน"
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
          <TabsList aria-label="เมนูใบตรวจรับวัตถุดิบ">
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
            role={messageKind === "error" ? "alert" : "status"}
            className={messageKind === "error" ? "text-sm text-danger" : "text-sm text-primary"}
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
                กำลังแก้ไขใบตรวจรับวัตถุดิบ
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

          <fieldset disabled={busy || loading || Boolean(loadError)} className="min-w-0">
            <OrganicRawMaterialReceivingForm
              sheet={draft}
              errors={errors}
              onChange={(nextSheet) => {
                setDraft(nextSheet);
                setMessage("");
              }}
              onSave={handleSave}
              onReset={handleNew}
            />
          </fieldset>
        </TabsContent>

        {/* History Tab */}

        <TabsContent
          value="history"
          className="mt-3 min-w-0"
        >
          <OrganicRawMaterialReceivingHistory
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
              ต้องการลบใบตรวจรับวัตถุดิบนี้หรือไม่?
            </AlertDialogTitle>

            <AlertDialogDescription>
              เอกสารนี้จะไม่แสดงในประวัติ
              และไม่สามารถเรียกคืนจากสถานะปัจจุบันได้
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              ยกเลิก
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={busy || loading || Boolean(loadError)} onClick={() => void handleDeleteConfirm()}
            >
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View / Print Modal */}

      <OrganicRawMaterialReceivingDetail
        sheet={activeSheet}
        print={activeView?.print ?? false}
        onClose={() => setActiveView(null)}
        onEdit={handleEdit}
        onPrint={handlePrint}
      />
    </div>
  );
}
