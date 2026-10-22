
"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Upload, PackageSearch, Link2 } from "lucide-react";
import {
  PageHeader,
  SectionCard,
} from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/src/components/ui/tabs";

type PackingItem = {
  id: string;
  productName: string;
  sizeKg: string;
  quantity: string;
  unit: string;
  remark: string;
};

function emptyItem(): PackingItem {
  return {
    id: crypto.randomUUID(),
    productName: "",
    sizeKg: "",
    quantity: "",
    unit: "",
    remark: "",
  };
}

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function PackingSummaryWorkspace() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [documentNo, setDocumentNo] = useState("IT-");
  const [items, setItems] = useState<PackingItem[]>([
    {
      id: "initial-item",
      productName: "",
      sizeKg: "",
      quantity: "",
      unit: "",
      remark: "",
    },
  ]);

  const [signers, setSigners] = useState({
    packer: "",
    supervisor: "",
    packingHead: "",
    approver: "",
  });

  const total = useMemo(
    () =>
      items.reduce((sum, item) => {
        const value = Number(item.quantity);
        return sum + (
          Number.isFinite(value) && value > 0 ? value : 0
        );
      }, 0),
    [items],
  );

  function updateItem(id: string, patch: Partial<PackingItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    );
  }

  function removeItem(id: string) {
    setItems((current) =>
      current.length > 1
        ? current.filter((item) => item.id !== id)
        : current,
    );
  }

  const signerFields = [
    {
      key: "packer" as const,
      label: "ผู้สั่งแพ็ค / ผู้จ่ายกระสอบ",
    },
    {
      key: "supervisor" as const,
      label: "เจ้าหน้าที่ QC.",
    },
    {
      key: "packingHead" as const,
      label: "หัวหน้าแพ็ก / ผู้เบิกกระสอบ",
    },
    {
      key: "approver" as const,
      label: "ผู้อนุมัติ",
    },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบแจ้งสั่งแพ็คสินค้า"
        description="Packing Summary · อ้างอิงโครงเอกสารจาก iTECH"
      />

      <Tabs defaultValue="form" className="space-y-5">
        <TabsList
          className="mx-auto grid h-11 w-full max-w-xl grid-cols-2 rounded-full p-1"
        >
          <TabsTrigger
            value="form"
            className="h-9 rounded-full px-4"
          >
            แบบฟอร์มใบแจ้งสั่งแพ็ค
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="h-9 rounded-full px-4"
          >
            ประวัติใบแจ้งสั่งแพ็ค
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-5">
          <SectionCard
            title="ส่วนหัวเอกสาร"
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                title="รอเชื่อมระบบนำเข้า Excel"
              >
                <Upload className="size-4" />
                นำเข้า Excel
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pack-location">สถานที่</Label>
                <Input
                  id="pack-location"
                  value={location}
                  onChange={(e) =>
                    setLocation(e.target.value)
                  }
                  placeholder="เลือกหรือกรอกสถานที่"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack-date">วันที่</Label>
                <Input
                  id="pack-date"
                  type="date"
                  value={date}
                  onChange={(e) =>
                    setDate(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pack-number">
                  เลขที่เอกสาร IT
                </Label>
                <Input
                  id="pack-number"
                  value={documentNo}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/^IT-/i, "")
                      .replace(/\D/g, "");
                    setDocumentNo(`IT-${digits}`);
                  }}
                  placeholder="IT-456"
                />
              </div>

              <div className="space-y-2 md:col-span-3">
                <Label>
                  อ้างอิงเอกสาร ใบรายงานการบรรจุปุ๋ยอินทรีย์
                </Label>

                <div className="flex flex-wrap gap-2">
                  <Input
                    readOnly
                    value=""
                    placeholder="ยังไม่ได้เลือกเอกสารอ้างอิง"
                    className="min-w-44 flex-1"
                  />
                  <Button
                    type="button"
                    disabled
                    title="รอเชื่อมเอกสารรายงานการบรรจุ"
                  >
                    <Link2 className="size-4" />
                    ผูกกับใบรายงานการบรรจุ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled
                  >
                    ล้างการผูก
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="รายการสินค้า"
            contentClassName="space-y-4 px-0"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      emptyItem(),
                    ])
                  }
                >
                  <Plus className="size-4" />
                  เพิ่มรายการ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title="รอเชื่อมคลังวัตถุดิบ"
                >
                  <PackageSearch className="size-4" />
                  เลือกจากสต๊อกวัตถุดิบ
                </Button>
              </div>
            }
          >
            <div
              role="region"
              tabIndex={0}
              aria-label="ตารางรายการสินค้า"
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b">
                    {[
                      "ลำดับ",
                      "รายการสินค้า",
                      "ขนาด (kg)",
                      "จำนวน",
                      "หน่วยนับ",
                      "หมายเหตุ",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-3 py-3 text-left font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-3 py-2 text-center">
                        {index + 1}
                      </td>
                      <td className="min-w-64 p-2">
                        <Input
                          aria-label={`สินค้า ${index + 1}`}
                          value={item.productName}
                          onChange={(e) =>
                            updateItem(item.id, {
                              productName: e.target.value,
                            })
                          }
                          placeholder="รายการสินค้า"
                        />
                      </td>

                      <td className="min-w-28 p-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          aria-label={`ขนาด ${index + 1}`}
                          value={item.sizeKg}
                          onChange={(e) =>
                            updateItem(item.id, {
                              sizeKg: e.target.value,
                            })
                          }
                          placeholder="kg"
                        />
                      </td>

                      <td className="min-w-32 p-2">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          aria-label={`จำนวน ${index + 1}`}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, {
                              quantity: e.target.value,
                            })
                          }
                          placeholder="จำนวน"
                        />
                      </td>

                      <td className="min-w-36 p-2">
                        <input
                          className={inputClass}
                          aria-label={`หน่วยนับ ${index + 1}`}
                          value={item.unit}
                          onChange={(e) =>
                            updateItem(item.id, {
                              unit: e.target.value,
                            })
                          }
                          placeholder="เช่น ใบ"
                        />
                      </td>

                      <td className="min-w-48 p-2">
                        <Input
                          aria-label={`หมายเหตุ ${index + 1}`}
                          value={item.remark}
                          onChange={(e) =>
                            updateItem(item.id, {
                              remark: e.target.value,
                            })
                          }
                          placeholder="หมายเหตุ"
                        />
                      </td>

                      <td className="p-2 text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="text-destructive"
                          disabled={items.length === 1}
                          onClick={() =>
                            removeItem(item.id)
                          }
                          aria-label={`ลบรายการ ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end px-5 text-sm font-semibold">
              รวมจำนวน:{" "}
              <span className="ml-2 tabular-nums">
                {total.toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </SectionCard>

          <SectionCard title="รายชื่อผู้ลงนาม">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {signerFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`signer-${field.key}`}>
                    {field.label}
                  </Label>
                  <Input
                    id={`signer-${field.key}`}
                    value={signers[field.key]}
                    onChange={(e) =>
                      setSigners((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder="ชื่อ-สกุล"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              UI สำหรับตรวจรูปแบบ ยังไม่บันทึกลงฐานข้อมูล
            </p>
            <Button type="button" disabled>
              บันทึก (รอเชื่อมระบบ)
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <SectionCard
            title="ข้อมูลที่บันทึก"
            subtitle="ประวัติใบแจ้งสั่งแพ็คสินค้า"
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  placeholder="ค้นหาเอกสาร / สถานที่ / สินค้า"
                  disabled
                />
                <Input type="date" disabled />
                <Input type="date" disabled />
              </div>

              <div className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
                ยังไม่ได้เชื่อมข้อมูลประวัติจากฐานข้อมูล
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
