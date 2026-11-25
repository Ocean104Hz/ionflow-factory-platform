"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useId, useState, type HTMLInputTypeAttribute } from "react";
import { AlertCircle, ClipboardList, FileText } from "lucide-react";
import { DocumentViewActions, PageHeader, FactoryDataTable, SectionCard, SelectField } from "@/src/components/factory/patterns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useSettingsPostgres } from "@/src/components/factory/use-settings-postgres";
import { Textarea } from "@/src/components/ui/textarea";
import {
  newReceiptDocumentV1,
  newReceiptItemV1,
  type ReceiptDocumentV1,
  type ReceiptItemV1,
  type ReceiptGroupV1,
} from "./production-receipt-v1-types";
import { ProductionReceiptV1Table } from "./production-receipt-v1-table";
import { productionRequest, useProductionV1Data } from "../production-flow/production-v1-client";

type SavedReceipt = ReceiptDocumentV1 & { id: string; orderId: string; createdAt: string };

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  readOnly?: boolean;
}) {
  const id = useId();

  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        className={readOnly ? "bg-muted/40" : "bg-background"}
      />
    </div>
  );
}

export function ProductionReceiptV1Workspace() {
  const [tab, setTab] = useState<"form" | "history">("history");
  const [doc, setDoc] = useState<ReceiptDocumentV1>(newReceiptDocumentV1);
  const [orderId, setOrderId] = useState("none");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<SavedReceipt | null>(null);
  const { data, loading, error, refresh } = useProductionV1Data<{
    documents: SavedReceipt[];
    orders: { id: string; documentNumber: string; location: string }[];
  }>("receipt");

  function updateDocument(patch: Partial<ReceiptDocumentV1>) {
    setDoc((current) => ({ ...current, ...patch }));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const result = await productionRequest<SavedReceipt>("receipt", { action: "save", row: { ...doc, orderId } });
      setNotice(`บันทึก ${result.documentNumber} แล้ว`);
      setDoc(newReceiptDocumentV1());
      setOrderId("none");
      setTab("history");
      refresh();
    } catch (issue) { setSaveError(issue instanceof Error ? issue.message : "บันทึกใบรับยอดผลิตไม่สำเร็จ"); }
    finally { setSaving(false); }
  }

  const {
    state: settings,
    loading: unitsLoading,
    loadError: unitsError,
    retry: retryUnits,
  } = useSettingsPostgres();

  const unitOptions = settings.rows
    .filter((row) => row.kind === "units" && row.active)
    .map((row) => ({
      value: row.name,
      label: `${row.code} · ${row.name}`,
    }));

  const groupKeys = {
    P1: "p1Items",
    P2: "p2Items",
    MOLDING: "moldingItems",
  } as const;

  function updateItem(
    group: ReceiptGroupV1,
    id: string,
    patch: Partial<ReceiptItemV1>,
  ) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]: current[key].map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function addItem(group: ReceiptGroupV1) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]: [...current[key], newReceiptItemV1()],
    }));
  }

  function removeItem(group: ReceiptGroupV1, id: string) {
    const key = groupKeys[group];

    setDoc((current) => ({
      ...current,
      [key]:
        current[key].length > 1
          ? current[key].filter((item) => item.id !== id)
          : current[key],
    }));
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-10">
      <PageHeader title="ใบรับยอดผลิต V1" description="Production Receipt · รูปแบบเอกสาร iTECH" actions={<DocumentViewActions showingForm={tab === "form"} createLabel="สร้างใบรับยอดผลิต" disabled={loading || saving} onCreate={() => setTab("form")} onHistory={() => setTab("history")} />} />
      {notice && <p role="status">{notice}</p>}
      {saveError && <p role="alert" className="text-danger">{saveError}</p>}
      {error && <div><p role="alert">{error}</p><Button onClick={refresh}>ลองใหม่</Button></div>}

      <div className="space-y-5">


        {tab === "form" && (<div className="space-y-5">
          <SectionCard title="ใบรับยอดผลิต">
            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="สถานที่"
                value={doc.location}
                onChange={(location) => updateDocument({ location })}
                placeholder="เลือกสถานที่ผลิต"
              />
              <Field
                label="วันที่เอกสาร"
                type="date"
                value={doc.documentDate}
                onChange={(documentDate) => updateDocument({ documentDate })}
              />
              <Field
                label="เอกสารเลขที่"
                value={doc.documentNumber}
                readOnly
                placeholder="ระบบออกเลขเมื่อบันทึก"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="เอกสารอ้างอิง"
            subtitle="เลือกจากใบสั่งผลิต V1 ที่บันทึกแล้ว"
          >
            <SelectField
              label="ใบสั่งผลิตที่อ้างอิง"
              value={orderId}
              options={[{ value: "none", label: loading ? "กำลังโหลด…" : "เลือกใบสั่งผลิต" }, ...(data?.orders ?? []).map((row) => ({
                value: row.id, label: `${row.documentNumber} · ${row.location}`,
              }))]}
              onChange={(id) => {
                setOrderId(id);
                const row = data?.orders.find((order) => order.id === id);
                updateDocument({ productionOrderNumber: row?.documentNumber ?? "", ...(row && { location: row.location }) });
              }}
            />
          </SectionCard>

          {unitsLoading && (
            <div
              role="status"
              className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
            >
              กำลังโหลดหน่วยนับจากตั้งค่าระบบ...
            </div>
          )}

          {unitsError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3"
            >
              <p className="text-sm text-destructive">
                โหลดหน่วยนับไม่สำเร็จ: {unitsError}
              </p>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryUnits}
              >
                ลองใหม่
              </Button>
            </div>
          )}

          {!unitsLoading && !unitsError && unitOptions.length === 0 && (
            <p
              role="status"
              className="rounded-lg border p-3 text-sm text-muted-foreground"
            >
              ยังไม่มีหน่วยนับที่เปิดใช้งาน กรุณาเพิ่มข้อมูลในตั้งค่าระบบ
            </p>
          )}

          <ProductionReceiptV1Table
            title="กระสอบปุ๋ยอินทรีย์ / สารปรับสภาพดิน (P1)"
            items={doc.p1Items}
            unitOptions={unitOptions}
            onAdd={() => addItem("P1")}
            onRemove={(id) => removeItem("P1", id)}
            onUpdate={(id, patch) => updateItem("P1", id, patch)}
          />

          <ProductionReceiptV1Table
            title="กระสอบปุ๋ยอินทรีย์ / สารปรับสภาพดิน (P2)"
            items={doc.p2Items}
            unitOptions={unitOptions}
            onAdd={() => addItem("P2")}
            onRemove={(id) => removeItem("P2", id)}
            onUpdate={(id, patch) => updateItem("P2", id, patch)}
          />

          <ProductionReceiptV1Table
            title="ยอดผลิตปั้น"
            items={doc.moldingItems}
            unitOptions={unitOptions}
            onAdd={() => addItem("MOLDING")}
            onRemove={(id) => removeItem("MOLDING", id)}
            onUpdate={(id, patch) => updateItem("MOLDING", id, patch)}
          />

          <SectionCard title="สรุปรายการรับยอดผลิต">
            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  {
                    label: "P1 รวม",
                    items: doc.p1Items,
                  },
                  {
                    label: "P2 รวม",
                    items: doc.p2Items,
                  },
                  {
                    label: "ยอดผลิตปั้น รวม",
                    items: doc.moldingItems,
                  },
                ] as const
              ).map(({ label, items }) => {
                const total = items.reduce((sum, item) => {
                  const qty = Number(item.quantity);

                  return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
                }, 0);

                return (
                  <div
                    key={label}
                    className="rounded-xl border border-border bg-muted/20 p-5"
                  >
                    <p className="text-sm text-muted-foreground">{label}</p>

                    <p className="mt-3 text-2xl font-semibold tabular-nums">
                      {total.toLocaleString("th-TH")}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      รวมจำนวนตามรายการที่กรอก
                    </p>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="รายชื่อผู้ลงนาม">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="เจ้าหน้าที่คลังสินค้า / จ่ายสินค้า"
                value={doc.warehouseOfficer}
                onChange={(warehouseOfficer) =>
                  updateDocument({ warehouseOfficer })
                }
                placeholder="ชื่อผู้รับผิดชอบ"
              />
              <Field
                label="ผู้ตรวจสอบ (เจ้าหน้าที่คลังสินค้า)"
                value={doc.inspector}
                onChange={(inspector) => updateDocument({ inspector })}
                placeholder="ชื่อผู้ตรวจสอบ"
              />
            </div>
          </SectionCard>

          <SectionCard title="หมายเหตุ">
            <Label htmlFor="production-receipt-v1-note" className="sr-only">
              หมายเหตุ
            </Label>
            <Textarea
              id="production-receipt-v1-note"
              value={doc.note}
              onChange={(event) => updateDocument({ note: event.target.value })}
              placeholder="รายละเอียดเพิ่มเติม..."
              className="min-h-28"
            />
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle aria-hidden="true" className="size-4" />
              บันทึกเอกสารรับยอดผลิต โดยยังไม่ลงสต็อก
            </p>
            <Button type="button" disabled={saving || loading || unitsLoading || Boolean(unitsError)} onClick={() => void save()}>
              <FileText aria-hidden="true" className="size-4" />
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </div>
        </div>)}

        {tab === "history" && (<div>
          <SectionCard title="ประวัติใบรับยอดผลิต V1">
            <FactoryDataTable variant="history" rows={data?.documents ?? []} rowKey={(row) => row.id} state={loading ? "loading" : "normal"} minWidth={720}
              columns={[
                { key: "number", label: "เลขที่เอกสาร", render: (row) => row.documentNumber },
                { key: "date", label: "วันที่", render: (row) => row.documentDate },
                { key: "location", label: "สถานที่", render: (row) => row.location },
                { key: "order", label: "ใบสั่งผลิต", render: (row) => row.productionOrderNumber },
                { key: "action", label: "จัดการ", render: (row) => <RowActionMenu readOnly><RowActionItem onClick={() => setView(row)}>ดูรายละเอียด</RowActionItem></RowActionMenu> },
              ]}
            />
          </SectionCard>
        </div>)}
      </div>
      <Dialog open={view !== null} onOpenChange={(open) => { if (!open) setView(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{view?.documentNumber}</DialogTitle>
            <DialogDescription>อ้างอิง {view?.productionOrderNumber} · {view?.location} · {view?.documentDate}</DialogDescription>
          </DialogHeader>
          {view && <>
            {([["P1", view.p1Items], ["P2", view.p2Items], ["ปั้นเม็ด", view.moldingItems]] as const).map(([label, rows]) => (
              <section key={label}><h3 className="mb-2 font-semibold">{label}</h3>
                <FactoryDataTable rows={rows} rowKey={(row) => row.id} minWidth={640}
                  columns={[
                    { key: "name", label: "รายการ", render: (row) => row.name },
                    { key: "size", label: "ขนาด (กก.)", render: (row) => row.sizeKg || "—" },
                    { key: "quantity", label: "จำนวน / หน่วย", render: (row) => `${row.quantity} ${row.unit}` },
                    { key: "lot", label: "Lot", render: (row) => row.lot || "—" },
                    { key: "note", label: "หมายเหตุ", render: (row) => row.note || "—" },
                  ]} />
              </section>
            ))}
            <p>เจ้าหน้าที่คลัง {view.warehouseOfficer || "—"} · ผู้ตรวจสอบ {view.inspector || "—"}</p>
            {view.note && <p>หมายเหตุ {view.note}</p>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
