
"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useMemo, useState } from "react";
import { Plus, Trash2, Upload, PackageSearch, Link2 } from "lucide-react";
import { DocumentViewActions,
  PageHeader,
  SectionCard,
  FactoryDataTable,
  Pagination,
} from "@/src/components/factory/patterns";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/src/components/ui/dialog";

import { PackagingLoadStatus, usePackagingData } from "../packaging-reports/packaging-client";
import { thaiDate } from "../packaging-reports/packaging-domain";
import type { PackingItem, PackingSummary, PackingSummaryData } from "./packing-summary-domain";

function emptyItem(id = crypto.randomUUID()): PackingItem {
  return {
    id,
    productName: "",
    sizeKg: "",
    quantity: "",
    unit: "",
    remark: "",
  };
}

const blankSigners = { packer: "", supervisor: "", packingHead: "", approver: "" };

const signerFields = [
  { key: "packer", label: "ผู้สั่งแพ็ค / ผู้จ่ายกระสอบ" },
  { key: "supervisor", label: "เจ้าหน้าที่ QC." },
  { key: "packingHead", label: "หัวหน้าแพ็ก / ผู้เบิกกระสอบ" },
  { key: "approver", label: "ผู้อนุมัติ" },
] as const;

export function PackingSummaryWorkspace() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [documentNo, setDocumentNo] = useState("IT-");
  const [items, setItems] = useState<PackingItem[]>([emptyItem("initial-item")]);
  const [signers, setSigners] = useState(blankSigners);
  const [reportIds, setReportIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<PackingSummary | null>(null);
  const [view, setView] = useState<PackingSummary | null>(null);
  const [tab, setTab] = useState("history");
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [selectReports, setSelectReports] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const source = usePackagingData<PackingSummaryData>("packing_summary");
  const { data, busy, loading, error } = source;
  const reports = data?.reports ?? [];
  const nameFor = (id: string) => reports.find((report) => report.id === id)?.documentNumber ?? id;
  const available = reports.filter((report) => !report.linkedSummaryId || report.linkedSummaryId === editing?.id);
  const filtered = (data?.records ?? []).filter((record) =>
    (!from || record.date >= from) && (!to || record.date <= to) &&
    [record.documentNo, record.location, ...record.items.map((item) => item.productName), ...record.reportIds.map(nameFor)]
      .some((value) => value.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const pageSize = 10;
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));

  function open(record: PackingSummary | null) {
    setEditing(record);
    setLocation(record?.location ?? "");
    setDate(record?.date ?? "");
    setDocumentNo(record?.documentNo ?? "IT-");
    setItems(record?.items ?? [emptyItem()]);
    setSigners(record?.signers ?? blankSigners);
    setReportIds(record?.reportIds ?? []);
    setNotice("");
    setSaveError("");
    setTab("form");
  }

  async function save() {
    if (busy || loading || error) return;
    setNotice("");
    setSaveError("");
    try {
      const saved = await source.mutate<PackingSummary>({
        action: "save",
        document: { id: editing?.id ?? "", updatedAt: editing?.updatedAt ?? "", location, date, documentNo, items, signers, reportIds },
      });
      open(saved);
      setNotice(`บันทึก ${saved.documentNo} เรียบร้อยแล้ว`);
      setSearch("");
      setFrom("");
      setTo("");
      setPage(1);
      setTab("history");
      source.retry();
    } catch (issue) {
      setSaveError(issue instanceof Error ? issue.message : "บันทึกใบแจ้งสั่งแพ็คไม่สำเร็จ");
    }
  }

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

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="ใบแจ้งสั่งแพ็คสินค้า"
        description="บันทึกรายการสินค้าและผูกรายงานการบรรจุ iTech ได้ตามต้องการ"
        actions={<DocumentViewActions showingForm={tab === "form"} createLabel="สร้างใบแจ้งสั่งแพ็ค" disabled={busy} onCreate={() => open(null)} onHistory={() => setTab("history")} />}
      />
      <PackagingLoadStatus loading={loading} error={error} retry={source.retry} />
      {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
      <div className="space-y-5">


        {tab === "form" && (<div className="space-y-5">
          <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
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
                <Label htmlFor="pack-report-refs">
                  อ้างอิงเอกสาร ใบรายงานการบรรจุปุ๋ยอินทรีย์
                </Label>

                <div className="flex flex-wrap gap-2">
                  <Input
                    id="pack-report-refs"
                    readOnly
                    value={reportIds.map(nameFor).join(", ")}
                    placeholder="ยังไม่ได้เลือกเอกสารอ้างอิง"
                    className="min-w-44 flex-1"
                  />
                  <Button
                    type="button"
                    disabled={loading || Boolean(error)}
                    onClick={() => setSelectReports(true)}
                  >
                    <Link2 className="size-4" />
                    ผูกกับใบรายงานการบรรจุ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!reportIds.length}
                    onClick={() => setReportIds([])}
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
                        <Input
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

          <div className="flex flex-wrap items-center justify-end gap-3">
            {saveError && <p role="alert" className="mr-auto text-sm text-danger">{saveError}</p>}
            <Button type="submit" disabled={loading || Boolean(error)}>
              {busy ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึกใบแจ้งสั่งแพ็ค"}
            </Button>
          </div>
          </fieldset>
          </form>
        </div>)}

        {tab === "history" && (<div>
          <SectionCard
            title="ข้อมูลที่บันทึก"
            subtitle="ประวัติใบแจ้งสั่งแพ็คสินค้า"
          >
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  aria-label="ค้นหาประวัติใบแจ้งสั่งแพ็ค"
                  placeholder="ค้นหาเอกสาร / สถานที่ / สินค้า"
                  value={search}
                  onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                />
                <Input type="date" aria-label="จากวันที่" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
                <Input type="date" aria-label="ถึงวันที่" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
              </div>

              {!loading && !error && <FactoryDataTable variant="history"
                rows={filtered.slice((activePage - 1) * pageSize, activePage * pageSize)}
                rowKey={(record) => record.id}
                minWidth={760}
                columns={[
                  { key: "no", label: "เลขที่เอกสาร", render: (record) => record.documentNo },
                  { key: "date", label: "วันที่", render: (record) => thaiDate(record.date) },
                  { key: "location", label: "สถานที่", render: (record) => record.location },
                  { key: "items", label: "รายการสินค้า", render: (record) => record.items.length },
                  { key: "reports", label: "รายงานอ้างอิง", render: (record) => record.reportIds.map(nameFor).join(", ") || "—" },
                  { key: "actions", label: "จัดการ", render: (record) => (
                    <RowActionMenu>
                      <RowActionItem onClick={() => setView(record)}>ดูรายละเอียด</RowActionItem>
                      <RowActionItem disabled={busy} onClick={() => open(record)}>แก้ไข</RowActionItem>
                    </RowActionMenu>
                  ) },
                ]}
                pagination={<Pagination page={activePage} pageSize={pageSize} total={filtered.length} onChange={setPage} />}
              />}
            </div>
          </SectionCard>
        </div>)}
      </div>
      <Dialog open={selectReports} onOpenChange={setSelectReports}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>ผูกกับใบรายงานการบรรจุ</DialogTitle>
            <DialogDescription>เลือกได้หลายรายงานของ iTech ระบบจะบันทึกการผูกเมื่อกดบันทึกใบแจ้งสั่งแพ็ค</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50dvh] space-y-2 overflow-auto">
            {available.length === 0 && <p className="text-sm text-muted-foreground">ไม่มีรายงาน iTech ที่พร้อมให้เลือก</p>}
            {available.map((report) => (
              <div key={report.id} className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                  id={`link-${report.id}`}
                  checked={reportIds.includes(report.id)}
                  onCheckedChange={(checked) => setReportIds((ids) =>
                    checked === true ? [...new Set([...ids, report.id])] : ids.filter((id) => id !== report.id),
                  )}
                />
                <Label htmlFor={`link-${report.id}`}>{report.documentNumber} · {report.status === "DRAFT" ? "แบบร่าง" : "บันทึกแล้ว"}</Label>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => setSelectReports(false)}>ตกลง</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={view !== null} onOpenChange={(open) => { if (!open) setView(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>ใบแจ้งสั่งแพ็ค {view?.documentNo}</DialogTitle>
            <DialogDescription>{view?.location} · {view ? thaiDate(view.date) : ""}</DialogDescription>
          </DialogHeader>
          {view && <>
            <p className="text-sm">รายงานอ้างอิง {view.reportIds.map(nameFor).join(", ") || "—"}</p>
            <FactoryDataTable
              rows={view.items}
              rowKey={(item) => item.id}
              columns={[
                { key: "product", label: "สินค้า", render: (item) => item.productName },
                { key: "size", label: "ขนาด (kg)", render: (item) => item.sizeKg || "—" },
                { key: "qty", label: "จำนวน", render: (item) => item.quantity },
                { key: "unit", label: "หน่วยนับ", render: (item) => item.unit },
                { key: "remark", label: "หมายเหตุ", render: (item) => item.remark || "—" },
              ]}
            />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {signerFields.map(({ key, label }) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd>{view.signers[key] || "—"}</dd></div>)}
            </dl>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
