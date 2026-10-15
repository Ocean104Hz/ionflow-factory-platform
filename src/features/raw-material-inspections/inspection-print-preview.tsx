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
}: {
  row: Inspection;
  unsaved?: boolean;
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
        <Button type="button" variant="outline">
          <Printer />
          พิมพ์ใบตรวจสอบ
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col sm:max-w-6xl">
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
          className="h-[65dvh] min-h-0 w-full rounded-md border bg-white"
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
