"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Inbox,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "../ui/empty";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { statusTones, type Tone } from "@/src/lib/constants/status";
import { cn } from "@/src/lib/utils";

export function PageHeader({
  title,
  description,
  parent,
  actions,
}: {
  title: string;
  description?: string;
  parent?: { title: string; href: string };
  actions?: ReactNode;
}) {
  return (
    <div className="factory-page-header space-y-2">
      {parent && (
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={parent.href}>{parent.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="no-print flex flex-wrap gap-2">{actions}</div>
      </div>
    </div>
  );
}
export function BackButton({ href }: { href: string }) {
  return (
    <Button variant="outline" asChild>
      <Link href={href}>
        <ArrowLeft />
        กลับรายการ
      </Link>
    </Button>
  );
}
export function RefreshButton({ onClick }: { onClick?: () => void }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-2">
      <span role="status" className="text-xs text-muted-foreground">
        {message}
      </span>
      <Button
        variant="outline"
        onClick={() => {
          onClick?.();
          setMessage("อัปเดตข้อมูล demo แล้ว");
        }}
      >
        <RefreshCw />
        รีเฟรช
      </Button>
    </div>
  );
}
const tones: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/20 bg-info/8 text-info",
  warning: "border-warning/20 bg-warning/8 text-warning",
  success: "border-success/20 bg-success/8 text-success",
  destructive: "border-danger/20 bg-danger/8 text-danger",
};
export function StatusBadge({
  children,
  tone,
}: {
  children: string;
  tone?: Tone;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        tones[tone ?? statusTones[children] ?? "neutral"],
      )}
    >
      {children}
    </Badge>
  );
}
export function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="factory-section gap-4 overflow-hidden border py-5 shadow-none">
      <CardHeader className="flex flex-col gap-2 px-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base leading-relaxed">
            <h2>{title}</h2>
          </CardTitle>
          {subtitle && (
            <CardDescription className="mt-1 leading-relaxed">
              {subtitle}
            </CardDescription>
          )}
        </div>
        {action && (
          <div className="no-print flex flex-wrap gap-2">{action}</div>
        )}
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  );
}
export function InfoRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium leading-relaxed">{children}</dd>
    </div>
  );
}
export function InfoGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
      {children}
    </dl>
  );
}
export function EmptyState({
  title = "ไม่พบรายการ",
  description = "ลองเปลี่ยนตัวกรองหรือค้นหาด้วยคำอื่น",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="px-4 py-14">
      <EmptyHeader>
        <EmptyMedia>
          <Inbox className="size-9 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
export function ErrorState({ retry }: { retry?: () => void }) {
  return (
    <Alert variant="destructive" className="border-danger/20 bg-danger/5 p-5">
      <AlertCircle className="text-danger" />
      <AlertTitle>ไม่สามารถแสดงข้อมูลได้</AlertTitle>
      <AlertDescription className="mt-1 text-xs">
        ตัวอย่างสถานะผิดพลาด · ไม่มีการเรียก API
      </AlertDescription>
      {retry && (
        <Button
          variant="outline"
          className="col-start-2 mt-3 w-fit"
          onClick={retry}
        >
          ลองใหม่
        </Button>
      )}
    </Alert>
  );
}
export function LoadingState() {
  return (
    <div role="status" aria-label="กำลังโหลด" className="space-y-4 p-5">
      <span className="sr-only">กำลังโหลดข้อมูล</span>
      {[1, 2, 3, 4].map((n) => (
        <Skeleton key={n} className="h-10 w-full" />
      ))}
    </div>
  );
}
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T, index: number) => ReactNode;
  numeric?: boolean;
}
export function FactoryDataTable<T>({
  columns,
  rows,
  rowKey,
  pagination,
  state = "normal",
  retry,
  minWidth = 1000,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  pagination?: ReactNode;
  state?: "normal" | "loading" | "error";
  retry?: () => void;
  minWidth?: number;
}) {
  return (
    <div className="factory-table overflow-hidden rounded-xl border bg-surface">
      <div
        tabIndex={0}
        role="region"
        aria-label="ตารางข้อมูล เลื่อนแนวนอนเพื่อดูทุกคอลัมน์"
        className="overflow-x-auto"
      >
        <Table style={{ minWidth }}>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-10 px-4 text-xs font-medium whitespace-nowrap",
                    c.numeric && "text-right",
                  )}
                >
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {state === "normal" && rows.length > 0 ? (
              rows.map((row, index) => (
                <TableRow key={rowKey(row)} className="hover:bg-surface-muted">
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5 align-middle",
                        c.numeric && "text-right tabular-nums",
                      )}
                    >
                      {c.render(row, index)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  {state === "loading" ? (
                    <LoadingState />
                  ) : state === "error" ? (
                    <ErrorState retry={retry} />
                  ) : (
                    <EmptyState />
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination}
    </div>
  );
}
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 text-xs text-muted-foreground">
      <p>
        {total === 0
          ? "0 รายการ"
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} จาก ${total} รายการ`}
      </p>
      <nav aria-label="แบ่งหน้าตาราง" className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ก่อนหน้า
        </Button>
        <span aria-live="polite">
          หน้า {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          ถัดไป
        </Button>
      </nav>
    </div>
  );
}
export interface Filters {
  search: string;
  status: string;
  from: string;
  to: string;
  pageSize: number;
  cancellation: string;
  productType: string;
}
export const defaultFilters: Filters = {
  search: "",
  status: "all",
  from: "",
  to: "",
  pageSize: 10,
  cancellation: "all",
  productType: "all",
};
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="h-10 w-full bg-surface">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function FilterBar({
  statuses,
  onApply,
  production = false,
  product = false,
}: {
  statuses: string[];
  onApply: (filters: Filters) => void;
  production?: boolean;
  product?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<Filters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterError, setFilterError] = useState("");
  function apply() {
    // Portal fields are unmounted when closed, so retain their original date validation here.
    if (draft.from && draft.to && draft.to < draft.from) {
      setFilterError("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น");
      setFiltersOpen(true);
      return;
    }
    setFilterError("");
    onApply(draft);
    setFiltersOpen(false);
  }
  const field = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  return (
    <form
      id={`${id}-filters`}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="factory-filter grid items-end gap-3 sm:grid-cols-2 @[900px]/main:grid-cols-[minmax(160px,1fr)_170px_auto_auto]"
    >
      <div className="space-y-2">
        <Label htmlFor={`${id}-search`}>ค้นหา</Label>
        <Input
          id={`${id}-search`}
          value={draft.search}
          onChange={(e) => field("search", e.target.value)}
          placeholder="เลขที่เอกสาร ลูกค้า หรือสินค้า"
          className="h-10"
        />
      </div>
      <SelectField
        label={product ? "สถานะ" : "สถานะเอกสาร"}
        value={draft.status}
        onChange={(v) => field("status", v)}
        options={[
          { value: "all", label: "ทั้งหมด" },
          ...statuses.map((v) => ({ value: v, label: v })),
        ]}
      />
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline">
            ตัวกรองเพิ่มเติม
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(400px,calc(100vw-32px))]">
          <div className="grid gap-4 sm:grid-cols-2">
            {production && (
              <SelectField
                label="สถานะยกเลิก"
                value={draft.cancellation}
                onChange={(v) => field("cancellation", v)}
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  { value: "none", label: "ไม่มีคำขอยกเลิก" },
                  { value: "pending", label: "รอพิจารณา" },
                ]}
              />
            )}
            {product && (
              <SelectField
                label="ประเภทสินค้า"
                value={draft.productType}
                onChange={(v) => field("productType", v)}
                options={[
                  { value: "all", label: "ทั้งหมด" },
                  ...["วัตถุดิบ", "สินค้าสำเร็จรูป", "บรรจุภัณฑ์"].map((v) => ({
                    value: v,
                    label: v,
                  })),
                ]}
              />
            )}
            <SelectField
              label="จำนวนต่อหน้า"
              value={String(draft.pageSize)}
              onChange={(v) => field("pageSize", Number(v))}
              options={[5, 10, 20].map((n) => ({
                value: String(n),
                label: `${n} รายการ`,
              }))}
            />
            {!product && (
              <>
                {(["from", "to"] as const).map((key) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={`${id}-${key}`}>
                      {key === "from" ? "วันที่เริ่มต้น" : "วันที่สิ้นสุด"}
                    </Label>
                    <Input
                      id={`${id}-${key}`}
                      type="date"
                      form={`${id}-filters`}
                      aria-invalid={!!filterError}
                      aria-describedby={
                        filterError ? `${id}-filter-error` : undefined
                      }
                      value={draft[key]}
                      min={key === "to" ? draft.from : undefined}
                      onChange={(e) => field(key, e.target.value)}
                      className="h-10"
                    />
                  </div>
                ))}
              </>
            )}
          </div>
          {filterError && (
            <p
              role="alert"
              id={`${id}-filter-error`}
              className="mt-3 text-sm text-danger"
            >
              {filterError}
            </p>
          )}
          <Button type="button" onClick={apply} className="mt-4 w-full">
            ใช้ตัวกรอง
          </Button>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(defaultFilters);
            setFilterError("");
            onApply(defaultFilters);
          }}
        >
          ล้างตัวกรอง
        </Button>
        <Button type="submit">
          <Search />
          ค้นหา
        </Button>
      </div>
    </form>
  );
}
