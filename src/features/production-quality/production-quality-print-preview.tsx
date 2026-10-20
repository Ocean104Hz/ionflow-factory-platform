"use client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { useBranding } from "@/src/components/factory/branding-provider";
import { buildQualityPrintHtml } from "./production-quality-print";
import type { Inspection } from "./production-quality-domain";
export function QualityPrintPreview({ row }: { row: Inspection }) {
  const { branding } = useBranding();
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () => buildQualityPrintHtml(row, branding),
    [row, branding],
  );
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setLoaded("");
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          พรีวิวพิมพ์
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle>ตัวอย่างพิมพ์การตรวจสอบคุณภาพ</DialogTitle>
          <DialogDescription>
            A4 แนวนอน แบ่งตารางครั้งละ 7 ช่วงเวลา และหน้าสรุป · ไม่ใช่การสร้าง
            PDF อัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        <iframe
          title="เอกสารตรวจสอบคุณภาพ A4"
          ref={frame}
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoaded(html)}
          className="h-[65dvh] min-h-0 w-full rounded-lg border bg-white"
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
            disabled={loaded !== html}
            onClick={() => {
              try {
                const target = frame.current?.contentWindow;
                if (!target) throw new Error();
                target.focus();
                target.print();
              } catch {
                setError("ไม่สามารถเปิดหน้าต่างพิมพ์ กรุณาลองใหม่");
              }
            }}
          >
            พิมพ์ผ่านเบราว์เซอร์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
