"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { readFactoryCsrfToken } from "@/src/components/factory/use-settings-postgres";
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import type { DocumentKind } from "@/src/server/sales-hub/documents";

async function save(input: object) {
  const response = await fetch("/api/sales-hub/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": await readFactoryCsrfToken() },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) throw new Error(result?.message ?? "บันทึกข้อมูล W1-FF ไม่สำเร็จ");
}

export function CreateFoliarDocument({ orderId, kind }: { orderId: string; kind: DocumentKind }) {
  const router = useRouter();
  const action = kind === "INVOICE" ? "ออกใบแจ้งหนี้" : "บันทึกผลิตเสร็จและสร้างใบส่งสินค้า";
  return <ConfirmDialog
    title={action}
    description={kind === "INVOICE" ? "ระบบจะบันทึกราคากลาง W1-FF ที่ใช้ ณ ตอนออกเอกสาร" : "ยืนยันว่าผลิตเสร็จแล้ว ระบบจะสร้างใบส่งสินค้าฉบับร่าง"}
    trigger={<Button size="sm">{action}</Button>}
    onConfirm={async () => {
      await save({ kind, orderId });
      router.refresh();
    }}
  />;
}

export function EditFoliarPrice({ companyId, productId, unit, price, label }: { companyId: string; productId: string; unit: string; price: string | null; label: string }) {
  const router = useRouter();
  const [value, setValue] = useState(price ?? "");
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  return <form className="space-y-2" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    setNotice("");
    try {
      await save({ kind: "PRICE", companyId, productId, unit, price: value });
      setNotice("บันทึกราคาแล้ว");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setNotice(error instanceof Error ? error.message : "บันทึกราคาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }}>
    <div className="flex flex-wrap gap-2">
      <Input className="w-32" aria-label={label} aria-invalid={failed} type="text" inputMode="decimal" value={value} placeholder="เช่น 125.50" required disabled={busy} onChange={event => setValue(event.target.value)} />
      <Button size="sm" type="submit" disabled={busy || value === price}>{busy ? "กำลังบันทึก…" : "บันทึกราคา"}</Button>
    </div>
    {notice && <p role={failed ? "alert" : "status"} className={failed ? "text-sm text-danger" : "text-sm text-muted-foreground"}>{notice}</p>}
  </form>;
}

export function UpdateFoliarDelivery({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(form?: FormData) {
    const response = await fetch(`/api/sales-hub/delivery/${id}${form ? "" : "?action=pickup"}`, {
      method: "POST",
      headers: { "x-csrf-token": await readFactoryCsrfToken() },
      body: form,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok) throw new Error(body?.message ?? "บันทึกใบส่งสินค้าไม่สำเร็จ");
    setOpen(false);
    router.refresh();
  }
  if (status === "SUBMITTED") return <ConfirmDialog title="ยืนยันรับสินค้าแล้ว"
    description="ยืนยันเมื่อผู้ขนส่งรับสินค้าจากโรงงานแล้ว"
    trigger={<Button size="sm">ยืนยันรับสินค้า</Button>} onConfirm={() => update()} />;
  if (status !== "DRAFT") return <span>รับสินค้าแล้ว</span>;
  const fields = [
    ["carrier", "บริษัทขนส่ง", "ชื่อบริษัทขนส่ง", 200], ["driverName", "ชื่อคนขับ", "ชื่อและนามสกุล", 200],
    ["driverPhone", "เบอร์คนขับ", "เช่น 0812345678", 50], ["nationalId", "เลขบัตรประชาชนคนขับ", "ตัวเลข 13 หลัก", 13],
    ["plate", "ทะเบียนรถ", "เช่น กข 1234", 100], ["vehicleType", "ประเภทรถ (ถ้าทราบ)", "เช่น รถ 6 ล้อ", 100],
  ] as const;
  return <Dialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setError(""); } }}>
    <DialogTrigger asChild><Button size="sm">กรอกข้อมูลจัดส่ง</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto" onInteractOutside={(event) => event.preventDefault()}>
      <DialogHeader><DialogTitle>ส่งข้อมูลจัดส่งให้ Sales Hub</DialogTitle>
        <DialogDescription>แนบหลักฐาน 3 ไฟล์ ขนาดไม่เกิน 5 MiB ต่อไฟล์</DialogDescription></DialogHeader>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setBusy(true);
        setError("");
        try { await update(data); }
        catch (error) { setError(error instanceof Error ? error.message : "บันทึกใบส่งสินค้าไม่สำเร็จ"); }
        finally { setBusy(false); }
      }}>
        {fields.map(([name, label, placeholder, length]) => <label className="grid gap-1 text-sm" key={name}>{label}
          <Input name={name} placeholder={placeholder} required={name !== "vehicleType"} maxLength={length}
            pattern={name === "nationalId" ? "[0-9]{13}" : undefined} type={name === "driverPhone" ? "tel" : "text"} />
        </label>)}
        <label className="grid gap-1 text-sm">กำหนดรับสินค้า (เวลาไทย)<Input name="pickup" type="datetime-local" required /></label>
        {([["DRIVER_ID_DOCUMENT", "เอกสารคนขับ"], ["DRIVER_PHOTO", "รูปคนขับ"], ["VEHICLE_PHOTO", "รูปรถ"]] as const).map(([name, label]) =>
          <label className="grid gap-1 text-sm" key={name}>{label}
            <Input type="file" name={name} accept={`image/jpeg,image/png,image/webp${name === "DRIVER_ID_DOCUMENT" ? ",application/pdf" : ""}`} required />
          </label>)}
        {error && <p role="alert" className="text-danger sm:col-span-2">{error}</p>}
        <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลจัดส่ง"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
