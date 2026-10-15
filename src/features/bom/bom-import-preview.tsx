"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  FactoryDataTable,
  type Column,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { demoImportRows } from "@/src/lib/mock-data/bom";
import { importFeedback, type ImportRow } from "./bom-domain";
import { useBOM } from "./bom-provider";

export function BOMImportPreview({ onClose }: { onClose: () => void }) {
  const { state, importRows } = useBOM();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [fileMessage, setFileMessage] = useState("");
  const [message, setMessage] = useState("");
  const errors = importFeedback(state, rows);
  const chosen = rows.filter((r) => selected.includes(r.key) && !errors[r.key]);
  const columns: Column<ImportRow>[] = [
    {
      key: "select",
      label: "เลือก",
      render: (r) => (
        <Checkbox
          aria-label={`เลือกแถว ${r.key}`}
          disabled={!!errors[r.key]}
          checked={!errors[r.key] && selected.includes(r.key)}
          onCheckedChange={(v) =>
            setSelected((ids) =>
              v === true ? [...ids, r.key] : ids.filter((id) => id !== r.key),
            )
          }
        />
      ),
    },
    { key: "row", label: "แถวตัวอย่าง", render: (r) => r.key },
    {
      key: "kind",
      label: "ประเภท",
      render: (r) => (r.kind === "master" ? "ข้อมูลหลัก" : "สูตร"),
    },
    { key: "code", label: "รหัส", render: (r) => r.data.code },
    { key: "name", label: "ชื่อ", render: (r) => r.data.name },
    {
      key: "version",
      label: "เวอร์ชัน",
      render: (r) => (r.kind === "formula" ? r.data.version : "—"),
    },
    {
      key: "errors",
      label: "ผลตรวจสอบ",
      render: (r) => (
        <span className={errors[r.key] ? "text-danger" : "text-success"}>
          {errors[r.key] || "พร้อมนำเข้าข้อมูลตัวอย่าง"}
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-info/20 bg-info/5 p-4 text-sm">
        <p className="font-medium">
          UI Demo — ไม่อ่านหรืออัปโหลดเนื้อหาไฟล์ Excel
        </p>
        <p className="mt-1 text-muted-foreground">
          เลือกไฟล์เพื่อดูชื่อเท่านั้น แล้วกด “โหลดข้อมูลตัวอย่าง”
          เพื่อทดลองตรวจสอบและเพิ่ม fixture ลง state จริงของหน้านี้
          ไม่ใช่ข้อมูลจากไฟล์ที่เลือก
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bom-import-file">
          ไฟล์ Excel (.xlsx / .xls) — แสดงชื่อเท่านั้น
        </Label>
        <Input
          id="bom-import-file"
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setMessage("");
            setRows([]);
            setSelected([]);
            if (!file) {
              setFileMessage("");
              return;
            }
            if (!/\.(xlsx|xls)$/i.test(file.name)) {
              setFileMessage(
                "ไม่รองรับไฟล์นี้ กรุณาเลือก .xlsx หรือ .xls (ยังไม่มีตัวอ่านไฟล์จริง)",
              );
              e.target.value = "";
              return;
            }
            setFileMessage(
              `เลือก ${file.name} แล้ว — ยังไม่ได้อ่านหรือนำเข้าข้อมูลจากไฟล์`,
            );
          }}
        />
        <p role="status" className="text-sm text-muted-foreground">
          {fileMessage}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          const demo = demoImportRows();
          const issues = importFeedback(state, demo);
          setRows(demo);
          setSelected(demo.filter((r) => !issues[r.key]).map((r) => r.key));
          setMessage("");
        }}
      >
        โหลดข้อมูลตัวอย่าง
      </Button>
      <FactoryDataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.key}
        minWidth={950}
      />
      <p className="text-sm" role="status">
        เลือก {chosen.length} จาก {rows.length} แถว ·
        แถวผิดพลาดหรือรหัส/เวอร์ชันซ้ำจะไม่ถูกนำเข้า
      </p>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="sticky -bottom-5 flex justify-end gap-2 border-t bg-background py-4">
        <Button variant="outline" onClick={onClose}>
          ปิด
        </Button>
        <ConfirmDialog
          title="ยืนยันเพิ่มข้อมูลตัวอย่าง?"
          description={`เพิ่ม ${chosen.length} แถวที่เลือกลง BOM demo เท่านั้น ไม่เขียนทับรายการเดิม`}
          trigger={
            <Button disabled={!chosen.length}>
              ยืนยันนำเข้าข้อมูลตัวอย่าง ({chosen.length})
            </Button>
          }
          onConfirm={() => {
            try {
              importRows(chosen);
              setSelected([]);
              setMessage(
                `เพิ่มข้อมูลตัวอย่าง ${chosen.length} แถวแล้ว (ไม่ใช่ข้อมูลจากไฟล์ Excel)`,
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "นำเข้าตัวอย่างไม่สำเร็จ ไม่มีข้อมูลถูกเปลี่ยนแปลง",
              );
            }
          }}
        />
      </div>
    </div>
  );
}
