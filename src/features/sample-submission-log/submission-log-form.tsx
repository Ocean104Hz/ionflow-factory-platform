"use client";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/src/components/ui/radio-group";
import { SectionCard, StatusBadge } from "@/src/components/factory/patterns";
import {
  parseRequesterAddress,
  editRequesterAddress,
} from "./submission-log-address";
import {
  analysisItems,
  typeOptions,
  formOptions,
  setLogType,
  setLogForm,
  logTypeValue,
  logFormValue,
  logDate,
  labSampleNote,
  selectedAnalysis,
  type SubmissionLog,
  type LogErrors,
} from "./submission-log-domain";

export function SubmissionLogSections({
  row,
  onChange,
  errors = {},
}: {
  row: SubmissionLog;
  onChange?: (row: SubmissionLog) => void;
  errors?: LogErrors;
}) {
  const readOnly = !onChange,
    prefix = readOnly ? "read-log" : "log",
    q = row.quantity,
    rr = q.receive_result,
    staff = row.staff_section,
    address = parseRequesterAddress(row.requester_address);
  const patch = (value: Partial<SubmissionLog>) =>
    onChange?.({ ...row, ...value });
  const fieldError = (key: string) =>
    errors[key === "sample_code_info" ? "sample_code" : key] && (
      <p id={`log-error-${key}`} className="text-xs text-danger">
        {errors[key === "sample_code_info" ? "sample_code" : key]}
      </p>
    );
  function field(
    key: string,
    label: string,
    value: string,
    set: (v: string) => void,
    required = false,
    type = "text",
    multiline = false,
  ) {
    const id = `${prefix}-${key}`,
      issue = errors[key === "sample_code_info" ? "sample_code" : key];
    return (
      <div
        className="grid min-w-0 content-start gap-2"
        key={key}
        data-log-field={key}
      >
        {readOnly ? (
          <p className="text-xs text-muted-foreground">{label}</p>
        ) : (
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-danger"> *</span>}
          </Label>
        )}
        {readOnly ? (
          <p className="whitespace-pre-wrap break-words text-sm">
            {type === "date" ? logDate(value) : value || "—"}
          </p>
        ) : multiline ? (
          <Textarea
            id={id}
            rows={3}
            value={value}
            aria-required={required}
            aria-invalid={!!issue}
            aria-describedby={issue ? `log-error-${key}` : undefined}
            onChange={(e) => set(e.target.value)}
          />
        ) : (
          <Input
            id={id}
            type={type}
            inputMode={key === "quantity_amount" ? "decimal" : undefined}
            value={value}
            aria-required={required}
            aria-invalid={!!issue}
            aria-describedby={issue ? `log-error-${key}` : undefined}
            onChange={(e) => set(e.target.value)}
          />
        )}
        {fieldError(key)}
      </div>
    );
  }
  function choice(
    key: string,
    label: string,
    value: string,
    options: readonly (readonly [string, string])[],
    set: (v: string) => void,
    optional = false,
  ) {
    const id = `${prefix}-${key}`,
      items = optional ? [["unset", "ยังไม่ระบุ"], ...options] : options;
    return (
      <div className="min-w-0 space-y-3" key={key}>
        <p id={`${id}-label`} className="text-sm font-medium">
          {label}
          {!optional && !readOnly && <span className="text-danger"> *</span>}
        </p>
        <RadioGroup
          id={id}
          aria-labelledby={`${id}-label`}
          aria-required={!optional}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `log-error-${key}` : undefined}
          value={value}
          onValueChange={set}
          disabled={readOnly}
          className="grid gap-3 sm:grid-cols-2"
        >
          {items.map(([v, text]) => (
            <Label
              htmlFor={`${id}-${v}`}
              key={v}
              className={`flex min-w-0 items-start gap-2 rounded-lg border p-3 text-sm leading-relaxed ${value === v ? "border-primary/30 bg-primary/5" : ""} ${!readOnly ? "cursor-pointer" : ""}`}
            >
              <RadioGroupItem
                id={`${id}-${v}`}
                value={v}
                className="mt-0.5 disabled:opacity-100"
              />
              <span>{text}</span>
            </Label>
          ))}
        </RadioGroup>
        {fieldError(key)}
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-4 [overflow-wrap:anywhere]">
      <SectionCard title="ข้อมูลเอกสาร">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {field(
            "doc_no",
            "เลขที่คำขอ",
            row.doc_no,
            (doc_no) => patch({ doc_no }),
            true,
          )}
          {field(
            "sample_code",
            "รหัสตัวอย่าง",
            row.sample_code,
            (sample_code) => patch({ sample_code }),
            true,
          )}
        </div>
      </SectionCard>
      <SectionCard title="ข้อมูลผู้ส่งตัวอย่าง">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {field(
            "requester_name",
            "ชื่อผู้ส่ง",
            row.requester_name,
            (requester_name) => patch({ requester_name }),
            true,
          )}
          {field(
            "requester_phone",
            "เบอร์โทร",
            row.requester_phone,
            (requester_phone) => patch({ requester_phone }),
            false,
            "tel",
          )}
          {field(
            "requester_email",
            "อีเมล",
            row.requester_email,
            (requester_email) => patch({ requester_email }),
            false,
            "email",
          )}
          <div className="sm:col-span-2 xl:col-span-3">
            {field(
              "requester_address",
              "รายละเอียดที่อยู่",
              address.detail,
              (value) =>
                patch({
                  requester_address: editRequesterAddress(
                    row.requester_address,
                    "detail",
                    value,
                  ),
                }),
              false,
              "text",
              true,
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          กรอกที่อยู่เอง · ไม่มีการค้นหาจากบริการภายนอก
          ข้อความเดิมที่แยกไม่ได้จะอยู่ในรายละเอียดที่อยู่ครบถ้วน
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {field("requester_province", "จังหวัด", address.province, (value) =>
            patch({
              requester_address: editRequesterAddress(
                row.requester_address,
                "province",
                value,
              ),
            }),
          )}
          {field(
            "requester_district",
            "อำเภอ / เขต",
            address.district,
            (value) =>
              patch({
                requester_address: editRequesterAddress(
                  row.requester_address,
                  "district",
                  value,
                ),
              }),
          )}
          {field(
            "requester_subdistrict",
            "ตำบล / แขวง",
            address.subdistrict,
            (value) =>
              patch({
                requester_address: editRequesterAddress(
                  row.requester_address,
                  "subdistrict",
                  value,
                ),
              }),
          )}
          {field(
            "requester_zipcode",
            "รหัสไปรษณีย์",
            address.zipcode,
            (value) =>
              patch({
                requester_address: editRequesterAddress(
                  row.requester_address,
                  "zipcode",
                  value,
                ),
              }),
          )}
        </div>
      </SectionCard>
      <SectionCard title="ข้อมูลตัวอย่าง">
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "sample_code_info",
            "รหัสตัวอย่าง (ข้อมูลตัวอย่าง)",
            row.sample_code,
            (sample_code) => patch({ sample_code }),
            true,
          )}
          {field(
            "sample_name",
            "ชื่อตัวอย่าง",
            row.sample_name,
            (sample_name) => patch({ sample_name }),
            true,
          )}
          {field(
            "sample_characteristics",
            "ลักษณะตัวอย่าง",
            row.sample_characteristics,
            (sample_characteristics) => patch({ sample_characteristics }),
            false,
            "text",
            true,
          )}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            {choice(
              "sample_type",
              "ประเภทตัวอย่าง",
              logTypeValue(row),
              typeOptions,
              (v) => onChange?.(setLogType(row, v)),
            )}
            {row.sample_type.other_detail !== null &&
              field(
                "sample_type_other",
                "ประเภทตัวอย่างอื่น ๆ",
                row.sample_type.other_detail,
                (other_detail) =>
                  patch({ sample_type: { ...row.sample_type, other_detail } }),
                true,
              )}
          </div>
          <div className="space-y-3">
            {choice(
              "sample_form",
              "รูปแบบตัวอย่าง",
              logFormValue(row),
              formOptions,
              (v) => onChange?.(setLogForm(row, v)),
            )}
            {row.sample_form.other_detail !== null &&
              field(
                "sample_form_other",
                "รูปแบบตัวอย่างอื่น ๆ",
                row.sample_form.other_detail,
                (other_detail) =>
                  patch({ sample_form: { ...row.sample_form, other_detail } }),
                true,
              )}
          </div>
        </div>
      </SectionCard>
      <SectionCard
        title="รายการตรวจวิเคราะห์"
        subtitle="เลือกได้หลายรายการ ตามรายการอ้างอิง iCON ทั้ง 32 ข้อ"
        action={
          <StatusBadge tone="info">{`เลือก ${selectedAnalysis(row).length} / 32 รายการ`}</StatusBadge>
        }
      >
        <div
          id={`${prefix}-requested_items`}
          role="group"
          aria-label="รายการตรวจวิเคราะห์ 32 ข้อ"
          aria-describedby={
            errors.requested_items ? "log-error-requested_items" : undefined
          }
          tabIndex={-1}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {analysisItems.map(([key, label], index) => (
            <Label
              key={key}
              htmlFor={`${prefix}-analysis-${key}`}
              className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-sm leading-relaxed ${row.requested_items[key] ? "border-primary/30 bg-primary/5" : ""} ${!readOnly ? "cursor-pointer" : ""}`}
            >
              <Checkbox
                id={`${prefix}-analysis-${key}`}
                checked={row.requested_items[key]}
                disabled={readOnly}
                className="mt-0.5 disabled:opacity-100"
                onCheckedChange={(v) =>
                  patch({
                    requested_items: {
                      ...row.requested_items,
                      [key]: v === true,
                    },
                  })
                }
              />
              <span>
                {index + 1}. {label}
              </span>
            </Label>
          ))}
        </div>
        {fieldError("requested_items")}
        {row.requested_items.other && (
          <div className="mt-4">
            {field(
              "analysis_other",
              "รายละเอียดรายการวิเคราะห์อื่น ๆ",
              row.requested_items.other_detail,
              (other_detail) =>
                patch({
                  requested_items: { ...row.requested_items, other_detail },
                }),
              true,
            )}
          </div>
        )}
      </SectionCard>
      <SectionCard title="ปริมาณและการรับผลทดสอบ">
        <div className="grid gap-4 sm:grid-cols-2">
          {field(
            "quantity_amount",
            "ปริมาณตัวอย่าง (ตามที่ระบุ)",
            q.amount,
            (amount) => patch({ quantity: { ...q, amount } }),
            true,
          )}
          {field(
            "quantity_packaging",
            "ภาชนะบรรจุ",
            q.packaging,
            (packaging) => patch({ quantity: { ...q, packaging } }),
            true,
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">กิโลกรัม / กรัม</p>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {labSampleNote}
        </p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {choice(
            "sample_return",
            "การรับคืนตัวอย่าง",
            rr.sample_return
              ? "sample_return"
              : rr.not_return
                ? "not_return"
                : "",
            [
              ["sample_return", "ขอรับคืนตัวอย่าง"],
              ["not_return", "ไม่รับคืนตัวอย่าง"],
            ],
            (v) =>
              patch({
                quantity: {
                  ...q,
                  receive_result: {
                    ...rr,
                    sample_return: v === "sample_return",
                    not_return: v === "not_return",
                  },
                },
              }),
          )}
          {choice(
            "result_delivery",
            "วิธีรับผลทดสอบ",
            rr.pick_up ? "pick_up" : rr.mail ? "mail" : "",
            [
              ["pick_up", "มารับด้วยตัวเอง"],
              ["mail", "ไปรษณีย์"],
            ],
            (v) =>
              patch({
                quantity: {
                  ...q,
                  receive_result: {
                    ...rr,
                    pick_up: v === "pick_up",
                    mail: v === "mail",
                  },
                },
              }),
          )}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          รายงานผลการทดสอบจัดทำเป็นฉบับภาษาไทยเท่านั้น
          เว้นแต่รายการวิเคราะห์เป็นภาษาอังกฤษ
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {field(
            "sender_name",
            "ชื่อผู้ส่งตัวอย่าง",
            row.sender_sign.signer_name,
            (signer_name) =>
              patch({ sender_sign: { ...row.sender_sign, signer_name } }),
            true,
          )}
          {field(
            "sender_date",
            "วันที่ลงชื่อ",
            row.sender_sign.signed_date,
            (signed_date) =>
              patch({ sender_sign: { ...row.sender_sign, signed_date } }),
            true,
            "date",
          )}
        </div>
      </SectionCard>
      <SectionCard
        title="สำหรับเจ้าหน้าที่"
        subtitle="ข้อความตัวอย่างเท่านั้น ไม่ใช่การรับงานจริง การลงนาม หรือผลอนุมัติห้องปฏิบัติการ"
        className="border-primary/20 bg-muted/20"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            {choice(
              "sample_condition",
              "สภาพตัวอย่าง",
              staff.sample_condition.normal
                ? "normal"
                : staff.sample_condition.abnormal
                  ? "abnormal"
                  : "unset",
              [
                ["normal", "ปกติ"],
                ["abnormal", "ผิดปกติ"],
              ],
              (v) =>
                patch({
                  staff_section: {
                    ...staff,
                    sample_condition: {
                      ...staff.sample_condition,
                      normal: v === "normal",
                      abnormal: v === "abnormal",
                    },
                  },
                }),
              true,
            )}
            {staff.sample_condition.abnormal &&
              field(
                "abnormal_detail",
                "รายละเอียดความผิดปกติ",
                staff.sample_condition.abnormal_detail,
                (abnormal_detail) =>
                  patch({
                    staff_section: {
                      ...staff,
                      sample_condition: {
                        ...staff.sample_condition,
                        abnormal_detail,
                      },
                    },
                  }),
                true,
                "text",
                true,
              )}
          </div>
          <div className="space-y-3">
            {choice(
              "job_acceptance",
              "ความพร้อมรับงาน (ตัวอย่าง)",
              staff.job_acceptance.accepted
                ? "accepted"
                : staff.job_acceptance.rejected
                  ? "rejected"
                  : "unset",
              [
                ["accepted", "พร้อมรับงาน"],
                ["rejected", "ไม่พร้อมรับงาน"],
              ],
              (v) =>
                patch({
                  staff_section: {
                    ...staff,
                    job_acceptance: {
                      ...staff.job_acceptance,
                      accepted: v === "accepted",
                      rejected: v === "rejected",
                    },
                  },
                }),
              true,
            )}
            {staff.job_acceptance.rejected &&
              field(
                "reject_reason",
                "เหตุผลที่ไม่พร้อมรับงาน",
                staff.job_acceptance.reject_reason,
                (reject_reason) =>
                  patch({
                    staff_section: {
                      ...staff,
                      job_acceptance: {
                        ...staff.job_acceptance,
                        reject_reason,
                      },
                    },
                  }),
                true,
                "text",
                true,
              )}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {field(
            "received_by",
            "ผู้รับตัวอย่าง",
            staff.received_by,
            (received_by) =>
              patch({ staff_section: { ...staff, received_by } }),
          )}
          {field(
            "received_date",
            "วันที่รับตัวอย่าง",
            staff.received_date,
            (received_date) =>
              patch({ staff_section: { ...staff, received_date } }),
            false,
            "date",
          )}
          {field(
            "accepted_by",
            "ผู้รับงาน / ผู้ทบทวน",
            staff.accepted_by,
            (accepted_by) =>
              patch({ staff_section: { ...staff, accepted_by } }),
          )}
          {field(
            "accepted_date",
            "วันที่รับงาน",
            staff.accepted_date,
            (accepted_date) =>
              patch({ staff_section: { ...staff, accepted_date } }),
            false,
            "date",
          )}
        </div>
      </SectionCard>
    </div>
  );
}
