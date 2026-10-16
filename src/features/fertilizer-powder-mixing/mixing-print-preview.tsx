"use client";
import { useMemo, useRef, useState, type ReactElement } from "react";
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
import { buildMixingPrintHtml } from "./mixing-print";
import type { MixingReport } from "./mixing-domain";
export function MixingPrintPreview({
  rows,
  trigger,
}: {
  rows: MixingReport[];
  trigger?: ReactElement;
}) {
  const { branding } = useBranding();
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState("");
  const [error, setError] = useState("");
  const html = useMemo(
    () => buildMixingPrintHtml(rows, branding),
    [rows, branding],
  );
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
        {trigger ?? (
          <Button type="button" variant="outline" disabled={!rows.length}>
            <Printer aria-hidden="true" />
            พรีวิวพิมพ์
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="pr-8">
          <DialogTitle>ตัวอย่างพิมพ์รายงานผสมปุ๋ยผง</DialogTitle>
          <DialogDescription>
            A4 แนวตั้ง · {rows.length} ฉบับ · พิมพ์ผ่านเบราว์เซอร์
            ไม่ใช่การสร้างไฟล์ PDF อัตโนมัติ
          </DialogDescription>
        </DialogHeader>
        <iframe
          title="เอกสารรายงานผสมปุ๋ยผง A4"
          ref={frame}
          sandbox="allow-same-origin allow-modals"
          srcDoc={html}
          onLoad={() => setLoaded(html)}
          className="h-[64dvh] min-h-0 w-full rounded-lg border bg-white"
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
            disabled={loaded !== html || !rows.length}
            onClick={() => {
              try {
                const target = frame.current?.contentWindow;
                if (!target) throw new Error();
                target.focus();
                target.print();
              } catch {
                setError("เปิดหน้าต่างพิมพ์ไม่ได้ กรุณาเปิดพรีวิวใหม่");
              }
            }}
          >
            <Printer aria-hidden="true" />
            พิมพ์ผ่านเบราว์เซอร์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
