"use client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/src/components/ui/dropdown-menu";
import { SectionCard } from "@/src/components/factory/patterns";
import {
  headerFields,
  productFields,
  descriptionFields,
  reviewerFields,
  ncDepartments,
  ncUnits,
} from "./nc-report-mock-helpers";
import {
  ncDecisions,
  type NCReport,
  type NCErrors,
  type NCTextField,
} from "./nc-report-types";

export function NCReportForm({
  report,
  errors,
  onChange,
  onSave,
  onReset,
  onCancel,
}: {
  report: NCReport;
  errors: NCErrors;
  onChange: (r: NCReport) => void;
  onSave: () => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  function field(
    key: NCTextField,
    label: string,
    multiline = false,
    optional = false,
  ) {
    const id = `nc-${key}`,
      error = errors[key];
    const props = {
      id,
      value: report[key],
      "aria-invalid": !!error,
      "aria-describedby": error ? `${id}-error` : undefined,
      "aria-required": !optional,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => onChange({ ...report, [key]: e.target.value }),
    };
    return (
      <div key={key} className="min-w-0 space-y-2">
        <Label htmlFor={id}>
          {label}
          {!optional && <span className="text-danger"> *</span>}
        </Label>
        {multiline ? (
          <Textarea {...props} rows={5} />
        ) : key === "department" || key === "unit" ? (
          <div className="flex gap-2">
            <Input {...props} className="min-w-0" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={
                    key === "department"
                      ? "เลือกแผนกจากตัวอย่าง"
                      : "เลือกหน่วยนับจากตัวอย่าง"
                  }
                >
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(key === "department" ? ncDepartments : ncUnits).map(
                  (value) => (
                    <DropdownMenuItem
                      key={value}
                      onSelect={() => onChange({ ...report, [key]: value })}
                    >
                      {value}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <Input
            {...props}
            type={
              key === "doc_date" || key === "production_date" ? "date" : "text"
            }
            inputMode={key === "quantity" ? "decimal" : undefined}
          />
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <form
      noValidate
      className="min-w-0 space-y-5 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {report.id && (
        <p className="text-sm text-primary">
          กำลังแก้ไขข้อมูลตัวอย่าง: {report.doc_no}
        </p>
      )}
      <SectionCard title="ข้อมูลเอกสาร">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {headerFields.map(([k, l]) => field(k, l))}
        </div>
      </SectionCard>
      <SectionCard
        title="รายละเอียดข้อบกพร่อง"
        subtitle="รหัสสินค้าไม่ใช่ Lot อ้างอิง Inventory · ข้อมูลที่กรอกใช้ในตัวอย่างนี้เท่านั้น"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {productFields.map(([k, l]) => field(k, l))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {descriptionFields.map(([k, l]) => field(k, l, true))}
        </div>
      </SectionCard>
      <SectionCard
        title="สรุปผลการตัดสินใจ"
        subtitle="เลือกได้หลายข้อ · เป็นบันทึกตัวอย่าง ไม่คืนสินค้า ไม่สร้างงานผลิต ไม่ปล่อย QC และไม่เปลี่ยน Inventory"
      >
        <div
          role="group"
          aria-label="แนวทางจัดการ NC"
          aria-describedby={errors.decisions ? "nc-decisions-error" : undefined}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        >
          {ncDecisions.map(([key, label]) => (
            <Label
              key={key}
              htmlFor={`nc-decision-${key}`}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 leading-relaxed ${report.decisions[key] ? "border-primary bg-primary/5 text-primary" : "bg-card"}`}
            >
              <Checkbox
                id={`nc-decision-${key}`}
                checked={report.decisions[key]}
                onCheckedChange={(v) =>
                  onChange({
                    ...report,
                    decisions: { ...report.decisions, [key]: v === true },
                  })
                }
                aria-invalid={!!errors.decisions}
              />
              {label}
            </Label>
          ))}
        </div>
        {errors.decisions && (
          <p
            role="alert"
            id="nc-decisions-error"
            className="mt-3 text-xs text-danger"
          >
            {errors.decisions}
          </p>
        )}
      </SectionCard>
      <SectionCard
        title="ผู้ทบทวนและผู้อนุมัติ"
        subtitle="ชื่อเป็นข้อความตัวอย่างเท่านั้น ไม่ใช่การลงนามหรือผลอนุมัติ QA และไม่จำเป็นต้องกรอก"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {reviewerFields.map(([k, l]) => field(k, l, false, true))}
        </div>
      </SectionCard>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onReset}>
          ล้างข้อมูล
        </Button>
        {report.id && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิกการแก้ไข
          </Button>
        )}
        <Button type="submit">บันทึกข้อมูลตัวอย่าง</Button>
      </div>
    </form>
  );
}
