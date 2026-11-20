"use client";

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { PageHeader, StatusBadge } from "@/src/components/factory/patterns";

import {
  ORGANIC_EXTRACTION_FORM_TITLE,
  blankOrganicExtractionSheet,
  deleteOrganicExtractionSheet,
  saveOrganicExtractionSheet,
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

type Props = {
  /** Optional mock records supplied by the page. No database connection. */
  initialRecords?: readonly OrganicExtractionTemperatureSheet[];
};

/**
 * In-memory workspace. The two rounds remain together in a single sheet,
 * but their B1-B6 quantities, temperatures and pH are independently stored.
 */
export function OrganicExtractionTemperatureWorkspace({
  initialRecords = [],
}: Props) {
  const [records, setRecords] = useState<OrganicExtractionTemperatureSheet[]>(
    () => structuredClone([...initialRecords]),
  );
  const [draft, setDraft] = useState<OrganicExtractionTemperatureSheet>(
    blankOrganicExtractionSheet,
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(blankOrganicExtractionSheet()),
  );
  const [tab, setTab] = useState<TabKey>("form");
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

  function handleSave() {
    const validationErrors = validateOrganicExtractionSheet(draft);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessageKind("error");
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ");
      setTab("form");
      return;
    }

    try {
      const result = saveOrganicExtractionSheet(
        records,
        draft,
        crypto.randomUUID(),
        new Date().toISOString(),
      );

      setRecords(result.records);
      setDraft(result.saved);
      setBaseline(JSON.stringify(result.saved));
      setErrors({});
      setMessageKind("success");
      setMessage("บันทึกข้อมูลจำลองเรียบร้อยแล้ว");
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

  function handleDeleteConfirm() {
    if (!deleteSheet) {
      return;
    }

    const deletedId = deleteSheet.id;
    setRecords((current) => deleteOrganicExtractionSheet(current, deletedId));

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
    setMessage("ลบข้อมูลจำลองเรียบร้อยแล้ว");
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title={ORGANIC_EXTRACTION_FORM_TITLE}
        description="บันทึกการใช้วัตถุดิบ อุณหภูมิ และ pH แยก 2 รอบการผลิต"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="info">UI MOCK · ไม่เชื่อมระบบจริง</StatusBadge>
            <Button type="button" variant="outline" onClick={handleNew}>
              สร้างเอกสารใหม่
            </Button>
          </div>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(value) =>
          setTab(value === "history" ? "history" : "form")
        }
        className="min-w-0"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="เมนูใบบันทึกการใช้วัตถุสกัดและอุณหภูมิ">
            <TabsTrigger value="form">กรอกข้อมูล</TabsTrigger>
            <TabsTrigger value="history">ดูประวัติ</TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="form" className="mt-3 min-w-0 space-y-4">
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
        </TabsContent>

        <TabsContent value="history" className="mt-3 min-w-0">
          <OrganicExtractionTemperatureHistory
            records={records}
            onEdit={handleEdit}
            onView={handleView}
            onPrint={handlePrint}
            onDelete={(sheet: OrganicExtractionTemperatureSheet) =>
              setDeleteSheet(sheet)
            }
          />
        </TabsContent>
      </Tabs>

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
              เอกสารจำลองนี้จะถูกลบออกจากรายการในหน้านี้ และไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
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
