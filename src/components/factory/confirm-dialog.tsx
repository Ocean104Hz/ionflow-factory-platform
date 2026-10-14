"use client";
import { useId, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
export interface FormField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "datetime-local" | "number";
  value?: string;
  min?: string;
  step?: string;
  required?: boolean;
}
export function FormDialog({
  title,
  description,
  trigger,
  fields,
  onSubmit,
  submitLabel = "บันทึก",
  destructive = false,
  validate,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  fields: FormField[];
  onSubmit: (values: Record<string, string>) => void;
  submitLabel?: string;
  destructive?: boolean;
  validate?: (values: Record<string, string>) => string | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setError("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-surface">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const values = Object.fromEntries(
              fields.map((f) => [
                f.name,
                String(data.get(f.name) ?? "").trim(),
              ]),
            );
            if (fields.some((f) => f.required && !values[f.name])) {
              setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบ");
              return;
            }
            if (
              fields.some(
                (f) =>
                  f.type === "number" &&
                  (!Number.isFinite(Number(values[f.name])) ||
                    Number(values[f.name]) < Number(f.min ?? 0)),
              )
            ) {
              setError("กรุณาระบุจำนวนที่ถูกต้อง");
              return;
            }
            const validationError = validate?.(values);
            if (validationError) {
              setError(validationError);
              return;
            }
            onSubmit(values);
            setOpen(false);
          }}
        >
          {fields.map((f) => (
            <div key={f.name} className="space-y-2">
              <Label htmlFor={`${id}-${f.name}`}>
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  id={`${id}-${f.name}`}
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required}
                  rows={3}
                />
              ) : (
                <Input
                  id={`${id}-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={f.value}
                  required={f.required}
                  min={f.min}
                  step={f.step}
                />
              )}
            </div>
          ))}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            สาธิต UI เท่านั้น · ไม่ส่งข้อมูลไปยังระบบจริง
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ยกเลิก
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="bg-surface">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description} · เปลี่ยนเฉพาะ demo state
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>ยืนยัน</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
