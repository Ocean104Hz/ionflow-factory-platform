"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Truck,
  ReceiptText,
  Package,
  Settings,
  Bell,
  Menu,
  ChevronDown,
  CircleHelp,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Separator } from "../ui/separator";
import { cn } from "@/src/lib/utils";
import { useBranding } from "./branding-provider";
import { BrandingEditor } from "./branding-editor";
import { FactoryLogo } from "./factory-logo";

const navigation = [
  {
    group: "OVERVIEW",
    title: "แดชบอร์ด",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    group: "PRODUCTION",
    title: "คำสั่งการผลิต",
    href: "/production-orders",
    icon: ClipboardList,
  },
  {
    group: "LOGISTICS",
    title: "ใบส่งสินค้า",
    href: "/delivery-orders",
    icon: Truck,
  },
  {
    group: "SALES DOCUMENTS",
    title: "ใบแจ้งหนี้",
    href: "/invoices",
    icon: ReceiptText,
  },
  {
    group: "MASTER DATA",
    title: "สินค้าและราคากลาง",
    href: "/products",
    icon: Package,
  },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { branding } = useBranding();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const current = navigation.find((item) => pathname.startsWith(item.href));
  function renderNavigation(compact = false) {
    return (
      <>
        <Link
          href="/dashboard"
          aria-label={branding.factoryName}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center py-7",
            compact ? "justify-center px-2" : "px-5",
          )}
        >
          <FactoryLogo compact={compact} />
        </Link>
        <Separator />
        <nav
          aria-label="เมนูโรงงาน"
          className={cn(
            "flex-1 py-5",
            compact ? "space-y-3 px-2" : "space-y-4 px-3",
          )}
        >
          {navigation.map((item) => {
            const link = (
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-label={compact ? item.title : undefined}
                aria-current={
                  pathname.startsWith(item.href) ? "page" : undefined
                }
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-muted-foreground transition-colors hover:bg-muted",
                  compact && "justify-center",
                  pathname.startsWith(item.href) && "bg-accent text-primary",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {!compact && item.title}
              </Link>
            );
            return (
              <div key={item.href}>
                {!compact && (
                  <p className="mb-2 px-3 text-xs font-medium tracking-widest text-muted-foreground">
                    {item.group}
                  </p>
                )}
                {compact ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.title}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </div>
            );
          })}
        </nav>
        <div className={cn("space-y-3 border-t", compact ? "p-2" : "p-4")}>
          <BrandingEditor
            trigger={
              <Button
                variant="ghost"
                aria-label="ปรับแต่งโรงงาน"
                title={compact ? "ปรับแต่งโรงงาน" : undefined}
                className={cn(
                  "w-full text-muted-foreground",
                  compact ? "justify-center px-0" : "justify-start",
                )}
              >
                <Settings />
                {!compact && "ปรับแต่งโรงงาน"}
              </Button>
            }
          />
          {!compact && (
            <div className="factory-demo-panel rounded-lg border p-3">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="size-2 rounded-full bg-warning" />
                DEMO WORKSPACE
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                ข้อมูลสมมติ · ไม่เชื่อมต่อระบบจริง
              </p>
            </div>
          )}
        </div>
      </>
    );
  }
  return (
    <TooltipProvider>
      <a
        href="#main-content"
        className="sr-only z-[100] rounded bg-surface p-3 focus:not-sr-only focus:fixed"
      >
        ข้ามไปเนื้อหา
      </a>
      <div className="min-h-screen">
        <aside
          id="factory-sidebar"
          className={cn(
            "factory-sidebar no-print fixed inset-y-0 left-0 hidden flex-col overflow-y-auto border-r lg:flex",
            collapsed ? "w-20" : "w-64",
          )}
        >
          {renderNavigation(collapsed)}
        </aside>
        <div
          className={cn(
            "print:pl-0",
            collapsed ? "lg:pl-20" : "lg:pl-64",
          )}
        >
          <header className="no-print sticky top-0 z-30 flex h-18 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="hidden shrink-0 lg:inline-flex"
                aria-controls="factory-sidebar"
                aria-expanded={!collapsed}
                aria-label={collapsed ? "ขยาย sidebar" : "ยุบ sidebar"}
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
              </Button>
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="เปิดเมนู"
                    className="shrink-0 lg:hidden"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="factory-sidebar flex w-72 flex-col gap-0 overflow-y-auto p-0"
                >
                  <SheetHeader className="sr-only">
                    <SheetTitle>เมนู {branding.factoryName}</SheetTitle>
                    <SheetDescription>เลือกหน้าในโรงงานสาธิต</SheetDescription>
                  </SheetHeader>
                  {renderNavigation()}
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {current?.title ?? branding.factoryName}
                </p>
                <p
                  className="mt-1 max-w-60 truncate text-xs text-muted-foreground"
                  title={branding.factoryName}
                >
                  {branding.factoryName} · {branding.shortName}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="ข้อมูล demo"
                    className="hidden sm:inline-flex"
                  >
                    <CircleHelp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  ข้อมูลธุรกิจจะคืนค่าเมื่อโหลดใหม่ · branding
                  บันทึกในเบราว์เซอร์
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="การแจ้งเตือนตัวอย่าง"
                  >
                    <Bell />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>
                    การแจ้งเตือน · ข้อมูลสมมติ
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <p className="p-3 text-sm text-muted-foreground">
                    มีคำสั่งรออนุมัติในหน้าคำสั่งการผลิต
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>
              <Separator orientation="vertical" className="h-7" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label="เมนูผู้ใช้งานสาธิต"
                    className="h-auto gap-2 p-1"
                  >
                    <span className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                      {branding.shortName.slice(0, 2)}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block text-xs font-semibold">
                        ผู้ใช้งานสาธิต
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Factory administrator
                      </span>
                    </span>
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    บัญชีสมมติ · ไม่มี authentication
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/login">กลับหน้า Login (demo)</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main
            id="main-content"
            className="factory-content mx-auto max-w-[1680px] space-y-6 px-4 py-7 sm:px-7 lg:px-8 lg:py-8"
          >
            {children}
            <footer className="no-print flex flex-wrap justify-between gap-2 pt-4 text-[10px] tracking-wide text-muted-foreground">
              <span>{branding.shortName} FACTORY · UI STANDARD / 01</span>
              <span>ข้อมูลสมมติเท่านั้น · ไม่ใช้เป็นเอกสารทางธุรกิจ</span>
            </footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
