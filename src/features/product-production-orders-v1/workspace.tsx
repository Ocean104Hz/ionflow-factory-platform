"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  FileSpreadsheet,
  FileText,
  History,
  Link2,
  LockKeyhole,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

type ProductionLine = {
  id: string;
  date: string;
  lineT1Qty: string;
  lineT1Lot: string;
  lineT2Qty: string;
  lineT2Lot: string;
  lineT4Qty: string;
  lineT4Lot: string;
  shift: string;
  producer: string;
};

type Signers = {
  preparedBy: string;
  qaOfficer: string;
  productionOfficer: string;
  manager: string;
};

const newLine = (): ProductionLine => ({
  id: crypto.randomUUID(),
  date: "",
  lineT1Qty: "",
  lineT1Lot: "",
  lineT2Qty: "",
  lineT2Lot: "",
  lineT4Qty: "",
  lineT4Lot: "",
  shift: "",
  producer: "",
});

const signerFields: Array<{ key: keyof Signers; label: string }> = [
  { key: "preparedBy", label: "ผู้ออกใบสั่งผลิต" },
  { key: "qaOfficer", label: "ฝ่ายตรวจสอบคุณภาพ" },
  { key: "productionOfficer", label: "ฝ่ายผลิต" },
  { key: "manager", label: "ผู้จัดการ" },
];

const historyColumns = [
  "#",
  "เลขที่เอกสาร",
  "โรงงานผลิต",
  "วันที่",
  "ผลิตปุ๋ย",
  "จำนวน (ตัน)",
  "ผลิตแล้ว (ตัน)",
  "ยอดค้าง (ตัน)",
  "วันที่ผลิต",
  "หมายเหตุ",
  "ผู้ออกใบสั่งผลิต",
  "ฝ่ายตรวจคุณภาพ",
  "ฝ่ายผลิต",
  "ผู้จัดการ",
  "จัดการ",
];

