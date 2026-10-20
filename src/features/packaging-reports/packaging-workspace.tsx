"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/src/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";
import {
  PageHeader,
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
} from "@/src/components/factory/patterns";
import {
  newReport,
  recordLabel,
  thaiDate,
  type PackagingReport,
} from "./packaging-domain";
import { packagingProfiles } from "./packaging-profiles";
import { PackagingForm, PackagingSetContent } from "./packaging-form";
import { PackagingHistory } from "./packaging-history";
import { PackagingPrintPreview } from "./packaging-print-preview";
import { usePackaging } from "./packaging-provider";
export function PackagingWorkspace() {
  const { records } = usePackaging();
  const [tab, setTab] = useState("form"),
    [editorSession, setEditorSession] = useState(0),
    [report, setReport] = useState(newReport),
    [baseline, setBaseline] = useState(() => JSON.stringify(newReport())),
    [viewId, setViewId] = useState<string | null>(null),
    [pending, setPending] = useState<PackagingReport | null>(null);
  const viewed = records.find((r) => r.id === viewId),
    dirty = JSON.stringify(report) !== baseline;
  function open(r: PackagingReport) {
    setEditorSession((session) => session + 1);
    setReport(structuredClone(r));
    setBaseline(JSON.stringify(r));
    setViewId(null);
    setTab("form");
  }
  const request = (r: PackagingReport) => {
    if (dirty) setPending(r);
    else open(r);
  };
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบรายงานการบรรจุปุ๋ยอินทรีย์"
        description="บันทึกผลตรวจบรรจุ Load Cell และเทียบเครื่องชั่ง · Mock เท่านั้น ไม่ใช่ Packing Summary และไม่เปลี่ยนสต็อก"
        actions={
          <Button onClick={() => request(newReport())}>
            <Plus />
            สร้างรายงานใหม่
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <TabsList>
          <TabsTrigger value="form">แบบฟอร์มรายงาน</TabsTrigger>
          <TabsTrigger value="history">ประวัติรายงาน</TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-5 min-w-0">
          {report.id && !records.some((r) => r.id === report.id) ? (
            <SectionCard title="รายงานนี้ถูกลบแล้ว">
              <Button onClick={() => open(newReport())}>
                เปิดแบบฟอร์มใหม่
              </Button>
            </SectionCard>
          ) : (
            <PackagingForm
              key={editorSession}
              report={report}
              onChange={setReport}
              onSaved={(r) => {
                setReport(r);
                setBaseline(JSON.stringify(r));
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-5 min-w-0">
          <PackagingHistory onEdit={request} onView={(r) => setViewId(r.id)} />
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (!v) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>มีข้อมูลที่ยังไม่บันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              การเปิดแบบฟอร์มอื่นจะละทิ้งข้อมูลที่ยังไม่บันทึกในหน้านี้
              ไม่มีการบันทึกอัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปบันทึกก่อน</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) open(pending);
                setPending(null);
              }}
            >
              ละทิ้งและเปิดแบบฟอร์ม
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!viewed}
        onOpenChange={(v) => {
          if (!v) setViewId(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-7xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              รายละเอียด {viewed?.documentNumber || "แบบร่าง"}
            </DialogTitle>
            <DialogDescription>
              ข้อมูลสาธิต อ่านอย่างเดียว ไม่มีการอนุมัติหรือเปลี่ยนสต็อก
            </DialogDescription>
          </DialogHeader>
          {viewed && (
            <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto pr-1">
              <StatusBadge>{recordLabel(viewed)}</StatusBadge>
              <InfoGrid>
                <InfoRow label="โรงงาน">
                  {packagingProfiles[viewed.profileId].label}
                </InfoRow>
                <InfoRow label="สถานที่">{viewed.location || "—"}</InfoRow>
                <InfoRow label="วันที่">
                  {thaiDate(viewed.documentDate)}
                </InfoRow>
                <InfoRow label="SET">{viewed.sets.length}</InfoRow>
              </InfoGrid>
              {viewed.sets.map((s) => (
                <PackagingSetContent key={s.id} report={viewed} set={s} />
              ))}
              <SectionCard title="ผู้ลงชื่อและหมายเหตุ">
                <InfoGrid>
                  {viewed.signers.map((s) => (
                    <InfoRow key={s.role} label={s.role}>
                      {s.name || "—"}
                      {s.date && (
                        <p className="text-xs text-muted-foreground">
                          {thaiDate(s.date)}
                        </p>
                      )}
                    </InfoRow>
                  ))}
                </InfoGrid>
                <p className="mt-4 whitespace-pre-wrap break-words">
                  {viewed.remarks || "—"}
                </p>
                <p className="mt-4 text-xs text-muted-foreground">
                  สร้าง {viewed.createdAt} · แก้ไข {viewed.updatedAt} ·
                  ชื่อสาธิต ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์
                </p>
              </SectionCard>
            </div>
          )}
          <DialogFooter className="shrink-0">
            {viewed && (
              <>
                <PackagingPrintPreview report={viewed} />
                <Button variant="outline" onClick={() => request(viewed)}>
                  แก้ไขรายงาน
                </Button>
              </>
            )}
            <DialogClose asChild>
              <Button>ปิดรายละเอียด</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
