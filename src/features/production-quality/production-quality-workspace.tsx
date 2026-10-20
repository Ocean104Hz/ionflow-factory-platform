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
  blankInspection,
  formatDate,
  statusLabel,
  type Inspection,
} from "./production-quality-domain";
import { qualityProfiles } from "./production-quality-profiles";
import { QualityForm, QualityCalculations } from "./production-quality-form";
import { QualityMatrix } from "./production-quality-matrix";
import { QualityHistory } from "./production-quality-history";
import { QualityYearly } from "./production-quality-yearly";
import { QualityPrintPreview } from "./production-quality-print-preview";
import { useProductionQuality } from "./production-quality-provider";

export function ProductionQualityWorkspace() {
  const { records } = useProductionQuality();
  const [tab, setTab] = useState("form"),
    [row, setRow] = useState<Inspection>(blankInspection),
    [baseline, setBaseline] = useState(() => JSON.stringify(blankInspection()));
  const [pending, setPending] = useState<Inspection | null>(null),
    [viewId, setViewId] = useState<string | null>(null);
  const viewed = records.find((r) => r.id === viewId);
  const dirty = JSON.stringify(row) !== baseline;
  function openForm(next: Inspection) {
    setRow(structuredClone(next));
    setBaseline(JSON.stringify(next));
    setTab("form");
    setViewId(null);
  }
  function requestForm(next: Inspection) {
    if (dirty) setPending(next);
    else openForm(next);
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ตรวจสอบคุณภาพการผลิต"
        description="บันทึกผลตรวจตามช่วงเวลา ติดตามประวัติ และสรุปผลรายปี · Mock เท่านั้น ไม่อนุมัติคุณภาพหรือเปลี่ยนสต็อก"
        actions={
          <Button onClick={() => requestForm(blankInspection())}>
            <Plus />
            สร้างเอกสารใหม่
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="min-w-0">
        <div className="max-w-full overflow-x-auto">
          <TabsList>
            <TabsTrigger value="form">แบบฟอร์มตรวจสอบ</TabsTrigger>
            <TabsTrigger value="history">ประวัติการตรวจสอบ</TabsTrigger>
            <TabsTrigger value="yearly">สรุปรายปี</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="form" className="mt-5 min-w-0">
          {row.id && !records.some((r) => r.id === row.id) ? (
            <SectionCard title="เอกสารนี้ถูกลบแล้ว">
              <Button onClick={() => openForm(blankInspection())}>
                เปิดแบบฟอร์มใหม่
              </Button>
            </SectionCard>
          ) : (
            <QualityForm
              row={row}
              onChange={setRow}
              onSaved={(saved) => {
                setRow(saved);
                setBaseline(JSON.stringify(saved));
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="history" className="mt-5 min-w-0">
          <QualityHistory
            onEdit={requestForm}
            onView={(r) => setViewId(r.id)}
          />
        </TabsContent>
        <TabsContent value="yearly" className="mt-5 min-w-0">
          <QualityYearly />
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              การเปิดเอกสารอื่นจะละทิ้งข้อมูลที่แก้ไขในแบบฟอร์มนี้
              ไม่มีการบันทึกอัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>กลับไปบันทึกก่อน</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) openForm(pending);
                setPending(null);
              }}
            >
              ละทิ้งและเปิดเอกสาร
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={!!viewed}
        onOpenChange={(open) => {
          if (!open) setViewId(null);
        }}
      >
        <DialogContent className="flex max-h-[94dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-7xl">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              รายละเอียด {viewed?.documentNumber || "เอกสารแบบร่าง"}
            </DialogTitle>
            <DialogDescription>
              ข้อมูลสาธิต · อ่านอย่างเดียว · ไม่ใช่ใบอนุมัติคุณภาพ
            </DialogDescription>
          </DialogHeader>
          {viewed && (
            <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto pr-1">
              <StatusBadge>{statusLabel(viewed)}</StatusBadge>
              <InfoGrid>
                {[
                  ["โรงงาน", qualityProfiles[viewed.profileId].label],
                  ["วันที่", formatDate(viewed.inspectionDate)],
                  ["สถานที่", viewed.productionSite],
                  ["สายการผลิต", viewed.productionLine],
                ].map(([label, value]) => (
                  <InfoRow key={label} label={label}>
                    {value || "—"}
                  </InfoRow>
                ))}
              </InfoGrid>
              <QualityMatrix row={viewed} />
              <SectionCard title="เวลาเครื่องจักร">
                <p>
                  เปิดเครื่อง {viewed.machineStart || "—"} · เริ่มงาน{" "}
                  {viewed.workStart || "—"} · หยุดงาน {viewed.workStop || "—"}
                </p>
                <dl className="mt-3 space-y-2">
                  {viewed.stops.map((s) => (
                    <div
                      key={s.id}
                      className="grid gap-2 border-b py-2 sm:grid-cols-[auto_1fr]"
                    >
                      <dt>
                        {s.stop || "—"} → {s.restart || "—"}
                      </dt>
                      <dd className="break-words">{s.reason || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>
              <QualityCalculations row={viewed} />
              <SectionCard title="ข้อมูลผู้ลงชื่อ">
                <InfoGrid>
                  {viewed.signers.map((s) => (
                    <InfoRow key={s.role} label={s.role}>
                      {s.name || "—"}
                      {s.date && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(s.date)}
                        </p>
                      )}
                    </InfoRow>
                  ))}
                </InfoGrid>
                <p className="mt-3 text-xs text-muted-foreground">
                  ชื่อสาธิต ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์
                </p>
              </SectionCard>
              <SectionCard title="หมายเหตุและข้อมูลการบันทึก">
                <p className="whitespace-pre-wrap break-words">
                  {viewed.notes || "—"}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  สร้าง {viewed.createdAt} · แก้ไข {viewed.updatedAt}
                </p>
              </SectionCard>
            </div>
          )}
          <DialogFooter className="shrink-0">
            {viewed && (
              <>
                <QualityPrintPreview row={viewed} />
                <Button variant="outline" onClick={() => requestForm(viewed)}>
                  แก้ไขเอกสาร
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
