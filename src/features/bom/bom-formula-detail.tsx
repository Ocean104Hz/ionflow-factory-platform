"use client";
import { useState } from "react";
import { Plus, Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  SectionCard,
  InfoGrid,
  InfoRow,
  StatusBadge,
  FactoryDataTable,
  type Column,
} from "@/src/components/factory/patterns";
import { date, dateTime } from "@/src/lib/formatters";
import { useBOM } from "./bom-provider";
import {
  productTypes,
  formulaStatuses,
  canHaveFormula,
  type Master,
  type Formula,
  type Component,
} from "./bom-domain";
export const formulaTone = (status: Formula["status"]) =>
  status === "ACTIVE"
    ? ("success" as const)
    : status === "DRAFT"
      ? ("warning" as const)
      : ("neutral" as const);

export function BOMMasterDetail({
  master,
  onEdit,
  onNewFormula,
  onViewFormula,
  onDeleted,
}: {
  master: Master;
  onEdit: () => void;
  onNewFormula: () => void;
  onViewFormula: (id: string) => void;
  onDeleted: () => void;
}) {
  const { state, removeMaster } = useBOM();
  const [error, setError] = useState("");
  const formulas = state.formulas.filter((f) => f.masterId === master.id);
  const columns: Column<Formula>[] = [
    {
      key: "code",
      label: "รหัส / ชื่อสูตร",
      render: (f) => (
        <Button variant="link" onClick={() => onViewFormula(f.id)}>
          {f.code} · {f.name}
        </Button>
      ),
    },
    { key: "version", label: "เวอร์ชัน", render: (f) => f.version },
    {
      key: "status",
      label: "สถานะ",
      render: (f) => (
        <StatusBadge tone={formulaTone(f.status)}>
          {formulaStatuses[f.status]}
        </StatusBadge>
      ),
    },
    {
      key: "default",
      label: "สูตรเริ่มต้น",
      render: (f) =>
        f.id === master.defaultFormulaId ? (
          <StatusBadge tone="info">ค่าเริ่มต้น</StatusBadge>
        ) : (
          "—"
        ),
    },
    {
      key: "batch",
      label: "ปริมาณ / รอบ",
      render: (f) => `${f.batchSize.toLocaleString("th-TH")} ${f.unit}`,
    },
    {
      key: "date",
      label: "เริ่มใช้",
      render: (f) => (f.effectiveDate ? date(f.effectiveDate) : "—"),
    },
  ];
  return (
    <div className="space-y-5">
      <SectionCard
        title={`${master.code} · ${master.name}`}
        action={
          <Button variant="outline" onClick={onEdit}>
            <Pencil />
            แก้ไขข้อมูลหลัก
          </Button>
        }
      >
        <InfoGrid>
          {[
            ["ประเภท", productTypes[master.type]],
            ["หน่วยหลัก", master.unit],
            ["การใช้งาน", master.usageType],
            ["บริษัท", master.company],
            ["กระบวนการ", master.process],
            ["หมวดสินค้า", master.category],
            ["แบรนด์", master.brand],
            ["แผนก", master.department],
            ["สร้างเมื่อ", dateTime(master.createdAt)],
            ["อัปเดตเมื่อ", dateTime(master.updatedAt)],
            ["อัปเดตโดย", master.updatedBy],
          ].map(([label, value]) => (
            <InfoRow key={label} label={label}>
              {value || "—"}
            </InfoRow>
          ))}
        </InfoGrid>
        <p className="mt-5 text-sm whitespace-pre-wrap">
          หมายเหตุ: {master.notes || "—"}
        </p>
      </SectionCard>
      <SectionCard
        title={`สูตรที่เชื่อมโยง (${formulas.length})`}
        subtitle={
          canHaveFormula(master)
            ? "ทุกเวอร์ชันยังคงแสดงอยู่ ไม่เขียนทับเวอร์ชันเก่า"
            : "ประเภทวัตถุดิบ/วัสดุย่อยใช้เป็นส่วนประกอบ ไม่สร้างสูตรของตัวเอง"
        }
        action={
          canHaveFormula(master) ? (
            <Button onClick={onNewFormula}>
              <Plus />
              สร้างสูตร / เวอร์ชันใหม่
            </Button>
          ) : undefined
        }
      >
        <FactoryDataTable
          columns={columns}
          rows={formulas}
          rowKey={(f) => f.id}
          minWidth={900}
        />
      </SectionCard>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <ConfirmDialog
        title="ลบข้อมูลหลักนี้?"
        description="จะลบได้เฉพาะรายการที่ไม่มีสูตรและไม่ถูกใช้เป็นส่วนประกอบ ไม่มีการลบสูตรแบบต่อเนื่อง"
        trigger={
          <Button variant="outline" className="text-danger">
            <Trash2 />
            ลบข้อมูลหลัก
          </Button>
        }
        onConfirm={() => {
          try {
            removeMaster(master.id);
            onDeleted();
          } catch (e) {
            setError(e instanceof Error ? e.message : "ลบไม่ได้");
          }
        }}
      />
    </div>
  );
}

