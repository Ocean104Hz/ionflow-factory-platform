"use client";
import Image from "next/image";
import { useState } from "react";
import { FileText, Expand } from "lucide-react";
import { attachments } from "@/src/lib/mock-data";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
export function AttachmentGallery({
  items = attachments,
}: {
  items?: typeof attachments;
}) {
  const [selected, setSelected] = useState<(typeof attachments)[number] | null>(
    null,
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Button
            variant="outline"
            key={item.id}
            type="button"
            onClick={() => setSelected(item)}
            className="block h-auto overflow-hidden rounded-lg border p-0 text-left whitespace-normal transition-shadow hover:shadow-md"
            aria-label={`ดู ${item.label}`}
          >
            <div className="relative flex h-40 items-center justify-center bg-surface-muted">
              {item.src ? (
                <Image
                  src={item.src}
                  alt={item.label}
                  fill
                  unoptimized
                  className="object-contain p-4"
                />
              ) : (
                <FileText className="size-12 text-muted-foreground" />
              )}
              <Expand className="absolute right-3 top-3 size-4 text-muted-foreground" />
            </div>
            <div className="space-y-2 border-t p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="break-all text-xs font-semibold">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {item.mime === "application/pdf"
                  ? "PDF · การ์ดเอกสารสาธิต"
                  : "ภาพจำลอง · Local asset"}
              </p>
            </div>
          </Button>
        ))}
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto bg-surface sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.label ?? "เอกสารแนบ"}</DialogTitle>
            <DialogDescription>
              {selected?.name} · ข้อมูลสมมติ ไม่มีข้อมูลส่วนบุคคลจริง
            </DialogDescription>
          </DialogHeader>
          {selected?.src ? (
            <Image
              src={selected.src}
              alt={selected.label}
              width={800}
              height={500}
              unoptimized
              className="h-auto w-full rounded-lg border"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-lg bg-surface-muted p-12">
              <FileText className="size-16 text-muted-foreground" />
              <p>ตัวอย่างการ์ด PDF</p>
              <p className="text-xs text-muted-foreground">
                ไม่มีไฟล์ PDF จริงใน phase นี้
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