function quantity(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function DocumentSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="font-semibold text-[#1e3868]">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function ProductProductionOrdersV1Workspace() {
  const [tab, setTab] = useState("form");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [formula, setFormula] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ProductionLine[]>([newLine()]);
  const [signers, setSigners] = useState<Signers>({
    preparedBy: "",
    qaOfficer: "",
    productionOfficer: "",
    manager: "",
  });
  const [historySearch, setHistorySearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [pageSize, setPageSize] = useState("10");
  const [docNumberOpen, setDocNumberOpen] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaSearch, setFormulaSearch] = useState("");
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const produced = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          quantity(row.lineT1Qty) +
          quantity(row.lineT2Qty) +
          quantity(row.lineT4Qty),
        0,
      ),
    [rows],
  );
  const remaining = Math.max(0, quantity(amount) - produced);
  const selectedDate = date ? new Date(`${date}T00:00:00`) : null;
  const docNumberPreview = selectedDate
    ? `PRD-${String(selectedDate.getFullYear()).slice(-2)}${String(
        selectedDate.getMonth() + 1,
      ).padStart(2, "0")}XXX`
    : "กรุณาเลือกวันที่เอกสารก่อน";

  function editRow(id: string, patch: Partial<ProductionLine>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((row) => row.id !== id) : current,
    );
  }

  return (
    <div className="min-w-0 pb-10 text-[#1e3868]">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex justify-center">
          <TabsList className="h-auto w-full max-w-xl rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <TabsTrigger
              value="form"
              className="flex-1 gap-2 rounded-full px-6 py-2 text-xs transition-all md:text-sm data-[state=active]:scale-[1.02] data-[state=active]:bg-[#84CAED] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <FileText className="size-4" aria-hidden="true" />
              สร้างใบสั่งผลิต
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1 gap-2 rounded-full px-6 py-2 text-xs transition-all md:text-sm data-[state=active]:scale-[1.02] data-[state=active]:bg-[#84CAED] data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <History className="size-4" aria-hidden="true" />
              ประวัติใบสั่งผลิต
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="form" className="space-y-4">
          <DocumentSection
            title="ใบสั่งงาน"
            subtitle="ข้อมูลหัวเอกสารและแผนการผลิต"
            action={
              <Button
                type="button"
                className="h-9 bg-[#84CAED] text-white hover:bg-[#90DBD8]"
                onClick={() => setImportOpen(true)}
              >
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                นำเข้า Excel
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
              <Field label="วันที่" type="date" value={date} onChange={setDate} />
              <div className="min-w-0 space-y-2 md:col-span-2">
                <Label>เลขที่เอกสาร</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value="" readOnly placeholder="กดสร้างเลข PRD" className="min-w-0 flex-1 bg-muted/40" />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[#84CAED] text-[#1e3868]"
                    onClick={() => setDocNumberOpen(true)}
                  >
                    สร้างเลข PRD
                  </Button>
                </div>
              </div>
              <Field
                label="สถานที่"
                value={location}
                onChange={setLocation}
                placeholder="เลือกหรือพิมพ์สถานที่ผลิต"
              />
              <div className="min-w-0 space-y-2">
                <Label>ผลิตปุ๋ย</Label>
                <div className="flex gap-2">
                  <Input
                    value={formula}
                    onChange={(event) => setFormula(event.target.value)}
                    placeholder="ค้นหาสูตรปุ๋ย"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFormulaOpen(true)}
                    aria-label="ค้นหาสูตรปุ๋ย"
                    title="ค้นหาสูตรปุ๋ย"
                  >
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>
              <Field
                label="จำนวน (ตัน)"
                type="number"
                value={amount}
                onChange={setAmount}
                placeholder="0.000"
              />
              <div className="min-w-0 space-y-2">
                <Label>ยอดค้าง (ตัน)</Label>
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{remaining.toFixed(3)}</span>
                    <span className="text-xs text-muted-foreground">ตัน</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ผลิตแล้ว {produced.toFixed(3)} ตัน / แผน {quantity(amount).toFixed(3)} ตัน
                  </p>
                </div>
              </div>
              <div className="min-w-0 space-y-2 md:col-span-7">
                <Label>อ้างอิงเอกสาร ใบรายงานผสมปุ๋ยผง</Label>
                <div className="flex flex-col gap-2 lg:flex-row">
                  <Input
                    value=""
                    readOnly
                    placeholder="กดเลือกเอกสาร ใบรายงานผสมปุ๋ยผง"
                    className="min-w-0 flex-1 bg-muted/40"
                  />
                  <Button
                    type="button"
                    className="bg-[#84CAED] text-white hover:bg-[#90DBD8]"
                    onClick={() => setReferenceOpen(true)}
                  >
                    <Link2 className="size-4" aria-hidden="true" />
                    ผูกกับ ใบรายงานผสมปุ๋ยผง
                  </Button>
                  <Button type="button" variant="outline" disabled>ล้างการผูก</Button>
                </div>
              </div>
            </div>
          </DocumentSection>

          <DocumentSection
            title={
              <span className="flex flex-wrap items-center gap-2">
                รายละเอียดผลผลิต (ดูอย่างเดียว)
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  <LockKeyhole className="size-3" aria-hidden="true" />
                  รอข้อมูลต้นทาง
                </span>
              </span>
            }
            subtitle="ข้อมูลจริงมาจากใบรายงานผสมปุ๋ยผงเมื่อเชื่อมระบบ"
          >
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <Table className="min-w-[1000px] border-collapse">
                <TableHeader className="bg-gray-100 text-gray-700">
                  <TableRow className="hover:bg-gray-100">
                    <TableHead rowSpan={3} className="w-44 border-r text-center">วันที่ผลิต</TableHead>
                    <TableHead colSpan={6} className="border-r text-center">เครื่องจักร</TableHead>
                    <TableHead rowSpan={3} className="border-r text-center">กะที่ผลิต</TableHead>
                    <TableHead rowSpan={3} className="border-r text-center">ลงชื่อ/ผลิต</TableHead>
                    <TableHead rowSpan={3} className="w-16 text-center">ลบ</TableHead>
                  </TableRow>
                  <TableRow className="hover:bg-gray-100">
                    {["LINE - T1", "LINE - T2", "LINE - T4"].map((line) => (
                      <TableHead key={line} colSpan={2} className="border-r text-center">{line}</TableHead>
                    ))}
                  </TableRow>
                  <TableRow className="hover:bg-gray-100">
                    {["จำนวน/ตัน", "Lot.ที่ผลิต", "จำนวน/ตัน", "Lot.ที่ผลิต", "จำนวน/ตัน", "Lot.ที่ผลิต"].map(
                      (title, index) => (
                        <TableHead key={`${title}-${index}`} className="border-r text-center">
                          {title}
                        </TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id}>
                      {(
                        [
                          ["date", "date", "วันที่ผลิต"],
                          ["lineT1Qty", "number", "จำนวน LINE T1"],
                          ["lineT1Lot", "text", "Lot LINE T1"],
                          ["lineT2Qty", "number", "จำนวน LINE T2"],
                          ["lineT2Lot", "text", "Lot LINE T2"],
                          ["lineT4Qty", "number", "จำนวน LINE T4"],
                          ["lineT4Lot", "text", "Lot LINE T4"],
                          ["shift", "text", "กะที่ผลิต"],
                          ["producer", "text", "ลงชื่อผู้ผลิต"],
                        ] as const
                      ).map(([key, type, label]) => (
                        <TableCell key={key} className="border-r p-2">
                          <Input
                            aria-label={`${label} แถว ${index + 1}`}
                            type={type}
                            min={type === "number" ? "0" : undefined}
                            step={type === "number" ? "0.001" : undefined}
                            value={row[key]}
                            onChange={(event) => editRow(row.id, { [key]: event.target.value })}
                            placeholder={type === "number" ? "0" : undefined}
                            className="min-w-28"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={rows.length === 1}
                          onClick={() => removeRow(row.id)}
                          aria-label={`ลบแถวผลิต ${index + 1}`}
                        >
                          <Trash2 className="size-4 text-danger" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              type="button"
              className="mt-3 bg-[#84CAED] text-white hover:bg-[#90DBD8]"
              onClick={() => setRows((current) => [...current, newLine()])}
            >
              <Plus className="size-4" aria-hidden="true" />
              เพิ่มแถวผลิต
            </Button>
            <div className="mt-5 space-y-2">
              <Label htmlFor="production-order-note">หมายเหตุ — แก้ไขได้</Label>
              <Textarea
                id="production-order-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="พิมพ์ข้อความที่นี่..."
                className="min-h-28 resize-y"
              />
            </div>
          </DocumentSection>

          <DocumentSection title="รายชื่อผู้ลงนาม">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {signerFields.map((field) => (
                <div key={field.key} className="space-y-3 rounded-xl border p-4">
                  <Label htmlFor={`signer-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`signer-${field.key}`}
                    value={signers[field.key]}
                    onChange={(event) =>
                      setSigners((current) => ({ ...current, [field.key]: event.target.value }))
                    }
                    placeholder="ชื่อ-สกุล"
                  />
                </div>
              ))}
            </div>
          </DocumentSection>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              หน้านี้เป็นโครง UI เท่านั้น ยังไม่สร้างเลขเอกสารหรือบันทึกข้อมูลจริง
            </p>
            <Button type="button" disabled className="h-10 px-6">
              บันทึก
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <DocumentSection
            title="ข้อมูลที่บันทึก"
            subtitle="ยังไม่มีข้อมูลจาก PostgreSQL"
          >
            <div className="mb-4 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-12">
              <div className="space-y-2 xl:col-span-4">
                <Label htmlFor="history-search">ค้นหา (เอกสาร/โรงงาน/สูตรปุ๋ย)</Label>
                <Input
                  id="history-search"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="พิมพ์คำค้น..."
                />
              </div>
              <div className="space-y-2 xl:col-span-3">
                <Label htmlFor="history-from">วันที่เริ่มค้นหา</Label>
                <Input id="history-from" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-3">
                <Label htmlFor="history-to">วันที่สิ้นสุด</Label>
                <Input id="history-to" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label>แสดงต่อหน้า</Label>
                <Select value={pageSize} onValueChange={setPageSize}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["5", "10", "20", "50", "100"].map((size) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table className="min-w-[1780px]">
                <TableHeader className="bg-[#84CAED] text-white">
                  <TableRow className="hover:bg-[#84CAED]">
                    {historyColumns.map((column, index) => (
                      <TableHead
                        key={column}
                        className={`${index === 0 || index >= 5 ? "text-center" : ""} text-white`}
                      >
                        {index === 0 ? (
                          <span className="flex items-center gap-3">
                            <Checkbox disabled aria-label="เลือกทั้งหมด" />
                            {column}
                          </span>
                        ) : column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={historyColumns.length} className="h-28 text-center text-muted-foreground">
                      ไม่พบข้อมูลตามเงื่อนไข · รอเชื่อม PostgreSQL
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <span>แสดง 0 จากทั้งหมด 0 รายการ (หน้า 1/1)</span>
              <span>การดู แก้ไข พิมพ์ ส่งออก Excel และลบ จะแสดงเมื่อมีข้อมูลจริง</span>
            </div>
          </DocumentSection>
        </TabsContent>
      </Tabs>

      <Dialog open={docNumberOpen} onOpenChange={setDocNumberOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-5xl">
          <DialogHeader className="bg-[#84CAED] px-5 py-4 text-left text-white">
            <DialogTitle>สร้างหมายเลข PRD</DialogTitle>
            <DialogDescription className="text-white/90">
              เลข PRD จะถูกจองจริงหลังเชื่อมระบบและกด “ใช้เลขนี้”
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5">
            <div className="space-y-2">
              <Label>เลขที่ใบสั่งผลิต</Label>
              <div className="rounded-xl border bg-gray-50 px-4 py-4 text-lg font-bold text-[#1e3868]">
                {docNumberPreview}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-7">
              {[
                ["สัญลักษณ์ที่ 1", "P"],
                ["สัญลักษณ์ที่ 2", "R"],
                ["สัญลักษณ์ที่ 3", "D"],
                ["สัญลักษณ์ที่ 4", "-"],
                ["ปี", selectedDate ? String(selectedDate.getFullYear()).slice(-2) : "-"],
                ["เดือน", selectedDate ? String(selectedDate.getMonth() + 1).padStart(2, "0") : "-"],
                ["ลำดับหมายเลข", "รอสร้าง"],
              ].map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <Label>{label}</Label>
                  <Input value={value} readOnly className="bg-gray-50" />
                </div>
              ))}
            </div>
            <p className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-[#1e3868]">
              UI นี้ยังไม่จองเลขลงฐานข้อมูล
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button variant="outline">ปิด</Button>
            </DialogClose>
            <Button disabled className="bg-[#84CAED] text-white">
              ใช้เลขนี้ · รอเชื่อมระบบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="bg-[#84CAED] px-5 py-4 text-left text-white">
            <DialogTitle>เลือกสูตรจาก BOM</DialogTitle>
            <DialogDescription className="text-white/90">
              เลือกสินค้าหลักเพื่อใช้สูตรค่าเริ่มต้น หรือเลือกเวอร์ชันอื่น
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5">
            <Input
              value={formulaSearch}
              onChange={(event) => setFormulaSearch(event.target.value)}
              placeholder="ค้นหาด้วยรหัสสินค้า ชื่อสินค้า หรือประเภทการใช้งาน"
            />
            <div className="overflow-hidden rounded-lg border">
              <Table className="min-w-[760px]">
                <TableHeader className="bg-gray-100">
                  <TableRow className="hover:bg-gray-100">
                    {["รหัสสินค้า", "สินค้าหลัก", "ประเภทการใช้งาน", "สูตรค่าเริ่มต้น", "การทำงาน"].map(
                      (title) => <TableHead key={title}>{title}</TableHead>,
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} className="h-28 text-center text-gray-500">
                      ยังไม่เชื่อมข้อมูลสูตรจาก BOM
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button variant="outline">ปิด</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={referenceOpen} onOpenChange={setReferenceOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <DialogTitle className="text-xl text-[#84CAED]">
              เลือก ใบรายงานผสมปุ๋ยผง
            </DialogTitle>
            <DialogDescription>
              ใบสั่งผลิต - · เลือกแล้ว 0 เอกสาร
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5">
            <div className="grid gap-3 md:grid-cols-[1fr_14rem]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={referenceSearch}
                  onChange={(event) => setReferenceSearch(event.target.value)}
                  placeholder="ค้นหาวันที่ / สถานที่ / สูตรปุ๋ย / Lot / กะ / รถตัก"
                  className="h-11 pl-10"
                />
              </div>
              <Input type="date" aria-label="กรองตามวันที่" className="h-11" />
            </div>
            <p className="text-sm text-gray-500">พบ 0 รายการ</p>
            <div className="rounded-xl border bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              ยังไม่พบเอกสาร ใบรายงานผสมปุ๋ยผง สำหรับเลือกอ้างอิง
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-4 sm:justify-between">
            <span className="text-sm text-gray-600">เลือกแล้ว 0 เอกสาร</span>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button variant="outline">ยกเลิก</Button>
              </DialogClose>
              <Button disabled className="bg-[#84CAED] text-white">
                ยืนยันเลือก (0)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="p-0 sm:max-w-4xl">
          <DialogHeader className="bg-[#84CAED] px-5 py-4 text-left text-white">
            <DialogTitle>ตรวจสอบรายการนำเข้า Excel</DialogTitle>
            <DialogDescription className="text-white/90">
              ตรวจสอบข้อมูลก่อนยืนยันนำเข้า
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-6 text-center">
            <FileSpreadsheet className="mx-auto size-9 text-gray-400" aria-hidden="true" />
            <p className="mt-3 font-medium text-[#1e3868]">ยังไม่ได้เลือกไฟล์ Excel</p>
            <p className="mt-1 text-sm text-gray-500">
              การอ่านและนำเข้าไฟล์จะเปิดใช้เมื่อเชื่อมระบบข้อมูล
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <DialogClose asChild>
              <Button variant="outline">ปิด</Button>
            </DialogClose>
            <Button disabled className="bg-[#84CAED] text-white">
              ยืนยันนำเข้า
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