export function BOMFormulaDetail({
  formula,
  master,
  onEdit,
  onBack,
}: {
  formula: Formula;
  master: Master;
  onEdit: () => void;
  onBack: () => void;
}) {
  const { state, setDefault, removeFormula } = useBOM();
  const [error, setError] = useState("");
  function run(action: () => void) {
    try {
      action();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่ได้");
    }
  }
  function materials(rows: Component[], title: string) {
    const columns: Column<Component>[] = [
      {
        key: "code",
        label: "รหัสวัสดุ",
        render: (r) =>
          state.masters.find((m) => m.id === r.materialId)?.code ??
          "ไม่พบวัสดุ",
      },
      {
        key: "name",
        label: "ชื่อวัสดุ",
        render: (r) =>
          state.masters.find((m) => m.id === r.materialId)?.name ??
          "อ้างอิงไม่ถูกต้อง",
      },
      {
        key: "quantity",
        label: "จำนวน",
        numeric: true,
        render: (r) =>
          r.quantity.toLocaleString("th-TH", { maximumFractionDigits: 6 }),
      },
      { key: "unit", label: "หน่วย", render: (r) => r.unit },
      { key: "note", label: "หมายเหตุ", render: (r) => r.remarks || "—" },
    ];
    return (
      <SectionCard title={title}>
        {rows.length ? (
          <FactoryDataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.materialId}
            minWidth={800}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            สูตรนี้ไม่มีบรรจุภัณฑ์
          </p>
        )}
      </SectionCard>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={formulaTone(formula.status)}>
          {formulaStatuses[formula.status]}
        </StatusBadge>
        {master.defaultFormulaId === formula.id && (
          <StatusBadge tone="info">สูตรเริ่มต้น</StatusBadge>
        )}
        <span className="text-sm text-muted-foreground">
          {master.code} · {master.name}
        </span>
      </div>
      <SectionCard
        title={formula.name}
        action={
          <Button variant="outline" onClick={onEdit}>
            <Pencil />
            แก้ไขสูตร
          </Button>
        }
      >
        <InfoGrid>
          {[
            ["รหัสสูตร", formula.code],
            ["เวอร์ชัน", formula.version],
            ["ประเภทสินค้า", productTypes[master.type]],
            [
              "ปริมาณผลิต / รอบ",
              `${formula.batchSize.toLocaleString("th-TH")} ${formula.unit}`,
            ],
            [
              "วันที่เริ่มใช้",
              formula.effectiveDate ? date(formula.effectiveDate) : "—",
            ],
            ["สร้างเมื่อ", dateTime(formula.createdAt)],
            ["อัปเดตล่าสุด", dateTime(formula.updatedAt)],
          ].map(([label, value]) => (
            <InfoRow key={label} label={label}>
              {value}
            </InfoRow>
          ))}
        </InfoGrid>
        <p className="mt-4 text-sm whitespace-pre-wrap">
          หมายเหตุ: {formula.notes || "—"}
        </p>
      </SectionCard>
      {materials(formula.ingredients, "ส่วนประกอบวัตถุดิบ")}
      {materials(formula.packaging, "ส่วนประกอบบรรจุภัณฑ์")}
      <SectionCard title="ประวัติการเปลี่ยนแปลง (สาธิต)">
        <ol className="space-y-3">
          {formula.history.map((event, i) => (
            <li
              key={`${event.at}-${i}`}
              className="border-l-2 border-primary/30 pl-4"
            >
              <p className="font-medium">{event.action}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(event.at)} · {event.actor}
              </p>
            </li>
          ))}
        </ol>
      </SectionCard>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="sticky -bottom-5 flex flex-wrap items-center justify-between gap-2 border-t bg-background py-4">
        <Button variant="outline" onClick={onBack}>
          กลับข้อมูลสินค้า
        </Button>
        <div className="flex flex-wrap gap-2">
          {master.defaultFormulaId === formula.id ? (
            <Button
              variant="outline"
              onClick={() => run(() => setDefault(master.id, null))}
            >
              ยกเลิกสูตรเริ่มต้น
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={formula.status !== "ACTIVE"}
              onClick={() => run(() => setDefault(master.id, formula.id))}
            >
              <Star />
              ใช้เป็นสูตรเริ่มต้น
            </Button>
          )}
          <ConfirmDialog
            title="ลบสูตรนี้?"
            description={`สูตร ${formula.code} ${formula.version} จะถูกลบจากข้อมูลสาธิต หากเป็นค่าเริ่มต้นต้องยกเลิกค่าเริ่มต้นก่อน`}
            trigger={
              <Button variant="outline" className="text-danger">
                <Trash2 />
                ลบสูตร
              </Button>
            }
            onConfirm={() =>
              run(() => {
                removeFormula(formula.id);
                onBack();
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
