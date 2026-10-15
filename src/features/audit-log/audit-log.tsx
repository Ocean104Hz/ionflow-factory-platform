"use client";

import { useState } from "react";
import { Eye, History, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Card, CardContent } from "@/src/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/src/components/ui/sheet";
import {
  FactoryDataTable,
  InfoRow,
  PageHeader,
  Pagination,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import {
  auditActions,
  auditEntries,
  emptyAuditFilters,
  filterAuditEntries,
  type AuditEntry,
  type AuditFilters,
} from "@/src/lib/mock-data/audit-log";
import type { Tone } from "@/src/lib/constants/status";

const actionTones: Record<AuditEntry["action"], Tone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "destructive",
  LOGIN: "neutral",
  LOGOUT: "neutral",
  EXPORT: "warning",
};
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
const allOption = { value: "all", label: "ทั้งหมด" };

export function AuditLog() {
  const [draft, setDraft] = useState<AuditFilters>(emptyAuditFilters);
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const rows = filterAuditEntries(auditEntries, filters);
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const additionalCount = [
    draft.user !== "all",
    Boolean(draft.from),
    Boolean(draft.to),
  ].filter(Boolean).length;
  const update = (key: keyof AuditFilters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const columns: Column<AuditEntry>[] = [
    {
      key: "time",
      label: "วันและเวลา",
      render: (entry) => (
        <time className="whitespace-nowrap text-xs" dateTime={entry.occurredAt}>
          {formatTime(entry.occurredAt)}
        </time>
      ),
    },
    {
      key: "user",
      label: "ผู้ทำรายการ",
      render: (entry) => (
        <div>
          <p className="font-medium">{entry.user}</p>
          <p className="text-xs text-muted-foreground">{entry.email}</p>
        </div>
      ),
    },
    {
      key: "action",
      label: "การกระทำ",
      render: (entry) => (
        <StatusBadge tone={actionTones[entry.action]}>
          {auditActions[entry.action]}
        </StatusBadge>
      ),
    },
    {
      key: "module",
      label: "หมวด / เอกสารอ้างอิง",
      render: (entry) => (
        <div>
          <p>{entry.module}</p>
          <p className="text-xs text-muted-foreground">{entry.reference}</p>
        </div>
      ),
    },
    {
      key: "summary",
      label: "รายละเอียด",
      render: (entry) => (
        <p className="max-w-72 leading-relaxed">{entry.summary}</p>
      ),
    },
    {
      key: "view",
      label: "ดูรายละเอียด",
      render: (entry) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`ดูรายละเอียด ${entry.id}`}
          onClick={() => setSelected(entry)}
        >
          <Eye aria-hidden="true" />
          ดู
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="ประวัติการแก้ไข"
        description="ตรวจสอบว่าใครทำอะไร เมื่อไร และข้อมูลใดเปลี่ยนแปลง"
      />
      <Alert>
        <History aria-hidden="true" />
        <AlertTitle>ประวัติสาธิต · อ่านอย่างเดียว</AlertTitle>
        <AlertDescription>
          ข้อมูลสมมติ ณ 14 ต.ค. 2569 ไม่ใช่บันทึกจริง
          และยังไม่บันทึกการทำรายการจากหน้าอื่น
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "รายการที่พบ", value: rows.length, unit: "รายการ" },
          {
            label: "ผู้ทำรายการ",
            value: new Set(rows.map((entry) => entry.email)).size,
            unit: "คน",
          },
          {
            label: "รายการแก้ไขข้อมูล",
            value: rows.filter((entry) => entry.action === "UPDATE").length,
            unit: "รายการ",
          },
        ].map((metric) => (
          <Card key={metric.label} className="py-4 shadow-none">
            <CardContent className="px-5">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {metric.value}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {metric.unit}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <form
        aria-label="ตัวกรองประวัติการแก้ไข"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalidRange) {
            setFilters({ ...draft });
            setPage(1);
          }
        }}
        className="space-y-3"
      >
        <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_180px_200px_auto]">
          <div className="grid gap-2">
            <Label htmlFor="audit-search">ค้นหา</Label>
            <Input
              id="audit-search"
              placeholder="ชื่อผู้ใช้ เลขเอกสาร หรือรายละเอียด"
              value={draft.search}
              onChange={(event) => update("search", event.target.value)}
            />
          </div>
          <SelectField
            label="การกระทำ"
            value={draft.action}
            onChange={(value) => update("action", value)}
            options={[
              allOption,
              ...Object.entries(auditActions).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <SelectField
            label="หมวดข้อมูล"
            value={draft.module}
            onChange={(value) => update("module", value)}
            options={[
              allOption,
              ...Array.from(
                new Set(auditEntries.map((entry) => entry.module)),
              ).map((value) => ({ value, label: value })),
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" type="button">
                  <SlidersHorizontal aria-hidden="true" />
                  ตัวกรองเพิ่มเติม
                  {additionalCount ? ` (${additionalCount})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-80 max-w-[calc(100vw-2rem)] space-y-4"
              >
                <p className="text-sm font-semibold">
                  ผู้ทำรายการและช่วงวันที่
                </p>
                <SelectField
                  label="ผู้ทำรายการ"
                  value={draft.user}
                  onChange={(value) => update("user", value)}
                  options={[
                    allOption,
                    ...Array.from(
                      new Map(
                        auditEntries.map((entry) => [
                          entry.email,
                          { value: entry.email, label: entry.user },
                        ]),
                      ).values(),
                    ),
                  ]}
                />
                <div className="grid gap-2">
                  <Label htmlFor="audit-from">วันที่เริ่มต้น</Label>
                  <Input
                    id="audit-from"
                    type="date"
                    value={draft.from}
                    max={draft.to || undefined}
                    onChange={(event) => update("from", event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="audit-to">วันที่สิ้นสุด</Label>
                  <Input
                    id="audit-to"
                    type="date"
                    value={draft.to}
                    min={draft.from || undefined}
                    onChange={(event) => update("to", event.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  รวมวันเริ่มต้นและสิ้นสุด ตามเวลาไทย กดค้นหาเพื่อใช้ตัวกรอง
                </p>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft({ ...emptyAuditFilters });
                setFilters({ ...emptyAuditFilters });
                setPage(1);
              }}
            >
              ล้างตัวกรอง
            </Button>
            <Button type="submit" disabled={invalidRange}>
              <Search aria-hidden="true" />
              ค้นหา
            </Button>
          </div>
        </div>
        {invalidRange && (
          <p role="alert" className="text-sm text-danger">
            วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น
          </p>
        )}
      </form>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p role="status" className="text-sm text-muted-foreground">
          พบ {rows.length} รายการ · เรียงจากล่าสุด · เวลาไทย (UTC+7)
        </p>
        <div className="w-36">
          <SelectField
            label="จำนวนต่อหน้า"
            value={pageSize}
            onChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            options={["5", "10", "20"].map((value) => ({
              value,
              label: `${value} รายการ`,
            }))}
          />
        </div>
      </div>
      <FactoryDataTable
        columns={columns}
        rows={rows.slice(
          (page - 1) * Number(pageSize),
          page * Number(pageSize),
        )}
        rowKey={(entry) => entry.id}
        minWidth={1080}
        pagination={
          <Pagination
            page={page}
            pageSize={Number(pageSize)}
            total={rows.length}
            onChange={setPage}
          />
        }
      />
      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent
          showCloseButton={false}
          className="w-full overflow-y-auto sm:max-w-2xl"
        >
          <SheetHeader className="border-b p-5">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle>รายละเอียดประวัติ</SheetTitle>
              <SheetClose asChild>
                <Button variant="outline" size="sm">
                  ปิดรายละเอียด
                </Button>
              </SheetClose>
            </div>
            <SheetDescription>
              ข้อมูลสาธิตแบบอ่านอย่างเดียว ไม่สามารถแก้ไขหรือลบประวัติได้
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="space-y-6 p-5 pt-0">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone={actionTones[selected.action]}>
                  {auditActions[selected.action]}
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {selected.id}
                </span>
              </div>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <InfoRow label="ผู้ทำรายการ">{selected.user}</InfoRow>
                <InfoRow label="อีเมล">{selected.email}</InfoRow>
                <InfoRow label="วันและเวลา (ไทย)">
                  {formatTime(selected.occurredAt)}
                </InfoRow>
                <InfoRow label="IP สาธิต">{selected.ipAddress}</InfoRow>
                <InfoRow label="หมวดข้อมูล">{selected.module}</InfoRow>
                <InfoRow label="เอกสารอ้างอิง">{selected.reference}</InfoRow>
              </dl>
              <section className="space-y-2">
                <h2 className="text-sm font-semibold">สรุปการทำรายการ</h2>
                <p className="text-sm leading-relaxed">{selected.summary}</p>
              </section>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">ข้อมูลก่อน–หลังแก้ไข</h2>
                {selected.changes.length ? (
                  <FactoryDataTable
                    minWidth={520}
                    rows={selected.changes}
                    rowKey={(change) => change.field}
                    columns={[
                      {
                        key: "field",
                        label: "ข้อมูล",
                        render: (change) => change.field,
                      },
                      {
                        key: "before",
                        label: "ก่อนแก้ไข",
                        render: (change) => (
                          <span className="break-words text-muted-foreground">
                            {change.before}
                          </span>
                        ),
                      },
                      {
                        key: "after",
                        label: "หลังแก้ไข",
                        render: (change) => (
                          <span className="break-words font-medium">
                            {change.after}
                          </span>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    เหตุการณ์นี้ไม่มีข้อมูลเปรียบเทียบก่อน–หลัง
                  </p>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
