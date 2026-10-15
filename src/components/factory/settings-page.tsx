"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { PageHeader, SectionCard } from "./patterns";
import { BrandingEditor } from "./branding-editor";
import { UserSettings } from "./user-settings";

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        description="จัดการผู้ใช้ แผนก สิทธิ์การมองเห็น และอัตลักษณ์โรงงาน · UI สาธิต"
      />
      <Tabs defaultValue="users" className="min-w-0 gap-4">
        <TabsList
          aria-label="หมวดตั้งค่า"
          className="grid w-full grid-cols-2 sm:w-fit"
        >
          <TabsTrigger value="users">ตั้งค่าผู้ใช้</TabsTrigger>
          <TabsTrigger value="factory">ตั้งค่าโรงงาน</TabsTrigger>
        </TabsList>
        <TabsContent
          value="users"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <UserSettings />
        </TabsContent>
        <TabsContent
          value="factory"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <SectionCard
            title="ตั้งค่าโรงงาน"
            subtitle="ชื่อ โลโก้ สีธีม และภาพประกอบ · บันทึกเฉพาะในเบราว์เซอร์นี้"
          >
            <BrandingEditor />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}
