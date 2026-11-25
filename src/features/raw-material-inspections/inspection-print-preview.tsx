"use client";
import { useMemo, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import { useBranding } from "@/src/components/factory/branding-provider";
import { buildInspectionPrintHtml } from "./inspection-print";
import type { Inspection } from "./inspection-domain";

export function InspectionPrintPreview({
  row,
  unsaved = false,
  iconOnly = false,
}: {
  row: Inspection;
  unsaved?: boolean;
  iconOnly?: boolean;
}) {
  const { branding } = useBranding();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loadedHtml, setLoadedHtml] = useState("");
  const [error, setError] = useState("");
  const html = useMemo(
    () => buildInspectionPrintHtml(row, branding, unsaved),
    [row, branding, unsaved],
  );
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setLoadedHtml("");
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 hover:bg-primary/5 hover:text-primary"
            title="พิมพ์เอกสาร"
            aria-label="พิมพ์เอกสาร"
          >
            <Printer className="size-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline">
            <Printer />
            พิมพ์ใบตรวจสอบ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent variant="preview">
        <DialogHeader className="pr-8">
          <DialogTitle>ตัวอย่างใบตรวจสอบคุณภาพวัตถุดิบก่อนพิมพ์</DialogTitle>
          <DialogDescription>
            A5 แนวนอน ตามสัดส่วนแบบ iTech · เลือกเครื่องพิมพ์หรือบันทึก PDF
            ผ่านเบราว์เซอร์
            {unsaved ? " · ใช้ข้อมูลปัจจุบันในฟอร์ม ยังไม่ได้บันทึก" : ""}
          </DialogDescription>
        </DialogHeader>
        <iframe
          ref={frame}
          title="พรีวิวใบตรวจสอบคุณภาพวัตถุดิบ"
          className="min-h-0 w-full flex-1 rounded-md border bg-white"
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoadedHtml(html)}
        />
        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              ปิดพรีวิว
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={loadedHtml !== html}
            onClick={() => {
              try {
                const target = frame.current?.contentWindow;
                if (!target) throw new Error("ยังไม่พร้อม");
                target.focus();
                target.print();
              } catch {
                setError("เปิดหน้าต่างพิมพ์ไม่ได้ กรุณาปิดแล้วเปิดพรีวิวใหม่");
              }
            }}
          >
            <Printer />
            พิมพ์ / บันทึก PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
