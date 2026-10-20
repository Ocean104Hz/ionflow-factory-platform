"use client";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { SectionCard } from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import {
  addSample,
  removeSample,
  updateSample,
  sampleFields,
  type SampleSubmission,
  type SampleErrors,
  type SampleResult,
} from "./sample-submission-domain";

export function SampleSubmissionForm({
  report,
  errors,
  onChange,
  onSave,
  onReset,
}: {
  report: SampleSubmission;
  errors: SampleErrors;
  onChange: (r: SampleSubmission) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  function error(key: string) {
    return (
      errors[key] && (
        <p
          role="alert"
          id={`sample-error-${key}`}
          className="text-xs text-danger"
        >
          {errors[key]}
        </p>
      )
    );
  }
  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {report.id && (
        <p className="break-all text-sm text-primary">
          กำลังแก้ไขข้อมูลตัวอย่าง: {report.doc_no}
        </p>
      )}
      <SectionCard
        title="ข้อมูลเอกสาร"
        subtitle="UI Mock · ไม่มีการส่งข้อมูลหรือเชื่อม Inventory"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["doc_no", "เลขที่เอกสาร"],
              ["doc_date", "วันที่เอกสาร"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`sample-${key}`}>
                {label} <span className="text-danger">*</span>
              </Label>
              <Input
                id={`sample-${key}`}
                type={key === "doc_date" ? "date" : "text"}
                value={report[key]}
                aria-required
                aria-invalid={!!errors[key]}
                aria-describedby={
                  errors[key] ? `sample-error-${key}` : undefined
                }
                onChange={(e) => onChange({ ...report, [key]: e.target.value })}
              />
              {error(key)}
            </div>
          ))}
        </div>
      </SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            รายการตัวอย่าง · {report.rows.length} แถว
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            กรอกชื่อและ Lot · ช่องผลวิเคราะห์เว้นว่างได้
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => onChange(addSample(report, crypto.randomUUID()))}
        >
          <Plus aria-hidden="true" />
          เพิ่มตัวอย่าง
        </Button>
      </div>
      {error("rows")}
      {report.rows.map((row, index) => (
        <SectionCard
          key={row.id}
          title={`ตัวอย่าง ${index + 1}`}
          action={
            <ConfirmDialog
              title={`ลบตัวอย่าง ${index + 1}?`}
              description="ลบเฉพาะแถวนี้ ข้อมูลในแถวอื่นจะคงเดิม"
              trigger={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 text-danger"
                >
                  <Trash2 aria-hidden="true" />
                  ลบแถว
                </Button>
              }
              onConfirm={() => onChange(removeSample(report, row.id))}
            />
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {sampleFields
              .filter(([key]) => key !== "remark")
              .map(([key, label]) => {
                const fieldKey = `${row.id}.${key}`,
                  id = `sample-${fieldKey}`;
                return (
                  <div key={key} className="min-w-0 space-y-2">
                    <Label htmlFor={id}>
                      {label}
                      {(key === "product_name" || key === "lot_no") && (
                        <span className="text-danger"> *</span>
                      )}
                    </Label>
                    <Input
                      id={id}
                      value={row[key]}
                      type={
                        key === "sent_date" || key === "sample_date"
                          ? "date"
                          : "text"
                      }
                      aria-required={key === "product_name" || key === "lot_no"}
                      aria-invalid={!!errors[fieldKey]}
                      aria-describedby={
                        errors[fieldKey]
                          ? `sample-error-${fieldKey}`
                          : undefined
                      }
                      onChange={(e) =>
                        onChange(
                          updateSample(report, {
                            ...row,
                            [key]: e.target.value,
                          }),
                        )
                      }
                    />
                    {error(fieldKey)}
                  </div>
                );
              })}
            <div className="min-w-0 space-y-2">
              <Label htmlFor={`sample-result-${row.id}`}>ผลวิเคราะห์</Label>
              <Select
                value={row.analysis_result_status ?? "missing"}
                onValueChange={(v) =>
                  onChange(
                    updateSample(report, {
                      ...row,
                      analysis_result_status:
                        v === "missing" ? null : (v as SampleResult),
                    }),
                  )
                }
              >
                <SelectTrigger
                  id={`sample-result-${row.id}`}
                  className="w-full"
                  aria-invalid={!!errors[`${row.id}.analysis_result_status`]}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">ยังไม่ระบุ</SelectItem>
                  <SelectItem value="ผ่าน">ผ่าน</SelectItem>
                  <SelectItem value="ไม่ผ่าน">ไม่ผ่าน</SelectItem>
                </SelectContent>
              </Select>
              {error(`${row.id}.analysis_result_status`)}
            </div>
            <div className="space-y-2 sm:col-span-2 xl:col-span-3">
              <Label htmlFor={`sample-remark-${row.id}`}>หมายเหตุ</Label>
              <Textarea
                id={`sample-remark-${row.id}`}
                rows={2}
                value={row.remark}
                onChange={(e) =>
                  onChange(
                    updateSample(report, { ...row, remark: e.target.value }),
                  )
                }
              />
            </div>
          </div>
        </SectionCard>
      ))}
      <p className="text-xs text-muted-foreground">
        ผ่าน/ไม่ผ่านเป็นผลรายตัวอย่างเท่านั้น ไม่ใช่ผลอนุมัติ QA การคืนสินค้า
        หรือการปล่อยสต็อก
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onReset}
        >
          {report.id ? "ยกเลิกการแก้ไข / เริ่มใหม่" : "ล้างข้อมูล"}
        </Button>
        <Button type="submit" className="min-h-11">
          บันทึกข้อมูลตัวอย่าง
        </Button>
      </div>
    </form>
  );
}
