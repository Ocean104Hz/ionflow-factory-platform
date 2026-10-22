
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useSettingsPostgres } from "@/src/components/factory/use-settings-postgres";

type Item = {
  id: string;
  code: string;
  name: string;
  size: string;
  quantity: string;
  unit: string;
  date: string;
  lot: string;
};

type ProductTable = {
  id: string;
  title: string;
  items: Item[];
};

const today = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

function newItem(date: string): Item {
  return {
    id: crypto.randomUUID(),
    code: "",
    name: "",
    size: "",
    quantity: "",
    unit: "",
    date,
    lot: "",
  };
}

function total(items: Item[]) {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    return sum + (
      Number.isFinite(quantity) && quantity > 0
        ? quantity
        : 0
    );
  }, 0);
}

export function IconReceiptForm() {
  const [date, setDate] = useState(today);
  const [siteId, setSiteId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [warehouseOfficer, setWarehouseOfficer] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [verifier, setVerifier] = useState("");

  const [tables, setTables] = useState<ProductTable[]>([
    {
      id: "initial-table",
      title: "อินทรีย์เคมี",
      items: [
        {
          id: "initial-row",
          code: "",
          name: "",
          size: "",
          quantity: "",
          unit: "",
          date: today,
          lot: "",
        },
      ],
    },
  ]);

  const {
    state: settings,
    loading,
    loadError,
    retry,
  } = useSettingsPostgres();

  const sites = settings.rows.filter(
    (row) => row.kind === "sites" && row.active,
  );

  const units = settings.rows.filter(
    (row) => row.kind === "units" && row.active,
  );

  function updateTable(id: string, title: string) {
    setTables((current) =>
      current.map((table) =>
        table.id === id ? { ...table, title } : table,
      ),
    );
  }

  function addTable() {
    setTables((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: "เคมี",
        items: [newItem(date)],
      },
    ]);
  }

  function removeTable(id: string) {
    setTables((current) =>
      current.length > 1
        ? current.filter((table) => table.id !== id)
        : current,
    );
  }

  function addRow(tableId: string) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? {
              ...table,
              items: [...table.items, newItem(date)],
            }
          : table,
      ),
    );
  }

  function updateRow(
    tableId: string,
    rowId: string,
    patch: Partial<Item>,
  ) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? {
              ...table,
              items: table.items.map((item) =>
                item.id === rowId
                  ? { ...item, ...patch }
                  : item,
              ),
            }
          : table,
      ),
    );
  }

  function removeRow(tableId: string, rowId: string) {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? {
              ...table,
              items:
                table.items.length > 1
                  ? table.items.filter((item) => item.id !== rowId)
                  : table.items,
            }
          : table,
      ),
    );
  }

  const grandTotal = tables.reduce(
    (sum, table) => sum + total(table.items),
    0,
  );

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";

  return (
    <div className="space-y-5">
      {/* ส่วนหัวเอกสาร */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">ส่วนหัวเอกสาร</h2>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="icon-receipt-date">วันที่</Label>
            <Input
              id="icon-receipt-date"
              type="date"
              value={date}
              onChange={(event) => {
                const nextDate = event.target.value;
                setDate(nextDate);
                setTables((current) =>
                  current.map((table) => ({
                    ...table,
                    items: table.items.map((item) => ({
                      ...item,
                      date: nextDate,
                    })),
                  })),
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon-receipt-site">สถานที่</Label>
            <select
              id="icon-receipt-site"
              className={selectClass}
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              disabled={loading || !!loadError}
            >
              <option value="">เลือกสถานที่</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="icon-receipt-number">
              เลขที่เอกสาร ADD
            </Label>
            <Input
              id="icon-receipt-number"
              value={documentNumber}
              onChange={(event) =>
                setDocumentNumber(event.target.value)
              }
              placeholder="เช่น PR-0001"
            />
          </div>
        </div>
      </section>

      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          กำลังโหลดสถานที่และหน่วยนับ...
        </p>
      )}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">
            โหลดข้อมูลตั้งค่าไม่สำเร็จ: {loadError}
          </span>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            ลองใหม่
          </Button>
        </div>
      )}

      {!loading && !loadError && (sites.length === 0 || units.length === 0) && (
        <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">
          ยังไม่มีสถานที่หรือหน่วยนับที่เปิดใช้งานครบใน Settings
        </p>
      )}

      {/* ตารางรายการปุ๋ย */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">ตารางรายการปุ๋ย</h2>
        </div>

        <div className="space-y-3 p-3">
          {tables.map((table) => (
            <div
              key={table.id}
              className="overflow-hidden rounded-xl border border-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="ชื่อประเภทปุ๋ย"
                    value={table.title}
                    onChange={(event) =>
                      updateTable(table.id, event.target.value)
                    }
                    className="w-40 font-medium"
                  />
                  <span className="text-xs text-muted-foreground">
                    (ประเภทของปุ๋ย)
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled
                    title="รอเชื่อมใบสั่งผลิต V2"
                  >
                    เลือกข้อมูลจากใบสั่งผลิต
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tables.length === 1}
                    onClick={() => removeTable(table.id)}
                    className="text-destructive"
                  >
                    ลบตาราง
                  </Button>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1150px] border-collapse text-sm">
                  <thead className="bg-muted/40">
                    <tr className="border-b">
                      <th rowSpan={2} className="w-12 p-3 text-center">
                        No.
                      </th>
                      <th colSpan={3} className="p-3 text-center">
                        รายละเอียด
                      </th>
                      <th rowSpan={2} className="p-3">จำนวน</th>
                      <th rowSpan={2} className="p-3">หน่วยนับ</th>
                      <th rowSpan={2} className="p-3">วันที่</th>
                      <th rowSpan={2} className="p-3">Lot</th>
                      <th rowSpan={2} className="w-14 p-3">จัดการ</th>
                    </tr>
                    <tr className="border-b">
                      <th className="p-3 text-left">รหัสสินค้า</th>
                      <th className="p-3 text-left">
                        รายการ / ข้อมูลจำเพาะ
                      </th>
                      <th className="p-3 text-left">ขนาด</th>
                    </tr>
                  </thead>

                  <tbody>
                    {table.items.map((item, index) => (
                      <tr
                        key={item.id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="p-2 text-center">
                          {index + 1}
                        </td>

                        <td className="min-w-36 p-2">
                          <Input
                            aria-label={`รหัสสินค้า ${index + 1}`}
                            value={item.code}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                code: event.target.value,
                              })
                            }
                            placeholder="รหัสสินค้า"
                          />
                        </td>

                        <td className="min-w-56 p-2">
                          <Input
                            aria-label={`รายการ ${index + 1}`}
                            value={item.name}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                name: event.target.value,
                              })
                            }
                            placeholder="รายการ / ข้อมูลจำเพาะ"
                          />
                        </td>

                        <td className="min-w-28 p-2">
                          <Input
                            aria-label={`ขนาด ${index + 1}`}
                            value={item.size}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                size: event.target.value,
                              })
                            }
                            placeholder="กก."
                          />
                        </td>

                        <td className="min-w-28 p-2">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`จำนวน ${index + 1}`}
                            value={item.quantity}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                quantity: event.target.value,
                              })
                            }
                            placeholder="เช่น 10"
                          />
                        </td>

                        <td className="min-w-36 p-2">
                          <select
                            aria-label={`หน่วยนับ ${index + 1}`}
                            className={selectClass}
                            value={item.unit}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                unit: event.target.value,
                              })
                            }
                            disabled={loading || !!loadError}
                          >
                            <option value="">เลือกหน่วยนับ</option>
                            {units.map((unit) => (
                              <option key={unit.id} value={unit.name}>
                                {unit.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="min-w-40 p-2">
                          <Input
                            type="date"
                            aria-label={`วันที่รายการ ${index + 1}`}
                            value={item.date}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                date: event.target.value,
                              })
                            }
                          />
                        </td>

                        <td className="min-w-32 p-2">
                          <Input
                            aria-label={`Lot ${index + 1}`}
                            value={item.lot}
                            onChange={(event) =>
                              updateRow(table.id, item.id, {
                                lot: event.target.value,
                              })
                            }
                            placeholder="Lot / BOM"
                          />
                        </td>

                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            aria-label={`ลบรายการ ${index + 1}`}
                            disabled={table.items.length === 1}
                            onClick={() => removeRow(table.id, item.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => addRow(table.id)}
                >
                  <Plus className="size-4" />
                  เพิ่มแถว
                </Button>

                <p className="text-sm font-medium tabular-nums">
                  รวมยอดเข้าทั้งตาราง:{" "}
                  {total(table.items).toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTable}
            >
              <Plus className="size-4" />
              เพิ่มตาราง
            </Button>

            <p className="text-sm font-semibold tabular-nums">
              รวมยอดเข้าทั้งหมด:{" "}
              {grandTotal.toLocaleString("th-TH", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            ยอดรวมนี้เป็นผลบวกจำนวนที่กรอกใน UI เท่านั้น
            ยังไม่ใช่ยอดสต็อกและไม่แปลงหน่วยนับ
          </p>
        </div>
      </section>

      {/* ลงชื่อ */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">ลงชื่อ</h2>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          {[
            {
              id: "warehouse-officer",
              label: "เจ้าหน้าที่คลัง (ผู้จ่าย)",
              value: warehouseOfficer,
              onChange: setWarehouseOfficer,
            },
            {
              id: "production-supervisor",
              label: "หัวหน้าฝ่ายผลิต",
              value: supervisor,
              onChange: setSupervisor,
            },
            {
              id: "warehouse-verifier",
              label: "ผู้ตรวจสอบคลัง",
              value: verifier,
              onChange: setVerifier,
            },
          ].map((field) => (
            <div
              key={field.id}
              className="space-y-2 rounded-xl border border-border p-3"
            >
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                value={field.value}
                onChange={(event) =>
                  field.onChange(event.target.value)
                }
                placeholder="ชื่อ-สกุล"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ไม่มีการบันทึกจริงในระยะ UI */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          โครงฟอร์ม iCON สำหรับตรวจ UI ยังไม่บันทึกเอกสารหรือ Stock Ledger
        </p>

        <Button type="button" disabled>
          บันทึก (รอเชื่อมระบบเอกสาร)
        </Button>
      </div>
    </div>
  );
}
