"use client";

import { OrganicLoadStatus, useOrganicDocuments } from "../organic-documents/use-organic-documents";
import { useRef, useState } from "react";
import { FilePlus2, Printer } from "lucide-react";

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
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { PageHeader } from "@/src/components/factory/patterns";

import {
  createBlankEffervescentMaterialLedgerSheet,
  EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT,
  type EffervescentMaterialLedgerSheet,
} from "./effervescent_material_ledger_domain";
import { EffervescentMaterialLedgerDetail } from "./effervescent_material_ledger_detail";
import { EffervescentMaterialLedgerForm } from "./effervescent_material_ledger_form";
import { EffervescentMaterialLedgerHistory } from "./effervescent_material_ledger_history";
import { EffervescentMaterialLedgerPaper } from "./effervescent_material_ledger_paper";

type TabKey = "form" | "history";

const INITIAL_DOCUMENT_KEY = "effervescent-initial";

export function EffervescentMaterialLedgerWorkspace() {
  const documents = useOrganicDocuments<EffervescentMaterialLedgerSheet>("effervescent_material_ledger");
  const { records, busy, loading, loadError } = documents;
  const [draft, setDraft] = useState<EffervescentMaterialLedgerSheet>(() =>
    createBlankEffervescentMaterialLedgerSheet(INITIAL_DOCUMENT_KEY),
  );
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify(createBlankEffervescentMaterialLedgerSheet(INITIAL_DOCUMENT_KEY)),
  );

  const [tab, setTab] = useState<TabKey>("form");
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [pendingSheet, setPendingSheet] = useState<EffervescentMaterialLedgerSheet | null>(null);
  const [deleteSheet, setDeleteSheet] = useState<EffervescentMaterialLedgerSheet | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [activePrintId, setActivePrintId] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const hasUnsavedChanges = JSON.stringify(draft) !== baseline;
  const activeDetailSheet = activeDetailId
    ? records.find((sheet) => sheet.id === activeDetailId) ?? null
    : null;
  const activePrintSheet = activePrintId
    ? records.find((sheet) => sheet.id === activePrintId) ?? null
    : null;

  function openSheet(sheet: EffervescentMaterialLedgerSheet) {
    const next = structuredClone(sheet);
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setTab("form");
    setMessage("");
  }

  function requestOpenSheet(sheet: EffervescentMaterialLedgerSheet) {
    if (hasUnsavedChanges) {
      setPendingSheet(structuredClone(sheet));
      return;
    }

    openSheet(sheet);
  }

  function handleNew() {
    requestOpenSheet(createBlankEffervescentMaterialLedgerSheet(crypto.randomUUID()));
  }

  async function handleSave() {
    if (busy || loading || loadError) return;
    try {
      const saved = await documents.save(draft);
      setDraft(saved);
      setBaseline(JSON.stringify(saved));
      setMessageError(false);
      setMessage("บันทึกเอกสารเรียบร้อยแล้ว");
      setTab("history");
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "ไม่สามารถบันทึกเอกสารได้");
    }
  }

  function handleEdit(sheet: EffervescentMaterialLedgerSheet) {
    setActiveDetailId(null);
    setActivePrintId(null);
    requestOpenSheet(sheet);
  }

  function handleView(sheet: EffervescentMaterialLedgerSheet) {
    setActivePrintId(null);
    setActiveDetailId(sheet.id);
  }

  function handlePrintPreview(sheet: EffervescentMaterialLedgerSheet) {
    setActiveDetailId(null);
    setActivePrintId(sheet.id);
  }

  async function handleConfirmDelete() {
    if (!deleteSheet || busy || loading || loadError) {
      return;
    }

    const deletedId = deleteSheet.id;
    try {
      await documents.remove(deleteSheet);
    } catch (error) {
      setMessageError(true);
      setMessage(error instanceof Error ? error.message : "ไม่สามารถลบเอกสารได้");
      return;
    }

    if (draft.id === deletedId) {
      const next = createBlankEffervescentMaterialLedgerSheet(crypto.randomUUID());
      setDraft(next);
      setBaseline(JSON.stringify(next));
    }

    setActiveDetailId(null);
    setActivePrintId(null);
    setDeleteSheet(null);
    setMessageError(false);
    setMessage("ลบเอกสารออกจากประวัติแล้ว");
  }

  function handleBrowserPrint() {
    if (!paperRef.current) {
      setMessage("ไม่พบเอกสารสำหรับพิมพ์");
      return;
    }

    // Open synchronously from the click to avoid popup blockers.
    const printWindow = window.open("", "_blank", "width=1200,height=850");

    if (!printWindow) {
      setMessage("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up");
      return;
    }

    printWindow.document.title = EFFERVESCENT_MATERIAL_LEDGER_DOCUMENT.title;

    // Reuse the application's compiled Tailwind styles in the print-only window.
    const base = printWindow.document.createElement("base");
    base.href = document.baseURI;
    printWindow.document.head.appendChild(base);

    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      printWindow.document.head.appendChild(node.cloneNode(true));
    });

    printWindow.document.body.className = "bg-white";
    const main = printWindow.document.createElement("main");
    main.className = "bg-white";
    main.appendChild(paperRef.current.cloneNode(true));
    printWindow.document.body.appendChild(main);

    const styleLinks = Array.from(
      printWindow.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    );
    const stylesheetReady = styleLinks.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) {
            resolve();
            return;
          }

          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    );

    void Promise.all(stylesheetReady)
      .then(() => printWindow.document.fonts.ready)
      .then(() => {
        if (!printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      })
      .catch(() => setMessage("เปิดเอกสารพิมพ์แล้ว แต่ไม่สามารถเรียกหน้าต่างพิมพ์อัตโนมัติได้ กรุณากด Ctrl+P ในหน้าต่างใหม่"));
  }

  return (
    <div className="min-w-0 space-y-5">
      <OrganicLoadStatus {...documents} />
      <PageHeader
        title="บันทึกการรับ - จ่าย วัตถุดิบเม็ดฟู่"
        description="แบบบันทึกวัตถุดิบเม็ดฟู่ตามเอกสาร FR-P2-36/Rev.00"
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value === "history" ? "history" : "form")}
        className="min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-full overflow-x-auto">
            <TabsList aria-label="เมนูบันทึกและประวัติวัตถุดิบเม็ดฟู่">
              <TabsTrigger value="form">กรอกข้อมูล</TabsTrigger>
              <TabsTrigger value="history">ดูประวัติ</TabsTrigger>
            </TabsList>
          </div>
          <Button type="button" variant="outline" onClick={handleNew}>
            <FilePlus2 className="size-4" aria-hidden="true" />
            สร้างแบบบันทึกใหม่
          </Button>
        </div>

        {message && (
          <p role={messageError ? "alert" : "status"} className={messageError ? "text-sm text-destructive" : "text-sm text-primary"}>
            {message}
          </p>
        )}

        <TabsContent value="form" className="mt-3 min-w-0 space-y-4">
          {draft.id && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
              กำลังแก้ไขเอกสาร <span className="break-all font-semibold">{draft.id}</span>
            </div>
          )}
          <fieldset disabled={busy || loading || Boolean(loadError)} className="min-w-0">
            <EffervescentMaterialLedgerForm
              sheet={draft}
              onChange={(next) => {
                setDraft(next);
                setMessage("");
              }}
              onSave={handleSave}
              onReset={handleNew}
            />
          </fieldset>
        </TabsContent>

        <TabsContent value="history" className="mt-3 min-w-0">
          <EffervescentMaterialLedgerHistory
            records={records}
            onView={handleView}
            onEdit={handleEdit}
            onPrint={handlePrintPreview}
            onDelete={(sheet) => setDeleteSheet(sheet)}
          />
        </TabsContent>
      </Tabs>

      <EffervescentMaterialLedgerDetail
        sheet={activeDetailSheet}
        onClose={() => setActiveDetailId(null)}
        onEdit={handleEdit}
        onPrint={handlePrintPreview}
      />

      <Dialog
        open={activePrintId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActivePrintId(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          variant="preview"
          className="sm:max-w-330"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>ตัวอย่างเอกสารก่อนพิมพ์</DialogTitle>
            <DialogDescription>แบบฟอร์ม FR-P2-36/Rev.00 · เลือกกระดาษ A4 แนวนอนเมื่อสั่งพิมพ์</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
            {activePrintSheet ? (
              <div ref={paperRef} className="min-w-max">
                <EffervescentMaterialLedgerPaper sheet={activePrintSheet} />
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">ไม่พบเอกสารสำหรับพิมพ์</p>
            )}
          </div>
          <DialogFooter className="shrink-0 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">ปิด</Button>
            </DialogClose>
            <Button type="button" onClick={handleBrowserPrint} disabled={!activePrintSheet}>
              <Printer className="size-4" aria-hidden="true" />
              พิมพ์เอกสาร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogTitle>ต้องการละทิ้งข้อมูลที่ยังไม่ได้บันทึก?</AlertDialogTitle>
            <AlertDialogDescription>หากดำเนินการต่อ ข้อมูลที่กำลังแก้ไขและยังไม่ได้บันทึกจะหายไป</AlertDialogDescription>
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
            <AlertDialogTitle>ต้องการลบเอกสารนี้หรือไม่?</AlertDialogTitle>
            <AlertDialogDescription>เอกสารนี้จะไม่แสดงในประวัติ</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction disabled={busy || loading || Boolean(loadError)} onClick={() => void handleConfirmDelete()}>
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
