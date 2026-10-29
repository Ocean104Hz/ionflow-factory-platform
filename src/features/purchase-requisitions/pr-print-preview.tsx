"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
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
import { buildPRPrintHtml } from "./pr-print";
import type { PR } from "./pr-domain";

export function PRPrintPreview({
  records,
  open,
  onOpenChange,
  trigger,
}: {
  records: PR[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode | null;
}) {
  const { branding } = useBranding();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loadedHtml, setLoadedHtml] = useState("");
  const [error, setError] = useState("");
  const html = useMemo(
    () => buildPRPrintHtml(records, branding),
    [records, branding],
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (open) {
          setLoadedHtml("");
          setError("");
        }
        onOpenChange?.(open);
      }}
    >
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" disabled={!records.length}>
              <Printer aria-hidden="true" />
              พิมพ์ใบขอซื้อ
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[94dvh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>ตัวอย่างใบขอซื้อก่อนพิมพ์</DialogTitle>
          <DialogDescription>
            กระดาษ A4 · {records.length} เอกสารที่เลือกหรือผลกรอง ·
            กดพิมพ์เพื่อเลือกเครื่องพิมพ์หรือบันทึก PDF ผ่านเบราว์เซอร์
            ข้อมูลยังเป็นสาธิต
          </DialogDescription>
        </DialogHeader>
        <iframe
          ref={frame}
          title="พรีวิวใบขอซื้อสำหรับพิมพ์"
          className="h-[65dvh] min-h-64 w-full rounded-md border bg-white"
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoadedHtml(html)}
        />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">ปิดพรีวิว</Button>
          </DialogClose>
          <Button
            disabled={loadedHtml !== html}
            onClick={() => {
              try {
                const target = frame.current?.contentWindow;
                if (!target) throw new Error("ใบพิมพ์ยังไม่พร้อม");
                target.focus();
                target.print();
              } catch {
                setError("เปิดหน้าต่างพิมพ์ไม่ได้ กรุณาปิดแล้วเปิดพรีวิวใหม่");
              }
            }}
          >
            <Printer aria-hidden="true" />
            พิมพ์ / บันทึก PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
