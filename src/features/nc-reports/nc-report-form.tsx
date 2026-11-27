"use client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/src/components/ui/dropdown-menu";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";
import {
  headerFields,
  productFields,
  descriptionFields,
  reviewerFields,
  legacyReviewerFields,
  ncDepartments,
  ncUnits,
} from "./nc-report-mock-helpers";
import {
  ncDecisions,
  type NCReport,
  type NCErrors,
  type NCTextField,
} from "./nc-report-types";

const placeholders: Partial<Record<NCTextField, string>> = {
  doc_no: "เช่น NC-0001",
  discoverer: "ชื่อผู้พบ",
  department: "เลือก/พิมพ์แผนก",
  product_name: "ชื่อสินค้า",
  quantity: "0",
  unit: "เลือก/พิมพ์หน่วย",
  production_code: "เช่น LOT-2026-001",
  problem_defect: "อธิบายปัญหา/ข้อบกพร่อง...",
  countermeasure: "การแก้ไข/ป้องกัน...",
  discoverer_signer_name: "ชื่อผู้พบข้อบกพร่อง",
  responsible_reviewer_name: "ชื่อผู้รับผิดชอบ/ผู้ทบทวน",
  approver_name: "ชื่อผู้อนุมัติ",
};

function NCFormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="min-w-0 gap-0 rounded-xl border bg-card py-0 shadow-sm">
      <div className="border-b">
        <CardHeader className="gap-0 px-4 py-3.5">
          <CardTitle className="text-base leading-relaxed"><h2>{title}</h2></CardTitle>
        </CardHeader>
      </div>
      <CardContent className="min-w-0 p-4">{children}</CardContent>
    </Card>
  );
}

export function NCReportForm({
  report,
  errors,
  disabled = false,
  onChange,
  onSave,
  onCancel,
}: {
  report: NCReport;
  errors: NCErrors;
  disabled?: boolean;
  onChange: (r: NCReport) => void;
  onSave: () => void;
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
      placeholder: placeholders[key],
      "aria-invalid": !!error,
      "aria-describedby": error ? `${id}-error` : undefined,
      "aria-required": !optional,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => onChange({ ...report, [key]: e.target.value }),
    };
    if (key === "doc_date" || key === "production_date") {
      return (
        <div key={key} className="min-w-0 [&_button]:h-10 [&_button]:rounded-lg [&_button]:shadow-none">
          <ThaiBuddhistDatePicker
            label={`${label} *`}
            value={report[key]}
            onChange={(value) => onChange({ ...report, [key]: value })}
            error={error}
            disabled={disabled}
          />
        </div>
      );
    }
    return (
      <div key={key} className="min-w-0 space-y-2">
        <Label htmlFor={id} className="leading-relaxed">
          {label}
          {!optional && <span className="text-danger"> *</span>}
        </Label>
        {multiline ? (
          <Textarea {...props} rows={4} className="min-h-24 resize-y rounded-lg leading-relaxed shadow-none" />
        ) : key === "department" || key === "unit" ? (
          <div className="relative min-w-0">
            <Input {...props} className="h-10 min-w-0 rounded-lg pr-11 shadow-none" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md shadow-none"
                  aria-label={
                    key === "department"
                      ? "เลือกแผนก"
                      : "เลือกหน่วยนับ"
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
            className="h-10 rounded-lg shadow-none"
            type="text"
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
      className="min-w-0 space-y-6 pb-3 [--primary:#173b63] [--primary-foreground:#fff] [--input:#e0e3e7] dark:[--input:#475569]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {report.id && (
        <p role="status" className="rounded-xl border border-warning/20 bg-warning/8 px-4 py-3 text-sm text-warning">
          กำลังแก้ไขเอกสาร: {report.doc_no}
        </p>
      )}
      <NCFormCard title="ส่วนหัวเอกสาร">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {headerFields.map(([k, l]) => field(k, l))}
        </div>
      </NCFormCard>
      <NCFormCard title="รายละเอียดข้อบกพร่อง">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {productFields.map(([k, l]) => field(k, l))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {descriptionFields.map(([k, l]) => field(k, l, true))}
        </div>
        <section className="mt-6 rounded-xl border bg-card p-4" aria-labelledby="nc-decisions-heading">
          <h3 id="nc-decisions-heading" className="text-sm font-semibold">สรุปผลการตัดสินใจ</h3>
          <div
            role="group"
            aria-label="แนวทางจัดการ NC"
            aria-describedby={errors.decisions ? "nc-decisions-error" : undefined}
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          >
            {ncDecisions.map(([key, label]) => (
              <Label
                key={key}
                htmlFor={`nc-decision-${key}`}
                className={`flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm leading-relaxed ${report.decisions[key] ? "border-[#173b63] bg-[#173b63]/5 text-[#173b63] dark:text-foreground" : "bg-[#eef2f6] dark:bg-muted"}`}
              >
                <Checkbox
                  id={`nc-decision-${key}`}
                  className="rounded-none"
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
          {/* <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            เลือกได้หลายข้อ · บันทึกผลเท่านั้น ไม่คืนสินค้า ไม่สร้างงานผลิต ไม่ปล่อย QC และไม่เปลี่ยน Inventory
          </p> */}
          {errors.decisions && (
            <p
              role="alert"
              id="nc-decisions-error"
              className="mt-3 text-xs text-danger"
            >
              {errors.decisions}
            </p>
          )}
        </section>
        {/* <p className="mt-2 text-xs text-muted-foreground">รหัสสินค้าเป็นข้อมูลประกอบใบ NC ไม่ใช่ Lot ที่เชื่อมกับ Inventory</p> */}
      </NCFormCard>
      <NCFormCard title="รายชื่อผู้ลงนาม">
        <div className="grid gap-4 md:grid-cols-3">
          {reviewerFields.map(([k, l]) => (
            <div key={k} className="min-w-0 rounded-xl border bg-card p-4">
              {field(k, l, false, true)}
            </div>
          ))}
        </div>
        {legacyReviewerFields.some(([k]) => Boolean(report[k])) && (
          <div className="mt-3 rounded-lg border p-3 text-xs text-muted-foreground">
            <p className="font-medium">รายชื่อผู้ทบทวนจากเอกสารรูปแบบเดิม (เก็บไว้เพื่ออ้างอิง)</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {legacyReviewerFields.map(([k, l]) => (
                <div key={k} className="min-w-0">
                  <dt>{l}</dt><dd className="wrap-break-word text-foreground">{report[k] || "-"}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {/* <p className="mt-2 text-xs text-muted-foreground">ชื่อเป็นข้อมูลประกอบเอกสาร ไม่ใช่การลงนามหรือผลอนุมัติ QA และไม่จำเป็นต้องกรอก</p> */}
      </NCFormCard>
      <div className="flex flex-wrap justify-end gap-2">
        {report.id && (
          <Button type="button" variant="outline" onClick={onCancel}>
            ยกเลิกการแก้ไข
          </Button>
        )}
        <Button type="submit" className="rounded-lg bg-[#173b63] text-white shadow-sm hover:bg-[#173b63]/90">
          บันทึก
        </Button>
      </div>
    </form>
  );
}
