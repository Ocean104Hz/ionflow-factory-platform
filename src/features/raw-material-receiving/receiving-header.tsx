"use client";

import { useRef, useState, type ComponentProps } from "react";
import {
  FileSpreadsheet,
  Link2,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { ReceivingHistory } from "./receiving-history";
import { Label } from "@/src/components/ui/label";
import { DocumentViewActions, PageHeader, SectionCard } from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  formatThaiBuddhistDate,
  type InboundNumberPreview,
  type InboundReservation,
  todayInBangkok,
} from "./document-number";
import {
  blankReceivingItem,
  blankReceivingSigners,
  validateReceivingDraft,
  type ReceivingItem,
  type ReceivingSigners,
  type ReceivingValidation,
} from "./receiving-domain";
import type { SavedReceivingDocument } from "./receiving-mock-store";
import { warehouseRequest } from "@/src/features/inventory/warehouse-client";
import { ReceivingItemsSection } from "./receiving-items";
import { ReceivingSignersSection } from "./receiving-signers";

export type ReceivingHeaderValues = {
  location: string;
  receiveDate: string;
  poDate: string;
  documentNo: string;
  poNo: string;
  supplierCode: string;
  supplierName: string;
  prNo: string;
  warehouseCode: string;
  qcDocumentNumbers: string[];
  vendorBookNo: string;
  vendorDocumentNo: string;
};

function emptyReceivingHeader(): ReceivingHeaderValues {
  return {
    location: "",
    receiveDate: todayInBangkok(),
    poDate: "",
    documentNo: "",
    poNo: "",
    supplierCode: "",
    supplierName: "",
    prNo: "",
    warehouseCode: "",
    qcDocumentNumbers: [],
    vendorBookNo: "",
    vendorDocumentNo: "",
  };
}

type TextFieldProps = Omit<
  ComponentProps<typeof Input>,
  "id" | "value" | "onChange"
> & {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
};

