"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { PageHeader, SectionCard } from "./patterns";
import { BrandingEditor } from "./branding-editor";
import { UserSettings } from "./user-settings";
import { MasterSettings } from "./master-settings";

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        description="จัดการผู้ใช้ แผนก/ฝ่าย คลังสินค้า และอัตลักษณ์โรงงาน · UI สาธิต"
      />
      <Tabs defaultValue="users" className="min-w-0 gap-4">
        <TabsList
          aria-label="หมวดตั้งค่า"
          className="grid h-auto! w-full grid-cols-2 gap-1 sm:w-fit sm:grid-cols-4"
        >
          <TabsTrigger value="users">ตั้งค่าผู้ใช้</TabsTrigger>
          <TabsTrigger value="departments">แผนก/ฝ่าย</TabsTrigger>
          <TabsTrigger value="warehouses">คลังสินค้า</TabsTrigger>
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
          value="departments"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterSettings kind="departments" />
        </TabsContent>
        <TabsContent
          value="warehouses"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterSettings kind="warehouses" />
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
