"use client";
import { useRef, useState } from "react";
import {
  Copy,
  FilePlus2,
  SlidersHorizontal,
  MoreHorizontal,
  Eye,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { PREditor } from "./pr-editor";
import { PRDetail } from "./pr-detail";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import {
  PageHeader,
  FactoryDataTable,
  Pagination,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import { usePR } from "./pr-provider";
import {
  actionLabel,
  actionRules,
  filterPRs,
  importExamplePR,
  quantitySummary,
  statusLabel,
  statusTone,
  type PR,
  type PRAction,
  type PRStatus,
} from "./pr-domain";
import {
  PRCommand,
  PRCreatePO,
  PRPreview,
  prDate,
} from "./pr-components";
import { PRPrintPreview } from "./pr-print-preview";

const emptyFilters = { search: "", status: "all", from: "", to: "" };
type RowOverlay =
  | { type: "workflow"; id: string; action: PRAction }
  | { type: "delete" | "create-po" | "print"; id: string };
export function PRList() {
  const { records, create, batch, act, copy, remove } = usePR();
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState("10");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [rowOverlay, setRowOverlay] = useState<RowOverlay | null>(null);
  const [document, setDocument] = useState<
    { mode: "new" } | { mode: "view" | "edit"; id: string } | null
  >(null);
  const actionButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocusId = useRef<string | null>(null);
  const filtered = filterPRs(records, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / Number(pageSize)));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * Number(pageSize),
    currentPage * Number(pageSize),
  );
  const selectedRows = filtered.filter((pr) => selected.includes(pr.id));
  const selectedOnPage = visible.filter((pr) =>
    selected.includes(pr.id),
  ).length;
  const invalidRange = Boolean(draft.from && draft.to && draft.from > draft.to);
  const update = (key: keyof typeof draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  function runBatch(
    action: "submit" | "approve" | "reject" | "cancel",
    reason: string,
  ) {
    batch(
      selectedRows.map((pr) => pr.id),
      action,
      reason,
    );
    setSelected([]);
    setMessage(`ดำเนินการ ${selectedRows.length} ใบสำเร็จ (สาธิต)`);
  }
  function afterMenu(id: string, action: () => void) {
    returnFocusId.current = id;
    // Let Radix close the menu before opening another modal and moving focus.
    window.setTimeout(action, 0);
  }
  function restoreMenuFocus() {
    const id = returnFocusId.current;
    returnFocusId.current = null;
    if (id)
      window.requestAnimationFrame(() => actionButtons.current.get(id)?.focus());
  }
  function closeRowOverlay(open: boolean) {
    if (!open) {
      setRowOverlay(null);
      restoreMenuFocus();
    }
  }
  const columns: Column<PR>[] = [
    {
      key: "select",
      label: "เลือกเอกสาร",
      header: (
        <Checkbox
          aria-label="เลือกเอกสารทั้งหมดในหน้านี้"
          disabled={!visible.length}
          checked={
            selectedOnPage === 0
              ? false
              : selectedOnPage === visible.length
                ? true
                : "indeterminate"
          }
          onCheckedChange={(checked) =>
            setSelected((ids) =>
              checked === true
                ? [...new Set([...ids, ...visible.map((pr) => pr.id)])]
                : ids.filter((id) => !visible.some((pr) => pr.id === id)),
            )
          }
        />
      ),
      render: (pr) => (
        <Checkbox
          aria-label={`เลือก ${pr.number}`}
          checked={selected.includes(pr.id)}
          onCheckedChange={() => toggle(pr.id)}
        />
      ),
    },
    {
      key: "number",
      label: "เลขที่ PR",
      render: (pr) => (
        <Button
          variant="link"
          className="h-auto px-0 font-semibold"
          onClick={() => setDocument({ mode: "view", id: pr.id })}
        >
          {pr.number}
        </Button>
      ),
    },
    { key: "date", label: "วันที่", render: (pr) => prDate(pr.date) },
    {
      key: "requester",
      label: "ผู้ขอซื้อ",
      render: (pr) => pr.requester || "—",
    },
    {
      key: "warehouse",
      label: "คลัง / Site",
      render: (pr) => pr.warehouseName || "—",
    },
    {
      key: "items",
      label: "รายการสินค้า",
      render: (pr) => (
        <span
          className="block max-w-48 truncate"
          title={pr.items.map((item) => item.name).join(", ")}
        >
          {pr.items.length} รายการ ·{" "}
          {pr.items.map((item) => item.name || "ยังไม่ระบุ").join(", ")}
        </span>
      ),
    },
    { key: "qty", label: "จำนวนแยกหน่วย", render: quantitySummary },
    {
      key: "status",
      label: "สถานะ",
      render: (pr) => (
        <StatusBadge tone={statusTone[pr.status]}>
          {statusLabel[pr.status]}
        </StatusBadge>
      ),
    },
    { key: "needed", label: "กำหนดใช้", render: (pr) => prDate(pr.neededDate) },

    {
      key: "action",
      label: "จัดการ",
      render: (pr) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={(button) => {
                if (button) actionButtons.current.set(pr.id, button);
                else actionButtons.current.delete(pr.id);
              }}
              variant="ghost"
              size="icon"
              aria-label={`จัดการ ${pr.number}`}
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                afterMenu(pr.id, () =>
                  setDocument({ mode: "view", id: pr.id }),
                )
              }
            >
              <Eye aria-hidden="true" />
              ดูรายละเอียด
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                afterMenu(pr.id, () => {
                  try {
                    setDocument({ mode: "edit", id: copy(pr.id) });
                  } catch (issue) {
                    setMessage(
                      issue instanceof Error ? issue.message : "คัดลอกไม่ได้",
                    );
                    restoreMenuFocus();
                  }
                })
              }
            >
              <Copy aria-hidden="true" />
              คัดลอกเป็นฉบับร่าง
            </DropdownMenuItem>
            {["draft", "rejected"].includes(pr.status) && (
              <DropdownMenuItem
                onSelect={() =>
                  afterMenu(pr.id, () =>
                    setDocument({ mode: "edit", id: pr.id }),
                  )
                }
              >
                <Pencil aria-hidden="true" />
                แก้ไข
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() =>
                afterMenu(pr.id, () =>
                  setRowOverlay({ type: "print", id: pr.id }),
                )
              }
            >
              <Printer aria-hidden="true" />
              พรีวิว / พิมพ์
            </DropdownMenuItem>
            {(Object.keys(actionRules) as PRAction[])
              .filter((action) => actionRules[action].from.includes(pr.status))
              .map((action) => (
                <DropdownMenuItem
                  key={action}
                  onSelect={() =>
                    afterMenu(pr.id, () =>
                      setRowOverlay({ type: "workflow", id: pr.id, action }),
                    )
                  }
                >
                  {actionLabel[action]}
                </DropdownMenuItem>
              ))}
            {pr.status === "draft" && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  afterMenu(pr.id, () =>
                    setRowOverlay({ type: "delete", id: pr.id }),
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                ลบฉบับร่าง
              </DropdownMenuItem>
            )}
            {["approved", "partial_po_created"].includes(pr.status) && (
              <DropdownMenuItem
                onSelect={() =>
                  afterMenu(pr.id, () =>
                    setRowOverlay({ type: "create-po", id: pr.id }),
                  )
                }
              >
                สร้าง PO สาธิต
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        title="ใบขอซื้อ (PR)"
        description="ข้อมูลและ workflow สาธิตเท่านั้น · โหลดแอปใหม่จะกลับเป็นข้อมูลเริ่มต้น"
        actions={
          <Button onClick={() => setDocument({ mode: "new" })}>
            <FilePlus2 aria-hidden="true" />
            สร้าง PR
          </Button>
        }
      />
      <Card className="factory-toolbar gap-0 overflow-hidden py-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface-muted px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <SlidersHorizontal
              aria-hidden="true"
              className="size-4 text-primary"
            />
            ค้นหาและจัดการใบขอซื้อ
          </CardTitle>
          <CardDescription>{filtered.length} เอกสารในรายการ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <form
            aria-label="ตัวกรอง PR"
            className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!invalidRange) {
                setFilters({ ...draft });
                setPage(1);
                setSelected([]);
              }
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="pr-search">ค้นหา PR</Label>
              <Input
                id="pr-search"
                placeholder="เลขที่ PR / ผู้ขอซื้อ / สินค้า / คลัง"
                value={draft.search}
                onChange={(event) => update("search", event.target.value)}
              />
            </div>
            <SelectField
              label="สถานะ PR"
              value={draft.status}
              onChange={(value) => update("status", value)}
              options={[
                { value: "all", label: "ทุกสถานะ" },
                ...(Object.keys(statusLabel) as PRStatus[]).map((value) => ({
                  value,
                  label: statusLabel[value],
                })),
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline">
                    ช่วงวันที่{draft.from || draft.to ? " · ตั้งค่าแล้ว" : ""}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="max-w-[calc(100vw-2rem)] space-y-3"
                >
                  <div className="grid gap-2">
                    <Label htmlFor="pr-from">วันที่เริ่มต้น</Label>
                    <Input
                      id="pr-from"
                      type="date"
                      value={draft.from}
                      max={draft.to || undefined}
                      onChange={(event) => update("from", event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="pr-to">วันที่สิ้นสุด</Label>
                    <Input
                      id="pr-to"
                      type="date"
                      value={draft.to}
                      min={draft.from || undefined}
                      onChange={(event) => update("to", event.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    รวมวันเริ่มต้นและสิ้นสุด · กดค้นหาเพื่อใช้
                  </p>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(emptyFilters);
                  setFilters(emptyFilters);
                  setPage(1);
                  setSelected([]);
                }}
              >
                ล้างตัวกรอง
              </Button>
              <Button type="submit" disabled={invalidRange}>
                ค้นหา
              </Button>
            </div>
          </form>
          {invalidRange && (
            <p role="alert" className="text-sm text-danger">
              วันที่สิ้นสุดต้องไม่น้อยกว่าวันเริ่มต้น
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <PRCommand
                title="Import Excel (สาธิต)"
                description="ยังไม่อ่านไฟล์ Excel ทดลองนำเข้าข้อมูลตัวอย่าง 1 ใบ ตรวจซ้ำด้วยเลขอ้างอิงก่อนสร้าง ไม่มีการทับข้อมูลเดิม"
                trigger={
                  <Button variant="outline">Import Excel (สาธิต)</Button>
                }
                onConfirm={() => {
                  create(importExamplePR(), false, true);
                  setPage(1);
                  setMessage("นำเข้าตัวอย่างแล้ว ค้นหา IMPORT-DEMO-001 ได้");
                }}
              >
                <p className="text-sm">
                  IMPORT-DEMO-001 · วัสดุทดลองสำหรับงานซ่อมบำรุง · 1 ชิ้น ·
                  120.50 บาท · บันทึกเป็นฉบับร่าง
                </p>
              </PRCommand>
              <PRPreview
                records={selectedRows.length ? selectedRows : filtered}
                mode="print"
              />
              <PRPreview
                records={selectedRows.length ? selectedRows : filtered}
                mode="excel"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {selectedRows.length
                ? `เลือก ${selectedRows.length} ใบแล้ว`
                : "ติ๊กช่องหน้าเอกสารเพื่อพิมพ์หรือดำเนินการหลายใบ"}{" "}
              · พบ {filtered.length} ใบ
            </p>
            {selectedRows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                ล้างการเลือก
              </Button>
            )}
            {selectedRows.length > 0 &&
              (
                [
                  ["submit", "ส่งอนุมัติ"],
                  ["approve", "อนุมัติ"],
                  ["reject", "ไม่อนุมัติ"],
                  ["cancel", "ยกเลิก"],
                ] as const
              ).map(([action, label]) => (
                <PRCommand
                  key={action}
                  title={`${label}หลายใบ`}
                  description={`ตรวจทุกใบก่อนเปลี่ยนข้อมูล หากมีใบใดทำไม่ได้จะไม่เปลี่ยนทั้งชุด · เลือก ${selectedRows.length} ใบ`}
                  requiresReason={action === "reject" || action === "cancel"}
                  trigger={
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!selectedRows.length}
                    >
                      {label}ที่เลือก
                    </Button>
                  }
                  onConfirm={(reason) => runBatch(action, reason)}
                />
              ))}
          </div>
          <p
            role="status"
            className={message ? "text-sm text-muted-foreground" : "sr-only"}
          >
            {message}
          </p>
        </CardContent>
      </Card>
      <FactoryDataTable
        columns={columns}
        rows={visible}
        rowKey={(pr) => pr.id}
        minWidth={1400}
        pagination={
          <div className="flex flex-wrap items-center justify-between gap-4 border-t px-4 py-4 [&>div:last-child]:border-0 [&>div:last-child]:p-0">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="pr-page-size"
                className="text-xs text-muted-foreground"
              >
                จำนวนต่อหน้า
              </Label>
              <Select
                value={pageSize}
                onValueChange={(value) => {
                  setPageSize(value);
                  setPage(1);
                }}
              >
                <SelectTrigger id="pr-page-size" className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["5", "10", "25", "50"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Pagination
              page={currentPage}
              pageSize={Number(pageSize)}
              total={filtered.length}
              onChange={setPage}
            />
          </div>
        }
      />
      {rowOverlay?.type === "workflow" &&
        (() => {
          const pr = records.find((row) => row.id === rowOverlay.id);
          const action = rowOverlay.action;
          return pr ? (
            <PRCommand
              key={`workflow-${pr.id}-${action}`}
              open
              onOpenChange={closeRowOverlay}
              title={`${actionLabel[action]} PR`}
              description={
                action === "cancel" && pr.purchaseOrders.length
                  ? "ยกเลิกยอดค้างซื้อของ PR เท่านั้น PO สาธิตที่ออกแล้วคงอยู่ ไม่ได้ยกเลิกตาม"
                  : action === "approve" || action === "reject"
                    ? `ผู้อนุมัติที่กำหนด: ${pr.approver} · ผู้ใช้ปัจจุบันในต้นแบบเป็นผู้ดูแลสาธิต`
                    : "ตรวจสอบข้อมูลก่อนยืนยัน"
              }
              requiresReason={action === "reject" || action === "cancel"}
              onConfirm={(reason) => act(pr.id, action, reason)}
            />
          ) : null;
        })()}
      {rowOverlay?.type === "delete" && (
        <PRCommand
          key={`delete-${rowOverlay.id}`}
          open
          onOpenChange={closeRowOverlay}
          title="ลบฉบับร่าง PR"
          description="ลบออกจากรายการสาธิต ประวัติการลบยังอยู่จนโหลดแอปใหม่"
          onConfirm={() => remove(rowOverlay.id)}
        />
      )}
      {rowOverlay?.type === "create-po" &&
        (() => {
          const pr = records.find((row) => row.id === rowOverlay.id);
          return pr ? (
            <PRCreatePO
              key={`create-po-${pr.id}-${pr.revision}`}
              pr={pr}
              open
              onOpenChange={closeRowOverlay}
              trigger={null}
            />
          ) : null;
        })()}
      {rowOverlay?.type === "print" &&
        (() => {
          const pr = records.find((row) => row.id === rowOverlay.id);
          return pr ? (
            <PRPrintPreview
              key={`print-${pr.id}-${pr.revision}`}
              records={[pr]}
              open
              onOpenChange={closeRowOverlay}
              trigger={null}
            />
          ) : null;
        })()}
      <Dialog
        open={document !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDocument(null);
            restoreMenuFocus();
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {document?.mode === "new"
                ? "สร้างใบขอซื้อ"
                : document?.mode === "edit"
                  ? "แก้ไขใบขอซื้อ"
                  : "รายละเอียดใบขอซื้อ"}
            </DialogTitle>
            <DialogDescription>
              จัดการ PR ในหน้าต่างนี้ · ข้อมูลสาธิต
            </DialogDescription>
          </DialogHeader>
          {document?.mode === "new" ? (
            <PREditor
              key="new"
              onSaved={(id) => setDocument({ mode: "view", id })}
              onCancel={() => setDocument(null)}
            />
          ) : document?.mode === "edit" ? (
            (() => {
              const pr = records.find((row) => row.id === document.id);
              return pr ? (
                <PREditor
                  key={`edit-${pr.id}`}
                  original={pr}
                  onSaved={(id) => setDocument({ mode: "view", id })}
                  onCancel={() => setDocument({ mode: "view", id: pr.id })}
                />
              ) : (
                <p role="alert">ไม่พบ PR</p>
              );
            })()
          ) : document?.mode === "view" ? (
            <PRDetail
              key={`view-${document.id}`}
              id={document.id}
              onEdit={(id) => setDocument({ mode: "edit", id })}
              onClose={() => setDocument(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
