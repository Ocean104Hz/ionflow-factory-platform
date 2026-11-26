"use client";
import { useRef,useState,useMemo } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogClose } from "@/src/components/ui/dialog";
import { useBranding } from "@/src/components/factory/branding-provider";
import { buildPaperPrintHtml } from "./paper-print";
import type { PaperRecord } from "./paper-domain";
export function PaperPrintPreview({record}:{record:PaperRecord}) {
  const {branding}=useBranding();
  const frame=useRef<HTMLIFrameElement>(null);
  const [loadedHtml,setLoadedHtml]=useState("");
  const [error,setError]=useState("");
  const html=useMemo(()=>buildPaperPrintHtml(record,branding.factoryName),[record,branding.factoryName]);
  return <Dialog onOpenChange={open=>{if(open){setLoadedHtml("");setError("");}}}>
    <DialogTrigger asChild><Button type="button" variant="outline"><Printer/>พิมพ์ใบตรวจสอบ</Button></DialogTrigger>
    <DialogContent variant="preview"><DialogHeader className="pr-8"><DialogTitle>ตัวอย่างใบตรวจสอบคุณภาพวัตถุดิบก่อนพิมพ์</DialogTitle><DialogDescription>A5 แนวนอน · ข้อมูลจากเอกสารที่บันทึกแล้ว</DialogDescription></DialogHeader>
      <iframe ref={frame} title="ตัวอย่างก่อนพิมพ์" className="min-h-0 w-full flex-1 rounded-md border bg-white" sandbox="allow-same-origin allow-modals" srcDoc={html} onLoad={()=>setLoadedHtml(html)}/>
      {error&&<p role="alert" className="text-danger">{error}</p>}
      <DialogFooter><DialogClose asChild><Button type="button" variant="outline">ปิด</Button></DialogClose><Button type="button" disabled={loadedHtml!==html} onClick={()=>{try{const target=frame.current?.contentWindow;if(!target)throw new Error("ยังไม่พร้อม");target.focus();target.print();}catch{setError("ไม่สามารถเปิดหน้าต่างพิมพ์ได้");}}}><Printer/>พิมพ์ / บันทึก PDF</Button></DialogFooter>
    </DialogContent></Dialog>;
}
