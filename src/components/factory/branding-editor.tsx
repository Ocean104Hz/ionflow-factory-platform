"use client";
import Image from "next/image";
import { useId, useState, type ReactElement } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import {
  defaultBranding,
  isLogoDataUrl,
  logoFileLimit,
  themePresets,
  type FactoryBranding,
} from "@/src/lib/branding";
import { useBranding } from "./branding-provider";

export function BrandingEditor({ trigger }: { trigger: ReactElement }) {
  const { branding, updateBranding } = useBranding();
  const [draft, setDraft] = useState<FactoryBranding>(branding);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId();
  async function loadLogo(file?: File) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > logoFileLimit
    ) {
      setMessage("ใช้ PNG, JPEG หรือ WebP ไม่เกิน 512 KB เท่านั้น");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("อ่านไฟล์ไม่ได้"));
        reader.readAsDataURL(file);
      });
      if (!isLogoDataUrl(result)) throw new Error("ไฟล์โลโก้ไม่ถูกต้อง");
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () =>
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? resolve()
            : reject(new Error("รูปภาพไม่ถูกต้อง"));
        image.onerror = () => reject(new Error("ไฟล์นี้ไม่ใช่รูปภาพที่รองรับ"));
        image.src = result;
      });
      setDraft((previous) => ({ ...previous, logoDataUrl: result }));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ไม่สามารถอ่านโลโก้ได้",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setDraft(branding);
          setMessage("");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto bg-surface">
        <DialogHeader>
          <DialogTitle>ปรับแต่งโรงงาน</DialogTitle>
          <DialogDescription>
            เปลี่ยน branding ของ Login และ workspace ·
            บันทึกเฉพาะบนเบราว์เซอร์นี้
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (
              !draft.factoryName.trim() ||
              !draft.shortName.trim() ||
              !/^#[0-9a-f]{6}$/i.test(draft.primaryColor)
            ) {
              setMessage("กรุณาระบุชื่อ ชื่อย่อ และสี #RRGGBB ที่ถูกต้อง");
              return;
            }
            const saved = updateBranding(draft);
            setMessage(
              saved
                ? "บันทึก branding แล้ว"
                : "ปรับแต่งแล้ว แต่เบราว์เซอร์ไม่อนุญาตให้บันทึกถาวร",
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${id}-name`}>ชื่อโรงงาน</Label>
            <Input
              id={`${id}-name`}
              required
              maxLength={80}
              value={draft.factoryName}
              onChange={(e) =>
                setDraft({ ...draft, factoryName: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-short`}>ชื่อย่อ</Label>
            <Input
              id={`${id}-short`}
              required
              maxLength={12}
              value={draft.shortName}
              onChange={(e) =>
                setDraft({ ...draft, shortName: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-logo`}>โลโก้โรงงาน</Label>
            <Input
              key={`${open}-${draft.logoDataUrl ? "logo" : "empty"}`}
              id={`${id}-logo`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                void loadLogo(e.target.files?.[0]);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PNG / JPEG / WebP · สูงสุด 512 KB · ไม่รองรับ SVG
            </p>
            {draft.logoDataUrl && (
              <div className="flex items-center gap-3">
                <Image
                  src={draft.logoDataUrl}
                  alt="ตัวอย่างโลโก้"
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded-lg border object-contain p-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setDraft({ ...draft, logoDataUrl: null })}
                >
                  ลบโลโก้
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-color`}>สีหลัก</Label>
            <div className="flex gap-2">
              <input
                id={`${id}-color`}
                type="color"
                value={
                  /^#[0-9a-f]{6}$/i.test(draft.primaryColor)
                    ? draft.primaryColor
                    : defaultBranding.primaryColor
                }
                onChange={(e) =>
                  setDraft({ ...draft, primaryColor: e.target.value })
                }
                className="h-10 w-12 rounded border p-1"
              />
              <Input
                aria-label="รหัสสีหลัก #RRGGBB"
                maxLength={7}
                value={draft.primaryColor}
                onChange={(e) =>
                  setDraft({ ...draft, primaryColor: e.target.value })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {themePresets.map((p) => (
                <Button
                  key={p.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={draft.primaryColor.toLowerCase() === p.color}
                  onClick={() => setDraft({ ...draft, primaryColor: p.color })}
                >
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            เก็บเฉพาะชื่อ โลโก้ และสี · ไม่เก็บรหัสผ่านหรือข้อมูลบัญชี
          </p>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          <DialogFooter className="flex-wrap">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setDraft(defaultBranding);
                const saved = updateBranding(defaultBranding);
                setMessage(saved ? "คืนค่าเริ่มต้นแล้ว" : "คืนค่าแล้ว แต่เบราว์เซอร์ไม่อนุญาตให้บันทึกถาวร");
              }}
            >
              คืนค่าเริ่มต้น
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ปิด
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "กำลังอ่านโลโก้…" : "บันทึกการปรับแต่ง"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
