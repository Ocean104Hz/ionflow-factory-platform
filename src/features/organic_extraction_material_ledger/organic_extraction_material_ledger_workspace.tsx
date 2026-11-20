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
  ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE,
  blankOrganicExtractionMaterialLedgerSheet,
  deleteOrganicExtractionMaterialLedgerSheet,
  saveOrganicExtractionMaterialLedgerSheet,
  validateOrganicExtractionMaterialLedgerSheet,
  type OrganicExtractionMaterialLedgerErrors,
  type OrganicExtractionMaterialLedgerSheet,
} from "./organic_extraction_material_ledger_domain";
import { OrganicExtractionMaterialLedgerForm } from "./organic_extraction_material_ledger_form";
import { OrganicExtractionMaterialLedgerHistory } from "./organic_extraction_material_ledger_history";
import { OrganicExtractionMaterialLedgerDetail } from "./organic_extraction_material_ledger_detail";

type TabKey = "form" | "history";
type MessageKind = "success" | "error";

type ActiveView = {
  id: string;
  print: boolean;
};

type Props = {
  /** Optional mock records supplied by the page. No database connection. */
  initialRecords?: readonly OrganicExtractionMaterialLedgerSheet[];
};

/**
 * In-memory receipt/issue ledger workspace.
 * Opening balances are entered manually for every new document.
 * Closing balances are calculated by the domain, not stored separately.
 */
export function OrganicExtractionMaterialLedgerWorkspace({
  initialRecords = [],
}: Props) {
  const [records, setRecords] = useState<OrganicExtractionMaterialLedgerSheet[]>(
    () => structuredClone([...initialRecords]),
  );
  const [draft, setDraft] = useState<OrganicExtractionMaterialLedgerSheet>(
    blankOrganicExtractionMaterialLedgerSheet,
  );
  const [baseline, setBaseline] = useState(
    () => JSON.stringify(blankOrganicExtractionMaterialLedgerSheet()),
  );
  const [tab, setTab] = useState<TabKey>("form");
  const [errors, setErrors] = useState<OrganicExtractionMaterialLedgerErrors>({});
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<MessageKind>("success");
  const [pendingSheet, setPendingSheet] =
    useState<OrganicExtractionMaterialLedgerSheet | null>(null);
  const [deleteSheet, setDeleteSheet] =
    useState<OrganicExtractionMaterialLedgerSheet | null>(null);
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

  function openSheet(sheet: OrganicExtractionMaterialLedgerSheet) {
    const next = structuredClone(sheet);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setErrors({});
    setMessage("");
    setTab("form");
  }

  function requestOpenSheet(sheet: OrganicExtractionMaterialLedgerSheet) {
    if (hasUnsavedChanges) {
      setPendingSheet(structuredClone(sheet));
      return;
    }

    openSheet(sheet);
  }

  function handleNew() {
    requestOpenSheet(blankOrganicExtractionMaterialLedgerSheet());
  }

  function handleSave() {
    const validationErrors = validateOrganicExtractionMaterialLedgerSheet(draft);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      setMessageKind("error");
      setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูลที่ระบุ");
      setTab("form");
      return;
    }

    try {
      const result = saveOrganicExtractionMaterialLedgerSheet(
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

  function handleEdit(sheet: OrganicExtractionMaterialLedgerSheet) {
    setActiveView(null);
    requestOpenSheet(sheet);
  }

  function handleView(sheet: OrganicExtractionMaterialLedgerSheet) {
    setActiveView({ id: sheet.id, print: false });
  }

  function handlePrint(sheet: OrganicExtractionMaterialLedgerSheet) {
    setActiveView({ id: sheet.id, print: true });
  }

  function handleDeleteConfirm() {
    if (!deleteSheet) {
      return;
    }

    const deletedId = deleteSheet.id;
    setRecords((current) =>
      deleteOrganicExtractionMaterialLedgerSheet(current, deletedId),
    );

    if (draft.id === deletedId) {
      const next = blankOrganicExtractionMaterialLedgerSheet();
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
        title={ORGANIC_EXTRACTION_MATERIAL_LEDGER_TITLE}
        description="บันทึกยอดยกมา รับเข้า จ่ายใช้ผลิต ปรับค่า และยอดคงเหลือวัตถุดิบต้มสกัด"
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
        onValueChange={(value) => setTab(value === "history" ? "history" : "form")}
        className="min-w-0"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label="เมนูบันทึกการรับ-จ่ายวัตถุดิบต้มสกัด">
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

          <OrganicExtractionMaterialLedgerForm
            sheet={draft}
            errors={errors}
            onChange={(nextSheet: OrganicExtractionMaterialLedgerSheet) => {
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
          <OrganicExtractionMaterialLedgerHistory
            records={records}
            onEdit={handleEdit}
            onView={handleView}
            onPrint={handlePrint}
            onDelete={(sheet: OrganicExtractionMaterialLedgerSheet) =>
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
              ต้องการลบบันทึกการรับ-จ่ายวัตถุดิบต้มสกัดนี้หรือไม่?
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

      <OrganicExtractionMaterialLedgerDetail
        sheet={activeSheet}
        print={activeView?.print ?? false}
        onClose={() => setActiveView(null)}
        onEdit={handleEdit}
        onPrint={handlePrint}
      />
    </div>
  );
}
