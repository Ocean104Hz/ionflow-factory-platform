
"use client";

import { useMemo, useState } from "react";
import { Factory, FileText, History, Plus } from "lucide-react";
import { PageHeader, SectionCard } from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/src/components/ui/tabs";

type ProductionLine = {
  id: string;
  date: string;
  lineAQty: string;
  lineALot: string;
  lineBQty: string;
  lineBLot: string;
  s5Qty: string;
  s5Lot: string;
  shift: string;
  producer: string;
};

const newLine = (): ProductionLine => ({
  id: crypto.randomUUID(),
  date: "",
  lineAQty: "",
  lineALot: "",
  lineBQty: "",
  lineBLot: "",
  s5Qty: "",
  s5Lot: "",
  shift: "",
  producer: "",
});

function quantity(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function ProductProductionOrdersV1Workspace() {
  const [tab, setTab] = useState("form");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [formula, setFormula] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<ProductionLine[]>([newLine()]);

  const produced = useMemo(
    () => rows.reduce((sum, row) =>
      sum +
      quantity(row.lineAQty) +
      quantity(row.lineBQty) +
      quantity(row.s5Qty), 0),
    [rows],
  );

  const remaining = Math.max(0, quantity(amount) - produced);

  function editRow(id: string, patch: Partial<ProductionLine>) {
    setRows(current =>
      current.map(row =>
        row.id === id ? { ...row, ...patch } : row
      )
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบสั่งผลิตสินค้า V1"
        description="แบบฟอร์มการผลิตอ้างอิงโครงสร้าง iTECH"
        actions={
          <span className="rounded-full border px-3 py-1 text-xs">
            PRD · iTECH
          </span>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="form">
            <FileText className="mr-2 size-4" />
            สร้างใบสั่งผลิต
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 size-4" />
            ประวัติใบสั่งผลิต
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-5">
          <SectionCard title="ใบสั่งงาน">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>วันที่เอกสาร</Label>
                <Input type="date" value={date}
                  onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>เลขที่เอกสาร</Label>
                <Input value="" readOnly placeholder="รอสร้างเลข PRD" />
              </div>
              <div className="space-y-2">
                <Label>สถานที่ผลิต</Label>
                <Input value={location}
                  onChange={e => setLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>สูตรผลิต / สินค้า</Label>
                <Input value={formula}
                  onChange={e => setFormula(e.target.value)}
                  placeholder="รอเชื่อมข้อมูล BOM" />
              </div>
              <div className="space-y-2">
                <Label>จำนวนที่สั่งผลิต (ตัน)</Label>
                <Input type="number" min="0" step="0.001"
                  value={amount}
                  onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>ผลิตแล้ว (ตัน)</Label>
                <Input readOnly value={produced.toFixed(3)} />
              </div>
              <div className="space-y-2">
                <Label>ยอดค้าง (ตัน)</Label>
                <Input readOnly value={remaining.toFixed(3)} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="รายละเอียดผลผลิต">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {[
                      "วันที่ผลิต", "Line A (ตัน)", "Lot A",
                      "Line B (ตัน)", "Lot B", "S5 (ตัน)",
                      "Lot S5", "กะ", "ผู้ผลิต",
                    ].map(title => (
                      <th key={title}
                        className="border p-3 text-left font-medium">
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      {([
                        ["date", "date"],
                        ["lineAQty", "number"],
                        ["lineALot", "text"],
                        ["lineBQty", "number"],
                        ["lineBLot", "text"],
                        ["s5Qty", "number"],
                        ["s5Lot", "text"],
                        ["shift", "text"],
                        ["producer", "text"],
                      ] as const).map(([key, type]) => (
                        <td key={key} className="border p-2">
                          <Input
                            type={type}
                            min={type === "number" ? "0" : undefined}
                            step={type === "number" ? "0.001" : undefined}
                            value={row[key]}
                            onChange={e => editRow(row.id, {
                              [key]: e.target.value,
                            })}
                            className="min-w-[105px]"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Button variant="outline"
                onClick={() => setRows(current => [
                  ...current, newLine(),
                ])}>
                <Plus className="mr-2 size-4" />
                เพิ่มแถวผลิต
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="หมายเหตุ">
            <textarea
              className="min-h-24 w-full rounded-lg border bg-background p-3 text-sm"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ระบุหมายเหตุ"
            />
          </SectionCard>

          <div className="flex justify-end">
            <Button disabled>
              <Factory className="mr-2 size-4" />
              บันทึก (รอเชื่อม PostgreSQL)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <SectionCard title="ประวัติใบสั่งผลิต V1">
            <p className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีข้อมูลจาก PostgreSQL
            </p>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
