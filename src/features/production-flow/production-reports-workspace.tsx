"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { DocumentViewActions,
  FactoryDataTable,
  PageHeader,
  SectionCard,
  SelectField,
  StatusBadge,
} from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { productionRequest, useProductionV1Data } from "./production-v1-client";
import { ProductionReportDialog } from "./production-report-document";
import { newProductionReport, type ProductionFlowErrors, type ProductionFormulaSheet, type ProductionReport } from "./production-flow-domain";

export function ProductionReportsWorkspace() {
  const { data, loading, error, refresh } = useProductionV1Data<{
    documents: ProductionReport[]; sheets: ProductionFormulaSheet[]; lockedOrderIds: string[];
  }>("report");
  const flow = { reports: data?.documents ?? [], formulaSheets: data?.sheets ?? [] };
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<ProductionReport | null>(null);
  const [errors, setErrors] = useState<ProductionFlowErrors>({});
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("history");
  const [view, setView] = useState<ProductionReport | null>(null);
  const sourceOptions = flow.formulaSheets.flatMap((sheet) =>
    sheet.lines
      .filter(
        (line) =>
          line.orderLineId === report?.orderLineId ||
          !flow.reports.some((row) => row.orderLineId === line.orderLineId),
      )
      .map((line) => ({
        value: `${sheet.orderId}|${line.orderLineId}`,
        label: `${sheet.orderNumber} · ${line.productCode} · ${line.productName}`,
      })),
  );
  const sheet = flow.formulaSheets.find((row) => row.id === report?.formulaSheetId);
  const line = sheet?.lines.find((row) => row.orderLineId === report?.orderLineId);
  const field = (
    key: keyof ProductionReport,
    label: string,
    type = "text",
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`production-report-${key}`}>{label}</Label>
      <Input
        id={`production-report-${key}`}
        name={key}
        type={type}
        step={type === "number" ? "any" : undefined}
        value={String(report?.[key] ?? "")}
        onChange={(event) =>
          report &&
          setReport((current) =>
            current
              ? {
                  ...current,
                  [key]:
                    type === "number"
                      ? event.target.value === ""
                        ? null
                        : Number(event.target.value)
                      : event.target.value,
                }
              : current,
          )
        }
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `production-report-${key}-error` : undefined}
      />
      {errors[key] && (
        <p id={`production-report-${key}-error`} className="text-xs text-danger">
          {errors[key]}
        </p>
      )}
    </div>
  );
  function chooseSource(value: string) {
    const [orderId, orderLineId] = value.split("|");
    try {
      const source = flow.formulaSheets.find((row) => row.orderId === orderId);
      if (!source) throw new Error("ไม่พบใบสั่งผลิต V1 ต้นทาง");
      setReport({ ...newProductionReport(source, orderLineId, ""), reportDate: source.orderDate });
      setErrors({});
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เปิดรายการไม่ได้");
    }
  }
  async function save(status: ProductionReport["status"]) {
    if (!report || saving) return;
    setSaving(true);
    try {
      const result = await productionRequest<{ saved?: ProductionReport; errors: ProductionFlowErrors }>("report", {
        action: "save", row: { ...report, status },
      });
      setErrors(result.errors);
      if (!result.saved) {
        setMessage("ยังบันทึกไม่ได้ กรุณาตรวจสอบข้อมูล");
        return;
      }
      setReport(result.saved);
      setMessage(status === "RECORDED" ? "บันทึกรายงานการผลิตแล้ว" : "บันทึกแบบร่างแล้ว");
      refresh();
    } catch (issue) {
      setMessage(issue instanceof Error ? issue.message : "บันทึกรายงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="รายงานการผลิต"
        description="บันทึกผลผลิตจริงจากใบสั่งผลิต V1 และสูตร BOM ที่บันทึกไว้"
        actions={
          <DocumentViewActions
            showingForm={tab === "form"}
            createLabel="สร้างรายงาน"
            disabled={saving || loading || !!error}
            confirmCreate={!!report && JSON.stringify(flow.reports.find(({ id }) => id === report.id)) !== JSON.stringify(report)}
            onCreate={() => { setReport(null); setErrors({}); setMessage(""); setTab("form"); }}
            onHistory={() => setTab("history")}
          />
        }
      />
      {loading && <p role="status">กำลังโหลดรายงาน…</p>}
      {error && <div><p role="alert">{error}</p><Button onClick={refresh}>ลองใหม่</Button></div>}
      {message && <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">{message}</p>}
      <div>

        {tab === "form" && (<div className="space-y-5">
          <SectionCard
            title="เอกสารต้นทาง"
            subtitle="เลือกใบสั่งผลิต V1 ที่บันทึกแล้ว ระบบจะใช้สูตร BOM ที่บันทึกไว้ในใบนั้น"
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/product-production-orders-v1"><Plus />ไปใบสั่งผลิต</Link>
              </Button>
            }
          >
            <SelectField
              label="ใบสั่งผลิต / รายการสินค้า"
              value={report ? `${report.orderId}|${report.orderLineId}` : "NONE"}
              onChange={(value) => value !== "NONE" && chooseSource(value)}
              options={[
                { value: "NONE", label: sourceOptions.length ? "เลือกรายการ" : "ยังไม่มีใบสูตรที่พร้อมรายงาน" },
                ...sourceOptions,
              ]}
            />
            {errors.source && <p className="mt-2 text-sm text-danger">{errors.source}</p>}
          </SectionCard>
          {report && line && (
            <form
              className="space-y-5"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save("RECORDED");
              }}
            >
              {!!Object.keys(errors).length && (
                <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  กรุณาตรวจสอบข้อมูลที่ระบุ
                </p>
              )}
              <SectionCard
                title={`${line.productCode} · ${line.productName}`}
                subtitle={`ใบสั่ง ${sheet?.orderNumber ?? "—"} · สูตร ${line.formulaVersion} · Lot ${line.lot} · แผน ${line.plannedQuantity.toLocaleString("th-TH")} ${line.plannedUnit}`}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {field("documentNumber", "เลขที่รายงาน *")}
                  {field("reportDate", "วันที่รายงาน *", "date")}
                  <SelectField
                    label="กะการผลิต *"
                    value={report.shift || "NONE"}
                    onChange={(shift) =>
                      setReport((current) =>
                        current
                          ? { ...current, shift: shift === "NONE" ? "" : shift }
                          : current,
                      )
                    }
                    options={[
                      { value: "NONE", label: "เลือกกะ" },
                      ...["กะเช้า", "กะบ่าย", "กะกลางคืน"].map((value) => ({ value, label: value })),
                    ]}
                  />
                  {field("productionLine", "ไลน์ผลิต *")}
                  {field("startTime", "เวลาเริ่ม *", "time")}
                  {field("endTime", "เวลาสิ้นสุด *", "time")}
                  {field("goodQuantity", `ยอดผลิตดี (${report.unit}) *`, "number")}
                  {field("wasteQuantity", `ของเสีย/สูญเสีย (${report.unit})`, "number")}
                  {field("operator", "ผู้รับผิดชอบ *")}
                </div>
              </SectionCard>
              <SectionCard
                title="วัตถุดิบตามสูตรเทียบใช้จริง"
                subtitle="ค่าตามแผนมาจาก snapshot ใบสูตร แก้ได้เฉพาะจำนวนใช้จริง"
              >
                <div className="space-y-4">
                  {report.materials.map((material, index) => (
                    <div key={material.materialId} className="grid items-end gap-4 rounded-lg border p-4 sm:grid-cols-[1fr_180px_180px]">
                      <div>
                        <p className="font-medium">{material.code} · {material.name}</p>
                        <p className="text-xs text-muted-foreground">ตามแผน {material.quantity.toLocaleString("th-TH", { maximumFractionDigits: 6 })} {material.unit}</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`production-report-material-${material.materialId}`}>
                          ใช้จริง ({material.unit})
                        </Label>
                        <Input
                          id={`production-report-material-${material.materialId}`}
                          name={`materials.${index}.actualQuantity`}
                          type="number"
                          step="any"
                          min="0"
                          value={material.actualQuantity ?? ""}
                          onChange={(event) =>
                            setReport((current) =>
                              current
                                ? {
                                    ...current,
                                    materials: current.materials.map(
                                      (row, materialIndex) =>
                                        materialIndex === index
                                          ? {
                                              ...row,
                                              actualQuantity:
                                                event.target.value === ""
                                                  ? null
                                                  : Number(event.target.value),
                                            }
                                          : row,
                                    ),
                                  }
                                : current,
                            )
                          }
                        />
                      </div>
                      <p className="text-xs text-danger">{errors[`materials.${index}.actualQuantity`] ?? ""}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title="หมายเหตุ">
                <Label htmlFor="production-report-note" className="sr-only">หมายเหตุ</Label>
                <Textarea
                  id="production-report-note"
                  name="note"
                  value={report.note}
                  onChange={(event) =>
                    setReport((current) =>
                      current ? { ...current, note: event.target.value } : current,
                    )
                  }
                />
              </SectionCard>
              <div className="flex flex-wrap justify-end gap-2">
                {report.status === "DRAFT" && <Button type="button" variant="outline" disabled={saving} onClick={() => void save("DRAFT")}>บันทึกแบบร่าง</Button>}
                <Button type="submit" disabled={saving}>บันทึกรายงาน</Button>
              </div>
            </form>
          )}
        </div>)}
        {tab === "history" && (<div>
          <SectionCard title="ประวัติรายงานการผลิต" subtitle="รายงานที่มีใบรับยอดยืนยันแล้วจะถูกล็อกไม่ให้แก้ไข">
            <FactoryDataTable variant="history"
              rows={flow.reports}
              rowKey={(row) => row.id}
              minWidth={850}
              columns={[
                { key: "number", label: "เลขที่", render: (row) => row.documentNumber },
                { key: "date", label: "วันที่", render: (row) => row.reportDate || "—" },
                {
                  key: "product",
                  label: "สินค้า",
                  render: (row) => {
                    const source = flow.formulaSheets
                      .find((sheet) => sheet.id === row.formulaSheetId)
                      ?.lines.find((line) => line.orderLineId === row.orderLineId);
                    return source ? `${source.productCode} · ${source.productName}` : "ไม่พบต้นทาง";
                  },
                },
                { key: "quantity", label: "ยอดผลิตดี", numeric: true, render: (row) => `${row.goodQuantity ?? 0} ${row.unit}` },
                { key: "status", label: "สถานะ", render: (row) => <StatusBadge tone={row.status === "RECORDED" ? "success" : "neutral"}>{row.status === "RECORDED" ? "บันทึกรายงานแล้ว" : "แบบร่าง"}</StatusBadge> },
                {
                  key: "actions",
                  label: "จัดการ",
                  render: (row) => (
                    <RowActionMenu>
                      <RowActionItem aria-label={`ดู ${row.documentNumber}`} onClick={() => setView(row)}><Eye /> ดูรายละเอียด</RowActionItem>
                      {!(row.status === "RECORDED" && data?.lockedOrderIds.includes(row.orderId)) && (
                        <RowActionItem aria-label={`แก้ไข ${row.documentNumber}`} onClick={() => { setReport(structuredClone(row)); setErrors({}); setTab("form"); }}><Pencil /> แก้ไข</RowActionItem>
                      )}
                    </RowActionMenu>
                  ),
                },
              ]}
            />
          </SectionCard>
        </div>)}
      </div>
      <ProductionReportDialog
        report={view}
        sheet={flow.formulaSheets.find((row) => row.id === view?.formulaSheetId) ?? null}
        onClose={() => setView(null)}
      />
    </div>
  );
}
