"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/src/components/ui/dialog";
import {
  FactoryDataTable,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  mixingCatalog,
  mixingImportSamples,
} from "@/src/lib/mock-data/fertilizer-powder-mixing";
import { useMixing } from "./mixing-provider";
import { previewImport, type MixingReport } from "./mixing-domain";

export function MixingImportPreview() {
  const { records, importRows } = useMixing();
  const [open, setOpen] = useState(false);
  const [samples, setSamples] = useState<MixingReport[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState("");
  const [message, setMessage] = useState("");
  const preview = previewImport(samples, records, mixingCatalog);
  const validSelected = preview.filter(
    (p) => p.valid && selected.includes(p.row.id),
  );
  const columns: Column<(typeof preview)[number]>[] = [
    {
      key: "select",
      label: "เลือกข้อมูลตัวอย่าง",
      render: (p) => (
        <Checkbox
          aria-label={`เลือกตัวอย่าง ${p.row.doc_no}`}
          disabled={!p.valid}
          checked={p.valid && selected.includes(p.row.id)}
          onCheckedChange={(v) =>
            setSelected((ids) =>
              v === true
                ? [...ids, p.row.id]
                : ids.filter((id) => id !== p.row.id),
            )
          }
        />
      ),
    },
    { key: "doc", label: "เลขที่เอกสาร", render: (p) => p.row.doc_no },
    {
      key: "formula",
      label: "สูตร / ผลิตภัณฑ์",
      render: (p) => p.row.fertilizer,
    },
    {
      key: "validation",
      label: "ผลตรวจข้อมูล",
      render: (p) =>
        p.valid ? (
          <StatusBadge tone="success">พร้อมเพิ่มข้อมูลตัวอย่าง</StatusBadge>
        ) : (
          <div className="max-w-72 text-xs text-danger">
            {Object.values(p.errors).join(" · ")}
          </div>
        ),
    },
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => setMessage("")}>
          Import Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="pr-8">
          <DialogTitle>นำเข้าข้อมูลตัวอย่าง · UI Demo</DialogTitle>
          <DialogDescription>
            ไม่อ่านเนื้อหาไฟล์ ไม่อัปโหลดไฟล์ และไม่รองรับการนำเข้า Excel จริง
            ปุ่มยืนยันจะเพิ่มเฉพาะข้อมูลตัวอย่างด้านล่าง
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <Label htmlFor="mix-import-file">
            เลือกไฟล์เพื่อแสดงชื่อเท่านั้น (.xlsx / .xls)
          </Label>
          <Input
            id="mix-import-file"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setFile(f?.name ?? "");
              setMessage(
                f && !/\.xlsx?$/i.test(f.name)
                  ? "ไม่รองรับนามสกุลนี้ · ไม่มีการอ่านหรือนำเข้าไฟล์"
                  : "ไฟล์ไม่ได้ถูกอ่านหรืออัปโหลด",
              );
            }}
          />
          {file && (
            <p className="break-all text-sm text-muted-foreground">
              ไฟล์ที่เลือก: {file} (ชื่อไฟล์เท่านั้น)
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setSamples(mixingImportSamples());
              setSelected([]);
              setMessage("โหลดชุดตัวอย่าง DEMO แล้ว ไม่ได้อ่านข้อมูลจากไฟล์");
            }}
          >
            โหลดข้อมูลตัวอย่าง
          </Button>
          <FactoryDataTable
            rows={preview}
            columns={columns}
            rowKey={(p) => p.row.id}
            minWidth={750}
          />
          <p role="status" className="text-sm">
            เลือกข้อมูลที่ผ่านตรวจ {validSelected.length} รายการ · {message}
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">ปิด</Button>
          </DialogClose>
          <ConfirmDialog
            title="เพิ่มข้อมูลตัวอย่างที่เลือก?"
            description={`เพิ่ม ${validSelected.length} รายการจากชุด DEMO ไม่ใช่จากไฟล์ที่เลือก`}
            trigger={
              <Button disabled={!validSelected.length}>
                ยืนยันเพิ่มตัวอย่าง {validSelected.length} รายการ
              </Button>
            }
            onConfirm={() => {
              try {
                importRows(validSelected.map((p) => p.row));
                setSelected([]);
                setMessage(
                  `เพิ่มข้อมูลตัวอย่าง ${validSelected.length} รายการแล้ว`,
                );
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "เพิ่มข้อมูลไม่สำเร็จ",
                );
              }
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function MixingExportPreview({ rows }: { rows: MixingReport[] }) {
  const columns: Column<MixingReport>[] = [
    { key: "doc", label: "เลขที่เอกสาร", render: (r) => r.doc_no },
    { key: "date", label: "วันที่รายงาน", render: (r) => r.report_date },
    { key: "formula", label: "สูตร / ผลิตภัณฑ์", render: (r) => r.fertilizer },
    { key: "lot", label: "Lot", render: (r) => r.lot_no },
    { key: "shift", label: "กะ", render: (r) => r.shift },
    { key: "location", label: "สถานที่", render: (r) => r.location },
    {
      key: "materials",
      label: "จำนวนวัตถุดิบ",
      render: (r) => r.materials.length,
    },
    { key: "rounds", label: "จำนวนรอบ", render: (r) => r.mix_rounds.length },
  ];
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Excel Preview</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] w-[96vw] max-w-[96vw] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="pr-8">
          <DialogTitle>ตัวอย่างตารางส่งออก Excel · UI Demo</DialogTitle>
          <DialogDescription>
            ข้อมูลรายงานตามตัวกรองปัจจุบัน {rows.length} รายการ ·
            แสดงคอลัมน์ตัวอย่างเท่านั้น ยังไม่สร้างหรือดาวน์โหลดไฟล์ Excel
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-auto">
          <FactoryDataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            minWidth={950}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">ปิดพรีวิว</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