function TextField({
  id,
  label,
  value,
  onValueChange,
  hint,
  error,
  ...props
}: TextFieldProps) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
      {hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ReceivingHeaderWorkspace() {
  const [form, setForm] = useState<ReceivingHeaderValues>(emptyReceivingHeader);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [items, setItems] = useState<ReceivingItem[]>(() => [
    blankReceivingItem("row-1", todayInBangkok()),
  ]);
  const [signers, setSigners] = useState<ReceivingSigners>(
    blankReceivingSigners,
  );
  const [note, setNote] = useState("");
  const [validation, setValidation] = useState<ReceivingValidation | null>(
    null,
  );
  const [saveNotice, setSaveNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const nextRowId = useRef(2);
  const [editingDocumentNo, setEditingDocumentNo] = useState<string | null>(
    null,
  );
  const [preview, setPreview] = useState<InboundNumberPreview | null>(null);
  const [reservation, setReservation] = useState<InboundReservation | null>(
    null,
  );
  const [generatingDocNo, setGeneratingDocNo] = useState(false);
  const [tab, setTab] = useState("history");
  const [version, setVersion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEditing = editingDocumentNo !== null;

  function clearSaveFeedback() {
    setSaveNotice("");
    setSaveError("");
    setValidation(null);
  }

  function change<K extends keyof ReceivingHeaderValues>(
    field: K,
    value: ReceivingHeaderValues[K],
  ) {
    if (field === "receiveDate" && isEditing) return;
    if (field === "receiveDate" && value !== form.receiveDate) {
      setPreview(null);
      setReservation(null);
      setForm((previous) => ({
        ...previous,
        receiveDate: String(value),
        documentNo: "",
      }));
      setNotice(
        form.documentNo
          ? `เปลี่ยนวันที่แล้ว กรุณายืนยันเลขใหม่ เลข ${form.documentNo} ที่จองไว้ยังคงอยู่จนหมดอายุ ไม่ได้ยกเลิกการจอง`
          : "",
      );
      setError("");
      clearSaveFeedback();
      return;
    }
    setForm((previous) => ({ ...previous, [field]: value }));
    setNotice("");
    setError("");
    clearSaveFeedback();
  }

  async function generateNumber() {
    if (isEditing || generatingDocNo) return;
    setGeneratingDocNo(true);
    try {
      setPreview(await warehouseRequest<InboundNumberPreview>("receiving", undefined, form.receiveDate));
      clearSaveFeedback();
      setError("");
    } catch (cause) {
      setNotice("");
      setError(
        cause instanceof Error
          ? cause.message
          : "ไม่สามารถสร้างเลขเอกสารได้",
      );
    } finally {
      setGeneratingDocNo(false);
    }
  }

  async function confirmNumber() {
    if (!preview || isEditing || generatingDocNo) return;
    setGeneratingDocNo(true);
    try {
      const result = await warehouseRequest<
        { ok: true; reservation: InboundReservation } | { ok: false; preview: InboundNumberPreview; message: string }
      >("receiving", { action: "reserve", date: form.receiveDate, expected: preview.documentNo });
      if (!result.ok) {
        setPreview(result.preview);
        setError(result.message);
        return;
      }
      const old = form.documentNo;
      setReservation(result.reservation);
      setForm((previous) => ({
        ...previous,
        documentNo: result.reservation.documentNo,
      }));
      setPreview(null);
      setError("");
      clearSaveFeedback();
      setNotice(
        `ยืนยันเลข ${result.reservation.documentNo} แล้ว หมดอายุ ${new Date(result.reservation.expiresAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}${old ? ` · เลขเดิม ${old} ยังจองอยู่จนหมดอายุ` : ""}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "จองเลขไม่สำเร็จ");
    } finally {
      setGeneratingDocNo(false);
    }
  }

  function openSavedDocument(saved: SavedReceivingDocument) {
    const opened = structuredClone(saved);
    setForm(opened.header);
    setItems(opened.items);
    setSigners(opened.signers);
    setNote(opened.note);
    nextRowId.current = Math.max(
      2,
      ...opened.items.map((item) =>
        /^row-\d+$/.test(item.id) ? Number(item.id.slice(4)) + 1 : 2,
      ),
    );
    setEditingDocumentNo(opened.header.documentNo);
    setVersion(opened.savedAt);
    setReservation(null);
    setPreview(null);
    setTab("form");
    clearSaveFeedback();
    setError("");
    setNotice(
      `กำลังแก้ไข ${opened.header.documentNo} · ไม่สามารถเปลี่ยนเลขเอกสารหรือวันที่รับเข้าได้`,
    );
  }

  function resetHeader() {
    setForm(emptyReceivingHeader());
    setItems([blankReceivingItem("row-1", todayInBangkok())]);
    nextRowId.current = 2;
    setSigners(blankReceivingSigners());
    setNote("");
    setError("");
    setEditingDocumentNo(null);
    setVersion(null);
    setReservation(null);
    setPreview(null);
    clearSaveFeedback();
    setNotice(
      "เริ่มเอกสารใหม่แล้ว เอกสารที่บันทึกไว้ยังอยู่ เลขจองที่ยังไม่ใช้คงอยู่จนหมดอายุและอาจนำกลับมาใช้หลังหมดอายุ",
    );
  }

  function updateItems(next: ReceivingItem[]) {
    setItems(next);
    clearSaveFeedback();
  }

  function addItem() {
    const id = `row-${nextRowId.current++}`;
    setItems((previous) => [
      ...previous,
      blankReceivingItem(id, form.receiveDate),
    ]);
    clearSaveFeedback();
  }

  async function saveDocument() {
    if (saving) return;
    const nextValidation = validateReceivingDraft(form, items);
    setValidation(nextValidation.valid ? null : nextValidation);
    setSaveNotice("");
    if (!nextValidation.valid) {
      setSaveError(
        "บันทึกไม่ได้ กรุณาตรวจสอบช่องกรอกที่แจ้งเตือนในส่วนหัวและตารางสินค้า",
      );
      return;
    }
    setSaving(true);
    try {
      const saved = await warehouseRequest<SavedReceivingDocument>("receiving", {
        action: "save", document: { header: form, items, note, signers }, version, token: reservation?.token,
      });
      setVersion(saved.savedAt);
      setEditingDocumentNo(saved.header.documentNo);
      setReservation(null);
      setSaveError("");
      setSaveNotice(
        `บันทึกเอกสาร ${saved.header.documentNo} แล้ว (${saved.items.length} รายการ, ${saved.amountTotal} บาท)`,
      );
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "บันทึกเอกสารไม่ได้",
      );
    }
  }

  const thaiDate = formatThaiBuddhistDate(form.receiveDate);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="รับวัตถุดิบและวัสดุ"
        description="บันทึกและเปิดใบรับวัตถุดิบและวัสดุ"
        actions={tab === "history" && editingDocumentNo ? (
          <ConfirmDialog
            title="สร้างใบรับใหม่?"
            description="หากใบรับที่เปิดไว้มีการแก้ไขที่ยังไม่ได้บันทึก ข้อมูลนั้นจะถูกแทนที่"
            trigger={<Button type="button" variant="outline" disabled={saving || generatingDocNo}><Plus aria-hidden="true" />สร้างใบรับ</Button>}
            onConfirm={() => { resetHeader(); setTab("form"); }}
          />
        ) : (
          <DocumentViewActions
            showingForm={tab === "form"}
            createLabel="สร้างใบรับ"
            disabled={saving || generatingDocNo}
            onCreate={() => setTab("form")}
            onHistory={() => setTab("history")}
          />
        )}
      />

      <div>

        {tab === "form" && (<div>
      <fieldset disabled={saving || generatingDocNo} className="min-w-0 space-y-5">
      <SectionCard
        title="ส่วนหัวเอกสาร"
        subtitle="กรอกข้อมูลเอกสารและกดสร้างเลข INB ก่อนดำเนินการขั้นตอนถัดไป"
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTab("history")}
            >
              เปิดใบรับเดิม
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="จะเปิดใช้งานหลังทำระบบเลือก PO"
            >
              <RefreshCw className="size-4" />
              เชื่อม PO เดิมอีกครั้ง
            </Button>
            <Button
              type="button"
              size="sm"
              disabled
              title="ยังไม่ได้ทำการดึงข้อมูลจาก PO"
            >
              <Search className="size-4" />
              ดึงจาก PO
            </Button>
            <Button
              type="button"
              size="sm"
              disabled
              title="การนำเข้า Excel จะอยู่ในเฟสถัดไป"
            >
              <FileSpreadsheet className="size-4" />
              นำเข้า Excel
            </Button>
          </div>
        }
      >
        <div className="grid min-w-0 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="min-w-0">
            <TextField
              id="inbound-location"
              label="สถานที่"
              placeholder="เลือก/พิมพ์คลัง/สถานที่จัดเก็บ"
              list="inbound-location-options"
              value={form.location}
              onValueChange={(value) => change("location", value)}
              error={validation?.header.location}
            />
            <datalist id="inbound-location-options">
              <option value="โรงงานกาญ 1" />
              <option value="โรงงานกาญ 3" />
            </datalist>
          </div>

          <TextField
            id="inbound-receive-date"
            label="วันที่รับเข้า"
            type="date"
            lang="th-TH"
            value={form.receiveDate}
            disabled={isEditing}
            onValueChange={(value) => change("receiveDate", value)}
            error={validation?.header.receiveDate}
            hint={
              isEditing
                ? "เอกสารเดิมใช้วันที่รับเข้าเดิม หากต้องการวันที่ใหม่ให้สร้างใบรับใหม่"
                : thaiDate
                  ? `วันที่แบบ พ.ศ.: ${thaiDate}`
                  : "เลือกวันที่รับเข้าก่อนสร้างเลขเอกสาร"
            }
          />

          <TextField
            id="inbound-po-date"
            label="วันที่ PO"
            type="date"
            lang="th-TH"
            value={form.poDate}
            error={validation?.header.poDate}
            onValueChange={(value) => change("poDate", value)}
          />

          <div className="grid min-w-0 content-start gap-1.5">
            <Label
              htmlFor="inbound-document-number"
              className="text-xs font-medium"
            >
              เอกสารเลขที่
            </Label>
            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <Input
                id="inbound-document-number"
                readOnly
                value={form.documentNo}
                placeholder="กดสร้างเลข INB"
                aria-invalid={Boolean(validation?.header.documentNo)}
                className="min-w-0 flex-1 font-medium tabular-nums"
                aria-describedby="inbound-number-hint"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateNumber}
                disabled={generatingDocNo || isEditing}
                className="shrink-0"
              >
                <Plus className="size-4" />
                สร้างเลข INB
              </Button>
            </div>
            <p
              id="inbound-number-hint"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              เลขเอกสารจำลองสำหรับทดสอบ ยังไม่ใช่การจองเลขกลางระหว่างผู้ใช้งาน ·
              เลขจะจองไว้ 24 ชั่วโมงเมื่อกดยืนยัน
            </p>
            {validation?.header.documentNo ? (
              <p role="alert" className="text-xs text-destructive">
                {validation.header.documentNo}
              </p>
            ) : null}
          </div>

          <TextField
            id="inbound-po-number"
            label="ใบสั่งซื้อเลขที่ PO"
            placeholder="เลือก/พิมพ์ใบสั่งซื้อเลขที่ PO"
            value={form.poNo}
            onValueChange={(value) => change("poNo", value)}
          />

          <TextField
            id="inbound-supplier-code"
            label="รหัสผู้จำหน่าย"
            placeholder="เลือก/พิมพ์รหัสผู้จำหน่าย"
            value={form.supplierCode}
            onValueChange={(value) => change("supplierCode", value)}
          />

          <TextField
            id="inbound-supplier-name"
            label="ชื่อผู้จำหน่าย"
            placeholder="เลือก/พิมพ์ชื่อผู้จำหน่าย"
            value={form.supplierName}
            onValueChange={(value) => change("supplierName", value)}
            error={validation?.header.supplierName}
          />

          <TextField
            id="inbound-pr-number"
            label="ใบขอสั่งซื้อเลขที่ PR No."
            placeholder="พิมพ์ใบขอสั่งซื้อเลขที่ PR No."
            value={form.prNo}
            onValueChange={(value) => change("prNo", value)}
          />

          <TextField
            id="inbound-warehouse-code"
            label="รหัสคลัง"
            placeholder="เลือก/พิมพ์รหัสคลัง"
            value={form.warehouseCode}
            onValueChange={(value) => change("warehouseCode", value)}
            error={validation?.header.warehouseCode}
          />
        </div>

        <div className="mt-5 grid min-w-0 gap-1.5">
          <Label htmlFor="inbound-qc-reference" className="text-xs font-medium">
            อ้างอิงเอกสารเลขที่ใบตรวจสอบคุณภาพวัตถุดิบ
          </Label>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
            <Input
              id="inbound-qc-reference"
              readOnly
              value={form.qcDocumentNumbers.join(", ")}
              placeholder="จะเลือกเอกสารใบตรวจสอบคุณภาพวัตถุดิบได้ในเฟสถัดไป"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              disabled
              size="sm"
              title="ยังไม่ได้เชื่อมหน้าต่างเลือกเอกสาร QC"
            >
              <Link2 className="size-4" />
              ผูกกับใบตรวจสอบคุณภาพ
            </Button>
            <Button type="button" variant="outline" disabled size="sm">
              ล้างการผูก
            </Button>
          </div>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 border-t pt-5 lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <p className="pt-1 text-sm font-medium">หลักฐานผู้จำหน่าย</p>
          <TextField
            id="inbound-vendor-book"
            label="ใบสั่งของเล่มที่"
            placeholder="พิมพ์ใบสั่งของเล่มที่"
            value={form.vendorBookNo}
            onValueChange={(value) => change("vendorBookNo", value)}
          />
          <TextField
            id="inbound-vendor-doc"
            label="เลขที่"
            placeholder="พิมพ์เลขที่"
            value={form.vendorDocumentNo}
            onValueChange={(value) => change("vendorDocumentNo", value)}
          />
        </div>

        {notice ? (
          <p
            role="status"
            className="mt-4 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-foreground"
          >
            {notice}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            เลข PO และ QC เป็นข้อมูลอ้างอิงที่กรอกเอง
          </p>
          <ConfirmDialog
            title="เริ่มเอกสารใหม่?"
            description="ข้อมูลที่ยังไม่บันทึกจะถูกล้าง ไม่ลบเอกสารที่บันทึกไว้ และเลขจองเดิมยังคงอยู่จนหมดอายุ"
            onConfirm={resetHeader}
            trigger={
              <Button type="button" variant="outline">
                <RefreshCw className="size-4" />
                เริ่มเอกสารใหม่
              </Button>
            }
          />
        </div>
      </SectionCard>

      {/* รูปภาพประกอบ */}
      <SectionCard title="รูปภาพประกอบ" subtitle="ยังไม่เปิดบันทึกรูปภาพประกอบ">
        <div className="rounded-xl border border-dashed border-border bg-surface p-6">
          <Input
            type="file"
            accept="image/*"
            disabled
            multiple
            className="cursor-pointer"
          />
        </div>
      </SectionCard>

      <ReceivingItemsSection
        items={items}
        onChange={updateItems}
        onAdd={addItem}
        note={note}
        onNoteChange={(value) => {
          setNote(value);
          clearSaveFeedback();
        }}
        validation={validation}
      />

      <ReceivingSignersSection
        value={signers}
        onChange={(value) => {
          setSigners(value);
          clearSaveFeedback();
        }}
      />

      <div className="no-print flex flex-col gap-3 rounded-xl border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {saveNotice ? (
            <p role="status" className="text-sm text-success">
              {saveNotice}
            </p>
          ) : null}
          {saveError ? (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          ) : null}
          {!saveNotice && !saveError ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              การบันทึกใบรับยังไม่เพิ่มยอดสต็อก
            </p>
          ) : null}
        </div>
        <Button type="button" onClick={saveDocument} disabled={saving} className="sm:min-w-32">
          <Save className="size-4" /> บันทึก
        </Button>
      </div>
      </fieldset>
        </div>)}
        {tab === "history" && (<div className="mt-4">
          <ReceivingHistory onOpen={openSavedDocument} />
        </div>)}
      </div>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open && !generatingDocNo) {
            setPreview(null);
            setError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันเลข INB</DialogTitle>
            <DialogDescription>
              กดใช้เลขนี้เพื่อจองหมายเลขเอกสารกลางเป็นเวลา 24 ชั่วโมง
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              <p
                className="break-all text-xl font-semibold"
                data-inbound-preview
              >
                {preview.documentNo}
              </p>
              <p>
                ปี ค.ศ. {preview.year} · เดือน{" "}
                {String(preview.month).padStart(2, "0")} · ลำดับ{" "}
                {preview.sequence}
              </p>
              {form.documentNo && (
                <p className="text-sm text-muted-foreground">
                  เมื่อยืนยันเปลี่ยนเลข เลขเดิม {form.documentNo}{" "}
                  ยังถูกจองจนหมดอายุ ไม่ได้ยกเลิกโดยอัตโนมัติ
                </p>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={confirmNumber}
              disabled={generatingDocNo}
            >
              ใช้เลขนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
