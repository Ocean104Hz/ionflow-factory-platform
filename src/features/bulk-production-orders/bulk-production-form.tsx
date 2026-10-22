"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { SectionCard } from "@/src/components/factory/patterns";
import { bulkProducts } from "@/src/lib/mock-data/bulk-production-orders";
import {
  bulkSummary,
  newBulkRow,
  removeBulkRow,
  selectBulkProduct,
  signerLabels,
  updateBulkRow,
  type BulkOrder,
  type BulkErrors,
  type BulkRow,
} from "./bulk-production-domain";

export function BulkProductionForm({
  doc,
  errors,
  onChange,
  onSave,
  onCancel,
}: {
  doc: BulkOrder;
  errors: BulkErrors;
  onChange: (doc: BulkOrder) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [productSearch, setProductSearch] = useState<Record<string, string>>(
    {},
  );
  const numeric = (raw: string) => (raw === "" ? null : Number(raw));
  const field = (
    key: string,
    label: string,
    value: string | number | null,
    change: (v: string) => void,
    type = "text",
    list?: string,
    multiline = false,
  ) => (
    <div key={key} className="grid min-w-0 content-start gap-2">
      <Label htmlFor={`bulk-${key}`}>{label}</Label>
      {multiline ? (
        <Textarea
          id={`bulk-${key}`}
          name={key}
          data-field={key}
          value={value ?? ""}
          onChange={(e) => change(e.target.value)}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `error-${key}` : undefined}
          className="min-h-20"
        />
      ) : (
        <Input
          id={`bulk-${key}`}
          name={key}
          data-field={key}
          type={type}
          step={type === "number" ? "any" : undefined}
          list={list}
          value={value ?? ""}
          onChange={(e) => change(e.target.value)}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `error-${key}` : undefined}
        />
      )}
      {errors[key] && (
        <p id={`error-${key}`} className="text-xs text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );
  const summary = bulkSummary(doc);
  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {!!Object.keys(errors).length && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <p className="font-medium">กรุณาตรวจสอบข้อมูลก่อนบันทึก</p>
          <ul className="mt-2 list-inside list-disc">
            {[...new Set(Object.values(errors))].map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}
      <SectionCard
        title="ส่วนหัวเอกสาร"
        subtitle="เลขเอกสารกรอกเอง · ช่องที่มี * จำเป็นต้องกรอก"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {field(
            "header.date",
            "วันที่เอกสาร *",
            doc.header.date,
            (date) => onChange({ ...doc, header: { ...doc.header, date } }),
            "date",
          )}
          {field("header.docNo", "เลขที่เอกสาร *", doc.header.docNo, (docNo) =>
            onChange({ ...doc, header: { ...doc.header, docNo } }),
          )}
          {field(
            "header.planTons",
            "ผลิตปุ๋ยเบล้าท์ (ตัน)",
            doc.header.planTons,
            (v) =>
              onChange({
                ...doc,
                header: { ...doc.header, planTons: numeric(v) },
              }),
            "number",
          )}
          {field(
            "header.targetBags",
            "รวมเป็นจำนวนกระสอบ",
            doc.header.targetBags,
            (v) =>
              onChange({
                ...doc,
                header: { ...doc.header, targetBags: numeric(v) },
              }),
            "number",
          )}
          {field(
            "header.productionDays",
            "ระยะเวลาในการผลิต (วัน)",
            doc.header.productionDays,
            (productionDays) =>
              onChange({ ...doc, header: { ...doc.header, productionDays } }),
            "number",
          )}
          {field(
            "header.payDate",
            "จ่ายวันที่",
            doc.header.payDate,
            (payDate) =>
              onChange({ ...doc, header: { ...doc.header, payDate } }),
            "date",
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          แผนตันและเป้าหมายกระสอบเป็นคนละค่า ไม่แปลงหน่วยอัตโนมัติ ·
          ผลผลิตจริงบันทึกรายรายการ
        </p>
      </SectionCard>
      <SectionCard
        title="รายการสั่งผลิต"
        subtitle="เพิ่มรายการได้หลายแถว · ผลผลิตจริงบันทึกในหน้ารายงานการผลิต"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...doc,
                rows: [...doc.rows, newBulkRow(crypto.randomUUID())],
              })
            }
          >
            <Plus />
            เพิ่มรายการผลิต
          </Button>
        }
      >
        <div className="space-y-5">
          {doc.rows.map((row, index) => {
            const update = (patch: Partial<Omit<BulkRow, "id">>) =>
              onChange(updateBulkRow(doc, row.id, patch));
            const f = (
              key: keyof Omit<BulkRow, "id">,
              label: string,
              type = "text",
              list?: string,
            ) =>
              field(
                `rows.${row.id}.${key}`,
                `${label} · รายการ ${index + 1}`,
                row[key],
                (v) => {
                  if (key === "qty")
                    update({
                      qty: numeric(v),
                      qtyUnit: "กระสอบ",
                      countUnit: "กระสอบ",
                    });
                  else if (key === "productCode" || key === "product") {
                    const product = bulkProducts.find((p) =>
                      key === "productCode" ? p.code === v : p.name === v,
                    );
                    if (product)
                      onChange(selectBulkProduct(doc, row.id, product));
                    else update({ [key]: v });
                  } else update({ [key]: type === "number" ? numeric(v) : v });
                },
                type,
                list,
              );
            return (
              <section
                key={row.id}
                data-bulk-row={row.id}
                className="min-w-0 rounded-xl border bg-muted/15 p-4 sm:p-5"
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-semibold">รายการผลิต {index + 1}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`ลบรายการ ${index + 1}`}
                    onClick={() => onChange(removeBulkRow(doc, row.id))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {field(
                    `picker.${row.id}`,
                    `ค้นหาสินค้าตัวอย่าง · รายการ ${index + 1}`,
                    productSearch[row.id] ?? "",
                    (value) => {
                      setProductSearch((s) => ({ ...s, [row.id]: value }));
                      const product = bulkProducts.find(
                        (p) => p.code === value,
                      );
                      if (product)
                        onChange(selectBulkProduct(doc, row.id, product));
                    },
                    "text",
                    "bulk-product-catalog",
                  )}
                  {f("productCode", "รหัสสินค้า", "text", "bulk-product-codes")}
                  {f("product", "ผลิตปุ๋ย *", "text", "bulk-product-names")}
                  {f("qty", `จำนวนที่สั่งผลิต (${row.qtyUnit}) *`, "number")}
                  {f("lot", "Lot *", "text", `bulk-lots-${row.id}`)}
                  {f("size", "ขนาด (กิโลกรัม) *", "number")}
                  {f(
                    "carryQty",
                    "ยอดค้างการผลิตที่บันทึกเอง (กระสอบ)",
                    "number",
                  )}
                  {f("carryNote", "รายละเอียดยอดค้างการผลิต")}
                  {f("sizeNote", "หมายเหตุขนาด / รายการ")}
                </div>
                <datalist id={`bulk-lots-${row.id}`}>
                  {bulkProducts
                    .filter((p) => p.code === row.productCode)
                    .map((p) => (
                      <option key={p.id} value={p.formulaVersion} />
                    ))}
                </datalist>
              </section>
            );
          })}
          {!doc.rows.length && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการ กดเพิ่มรายการผลิตเพื่อเริ่มต้น
            </p>
          )}
        </div>
      </SectionCard>
      <SectionCard
        title="จำนวนสรุป"
        subtitle="สรุปเฉพาะแผนในใบสั่งผลิต ยอดจริงอยู่ในรายงานการผลิต"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["จำนวนกระสอบรวมจากรายการผลิต", summary.totalBags],
            ["จำนวนกระสอบเป้าหมาย", summary.targetBags],
          ].map(([label, value]) => (
            <div className="rounded-lg border bg-muted/20 p-4" key={label}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {Number(value).toLocaleString("th-TH")}{" "}
                <span className="text-sm font-normal">กระสอบ</span>
              </p>
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="หมายเหตุเอกสาร">
        {field(
          "note",
          "หมายเหตุเอกสาร",
          doc.note,
          (note) => onChange({ ...doc, note }),
          "text",
          undefined,
          true,
        )}
      </SectionCard>
      <SectionCard
        title="ลงชื่อ"
        subtitle="ข้อมูลข้อความจำลอง ไม่ใช่ลายเซ็นหรือการอนุมัติจริง"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(signerLabels) as Array<keyof typeof signerLabels>).map(
            (key) =>
              field(
                `docSigners.${key}`,
                signerLabels[key],
                doc.docSigners[key],
                (v) =>
                  onChange({
                    ...doc,
                    docSigners: { ...doc.docSigners, [key]: v },
                  }),
              ),
          )}
        </div>
      </SectionCard>
      <datalist id="bulk-product-catalog">
        {bulkProducts.map((p) => (
          <option key={p.id} value={p.code}>
            {p.name} · สูตร {p.formulaVersion}
          </option>
        ))}
      </datalist>
      <datalist id="bulk-product-codes">
        {bulkProducts.map((p) => (
          <option key={p.id} value={p.code} />
        ))}
      </datalist>
      <datalist id="bulk-product-names">
        {bulkProducts.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <div className="flex flex-wrap justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit">บันทึกข้อมูลตัวอย่าง</Button>
      </div>
    </form>
  );
}
