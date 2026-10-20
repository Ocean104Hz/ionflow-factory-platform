"use client";

import { useState } from "react";
import { ChevronRight, ListFilter } from "lucide-react";
import { PageHeader, SectionCard } from "./patterns";
import { BrandingEditor } from "./branding-editor";
import { UserSettings } from "./user-settings";
import { MasterSettings } from "./master-settings";
import {
  SettingsSidebar,
  settingsGroups,
  settingsLabel,
  type SettingsDestination,
} from "./settings-sidebar";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

export function SettingsPage() {
  const [selected, setSelected] = useState<SettingsDestination>("users");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<SettingsDestination | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const group = settingsGroups.find((item) => item.items.includes(selected))!;
  const title = settingsLabel(selected);
  function select(destination: SettingsDestination) {
    if (destination === selected) {
      setMobileOpen(false);
      return;
    }
    if (dirty) {
      setPending(destination);
      return;
    }
    setSelected(destination);
    setMobileOpen(false);
  }
  return (
    <>
      {/* <PageHeader
        title="ตั้งค่า"
        description="จัดการข้อมูลหลัก ผู้ใช้งาน และการตั้งค่าโรงงาน"
      /> */}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden min-w-0 rounded-lg border bg-card lg:sticky lg:top-20 lg:block">
          <p className="border-b px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground">
            หมวดการตั้งค่า
          </p>
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto">
            <SettingsSidebar selected={selected} onSelect={select} />
          </div>
        </aside>
        <section
          aria-labelledby="settings-section-title"
          className="min-w-0 space-y-4"
        >
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between lg:hidden"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ListFilter aria-hidden="true" className="size-4" />
                  <span className="truncate">หมวดตั้งค่า · {title}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(320px,90vw)] gap-0 motion-reduce:animate-none motion-reduce:transition-none"
            >
              <SheetHeader className="border-b">
                <SheetTitle>หมวดการตั้งค่า</SheetTitle>
                <SheetDescription>เลือกส่วนที่ต้องการจัดการ</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 overflow-y-auto">
                <SettingsSidebar selected={selected} onSelect={select} />
              </div>
            </SheetContent>
          </Sheet>
          <header className="space-y-2 border-b pb-4">
            <p
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
              aria-label="ตำแหน่งการตั้งค่า"
            >
              <span>ตั้งค่า</span>
              <span aria-hidden="true">/</span>
              <span>{group.title}</span>
              <span aria-hidden="true">/</span>
              <span className="text-foreground">{title}</span>
            </p>
            <h2 id="settings-section-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selected === "users"
                ? "จัดการข้อมูลผู้ใช้ บทบาท และการมองเห็นเมนูในระบบสาธิต"
                : selected === "branding"
                  ? "ปรับชื่อ โลโก้ ภาพประกอบ และสีธีมของโรงงาน"
                  : `จัดการข้อมูล${title}สำหรับการใช้งานภายในโรงงาน`}
            </p>
            {group.title === "ข้อมูลสินค้า" && (
              <p className="text-xs text-muted-foreground">
                ใช้กับ BOM ภายใน · ไม่แก้สินค้า ราคา หรือ SKU ที่ใช้ในเอกสาร
                Sales Hub
              </p>
            )}
          </header>
          {selected === "users" ? (
            <UserSettings onDirtyChange={setDirty} />
          ) : selected === "branding" ? (
            <SectionCard
              title="อัตลักษณ์โรงงาน"
              subtitle="ข้อมูลและรูปแบบการแสดงผล · บันทึกเฉพาะในเบราว์เซอร์นี้"
            >
              <BrandingEditor onDirtyChange={setDirty} />
            </SectionCard>
          ) : (
            <MasterSettings
              key={selected}
              kind={selected}
              onDirtyChange={setDirty}
            />
          )}
        </section>
      </div>
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent className="motion-reduce:animate-none">
          <AlertDialogHeader>
            <AlertDialogTitle>มีข้อมูลที่ยังไม่ได้บันทึก</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการละทิ้งการแก้ไขแล้วไปยัง
              {pending ? settingsLabel(pending) : "หมวดอื่น"}หรือไม่?
              ข้อมูลที่บันทึกแล้วจะยังคงอยู่ โดยไม่มีการบันทึกอัตโนมัติ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>แก้ไขต่อ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) setSelected(pending);
                setDirty(false);
                setPending(null);
                setMobileOpen(false);
              }}
            >
              ละทิ้งและเปลี่ยนหมวด
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
