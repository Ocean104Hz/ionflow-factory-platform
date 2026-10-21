"use client";
import { useId, useState, type ReactNode } from "react";
import type { FormField } from "@/src/components/factory/confirm-dialog";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";

export function ProductionOrderFormDialog({ title, description, trigger, fields, onSubmit, validate, submitLabel = "บันทึก", destructive = false }: {
  title: string; description: string; trigger: ReactNode; fields: FormField[];
  onSubmit: (values: Record<string, string>) => Promise<boolean | void> | boolean | void;
  validate?: (values: Record<string, string>) => string | null;
  submitLabel?: string; destructive?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState("");
  return <Dialog open={open} onOpenChange={(next) => { if (busy) return; if (!next && dirty && !window.confirm("ละทิ้งข้อมูลที่ยังไม่บันทึกหรือไม่?")) return; setOpen(next); if (next) { setDirty(false); setError(""); } }}>
    <DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="max-h-[85dvh] overflow-y-auto bg-surface"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      <form className="space-y-5" onChange={() => setDirty(true)} onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values = Object.fromEntries(fields.map((field) => [field.name, String(data.get(field.name) ?? "").trim()]));
        if (fields.some((f) => f.required && !values[f.name])) { setError("กรุณากรอกข้อมูลที่จำเป็น"); return; }
        const validation = validate?.(values); if (validation) { setError(validation); return; }
        setBusy(true); setError("");
        try { if (await onSubmit(values) === false) { setError("บันทึกไม่สำเร็จ โปรดตรวจข้อความผิดพลาดแล้วลองใหม่"); return; } setDirty(false); setOpen(false); }
        catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
        finally { setBusy(false); }
      }}><fieldset disabled={busy} className="space-y-4" aria-busy={busy}>
        {fields.map((f) => <div key={f.name} className="space-y-2"><Label htmlFor={`${id}-${f.name}`}>{f.label}{f.required ? " *" : ""}</Label>{f.type === "textarea" ? <Textarea id={`${id}-${f.name}`} name={f.name} defaultValue={f.value} required={f.required} rows={3} /> : <Input id={`${id}-${f.name}`} name={f.name} defaultValue={f.value} type={f.type ?? "text"} required={f.required} min={f.min} step={f.step} />}</div>)}
        {error && <p role="alert" className="text-danger">{error}</p>}
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ยกเลิก</Button></DialogClose><Button type="submit" variant={destructive ? "destructive" : "default"}>{busy ? "กำลังบันทึก…" : submitLabel}</Button></DialogFooter>
      </fieldset></form>
    </DialogContent>
  </Dialog>;
}

export function ProductionOrderConfirmDialog({ onConfirm, ...props }: {
  title: string; description: string; trigger: ReactNode;
  onConfirm: () => Promise<boolean | void> | boolean | void;
}) {
  return <ProductionOrderFormDialog {...props} description={`${props.description} · บันทึกเฉพาะ PostgreSQL Local`} fields={[]} submitLabel="ยืนยัน" onSubmit={onConfirm} />;
}
