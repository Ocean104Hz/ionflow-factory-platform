"use client";
import { useMemo, useRef, useState, type ReactNode } from "react";
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
import { buildPackagingPrintHtml } from "./packaging-print";
import type { PackagingReport } from "./packaging-domain";
export function PackagingPrintPreview({ report, trigger }: { report: PackagingReport; trigger?: ReactNode }) {
  const { branding } = useBranding(),
    frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () => buildPackagingPrintHtml(report, branding),
    [report, branding],
  );
  const [loaded, setLoaded] = useState(""),
    [error, setError] = useState("");
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
        {trigger ?? (<Button type="button" variant="outline" size="sm">
          พรีวิวพิมพ์
        </Button>)}
      </DialogTrigger>
      <DialogContent variant="preview">
        <DialogHeader className="pr-8">
          <DialogTitle>ตัวอย่างพิมพ์รายงานบรรจุ</DialogTitle>
          <DialogDescription>
            A4 แนวนอน · แบ่งหน้าตาม SET และบริบทสูตร/Lot · ไม่ใช่ PDF อัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        <iframe
          title="เอกสารบรรจุปุ๋ยอินทรีย์ A4"
          ref={frame}
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoaded(html)}
          className="min-h-0 w-full flex-1 rounded-lg border bg-white"
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
