"use client";

import { useId, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Alert, AlertDescription } from "../ui/alert";
import { ConfirmDialog } from "./confirm-dialog";
import {
  FactoryDataTable,
  Pagination,
  SectionCard,
  SelectField,
  StatusBadge,
  type Column,
} from "./patterns";
import {
  demoMasterSettings,
  masterSettingTypes,
  validateMasterSetting,
  type MasterSettingKind,
  type MasterSettingRow,
} from "@/src/lib/mock-data/master-settings";

export function MasterSettings({ kind }: { kind: MasterSettingKind }) {
  const id = useId();
  const isDepartment = kind === "departments";
  const title = isDepartment ? "แผนก/ฝ่าย" : "คลังสินค้า";
  const [rows, setRows] = useState(demoMasterSettings[kind]);
  const [draft, setDraft] = useState<MasterSettingRow | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const types = masterSettingTypes[kind];
  const filtered = rows.filter(
    (row) =>
      `${row.code} ${row.name}`
        .toLocaleLowerCase("th-TH")
        .includes(search.trim().toLocaleLowerCase("th-TH")) &&
      (type === "all" || row.type === type) &&
      (status === "all" || row.active === (status === "active")),
  );
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / 10)),
  );
  const isEditing = draft ? rows.some((row) => row.id === draft.id) : false;
  function openEditor(row?: MasterSettingRow) {
    setDraft(
      row
        ? { ...row }
        : {
            id: crypto.randomUUID(),
            code: "",
            name: "",
            type: types[0],
            active: true,
          },
    );
    setError("");
    setMessage("");
  }
  const columns: Column<MasterSettingRow>[] = [
    {
      key: "type",
      label: "ประเภท",
      render: (row) => <StatusBadge>{row.type}</StatusBadge>,
    },
    {
      key: "code",
      label: "รหัส",
      render: (row) => (
        <span className="font-medium text-primary">{row.code}</span>
      ),
    },
    {
      key: "name",
      label: isDepartment ? "ชื่อแผนก/ฝ่าย" : "ชื่อคลังสินค้า / สถานที่",
      render: (row) => row.name,
    },
    {
      key: "status",
      label: "สถานะ",
      render: (row) => (
        <StatusBadge tone={row.active ? "success" : "neutral"}>
          {row.active ? "ใช้งาน" : "ปิดใช้งาน"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "จัดการ",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`แก้ไข ${row.code}`}
            onClick={() => openEditor(row)}
          >
            <Pencil aria-hidden="true" />
            แก้ไข
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`${row.active ? "ปิด" : "เปิด"}ใช้งาน ${row.code}`}
            onClick={() => {
              setRows((previous) =>
                previous.map((item) =>
                  item.id === row.id ? { ...item, active: !item.active } : item,
                ),
              );
              setDraft((previous) =>
                previous?.id === row.id
                  ? { ...previous, active: !row.active }
                  : previous,
              );
              setMessage(
                `${row.active ? "ปิด" : "เปิด"}ใช้งาน ${row.code} แล้ว (สาธิต)`,
              );
            }}
          >
            {row.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          </Button>
          <ConfirmDialog
            title={`ลบ${title}`}
            description={`ลบ ${row.code} · ${row.name} จากรายการสาธิต ข้อมูลจะคืนค่าเมื่อเปิดหน้าตั้งค่าใหม่`}
            trigger={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-danger"
                aria-label={`ลบ ${row.code}`}
              >
                <Trash2 aria-hidden="true" />
                ลบ
              </Button>
            }
            onConfirm={() => {
              setRows((previous) =>
                previous.filter((item) => item.id !== row.id),
              );
              setDraft((previous) =>
                previous?.id === row.id ? null : previous,
              );
              setMessage(`ลบ ${row.code} แล้ว (สาธิต)`);
            }}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          จัดการข้อมูล{title}สาธิต · เก็บเฉพาะขณะอยู่หน้าตั้งค่า สลับแท็บได้
          แต่เมื่อออกจากหน้าหรือโหลดใหม่จะคืนค่า ยังไม่เชื่อมตัวเลือก PR
          หรือบัญชีผู้ใช้
        </AlertDescription>
      </Alert>
      <SectionCard
        title={`ตั้งค่า${title}`}
        subtitle={
          isDepartment
            ? "จัดการชื่อ รหัส ประเภท และสถานะของแผนก/ฝ่าย"
            : "จัดการคลังสินค้า สถานที่ โรงงาน และสถานะการใช้งาน"
        }
        action={
          <Button type="button" onClick={() => openEditor()}>
            <Plus aria-hidden="true" />
            เพิ่ม{title}
          </Button>
        }
      >
        <div className="grid items-end gap-3 pb-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_160px_160px_auto]">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-search`}>ค้นหารหัสหรือชื่อ{title}</Label>
            <Input
              id={`${id}-search`}
              placeholder={`ค้นหา${title}`}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <SelectField
            label="ประเภท"
            value={type}
            onChange={(value) => {
              setType(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "ทุกประเภท" },
              ...types.map((value) => ({ value, label: value })),
            ]}
          />
          <SelectField
            label="สถานะ"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "ทุกสถานะ" },
              { value: "active", label: "ใช้งาน" },
              { value: "inactive", label: "ปิดใช้งาน" },
            ]}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              setType("all");
              setStatus("all");
              setPage(1);
            }}
          >
            ล้างตัวกรอง
          </Button>
        </div>
        <FactoryDataTable
          columns={columns}
          rows={filtered.slice((currentPage - 1) * 10, currentPage * 10)}
          rowKey={(row) => row.id}
          minWidth={850}
          pagination={
            <Pagination
              page={currentPage}
              pageSize={10}
              total={filtered.length}
              onChange={setPage}
            />
          }
        />
      </SectionCard>
      {draft && (
        <SectionCard
          title={`${isEditing ? "แก้ไข" : "เพิ่ม"}${title}`}
          subtitle="กรอกข้อมูลด้านล่างแล้วกดบันทึก · ไม่เปิด modal"
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const issue = validateMasterSetting(draft, rows, kind);
              setError(issue);
              if (issue) return;
              const saved = {
                ...draft,
                code: draft.code.trim().toUpperCase(),
                name: draft.name.trim(),
              };
              setRows((previous) =>
                isEditing
                  ? previous.map((row) => (row.id === saved.id ? saved : row))
                  : [saved, ...previous],
              );
              setDraft(null);
              setPage(1);
              setMessage(
                `บันทึก ${saved.code} แล้ว (สาธิต)${search || type !== "all" || status !== "all" ? " · ล้างตัวกรองหากไม่พบรายการ" : ""}`,
              );
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-code`}>รหัส *</Label>
                <Input
                  id={`${id}-code`}
                  value={draft.code}
                  maxLength={30}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, code: event.target.value })
                  }
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-name`}>ชื่อ{title} *</Label>
                <Input
                  id={`${id}-name`}
                  value={draft.name}
                  maxLength={100}
                  required
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </div>
              <SelectField
                label="ประเภท *"
                value={draft.type}
                onChange={(value) => setDraft({ ...draft, type: value })}
                options={types.map((value) => ({ value, label: value }))}
              />
              <SelectField
                label="สถานะการใช้งาน"
                value={draft.active ? "active" : "inactive"}
                onChange={(value) =>
                  setDraft({ ...draft, active: value === "active" })
                }
                options={[
                  { value: "active", label: "ใช้งาน" },
                  { value: "inactive", label: "ปิดใช้งาน" },
                ]}
              />
            </div>
            {error && (
              <p
                id={`${id}-error`}
                role="alert"
                className="text-sm text-danger"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                ยกเลิก
              </Button>
              <Button type="submit">บันทึก{title}</Button>
            </div>
          </form>
        </SectionCard>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
