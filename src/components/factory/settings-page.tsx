"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { PageHeader, SectionCard } from "./patterns";
import { BrandingEditor } from "./branding-editor";
import { UserSettings } from "./user-settings";
import { MasterSettings } from "./master-settings";
import { useState } from "react";
import {
  masterKinds,
  type MasterKind,
} from "@/src/features/master-data/master-domain";
import { SelectField } from "./patterns";
function MasterCategory({ kinds }: { kinds: MasterKind[] }) {
  const [kind, setKind] = useState(kinds[0]);
  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <SelectField
          label="เลือกทะเบียนข้อมูลหลัก"
          value={kind}
          onChange={(v) => setKind(v as MasterKind)}
          options={kinds.map((value) => ({ value, label: masterKinds[value] }))}
        />
      </div>
      <MasterSettings key={kind} kind={kind} />
    </div>
  );
}

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        description="จัดการข้อมูลหลักภายใน ผู้ใช้ และอัตลักษณ์โรงงาน · UI สาธิต"
      />
      <Tabs defaultValue="users" className="min-w-0 gap-4">
        <TabsList
          aria-label="หมวดตั้งค่า"
          className="grid h-auto! w-full grid-cols-2 gap-1 lg:grid-cols-6"
        >
          <TabsTrigger value="users">ตั้งค่าผู้ใช้</TabsTrigger>
          <TabsTrigger value="organization">องค์กรและพื้นที่</TabsTrigger>
          <TabsTrigger value="operations">การปฏิบัติงาน</TabsTrigger>
          <TabsTrigger value="products">ข้อมูลสินค้า</TabsTrigger>
          <TabsTrigger value="suppliers">ผู้ขายภายใน</TabsTrigger>
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
          value="organization"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterCategory
            kinds={["sites", "areas", "warehouses", "departments"]}
          />
        </TabsContent>
        <TabsContent
          value="operations"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterCategory
            kinds={["lines", "shifts", "vehicleTypes", "vehicles", "equipment"]}
          />
        </TabsContent>
        <TabsContent
          value="products"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterCategory
            kinds={["units", "categories", "brands", "processes"]}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            ใช้กับ BOM ภายใน · ไม่แก้สินค้า ราคา หรือ SKU ที่ใช้ในเอกสาร Sales
            Hub
          </p>
        </TabsContent>
        <TabsContent
          value="suppliers"
          forceMount
          className="min-w-0 data-[state=inactive]:hidden"
        >
          <MasterSettings kind="suppliers" />
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
