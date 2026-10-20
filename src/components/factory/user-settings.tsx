"use client";

import { useEffect, useId, useState } from "react";
import {
  userRoles,
  factoryModules,
  visibleModules,
  validateDemoUser,
  type DemoUser,
} from "@/src/lib/mock-data/settings";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import {
  FactoryDataTable,
  SectionCard,
  SelectField,
  type Column,
} from "./patterns";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useMasterData } from "@/src/features/master-data/master-provider";
import { MasterSelect } from "@/src/features/master-data/master-select";

export function UserSettings({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const id = useId();
  const masters = useMasterData();
  const users = masters.state.personnel as DemoUser[];
  const [profile, setProfile] = useState<DemoUser>(users[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saved = users.find((user) => user.id === profile.id)!;
  const normalizedProfile = JSON.stringify({
    ...profile,
    displayName: profile.displayName.trim(),
    email: profile.email.trim(),
  });
  useEffect(() => {
    onDirtyChange?.(normalizedProfile !== JSON.stringify(saved));
  }, [normalizedProfile, saved, onDirtyChange]);
  const columns: Column<DemoUser>[] = [
    {
      key: "displayName",
      label: "ผู้ใช้",
      render: (user) => (
        <div>
          <p className="font-medium">{user.displayName}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      ),
    },
    { key: "department", label: "แผนก", render: (user) => user.department },
    { key: "role", label: "บทบาท", render: (user) => user.role },
    {
      key: "modules",
      label: "เมนูที่มองเห็น",
      render: (user) =>
        `${visibleModules(user).length} / ${factoryModules.length}`,
    },
    {
      key: "active",
      label: "สถานะ",
      render: (user) => (
        <Badge variant="outline">
          {user.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </Badge>
      ),
    },
    {
      key: "edit",
      label: "จัดการ",
      render: (user) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`แก้ไขสิทธิ์ ${user.displayName}`}
          onClick={() => {
            setProfile({ ...user, modules: [...user.modules] });
            setMessage("");
            setError("");
          }}
        >
          แก้ไขสิทธิ์
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          กำหนดแผนก บทบาท และการมองเห็นรายผู้ใช้ · ข้อมูลสมมติ
          ไม่ได้บังคับสิทธิ์จริงหรือป้องกันการเปิด URL
          ข้อมูลจำลองคงอยู่เมื่อเปลี่ยนหน้า และคืนค่าเมื่อรีโหลด
          ไม่บันทึกลงเบราว์เซอร์
        </AlertDescription>
      </Alert>
      <FactoryDataTable
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        minWidth={850}
      />
      <SectionCard
        title={`แก้ไขผู้ใช้ · ${profile.id}`}
        subtitle="เลือกผู้ใช้จากตาราง แล้วกำหนดสิทธิ์ด้านล่าง · บทบาทและแผนกไม่เพิ่มสิทธิ์โดยอัตโนมัติ"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const validation = validateDemoUser(profile, users, [
              ...masters.state.rows
                .filter((r) => r.kind === "departments" && r.active)
                .flatMap((r) => [r.name, ...r.aliases]),
              ...(profile.department === saved.department
                ? [saved.department]
                : []),
            ]);
            setError(validation);
            if (validation) return;
            masters.savePersonnel({
              ...profile,
              displayName: profile.displayName.trim(),
              email: profile.email.trim(),
              modules: [...profile.modules],
            });
            setMessage(
              "บันทึกสิทธิ์ตัวอย่างแล้ว · ไม่มีการเปลี่ยนบัญชีหรือสิทธิ์จริง",
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={`${id}-name`}>ชื่อที่แสดง</Label>
              <Input
                id={`${id}-name`}
                required
                maxLength={80}
                autoComplete="off"
                value={profile.displayName}
                onChange={(event) => {
                  setProfile({ ...profile, displayName: event.target.value });
                  setMessage("");
                }}
              />
            </div>
            <div className="grid min-w-0 gap-2">
              <Label htmlFor={`${id}-email`}>อีเมลตัวอย่าง</Label>
              <Input
                id={`${id}-email`}
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={profile.email}
                onChange={(event) => {
                  setProfile({ ...profile, email: event.target.value });
                  setMessage("");
                }}
              />
            </div>
            <MasterSelect
              kind="departments"
              label="แผนก"
              value={profile.department}
              onChange={(department) => {
                setProfile({ ...profile, department });
                setMessage("");
              }}
            />
            <SelectField
              label="บทบาท"
              value={profile.role}
              onChange={(role) => {
                setProfile({ ...profile, role });
                setMessage("");
              }}
              options={userRoles.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">
              ส่วนที่ผู้ใช้นี้มองเห็นได้
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {factoryModules.map((module) => (
                <Button
                  key={module.key}
                  type="button"
                  variant={
                    profile.modules.includes(module.key)
                      ? "secondary"
                      : "outline"
                  }
                  aria-pressed={profile.modules.includes(module.key)}
                  aria-label={`มองเห็น ${module.label}`}
                  className="justify-between"
                  onClick={() => {
                    setProfile({
                      ...profile,
                      modules: profile.modules.includes(module.key)
                        ? profile.modules.filter((key) => key !== module.key)
                        : [...profile.modules, module.key],
                    });
                    setMessage("");
                  }}
                >
                  <span>{module.label}</span>
                  <span className="text-xs">
                    {profile.modules.includes(module.key) ? "แสดง" : "ซ่อน"}
                  </span>
                </Button>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              aria-pressed={profile.active}
              onClick={() => {
                setProfile({ ...profile, active: !profile.active });
                setMessage("");
              }}
            >
              {profile.active ? "เปิดใช้งานผู้ใช้นี้" : "ปิดใช้งานผู้ใช้นี้"}
            </Button>
            <p className="text-xs text-muted-foreground">
              ปิดใช้งานแล้วจะไม่มีเมนูที่มองเห็นในตัวอย่าง แม้ยังเลือกเมนูไว้
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <p role="status" className="text-sm">
            {message}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setProfile({ ...saved, modules: [...saved.modules] });
                setError("");
                setMessage("");
              }}
            >
              ยกเลิกการแก้ไข
            </Button>
            <Button type="submit">บันทึกสิทธิ์ตัวอย่าง</Button>
          </div>
        </form>
      </SectionCard>
      <SectionCard
        title={`สรุปสิทธิ์ที่บันทึก · ${saved.displayName}`}
        subtitle={`${saved.department} · ${saved.role}`}
      >
        <div className="flex flex-wrap gap-2">
          {visibleModules(saved).map((module) => (
            <Badge key={module.key} variant="outline">
              {module.label}
            </Badge>
          ))}
          {visibleModules(saved).length === 0 && (
            <p className="text-sm text-muted-foreground">
              ไม่เห็นเมนูใดในตัวอย่างนี้
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
